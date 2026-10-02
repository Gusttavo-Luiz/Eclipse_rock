import { Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { userCreateInput, userUpdateInput, type Role } from "../../../../shared/schemas";
import type { User } from "../../../../shared/types";
import { Field } from "../../components/Field";
import { Modal } from "../../components/Modal";
import { LoadingState } from "../../components/States";
import { apiSend } from "../../lib/api";
import { dateTime } from "../../lib/format";
import { useSeo } from "../../lib/seo";
import { useApi } from "../../lib/useApi";
import { AdminError } from "../AdminError";
import { useAuth } from "../auth";
import { useAdminForm } from "../useAdminForm";
import { PageHeader, TableWrap, Toggle } from "../ui";

const ROLE_LABEL: Record<Role, string> = { admin: "Administrador", editor: "Editor" };

export function UsersAdmin() {
  const list = useApi<User[]>("/api/admin/users");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  useSeo("Usuários | Painel Eclipse Rock");

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Editores gerenciam shows, integrantes, galeria, vídeos e solicitações. Administradores também alteram configurações e usuários."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden /> Novo usuário
          </button>
        }
      />
      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <AdminError error={list.error} onRetry={list.reload} />
      ) : (
        <TableWrap label="Usuários do painel">
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">Papel</th>
              <th scope="col">Situação</th>
              <th scope="col">Último acesso</th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.data!.map((u) => (
              <tr key={u.id}>
                <td>
                  <span className="font-medium">{u.name}</span>
                  <span className="block text-mist">{u.email}</span>
                </td>
                <td>{ROLE_LABEL[u.role]}</td>
                <td>{u.active ? <span className="text-ok">Ativo</span> : <span className="text-mist">Desativado</span>}</td>
                <td className="text-mist">{u.lastLoginAt ? dateTime(u.lastLoginAt) : "Nunca"}</td>
                <td className="text-right">
                  <button className="btn btn-quiet h-10 w-10 p-0" aria-label={`Editar ${u.name}`} onClick={() => setEditing(u)}>
                    <Pencil size={16} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Novo usuário" : "Editar usuário"} size="sm">
        {editing !== null && (
          <UserForm
            user={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={(u) => {
              list.setData((d) => (d?.some((x) => x.id === u.id) ? d.map((x) => (x.id === u.id ? u : x)) : [...(d ?? []), u]));
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function UserForm({ user, onSaved, onCancel }: { user: User | null; onSaved: (u: User) => void; onCancel: () => void }) {
  const { user: me } = useAuth();
  const isSelf = user?.id === me?.id;
  const form = useAdminForm({
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: (user?.role ?? "editor") as Role,
    active: user?.active ?? true,
    password: "",
  });
  const v = form.values;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const saved = await form.submit(
      user ? userUpdateInput : userCreateInput,
      (vals) => (user ? apiSend<User>("PUT", `/api/admin/users/${user.id}`, vals) : apiSend<User>("POST", "/api/admin/users", vals)),
      user ? "Usuário atualizado." : "Usuário criado. Envie a senha inicial por um canal seguro.",
    );
    if (saved) onSaved(saved);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field label="Nome" required error={form.errors.name}>
        <input className="input" value={v.name} onChange={(e) => form.set("name", e.target.value)} />
      </Field>
      <Field label="E-mail" required error={form.errors.email}>
        <input className="input" type="email" value={v.email} disabled={!!user} onChange={(e) => form.set("email", e.target.value)} autoComplete="off" />
      </Field>
      <Field label="Papel" required error={form.errors.role} hint={isSelf ? "Você não pode remover o próprio acesso de administrador." : undefined}>
        <select className="input" value={v.role} disabled={isSelf} onChange={(e) => form.set("role", e.target.value as Role)}>
          <option value="editor">Editor</option>
          <option value="admin">Administrador</option>
        </select>
      </Field>
      <Field
        label={user ? "Nova senha" : "Senha inicial"}
        required={!user}
        error={form.errors.password}
        hint={user ? "Preencha só para redefinir. As sessões abertas desse usuário serão encerradas." : "Mínimo de 10 caracteres, com letras e números."}
      >
        <input className="input" type="password" autoComplete="new-password" value={v.password} onChange={(e) => form.set("password", e.target.value)} />
      </Field>
      {user && !isSelf && <Toggle checked={v.active} onChange={(a) => form.set("active", a)} label="Acesso ativo" showLabel />}
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
