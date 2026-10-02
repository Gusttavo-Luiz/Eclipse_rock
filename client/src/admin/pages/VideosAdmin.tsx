import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { videoInput, youtubeId } from "../../../../shared/schemas";
import type { EventItem, ImageRef, VideoItem } from "../../../../shared/types";
import { Field } from "../../components/Field";
import { Modal, useConfirm } from "../../components/Modal";
import { EmptyState, LoadingState } from "../../components/States";
import { useToast } from "../../components/Toast";
import { ApiError, apiSend } from "../../lib/api";
import { shortDate } from "../../lib/format";
import { useSeo } from "../../lib/seo";
import { useApi } from "../../lib/useApi";
import { AdminError } from "../AdminError";
import { useAdminForm } from "../useAdminForm";
import { ImageField, PageHeader, PublishedBadge, Toggle } from "../ui";
import { moveItem } from "./MembersAdmin";

const thumbOf = (v: Pick<VideoItem, "thumbnail" | "youtubeId">) => v.thumbnail?.src ?? `https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`;

export function VideosAdmin() {
  const list = useApi<VideoItem[]>("/api/admin/videos");
  const events = useApi<EventItem[]>("/api/admin/events?scope=");
  const [editing, setEditing] = useState<VideoItem | "new" | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  useSeo("Vídeos | Painel Eclipse Rock");

  async function toggle(v: VideoItem) {
    try {
      await apiSend("PATCH", `/api/admin/videos/${v.id}`, { published: !v.published });
      list.setData((d) => d?.map((x) => (x.id === v.id ? { ...x, published: !v.published } : x)));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erro ao salvar.", "error");
    }
  }
  async function remove(v: VideoItem) {
    if (!(await confirm({ title: "Excluir vídeo?", message: `“${v.title}” sai do site. O vídeo continua no YouTube.`, confirmLabel: "Excluir", danger: true }))) return;
    try {
      await apiSend("DELETE", `/api/admin/videos/${v.id}`);
      list.setData((d) => d?.filter((x) => x.id !== v.id));
      toast("Vídeo excluído.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erro ao excluir.", "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Vídeos"
        description="Cadastre apenas vídeos oficiais da banda no YouTube. O primeiro da lista aparece em destaque."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden /> Novo vídeo
          </button>
        }
      />
      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <AdminError error={list.error} onRetry={list.reload} />
      ) : !list.data?.length ? (
        <EmptyState title="Nenhum vídeo" actions={<button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>Cadastrar vídeo</button>}>
          A seção de vídeos só aparece no site quando houver ao menos um vídeo publicado.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {list.data.map((v, i) => (
            <li key={v.id} className="surface flex flex-wrap items-center gap-4 p-3 sm:p-4">
              <img src={thumbOf(v)} alt="" className="aspect-video w-32 shrink-0 rounded-lg object-cover" loading="lazy" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{v.title}</p>
                <p className="flex flex-wrap items-center gap-2 text-sm text-mist">
                  <PublishedBadge published={v.published} />
                  {v.category}
                  {v.eventTitle && <span>· {v.eventTitle}</span>}
                </p>
              </div>
              <Toggle checked={v.published} onChange={() => toggle(v)} label={`Publicar ${v.title}`} />
              <div className="flex">
                <button className="btn btn-quiet h-10 w-10 p-0" disabled={i === 0} aria-label="Mover para cima" onClick={() => moveItem(list.data!, i, -1, "/api/admin/videos/reorder", (n) => list.setData(() => n), (m) => toast(m, "error"))}>
                  <ArrowUp size={16} aria-hidden />
                </button>
                <button className="btn btn-quiet h-10 w-10 p-0" disabled={i === list.data!.length - 1} aria-label="Mover para baixo" onClick={() => moveItem(list.data!, i, 1, "/api/admin/videos/reorder", (n) => list.setData(() => n), (m) => toast(m, "error"))}>
                  <ArrowDown size={16} aria-hidden />
                </button>
                <button className="btn btn-quiet h-10 w-10 p-0" aria-label={`Editar ${v.title}`} onClick={() => setEditing(v)}>
                  <Pencil size={16} aria-hidden />
                </button>
                <button className="btn btn-quiet h-10 w-10 p-0 text-danger" aria-label={`Excluir ${v.title}`} onClick={() => remove(v)}>
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Novo vídeo" : "Editar vídeo"}>
        {editing !== null && (
          <VideoForm
            item={editing === "new" ? null : editing}
            events={events.data ?? []}
            nextOrder={(list.data?.length ?? 0) + 1}
            onCancel={() => setEditing(null)}
            onSaved={(saved) => {
              list.setData((d) => (d?.some((x) => x.id === saved.id) ? d.map((x) => (x.id === saved.id ? saved : x)) : [...(d ?? []), saved]));
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function VideoForm({ item, events, nextOrder, onSaved, onCancel }: { item: VideoItem | null; events: EventItem[]; nextOrder: number; onSaved: (v: VideoItem) => void; onCancel: () => void }) {
  const [thumb, setThumb] = useState<ImageRef | null>(item?.thumbnail ?? null);
  const form = useAdminForm({
    title: item?.title ?? "",
    description: item?.description ?? "",
    url: item?.url ?? "",
    thumbnailId: item?.thumbnailId ?? (null as number | null),
    category: item?.category ?? "",
    eventId: (item?.eventId ?? "") as number | "",
    sortOrder: item?.sortOrder ?? nextOrder,
    published: item?.published ?? true,
  });
  const v = form.values;
  const yt = youtubeId(v.url);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const saved = await form.submit(
      videoInput,
      (vals) => (item ? apiSend<VideoItem>("PUT", `/api/admin/videos/${item.id}`, vals) : apiSend<VideoItem>("POST", "/api/admin/videos", vals)),
      "Vídeo salvo.",
    );
    if (saved) onSaved(saved);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field label="Link do YouTube" required error={form.errors.url} hint="youtube.com/watch?v=…, youtu.be/… ou youtube.com/shorts/…">
        <input className="input" type="url" inputMode="url" value={v.url} onChange={(e) => form.set("url", e.target.value)} />
      </Field>
      {yt && !thumb && <img src={`https://i.ytimg.com/vi/${yt}/mqdefault.jpg`} alt="Miniatura do YouTube" className="aspect-video w-48 rounded-lg object-cover" />}
      <Field label="Título" required error={form.errors.title}>
        <input className="input" value={v.title} onChange={(e) => form.set("title", e.target.value)} maxLength={140} />
      </Field>
      <Field label="Descrição" error={form.errors.description}>
        <textarea className="input" rows={3} value={v.description} onChange={(e) => form.set("description", e.target.value)} maxLength={1000} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Categoria" error={form.errors.category} hint="Ex.: Ao vivo, Teaser, Clipe.">
          <input className="input" value={v.category} onChange={(e) => form.set("category", e.target.value)} maxLength={60} />
        </Field>
        <Field label="Show relacionado" error={form.errors.eventId}>
          <select className="input" value={String(v.eventId)} onChange={(e) => form.set("eventId", e.target.value ? Number(e.target.value) : "")}>
            <option value="">Nenhum</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {shortDate(ev.date)} — {ev.title}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="max-w-xs">
        <ImageField
          label="Miniatura personalizada"
          value={thumb}
          onChange={(img) => {
            setThumb(img);
            form.set("thumbnailId", img?.id ?? null);
          }}
          hint="Se vazio, usamos a miniatura do YouTube."
        />
      </div>
      <Toggle checked={v.published} onChange={(p) => form.set("published", p)} label="Publicar no site" showLabel />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={form.saving}>
          {form.saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
