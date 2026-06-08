import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Plano padrão de "esteira de aquecimento": aumenta gradualmente o volume
 * e a frequência de publicações dentro dos limites da Graph API, em vez de
 * simular comportamento humano (login automatizado, curtidas/seguidas em
 * massa) — práticas que violam os Termos da Meta e levam ao banimento.
 */
const DEFAULT_STAGES = [
  { order: 1, name: "Semana 1 — Estabilização", durationDays: 7, postsPerDay: 1, storiesPerDay: 1, minIntervalMins: 360 },
  { order: 2, name: "Semana 2-3 — Ritmo leve", durationDays: 14, postsPerDay: 1, storiesPerDay: 2, minIntervalMins: 240 },
  { order: 3, name: "Semana 4-5 — Ritmo regular", durationDays: 14, postsPerDay: 2, storiesPerDay: 3, minIntervalMins: 180 },
  { order: 4, name: "Semana 6+ — Operação plena", durationDays: 14, postsPerDay: 3, storiesPerDay: 4, minIntervalMins: 120 },
];

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const account = await prisma.instagramAccount.findFirst({
    where: { id, userId: session.user.id },
    include: { warmingPlan: true },
  });
  if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  if (account.warmingPlan) {
    return NextResponse.json({ error: "Esta conta já possui um plano de aquecimento." }, { status: 409 });
  }

  const totalDays = DEFAULT_STAGES.reduce((sum, stage) => sum + stage.durationDays, 0);

  const plan = await prisma.warmingPlan.create({
    data: {
      instagramAccountId: account.id,
      totalStages: DEFAULT_STAGES.length,
      estimatedEndAt: new Date(Date.now() + totalDays * 24 * 60 * 60 * 1000),
      stages: {
        create: DEFAULT_STAGES.map((stage, idx) => ({ ...stage, status: idx === 0 ? "IN_PROGRESS" : "PENDING" })),
      },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  await prisma.instagramAccount.update({
    where: { id: account.id },
    data: {
      status: "WARMING",
      activityLogs: { create: { type: "STATUS_CHANGED", message: "Plano de aquecimento iniciado." } },
    },
  });

  return NextResponse.json({ plan }, { status: 201 });
}

/** Avança o plano para a próxima etapa (chamado manualmente ou por um cron diário). */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const account = await prisma.instagramAccount.findFirst({
    where: { id, userId: session.user.id },
    include: { warmingPlan: { include: { stages: { orderBy: { order: "asc" } } } } },
  });
  if (!account?.warmingPlan) return NextResponse.json({ error: "Plano de aquecimento não encontrado." }, { status: 404 });

  const plan = account.warmingPlan;
  const currentIdx = plan.stages.findIndex((s) => s.order === plan.currentStage);
  const current = plan.stages[currentIdx];
  const next = plan.stages[currentIdx + 1];

  if (current) {
    await prisma.warmingStage.update({ where: { id: current.id }, data: { status: "COMPLETED" } });
  }

  if (next) {
    await prisma.warmingStage.update({ where: { id: next.id }, data: { status: "IN_PROGRESS" } });
    await prisma.warmingPlan.update({ where: { id: plan.id }, data: { currentStage: next.order } });
    await prisma.accountActivityLog.create({
      data: { instagramAccountId: account.id, type: "WARMING_STAGE_ADVANCED", message: `Avançou para a etapa "${next.name}".` },
    });
  } else {
    await prisma.warmingPlan.update({ where: { id: plan.id }, data: { status: "COMPLETED" } });
    await prisma.instagramAccount.update({ where: { id: account.id }, data: { status: "CONNECTED" } });
    await prisma.accountActivityLog.create({
      data: { instagramAccountId: account.id, type: "WARMING_STAGE_ADVANCED", message: "Plano de aquecimento concluído. Conta liberada para operação plena." },
    });
  }

  return NextResponse.json({ ok: true });
}
