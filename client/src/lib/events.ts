import type { EventStatus } from "../../../shared/schemas";
import type { EventItem } from "../../../shared/types";

export type DisplayStatus = "past" | "cancelled" | "sold_out" | "on_sale" | "scheduled";

export function displayStatus(e: Pick<EventItem, "status" | "isPast">): DisplayStatus {
  if (e.status === "cancelled") return "cancelled";
  if (e.isPast) return "past";
  return e.status as Exclude<EventStatus, "cancelled">;
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  past: "Realizado",
  cancelled: "Cancelado",
  sold_out: "Esgotado",
  on_sale: "Ingressos à venda",
  scheduled: "Confirmado",
};

export const ADMIN_STATUS_LABEL: Record<EventStatus, string> = {
  scheduled: "Confirmado (sem venda ativa)",
  on_sale: "Ingressos à venda",
  sold_out: "Esgotado",
  cancelled: "Cancelado",
};

/** Ingressos só fazem sentido para eventos futuros, não cancelados nem esgotados, com link oficial. */
export const canBuyTickets = (e: EventItem) => !!e.ticketUrl && !e.isPast && (e.status === "on_sale" || e.status === "scheduled");
