import { ArrowLeft, Clock, MapPin } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { EventItem } from "../../../shared/types";
import { Img } from "../components/Img";
import { ErrorState, LoadingState } from "../components/States";
import { EventStatusBadge } from "../features/events/EventStatusBadge";
import { EventActions } from "../features/events/EventViews";
import { formatTime, longDate, parts } from "../lib/format";
import { useSeo } from "../lib/seo";
import { useApi } from "../lib/useApi";
import { NotFoundPage } from "./NotFoundPage";

export function EventPage() {
  const { slug } = useParams();
  const { data: e, error, loading, reload } = useApi<EventItem>(`/api/public/events/${encodeURIComponent(slug ?? "")}`);
  useSeo(e ? `${e.title} — ${longDate(e.date)} | Eclipse Rock` : undefined);

  if (loading) return <LoadingState className="min-h-[70svh] pt-24" />;
  if (error?.status === 404) return <NotFoundPage message="Este show não existe ou não está mais publicado." />;
  if (error || !e)
    return (
      <div className="container-page pb-24 pt-32">
        <ErrorState message={error?.message ?? "Erro ao carregar."} onRetry={reload} />
      </div>
    );

  const p = parts(e.date);
  return (
    <article className="pb-24">
      <div className="relative overflow-hidden pt-28 sm:pt-36">
        <div className="starfield pointer-events-none absolute inset-0 -z-10 opacity-60" aria-hidden />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_20%,rgb(123_63_228/0.3),transparent_55%)]" />
        <div className="container-page">
          <Link to="/shows" className="btn btn-quiet -ml-3 text-mist">
            <ArrowLeft size={18} aria-hidden />
            Agenda
          </Link>
          <div className="mt-6 grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <EventStatusBadge event={e} />
                {e.status === "cancelled" && <span className="text-sm text-danger">Este evento foi cancelado.</span>}
              </div>
              <h1 className="display mt-5 text-[clamp(3rem,9vw,6.5rem)]">{e.title}</h1>
              <dl className="mt-8 grid gap-4 text-lg">
                <div className="flex gap-3">
                  <dt className="sr-only">Data e horário</dt>
                  <Clock className="mt-1 shrink-0 text-magenta-soft" size={22} aria-hidden />
                  <dd className="first-letter:uppercase">
                    {longDate(e.date)}
                    {e.time && <span className="text-mist"> · {formatTime(e.time)}</span>}
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="sr-only">Local</dt>
                  <MapPin className="mt-1 shrink-0 text-magenta-soft" size={22} aria-hidden />
                  <dd>
                    {e.venue}
                    <span className="block text-base text-mist">
                      {e.address ? `${e.address} — ` : ""}
                      {e.city}/{e.state}
                    </span>
                  </dd>
                </div>
              </dl>
              {e.description && <p className="mt-8 max-w-[62ch] whitespace-pre-line text-moon/85">{e.description}</p>}
              <div className="mt-10">
                <EventActions event={e} />
              </div>
              {!e.ticketUrl && !e.isPast && e.status !== "cancelled" && (
                <p className="mt-4 text-sm text-mist">Informações de ingresso serão divulgadas pelos canais oficiais.</p>
              )}
            </div>

            <div>
              {e.image ? (
                <Img image={e.image} alt={`Divulgação: ${e.title}`} sizes="(min-width: 1024px) 480px, 100vw" priority className="w-full rounded-[var(--radius-panel)] border border-line" />
              ) : (
                <div className="surface flex aspect-square items-end p-8" aria-hidden>
                  <p className="display text-[9rem] leading-[0.8]">
                    {p.day}
                    <span className="block text-6xl text-magenta-soft">
                      {p.month} {p.year}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
