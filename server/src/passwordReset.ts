/** Recuperação de senha por e-mail: tokens de uso único e e-mails enviados ao usuário. */
import crypto from "node:crypto";
import { sha256 } from "./auth";
import type { DB } from "./db";
import type { Mail, Mailer } from "./mailer";
import { esc } from "./notifications";

export const RESET_TTL_MINUTES = 60;
/** Máximo de links gerados por usuário por hora (evita encher a caixa de entrada de alguém). */
const MAX_PER_HOUR = 3;

export interface ResetUser {
  id: number;
  name: string;
  email: string;
}

/**
 * Gera um link novo e invalida os anteriores ainda não usados.
 * Retorna null se o limite por hora foi atingido.
 */
export function createResetToken(db: DB, userId: number): string | null {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const recent = (
    db.prepare("SELECT COUNT(*) n FROM password_resets WHERE user_id = ? AND created_at > ?").get(userId, since) as { n: number }
  ).n;
  if (recent >= MAX_PER_HOUR) return null;
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  db.transaction(() => {
    db.prepare("UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL").run(now.toISOString(), userId);
    db.prepare("INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)").run(
      userId,
      sha256(token),
      new Date(now.getTime() + RESET_TTL_MINUTES * 60_000).toISOString(),
    );
    // Limpeza de registros antigos.
    db.prepare("DELETE FROM password_resets WHERE created_at < ?").run(new Date(now.getTime() - 30 * 86_400_000).toISOString());
  })();
  return token;
}

/** Usuário dono de um token válido (não usado, não expirado, conta ativa). */
export function findResetUser(db: DB, token: string): (ResetUser & { resetId: number }) | null {
  const row = db
    .prepare(
      `SELECT r.id resetId, u.id, u.name, u.email
       FROM password_resets r JOIN users u ON u.id = r.user_id
       WHERE r.token_hash = ? AND r.used_at IS NULL AND r.expires_at > ? AND u.active = 1`,
    )
    .get(sha256(token), new Date().toISOString()) as (ResetUser & { resetId: number }) | undefined;
  return row ?? null;
}

const layout = (bandName: string, body: string) => `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f2f7;font-family:Arial,Helvetica,sans-serif;color:#1d1a24">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
<p style="margin:0 0 4px;font-size:13px;color:#6b6478">${esc(bandName)} · painel</p>
${body}
</div></body></html>`;

export function resetEmail(user: ResetUser, link: string, bandName: string): Omit<Mail, "to"> {
  const first = user.name.split(" ")[0];
  return {
    subject: `Redefinir sua senha — painel ${bandName}`,
    text: [
      `Olá, ${first}!`,
      "",
      `Recebemos um pedido para redefinir a senha do painel da ${bandName}.`,
      `Para criar uma nova senha, abra o link abaixo (válido por ${RESET_TTL_MINUTES} minutos, uso único):`,
      "",
      link,
      "",
      "Se não foi você, ignore este e-mail: sua senha continua a mesma.",
    ].join("\n"),
    html: layout(
      bandName,
      `<h1 style="margin:0 0 16px;font-size:20px">Redefinir sua senha</h1>
<p style="margin:0 0 12px;font-size:15px">Olá, ${esc(first)}! Recebemos um pedido para redefinir a senha do painel da ${esc(bandName)}.</p>
<p style="margin:20px 0"><a href="${esc(link)}" style="display:inline-block;background:#b0217a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">Criar nova senha</a></p>
<p style="margin:0 0 12px;font-size:13px;color:#6b6478">O link vale por ${RESET_TTL_MINUTES} minutos e só pode ser usado uma vez. Se o botão não funcionar, copie e cole no navegador:<br><span style="word-break:break-all">${esc(link)}</span></p>
<p style="margin:0;font-size:13px;color:#6b6478">Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`,
    ),
  };
}

export function passwordChangedEmail(user: ResetUser, bandName: string): Omit<Mail, "to"> {
  const first = user.name.split(" ")[0];
  const msg = `A senha da sua conta no painel da ${bandName} acabou de ser alterada e as outras sessões foram encerradas.`;
  const warn = "Se não foi você, avise imediatamente um administrador da banda para bloquear a conta.";
  return {
    subject: `Sua senha foi alterada — painel ${bandName}`,
    text: [`Olá, ${first}!`, "", msg, "", warn].join("\n"),
    html: layout(
      bandName,
      `<h1 style="margin:0 0 16px;font-size:20px">Sua senha foi alterada</h1>
<p style="margin:0 0 12px;font-size:15px">Olá, ${esc(first)}! ${esc(msg)}</p>
<p style="margin:0;font-size:13px;color:#6b6478">${esc(warn)}</p>`,
    ),
  };
}

/** Envio em segundo plano: a resposta HTTP não espera (nem revela) o resultado. */
export function sendInBackground(mailer: Mailer | null, mail: Mail, what: string) {
  if (!mailer) return;
  mailer.send(mail).catch((err) => {
    console.error(`[senha] falha ao enviar e-mail de ${what}: ${err instanceof Error ? err.message : err}`);
  });
}
