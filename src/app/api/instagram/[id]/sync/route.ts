import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/crypto";
import {
  GraphApiError,
  fetchAccountInsights,
  refreshLongLivedToken,
} from "@/lib/instagram/graph-api";

/**
 * Sincroniza o status real da conta com a Meta: valida o token, atualiza
 * métricas (seguidores, alcance, etc.) e detecta se a conta foi desconectada,
 * teve o token expirado ou está sob revisão/restrição.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const account = await prisma.instagramAccount.findFirst({ where: { id, userId: session.user.id } });
  if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

  try {
    const accessToken = decryptToken(account.accessToken);

    // Renova o token de longa duração se estiver perto de expirar (faltando < 7 dias).
    let tokenToUse = accessToken;
    let newExpiry = account.tokenExpiresAt;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() - Date.now() < sevenDaysMs) {
      const refreshed = await refreshLongLivedToken(accessToken);
      tokenToUse = refreshed.access_token;
      newExpiry = refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : account.tokenExpiresAt;
    }

    const insights = await fetchAccountInsights(account.igUserId, tokenToUse);

    const updated = await prisma.instagramAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encryptToken(tokenToUse),
        tokenExpiresAt: newExpiry,
        status: "CONNECTED",
        lastError: null,
        lastSyncedAt: new Date(),
        insightsSnapshots: { create: insights },
      },
    });

    return NextResponse.json({ account: { id: updated.id, status: updated.status }, insights });
  } catch (err) {
    const status = err instanceof GraphApiError && (err.status === 401 || err.status === 403)
      ? "TOKEN_EXPIRED"
      : "ACTION_REQUIRED";
    const message = err instanceof Error ? err.message : "Falha ao sincronizar com a Meta.";

    await prisma.instagramAccount.update({
      where: { id: account.id },
      data: {
        status,
        lastError: message,
        lastSyncedAt: new Date(),
        activityLogs: { create: { type: "STATUS_CHANGED", message: `Status alterado para ${status}: ${message}` } },
      },
    });

    return NextResponse.json({ error: message, status }, { status: 200 });
  }
}
