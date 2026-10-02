import { Router, type Request } from "express";
import multer from "multer";
import { z } from "zod";
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABEL,
  EVENT_STATUSES,
  bookingNoteInput,
  bookingUpdate,
  eventInput,
  galleryInput,
  galleryUpdate,
  memberInput,
  settingsInput,
  userCreateInput,
  userUpdateInput,
  videoInput,
  youtubeId,
} from "../../../shared/schemas";
import { todayISO, type AuditEntry, type BookingNote, type DashboardData, type User } from "../../../shared/types";
import { audit, hashPassword, requireAuth, requireRole } from "../auth";
import { config } from "../config";
import type { DB } from "../db";
import { ah, HttpError, intParam, notFound, parse } from "../http";
import {
  getAdminSettings,
  getEventBy,
  getStoredSettings,
  listGallery,
  listMembers,
  listVideos,
  mapBooking,
  mapEvents,
  uniqueEventSlug,
  type BookingRow,
} from "../repo";
import { assertUploadExists, storeImage } from "../uploads";

const now = () => new Date().toISOString();

export function adminRoutes(db: DB) {
  const r = Router();
  r.use(requireAuth);
  r.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  const content = requireRole("admin", "editor");
  const adminOnly = requireRole("admin");

  // ---------- Dashboard ----------
  r.get(
    "/dashboard",
    content,
    ah((_req, res) => {
      const today = todayISO();
      const one = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as { n: number }).n;
      const next = db
        .prepare("SELECT * FROM events WHERE published = 1 AND date >= ? AND status != 'cancelled' ORDER BY date, time LIMIT 1")
        .all(today);
      const data: DashboardData = {
        upcomingEvents: one("SELECT COUNT(*) n FROM events WHERE published = 1 AND date >= ?", today),
        totalEvents: one("SELECT COUNT(*) n FROM events"),
        nextEvent: next.length ? mapEvents(db, next as never)[0] : null,
        bookingsTotal: one("SELECT COUNT(*) n FROM booking_requests"),
        bookingsNew: one("SELECT COUNT(*) n FROM booking_requests WHERE status = 'new'"),
        bookingsOpen: one("SELECT COUNT(*) n FROM booking_requests WHERE status IN ('new','in_progress','proposal_sent')"),
        published: {
          events: one("SELECT COUNT(*) n FROM events WHERE published = 1"),
          members: one("SELECT COUNT(*) n FROM band_members WHERE published = 1"),
          gallery: one("SELECT COUNT(*) n FROM gallery_images WHERE published = 1"),
          videos: one("SELECT COUNT(*) n FROM videos WHERE published = 1"),
        },
        recentBookings: (
          db.prepare("SELECT * FROM booking_requests ORDER BY created_at DESC LIMIT 5").all() as BookingRow[]
        ).map(mapBooking),
        recentActivity: recentAudit(db, 10),
      };
      res.json(data);
    }),
  );

  r.get(
    "/audit",
    adminOnly,
    ah((_req, res) => res.json(recentAudit(db, 100))),
  );

  // ---------- Uploads ----------
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(file.mimetype)) cb(null, true);
      else cb(new HttpError(422, "Formato não suportado. Envie uma imagem JPG, PNG, WebP ou AVIF."));
    },
  });

  r.post(
    "/uploads",
    content,
    upload.single("file"),
    ah(async (req, res) => {
      if (!req.file) throw new HttpError(422, "Selecione uma imagem.");
      const img = await storeImage(db, req.file.buffer, req.file.originalname, req.user!.id);
      audit(db, req, "upload", "upload", img.id);
      res.status(201).json(img);
    }),
  );

  // ---------- Eventos ----------
  r.get(
    "/events",
    content,
    ah((req, res) => {
      const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
      const scope = req.query.scope;
      const where: string[] = [];
      const params: string[] = [];
      if (q) {
        where.push("(title LIKE ? OR venue LIKE ? OR city LIKE ?)");
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
      if (scope === "upcoming") {
        where.push("date >= ?");
        params.push(todayISO());
      } else if (scope === "past") {
        where.push("date < ?");
        params.push(todayISO());
      }
      const rows = db
        .prepare(
          `SELECT * FROM events ${where.length ? "WHERE " + where.join(" AND ") : ""}
           ORDER BY CASE WHEN date >= ? THEN 0 ELSE 1 END, CASE WHEN date >= ? THEN date END ASC, date DESC`,
        )
        .all(...params, todayISO(), todayISO());
      res.json(mapEvents(db, rows as never));
    }),
  );

  r.get(
    "/events/:id",
    content,
    ah((req, res) => {
      const ev = getEventBy(db, "id", intParam(req.params.id), false);
      if (!ev) throw notFound("Evento");
      res.json(ev);
    }),
  );

  r.post(
    "/events",
    content,
    ah((req, res) => {
      const d = parse(eventInput, req.body);
      assertUploadExists(db, d.imageId, "imageId");
      const slug = uniqueEventSlug(db, d.title, d.date);
      const result = db
        .prepare(
          `INSERT INTO events (slug, title, date, time, venue, city, state, address, maps_url, ticket_url, description, status, image_id, published)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(slug, d.title, d.date, d.time, d.venue, d.city, d.state, d.address, d.mapsUrl, d.ticketUrl, d.description, d.status, d.imageId, d.published ? 1 : 0);
      const id = Number(result.lastInsertRowid);
      audit(db, req, "create", "event", id, d.title);
      res.status(201).json(getEventBy(db, "id", id, false));
    }),
  );

  r.put(
    "/events/:id",
    content,
    ah((req, res) => {
      const id = intParam(req.params.id);
      const existing = getEventBy(db, "id", id, false);
      if (!existing) throw notFound("Evento");
      const d = parse(eventInput, req.body);
      assertUploadExists(db, d.imageId, "imageId");
      const slug =
        existing.title === d.title && existing.date === d.date ? existing.slug : uniqueEventSlug(db, d.title, d.date, id);
      db.prepare(
        `UPDATE events SET slug=?, title=?, date=?, time=?, venue=?, city=?, state=?, address=?, maps_url=?, ticket_url=?,
         description=?, status=?, image_id=?, published=?, updated_at=? WHERE id=?`,
      ).run(slug, d.title, d.date, d.time, d.venue, d.city, d.state, d.address, d.mapsUrl, d.ticketUrl, d.description, d.status, d.imageId, d.published ? 1 : 0, now(), id);
      audit(db, req, "update", "event", id, d.title);
      res.json(getEventBy(db, "id", id, false));
    }),
  );

  r.patch(
    "/events/:id",
    content,
    ah((req, res) => {
      const id = intParam(req.params.id);
      const d = parse(
        z.object({ published: z.boolean().optional(), status: z.enum(EVENT_STATUSES).optional() }).strict(),
        req.body,
      );
      if (!getEventBy(db, "id", id, false)) throw notFound("Evento");
      if (d.published !== undefined)
        db.prepare("UPDATE events SET published=?, updated_at=? WHERE id=?").run(d.published ? 1 : 0, now(), id);
      if (d.status) db.prepare("UPDATE events SET status=?, updated_at=? WHERE id=?").run(d.status, now(), id);
      audit(db, req, "update", "event", id, d.published !== undefined ? (d.published ? "Publicado" : "Despublicado") : `Status: ${d.status}`);
      res.json(getEventBy(db, "id", id, false));
    }),
  );

  r.delete(
    "/events/:id",
    content,
    ah((req, res) => {
      const id = intParam(req.params.id);
      const ev = getEventBy(db, "id", id, false);
      if (!ev) throw notFound("Evento");
      db.prepare("DELETE FROM events WHERE id = ?").run(id);
      audit(db, req, "delete", "event", id, ev.title);
      res.status(204).end();
    }),
  );

  // ---------- Integrantes ----------
  r.get("/members", content, ah((_req, res) => res.json(listMembers(db, false))));

  r.post(
    "/members",
    content,
    ah((req, res) => {
      const d = parse(memberInput, req.body);
      assertUploadExists(db, d.photoId, "photoId");
      const result = db
        .prepare("INSERT INTO band_members (name, role, instagram, photo_id, sort_order, published) VALUES (?, ?, ?, ?, ?, ?)")
        .run(d.name, d.role, d.instagram, d.photoId, d.sortOrder, d.published ? 1 : 0);
      const id = Number(result.lastInsertRowid);
      audit(db, req, "create", "member", id, d.name);
      res.status(201).json(listMembers(db, false).find((m) => m.id === id));
    }),
  );

  r.put(
    "/members/:id",
    content,
    ah((req, res) => {
      const id = intParam(req.params.id);
      const d = parse(memberInput, req.body);
      assertUploadExists(db, d.photoId, "photoId");
      const result = db
        .prepare("UPDATE band_members SET name=?, role=?, instagram=?, photo_id=?, sort_order=?, published=?, updated_at=? WHERE id=?")
        .run(d.name, d.role, d.instagram, d.photoId, d.sortOrder, d.published ? 1 : 0, now(), id);
      if (!result.changes) throw notFound("Integrante");
      audit(db, req, "update", "member", id, d.name);
      res.json(listMembers(db, false).find((m) => m.id === id));
    }),
  );

  // ---------- Galeria ----------
  r.get("/gallery", content, ah((_req, res) => res.json(listGallery(db, false))));

  r.post(
    "/gallery",
    content,
    ah((req, res) => {
      const d = parse(galleryInput, req.body);
      assertUploadExists(db, d.uploadId, "uploadId");
      assertEventExists(db, d.eventId);
      const result = db
        .prepare("INSERT INTO gallery_images (upload_id, alt, caption, category, event_id, sort_order, published) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(d.uploadId, d.alt, d.caption, d.category, d.eventId, d.sortOrder, d.published ? 1 : 0);
      const id = Number(result.lastInsertRowid);
      audit(db, req, "create", "gallery", id, d.alt);
      res.status(201).json(listGallery(db, false, id)[0]);
    }),
  );

  r.put(
    "/gallery/:id",
    content,
    ah((req, res) => {
      const id = intParam(req.params.id);
      const d = parse(galleryUpdate, req.body);
      assertEventExists(db, d.eventId);
      const result = db
        .prepare("UPDATE gallery_images SET alt=?, caption=?, category=?, event_id=?, sort_order=?, published=?, updated_at=? WHERE id=?")
        .run(d.alt, d.caption, d.category, d.eventId, d.sortOrder, d.published ? 1 : 0, now(), id);
      if (!result.changes) throw notFound("Imagem");
      audit(db, req, "update", "gallery", id, d.alt);
      res.json(listGallery(db, false, id)[0]);
    }),
  );

  // ---------- Vídeos ----------
  r.get("/videos", content, ah((_req, res) => res.json(listVideos(db, false))));

  r.post(
    "/videos",
    content,
    ah((req, res) => {
      const d = parse(videoInput, req.body);
      assertUploadExists(db, d.thumbnailId, "thumbnailId");
      assertEventExists(db, d.eventId);
      const result = db
        .prepare(
          "INSERT INTO videos (title, description, url, youtube_id, thumbnail_id, category, event_id, sort_order, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(d.title, d.description, d.url, youtubeId(d.url), d.thumbnailId, d.category, d.eventId, d.sortOrder, d.published ? 1 : 0);
      const id = Number(result.lastInsertRowid);
      audit(db, req, "create", "video", id, d.title);
      res.status(201).json(listVideos(db, false, id)[0]);
    }),
  );

  r.put(
    "/videos/:id",
    content,
    ah((req, res) => {
      const id = intParam(req.params.id);
      const d = parse(videoInput, req.body);
      assertUploadExists(db, d.thumbnailId, "thumbnailId");
      assertEventExists(db, d.eventId);
      const result = db
        .prepare(
          "UPDATE videos SET title=?, description=?, url=?, youtube_id=?, thumbnail_id=?, category=?, event_id=?, sort_order=?, published=?, updated_at=? WHERE id=?",
        )
        .run(d.title, d.description, d.url, youtubeId(d.url), d.thumbnailId, d.category, d.eventId, d.sortOrder, d.published ? 1 : 0, now(), id);
      if (!result.changes) throw notFound("Vídeo");
      audit(db, req, "update", "video", id, d.title);
      res.json(listVideos(db, false, id)[0]);
    }),
  );

  // ---------- Publicar / despublicar / excluir / reordenar (genérico) ----------
  const tables = {
    members: { table: "band_members", entity: "member", label: "Integrante" },
    gallery: { table: "gallery_images", entity: "gallery", label: "Imagem" },
    videos: { table: "videos", entity: "video", label: "Vídeo" },
  } as const;

  for (const [path, t] of Object.entries(tables)) {
    r.patch(
      `/${path}/:id`,
      content,
      ah((req, res) => {
        const id = intParam(req.params.id);
        const d = parse(z.object({ published: z.boolean() }).strict(), req.body);
        const result = db.prepare(`UPDATE ${t.table} SET published=?, updated_at=? WHERE id=?`).run(d.published ? 1 : 0, now(), id);
        if (!result.changes) throw notFound(t.label);
        audit(db, req, "update", t.entity, id, d.published ? "Publicado" : "Ocultado");
        res.json({ ok: true });
      }),
    );

    r.delete(
      `/${path}/:id`,
      content,
      ah((req, res) => {
        const id = intParam(req.params.id);
        const result = db.prepare(`DELETE FROM ${t.table} WHERE id=?`).run(id);
        if (!result.changes) throw notFound(t.label);
        audit(db, req, "delete", t.entity, id);
        res.status(204).end();
      }),
    );

    r.post(
      `/${path}/reorder`,
      content,
      ah((req, res) => {
        const d = parse(z.object({ ids: z.array(z.number().int().positive()).max(1000) }), req.body);
        const stmt = db.prepare(`UPDATE ${t.table} SET sort_order=?, updated_at=? WHERE id=?`);
        db.transaction(() => d.ids.forEach((id, i) => stmt.run(i + 1, now(), id)))();
        audit(db, req, "update", t.entity, null, "Ordem alterada");
        res.json({ ok: true });
      }),
    );
  }

  // ---------- Solicitações de contratação ----------
  r.get(
    "/bookings",
    content,
    ah((req, res) => {
      const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
      const status = typeof req.query.status === "string" ? req.query.status : "";
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = 20;
      const where: string[] = [];
      const params: (string | number)[] = [];
      if (q) {
        where.push("(name LIKE ? OR email LIKE ? OR company LIKE ? OR city LIKE ? OR phone LIKE ?)");
        params.push(...Array(5).fill(`%${q}%`));
      }
      if ((BOOKING_STATUSES as readonly string[]).includes(status)) {
        where.push("status = ?");
        params.push(status);
      } else if (status === "open") {
        where.push("status IN ('new','in_progress','proposal_sent')");
      }
      const w = where.length ? "WHERE " + where.join(" AND ") : "";
      const total = (db.prepare(`SELECT COUNT(*) n FROM booking_requests ${w}`).get(...params) as { n: number }).n;
      const rows = db
        .prepare(`SELECT * FROM booking_requests ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .all(...params, pageSize, (page - 1) * pageSize) as BookingRow[];
      res.json({ items: rows.map(mapBooking), total, page, pageSize });
    }),
  );

  r.get(
    "/bookings/:id",
    content,
    ah((req, res) => {
      const id = intParam(req.params.id);
      const row = db.prepare("SELECT * FROM booking_requests WHERE id = ?").get(id) as BookingRow | undefined;
      if (!row) throw notFound("Solicitação");
      res.json({ booking: mapBooking(row), notes: bookingNotes(db, id) });
    }),
  );

  r.patch(
    "/bookings/:id",
    content,
    ah((req, res) => {
      const id = intParam(req.params.id);
      const d = parse(bookingUpdate, req.body);
      const result = db.prepare("UPDATE booking_requests SET status=?, updated_at=? WHERE id=?").run(d.status, now(), id);
      if (!result.changes) throw notFound("Solicitação");
      audit(db, req, "status", "booking", id, `Status: ${BOOKING_STATUS_LABEL[d.status]}`);
      const row = db.prepare("SELECT * FROM booking_requests WHERE id = ?").get(id) as BookingRow;
      res.json(mapBooking(row));
    }),
  );

  r.post(
    "/bookings/:id/notes",
    content,
    ah((req, res) => {
      const id = intParam(req.params.id);
      if (!db.prepare("SELECT 1 FROM booking_requests WHERE id=?").get(id)) throw notFound("Solicitação");
      const d = parse(bookingNoteInput, req.body);
      db.prepare("INSERT INTO booking_notes (booking_id, user_id, body) VALUES (?, ?, ?)").run(id, req.user!.id, d.body);
      db.prepare("UPDATE booking_requests SET updated_at=? WHERE id=?").run(now(), id);
      audit(db, req, "note", "booking", id, "Observação interna adicionada");
      res.status(201).json(bookingNotes(db, id));
    }),
  );

  // Exclusão definitiva (ex.: pedido de eliminação de dados — LGPD). Somente administradores.
  r.delete(
    "/bookings/:id",
    adminOnly,
    ah((req, res) => {
      const id = intParam(req.params.id);
      const result = db.prepare("DELETE FROM booking_requests WHERE id=?").run(id);
      if (!result.changes) throw notFound("Solicitação");
      audit(db, req, "delete", "booking", id, "Solicitação excluída");
      res.status(204).end();
    }),
  );

  // ---------- Configurações ----------
  r.get("/settings", content, ah((_req, res) => res.json(getAdminSettings(db))));

  r.put(
    "/settings",
    adminOnly,
    ah((req, res) => {
      const d = parse(settingsInput, req.body);
      for (const f of ["logoId", "heroImageId", "aboutImageId", "ogImageId"] as const) assertUploadExists(db, d[f], f);
      const merged = { ...getStoredSettings(db), ...d };
      db.prepare(
        "INSERT INTO site_settings (key, value, updated_at) VALUES ('site', ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
      ).run(JSON.stringify(merged), now());
      audit(db, req, "update", "settings", null, "Configurações do site atualizadas");
      res.json(getAdminSettings(db));
    }),
  );

  // ---------- Usuários (somente admin) ----------
  const userCols = "id, name, email, role, active, last_login_at, created_at";
  const mapUser = (u: Record<string, unknown>): User => ({
    id: u.id as number,
    name: u.name as string,
    email: u.email as string,
    role: u.role as User["role"],
    active: !!u.active,
    lastLoginAt: (u.last_login_at as string) ?? null,
    createdAt: u.created_at as string,
  });

  r.get(
    "/users",
    adminOnly,
    ah((_req, res) => {
      res.json((db.prepare(`SELECT ${userCols} FROM users ORDER BY name`).all() as Record<string, unknown>[]).map(mapUser));
    }),
  );

  r.post(
    "/users",
    adminOnly,
    ah(async (req, res) => {
      const d = parse(userCreateInput, req.body);
      if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(d.email)) {
        throw new HttpError(422, "Revise os campos destacados.", { email: "Já existe um usuário com este e-mail." });
      }
      const result = db
        .prepare("INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)")
        .run(d.name, d.email, d.role, await hashPassword(d.password));
      const id = Number(result.lastInsertRowid);
      audit(db, req, "create", "user", id, `Papel: ${d.role}`);
      res.status(201).json(mapUser(db.prepare(`SELECT ${userCols} FROM users WHERE id=?`).get(id) as Record<string, unknown>));
    }),
  );

  r.put(
    "/users/:id",
    adminOnly,
    ah(async (req: Request, res) => {
      const id = intParam(req.params.id);
      const d = parse(userUpdateInput, req.body);
      if (id === req.user!.id && (d.role !== "admin" || !d.active)) {
        throw new HttpError(422, "Você não pode remover o próprio acesso de administrador.");
      }
      const result = db
        .prepare("UPDATE users SET name=?, role=?, active=?, updated_at=? WHERE id=?")
        .run(d.name, d.role, d.active ? 1 : 0, now(), id);
      if (!result.changes) throw notFound("Usuário");
      if (d.password) db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(await hashPassword(d.password), id);
      if (!d.active || d.password) db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
      audit(db, req, "update", "user", id, d.password ? "Dados e senha atualizados" : "Dados atualizados");
      res.json(mapUser(db.prepare(`SELECT ${userCols} FROM users WHERE id=?`).get(id) as Record<string, unknown>));
    }),
  );

  return r;
}

