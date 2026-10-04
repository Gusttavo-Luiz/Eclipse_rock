/**
 * Importa as fotos do conteúdo inicial (server/seed) uma única vez: integrantes, galeria e foto da seção "A banda".
 * Passam pelo mesmo processamento das imagens enviadas no painel (WebP responsivo, sem metadados).
 * Não sobrescreve o que já foi definido no painel e não volta a importar o que for removido depois.
 */
import fs from "node:fs";
import path from "node:path";
import { SEED_ABOUT_PHOTO, SEED_GALLERY, SEED_MEMBERS } from "../../shared/seed";
import { config } from "./config";
import type { DB } from "./db";
import { getStoredSettings } from "./repo";
import { storeImage } from "./uploads";

const done = (db: DB, marker: string) => !!db.prepare("SELECT 1 FROM schema_migrations WHERE name = ?").get(marker);
const mark = (db: DB, marker: string) => db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(marker);

function read(file: string): Buffer | null {
  if (fs.existsSync(file)) return fs.readFileSync(file);
  console.error(`[conteúdo inicial] foto não encontrada: ${file}`);
  return null;
}

export async function seedMemberPhotos(db: DB, dir = path.join(config.seedDir, "members")): Promise<number> {
  const MARKER = "seed:member_photos_v1";
  if (done(db, MARKER)) return 0;
  let imported = 0;
  for (const m of SEED_MEMBERS) {
    if (!m.photo) continue;
    // Identifica pelo Instagram: continua valendo se o nome for editado no painel.
    const member = db.prepare("SELECT id FROM band_members WHERE instagram = ? AND photo_id IS NULL").get(m.instagram) as
      | { id: number }
      | undefined;
    if (!member) continue;
    const buf = read(path.join(dir, m.photo));
    if (!buf) continue;
    const img = await storeImage(db, buf, m.photo, null);
    db.prepare("UPDATE band_members SET photo_id = ?, updated_at = ? WHERE id = ?").run(img.id, new Date().toISOString(), member.id);
    imported++;
  }
  mark(db, MARKER);
  if (imported) console.log(`[conteúdo inicial] ${imported} foto(s) de integrantes importada(s).`);
  return imported;
}

/** Galeria e foto da seção "A banda". Retorna quantas fotos entraram na galeria. */
export async function seedGalleryPhotos(db: DB, dir = path.join(config.seedDir, "gallery")): Promise<number> {
  const MARKER = "seed:gallery_v1";
  if (done(db, MARKER)) return 0;
  const ids = new Map<string, number>();
  let imported = 0;
  const order = (db.prepare("SELECT COALESCE(MAX(sort_order), 0) n FROM gallery_images").get() as { n: number }).n;
  for (const [i, g] of SEED_GALLERY.entries()) {
    const buf = read(path.join(dir, g.file));
    if (!buf) continue;
    const img = await storeImage(db, buf, g.file, null);
    ids.set(g.file, img.id);
    db.prepare("INSERT INTO gallery_images (upload_id, alt, category, sort_order, published) VALUES (?, ?, ?, ?, 1)").run(
      img.id,
      g.alt,
      g.category,
      order + i + 1,
    );
    imported++;
  }
  const aboutId = ids.get(SEED_ABOUT_PHOTO);
  const settings = getStoredSettings(db);
  if (aboutId && !settings.aboutImageId) {
    db.prepare("UPDATE site_settings SET value = ?, updated_at = ? WHERE key = 'site'").run(
      JSON.stringify({ ...settings, aboutImageId: aboutId }),
      new Date().toISOString(),
    );
  }
  mark(db, MARKER);
  if (imported) console.log(`[conteúdo inicial] ${imported} foto(s) da galeria importada(s).`);
  return imported;
}

export async function seedPhotos(db: DB) {
  await seedMemberPhotos(db);
  await seedGalleryPhotos(db);
}
