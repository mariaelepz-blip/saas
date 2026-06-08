import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [accounts, upcomingPosts, mediaCount] = await Promise.all([
    prisma.instagramAccount.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.scheduledPost.findMany({
      where: { instagramAccount: { userId }, status: "SCHEDULED", scheduledFor: { gte: new Date() } },
      orderBy: { scheduledFor: "asc" },
      take: 5,
      include: { instagramAccount: { select: { igUsername: true } } },
    }),
    prisma.mediaAsset.count({ where: { userId } }),
  ]);

  const active = accounts.filter((a) => a.status === "CONNECTED").length;
  const warming = accounts.filter((a) => a.status === "WARMING").length;
  const issues = accounts.filter((a) => a.status === "TOKEN_EXPIRED" || a.status === "ACTION_REQUIRED" || a.status === "DISCONNECTED").length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Visão geral</h1>
        <p className="text-sm text-neutral-400">Resumo da sua operação no Instagram.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Contas ativas" value={active} accent="text-emerald-400" />
        <StatCard label="Em aquecimento" value={warming} accent="text-amber-400" />
        <StatCard label="Precisam de atenção" value={issues} accent="text-red-400" />
        <StatCard label="Itens na biblioteca" value={mediaCount} accent="text-neutral-200" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Contas conectadas</h2>
            <Link href="/dashboard/accounts" className="text-sm text-neutral-400 hover:text-white">ver todas</Link>
          </div>
          {accounts.length === 0 ? (
            <EmptyState text="Nenhuma conta conectada ainda." actionHref="/dashboard/accounts" actionLabel="Conectar conta" />
          ) : (
            <ul className="flex flex-col gap-3">
              {accounts.slice(0, 5).map((account) => (
                <li key={account.id} className="flex items-center justify-between rounded-lg border border-neutral-800 px-4 py-3">
                  <span className="text-sm">@{account.igUsername}</span>
                  <StatusBadge status={account.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Próximas publicações</h2>
            <Link href="/dashboard/scheduler" className="text-sm text-neutral-400 hover:text-white">ver agenda</Link>
          </div>
          {upcomingPosts.length === 0 ? (
            <EmptyState text="Nenhuma publicação agendada." actionHref="/dashboard/scheduler" actionLabel="Agendar publicação" />
          ) : (
            <ul className="flex flex-col gap-3">
              {upcomingPosts.map((post) => (
                <li key={post.id} className="flex items-center justify-between rounded-lg border border-neutral-800 px-4 py-3 text-sm">
                  <div>
                    <span className="font-medium">{post.type}</span>
                    <span className="text-neutral-400"> · @{post.instagramAccount.igUsername}</span>
                  </div>
                  <span className="text-neutral-400">{post.scheduledFor.toLocaleString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function EmptyState({ text, actionHref, actionLabel }: { text: string; actionHref: string; actionLabel: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-neutral-800 p-6">
      <p className="text-sm text-neutral-400">{text}</p>
      <Link href={actionHref} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200">
        {actionLabel}
      </Link>
    </div>
  );
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  CONNECTED: { label: "Ativa", className: "bg-emerald-500/15 text-emerald-400" },
  WARMING: { label: "Aquecendo", className: "bg-amber-500/15 text-amber-400" },
  TOKEN_EXPIRED: { label: "Token expirado", className: "bg-orange-500/15 text-orange-400" },
  ACTION_REQUIRED: { label: "Requer atenção", className: "bg-red-500/15 text-red-400" },
  DISCONNECTED: { label: "Desconectada", className: "bg-neutral-500/15 text-neutral-400" },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_LABELS[status] ?? { label: status, className: "bg-neutral-500/15 text-neutral-400" };
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${meta.className}`}>{meta.label}</span>;
}
