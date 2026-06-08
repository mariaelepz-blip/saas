import { NextResponse } from "next/server";
import path from "path";
import { mkdir } from "fs/promises";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateVideoVariant } from "@/lib/video/variant-generator";

const VARIANTS_DIR = path.join(process.cwd(), "public", "uploads", "variants");

const schema = z.object({
  mirror: z.boolean().optional(),
  burnedInText: z.boolean().optional(),
  textSafeRegion: z
    .object({
      xPercent: z.number().min(0).max(100),
      yPercent: z.number().min(0).max(100),
      widthPercent: z.number().min(1).max(100),
      heightPercent: z.number().min(1).max(100),
    })
    .optional(),
  filter: z.enum(["warm-light", "contrast-soft", "saturation-boost", "cool-tone"]).optional().nullable(),
  speedFactor: z.number().min(0.8).max(1.2).optional(),
  cropPercent: z.number().min(0).max(10).optional(),
  brightness: z.number().min(-1).max(1).optional(),
  saturation: z.number().min(0).max(3).optional(),
  addNoise: z.boolean().optional(),
});

/** Gera uma variação processada (anti-duplicidade) de um vídeo da biblioteca. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const asset = await prisma.mediaAsset.findFirst({ where: { id, userId: session.user.id } });
  if (!asset) return NextResponse.json({ error: "Mídia não encontrada." }, { status: 404 });
  if (asset.type !== "VIDEO") {
    return NextResponse.json({ error: "Variações de espelhamento/filtro só se aplicam a vídeos." }, { status: 422 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Opções inválidas." }, { status: 400 });
  }
  const options = parsed.data;

  if (options.mirror && options.burnedInText && !options.textSafeRegion) {
    return NextResponse.json(
      {
        error:
          "Para espelhar um vídeo com texto embutido sem distorcer o texto, informe a região onde o texto aparece (textSafeRegion).",
      },
      { status: 422 }
    );
  }

  const variant = await prisma.mediaVariant.create({
    data: {
      mediaAssetId: asset.id,
      status: "PROCESSING",
      mirrored: !!options.mirror,
      textPreserved: !!(options.mirror && options.burnedInText && options.textSafeRegion),
      filter: options.filter ?? null,
      speedFactor: options.speedFactor ?? null,
      cropPercent: options.cropPercent ?? null,
      brightness: options.brightness ?? null,
      saturation: options.saturation ?? null,
    },
  });

  // Processa em segundo plano e atualiza o registro quando terminar.
  processInBackground(asset.id, variant.id, asset.originalUrl, options).catch(() => {
    /* erros são tratados e persistidos dentro de processInBackground */
  });

  return NextResponse.json({ variant }, { status: 202 });
}

async function processInBackground(
  assetId: string,
  variantId: string,
  originalUrl: string,
  options: z.infer<typeof schema>
) {
  try {
    await mkdir(VARIANTS_DIR, { recursive: true });

    const inputPath = resolveLocalPath(originalUrl);
    const result = await generateVideoVariant(inputPath, VARIANTS_DIR, options);

    const fileName = path.basename(result.outputPath);
    const publicUrl = `${process.env.NEXTAUTH_URL ?? ""}/uploads/variants/${fileName}`;

    await prisma.mediaVariant.update({
      where: { id: variantId },
      data: { status: "READY", outputUrl: publicUrl },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao processar o vídeo.";
    await prisma.mediaVariant.update({
      where: { id: variantId },
      data: { status: "FAILED", errorMessage: message },
    });
  }
}

/** Converte a URL pública servida em /uploads/* de volta para o caminho no disco. */
function resolveLocalPath(publicUrl: string): string {
  const marker = "/uploads/";
  const idx = publicUrl.indexOf(marker);
  const relative = idx >= 0 ? publicUrl.slice(idx + marker.length) : publicUrl;
  return path.join(process.cwd(), "public", "uploads", relative);
}
