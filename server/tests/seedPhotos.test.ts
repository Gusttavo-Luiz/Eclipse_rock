import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { openDb, type DB } from "../src/db";
import { SEED_GALLERY, SEED_GALLERY_BATCHES } from "../../shared/seed";
import { seedGalleryPhotos, seedMemberPhotos } from "../src/seedPhotos";

const dbs: DB[] = [];
afterEach(() => {
  while (dbs.length) dbs.pop()!.close();
  vi.restoreAllMocks();
});
const fresh = () => {
  const db = openDb(":memory:");
  dbs.push(db);
  return db;
};
const photos = (db: DB) =>
  Object.fromEntries(
    (db.prepare("SELECT name, photo_id FROM band_members ORDER BY sort_order").all() as { name: string; photo_id: number | null }[]).map(
      (r) => [r.name, r.photo_id],
    ),
  );

describe("fotos do conteúdo inicial", () => {
  it("importa a foto certa de cada integrante, processada como as do painel", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const db = fresh();
    expect(await seedMemberPhotos(db)).toBe(4);

    const res = await request(createApp(db, { mailer: null })).get("/api/public/members");
    const byName = Object.fromEntries((res.body as { name: string; photo: { src: string; width: number; height: number } }[]).map((m) => [m.name, m.photo]));
    for (const name of ["Isabella", "Mauro", "Mamute", "Rodrigo"]) {
      expect(byName[name]?.src, name).toMatch(/^\/uploads\/[0-9a-f]{24}-\d+\.webp$/);
      expect(byName[name].height / byName[name].width).toBeCloseTo(1.25, 1); // recorte 4:5
    }
    // cada foto vai para quem é: compara com o arquivo de origem (mesma imagem reduzida)
    const diff = async (a: Buffer, b: Buffer) => {
      const [x, y] = await Promise.all([a, b].map((buf) => sharp(buf).resize(16, 20).greyscale().raw().toBuffer()));
      return x.reduce((s, v, i) => s + Math.abs(v - y[i]), 0) / x.length;
    };
    const uploads = path.join(process.env.DATA_DIR!, "uploads");
    for (const [name, file] of [["Isabella", "isabella"], ["Mauro", "mauro"], ["Mamute", "mamute"], ["Rodrigo", "rodrigo"]]) {
      const stored = fs.readFileSync(path.join(uploads, path.basename(byName[name].src)));
      const original = fs.readFileSync(path.join("server/seed/members", `${file}.webp`));
      expect(await diff(stored, original), name).toBeLessThan(6);
    }
  });

  it("roda uma vez só e não sobrescreve nem recoloca foto removida", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const db = fresh();
    await seedMemberPhotos(db);
    const before = photos(db);
    db.prepare("UPDATE band_members SET photo_id = NULL WHERE name = 'Mauro'").run();
    expect(await seedMemberPhotos(db)).toBe(0);
    expect(photos(db)).toEqual({ ...before, Mauro: null });
  });

  it("mantém a foto já escolhida no painel e reconhece o integrante pelo Instagram", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const db = fresh();
    db.prepare("INSERT INTO uploads (key, width, height, variants, bytes) VALUES ('abc', 400, 500, '[400]', 1)").run();
    db.prepare("UPDATE band_members SET photo_id = 1 WHERE name = 'Isabella'").run();
    db.prepare("UPDATE band_members SET name = 'Rodrigo Di' WHERE name = 'Rodrigo'").run();
    expect(await seedMemberPhotos(db)).toBe(3);
    const p = photos(db);
    expect(p.Isabella).toBe(1);
    expect(p["Rodrigo Di"]).not.toBeNull();
  });

  it("arquivo ausente não impede as outras fotos", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seed-"));
    fs.copyFileSync("server/seed/members/mauro.webp", path.join(dir, "mauro.webp"));
    const db = fresh();
    expect(await seedMemberPhotos(db, dir)).toBe(1);
    expect(photos(db).Mauro).not.toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("galeria: importa as fotos na ordem, com texto alternativo e categoria, e usa a foto do grupo em \"A banda\"", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const db = fresh();
    expect(await seedGalleryPhotos(db)).toBe(SEED_GALLERY.length);
    const app = createApp(db, { mailer: null });
    const gallery = (await request(app).get("/api/public/gallery")).body as { alt: string; category: string; image: { id: number; width: number; height: number } }[];
    expect(gallery.map((g) => g.alt)).toEqual(SEED_GALLERY.map((g) => g.alt));
    expect(gallery[4].category).toBe("Banda");
    expect(gallery.every((g) => g.alt.length > 10)).toBe(true);
    const settings = (await request(app).get("/api/public/settings")).body as { aboutImage: { id: number; width: number; height: number } };
    expect(settings.aboutImage.id).toBe(gallery[4].image.id);
    expect(settings.aboutImage.width).toBeGreaterThan(settings.aboutImage.height); // foto do grupo, horizontal

    // uma vez só: não duplica nem recoloca
    db.prepare("DELETE FROM gallery_images WHERE category = 'Banda'").run();
    expect(await seedGalleryPhotos(db)).toBe(0);
    expect((db.prepare("SELECT COUNT(*) n FROM gallery_images").get() as { n: number }).n).toBe(SEED_GALLERY.length - 1);
  });

  it("galeria: site que já importou o 1º lote recebe só as fotos novas, no fim, sem mexer no resto", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const db = fresh();
    // simula um site no ar antes do 2º lote, com uma foto própria enviada pelo painel e a 1ª do lote removida
    db.prepare("INSERT INTO schema_migrations (name) VALUES ('seed:gallery_v1')").run();
    db.prepare("INSERT INTO uploads (key, width, height, variants, bytes) VALUES ('abc', 400, 500, '[400]', 1)").run();
    db.prepare("INSERT INTO gallery_images (upload_id, alt, sort_order) VALUES (1, 'Foto enviada pelo painel', 7)").run();
    const second = SEED_GALLERY_BATCHES[1].photos;
    expect(await seedGalleryPhotos(db)).toBe(second.length);
    const rows = db.prepare("SELECT alt FROM gallery_images ORDER BY sort_order, id").all() as { alt: string }[];
    expect(rows.map((r) => r.alt)).toEqual(["Foto enviada pelo painel", ...second.map((g) => g.alt)]);
    expect(await seedGalleryPhotos(db)).toBe(0);
  });

  it("galeria: não troca a foto de \"A banda\" já escolhida no painel", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const db = fresh();
    db.prepare("INSERT INTO uploads (key, width, height, variants, bytes) VALUES ('abc', 400, 500, '[400]', 1)").run();
    const row = db.prepare("SELECT value FROM site_settings WHERE key = 'site'").get() as { value: string };
    db.prepare("UPDATE site_settings SET value = ? WHERE key = 'site'").run(JSON.stringify({ ...JSON.parse(row.value), aboutImageId: 1 }));
    await seedGalleryPhotos(db);
    const after = JSON.parse((db.prepare("SELECT value FROM site_settings WHERE key = 'site'").get() as { value: string }).value);
    expect(after.aboutImageId).toBe(1);
  });
});
