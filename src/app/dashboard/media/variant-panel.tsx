"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Variant {
  id: string;
  status: string;
  mirrored: boolean;
  textPreserved: boolean;
  filter: string | null;
  speedFactor: number | null;
  cropPercent: number | null;
  errorMessage: string | null;
}

const FILTERS = [
  { value: "", label: "Sem filtro" },
  { value: "warm-light", label: "Luz quente" },
  { value: "contrast-soft", label: "Contraste suave" },
  { value: "saturation-boost", label: "Saturação +" },
  { value: "cool-tone", label: "Tom frio" },
];

export function VariantPanel({ assetId, variants }: { assetId: string; variants: Variant[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [mirror, setMirror] = useState(true);
  const [burnedInText, setBurnedInText] = useState(false);
  const [textRegion, setTextRegion] = useState({ xPercent: 10, yPercent: 75, widthPercent: 80, heightPercent: 20 });
  const [filter, setFilter] = useState("");
  const [speedFactor, setSpeedFactor] = useState(1.02);
  const [cropPercent, setCropPercent] = useState(2);
  const [addNoise, setAddNoise] = useState(true);

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/media/${assetId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mirror,
          burnedInText,
          textSafeRegion: mirror && burnedInText ? textRegion : undefined,
          filter: filter || null,
          speedFactor,
          cropPercent,
          addNoise,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Não foi possível gerar a variação.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 p-4">
      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
          Espelhar vídeo
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={burnedInText} onChange={(e) => setBurnedInText(e.target.checked)} disabled={!mirror} />
          Tem texto na tela
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={addNoise} onChange={(e) => setAddNoise(e.target.checked)} />
          Ruído sutil
        </label>
        <label className="flex flex-col gap-1">
          Filtro
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1">
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
      </div>

      {mirror && burnedInText && (
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <p className="col-span-2 text-neutral-400 sm:col-span-4">
            Informe a região (em %) onde o texto aparece — ela será preservada sem espelhar:
          </p>
          {(["xPercent", "yPercent", "widthPercent", "heightPercent"] as const).map((key) => (
            <label key={key} className="flex flex-col gap-1">
              {key === "xPercent" ? "X" : key === "yPercent" ? "Y" : key === "widthPercent" ? "Largura" : "Altura"} (%)
              <input
                type="number"
                min={0}
                max={100}
                value={textRegion[key]}
                onChange={(e) => setTextRegion((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1"
              />
            </label>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <label className="flex flex-col gap-1">
          Velocidade
          <input type="number" step={0.01} min={0.8} max={1.2} value={speedFactor} onChange={(e) => setSpeedFactor(Number(e.target.value))} className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          Corte de borda (%)
          <input type="number" min={0} max={10} value={cropPercent} onChange={(e) => setCropPercent(Number(e.target.value))} className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1" />
        </label>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={generate}
        disabled={isPending}
        className="self-start rounded-md bg-white px-4 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-200 disabled:opacity-50"
      >
        {isPending ? "Gerando..." : "Gerar nova variação"}
      </button>

      {variants.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {variants.map((v) => (
            <li key={v.id} className="flex items-center justify-between rounded-md bg-neutral-900/60 px-3 py-2 text-xs">
              <span>
                {v.mirrored ? `Espelhado${v.textPreserved ? " (texto preservado)" : ""}` : "Sem espelhamento"}
                {v.filter ? ` · ${v.filter}` : ""}
                {v.speedFactor && v.speedFactor !== 1 ? ` · ${v.speedFactor}x` : ""}
                {v.cropPercent ? ` · corte ${v.cropPercent}%` : ""}
              </span>
              <VariantStatus status={v.status} error={v.errorMessage} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VariantStatus({ status, error }: { status: string; error: string | null }) {
  const map: Record<string, string> = {
    PENDING: "text-neutral-400",
    PROCESSING: "text-amber-400",
    READY: "text-emerald-400",
    FAILED: "text-red-400",
  };
  const label: Record<string, string> = {
    PENDING: "Pendente",
    PROCESSING: "Processando…",
    READY: "Pronta",
    FAILED: "Falhou",
  };
  return <span className={map[status] ?? ""} title={error ?? undefined}>{label[status] ?? status}</span>;
}
