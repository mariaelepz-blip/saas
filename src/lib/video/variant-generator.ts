/**
 * Geração de variações de vídeo para evitar detecção de conteúdo duplicado
 * (re-uploads idênticos entre contas tendem a ser sinalizados pelo Instagram).
 *
 * Estratégia:
 *  - Espelhamento horizontal do vídeo (`hflip`).
 *  - PORÉM, se o vídeo tiver texto/legendas embutidos (`burnedInText: true`),
 *    o espelhamento simples inverteria o texto e o deixaria ilegível.
 *    Nesse caso, aplicamos o espelhamento apenas à área do vídeo informada
 *    em `textSafeRegion` (a região SEM texto), preservando a faixa com texto
 *    no sentido original — via overlay/crop com ffmpeg filter_complex.
 *    -> Para resultados melhores, recomenda-se re-gerar a legenda como
 *       overlay separado (ver `caption`/legendas dinâmicas no agendamento)
 *       em vez de depender de vídeo com texto já "queimado" na imagem.
 *  - Pequenas variações de cor/contraste/saturação/brilho (`eq`).
 *  - Leve variação de velocidade (ex: 1.0 -> 1.02x) via `setpts`/`atempo`.
 *  - Corte leve das bordas (crop) para alterar dimensões/hash perceptual.
 *  - Ruído sutil (`noise`) para alterar o hash do arquivo sem afetar a
 *    percepção visual humana.
 */

import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import { randomUUID } from "crypto";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

export interface TextSafeRegion {
  /** Retângulo (em % da largura/altura) onde NÃO deve haver espelhamento, por conter texto. */
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export interface VariantOptions {
  mirror?: boolean;
  /** Se o vídeo possui texto embutido que não deve ser espelhado. */
  burnedInText?: boolean;
  textSafeRegion?: TextSafeRegion;
  filter?: "warm-light" | "contrast-soft" | "saturation-boost" | "cool-tone" | null;
  speedFactor?: number; // ex: 1.02
  cropPercent?: number; // ex: 2 (corta 2% de cada borda)
  brightness?: number; // -1.0 a 1.0
  saturation?: number; // 0.0 a 3.0 (1.0 = original)
  addNoise?: boolean;
}

const FILTER_PRESETS: Record<string, { brightness?: number; saturation?: number; contrast?: number; gamma?: number }> = {
  "warm-light": { brightness: 0.03, saturation: 1.08, gamma: 1.05 },
  "contrast-soft": { contrast: 1.08, brightness: 0.01 },
  "saturation-boost": { saturation: 1.2 },
  "cool-tone": { saturation: 0.92, gamma: 0.97 },
};

export interface GenerateVariantResult {
  outputPath: string;
  appliedFilters: string[];
}

/**
 * Gera uma variação do vídeo de entrada aplicando as transformações pedidas.
 * Retorna o caminho do arquivo de saída (que deve ser enviado para storage
 * público antes de ser usado na Graph API).
 */
export async function generateVideoVariant(
  inputPath: string,
  outputDir: string,
  options: VariantOptions
): Promise<GenerateVariantResult> {
  const outputPath = path.join(outputDir, `${randomUUID()}.mp4`);
  const filterChain: string[] = [];
  const applied: string[] = [];

  // 1. Espelhamento (com proteção de texto, se aplicável)
  if (options.mirror) {
    if (options.burnedInText && options.textSafeRegion) {
      filterChain.push(buildTextSafeMirrorFilter(options.textSafeRegion));
      applied.push("mirror-text-safe");
    } else if (options.burnedInText && !options.textSafeRegion) {
      // Sem a região do texto não é seguro espelhar o quadro inteiro:
      // aplicamos só as variações de cor/corte/velocidade abaixo.
      applied.push("mirror-skipped-burned-in-text-no-region");
    } else {
      filterChain.push("hflip");
      applied.push("mirror-full");
    }
  }

  // 2. Corte leve das bordas (também altera proporção/hash)
  if (options.cropPercent && options.cropPercent > 0) {
    const c = Math.min(options.cropPercent, 10) / 100;
    filterChain.push(
      `crop=w=iw*${1 - 2 * c}:h=ih*${1 - 2 * c}:x=iw*${c}:y=ih*${c}`
    );
    applied.push(`crop-${options.cropPercent}%`);
  }

  // 3. Ajustes de cor (filtro nomeado ou parâmetros manuais)
  const eqParts: string[] = [];
  const preset = options.filter ? FILTER_PRESETS[options.filter] : undefined;
  const brightness = options.brightness ?? preset?.brightness;
  const saturation = options.saturation ?? preset?.saturation;
  const contrast = preset?.contrast;
  const gamma = preset?.gamma;
  if (brightness !== undefined) eqParts.push(`brightness=${brightness}`);
  if (saturation !== undefined) eqParts.push(`saturation=${saturation}`);
  if (contrast !== undefined) eqParts.push(`contrast=${contrast}`);
  if (gamma !== undefined) eqParts.push(`gamma=${gamma}`);
  if (eqParts.length) {
    filterChain.push(`eq=${eqParts.join(":")}`);
    applied.push(`color-adjust(${eqParts.join(",")})`);
  }

  // 4. Ruído sutil (altera hash perceptual sem afetar percepção humana)
  if (options.addNoise) {
    filterChain.push("noise=alls=4:allf=t");
    applied.push("subtle-noise");
  }

  // 5. Variação de velocidade
  let videoFilter = filterChain.join(",");
  const speed = options.speedFactor ?? 1;
  const audioFilters: string[] = [];
  if (speed !== 1) {
    const ptsFactor = (1 / speed).toFixed(4);
    videoFilter = videoFilter
      ? `${videoFilter},setpts=${ptsFactor}*PTS`
      : `setpts=${ptsFactor}*PTS`;
    audioFilters.push(`atempo=${clampAtempo(speed)}`);
    applied.push(`speed-${speed}x`);
  }

  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath);

    if (videoFilter) command.videoFilters(videoFilter);
    if (audioFilters.length) command.audioFilters(audioFilters);

    command
      .outputOptions(["-c:v libx264", "-preset veryfast", "-crf 23", "-c:a aac"])
      .output(outputPath)
      .on("end", () => resolve({ outputPath, appliedFilters: applied }))
      .on("error", (err) => reject(err))
      .run();
  });
}

/**
 * Monta um filtro complexo que espelha apenas a região do quadro que NÃO
 * contém texto embutido, mantendo a faixa de texto no sentido original e
 * sobrepondo-a de volta na posição correta.
 */
function buildTextSafeMirrorFilter(region: TextSafeRegion): string {
  const { xPercent, yPercent, widthPercent, heightPercent } = region;

  // Recorta a região de texto (mantida intacta) e o restante do quadro
  // (espelhado), depois sobrepõe a região de texto de volta na posição original.
  return [
    "split=2[base][txt]",
    `[base]hflip[mirrored]`,
    `[txt]crop=w=iw*${widthPercent / 100}:h=ih*${heightPercent / 100}:x=iw*${xPercent / 100}:y=ih*${yPercent / 100}[textcrop]`,
    `[mirrored][textcrop]overlay=x=W*${xPercent / 100}:y=H*${yPercent / 100}`,
  ].join(";");
}

/** ffmpeg `atempo` aceita apenas valores entre 0.5 e 2.0 por filtro. */
function clampAtempo(speed: number): string {
  return Math.min(Math.max(speed, 0.5), 2.0).toFixed(3);
}
