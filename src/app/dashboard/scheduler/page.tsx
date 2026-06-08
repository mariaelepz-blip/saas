import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ScheduleForm } from "./schedule-form";
import { CancelPostButton } from "./post-actions";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Rascunho", className: "bg-neutral-500/15 text-neutral-400" },
  SCHEDULED: { label: "Agendado", className: "bg-blue-500/15 text-blue-400" },
  PUBLISHING: { label: "Publicando", className: "bg-amber-500/15 text-amber-400" },
  PUBLISHED: { label: "Publicado", className: "bg-emerald-500/15 text-emerald-400" },
  FAILED: { label: "Falhou", className: "bg-red-500/15 text-red-400" },
  CANCELED: { label: "Cancelado", className: "bg-neutral-500/15 text-neutral-500" },
};

export default async function SchedulerPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [accounts, posts, mediaAssets] = await Promise.all([
    prisma.instagramAccount.findMany({
      where: { userId, status: { in: ["CONNECTED", "WARMING"] } },
      select: { id: true, igUsername: true, status: true },
    }),
    prisma.scheduledPost.findMany({
      where: { instagramAccount: { userId } },
      include: { instagramAccount: { select: { igUsername: true } } },
      orderBy: { scheduledFor: "desc" },
      take: 30,
    }),
    prisma.mediaAsset.findMany({
      where: { userId },
      include: { variants: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Agendamentos</h1>
        <p className="text-sm text-neutral-400">Programe posts, reels e stories para publicação automática.</p>
      </div>

      {accounts.length === 0 && (
        <div className="rounded-lg border border-amber-900 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Você precisa conectar e ativar ao menos uma conta para agendar publicações.
        </div>
      )}

      <ScheduleForm accounts={accounts} mediaAssets={mediaAssets.map((m) => ({ id: m.id, fileName: m.fileName, type: m.type, variants: m.variants }))} />

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6">
        <h2 className="mb-4 font-semibold">Publicações</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-neutral-400">Nenhuma publicação agendada ainda.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map((post) => {
              const status = STATUS_LABELS[post.status] ?? STATUS_LABELS.DRAFT;
              return (
                <div key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 px-4 py-3 text-sm">
                  <div>
                    <p>
                      <span className="font-medium">{post.type}</span>
                      <span className="text-neutral-400"> · @{post.instagramAccount.igUsername}</span>
                    </p>
                    <p className="text-xs text-neutral-500">{post.scheduledFor.toLocaleString("pt-BR")}</p>
                    {post.errorMessage && <p className="mt-1 text-xs text-red-400">{post.errorMessage}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                    {post.status === "SCHEDULED" && <CancelPostButton postId={post.id} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
