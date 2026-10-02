import nodemailer from "nodemailer";
import { config } from "./config";

export interface Mail {
  to: string[];
  subject: string;
  text: string;
  html: string;
  /** Respostas vão direto para esse endereço (ex.: o contratante). */
  replyTo?: string;
}

export interface Mailer {
  provider: "resend" | "smtp" | "test";
  from: string;
  send(mail: Mail): Promise<void>;
}

const TIMEOUT_MS = 15_000;

/** Envio pela API HTTP do Resend (https://resend.com), sem dependências extras. */
function resendMailer(apiKey: string, from: string): Mailer {
  return {
    provider: "resend",
    from,
    async send(mail) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          reply_to: mail.replyTo,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(`Resend respondeu ${res.status}${body?.message ? `: ${body.message}` : ""}`);
      }
    },
  };
}

/** Envio por SMTP (Gmail/Google Workspace, Zoho, Brevo, provedor de hospedagem…). */
function smtpMailer(smtp: typeof config.mail.smtp, from: string): Mailer {
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
  return {
    provider: "smtp",
    from,
    async send(mail) {
      await transport.sendMail({ from, ...mail, to: mail.to.join(", ") });
    },
  };
}

/** Escolhe o provedor pelas variáveis de ambiente: Resend tem prioridade sobre SMTP. Sem nenhum, retorna null. */
export function createMailer(mail = config.mail): Mailer | null {
  if (!mail.from) return null;
  if (mail.resendApiKey) return resendMailer(mail.resendApiKey, mail.from);
  if (mail.smtp.host) return smtpMailer(mail.smtp, mail.from);
  return null;
}
