import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { galleryInput } from "../../../../shared/schemas";
import type { EventItem, GalleryImage, ImageRef } from "../../../../shared/types";
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

export function GalleryAdmin() {
  const list = useApi<GalleryImage[]>("/api/admin/gallery");
  const events = useApi<EventItem[]>("/api/admin/events?scope=");
  const [editing, setEditing] = useState<GalleryImage | "new" | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  useSeo("Galeria | Painel Eclipse Rock");
  const categories = [...new Set((list.data ?? []).map((g) => g.category).filter(Boolean) as string[])];

  async function toggle(g: GalleryImage) {
    try {
      await apiSend("PATCH", `/api/admin/gallery/${g.id}`, { published: !g.published });
      list.setData((d) => d?.map((x) => (x.id === g.id ? { ...x, published: !g.published } : x)));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erro ao salvar.", "error");
    }
  }
  async function remove(g: GalleryImage) {
    if (!(await confirm({ title: "Remover foto?", message: "A foto sai da galeria definitivamente.", confirmLabel: "Remover", danger: true }))) return;
    try {
      await apiSend("DELETE", `/api/admin/gallery/${g.id}`);
      list.setData((d) => d?.filter((x) => x.id !== g.id));
      toast("Foto removida.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erro ao remover.", "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Galeria"
        description="Fotos reais de shows, bastidores e ensaios. A seção só aparece no site quando houver ao menos uma foto publicada."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden /> Adicionar foto
          </button>
        }
      />
      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <AdminError error={list.error} onRetry={list.reload} />
      ) : !list.data?.length ? (
        <EmptyState title="Galeria vazia" actions={<button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>Adicionar foto</button>}>
          As imagens são otimizadas automaticamente (WebP em vários tamanhos) e os dados de localização do arquivo são removidos.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.data.map((g, i) => (
            <li key={g.id} className="surface overflow-hidden">
              <img src={g.image.src} srcSet={g.image.srcset} sizes="(min-width:1024px) 320px, 50vw" alt={g.alt} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <PublishedBadge published={g.published} />
                  {g.category && <span className="truncate text-xs text-mist">{g.category}</span>}
                </div>
                <p className="line-clamp-2 text-sm">{g.caption ?? g.alt}</p>
                <div className="flex items-center justify-between">
                  <Toggle checked={g.published} onChange={() => toggle(g)} label="Publicar foto" />
                  <div className="flex">
                    <button className="btn btn-quiet h-10 w-10 p-0" disabled={i === 0} aria-label="Mover para antes" onClick={() => moveItem(list.data!, i, -1, "/api/admin/gallery/reorder", (n) => list.setData(() => n), (m) => toast(m, "error"))}>
                      <ArrowUp size={16} aria-hidden />
                    </button>
                    <button className="btn btn-quiet h-10 w-10 p-0" disabled={i === list.data!.length - 1} aria-label="Mover para depois" onClick={() => moveItem(list.data!, i, 1, "/api/admin/gallery/reorder", (n) => list.setData(() => n), (m) => toast(m, "error"))}>
                      <ArrowDown size={16} aria-hidden />
                    </button>
                    <button className="btn btn-quiet h-10 w-10 p-0" aria-label="Editar foto" onClick={() => setEditing(g)}>
                      <Pencil size={16} aria-hidden />
                    </button>
                    <button className="btn btn-quiet h-10 w-10 p-0 text-danger" aria-label="Remover foto" onClick={() => remove(g)}>
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Adicionar foto" : "Editar foto"}>
        {editing !== null && (
          <GalleryForm
            item={editing === "new" ? null : editing}
            events={events.data ?? []}
            categories={categories}
            nextOrder={(list.data?.length ?? 0) + 1}
            onCancel={() => setEditing(null)}
            onSaved={(g) => {
              list.setData((d) => (d?.some((x) => x.id === g.id) ? d.map((x) => (x.id === g.id ? g : x)) : [...(d ?? []), g]));
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function GalleryForm({
  item,
  events,
  categories,
  nextOrder,
  onSaved,
  onCancel,
}: {
  item: GalleryImage | null;
  events: EventItem[];
  categories: string[];
  nextOrder: number;
  onSaved: (g: GalleryImage) => void;
  onCancel: () => void;
}) {
  const [image, setImage] = useState<ImageRef | null>(item?.image ?? null);
  const form = useAdminForm({
    uploadId: item?.uploadId ?? (0 as number),
    alt: item?.alt ?? "",
    caption: item?.caption ?? "",
    category: item?.category ?? "",
    eventId: (item?.eventId ?? "") as number | "",
    sortOrder: item?.sortOrder ?? nextOrder,
    published: item?.published ?? true,
  });
  const v = form.values;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item && !image) {
      form.submit(null, async () => {
        throw new ApiError(422, "Envie a imagem antes de salvar.", { uploadId: "Envie a imagem." });
      });
      return;
    }
    const saved = await form.submit(
      item ? galleryInput.omit({ uploadId: true }) : galleryInput,
      (vals) => (item ? apiSend<GalleryImage>("PUT", `/api/admin/gallery/${item.id}`, vals) : apiSend<GalleryImage>("POST", "/api/admin/gallery", vals)),
      "Foto salva.",
    );
    if (saved) onSaved(saved);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
      <div>
        {item ? (
          <img src={item.image.src} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
        ) : (
          <ImageField
            label="Imagem"
            value={image}
            aspect="aspect-[4/3]"
            error={form.errors.uploadId}
            onChange={(img) => {
              setImage(img);
              form.set("uploadId", img?.id ?? 0);
            }}
            hint="JPG, PNG, WebP ou AVIF, até 10 MB."
          />
        )}
      </div>
      <div className="space-y-5">
        <Field label="Descrição da imagem (texto alternativo)" required error={form.errors.alt} hint="Descreva o que aparece, para quem usa leitor de tela.">
          <input className="input" value={v.alt} onChange={(e) => form.set("alt", e.target.value)} maxLength={200} />
        </Field>
        <Field label="Legenda" error={form.errors.caption}>
          <input className="input" value={v.caption} onChange={(e) => form.set("caption", e.target.value)} maxLength={240} />
        </Field>
        <Field label="Categoria" error={form.errors.category} hint="Ex.: Shows, Bastidores, Ensaios.">
          <input className="input" list="gallery-cats" value={v.category} onChange={(e) => form.set("category", e.target.value)} maxLength={60} />
        </Field>
        <datalist id="gallery-cats">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
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
        <Toggle checked={v.published} onChange={(p) => form.set("published", p)} label="Publicar na galeria" showLabel />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
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
