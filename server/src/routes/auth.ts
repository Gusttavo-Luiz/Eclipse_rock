import { Router } from "express";
import { loginInput, passwordChangeInput } from "../../../shared/schemas";
import {
  audit,
  clearSessionCookie,
  createSession,
  destroySession,
  getDummyHash,
  hashPassword,
  ipKey,
  requireAuth,
  SESSION_COOKIE,
  setSessionCookie,
  verifyPassword,
} from "../auth";
import type { DB } from "../db";
import { ah, HttpError, parse, rateLimit } from "../http";

export function authRoutes(db: DB) {
  const r = Router();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    key: (req) => "login:" + ipKey(req),
    message: "Muitas tentativas de login. Aguarde 15 minutos e tente novamente.",
    onlyFailures: true,
  });

  r.post(
    "/login",
    loginLimiter,
    ah(async (req, res) => {
      const { email, password } = parse(loginInput, req.body);
      const user = db
        .prepare("SELECT id, name, email, role, password_hash, active FROM users WHERE email = ?")
        .get(email) as
        | { id: number; name: string; email: string; role: string; password_hash: string; active: number }
        | undefined;

      // Sempre executa a verificação para não revelar se o e-mail existe.
      const ok = await verifyPassword(password, user?.password_hash ?? (await getDummyHash()));
      if (!user || !ok || !user.active) throw new HttpError(401, "E-mail ou senha incorretos.");

      // Rotaciona: encerra sessão anterior deste navegador, se houver.
      destroySession(db, req.cookies?.[SESSION_COOKIE]);
      const { token, expires } = createSession(db, user.id);
      db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(new Date().toISOString(), user.id);
      db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
      setSessionCookie(res, token, expires);
      req.user = { id: user.id, name: user.name, email: user.email, role: user.role as "admin" | "editor" };
      audit(db, req, "login", "user", user.id);
      res.json({ user: req.user });
    }),
  );

  r.post(
    "/logout",
    ah((req, res) => {
      if (req.user) audit(db, req, "logout", "user", req.user.id);
      destroySession(db, req.cookies?.[SESSION_COOKIE]);
      clearSessionCookie(res);
      res.json({ ok: true });
    }),
  );

  r.get(
    "/me",
    ah((req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.json({ user: req.user ?? null });
    }),
  );

  r.post(
    "/password",
    requireAuth,
    ah(async (req, res) => {
      const d = parse(passwordChangeInput, req.body);
      const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user!.id) as { password_hash: string };
      if (!(await verifyPassword(d.currentPassword, row.password_hash))) {
        throw new HttpError(422, "Revise os campos destacados.", { currentPassword: "Senha atual incorreta." });
      }
      db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
        await hashPassword(d.newPassword),
        new Date().toISOString(),
        req.user!.id,
      );
      // Encerra as outras sessões do usuário, mantendo a atual.
      const current = req.cookies?.[SESSION_COOKIE];
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(req.user!.id);
      const { token, expires } = createSession(db, req.user!.id);
      void current;
      setSessionCookie(res, token, expires);
      audit(db, req, "update", "user", req.user!.id, "Senha alterada");
      res.json({ ok: true });
    }),
  );

  return r;
}
