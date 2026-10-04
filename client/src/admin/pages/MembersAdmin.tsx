import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { memberInput } from "../../../../shared/schemas";
import type { BandMember, ImageRef } from "../../../../shared/types";
import { Field } from "../../components/Field";
import { InstagramIcon } from "../../components/icons";
import { initials } from "../../features/band/MembersSection";
import { Modal, useConfirm } from "../../components/Modal";
import { EmptyState, LoadingState } from "../../components/States";
import { useToast } from "../../components/Toast";
import { ApiError, apiSend } from "../../lib/api";
import { useSeo } from "../../lib/seo";
import { useApi } from "../../lib/useApi";
import { AdminError } from "../AdminError";
import { useAdminForm } from "../useAdminForm";
import { ImageField, PageHeader, Toggle } from "../ui";

/** Reordenação por botões (acessível por teclado e toque), persistida no servidor. */
export async function moveItem<T extends { id: number }>(
  items: T[],
  index: number,
  delta: number,
  endpoint: string,
  apply: (next: T[]) => void,
  onError: (msg: string) => void,
) {
  const j = index + delta;
  if (j < 0 || j >= items.length) return;
  const next = [...items];
  [next[index], next[j]] = [next[j], next[index]];
  const prev = items;
  apply(next);
  try {
    await apiSend("POST", endpoint, { ids: next.map((x) => x.id) });
  } catch (e) {
    apply(prev);
    onError(e instanceof ApiError ? e.message : "Não foi possível reordenar.");
  }
}

export function MembersAdmin() {
  const list = useApi<BandMember[]>("/api/admin/members");
  const [editing, setEditing] = useState<BandMember | "new" | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  useSeo("Integrantes | Painel Eclipse Rock");

  async function toggle(m: BandMember) {
    try {
      await apiSend("PATCH", `/api/admin/members/${m.id}`, { published: !m.published });
      list.setData((d) => d?.map((x) => (x.id === m.id ? { ...x, published: !m.published } : x)));
      toast(m.published ? "Integrante oculto do site." : "Integrante visível no site.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erro ao salvar.", "error");
    }
  }
  async function remove(m: BandMember) {
    if (!(await confirm({ title: "Excluir integrante?", message: `${m.name} será removido definitivamente. Para apenas esconder, desative "No site".`, confirmLabel: "Excluir", danger: true }))) return;
    try {
      await apiSend("DELETE", `/api/admin/members/${m.id}`);
      list.setData((d) => d?.filter((x) => x.id !== m.id));
      toast("Integrante excluído.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erro ao excluir.", "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Integrantes"
        description="Perfis exibidos na seção da banda. Informe instrumento ou função apenas quando confirmado."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden /> Novo integrante
          </button>
        }
      />
      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <AdminError error={list.error} onRetry={list.reload} />
      ) : !list.data?.length ? (
        <EmptyState title="Nenhum integrante" actions={<button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>Adicionar</button>} />
      ) : (
        <ul className="space-y-3">
          {list.data.map((m, i) => (
            <li key={m.id} className="surface flex flex-wrap items-center gap-4 p-3 sm:p-4">
              <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-night">
                {m.photo && <img src={m.photo.src} srcSet={m.photo.srcset} sizes="56px" alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{m.name}</p>
                <p className="text-sm text-mist">
                  {m.role ?? "Função não informada"}
                  {m.instagram && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <InstagramIcon size={13} />@{m.instagram}
                    </span>
                  )}
                </p>
              </div>
              <Toggle checked={m.published} onChange={() => toggle(m)} label={`Exibir ${m.name} no site`} />
              <div className="flex">
                <button className="btn btn-quiet h-10 w-10 p-0" disabled={i === 0} aria-label={`Mover ${m.name} para cima`} onClick={() => moveItem(list.data!, i, -1, "/api/admin/members/reorder", (n) => list.setData(() => n), (msg) => toast(msg, "error"))}>
                  <ArrowUp size={16} aria-hidden />
                </button>
                <button className="btn btn-quiet h-10 w-10 p-0" disabled={i === list.data!.length - 1} aria-label={`Mover ${m.name} para baixo`} onClick={() => moveItem(list.data!, i, 1, "/api/admin/members/reorder", (n) => list.setData(() => n), (msg) => toast(msg, "error"))}>
                  <ArrowDown size={16} aria-hidden />
                </button>
                <button className="btn btn-quiet h-10 w-10 p-0" aria-label={`Editar ${m.name}`} onClick={() => setEditing(m)}>
                  <Pencil size={16} aria-hidden />
                </button>
                <button className="btn btn-quiet h-10 w-10 p-0 text-danger" aria-label={`Excluir ${m.name}`} onClick={() => remove(m)}>
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Novo integrante" : "Editar integrante"}>
        {editing !== null && (
          <MemberForm
            member={editing === "new" ? null : editing}
            nextOrder={(list.data?.length ?? 0) + 1}
            onSaved={(m) => {
              list.setData((d) => {
                const exists = d?.some((x) => x.id === m.id);
                return exists ? d!.map((x) => (x.id === m.id ? m : x)) : [...(d ?? []), m];
              });
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}

function MemberForm({ member, nextOrder, onSaved, onCancel }: { member: BandMember | null; nextOrder: number; onSaved: (m: BandMember) => void; onCancel: () => void }) {
  const form = useAdminForm({
    name: member?.name ?? "",
    role: member?.role ?? "",
    instagram: member?.instagram ?? "",
    monogram: member?.monogram ?? "",
    photoId: member?.photoId ?? (null as number | null),
    sortOrder: member?.sortOrder ?? nextOrder,
    published: member?.published ?? true,
  });
  const [photo, setPhoto] = useState<ImageRef | null>(member?.photo ?? null);
  const v = form.values;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const saved = await form.submit(
      memberInput,
      (vals) => (member ? apiSend<BandMember>("PUT", `/api/admin/members/${member.id}`, vals) : apiSend<BandMember>("POST", "/api/admin/members", vals)),
      "Integrante salvo.",
    );
    if (saved) onSaved(saved);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-[180px_1fr]">
      <ImageField
        label="Foto"
        value={photo}
        aspect="aspect-[4/5]"
        onChange={(img) => {
          setPhoto(img);
          form.set("photoId", img?.id ?? null);
        }}
      />
      <div className="space-y-5">
        <Field label="Nome artístico" required error={form.errors.name}>
          <input className="input" value={v.name} onChange={(e) => form.set("name", e.target.value)} maxLength={80} />
        </Field>
        <Field label="Instrumento ou função" error={form.errors.role} hint="Deixe em branco se não estiver confirmado.">
          <input className="input" value={v.role} onChange={(e) => form.set("role", e.target.value)} maxLength={80} />
        </Field>
        <Field label="Instagram" error={form.errors.instagram} hint="@perfil ou link do perfil.">
          <input className="input" value={v.instagram} onChange={(e) => form.set("instagram", e.target.value)} placeholder="@perfil" />
        </Field>
        <Field
          label="Sigla no card"
          error={form.errors.monogram}
          hint={`Aparece no lugar da foto enquanto não houver uma. Vazio = iniciais do nome (${initials(v.name) || "—"}).`}
        >
          <input
            className="input uppercase"
            value={v.monogram}
            onChange={(e) => form.set("monogram", e.target.value.toUpperCase())}
            maxLength={3}
            placeholder={initials(v.name)}
          />
        </Field>
        <Toggle checked={v.published} onChange={(p) => form.set("published", p)} label="Exibir no site" showLabel />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={form.saving}>
            {form.saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </form>
  );
}
