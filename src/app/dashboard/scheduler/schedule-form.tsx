"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Account {
  id: string;
  igUsername: string;
  status: string;
}

interface MediaAsset {
  id: string;
  fileName: string;
  type: string;
  variants: { id: string; status: string; mirrored: boolean; filter: string | null }[];
}

const POST_TYPES = [
  { value: "FEED", label: "Post no Feed" },
  { value: "REEL", label: "Reel" },
  { value: "STORY", label: "Story" },
  { value: "CAROUSEL", label: "Carrossel" },
];

export function ScheduleForm({ accounts, mediaAssets }: { accounts: Account[]; mediaAssets: MediaAsset[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [type, setType] = useState("FEED");
  const [mediaAssetId, setMediaAssetId] = useState("");
  const [mediaVariantId, setMediaVariantId] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");

  const selectedAsset = mediaAssets.find((m) => m.id === mediaAssetId);
  const readyVariants = selectedAsset?.variants.filter((v) => v.status === "READY") ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!accountId) {
      setError("Conecte uma conta antes de agendar.");
      return;
    }
    if (!scheduledFor) {
      setError("Escolha a data e hora da publicação.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId: accountId,
          mediaAssetId: mediaAssetId || undefined,
          mediaVariantId: mediaVariantId || undefined,
          type,
          caption: caption || undefined,
          hashtags: hashtags || undefined,
          scheduledFor: new Date(scheduledFor).toISOString(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Não foi possível agendar.");
        return;
      }
      setSuccess("Publicação agendada com sucesso.");
      setCaption("");
      setHashtags("");
      setScheduledFor("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-6">
      <h2 className="font-semibold">Agendar nova publicação</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Conta">
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectClass}>
            {accounts.length === 0 && <option value="">Nenhuma conta conectada</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>@{a.igUsername} {a.status !== "CONNECTED" && a.status !== "WARMING" ? "(inativa)" : ""}</option>
            ))}
          </select>
        </Field>

        <Field label="Tipo de publicação">
          <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
            {POST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Mídia (opcional)">
          <select value={mediaAssetId} onChange={(e) => { setMediaAssetId(e.target.value); setMediaVariantId(""); }} className={selectClass}>
            <option value="">Nenhuma</option>
            {mediaAssets.map((m) => (
              <option key={m.id} value={m.id}>{m.fileName} ({m.type === "VIDEO" ? "vídeo" : "imagem"})</option>
            ))}
          </select>
        </Field>

        <Field label="Variação anti-duplicidade (opcional)">
          <select value={mediaVariantId} onChange={(e) => setMediaVariantId(e.target.value)} disabled={!readyVariants.length} className={selectClass}>
            <option value="">Usar mídia original</option>
            {readyVariants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.mirrored ? "Espelhada" : "Sem espelhamento"}{v.filter ? ` · filtro ${v.filter}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Data e hora">
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className={selectClass}
          />
        </Field>

        <Field label="Hashtags (opcional)">
          <input
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#marca #nicho #conteudo"
            className={selectClass}
          />
        </Field>
      </div>

      <Field label="Legenda">
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          className={`${selectClass} resize-none`}
          placeholder="Escreva a legenda da publicação..."
        />
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">{success}</p>}

      <button
        type="submit"
        disabled={isPending || accounts.length === 0}
        className="self-start rounded-md bg-white px-5 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200 disabled:opacity-50"
      >
        {isPending ? "Agendando..." : "Agendar publicação"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-400">{label}</span>
      {children}
    </label>
  );
}

const selectClass = "rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-400";
