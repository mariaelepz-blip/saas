import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED_VIDEO = ["video/mp4", "video/quicktime", "video/webm"];
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200MB

/**
 * Upload de mídia para a biblioteca.
 *
 * NOTA: a Graph API exige que a mídia esteja acessível por uma URL pública.
 * Em produção, troque este armazenamento local por um bucket (S3/GCS/R2) e
 * salve a URL pública resultante em `originalUrl`.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo no campo 'file'." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo maior que o limite de 200MB." }, { status: 413 });
  }

  const isVideo = ALLOWED_VIDEO.includes(file.type);
  const isImage = ALLOWED_IMAGE.includes(file.type);
  if (!isVideo && !isImage) {
    return NextResponse.json({ error: "Tipo de arquivo não suportado." }, { status: 415 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name) || (isVideo ? ".mp4" : ".jpg");
  const fileName = `${randomUUID()}${ext}`;
  const filePath = path.join(UPLOAD_DIR, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const publicUrl = `${process.env.NEXTAUTH_URL ?? ""}/uploads/${fileName}`;

  const asset = await prisma.mediaAsset.create({
    data: {
      userId: session.user.id,
      type: isVideo ? "VIDEO" : "IMAGE",
      originalUrl: publicUrl,
      fileName: file.name,
    },
  });

  return NextResponse.json({ asset }, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const assets = await prisma.mediaAsset.findMany({
    where: { userId: session.user.id },
    include: { variants: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ assets });
}
