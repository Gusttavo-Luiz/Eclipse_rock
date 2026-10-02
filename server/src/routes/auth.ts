import { Router } from "express";
import { forgotPasswordInput, loginInput, passwordChangeInput, resetPasswordInput } from "../../../shared/schemas";
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
import type { Mailer } from "../mailer";
import {
  applyLinkPassword,
  createResetToken,
  findResetUser,
  linkBase,
  passwordChangedEmail,
  resetEmail,
  sendInBackground,
} from "../passwordReset";
import { getAdminSettings } from "../repo";

export function authRoutes(db: DB, mailer: Mailer | null) {
  const r = Router();

  const notifyPasswordChanged = (userId: number) => {
    const u = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(userId) as { id: number; name: string; email: string };
    sendInBackground(mailer, { to: [u.email], ...passwordChangedEmail(u, getAdminSettings(db).bandName) }, "senha alterada");
  };

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

  /** O que a tela de login pode oferecer (ex.: "Esqueci minha senha" só com e-mail configurado). */
  r.get("/options", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ passwordReset: !!mailer, invites: !!mailer });
  });

  // ---------- Recuperação de senha ----------
  const forgotLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    key: (req) => "forgot:" + ipKey(req),
    message: "Muitos pedidos em pouco tempo. Aguarde 15 minutos e tente novamente.",
  });
  const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    key: (req) => "reset:" + ipKey(req),
    message: "Muitas tentativas. Aguarde 15 minutos e tente novamente.",
    onlyFailures: true,
  });

  r.post(
    "/forgot",
    forgotLimiter,
    ah((req, res) => {
      if (!mailer) {
        throw new HttpError(503, "A recuperação por e-mail não está disponível. Peça a um administrador para redefinir sua senha.");
      }
      const { email } = parse(forgotPasswordInput, req.body);
      const user = db.prepare("SELECT id, name, email FROM users WHERE email = ? AND active = 1").get(email) as
        | { id: number; name: string; email: string }
        | undefined;
      if (user) {
        const token = createResetToken(db, user.id);
        if (token) {
          // Token no fragmento (#): não vai para o servidor nem para o Referer de outros sites.
          const link = `${linkBase(db, req)}/admin/redefinir-senha#token=${token}`;
          sendInBackground(mailer, { to: [user.email], ...resetEmail(user, link, getAdminSettings(db).bandName) }, "recuperação");
        }
      }
      // Mesma resposta exista ou não a conta, para não revelar quais e-mails estão cadastrados.
      res.json({ ok: true });
    }),
  );

  /** Confere o link antes de mostrar o formulário de nova senha. */
  r.post(
    "/reset/check",
    resetLimiter,
    ah((req, res) => {
      const token = typeof req.body?.token === "string" ? req.body.token.slice(0, 200) : "";
      if (!token || !findResetUser(db, token)) throw new HttpError(410, "Este link é inválido, já foi usado ou expirou. Peça um novo.");
      res.json({ ok: true });
    }),
  );

  r.post(
    "/reset",
    resetLimiter,
    ah(async (req, res) => {
      const d = parse(resetPasswordInput, req.body);
      const user = findResetUser(db, d.token);
      if (!user) throw new HttpError(410, "Este link é inválido, já foi usado ou expirou. Peça um novo.");
      const used = applyLinkPassword(db, user.resetId, user.id, await hashPassword(d.newPassword), "Senha redefinida pelo link enviado por e-mail");
      if (!used) throw new HttpError(410, "Este link é inválido, já foi usado ou expirou. Peça um novo.");
      clearSessionCookie(res);
      notifyPasswordChanged(user.id);
      res.json({ ok: true });
    }),
  );

  // ---------- Convite (conta criada pelo admin; a pessoa define a própria senha) ----------
  const INVITE_GONE = "Este convite é inválido, já foi usado ou expirou. Peça a um administrador para reenviar.";

  r.post(
    "/invite/check",
    resetLimiter,
    ah((req, res) => {
      const token = typeof req.body?.token === "string" ? req.body.token.slice(0, 200) : "";
      const user = token ? findResetUser(db, token, "invite") : null;
      if (!user) throw new HttpError(410, INVITE_GONE);
      res.json({ name: user.name, email: user.email });
    }),
  );

  r.post(
    "/invite/accept",
    resetLimiter,
    ah(async (req, res) => {
      const d = parse(resetPasswordInput, req.body);
      const user = findResetUser(db, d.token, "invite");
      if (!user) throw new HttpError(410, INVITE_GONE);
      const ok = applyLinkPassword(db, user.resetId, user.id, await hashPassword(d.newPassword), "Convite aceito e senha criada");
      if (!ok) throw new HttpError(410, INVITE_GONE);
      // Já entra no painel.
      destroySession(db, req.cookies?.[SESSION_COOKIE]);
      const { token, expires } = createSession(db, user.id);
      db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(new Date().toISOString(), user.id);
      setSessionCookie(res, token, expires);
      const me = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(user.id);
      res.json({ user: me });
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
      notifyPasswordChanged(req.user!.id);
      res.json({ ok: true });
    }),
  );

  return r;
}
