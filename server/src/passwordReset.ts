/** Recuperação de senha e convites por e-mail: tokens de uso único e e-mails enviados ao usuário. */
import crypto from "node:crypto";
import type { Request } from "express";
import { sha256 } from "./auth";
import { config } from "./config";
import type { DB } from "./db";
import type { Mail, Mailer } from "./mailer";
import { esc } from "./notifications";
import { getAdminSettings } from "./repo";

export type LinkKind = "reset" | "invite";

export const RESET_TTL_MINUTES = 60;
export const INVITE_TTL_DAYS = 7;
const TTL_MS: Record<LinkKind, number> = { reset: RESET_TTL_MINUTES * 60_000, invite: INVITE_TTL_DAYS * 86_400_000 };
/** Máximo de links gerados por usuário por hora (evita encher a caixa de entrada de alguém). */
const MAX_PER_HOUR: Record<LinkKind, number> = { reset: 3, invite: 5 };

export interface ResetUser {
  id: number;
  name: string;
  email: string;
}

/**
 * Gera um link novo e invalida os anteriores ainda não usados.
 * Retorna null se o limite por hora foi atingido.
 */
export function createResetToken(db: DB, userId: number, kind: LinkKind = "reset"): string | null {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const recent = (
    db
      .prepare("SELECT COUNT(*) n FROM password_resets WHERE user_id = ? AND kind = ? AND created_at > ?")
      .get(userId, kind, since) as { n: number }
  ).n;
  if (recent >= MAX_PER_HOUR[kind]) return null;
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  db.transaction(() => {
    db.prepare("UPDATE password_resets SET used_at = ? WHERE user_id = ? AND kind = ? AND used_at IS NULL").run(
      now.toISOString(),
      userId,
      kind,
    );
    db.prepare("INSERT INTO password_resets (user_id, token_hash, expires_at, kind) VALUES (?, ?, ?, ?)").run(
      userId,
      sha256(token),
      new Date(now.getTime() + TTL_MS[kind]).toISOString(),
      kind,
    );
    // Limpeza de registros antigos.
    db.prepare("DELETE FROM password_resets WHERE created_at < ?").run(new Date(now.getTime() - 30 * 86_400_000).toISOString());
  })();
  return token;
}

/** Usuário dono de um token válido do tipo pedido (não usado, não expirado, conta ativa). */
export function findResetUser(db: DB, token: string, kind: LinkKind = "reset"): (ResetUser & { resetId: number }) | null {
  const row = db
    .prepare(
      `SELECT r.id resetId, u.id, u.name, u.email
       FROM password_resets r JOIN users u ON u.id = r.user_id
       WHERE r.token_hash = ? AND r.kind = ? AND r.used_at IS NULL AND r.expires_at > ? AND u.active = 1`,
    )
    .get(sha256(token), kind, new Date().toISOString()) as (ResetUser & { resetId: number }) | undefined;
  return row ?? null;
}

/**
 * Define a senha usando um link válido: marca o link (e todos os outros do usuário) como usados,
 * conclui o convite pendente e encerra as sessões. Retorna false se o link já tinha sido usado.
 */
export function applyLinkPassword(db: DB, resetId: number, userId: number, hash: string, summary: string): boolean {
  const now = new Date().toISOString();
  return db.transaction(() => {
    // Marca como usado só se ainda não foi (dois envios simultâneos não usam o mesmo link).
    const mark = db.prepare("UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL").run(now, resetId);
    if (!mark.changes) return false;
    db.prepare("UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL").run(now, userId);
    db.prepare("UPDATE users SET password_hash = ?, invite_pending = 0, updated_at = ? WHERE id = ?").run(hash, now, userId);
    // Encerra todas as sessões: quem tinha acesso com a senha antiga perde o acesso.
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    db.prepare("INSERT INTO audit_log (user_id, action, entity, entity_id, summary) VALUES (?, 'update', 'user', ?, ?)").run(
      userId,
      userId,
      summary,
    );
    return true;
  })();
}

/** Base dos links enviados por e-mail. Em produção nunca vem do cabeçalho Host (evita links para outro domínio). */
export function linkBase(db: DB, req: Request) {
  return config.siteUrl ?? (config.isProd ? getAdminSettings(db).siteUrl : `${req.protocol}://${req.get("host")}`);
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

const ROLE_TEXT = { admin: "administrador(a)", editor: "editor(a)" } as const;

export function inviteEmail(
  user: ResetUser & { role: "admin" | "editor" },
  /** Nome de quem convidou; null no convite automático do primeiro administrador. */
  invitedBy: string | null,
  link: string,
  bandName: string,
): Omit<Mail, "to"> {
  const first = user.name.split(" ")[0];
  const what =
    user.role === "admin"
      ? "atualizar o site (shows, integrantes, fotos, vídeos e textos), acompanhar pedidos de contratação e gerenciar usuários"
      : "atualizar shows, integrantes, fotos e vídeos do site e acompanhar os pedidos de contratação";
  const intro = `${invitedBy ? `${invitedBy} convidou você` : "Você foi convidado(a)"} para o painel da ${bandName} como`;
  return {
    subject: `Convite para o painel da ${bandName}`,
    text: [
      `Olá, ${first}!`,
      "",
      `${intro} ${ROLE_TEXT[user.role]}. Lá você pode ${what}.`,
      "",
      `Para aceitar, crie sua senha neste link (válido por ${INVITE_TTL_DAYS} dias, uso único):`,
      link,
      "",
      `Seu login será este e-mail: ${user.email}`,
      "Se você não esperava este convite, ignore este e-mail.",
    ].join("\n"),
    html: layout(
      bandName,
      `<h1 style="margin:0 0 16px;font-size:20px">Você foi convidado(a) para o painel</h1>
<p style="margin:0 0 12px;font-size:15px">Olá, ${esc(first)}! ${esc(intro)} <strong>${ROLE_TEXT[user.role]}</strong>. Lá você pode ${esc(what)}.</p>
<p style="margin:20px 0"><a href="${esc(link)}" style="display:inline-block;background:#b0217a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">Criar minha senha</a></p>
<p style="margin:0 0 12px;font-size:13px;color:#6b6478">Seu login será <strong>${esc(user.email)}</strong>. O link vale por ${INVITE_TTL_DAYS} dias e só pode ser usado uma vez. Se o botão não funcionar, copie e cole no navegador:<br><span style="word-break:break-all">${esc(link)}</span></p>
<p style="margin:0;font-size:13px;color:#6b6478">Se você não esperava este convite, ignore este e-mail.</p>`,
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
