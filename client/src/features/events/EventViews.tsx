import { Clock, MapPin, Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import type { EventItem } from "../../../../shared/types";
import { Img } from "../../components/Img";
import { ShareButton } from "../../components/ShareButton";
import { canBuyTickets } from "../../lib/events";
import { formatTime, longDate, parts } from "../../lib/format";
import { mapsUrl } from "../../lib/links";
import { EventStatusBadge } from "./EventStatusBadge";

const eventUrl = (e: EventItem) => `${window.location.origin}/shows/${e.slug}`;

export function EventActions({ event, size = "md" }: { event: EventItem; size?: "md" | "sm" }) {
  const sm = size === "sm" ? "btn-sm" : "";
  return (
    <div className="flex flex-wrap gap-2">
      {canBuyTickets(event) && (
        <a href={event.ticketUrl!} target="_blank" rel="noopener noreferrer" className={`btn btn-primary ${sm}`}>
          <Ticket size={18} aria-hidden />
          Ingressos
          <span className="sr-only">para {event.title} (abre o site oficial de vendas em nova aba)</span>
        </a>
      )}
      {!event.isPast && event.status !== "cancelled" && (
        <a href={mapsUrl(event)} target="_blank" rel="noopener noreferrer" className={`btn btn-ghost ${sm}`}>
          <MapPin size={18} aria-hidden />
          Como chegar
          <span className="sr-only">até {event.venue} (abre o mapa em nova aba)</span>
        </a>
      )}
      <ShareButton
        title={`${event.title} — Eclipse Rock`}
        text={`Eclipse Rock em ${event.venue}, ${event.city}/${event.state} — ${longDate(event.date)}`}
        url={eventUrl(event)}
        className={`btn btn-ghost ${sm}`}
      />
    </div>
  );
}

/** Destaque do próximo show confirmado. */
export function NextShowFeature({ event }: { event: EventItem }) {
  const p = parts(event.date);
  return (
    <article className="surface relative grid overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" aria-labelledby={`next-${event.id}`}>
      <div className="relative min-h-[220px] bg-night">
        {event.image ? (
          <Img image={event.image} alt={`Divulgação: ${event.title}`} sizes="(min-width: 768px) 560px, 100vw" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="starfield absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgb(224_53_155/0.35),transparent_60%)]" aria-hidden />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/30 to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-night/80" />
        <div className="absolute bottom-4 left-5 md:bottom-6 md:left-6">
          <p className="text-sm font-semibold capitalize text-moon/90">{p.weekday}</p>
          <p className="display text-[5.5rem] leading-[0.8] sm:text-[7rem]">
            {p.day}
            <span className="ml-2 align-top text-4xl text-magenta-soft sm:text-5xl">{p.month}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-violet-soft">Próximo show</span>
          <EventStatusBadge event={event} />
        </div>
        <h3 id={`next-${event.id}`} className="font-display text-4xl font-extrabold uppercase leading-[0.95] sm:text-5xl">
          <Link to={`/shows/${event.slug}`} className="hover:text-magenta-soft">
            {event.title}
          </Link>
        </h3>
        <dl className="grid gap-2 text-moon/85">
          <div className="flex items-start gap-2">
            <dt className="sr-only">Local</dt>
            <MapPin size={18} className="mt-1 shrink-0 text-mist" aria-hidden />
            <dd>
              {event.venue} — {event.city}/{event.state}
              {event.address && <span className="block text-sm text-mist">{event.address}</span>}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Data e horário</dt>
            <Clock size={18} className="shrink-0 text-mist" aria-hidden />
            <dd className="first-letter:uppercase">
              {longDate(event.date)}
              {event.time && ` · ${formatTime(event.time)}`}
            </dd>
          </div>
        </dl>
        <EventActions event={event} />
      </div>
    </article>
  );
}

/** Linha da agenda, no formato de cartaz de turnê. */
export function EventRow({ event }: { event: EventItem }) {
  const p = parts(event.date);
  const muted = event.isPast || event.status === "cancelled";
  return (
    <article
      className={`grid grid-cols-[72px_minmax(0,1fr)] gap-x-4 gap-y-4 border-b border-line/70 py-6 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-center sm:gap-x-6 ${
        muted ? "[&_h3]:text-moon/75" : ""
      }`}
    >
      <div className="text-center leading-none" aria-hidden>
        <p className={`display text-5xl sm:text-6xl ${event.status === "cancelled" ? "line-through decoration-danger/70" : ""}`}>{p.day}</p>
        <p className="mt-1 font-display text-lg font-extrabold uppercase text-magenta-soft">
          {p.month}
          {event.isPast && <span className="ml-1 text-mist">{String(p.year).slice(2)}</span>}
        </p>
      </div>
      <div className="min-w-0">
        <p className="sr-only">{longDate(event.date)}</p>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <EventStatusBadge event={event} />
          {event.time && <span className="text-sm text-mist">{formatTime(event.time)}</span>}
        </div>
        <h3 className="font-display text-2xl font-extrabold uppercase leading-tight sm:text-3xl">
          <Link to={`/shows/${event.slug}`} className="hover:text-magenta-soft">
            {event.title}
          </Link>
        </h3>
        <p className="text-moon/80">
          {event.venue} — {event.city}/{event.state}
        </p>
      </div>
      <div className="col-span-2 sm:col-span-1">
        {event.isPast ? (
          <Link to={`/shows/${event.slug}`} className="btn btn-quiet btn-sm text-violet-soft">
            Ver detalhes
          </Link>
        ) : (
          <EventActions event={event} size="sm" />
        )}
      </div>
    </article>
  );
}
