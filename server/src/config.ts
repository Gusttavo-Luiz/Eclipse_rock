import fs from "node:fs";
import path from "node:path";

// Carrega .env (se existir) sem dependências extras. Variáveis já definidas no ambiente têm prioridade.
if (process.env.NODE_ENV !== "test" && fs.existsSync(".env")) process.loadEnvFile(".env");

const env = process.env;
const isProd = env.NODE_ENV === "production";

export const config = {
  isProd,
  isTest: env.NODE_ENV === "test",
  port: Number(env.PORT ?? 3001),
  /** Diretório persistente: banco SQLite + uploads. Em produção, aponte para um volume. */
  dataDir: path.resolve(env.DATA_DIR ?? "data"),
  /** URL pública do site (usada em canonical, sitemap e Open Graph). Sobrepõe a configuração do painel se definida. */
  siteUrl: env.SITE_URL?.replace(/\/$/, "") || null,
  /** Origens aceitas em requisições que alteram dados (proteção CSRF). Separe por vírgula. */
  allowedOrigins: (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean),
  /** Atrás de proxy reverso (Render, Railway, Nginx), para req.ip e cookies secure funcionarem. */
  trustProxy: env.TRUST_PROXY ? Number(env.TRUST_PROXY) || env.TRUST_PROXY : isProd ? 1 : false,
  sessionDays: Number(env.SESSION_DAYS ?? 7),
  /** Segredo usado para gerar hashes não reversíveis (ex.: chave de rate limit). */
  appSecret: env.APP_SECRET ?? (isProd ? "" : "dev-only-secret-change-me"),
  maxUploadMb: Number(env.MAX_UPLOAD_MB ?? 10),
  clientDist: path.resolve(env.CLIENT_DIST ?? "dist/client"),
};

export function assertProductionConfig() {
  if (!config.isProd) return;
  if (!config.appSecret || config.appSecret.length < 32) {
    throw new Error("APP_SECRET ausente ou curto (mín. 32 caracteres). Defina-o nas variáveis de ambiente.");
  }
}
