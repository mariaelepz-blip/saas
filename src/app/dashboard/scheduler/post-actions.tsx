"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function CancelPostButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (!confirm("Cancelar esta publicação agendada?")) return;
        startTransition(async () => {
          await fetch(`/api/scheduled-posts/${postId}`, { method: "DELETE" });
          router.refresh();
        });
      }}
      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
    >
      Cancelar
    </button>
  );
}
