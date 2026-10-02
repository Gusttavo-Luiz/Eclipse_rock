import { Pencil, Plus, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { userCreateInput, userUpdateInput, type Role } from "../../../../shared/schemas";
import type { User } from "../../../../shared/types";
import { Field } from "../../components/Field";
import { Modal } from "../../components/Modal";
import { LoadingState } from "../../components/States";
import { useToast } from "../../components/Toast";
import { api, ApiError, apiSend } from "../../lib/api";
import { dateTime } from "../../lib/format";
import { useSeo } from "../../lib/seo";
import { useApi } from "../../lib/useApi";
import { AdminError } from "../AdminError";
import { useAuth } from "../auth";
import { useAdminForm } from "../useAdminForm";
import { PageHeader, TableWrap, Toggle } from "../ui";

const ROLE_LABEL: Record<Role, string> = { admin: "Administrador", editor: "Editor" };

function UserStatus({ u }: { u: User }) {
  if (!u.active) return <span className="text-mist">Desativado</span>;
  if (!u.invitePending) return <span className="text-ok">Ativo</span>;
  return (
    <span>
      <span className="text-warn">Convite pendente</span>
      <span className="block text-xs text-mist">
        {u.inviteExpiresAt ? `Link válido até ${dateTime(u.inviteExpiresAt)}` : "Link expirado: reenvie o convite"}
      </span>
    </span>
  );
}

export function UsersAdmin() {
  const list = useApi<User[]>("/api/admin/users");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [canInvite, setCanInvite] = useState(false);
  const [resending, setResending] = useState<number | null>(null);
  const toast = useToast();
  useSeo("Usuários | Painel Eclipse Rock");

  useEffect(() => {
    api<{ invites: boolean }>("/api/auth/options")
      .then((o) => setCanInvite(o.invites))
      .catch(() => setCanInvite(false));
  }, []);

  const replace = (u: User) =>
    list.setData((d) => (d?.some((x) => x.id === u.id) ? d.map((x) => (x.id === u.id ? u : x)) : [...(d ?? []), u]));

  async function resend(u: User) {
    if (resending) return;
    setResending(u.id);
    try {
      replace(await apiSend<User>("POST", `/api/admin/users/${u.id}/invite`));
      toast(`Convite reenviado para ${u.email}.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Erro ao reenviar o convite.", "error");
    } finally {
      setResending(null);
    }
  }

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
                <td>
                  <UserStatus u={u} />
                </td>
                <td className="text-mist">{u.lastLoginAt ? dateTime(u.lastLoginAt) : "Nunca"}</td>
                <td className="whitespace-nowrap text-right">
                  {u.invitePending && u.active && canInvite && (
                    <button
                      className="btn btn-quiet h-10 w-10 p-0"
                      aria-label={`Reenviar convite para ${u.name}`}
                      title="Reenviar convite"
                      disabled={resending === u.id}
                      onClick={() => resend(u)}
                    >
                      <Send size={16} aria-hidden />
                    </button>
                  )}
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
            canInvite={canInvite}
            onCancel={() => setEditing(null)}
            onSaved={(u) => {
              replace(u);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function UserForm({
  user,
  canInvite,
  onSaved,
  onCancel,
}: {
  user: User | null;
  canInvite: boolean;
  onSaved: (u: User) => void;
  onCancel: () => void;
}) {
  const { user: me } = useAuth();
  const toast = useToast();
  const isSelf = user?.id === me?.id;
  const form = useAdminForm({
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: (user?.role ?? "editor") as Role,
    active: user?.active ?? true,
    sendInvite: !user && canInvite,
    password: "",
  });
  const v = form.values;
  const inviting = !user && v.sendInvite;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const vals = inviting ? { ...v, password: "" } : v;
    const saved = await form.submit(user ? userUpdateInput : userCreateInput, () =>
      user ? apiSend<User>("PUT", `/api/admin/users/${user.id}`, vals) : apiSend<User & { inviteError?: string | null }>("POST", "/api/admin/users", vals),
    );
    if (!saved) return;
    const inviteError = (saved as { inviteError?: string | null }).inviteError;
    if (user) toast("Usuário atualizado.");
    else if (inviteError) toast(`Usuário criado, mas o convite não foi enviado: ${inviteError} Use “Reenviar convite” na lista.`, "error");
    else if (inviting) toast(`Convite enviado para ${saved.email}. A pessoa cria a própria senha pelo link.`);
    else toast("Usuário criado. Envie a senha inicial por um canal seguro.");
    onSaved(saved);
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
      {!user && (
        <fieldset className="space-y-2">
          <legend className="field-label">Como a pessoa vai entrar?</legend>
          <label className={`flex items-start gap-3 rounded-lg border border-line p-3 ${canInvite ? "cursor-pointer" : "opacity-60"}`}>
            <input
              type="radio"
              name="access"
              className="mt-1 h-4 w-4 accent-[#E0359B]"
              checked={v.sendInvite}
              disabled={!canInvite}
              onChange={() => form.set("sendInvite", true)}
            />
            <span>
              <span className="font-medium">Enviar convite por e-mail</span>
              <span className="block text-sm text-mist">
                {canInvite
                  ? "A pessoa recebe um link (válido por 7 dias) e cria a própria senha. Ninguém mais fica sabendo dela."
                  : "Indisponível: o envio de e-mail não está configurado no servidor."}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3">
            <input type="radio" name="access" className="mt-1 h-4 w-4 accent-[#E0359B]" checked={!v.sendInvite} onChange={() => form.set("sendInvite", false)} />
            <span>
              <span className="font-medium">Definir uma senha inicial agora</span>
              <span className="block text-sm text-mist">Você repassa a senha para a pessoa por um canal seguro.</span>
            </span>
          </label>
        </fieldset>
      )}
      {!inviting && (
        <Field
          label={user ? "Nova senha" : "Senha inicial"}
          required={!user}
          error={form.errors.password}
          hint={
            user
              ? user.invitePending
                ? "Convite pendente. Se preferir, defina a senha aqui: o link do convite deixa de valer."
                : "Preencha só para redefinir. As sessões abertas desse usuário serão encerradas."
              : "Mínimo de 10 caracteres, com letras e números."
          }
        >
          <input className="input" type="password" autoComplete="new-password" value={v.password} onChange={(e) => form.set("password", e.target.value)} />
        </Field>
      )}
      {user && !isSelf && <Toggle checked={v.active} onChange={(a) => form.set("active", a)} label="Acesso ativo" showLabel />}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={form.saving}>
          {form.saving ? (inviting ? "Enviando…" : "Salvando…") : inviting ? "Criar e enviar convite" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
