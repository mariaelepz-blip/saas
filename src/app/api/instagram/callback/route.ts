import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/crypto";
import { exchangeCodeForToken } from "@/lib/instagram/oauth";
import {
  exchangeForLongLivedToken,
  getInstagramAccount,
  listManagedPages,
} from "@/lib/instagram/graph-api";

/**
 * Callback do OAuth da Meta. Troca o código por um token, descobre as Páginas
 * do Facebook do usuário e suas contas Instagram Business/Creator vinculadas,
 * e persiste cada uma como uma `InstagramAccount` conectada.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorDescription = url.searchParams.get("error_description");

  const appUrl = process.env.NEXTAUTH_URL ?? url.origin;
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("ig_oauth_state")?.value;
  cookieStore.delete("ig_oauth_state");

  if (errorDescription) {
    return redirectWithMessage(appUrl, "error", `Autorização cancelada: ${errorDescription}`);
  }

  if (!code || !state || !stateCookie) {
    return redirectWithMessage(appUrl, "error", "Sessão de autorização inválida ou expirada.");
  }

  const [savedState, userId] = stateCookie.split(":");
  if (savedState !== state || !userId) {
    return redirectWithMessage(appUrl, "error", "Falha na verificação de segurança (state inválido).");
  }

  try {
    const shortLived = await exchangeCodeForToken(code);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);

    const pages = await listManagedPages(longLived.access_token);
    const linkedPages = pages.filter((page) => page.instagram_business_account?.id);

    if (linkedPages.length === 0) {
      return redirectWithMessage(
        appUrl,
        "error",
        "Nenhuma conta Instagram Business/Creator vinculada a uma Página do Facebook foi encontrada."
      );
    }

    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000)
      : null;

    let connectedCount = 0;
    for (const page of linkedPages) {
      const igUserId = page.instagram_business_account!.id;
      const igAccount = await getInstagramAccount(igUserId, page.access_token);

      await prisma.instagramAccount.upsert({
        where: { igUserId },
        create: {
          userId,
          igUserId,
          igUsername: igAccount.username,
          facebookPageId: page.id,
          facebookPageName: page.name,
          profilePictureUrl: igAccount.profile_picture_url,
          accessToken: encryptToken(page.access_token),
          tokenExpiresAt: expiresAt,
          status: "CONNECTED",
          lastSyncedAt: new Date(),
          activityLogs: {
            create: { type: "CONNECTED", message: `Conta @${igAccount.username} conectada via OAuth.` },
          },
        },
        update: {
          igUsername: igAccount.username,
          facebookPageName: page.name,
          profilePictureUrl: igAccount.profile_picture_url,
          accessToken: encryptToken(page.access_token),
          tokenExpiresAt: expiresAt,
          status: "CONNECTED",
          lastError: null,
          lastSyncedAt: new Date(),
          activityLogs: {
            create: { type: "TOKEN_REFRESHED", message: `Token de @${igAccount.username} atualizado.` },
          },
        },
      });
      connectedCount += 1;
    }

    return redirectWithMessage(
      appUrl,
      "success",
      `${connectedCount} conta(s) do Instagram conectada(s) com sucesso.`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao conectar a conta.";
    return redirectWithMessage(appUrl, "error", message);
  }
}

function redirectWithMessage(appUrl: string, kind: "success" | "error", message: string) {
  const target = new URL("/dashboard/accounts", appUrl);
  target.searchParams.set(kind, message);
  return NextResponse.redirect(target);
}
