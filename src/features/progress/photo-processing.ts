import "server-only";
import sharp from "sharp";

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

/** Confere o tipo real pelo conteúdo e reprocessa: o WebP de saída não leva metadados (EXIF, GPS). */
export async function processPhoto(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new Error("formato");
  return sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}
