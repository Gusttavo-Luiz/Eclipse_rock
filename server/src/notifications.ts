/** Aviso por e-mail à equipe quando chega uma solicitação de contratação pelo site. */
import type { BookingRequest, NotifyStatus } from "../../shared/types";
import type { DB } from "./db";
import type { Mail, Mailer } from "./mailer";
import { getAdminSettings, mapBooking, notifyRecipients, type BookingRow } from "./repo";

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** YYYY-MM-DD → "sábado, 12 de dezembro de 2026" (sem conversão de fuso). */
function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

function shortDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatPhone(d: string) {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export function bookingEmail(b: BookingRequest, opts: { bandName: string; siteUrl: string }): Omit<Mail, "to"> {
  const panelUrl = `${opts.siteUrl}/admin/solicitacoes/${b.id}`;
  const rows: [string, string][] = [
    ["Nome", b.name],
    ["Empresa ou evento", b.company ?? "—"],
    ["Telefone / WhatsApp", formatPhone(b.phone)],
    ["E-mail", b.email],
    ["Tipo de evento", b.eventType],
    ["Data prevista", longDate(b.eventDate)],
    ["Cidade", `${b.city}/${b.state}`],
    ["Local", b.venue ?? "—"],
    ["Público estimado", b.audience ? b.audience.toLocaleString("pt-BR") : "—"],
  ];
  const waUrl = `https://wa.me/55${b.phone}`;

  const text = [
    `Nova solicitação de contratação recebida pelo site da ${opts.bandName}.`,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(b.message ? ["", "Mensagem:", b.message] : []),
    "",
    `Abrir no painel: ${panelUrl}`,
    `WhatsApp: ${waUrl}`,
    "Responda este e-mail para falar direto com o contratante.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f2f7;font-family:Arial,Helvetica,sans-serif;color:#1d1a24">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
<p style="margin:0 0 4px;font-size:13px;color:#6b6478">${esc(opts.bandName)} · solicitação nº ${b.id}</p>
<h1 style="margin:0 0 20px;font-size:20px">Nova solicitação de contratação</h1>
<table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#6b6478;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0">${esc(v)}</td></tr>`,
  )
  .join("\n")}
</table>
${
  b.message
    ? `<p style="margin:20px 0 4px;color:#6b6478;font-size:13px">Mensagem</p><p style="margin:0;white-space:pre-line;font-size:15px">${esc(b.message)}</p>`
    : ""
}
<p style="margin:24px 0 0">
<a href="${esc(panelUrl)}" style="display:inline-block;background:#b0217a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">Abrir no painel</a>
<a href="${esc(waUrl)}" style="display:inline-block;margin-left:8px;color:#b0217a;padding:12px 6px">Chamar no WhatsApp</a>
</p>
<p style="margin:20px 0 0;font-size:13px;color:#6b6478">Responda este e-mail para falar direto com o contratante.</p>
</div></body></html>`;

  return {
    subject: `Nova solicitação de show: ${b.eventType} em ${b.city}/${b.state} (${shortDate(b.eventDate)})`,
    text,
    html,
    replyTo: b.email,
  };
}

function record(db: DB, id: number, status: NotifyStatus, detail: string | null) {
  db.prepare("UPDATE booking_requests SET notify_status = ?, notify_detail = ?, notified_at = ? WHERE id = ?").run(
    status,
    detail ? detail.slice(0, 500) : null,
    new Date().toISOString(),
    id,
  );
}

/**
 * Envia o aviso de nova solicitação e grava o resultado na própria solicitação.
 * Nunca lança: a solicitação já foi salva e continua visível no painel mesmo se o e-mail falhar.
 */
export async function notifyNewBooking(db: DB, mailer: Mailer | null, id: number): Promise<NotifyStatus | null> {
  try {
    const row = db.prepare("SELECT * FROM booking_requests WHERE id = ?").get(id) as BookingRow | undefined;
    if (!row) return null;
    const settings = getAdminSettings(db);
    const to = notifyRecipients(settings);
    if (!mailer) {
      record(db, id, "skipped", "Envio de e-mail não configurado no servidor.");
      return "skipped";
    }
    if (!to.length) {
      record(db, id, "skipped", "Nenhum destinatário: preencha o e-mail de avisos ou o e-mail comercial em Configurações.");
      return "skipped";
    }
    try {
      await mailer.send({ to, ...bookingEmail(mapBooking(row), settings) });
      record(db, id, "sent", `Enviado para ${to.join(", ")}`);
      return "sent";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Log sem dados pessoais do contratante.
      console.error(`[aviso] falha ao enviar e-mail da solicitação ${id}: ${msg}`);
      record(db, id, "failed", msg);
      db.prepare("INSERT INTO audit_log (action, entity, entity_id, summary) VALUES ('notify_failed', 'booking', ?, ?)").run(
        id,
        "Falha ao enviar o aviso por e-mail da solicitação",
      );
      return "failed";
    }
  } catch (err) {
    console.error(`[aviso] erro ao processar aviso da solicitação ${id}`, err);
    return null;
  }
}
