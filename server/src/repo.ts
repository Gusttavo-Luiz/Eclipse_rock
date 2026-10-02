/** Consultas e mapeamento linha → objeto da API. */
import { youtubeId, type BookingStatus, type EventStatus, type SettingsInput } from "../../shared/schemas";
import {
  todayISO,
  type AdminSettings,
  type BandMember,
  type BookingRequest,
  type EventItem,
  type GalleryImage,
  type PublicSettings,
  type VideoItem,
} from "../../shared/types";
import { config } from "./config";
import type { DB } from "./db";
import { loadImages } from "./uploads";

type StoredSettings = Required<{ [K in keyof SettingsInput]: unknown }> & Record<string, unknown>;

// ---------- Configurações ----------
export function getStoredSettings(db: DB): StoredSettings {
  const row = db.prepare("SELECT value FROM site_settings WHERE key = 'site'").get() as { value: string } | undefined;
  return (row ? JSON.parse(row.value) : {}) as StoredSettings;
}

export function getAdminSettings(db: DB): AdminSettings {
  const s = getStoredSettings(db);
  const imgs = loadImages(db, [s.logoId as number, s.heroImageId as number, s.aboutImageId as number, s.ogImageId as number]);
  const img = (id: unknown) => (typeof id === "number" ? imgs.get(id) ?? null : null);
  return {
    bandName: String(s.bandName ?? "Eclipse Rock"),
    tagline: String(s.tagline ?? ""),
    heroText: String(s.heroText ?? ""),
    aboutText: String(s.aboutText ?? ""),
    instagram: (s.instagram as string) ?? null,
    youtubeUrl: (s.youtubeUrl as string) ?? null,
    spotifyUrl: (s.spotifyUrl as string) ?? null,
    tiktokUrl: (s.tiktokUrl as string) ?? null,
    facebookUrl: (s.facebookUrl as string) ?? null,
    whatsapp: (s.whatsapp as string) ?? null,
    whatsappMessage: (s.whatsappMessage as string) ?? null,
    contactEmail: (s.contactEmail as string) ?? null,
    privacyEmail: (s.privacyEmail as string) ?? null,
    logo: img(s.logoId),
    heroImage: img(s.heroImageId),
    aboutImage: img(s.aboutImageId),
    ogImage: img(s.ogImageId),
    logoId: (s.logoId as number) ?? null,
    heroImageId: (s.heroImageId as number) ?? null,
    aboutImageId: (s.aboutImageId as number) ?? null,
    ogImageId: (s.ogImageId as number) ?? null,
    seoTitle: String(s.seoTitle ?? "Eclipse Rock"),
    seoDescription: String(s.seoDescription ?? ""),
    siteUrl: config.siteUrl ?? String(s.siteUrl ?? ""),
  };
}

export function getPublicSettings(db: DB): PublicSettings {
  const { logoId, heroImageId, aboutImageId, ogImageId, ...pub } = getAdminSettings(db);
  void logoId, heroImageId, aboutImageId, ogImageId;
  return pub;
}

// ---------- Eventos ----------
interface EventRow {
  id: number;
  slug: string;
  title: string;
  date: string;
  time: string | null;
  venue: string;
  city: string;
  state: string;
  address: string | null;
  maps_url: string | null;
  ticket_url: string | null;
  description: string | null;
  status: EventStatus;
  image_id: number | null;
  published: number;
  created_at: string;
  updated_at: string;
}

