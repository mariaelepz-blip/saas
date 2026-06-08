import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import {
  createMediaContainer,
  getContainerStatus,
  publishMediaContainer,
  type GraphMediaType,
} from "@/lib/instagram/graph-api";

export const maxDuration = 60;

const TYPE_TO_GRAPH: Record<string, GraphMediaType> = {
  FEED: "FEED",
  REEL: "REELS",
  STORY: "STORIES",
  CAROUSEL: "CAROUSEL",
};

const MAX_ATTEMPTS = 3;
const CONTAINER_POLL_ATTEMPTS = 10;
const CONTAINER_POLL_INTERVAL_MS = 3000;

/**
 * Worker de publicação. Deve ser chamado periodicamente (ex: a cada minuto)
 * por um cron job externo (Vercel Cron, GitHub Actions, etc.) enviando o
 * header `Authorization: Bearer <CRON_SECRET>`.
 *
 * Fluxo por publicação (Instagram Content Publishing API):
 *  1. Cria um container de mídia (`/​{ig-user-id}/​media`).
 *  2. Aguarda o status `FINISHED` (a Meta processa o vídeo de forma assíncrona).
 *  3. Publica o container (`/​{ig-user-id}/​media_publish`).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const duePosts = await prisma.scheduledPost.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } },
    include: {
      instagramAccount: true,
      mediaAsset: { include: { variants: true } },
    },
    take: 20,
  });

  const results: { id: string; status: string; error?: string }[] = [];

  for (const post of duePosts) {
    try {
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "PUBLISHING", attempts: { increment: 1 } },
      });

      const account = post.instagramAccount;
      if (account.status !== "CONNECTED" && account.status !== "WARMING") {
        throw new Error(`Conta @${account.igUsername} não está ativa (status: ${account.status}).`);
      }

      const mediaUrl = resolveMediaUrl(post);
      if (!mediaUrl) throw new Error("Publicação sem mídia associada.");

      const accessToken = decryptToken(account.accessToken);
      const graphType = TYPE_TO_GRAPH[post.type];
      const isVideo = post.mediaAsset?.type === "VIDEO";
      const fullCaption = [post.caption, post.hashtags].filter(Boolean).join("\n\n");

      const container = await createMediaContainer({
        igUserId: account.igUserId,
        accessToken,
        mediaUrl,
        mediaType: graphType,
        caption: graphType === "STORIES" ? undefined : fullCaption,
        isVideo,
      });

      if (isVideo) {
        await waitForContainerReady(container.id, accessToken);
      }

      const published = await publishMediaContainer(account.igUserId, container.id, accessToken);

      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "PUBLISHED", igMediaId: published.id, publishedAt: new Date(), errorMessage: null },
      });

      await prisma.accountActivityLog.create({
        data: {
          instagramAccountId: account.id,
          type: "POST_PUBLISHED",
          message: `Publicação ${post.type} publicada com sucesso (media id ${published.id}).`,
        },
      });

      results.push({ id: post.id, status: "PUBLISHED" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido ao publicar.";
      const willRetry = post.attempts + 1 < MAX_ATTEMPTS;

      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: willRetry ? "SCHEDULED" : "FAILED",
          errorMessage: message,
          // Adia uma nova tentativa em 15 minutos.
          scheduledFor: willRetry ? new Date(Date.now() + 15 * 60 * 1000) : post.scheduledFor,
        },
      });

      await prisma.accountActivityLog.create({
        data: {
          instagramAccountId: post.instagramAccountId,
          type: "POST_FAILED",
          message: `Falha ao publicar (${willRetry ? "nova tentativa agendada" : "esgotadas as tentativas"}): ${message}`,
        },
      });

      results.push({ id: post.id, status: willRetry ? "RETRY_SCHEDULED" : "FAILED", error: message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

function resolveMediaUrl(post: { mediaAsset: { originalUrl: string; variants: { id: string; outputUrl: string | null; status: string }[] } | null; mediaVariantId: string | null }) {
  if (!post.mediaAsset) return null;
  if (post.mediaVariantId) {
    const variant = post.mediaAsset.variants.find((v) => v.id === post.mediaVariantId);
    if (variant?.status === "READY" && variant.outputUrl) return variant.outputUrl;
  }
  return post.mediaAsset.originalUrl;
}

async function waitForContainerReady(containerId: string, accessToken: string) {
  for (let i = 0; i < CONTAINER_POLL_ATTEMPTS; i++) {
    const { status_code } = await getContainerStatus(containerId, accessToken);
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`Processamento do container falhou (status ${status_code}).`);
    }
    await sleep(CONTAINER_POLL_INTERVAL_MS);
  }
  throw new Error("Tempo esgotado aguardando o processamento do vídeo pela Meta.");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
