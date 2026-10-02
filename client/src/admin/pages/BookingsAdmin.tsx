import { ArrowLeft, Mail, RefreshCw, Search, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BOOKING_STATUSES, BOOKING_STATUS_LABEL, type BookingStatus } from "../../../../shared/schemas";
import type { BookingNote, BookingRequest, Paginated } from "../../../../shared/types";
import { WhatsAppIcon } from "../../components/icons";
import { useConfirm } from "../../components/Modal";
import { EmptyState, LoadingState } from "../../components/States";
import { useToast } from "../../components/Toast";
import { ApiError, apiSend } from "../../lib/api";
import { dateTime, formatPhone, longDate, shortDate } from "../../lib/format";
import { whatsappUrl } from "../../lib/links";
import { useSeo } from "../../lib/seo";
import { useApi } from "../../lib/useApi";
import { AdminError } from "../AdminError";
import { useAuth } from "../auth";
import { PageHeader, Pagination, TableWrap } from "../ui";

const STATUS_CLS: Record<BookingStatus, string> = {
  new: "border-magenta/50 bg-magenta/15 text-magenta-soft",
  in_progress: "border-glow/50 bg-glow/10 text-[#9db8ff]",
  proposal_sent: "border-violet/50 bg-violet/15 text-violet-soft",
  confirmed: "border-ok/50 bg-ok/10 text-ok",
  closed: "border-mist/40 bg-mist/10 text-mist",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLS[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {BOOKING_STATUS_LABEL[status]}
    </span>
  );
}

export function BookingsAdmin() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const page = Number(params.get("page") ?? 1) || 1;
  const [q, setQ] = useState(params.get("q") ?? "");
  const list = useApi<Paginated<BookingRequest>>(
    `/api/admin/bookings?status=${encodeURIComponent(status)}&page=${page}&q=${encodeURIComponent(params.get("q") ?? "")}`,
  );
  useSeo("Solicitações | Painel Eclipse Rock");

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q.trim()) update({ q: q.trim() });
    }, 350);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader title="Solicitações" description="Pedidos de contratação recebidos pelo formulário do site." />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar solicitações</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist" aria-hidden />
          <input className="input pl-9" placeholder="Nome, e-mail, telefone, empresa ou cidade" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="sm:w-60">
          <span className="sr-only">Filtrar por status</span>
          <select className="input" value={status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">Todos os status</option>
            <option value="open">Em aberto (nova, atendimento, proposta)</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BOOKING_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <AdminError error={list.error} onRetry={list.reload} />
      ) : !list.data?.items.length ? (
        <EmptyState title={status || params.get("q") ? "Nada encontrado" : "Nenhuma solicitação"}>
          {status || params.get("q") ? "Ajuste a busca ou o filtro." : "Quando alguém enviar o formulário “Contrate a banda”, a solicitação aparece aqui."}
        </EmptyState>
      ) : (
        <>
          <TableWrap label="Solicitações de contratação">
            <thead>
              <tr>
                <th scope="col">Recebida</th>
                <th scope="col">Contratante</th>
                <th scope="col">Evento</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((b) => (
                <tr key={b.id} className={b.status === "new" ? "bg-magenta/[0.04]" : ""}>
                  <td className="whitespace-nowrap text-mist">{dateTime(b.createdAt)}</td>
                  <td>
                    <Link to={`/admin/solicitacoes/${b.id}`} className="font-medium hover:text-magenta-soft">
                      {b.name}
                    </Link>
                    {b.company && <span className="block text-mist">{b.company}</span>}
                  </td>
                  <td>
                    {b.eventType}
                    <span className="block text-mist">
                      {shortDate(b.eventDate)} · {b.city}/{b.state}
                    </span>
                  </td>
                  <td>
                    <BookingStatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => update({ page: String(p) })} />
        </>
      )}
    </>
  );
}

