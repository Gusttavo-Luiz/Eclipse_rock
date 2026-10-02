import { Ban, CalendarCheck, CheckCircle2, History, Ticket } from "lucide-react";
import type { EventItem } from "../../../../shared/types";
import { displayStatus, STATUS_LABEL, type DisplayStatus } from "../../lib/events";

const STYLE: Record<DisplayStatus, { cls: string; Icon: typeof Ticket }> = {
  on_sale: { cls: "border-ok/50 bg-ok/10 text-ok", Icon: Ticket },
  scheduled: { cls: "border-glow/50 bg-glow/10 text-[#9db8ff]", Icon: CalendarCheck },
  sold_out: { cls: "border-warn/50 bg-warn/10 text-warn", Icon: CheckCircle2 },
  cancelled: { cls: "border-danger/50 bg-danger/10 text-danger", Icon: Ban },
  past: { cls: "border-mist/40 bg-mist/10 text-mist", Icon: History },
};

/** Estado do evento: sempre ícone + texto (não depende só da cor). */
export function EventStatusBadge({ event, className = "" }: { event: Pick<EventItem, "status" | "isPast">; className?: string }) {
  const s = displayStatus(event);
  const { cls, Icon } = STYLE[s];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${cls} ${className}`}>
      <Icon size={14} aria-hidden />
      {STATUS_LABEL[s]}
    </span>
  );
}
