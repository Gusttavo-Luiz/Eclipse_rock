import { CalendarDays, Images, Inbox, Mic2, Plus, Video } from "lucide-react";
import { Link } from "react-router-dom";
import { BOOKING_STATUS_LABEL } from "../../../../shared/schemas";
import type { DashboardData } from "../../../../shared/types";
import { LoadingState } from "../../components/States";
import { dateTime, longDate, shortDate } from "../../lib/format";
import { useSeo } from "../../lib/seo";
import { useApi } from "../../lib/useApi";
import { AdminError } from "../AdminError";
import { useAuth } from "../auth";
import { PageHeader } from "../ui";
import { BookingStatusBadge } from "./BookingsAdmin";

const ENTITY_LABEL: Record<string, string> = {
  event: "Show",
  member: "Integrante",
  gallery: "Galeria",
  video: "Vídeo",
  booking: "Solicitação",
  settings: "Configurações",
  user: "Usuário",
  upload: "Imagem",
};
const ACTION_LABEL: Record<string, string> = {
  create: "criou",
  update: "atualizou",
  delete: "excluiu",
  status: "alterou status",
  note: "comentou",
  upload: "enviou",
  notify: "reenviou o aviso da",
  notify_failed: "não conseguiu avisar por e-mail sobre a",
  test_email: "testou o e-mail em",
};

export function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<DashboardData>("/api/admin/dashboard");
  useSeo("Visão geral | Painel Eclipse Rock");

  if (loading) return <LoadingState />;
  if (error || !data) return <AdminError error={error!} onRetry={reload} />;

  const stats = [
    { label: "Shows futuros publicados", value: data.upcomingEvents, to: "/admin/shows", Icon: CalendarDays },
    { label: "Solicitações novas", value: data.bookingsNew, to: "/admin/solicitacoes?status=new", Icon: Inbox, hl: data.bookingsNew > 0 },
    { label: "Solicitações em aberto", value: data.bookingsOpen, to: "/admin/solicitacoes?status=open", Icon: Inbox },
    { label: "Total de solicitações", value: data.bookingsTotal, to: "/admin/solicitacoes", Icon: Inbox },
  ];

  return (
    <>
      <PageHeader
        title={`Olá, ${user?.name.split(" ")[0]}`}
        description="Resumo do que está publicado e do que precisa de atenção."
        actions={
          <Link to="/admin/shows/novo" className="btn btn-primary btn-sm">
            <Plus size={16} aria-hidden />
            Novo show
          </Link>
        }
      />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label}>
            <Link to={s.to} className={`surface block h-full p-4 transition-colors hover:border-violet/60 sm:p-5 ${s.hl ? "border-magenta/60" : ""}`}>
              <s.Icon size={18} className="text-mist" aria-hidden />
              <p className="mt-3 font-display text-5xl font-extrabold leading-none">{s.value}</p>
              <p className="mt-1 text-sm text-mist">{s.label}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="surface p-5 sm:p-6" aria-labelledby="next-title">
          <h2 id="next-title" className="font-semibold">
            Próximo show no site
          </h2>
          {data.nextEvent ? (
            <div className="mt-4">
              <p className="font-display text-3xl font-extrabold uppercase leading-tight">{data.nextEvent.title}</p>
              <p className="mt-1 text-mist first-letter:uppercase">
                {longDate(data.nextEvent.date)} — {data.nextEvent.venue}, {data.nextEvent.city}/{data.nextEvent.state}
              </p>
              {!data.nextEvent.ticketUrl && <p className="mt-3 text-sm text-warn">Sem link de ingressos cadastrado.</p>}
              <Link to={`/admin/shows/${data.nextEvent.id}`} className="btn btn-ghost btn-sm mt-4">
                Editar show
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-mist">
              Nenhum show futuro publicado. O site mostra uma mensagem de agenda vazia com link para o Instagram.{" "}
              <Link to="/admin/shows/novo" className="text-violet-soft underline">
                Cadastrar show
              </Link>
            </p>
          )}

          <h3 className="mt-8 text-sm font-semibold text-mist">Conteúdo publicado</h3>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[
              { l: "Shows", v: data.published.events, Icon: CalendarDays },
              { l: "Integrantes", v: data.published.members, Icon: Mic2 },
              { l: "Fotos", v: data.published.gallery, Icon: Images },
              { l: "Vídeos", v: data.published.videos, Icon: Video },
            ].map((x) => (
              <li key={x.l} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
                <x.Icon size={16} className="text-mist" aria-hidden />
                <span className="font-semibold">{x.v}</span>
                <span className="text-mist">{x.l}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface p-5 sm:p-6" aria-labelledby="recent-bookings">
          <div className="flex items-center justify-between">
            <h2 id="recent-bookings" className="font-semibold">
              Solicitações recentes
            </h2>
            <Link to="/admin/solicitacoes" className="text-sm text-violet-soft hover:underline">
              Ver todas
            </Link>
          </div>
          {data.recentBookings.length ? (
            <ul className="mt-3 divide-y divide-line/60">
              {data.recentBookings.map((b) => (
                <li key={b.id}>
                  <Link to={`/admin/solicitacoes/${b.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:text-magenta-soft">
                    <span>
                      <span className="font-medium">{b.name}</span>
                      <span className="block text-sm text-mist">
                        {b.eventType} · {shortDate(b.eventDate)} · {b.city}/{b.state}
                      </span>
                    </span>
                    <BookingStatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-mist">Nenhuma solicitação recebida ainda. Elas chegam pelo formulário "Contrate a banda".</p>
          )}
        </section>
      </div>

      <section className="surface mt-6 p-5 sm:p-6" aria-labelledby="activity">
        <h2 id="activity" className="font-semibold">
          Atividade recente
        </h2>
        {data.recentActivity.length ? (
          <ul className="mt-3 divide-y divide-line/60 text-sm">
            {data.recentActivity.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                <span>
                  <span className="font-medium">{a.userName ?? "Site"}</span> {ACTION_LABEL[a.action] ?? a.action}{" "}
                  <span className="text-mist">{ENTITY_LABEL[a.entity] ?? a.entity}</span>
                  {a.summary && <span className="text-mist"> — {a.summary.replace(/^Status: (\w+)$/, (_m, s) => `Status: ${BOOKING_STATUS_LABEL[s as keyof typeof BOOKING_STATUS_LABEL] ?? s}`)}</span>}
                </span>
                <time className="text-mist" dateTime={a.createdAt}>
                  {dateTime(a.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-mist">Nenhuma atividade registrada.</p>
        )}
      </section>
    </>
  );
}
