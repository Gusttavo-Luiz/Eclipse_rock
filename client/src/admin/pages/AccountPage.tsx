import type { FormEvent } from "react";
import { passwordChangeInput } from "../../../../shared/schemas";
import { Field } from "../../components/Field";
import { apiSend } from "../../lib/api";
import { useSeo } from "../../lib/seo";
import { useAuth } from "../auth";
import { useAdminForm } from "../useAdminForm";
import { PageHeader } from "../ui";

export function AccountPage() {
  const { user } = useAuth();
  const form = useAdminForm({ currentPassword: "", newPassword: "" });
  useSeo("Minha conta | Painel Eclipse Rock");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await form.submit(passwordChangeInput, (v) => apiSend("POST", "/api/auth/password", v), "Senha alterada. Outras sessões foram encerradas.");
    if (ok) form.setValues({ currentPassword: "", newPassword: "" });
  }

  return (
    <>
      <PageHeader title="Minha conta" description={`${user?.name} · ${user?.email} · ${user?.role === "admin" ? "Administrador" : "Editor"}`} />
      <form onSubmit={onSubmit} noValidate className="surface max-w-md space-y-5 p-5 sm:p-6">
        <h2 className="font-semibold">Alterar senha</h2>
        <Field label="Senha atual" required error={form.errors.currentPassword}>
          <input className="input" type="password" autoComplete="current-password" value={form.values.currentPassword} onChange={(e) => form.set("currentPassword", e.target.value)} />
        </Field>
        <Field label="Nova senha" required error={form.errors.newPassword} hint="Mínimo de 10 caracteres, com letras e números.">
          <input className="input" type="password" autoComplete="new-password" value={form.values.newPassword} onChange={(e) => form.set("newPassword", e.target.value)} />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={form.saving}>
          {form.saving ? "Salvando…" : "Alterar senha"}
        </button>
      </form>
    </>
  );
}
