import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const account = await prisma.instagramAccount.findFirst({ where: { id, userId: session.user.id } });
  if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

  await prisma.instagramAccount.update({
    where: { id },
    data: {
      status: "DISCONNECTED",
      activityLogs: { create: { type: "STATUS_CHANGED", message: "Conta desconectada pelo usuário." } },
    },
  });

  return NextResponse.json({ ok: true });
}
