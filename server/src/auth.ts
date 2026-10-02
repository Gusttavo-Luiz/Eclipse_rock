import crypto from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import type { Role } from "../../shared/schemas";
import { config } from "./config";
import type { DB } from "./db";
import { HttpError } from "./http";

const scrypt = promisify(crypto.scrypt) as (
  pw: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  opts: crypto.ScryptOptions,
) => Promise<Buffer>;

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
export const SESSION_COOKIE = "er_session";

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, N, r, p, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** Hash fixo para comparar quando o usuário não existe (evita enumeração por tempo de resposta). */
let dummyHash: Promise<string> | null = null;
export const getDummyHash = () => (dummyHash ??= hashPassword("dummy-password-0"));

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function createSession(db: DB, userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + config.sessionDays * 86_400_000);
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    sha256(token),
    userId,
    expires.toISOString(),
  );
  return { token, expires };
}

export function destroySession(db: DB, token: string | undefined) {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

export function setSessionCookie(res: Response, token: string, expires: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: config.isProd, sameSite: "lax", path: "/" });
}

/** Carrega o usuário da sessão (se houver) em req.user. Nunca bloqueia. */
export function loadUser(db: DB) {
  const stmt = db.prepare(`
    SELECT u.id, u.name, u.email, u.role
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1
  `);
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === "string" && token.length > 20) {
      const row = stmt.get(sha256(token), new Date().toISOString()) as AuthUser | undefined;
      if (row) req.user = row;
    }
    next();
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Faça login para continuar."));
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Faça login para continuar."));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "Você não tem permissão para esta ação."));
    next();
  };

/**
 * Proteção CSRF para rotas autenticadas que alteram dados:
 *  - cookie de sessão é SameSite=Lax;
 *  - exige o cabeçalho X-Requested-With (navegadores não o enviam em formulários cross-site
 *    e ele dispara preflight CORS, que este servidor não autoriza);
 *  - se houver Origin, ele precisa ser o próprio host ou uma origem permitida.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("x-requested-with") !== "eclipse-rock") {
    return next(new HttpError(403, "Requisição bloqueada."));
  }
  const origin = req.get("origin");
  if (origin) {
    const host = req.get("host");
    const ok =
      config.allowedOrigins.includes(origin.replace(/\/$/, "")) ||
      (host && (origin === `https://${host}` || origin === `http://${host}`));
    if (!ok) return next(new HttpError(403, "Origem não permitida."));
  }
  next();
}

export function audit(
  db: DB,
  req: Request,
  action: "create" | "update" | "delete" | "login" | "logout" | "status" | "note" | "upload" | "notify" | "test_email",
  entity: string,
  entityId: number | null,
  summary?: string,
) {
  db.prepare("INSERT INTO audit_log (user_id, action, entity, entity_id, summary) VALUES (?, ?, ?, ?, ?)").run(
    req.user?.id ?? null,
    action,
    entity,
    entityId,
    summary?.slice(0, 200) ?? null,
  );
}

/** Hash não reversível do IP para chave de rate limit (nunca persistido). */
export const ipKey = (req: Request) =>
  crypto
    .createHmac("sha256", config.appSecret || "x")
    .update(req.ip ?? "unknown")
    .digest("hex")
    .slice(0, 24);
