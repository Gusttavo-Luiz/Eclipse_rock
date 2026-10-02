/**
 * Primeiro acesso sem terminal: com ADMIN_EMAIL definido e enquanto ninguém consegue entrar no painel,
 * o servidor cria esse administrador (se preciso) e envia um convite por e-mail ao subir.
 */
import crypto from "node:crypto";
import { hashPassword } from "./auth";
import { config } from "./config";
import type { DB } from "./db";
import type { Mailer } from "./mailer";
import { createResetToken, inviteEmail } from "./passwordReset";
import { getAdminSettings } from "./repo";

export type BootstrapResult = "skipped" | "has-users" | "no-mailer" | "invite-valid" | "sent" | "failed";

export async function bootstrapAdmin(db: DB, mailer: Mailer | null, opts = config.bootstrapAdmin): Promise<BootstrapResult> {
  const { email } = opts;
  if (!email) return "skipped";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error(`[primeiro acesso] ADMIN_EMAIL inválido: ${email}`);
    return "skipped";
  }
  // Alguém já entra no painel (tem senha própria): não faz nada.
  const ready = db.prepare("SELECT COUNT(*) n FROM users WHERE active = 1 AND invite_pending = 0").get() as { n: number };
  if (ready.n > 0) return "has-users";

  if (!mailer) {
    console.log(
      "[primeiro acesso] ADMIN_EMAIL definido, mas o envio de e-mail não está configurado. " +
        'Configure MAIL_FROM + RESEND_API_KEY (ou SMTP) ou rode: node dist/server/cli.js create-admin --email ... --name "..."',
    );
    return "no-mailer";
  }

  let user = db.prepare("SELECT id, name, email, role, active, invite_pending FROM users WHERE email = ?").get(email) as
    | { id: number; name: string; email: string; role: "admin" | "editor"; active: number; invite_pending: number }
    | undefined;
  if (!user) {
    const name = opts.name || email.split("@")[0];
    const id = Number(
      db
        .prepare("INSERT INTO users (name, email, role, password_hash, invite_pending) VALUES (?, ?, 'admin', ?, 1)")
        .run(name, email, await hashPassword(crypto.randomBytes(32).toString("base64url"))).lastInsertRowid,
    );
    db.prepare("INSERT INTO audit_log (action, entity, entity_id, summary) VALUES ('create', 'user', ?, ?)").run(
      id,
      "Primeiro administrador criado por ADMIN_EMAIL (convite por e-mail)",
    );
    user = { id, name, email, role: "admin", active: 1, invite_pending: 1 };
  } else {
    // Garante acesso de administrador a quem foi indicado na configuração do servidor.
    db.prepare("UPDATE users SET role = 'admin', active = 1 WHERE id = ?").run(user.id);
    user.role = "admin";
  }

  // Convite ainda válido: não reenvia a cada reinício do servidor.
  const pending = db
    .prepare("SELECT 1 FROM password_resets WHERE user_id = ? AND kind = 'invite' AND used_at IS NULL AND expires_at > ?")
    .get(user.id, new Date().toISOString());
  if (pending) {
    console.log(`[primeiro acesso] convite para ${email} já enviado e ainda válido. Confira a caixa de entrada (e o spam).`);
    return "invite-valid";
  }

  const token = createResetToken(db, user.id, "invite");
  if (!token) return "failed";
  const settings = getAdminSettings(db);
  const link = `${settings.siteUrl}/admin/convite#token=${token}`;
  try {
    await mailer.send({ to: [email], ...inviteEmail(user, null, link, settings.bandName) });
    console.log(`[primeiro acesso] convite de administrador enviado para ${email}.`);
    return "sent";
  } catch (err) {
    console.error(`[primeiro acesso] falha ao enviar o convite: ${err instanceof Error ? err.message : err}`);
    // Libera para tentar de novo no próximo reinício.
    db.prepare("UPDATE password_resets SET used_at = ? WHERE user_id = ? AND kind = 'invite' AND used_at IS NULL").run(
      new Date().toISOString(),
      user.id,
    );
    return "failed";
  }
}
