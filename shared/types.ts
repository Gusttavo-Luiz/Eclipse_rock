/** Tipos das respostas da API, compartilhados entre cliente e servidor. */
import type { BookingStatus, EventStatus, Role } from "./schemas";

export const TIMEZONE = "America/Sao_Paulo";

/** Data de hoje (YYYY-MM-DD) no fuso da banda. */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export interface ImageRef {
  id: number;
  width: number;
  height: number;
  /** maior variante disponível */
  src: string;
  /** "url 480w, url 960w, ..." */
  srcset: string;
}

export interface PublicSettings {
  bandName: string;
  tagline: string;
  heroText: string;
  aboutText: string;
  instagram: string | null;
  youtubeUrl: string | null;
  spotifyUrl: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  whatsapp: string | null;
  whatsappMessage: string | null;
  contactEmail: string | null;
  privacyEmail: string | null;
  logo: ImageRef | null;
  heroImage: ImageRef | null;
  aboutImage: ImageRef | null;
  ogImage: ImageRef | null;
  seoTitle: string;
  seoDescription: string;
  siteUrl: string;
}

export interface MailStatus {
  /** Provedor configurado no servidor (variáveis de ambiente) ou null se o envio estiver desligado. */
  provider: "resend" | "smtp" | "test" | null;
  from: string | null;
  /** Destinatários efetivos do aviso: notifyEmails ou, se vazio, o e-mail comercial. */
  recipients: string[];
}

export interface AdminSettings extends PublicSettings {
  /** Destinatários do aviso de nova solicitação (somente painel). */
  notifyEmails: string[];
  mail: MailStatus;
  logoId: number | null;
  heroImageId: number | null;
  aboutImageId: number | null;
  ogImageId: number | null;
}

export interface BandMember {
  id: number;
  name: string;
  role: string | null;
  instagram: string | null;
  /** Sigla do card sem foto (null = iniciais do nome). */
  monogram: string | null;
  photo: ImageRef | null;
  photoId: number | null;
  sortOrder: number;
  published: boolean;
}

export interface EventItem {
  id: number;
  slug: string;
  title: string;
  date: string;
  time: string | null;
  venue: string;
  city: string;
  state: string;
  address: string | null;
  mapsUrl: string | null;
  ticketUrl: string | null;
  description: string | null;
  status: EventStatus;
  image: ImageRef | null;
  imageId: number | null;
  published: boolean;
  isPast: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryImage {
  id: number;
  uploadId: number;
  image: ImageRef;
  alt: string;
  caption: string | null;
  category: string | null;
  eventId: number | null;
  eventTitle: string | null;
  sortOrder: number;
  published: boolean;
}

export interface VideoItem {
  id: number;
  title: string;
  description: string | null;
  url: string;
  youtubeId: string;
  thumbnail: ImageRef | null;
  thumbnailId: number | null;
  category: string | null;
  eventId: number | null;
  eventTitle: string | null;
  sortOrder: number;
  published: boolean;
}

export interface BookingRequest {
  id: number;
  name: string;
  company: string | null;
  phone: string;
  email: string;
  eventType: string;
  eventDate: string;
  city: string;
  state: string;
  venue: string | null;
  audience: number | null;
  message: string | null;
  status: BookingStatus;
  /** Resultado do aviso por e-mail à equipe. null = ainda não processado. */
  notification: { status: NotifyStatus; detail: string | null; at: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** sent = enviado; failed = o provedor recusou ou não respondeu; skipped = envio não configurado. */
export type NotifyStatus = "sent" | "failed" | "skipped";

export interface BookingNote {
  id: number;
  body: string;
  authorName: string | null;
  createdAt: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  /** Criado por convite e ainda sem senha definida. */
  invitePending: boolean;
  /** Validade do convite mais recente ainda não usado (null se não houver). */
  inviteExpiresAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardData {
  upcomingEvents: number;
  totalEvents: number;
  nextEvent: EventItem | null;
  bookingsTotal: number;
  bookingsNew: number;
  bookingsOpen: number;
  published: { events: number; members: number; gallery: number; videos: number };
  recentBookings: BookingRequest[];
  recentActivity: AuditEntry[];
}

export interface AuditEntry {
  id: number;
  action: string;
  entity: string;
  entityId: number | null;
  userName: string | null;
  summary: string | null;
  createdAt: string;
}

export interface ApiErrorBody {
  error: string;
  fields?: Record<string, string>;
}
