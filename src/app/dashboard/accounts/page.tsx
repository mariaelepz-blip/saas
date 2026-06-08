import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/app/dashboard/page";
import { AccountActions } from "./account-actions";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  const accounts = await prisma.instagramAccount.findMany({
    where: { userId: session!.user.id },
    include: { warmingPlan: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contas conectadas</h1>
          <p className="text-sm text-neutral-400">
            Conexão feita via login oficial da Meta — apenas contas Business/Creator vinculadas a uma Página do Facebook.
          </p>
        </div>
        <Link href="/api/instagram/connect" className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200">
          Conectar conta do Instagram
        </Link>
      </div>

      {params.success && (
        <div className="rounded-lg border border-emerald-900 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{params.success}</div>
      )}
      {params.error && (
        <div className="rounded-lg border border-red-900 bg-red-500/10 px-4 py-3 text-sm text-red-300">{params.error}</div>
      )}

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-800 p-10 text-center">
          <p className="mb-4 text-neutral-400">Você ainda não conectou nenhuma conta do Instagram.</p>
          <Link href="/api/instagram/connect" className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200">
            Conectar agora
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {accounts.map((account) => (
            <div key={account.id} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-sm font-medium">
                    {account.igUsername.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">@{account.igUsername}</p>
                    <p className="text-xs text-neutral-400">Página: {account.facebookPageName ?? "—"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={account.status} />
                  {account.tokenExpiresAt && (
                    <span className="text-xs text-neutral-500">
                      token expira em {account.tokenExpiresAt.toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>

                <AccountActions accountId={account.id} hasWarmingPlan={!!account.warmingPlan} />
              </div>

              {account.lastError && (
                <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">{account.lastError}</p>
              )}

              {account.warmingPlan && (
                <div className="mt-4 rounded-lg border border-neutral-800 px-4 py-3">
                  <p className="text-xs text-neutral-400">
                    Aquecimento: etapa {account.warmingPlan.currentStage} de {account.warmingPlan.totalStages}
                    {account.warmingPlan.estimatedEndAt && (
                      <> · previsão de conclusão em {account.warmingPlan.estimatedEndAt.toLocaleDateString("pt-BR")}</>
                    )}
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${(account.warmingPlan.currentStage / account.warmingPlan.totalStages) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