export function mapEvents(db: DB, rows: EventRow[]): EventItem[] {
  const imgs = loadImages(db, rows.map((r) => r.image_id));
  const today = todayISO();
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    date: r.date,
    time: r.time,
    venue: r.venue,
    city: r.city,
    state: r.state,
    address: r.address,
    mapsUrl: r.maps_url,
    ticketUrl: r.ticket_url,
    description: r.description,
    status: r.status,
    image: r.image_id ? imgs.get(r.image_id) ?? null : null,
    imageId: r.image_id,
    published: !!r.published,
    isPast: r.date < today,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function listPublicEvents(db: DB, scope: "upcoming" | "past" | "all"): EventItem[] {
  const today = todayISO();
  let sql = "SELECT * FROM events WHERE published = 1";
  const params: string[] = [];
  if (scope === "upcoming") {
    sql += " AND date >= ? ORDER BY date ASC, time ASC";
    params.push(today);
  } else if (scope === "past") {
    sql += " AND date < ? ORDER BY date DESC, time DESC LIMIT 100";
    params.push(today);
  } else sql += " ORDER BY date ASC";
  return mapEvents(db, db.prepare(sql).all(...params) as EventRow[]);
}

export function getEventBy(db: DB, field: "id" | "slug", value: number | string, publishedOnly: boolean) {
  const row = db
    .prepare(`SELECT * FROM events WHERE ${field === "id" ? "id" : "slug"} = ? ${publishedOnly ? "AND published = 1" : ""}`)
    .get(value) as EventRow | undefined;
  return row ? mapEvents(db, [row])[0] : null;
}

export function slugify(v: string) {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function uniqueEventSlug(db: DB, title: string, date: string, excludeId?: number) {
  const base = `${slugify(title) || "show"}-${date}`;
  let slug = base;
  for (let i = 2; ; i++) {
    const hit = db.prepare("SELECT id FROM events WHERE slug = ?").get(slug) as { id: number } | undefined;
    if (!hit || hit.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
}

// ---------- Integrantes ----------
interface MemberRow {
  id: number;
  name: string;
  role: string | null;
  instagram: string | null;
  photo_id: number | null;
  sort_order: number;
  published: number;
}

export function listMembers(db: DB, publishedOnly: boolean): BandMember[] {
  const rows = db
    .prepare(`SELECT * FROM band_members ${publishedOnly ? "WHERE published = 1" : ""} ORDER BY sort_order, id`)
    .all() as MemberRow[];
  const imgs = loadImages(db, rows.map((r) => r.photo_id));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    instagram: r.instagram,
    photo: r.photo_id ? imgs.get(r.photo_id) ?? null : null,
    photoId: r.photo_id,
    sortOrder: r.sort_order,
    published: !!r.published,
  }));
}

// ---------- Galeria ----------
interface GalleryRow {
  id: number;
  upload_id: number;
  alt: string;
  caption: string | null;
  category: string | null;
  event_id: number | null;
  event_title: string | null;
  sort_order: number;
  published: number;
}

export function listGallery(db: DB, publishedOnly: boolean, id?: number): GalleryImage[] {
  const where: string[] = [];
  const params: number[] = [];
  if (publishedOnly) where.push("g.published = 1");
  if (id) {
    where.push("g.id = ?");
    params.push(id);
  }
  const rows = db
    .prepare(
      `SELECT g.*, e.title AS event_title FROM gallery_images g
       LEFT JOIN events e ON e.id = g.event_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY g.sort_order, g.id DESC`,
    )
    .all(...params) as GalleryRow[];
  const imgs = loadImages(db, rows.map((r) => r.upload_id));
  return rows
    .filter((r) => imgs.has(r.upload_id))
    .map((r) => ({
      id: r.id,
      uploadId: r.upload_id,
      image: imgs.get(r.upload_id)!,
      alt: r.alt,
      caption: r.caption,
      category: r.category,
      eventId: r.event_id,
      eventTitle: r.event_title,
      sortOrder: r.sort_order,
      published: !!r.published,
    }));
}

// ---------- Vídeos ----------
interface VideoRow {
  id: number;
  title: string;
  description: string | null;
  url: string;
  youtube_id: string;
  thumbnail_id: number | null;
  category: string | null;
  event_id: number | null;
  event_title: string | null;
  sort_order: number;
  published: number;
}

export function listVideos(db: DB, publishedOnly: boolean, id?: number): VideoItem[] {
  const where: string[] = [];
  const params: number[] = [];
  if (publishedOnly) where.push("v.published = 1");
  if (id) {
    where.push("v.id = ?");
    params.push(id);
  }
  const rows = db
    .prepare(
      `SELECT v.*, e.title AS event_title FROM videos v
       LEFT JOIN events e ON e.id = v.event_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY v.sort_order, v.id DESC`,
    )
    .all(...params) as VideoRow[];
  const imgs = loadImages(db, rows.map((r) => r.thumbnail_id));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    url: r.url,
    youtubeId: r.youtube_id || youtubeId(r.url) || "",
    thumbnail: r.thumbnail_id ? imgs.get(r.thumbnail_id) ?? null : null,
    thumbnailId: r.thumbnail_id,
    category: r.category,
    eventId: r.event_id,
    eventTitle: r.event_title,
    sortOrder: r.sort_order,
    published: !!r.published,
  }));
}

// ---------- Contratação ----------
export interface BookingRow {
  id: number;
  name: string;
  company: string | null;
  phone: string;
  email: string;
  event_type: string;
  event_date: string;
  city: string;
  state: string;
  venue: string | null;
  audience: number | null;
  message: string | null;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
}

export const mapBooking = (r: BookingRow): BookingRequest => ({
  id: r.id,
  name: r.name,
  company: r.company,
  phone: r.phone,
  email: r.email,
  eventType: r.event_type,
  eventDate: r.event_date,
  city: r.city,
  state: r.state,
  venue: r.venue,
  audience: r.audience,
  message: r.message,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
