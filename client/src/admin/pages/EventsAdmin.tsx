import { ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EVENT_STATUSES, eventInput, UFS } from "../../../../shared/schemas";
import type { EventItem, ImageRef } from "../../../../shared/types";
import { Field } from "../../components/Field";
import { useConfirm } from "../../components/Modal";
import { EmptyState, LoadingState } from "../../components/States";
import { useToast } from "../../components/Toast";
import { EventStatusBadge } from "../../features/events/EventStatusBadge";
import { ApiError, apiSend } from "../../lib/api";
import { ADMIN_STATUS_LABEL } from "../../lib/events";
import { formatTime, shortDate } from "../../lib/format";
import { useSeo } from "../../lib/seo";
import { useApi } from "../../lib/useApi";
import { AdminError } from "../AdminError";
import { useAdminForm } from "../useAdminForm";
import { ImageField, PageHeader, PublishedBadge, TableWrap, Toggle } from "../ui";

export function EventsAdmin() {
  const [scope, setScope] = useState<"upcoming" | "past" | "">("upcoming");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const list = useApi<EventItem[]>(`/api/admin/events?scope=${scope}&q=${encodeURIComponent(query)}`);
  const confirm = useConfirm();
  const toast = useToast();
  useSeo("Shows | Painel Eclipse Rock");

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  async function togglePublish(e: EventItem) {
    try {
      const updated = await apiSend<EventItem>("PATCH", `/api/admin/events/${e.id}`, { published: !e.published });
      list.setData((d) => d?.map((x) => (x.id === e.id ? updated : x)));
      toast(updated.published ? "Show publicado no site." : "Show removido do site (rascunho).");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Erro ao salvar.", "error");
    }
  }

  async function remove(e: EventItem) {
    const ok = await confirm({
      title: "Excluir show?",
      message: (
        <>
          <strong className="text-moon">{e.title}</strong> ({shortDate(e.date)}) será excluído definitivamente. Para apenas tirar do site, use
          "Publicado".
        </>
      ),
      confirmLabel: "Excluir show",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiSend("DELETE", `/api/admin/events/${e.id}`);
      list.setData((d) => d?.filter((x) => x.id !== e.id));
      toast("Show excluído.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Erro ao excluir.", "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Shows"
        description="Agenda exibida no site. Só aparecem os shows publicados; datas passadas vão automaticamente para “Shows anteriores”."
        actions={
          <Link to="/admin/shows/novo" className="btn btn-primary btn-sm">
            <Plus size={16} aria-hidden /> Novo show
          </Link>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Período" className="inline-flex rounded-xl border border-line p-1">
          {[
            ["upcoming", "Próximos"],
            ["past", "Anteriores"],
            ["", "Todos"],
          ].map(([v, l]) => (
            <button
              key={v}
              role="tab"
              aria-selected={scope === v}
              onClick={() => setScope(v as typeof scope)}
              className={`min-h-[40px] rounded-lg px-4 text-sm font-medium ${scope === v ? "bg-violet/25 text-moon" : "text-mist hover:text-moon"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <label className="relative sm:w-72">
          <span className="sr-only">Buscar shows</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist" aria-hidden />
          <input className="input pl-9" placeholder="Buscar por nome, local ou cidade" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <AdminError error={list.error} onRetry={list.reload} />
      ) : !list.data?.length ? (
        <EmptyState
          title={query ? "Nada encontrado" : "Nenhum show aqui"}
          actions={
            <Link to="/admin/shows/novo" className="btn btn-primary btn-sm">
              Cadastrar show
            </Link>
          }
        >
          {query ? "Tente outro termo de busca." : "Cadastre um show com data, local e link oficial de ingressos."}
        </EmptyState>
      ) : (
        <TableWrap label="Lista de shows">
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Show</th>
              <th scope="col">Situação</th>
              <th scope="col">No site</th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap">
                  {shortDate(e.date)}
                  {e.time && <span className="block text-mist">{formatTime(e.time)}</span>}
                </td>
                <td>
                  <Link to={`/admin/shows/${e.id}`} className="font-medium hover:text-magenta-soft">
                    {e.title}
                  </Link>
                  <span className="block text-mist">
                    {e.venue} — {e.city}/{e.state}
                  </span>
                </td>
                <td>
                  <EventStatusBadge event={e} />
                </td>
                <td>
                  <Toggle checked={e.published} onChange={() => togglePublish(e)} label={`Publicar ${e.title}`} />
                </td>
                <td className="whitespace-nowrap text-right">
                  {e.published && (
                    <a href={`/shows/${e.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-quiet h-10 w-10 p-0" aria-label={`Ver ${e.title} no site`}>
                      <ExternalLink size={16} aria-hidden />
                    </a>
                  )}
                  <Link to={`/admin/shows/${e.id}`} className="btn btn-quiet h-10 w-10 p-0" aria-label={`Editar ${e.title}`}>
                    <Pencil size={16} aria-hidden />
                  </Link>
                  <button type="button" onClick={() => remove(e)} className="btn btn-quiet h-10 w-10 p-0 text-danger" aria-label={`Excluir ${e.title}`}>
                    <Trash2 size={16} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}

const EMPTY = {
  title: "",
  date: "",
  time: "",
  venue: "",
  city: "",
  state: "",
  address: "",
  mapsUrl: "",
  ticketUrl: "",
  description: "",
  status: "scheduled" as (typeof EVENT_STATUSES)[number],
  imageId: null as number | null,
  published: false,
};

export function EventForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const existing = useApi<EventItem>(isNew ? null : `/api/admin/events/${id}`);
  const form = useAdminForm(EMPTY);
  const [image, setImage] = useState<ImageRef | null>(null);
  useSeo(`${isNew ? "Novo show" : "Editar show"} | Painel Eclipse Rock`);

  useEffect(() => {
    const e = existing.data;
    if (!e) return;
    form.setValues({
      title: e.title,
      date: e.date,
      time: e.time ?? "",
      venue: e.venue,
      city: e.city,
      state: e.state,
      address: e.address ?? "",
      mapsUrl: e.mapsUrl ?? "",
      ticketUrl: e.ticketUrl ?? "",
      description: e.description ?? "",
      status: e.status,
      imageId: e.imageId,
      published: e.published,
    });
    setImage(e.image);
  }, [existing.data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isNew && existing.loading) return <LoadingState />;
  if (!isNew && existing.error) return <AdminError error={existing.error} onRetry={existing.reload} />;

  const v = form.values;
  const e = form.errors;
  const bind = (k: keyof typeof EMPTY) => ({
    className: "input",
    name: k,
    value: (v[k] as string) ?? "",
    onChange: (ev: { target: { value: string } }) => form.set(k, ev.target.value as never),
  });

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const saved = await form.submit(
      eventInput,
      (vals) => (isNew ? apiSend<EventItem>("POST", "/api/admin/events", vals) : apiSend<EventItem>("PUT", `/api/admin/events/${id}`, vals)),
      isNew ? "Show cadastrado." : "Alterações salvas.",
    );
    if (saved) navigate("/admin/shows");
  }

  return (
    <>
      <PageHeader title={isNew ? "Novo show" : "Editar show"} />
      <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="surface grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <Field label="Nome do evento" required error={e.title} className="sm:col-span-2">
            <input {...bind("title")} maxLength={140} />
          </Field>
          <Field label="Data" required error={e.date}>
            <input {...bind("date")} type="date" />
          </Field>
          <Field label="Horário" error={e.time}>
            <input {...bind("time")} type="time" />
          </Field>
          <Field label="Local ou festival" required error={e.venue} className="sm:col-span-2">
            <input {...bind("venue")} maxLength={140} />
          </Field>
          <Field label="Cidade" required error={e.city}>
            <input {...bind("city")} maxLength={80} />
          </Field>
          <Field label="Estado" required error={e.state}>
            <select {...bind("state")}>
              <option value="">UF</option>
              {UFS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
          <Field label="Endereço" error={e.address} className="sm:col-span-2" hint="Confirme o endereço com o local antes de publicar.">
            <input {...bind("address")} maxLength={240} />
          </Field>
          <Field label="Link de localização" error={e.mapsUrl} className="sm:col-span-2" hint="Link do Google Maps. Se vazio, o site monta uma busca com local, endereço e cidade.">
            <input {...bind("mapsUrl")} type="url" inputMode="url" placeholder="https://maps.app.goo.gl/…" />
          </Field>
          <Field label="Link oficial de ingressos" error={e.ticketUrl} className="sm:col-span-2" hint="Ex.: página do evento na Sympla. O botão “Ingressos” só aparece com este link.">
            <input {...bind("ticketUrl")} type="url" inputMode="url" placeholder="https://www.sympla.com.br/evento/…" />
          </Field>
          <Field label="Descrição" error={e.description} className="sm:col-span-2">
            <textarea {...bind("description")} rows={4} maxLength={2000} />
          </Field>
        </div>

        <div className="space-y-6">
          <div className="surface space-y-5 p-5 sm:p-6">
            <Field label="Situação" required error={e.status}>
              <select {...bind("status")}>
                {EVENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ADMIN_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <Toggle checked={v.published} onChange={(p) => form.set("published", p)} label="Publicar no site" showLabel />
              <p className="field-hint">Rascunhos não aparecem para visitantes.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-mist">
              Prévia: <PublishedBadge published={v.published} />
            </div>
          </div>
          <div className="surface p-5 sm:p-6">
            <ImageField
              label="Imagem de divulgação"
              value={image}
              aspect="aspect-[4/5]"
              error={e.imageId}
              onChange={(img) => {
                setImage(img);
                form.set("imageId", img?.id ?? null);
              }}
              hint="Arte oficial do evento (JPG, PNG ou WebP)."
            />
          </div>
          <div className="flex flex-col gap-2">
            <button type="submit" className="btn btn-primary" disabled={form.saving}>
              {form.saving ? "Salvando…" : isNew ? "Cadastrar show" : "Salvar alterações"}
            </button>
            <Link to="/admin/shows" className="btn btn-ghost">
              Cancelar
            </Link>
          </div>
        </div>
      </form>
    </>
  );
}
