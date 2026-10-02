import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { EventItem, PublicSettings } from "../../../../shared/types";
import { InstagramIcon } from "../../components/icons";
import { SectionHeading } from "../../components/SectionHeading";
import { EmptyState } from "../../components/States";
import { instagramUrl } from "../../lib/links";
import { EventRow, NextShowFeature } from "./EventViews";

/** Filtros só aparecem quando há volume que justifique. */
export function EventFilters({
  events,
  value,
  onChange,
}: {
  events: EventItem[];
  value: { city: string; period: string };
  onChange: (v: { city: string; period: string }) => void;
}) {
  const cities = useMemo(() => [...new Set(events.map((e) => `${e.city}/${e.state}`))].sort((a, b) => a.localeCompare(b, "pt-BR")), [events]);
  if (events.length < 6) return null;
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row" role="group" aria-label="Filtrar shows">
      {cities.length > 1 && (
        <label className="sm:w-64">
          <span className="field-label">Cidade</span>
          <select className="input" value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value })}>
            <option value="">Todas as cidades</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="sm:w-64">
        <span className="field-label">Período</span>
        <select className="input" value={value.period} onChange={(e) => onChange({ ...value, period: e.target.value })}>
          <option value="">Todas as datas</option>
          <option value="30">Próximos 30 dias</option>
          <option value="90">Próximos 3 meses</option>
        </select>
      </label>
    </div>
  );
}

export function applyEventFilters(events: EventItem[], f: { city: string; period: string }) {
  const limit = f.period ? new Date(Date.now() + Number(f.period) * 86_400_000).toISOString().slice(0, 10) : null;
  return events.filter((e) => (!f.city || `${e.city}/${e.state}` === f.city) && (!limit || e.date <= limit));
}

export function EventsSection({ events, settings }: { events: EventItem[]; settings: PublicSettings }) {
  const [filters, setFilters] = useState({ city: "", period: "" });
  const next = events.find((e) => e.status !== "cancelled") ?? null;
  const rest = applyEventFilters(
    events.filter((e) => e.id !== next?.id),
    filters,
  );

  return (
    <section id="shows" aria-labelledby="shows-title" className="relative py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet/60 to-transparent" aria-hidden />
      <div className="container-page">
        <SectionHeading
          id="shows-title"
          title="Próximos shows"
          action={
            <Link to="/shows" className="btn btn-ghost self-start md:self-auto">
              Agenda completa e shows anteriores
            </Link>
          }
        />

        {!events.length ? (
          <EmptyState
            title="Nenhuma data anunciada agora"
            actions={
              <>
                {settings.instagram && (
                  <a href={instagramUrl(settings.instagram)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    <InstagramIcon size={19} />
                    Seguir @{settings.instagram}
                  </a>
                )}
                <Link to="/#contrate" className="btn btn-ghost">
                  Levar a banda para o seu evento
                </Link>
              </>
            }
          >
            <p>Os próximos shows aparecem aqui assim que forem confirmados{settings.instagram ? " — e são anunciados no Instagram oficial" : ""}.</p>
          </EmptyState>
        ) : (
          <>
            {next && <NextShowFeature event={next} />}
            {events.length > 1 && (
              <div className="mt-12">
                <h3 className="mb-4 text-sm font-semibold text-mist">Mais datas</h3>
                <EventFilters events={events} value={filters} onChange={setFilters} />
                {rest.length ? (
                  <div className="border-t border-line/70">
                    {rest.map((e) => (
                      <EventRow key={e.id} event={e} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-line p-6 text-mist">Nenhum show encontrado com esses filtros.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
