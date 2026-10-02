import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { ImageRef } from "../../shared/types";
import { config } from "./config";
import type { DB } from "./db";
import { HttpError } from "./http";

export const uploadsDir = () => path.join(config.dataDir, "uploads");
const WIDTHS = [480, 960, 1600, 2400];
const ALLOWED = new Set(["jpeg", "png", "webp", "avif", "heif"]);

interface UploadRow {
  id: number;
  key: string;
  width: number;
  height: number;
  variants: string;
}

export function toImageRef(row: UploadRow): ImageRef {
  const widths: number[] = JSON.parse(row.variants);
  const url = (w: number) => `/uploads/${row.key}-${w}.webp`;
  const largest = widths[widths.length - 1];
  return {
    id: row.id,
    width: row.width,
    height: row.height,
    src: url(largest),
    srcset: widths.map((w) => `${url(w)} ${w}w`).join(", "),
  };
}

/** Carrega várias imagens de uma vez (evita N+1). */
export function loadImages(db: DB, ids: (number | null | undefined)[]): Map<number, ImageRef> {
  const unique = [...new Set(ids.filter((v): v is number => typeof v === "number"))];
  const map = new Map<number, ImageRef>();
  if (!unique.length) return map;
  const rows = db
    .prepare(`SELECT id, key, width, height, variants FROM uploads WHERE id IN (${unique.map(() => "?").join(",")})`)
    .all(...unique) as UploadRow[];
  for (const r of rows) map.set(r.id, toImageRef(r));
  return map;
}

export function assertUploadExists(db: DB, id: number | null, field: string) {
  if (id === null) return;
  const row = db.prepare("SELECT 1 FROM uploads WHERE id = ?").get(id);
  if (!row) throw new HttpError(422, "Revise os campos destacados.", { [field]: "Imagem não encontrada. Envie novamente." });
}

/**
 * Valida o CONTEÚDO (não só a extensão/MIME declarado) decodificando a imagem com sharp,
 * remove metadados (EXIF/GPS), corrige orientação e gera variantes WebP responsivas.
 */
export async function storeImage(
  db: DB,
  buffer: Buffer,
  originalName: string | undefined,
  userId: number | null,
): Promise<ImageRef> {
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(buffer, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw new HttpError(422, "Arquivo inválido. Envie uma imagem JPG, PNG, WebP ou AVIF.");
  }
  if (!meta.format || !ALLOWED.has(meta.format) || !meta.width || !meta.height) {
    throw new HttpError(422, "Formato não suportado. Envie uma imagem JPG, PNG, WebP ou AVIF.");
  }
  if (meta.width < 200 || meta.height < 200) {
    throw new HttpError(422, "Imagem muito pequena. Use pelo menos 200 × 200 px.");
  }

  // dimensões após aplicar orientação EXIF
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;

  const key = crypto.randomBytes(12).toString("hex");
  const variants = WIDTHS.filter((w) => w < width);
  variants.push(Math.min(width, WIDTHS[WIDTHS.length - 1]));
  const finalVariants = [...new Set(variants)].sort((a, b) => a - b);

  fs.mkdirSync(uploadsDir(), { recursive: true });
  let bytes = 0;
  const written: string[] = [];
  try {
    for (const w of finalVariants) {
      const out = path.join(uploadsDir(), `${key}-${w}.webp`);
      const info = await sharp(buffer, { limitInputPixels: 50_000_000 })
        .rotate()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(out);
      written.push(out);
      bytes += info.size;
    }
  } catch (e) {
    for (const f of written) fs.rmSync(f, { force: true });
    throw new HttpError(422, "Não foi possível processar a imagem. Tente outro arquivo.");
  }

  const finalHeight = Math.round((height * finalVariants[finalVariants.length - 1]) / width);
  const finalWidth = finalVariants[finalVariants.length - 1];
  const r = db
    .prepare(
      "INSERT INTO uploads (key, width, height, variants, bytes, original_name, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(key, finalWidth, finalHeight, JSON.stringify(finalVariants), bytes, originalName?.slice(0, 200) ?? null, userId);

  return toImageRef({
    id: Number(r.lastInsertRowid),
    key,
    width: finalWidth,
    height: finalHeight,
    variants: JSON.stringify(finalVariants),
  });
}