export function BookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const res = useApi<{ booking: BookingRequest; notes: BookingNote[] }>(`/api/admin/bookings/${id}`);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  useSeo("Solicitação | Painel Eclipse Rock");

  if (res.loading) return <LoadingState />;
  if (res.error || !res.data) return <AdminError error={res.error!} onRetry={res.reload} />;
  const { booking: b, notes } = res.data;

  async function changeStatus(status: BookingStatus) {
    const previous = b.status;
    res.setData((d) => d && { ...d, booking: { ...d.booking, status } }); // atualização otimista
    try {
      const updated = await apiSend<BookingRequest>("PATCH", `/api/admin/bookings/${b.id}`, { status });
      res.setData((d) => d && { ...d, booking: updated });
      toast(`Status alterado para “${BOOKING_STATUS_LABEL[status]}”.`);
    } catch (e) {
      res.setData((d) => d && { ...d, booking: { ...d.booking, status: previous } });
      toast(e instanceof ApiError ? e.message : "Erro ao salvar.", "error");
    }
  }

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!note.trim() || busy) return;
    setBusy(true);
    try {
      const updated = await apiSend<BookingNote[]>("POST", `/api/admin/bookings/${b.id}/notes`, { body: note });
      res.setData((d) => d && { ...d, notes: updated });
      setNote("");
      toast("Observação registrada.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Erro ao salvar.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function resendNotice() {
    if (resending) return;
    setResending(true);
    try {
      const updated = await apiSend<BookingRequest>("POST", `/api/admin/bookings/${b.id}/notify`);
      res.setData((d) => d && { ...d, booking: updated });
      const st = updated.notification?.status;
      toast(st === "sent" ? "Aviso reenviado por e-mail." : updated.notification?.detail ?? "Não foi possível enviar o aviso.", st === "sent" ? "success" : "error");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Erro ao reenviar.", "error");
    } finally {
      setResending(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Excluir solicitação?",
      message: "Os dados do contratante e as observações serão apagados definitivamente. Use em pedidos de exclusão de dados (LGPD).",
      confirmLabel: "Excluir definitivamente",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiSend("DELETE", `/api/admin/bookings/${b.id}`);
      toast("Solicitação excluída.");
      navigate("/admin/solicitacoes");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Erro ao excluir.", "error");
    }
  }

  const waMsg = `Olá, ${b.name.split(" ")[0]}! Aqui é da Eclipse Rock, sobre a sua solicitação para ${b.eventType.toLowerCase()} em ${shortDate(b.eventDate)}.`;
  const rows: [string, React.ReactNode][] = [
    ["Telefone / WhatsApp", formatPhone(b.phone)],
    ["E-mail", b.email],
    ["Empresa ou evento", b.company ?? "—"],
    ["Tipo de evento", b.eventType],
    ["Data prevista", <span className="first-letter:uppercase">{longDate(b.eventDate)}</span>],
    ["Cidade", `${b.city}/${b.state}`],
    ["Local", b.venue ?? "—"],
    ["Público estimado", b.audience ? b.audience.toLocaleString("pt-BR") : "—"],
  ];

  return (
    <>
      <Link to="/admin/solicitacoes" className="btn btn-quiet -ml-3 mb-4 text-mist">
        <ArrowLeft size={18} aria-hidden /> Solicitações
      </Link>
      <PageHeader title={b.name} description={`Recebida em ${dateTime(b.createdAt)} · atualizada em ${dateTime(b.updatedAt)}`} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="surface p-5 sm:p-6" aria-labelledby="dados">
            <h2 id="dados" className="mb-4 font-semibold">
              Dados do contratante
            </h2>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-mist">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
            </dl>
            {b.message && (
              <div className="mt-5 border-t border-line pt-5">
                <h3 className="text-sm text-mist">Mensagem</h3>
                <p className="mt-1 whitespace-pre-line">{b.message}</p>
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <a href={whatsappUrl("55" + b.phone, waMsg)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                <WhatsAppIcon size={16} /> Responder no WhatsApp
              </a>
              <a href={`mailto:${b.email}?subject=${encodeURIComponent("Eclipse Rock — sua solicitação de show")}`} className="btn btn-ghost btn-sm">
                <Mail size={16} aria-hidden /> Responder por e-mail
              </a>
            </div>
          </section>

          <section className="surface p-5 sm:p-6" aria-labelledby="obs">
            <h2 id="obs" className="font-semibold">
              Observações internas
            </h2>
            <p className="text-sm text-mist">Visíveis apenas para a equipe.</p>
            <form onSubmit={addNote} className="mt-4 space-y-3">
              <label htmlFor="note" className="sr-only">
                Nova observação
              </label>
              <textarea id="note" className="input" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: proposta enviada por e-mail, aguardando retorno." />
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !note.trim()}>
                {busy ? "Salvando…" : "Adicionar observação"}
              </button>
            </form>
            {notes.length > 0 && (
              <ul className="mt-6 space-y-4">
                {notes.map((n) => (
                  <li key={n.id} className="border-l-2 border-violet/60 pl-4">
                    <p className="whitespace-pre-line">{n.body}</p>
                    <p className="mt-1 text-xs text-mist">
                      {n.authorName ?? "Usuário removido"} · {dateTime(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="surface p-5 sm:p-6" aria-labelledby="st">
            <h2 id="st" className="font-semibold">
              Status
            </h2>
            <div className="mt-3">
              <BookingStatusBadge status={b.status} />
            </div>
            <fieldset className="mt-4 space-y-1">
              <legend className="sr-only">Alterar status</legend>
              {BOOKING_STATUSES.map((s) => (
                <label key={s} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-moon/5">
                  <input type="radio" name="status" checked={b.status === s} onChange={() => changeStatus(s)} className="h-4 w-4 accent-[#E0359B]" />
                  {BOOKING_STATUS_LABEL[s]}
                </label>
              ))}
            </fieldset>
          </section>
          <section className="surface p-5 sm:p-6" aria-labelledby="aviso">
            <h2 id="aviso" className="font-semibold">
              Aviso por e-mail
            </h2>
            <p className="mt-2 text-sm" role="status">
              {!b.notification ? (
                <span className="text-mist">Sem registro de envio.</span>
              ) : b.notification.status === "sent" ? (
                <span className="text-ok">Enviado em {dateTime(b.notification.at)}.</span>
              ) : b.notification.status === "failed" ? (
                <span className="text-danger">Falhou em {dateTime(b.notification.at)}.</span>
              ) : (
                <span className="text-mist">Não enviado.</span>
              )}
            </p>
            {b.notification?.detail && <p className="mt-1 break-words text-xs text-mist">{b.notification.detail}</p>}
            {b.notification?.status !== "sent" && (
              <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={resendNotice} disabled={resending}>
                <RefreshCw size={16} aria-hidden /> {resending ? "Enviando…" : "Tentar enviar de novo"}
              </button>
            )}
          </section>
          {user?.role === "admin" && (
            <button type="button" className="btn btn-danger btn-sm w-full" onClick={remove}>
              <Trash2 size={16} aria-hidden /> Excluir solicitação
            </button>
          )}
        </aside>
      </div>
    </>
  );
}