function assertEventExists(db: DB, id: number | null) {
  if (id !== null && !db.prepare("SELECT 1 FROM events WHERE id=?").get(id)) {
    throw new HttpError(422, "Revise os campos destacados.", { eventId: "Evento não encontrado." });
  }
}

function bookingNotes(db: DB, id: number): BookingNote[] {
  return (
    db
      .prepare(
        `SELECT n.id, n.body, n.created_at, u.name AS author FROM booking_notes n
         LEFT JOIN users u ON u.id = n.user_id WHERE n.booking_id = ? ORDER BY n.created_at DESC, n.id DESC`,
      )
      .all(id) as { id: number; body: string; created_at: string; author: string | null }[]
  ).map((n) => ({ id: n.id, body: n.body, authorName: n.author, createdAt: n.created_at }));
}

function recentAudit(db: DB, limit: number): AuditEntry[] {
  return (
    db
      .prepare(
        `SELECT a.id, a.action, a.entity, a.entity_id, a.summary, a.created_at, u.name AS user_name
         FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
         WHERE a.action NOT IN ('login','logout')
         ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
      )
      .all(limit) as Record<string, unknown>[]
  ).map((a) => ({
    id: a.id as number,
    action: a.action as string,
    entity: a.entity as string,
    entityId: (a.entity_id as number) ?? null,
    userName: (a.user_name as string) ?? null,
    summary: (a.summary as string) ?? null,
    createdAt: a.created_at as string,
  }));
}
