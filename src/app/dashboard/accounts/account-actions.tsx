"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AccountActions({ accountId, hasWarmingPlan }: { accountId: string; hasWarmingPlan: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(action: () => Promise<Response>, successMsg: string) {
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await action();
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage(json.error ?? "Ocorreu um erro.");
          return;
        }
        setMessage(successMsg);
        router.refresh();
      } catch {
        setMessage("Falha de comunicação com o servidor.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          disabled={isPending}
          onClick={() => run(() => fetch(`/api/instagram/${accountId}/sync`, { method: "POST" }), "Status sincronizado.")}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500 disabled:opacity-50"
        >
          Sincronizar status
        </button>
        {!hasWarmingPlan && (
          <button
            disabled={isPending}
            onClick={() => run(() => fetch(`/api/instagram/${accountId}/warming`, { method: "POST" }), "Esteira de aquecimento iniciada.")}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500 disabled:opacity-50"
          >
            Iniciar aquecimento
          </button>
        )}
        <button
          disabled={isPending}
          onClick={() => {
            if (!confirm("Desconectar esta conta?")) return;
            run(() => fetch(`/api/instagram/${accountId}`, { method: "DELETE" }), "Conta desconectada.");
          }}
          className="rounded-md border border-red-900 px-3 py-1.5 text-xs text-red-400 hover:border-red-700"
        >
          Desconectar
        </button>
      </div>
      {message && <span className="text-xs text-neutral-400">{message}</span>}
    </div>
  );
}
