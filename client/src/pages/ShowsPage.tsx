import { useState } from "react";
import { Link } from "react-router-dom";
import type { EventItem } from "../../../shared/types";
import { ErrorState, LoadingState, EmptyState } from "../components/States";
import { applyEventFilters, EventFilters } from "../features/events/EventsSection";
import { EventRow } from "../features/events/EventViews";
import { useSeo } from "../lib/seo";
import { useSite } from "../lib/site";
import { useApi } from "../lib/useApi";

export function ShowsPage() {
  const site = useSite();
  const upcoming = useApi<EventItem[]>("/api/public/events?scope=upcoming");
  const past = useApi<EventItem[]>("/api/public/events?scope=past");
  const [filters, setFilters] = useState({ city: "", period: "" });
  const band = site.data?.settings.bandName ?? "Eclipse Rock";
  useSeo(`Agenda de shows | ${band}`, `Próximos shows e apresentações anteriores da ${band}.`);

  return (
    <div className="container-page pb-24 pt-32 sm:pt-40">
      <h1 className="display text-[clamp(3.5rem,11vw,7.5rem)]">Agenda</h1>

      <section aria-labelledby="proximos" className="mt-12">
        <h2 id="proximos" className="mb-6 font-display text-3xl font-extrabold uppercase sm:text-4xl">
          Próximos shows
        </h2>
        {upcoming.loading ? (
          <LoadingState />
        ) : upcoming.error ? (
          <ErrorState message={upcoming.error.message} onRetry={upcoming.reload} />
        ) : !upcoming.data?.length ? (
          <EmptyState
            title="Sem datas anunciadas"
            actions={
              <Link to="/#contrate" className="btn btn-ghost">
                Levar a banda para o seu evento
              </Link>
            }
          >
            <p>Assim que um show for confirmado, ele aparece aqui com local e link oficial de ingressos.</p>
          </EmptyState>
        ) : (
          <>
            <EventFilters events={upcoming.data} value={filters} onChange={setFilters} />
            <div className="border-t border-line/70">
              {applyEventFilters(upcoming.data, filters).map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          </>
        )}
      </section>

      {(past.loading || past.error || !!past.data?.length) && (
        <section aria-labelledby="anteriores" className="mt-20">
          <h2 id="anteriores" className="mb-6 font-display text-3xl font-extrabold uppercase text-mist sm:text-4xl">
            Shows anteriores
          </h2>
          {past.loading ? (
            <LoadingState />
          ) : past.error ? (
            <ErrorState message={past.error.message} onRetry={past.reload} />
          ) : (
            <div className="border-t border-line/70">
              {past.data!.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
