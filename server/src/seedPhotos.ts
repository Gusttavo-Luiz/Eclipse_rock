/**
 * Importa as fotos do conteúdo inicial (server/seed/members) para os integrantes, uma única vez.
 * Passam pelo mesmo processamento das imagens enviadas no painel (WebP responsivo, sem metadados).
 * Não sobrescreve foto já definida e não volta a importar se alguém remover a foto depois.
 */
import fs from "node:fs";
import path from "node:path";
import { SEED_MEMBERS } from "../../shared/seed";
import { config } from "./config";
import type { DB } from "./db";
import { storeImage } from "./uploads";

const MARKER = "seed:member_photos_v1";

export async function seedMemberPhotos(db: DB, dir = path.join(config.seedDir, "members")): Promise<number> {
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE name = ?").get(MARKER)) return 0;
  let imported = 0;
  for (const m of SEED_MEMBERS) {
    if (!m.photo) continue;
    const file = path.join(dir, m.photo);
    if (!fs.existsSync(file)) {
      console.error(`[conteúdo inicial] foto não encontrada: ${file}`);
      continue;
    }
    // Identifica pelo Instagram: continua valendo se o nome for editado no painel.
    const member = db.prepare("SELECT id FROM band_members WHERE instagram = ? AND photo_id IS NULL").get(m.instagram) as
      | { id: number }
      | undefined;
    if (!member) continue;
    const img = await storeImage(db, fs.readFileSync(file), m.photo, null);
    db.prepare("UPDATE band_members SET photo_id = ?, updated_at = ? WHERE id = ?").run(img.id, new Date().toISOString(), member.id);
    imported++;
  }
  db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(MARKER);
  if (imported) console.log(`[conteúdo inicial] ${imported} foto(s) de integrantes importada(s).`);
  return imported;
}
