import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const post = await prisma.scheduledPost.findFirst({
    where: { id, instagramAccount: { userId: session.user.id } },
  });
  if (!post) return NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 });
  if (post.status !== "SCHEDULED" && post.status !== "DRAFT") {
    return NextResponse.json({ error: "Só é possível editar publicações agendadas ou em rascunho." }, { status: 422 });
  }

  const updated = await prisma.scheduledPost.update({
    where: { id },
    data: {
      caption: body.caption ?? post.caption,
      hashtags: body.hashtags ?? post.hashtags,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : post.scheduledFor,
      status: body.status === "CANCELED" ? "CANCELED" : post.status,
    },
  });

  return NextResponse.json({ post: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const post = await prisma.scheduledPost.findFirst({
    where: { id, instagramAccount: { userId: session.user.id } },
  });
  if (!post) return NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 });

  await prisma.scheduledPost.update({ where: { id }, data: { status: "CANCELED" } });
  return NextResponse.json({ ok: true });
}
