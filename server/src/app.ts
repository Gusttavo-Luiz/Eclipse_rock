import fs from "node:fs";
import path from "node:path";
import compression from "compression";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { csrfGuard, loadUser } from "./auth";
import { config } from "./config";
import type { DB } from "./db";
import { errorHandler, HttpError } from "./http";
import { createMailer, type Mailer } from "./mailer";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { publicRoutes } from "./routes/public";
import { renderHead, resolveHead, robots, sitemap } from "./seo";
import { uploadsDir } from "./uploads";

export function createApp(db: DB, opts: { serveClient?: boolean; mailer?: Mailer | null } = {}) {
  const mailer = opts.mailer !== undefined ? opts.mailer : createMailer();
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "font-src": ["'self'"],
          "img-src": ["'self'", "data:", "https://i.ytimg.com"],
          "frame-src": ["https://www.youtube-nocookie.com"],
          "connect-src": ["'self'"],
          "form-action": ["'self'"],
          "frame-ancestors": ["'none'"],
          "object-src": ["'none'"],
          "upgrade-insecure-requests": config.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      strictTransportSecurity: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
    next();
  });
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: "100kb" }));

  // Imagens enviadas: nomes aleatórios e imutáveis → cache longo.
  app.use(
    "/uploads",
    express.static(uploadsDir(), {
      immutable: true,
      maxAge: "365d",
      index: false,
      dotfiles: "deny",
      setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
    }),
  );

  // Usado pelo Render (healthCheckPath) e pelo HEALTHCHECK do Docker: confirma que o banco responde.
  app.get("/api/health", (_req, res) => {
    try {
      db.prepare("SELECT 1").get();
      res.setHeader("Cache-Control", "no-store").json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  const api = express.Router();
  api.use(loadUser(db));
  api.use("/public", publicRoutes(db, mailer));
  api.use("/auth", csrfGuard, authRoutes(db, mailer));
  api.use("/admin", csrfGuard, adminRoutes(db, mailer));
  api.use((_req, _res, next) => next(new HttpError(404, "Rota não encontrada.")));
  app.use("/api", api);

  app.get("/sitemap.xml", (_req, res) => res.type("application/xml").send(sitemap(db)));
  app.get("/robots.txt", (_req, res) => res.type("text/plain").send(robots(db)));

  if (opts.serveClient) {
    const indexPath = path.join(config.clientDist, "index.html");
    if (!fs.existsSync(indexPath)) {
      throw new Error(`Frontend não encontrado em ${config.clientDist}. Rode "npm run build" antes de "npm start".`);
    }
    const template = fs.readFileSync(indexPath, "utf8");
    app.use(
      "/assets",
      express.static(path.join(config.clientDist, "assets"), { immutable: true, maxAge: "365d", index: false }),
    );
    app.use(express.static(config.clientDist, { index: false, maxAge: "1d" }));
    app.get("*", (req, res) => {
      const head = resolveHead(db, req.path);
      const html = template.replace(/<title>[\s\S]*?<\/title>/, "").replace("<!--app-head-->", renderHead(db, head));
      res.status(head.status).setHeader("Cache-Control", "no-cache").type("html").send(html);
    });
  }

  app.use(errorHandler);
  return app;
}
