/**
 * Schemas de validação compartilhados entre frontend e backend.
 * O backend SEMPRE revalida — a validação no cliente serve apenas para UX.
 */
import { z } from "zod";
import { todayISO } from "./types";
import { EVENT_TYPES, UFS } from "./constants";
export { EVENT_TYPES, UFS } from "./constants";

// ---------- Helpers ----------
const trimmed = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`);
const required = (max: number, msg = "Campo obrigatório.") => trimmed(max).min(1, msg);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/** URL http(s) opcional. Bloqueia javascript:, data: etc. */
export const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^https?:\/\/[^\s]+$/i.test(v), {
    message: "Informe um link completo começando com https://",
  });

export const isoDate = z
  .string()
  .min(1, "Informe a data.")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .refine((v) => !Number.isNaN(Date.parse(v + "T00:00:00Z")), "Data inválida.");

const optionalTime = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Horário inválido (use HH:MM).");


const uf = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => (UFS as readonly string[]).includes(v), "Selecione um estado (UF).");

/** Remove tudo que não é dígito. */
export const onlyDigits = (v: string) => v.replace(/\D/g, "");

/** Telefone brasileiro: 10 ou 11 dígitos (com DDD), opcionalmente com 55 na frente. */
export const phoneBR = z
  .string()
  .trim()
  .min(1, "Informe um telefone ou WhatsApp.")
  .max(25)
  .refine((v) => {
    let d = onlyDigits(v);
    if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
    return /^[1-9]{2}9?\d{8}$/.test(d);
  }, "Telefone inválido. Use DDD + número, ex.: (11) 91234-5678.")
  .transform((v) => {
    let d = onlyDigits(v);
    if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
    return d;
  });

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Informe um e-mail.")
  .max(254)
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "E-mail inválido.");

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/** Lista de e-mails separados por vírgula, ponto e vírgula ou espaço (ou já em array). */
const emailList = z
  .union([z.string().max(1000), z.array(z.string().max(254))])
  .optional()
  .nullable()
  .transform((v) =>
    (Array.isArray(v) ? v : (v ?? "").split(/[\s,;]+/)).map((s) => s.trim().toLowerCase()).filter(Boolean),
  )
  .refine((l) => l.every(isEmail), "Há um e-mail inválido na lista.")
  .transform((l) => [...new Set(l)])
  .refine((l) => l.length <= 5, "Informe no máximo 5 e-mails.");

const id = z.coerce.number().int().positive();
const optionalId = z
  .union([z.coerce.number().int().positive(), z.null(), z.literal("")])
  .optional()
  .transform((v) => (typeof v === "number" ? v : null));

// ---------- Eventos ----------
export const EVENT_STATUSES = ["scheduled", "on_sale", "sold_out", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const eventInput = z.object({
  title: required(140, "Informe o nome do evento."),
  date: isoDate,
  time: optionalTime,
  venue: required(140, "Informe o local ou festival."),
  city: required(80, "Informe a cidade."),
  state: uf,
  address: optionalText(240),
  mapsUrl: optionalUrl,
  ticketUrl: optionalUrl,
  description: optionalText(2000),
  status: z.enum(EVENT_STATUSES),
  imageId: optionalId,
  published: z.boolean(),
});
export type EventInput = z.input<typeof eventInput>;

// ---------- Integrantes ----------
/** Aceita @handle, handle ou URL do Instagram; normaliza para o handle. */
export const instagramHandle = z
  .string()
  .trim()
  .max(200)
  .optional()
  .nullable()
  .transform((v) => {
    if (!v) return null;
    const m = v.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
    return (m ? m[1] : v.replace(/^@/, "")).trim() || null;
  })
  .refine((v) => v === null || /^[A-Za-z0-9._]{1,30}$/.test(v), "Perfil do Instagram inválido.");

export const memberInput = z.object({
  name: required(80, "Informe o nome artístico."),
  role: optionalText(80),
  instagram: instagramHandle,
  photoId: optionalId,
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  published: z.boolean(),
});

// ---------- Galeria ----------
export const galleryInput = z.object({
  uploadId: id,
  alt: required(200, "Descreva a imagem (texto alternativo)."),
  caption: optionalText(240),
  category: optionalText(60),
  eventId: optionalId,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  published: z.boolean(),
});
export const galleryUpdate = galleryInput.omit({ uploadId: true });

// ---------- Vídeos ----------
/** Extrai o ID de vídeo do YouTube de URLs comuns. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return clean(u.pathname.slice(1));
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return clean(u.searchParams.get("v"));
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/?#]+)/);
      if (m) return clean(m[2]);
    }
  } catch {
    /* noop */
  }
  return null;
  function clean(v: string | null | undefined) {
    return v && /^[A-Za-z0-9_-]{11}$/.test(v) ? v : null;
  }
}

export const videoInput = z.object({
  title: required(140, "Informe o título."),
  description: optionalText(1000),
  url: z
    .string()
    .trim()
    .min(1, "Informe a URL do vídeo.")
    .refine((v) => youtubeId(v) !== null, "Use um link válido do YouTube (youtube.com/watch?v=… ou youtu.be/…)."),
  thumbnailId: optionalId,
  category: optionalText(60),
  eventId: optionalId,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  published: z.boolean(),
});

// ---------- Contratação ----------

export const BOOKING_STATUSES = ["new", "in_progress", "proposal_sent", "confirmed", "closed"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  new: "Nova",
  in_progress: "Em atendimento",
  proposal_sent: "Proposta enviada",
  confirmed: "Confirmada",
  closed: "Encerrada",
};

export const bookingInput = z.object({
  name: required(120, "Informe seu nome."),
  company: optionalText(140),
  phone: phoneBR,
  email,
  eventType: z.enum(EVENT_TYPES, { message: "Selecione o tipo de evento." }),
  eventDate: isoDate.refine((v) => v >= todayISO(), "Escolha uma data a partir de hoje."),
  city: required(80, "Informe a cidade."),
  state: uf,
  venue: optionalText(140),
  audience: z
    .union([z.literal(""), z.null(), z.coerce.number().int().min(1, "Público inválido.").max(1_000_000)])
    .optional()
    .transform((v) => (typeof v === "number" ? v : null)),
  message: optionalText(2000),
  consent: z.literal(true, { message: "É preciso concordar com a Política de Privacidade para enviar." }),
  /** honeypot anti-spam: deve vir vazio */
  website: z.string().max(0).optional(),
});
export type BookingInput = z.input<typeof bookingInput>;

export const bookingUpdate = z.object({
  status: z.enum(BOOKING_STATUSES),
});
export const bookingNoteInput = z.object({ body: required(2000, "Escreva a observação.") });

// ---------- Configurações ----------
export const settingsInput = z.object({
  bandName: required(80),
  tagline: required(120),
  heroText: required(400),
  aboutText: required(5000),
  instagram: instagramHandle,
  youtubeUrl: optionalUrl,
  spotifyUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  facebookUrl: optionalUrl,
  whatsapp: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? onlyDigits(v) : null))
    .refine((v) => v === null || /^\d{12,13}$/.test(v), "Use o formato internacional: 55 + DDD + número."),
  whatsappMessage: optionalText(300),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "E-mail inválido."),
  privacyEmail: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "E-mail inválido."),
  /** Quem recebe o aviso de nova solicitação. Vazio = usa o e-mail comercial. Não é exposto no site. */
  notifyEmails: emailList,
  logoId: optionalId,
  heroImageId: optionalId,
  aboutImageId: optionalId,
  ogImageId: optionalId,
  seoTitle: required(70),
  seoDescription: required(200),
  siteUrl: z
    .string()
    .trim()
    .refine((v) => /^https?:\/\/[^\s/]+$/i.test(v.replace(/\/$/, "")), "Informe a URL base, ex.: https://eclipserock.com.br")
    .transform((v) => v.replace(/\/$/, "")),
});
export type SettingsInput = z.input<typeof settingsInput>;

// ---------- Usuários / Auth ----------
export const ROLES = ["admin", "editor"] as const;
export type Role = (typeof ROLES)[number];

export const password = z
  .string()
  .min(10, "A senha precisa ter pelo menos 10 caracteres.")
  .max(200)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letras e números na senha.");

export const loginInput = z.object({
  email,
  password: z.string().min(1, "Informe a senha.").max(200),
});

export const userCreateInput = z.object({
  name: required(80, "Informe o nome."),
  email,
  role: z.enum(ROLES),
  password,
});
export const userUpdateInput = z.object({
  name: required(80, "Informe o nome."),
  role: z.enum(ROLES),
  active: z.boolean(),
  password: z
    .union([z.literal(""), password])
    .optional()
    .transform((v) => (v ? v : undefined)),
});
export const passwordChangeInput = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  newPassword: password,
});

/** Converte erros do zod em { campo: mensagem }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
