import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  instagramAccountId: z.string().min(1),
  mediaAssetId: z.string().optional(),
  mediaVariantId: z.string().optional(),
  type: z.enum(["FEED", "REEL", "STORY", "CAROUSEL"]),
  caption: z.string().max(2200).optional(),
  hashtags: z.string().max(500).optional(),
  scheduledFor: z.string().datetime(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId") ?? undefined;

  const posts = await prisma.scheduledPost.findMany({
    where: {
      instagramAccount: { userId: session.user.id },
      ...(accountId ? { instagramAccountId: accountId } : {}),
    },
    include: { instagramAccount: { select: { igUsername: true, profilePictureUrl: true } }, mediaAsset: true },
    orderBy: { scheduledFor: "asc" },
  });

  return NextResponse.json({ posts });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const data = parsed.data;

  const account = await prisma.instagramAccount.findFirst({
    where: { id: data.instagramAccountId, userId: session.user.id },
  });
  if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

  if (account.status !== "CONNECTED" && account.status !== "WARMING") {
    return NextResponse.json(
      { error: "Esta conta não está ativa. Reconecte-a antes de agendar publicações." },
      { status: 422 }
    );
  }

  const scheduledFor = new Date(data.scheduledFor);
  if (scheduledFor.getTime() < Date.now() + 5 * 60 * 1000) {
    return NextResponse.json({ error: "Agende com pelo menos 5 minutos de antecedência." }, { status: 422 });
  }

  const post = await prisma.scheduledPost.create({
    data: {
      instagramAccountId: data.instagramAccountId,
      mediaAssetId: data.mediaAssetId,
      mediaVariantId: data.mediaVariantId,
      type: data.type,
      caption: data.caption,
      hashtags: data.hashtags,
      scheduledFor,
      status: "SCHEDULED",
    },
  });

  return NextResponse.json({ post }, { status: 201 });
}
