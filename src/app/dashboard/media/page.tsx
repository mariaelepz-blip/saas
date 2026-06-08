import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UploadForm } from "./upload-form";
import { VariantPanel } from "./variant-panel";

export default async function MediaPage() {
  const session = await auth();
  const assets = await prisma.mediaAsset.findMany({
    where: { userId: session!.user.id },
    include: { variants: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Biblioteca de mídia</h1>
        <p className="text-sm text-neutral-400">
          Envie vídeos e gere variações (espelhamento com proteção de texto, filtros leves, cortes e
          variação de velocidade) para evitar conteúdo duplicado entre contas.
        </p>
      </div>

      <UploadForm />

      {assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-800 p-10 text-center text-neutral-400">
          Nenhuma mídia enviada ainda.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {assets.map((asset) => (
            <div key={asset.id} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{asset.fileName}</p>
                  <p className="text-xs text-neutral-500">{asset.type === "VIDEO" ? "Vídeo" : "Imagem"} · enviado em {asset.createdAt.toLocaleDateString("pt-BR")}</p>
                </div>
              </div>

              {asset.type === "VIDEO" && <VariantPanel assetId={asset.id} variants={asset.variants} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
