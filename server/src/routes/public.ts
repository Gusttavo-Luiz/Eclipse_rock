import { Router } from "express";
import { bookingInput } from "../../../shared/schemas";
import { ipKey } from "../auth";
import type { DB } from "../db";
import { ah, HttpError, notFound, parse, rateLimit } from "../http";
import { getEventBy, getPublicSettings, listGallery, listMembers, listPublicEvents, listVideos } from "../repo";

export function publicRoutes(db: DB) {
  const r = Router();

  // Conteúdo público: cache curto no navegador, sempre revalidado.
  r.use((_req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    next();
  });

  /** Tudo que a página inicial precisa em uma única chamada. */
  r.get(
    "/home",
    ah((_req, res) => {
      res.json({
        settings: getPublicSettings(db),
        members: listMembers(db, true),
        upcoming: listPublicEvents(db, "upcoming"),
        gallery: listGallery(db, true),
        videos: listVideos(db, true),
      });
    }),
  );

  r.get("/settings", ah((_req, res) => res.json(getPublicSettings(db))));

  r.get(
    "/events",
    ah((req, res) => {
      const scope = req.query.scope === "past" ? "past" : req.query.scope === "all" ? "all" : "upcoming";
      res.json(listPublicEvents(db, scope));
    }),
  );

  r.get(
    "/events/:slug",
    ah((req, res) => {
      const ev = getEventBy(db, "slug", String(req.params.slug).slice(0, 120), true);
      if (!ev) throw notFound("Show");
      res.json(ev);
    }),
  );

  r.get("/gallery", ah((_req, res) => res.json(listGallery(db, true))));
  r.get("/videos", ah((_req, res) => res.json(listVideos(db, true))));
  r.get("/members", ah((_req, res) => res.json(listMembers(db, true))));

  // ---------- Solicitação de contratação ----------
  const bookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    key: (req) => "booking:" + ipKey(req),
    message: "Muitas solicitações enviadas em pouco tempo. Tente novamente mais tarde ou fale pelo WhatsApp.",
  });

  r.post(
    "/bookings",
    bookingLimiter,
    ah((req, res) => {
      const body = req.body ?? {};
      // Honeypot preenchido = robô. Responde de forma genérica, sem registrar.
      if (typeof body.website === "string" && body.website.length > 0) {
        throw new HttpError(400, "Não foi possível enviar a solicitação.");
      }
      const d = parse(bookingInput, body);
      const result = db
        .prepare(
          `INSERT INTO booking_requests
           (name, company, phone, email, event_type, event_date, city, state, venue, audience, message, consent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          d.name,
          d.company,
          d.phone,
          d.email,
          d.eventType,
          d.eventDate,
          d.city,
          d.state,
          d.venue,
          d.audience,
          d.message,
          new Date().toISOString(),
        );
      // Registro de auditoria sem dados pessoais.
      db.prepare("INSERT INTO audit_log (action, entity, entity_id, summary) VALUES ('create', 'booking', ?, ?)").run(
        Number(result.lastInsertRowid),
        "Nova solicitação de contratação recebida pelo site",
      );
      res.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });
    }),
  );

  return r;
}
