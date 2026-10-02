import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { fieldErrors, forgotPasswordInput, resetPasswordInput } from "../../../shared/schemas";
import { Field } from "../components/Field";
import { LoadingState } from "../components/States";
import { ApiError, apiSend } from "../lib/api";
import { useSeo } from "../lib/seo";
import { AuthShell, FormAlert } from "./AuthShell";

const backToLogin = (
  <Link to="/admin/login" className="mt-6 inline-block text-sm text-mist hover:text-moon">
    Voltar para o login
  </Link>
);

export function ForgotPasswordPage() {
  const location = useLocation();
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  useSeo("Esqueci minha senha | Painel Eclipse Rock");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const r = forgotPasswordInput.safeParse({ email });
    if (!r.success) {
      setError(fieldErrors(r.error).email ?? "Informe um e-mail válido.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiSend("POST", "/api/auth/forgot", { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Esqueci a senha" subtitle="Informe seu e-mail e enviaremos um link para criar uma nova senha.">
      {sent ? (
        <div className="mt-8 space-y-4">
          <FormAlert tone="ok">
            Se <strong className="break-all">{email.trim().toLowerCase()}</strong> estiver cadastrado no painel, você vai receber um e-mail
            com o link em alguns minutos. Confira também o spam.
          </FormAlert>
          <p className="text-sm text-mist">O link vale por 60 minutos e só pode ser usado uma vez.</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSent(false)}>
            Usar outro e-mail
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
          <Field label="E-mail da sua conta" required error={error ?? undefined}>
            <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
            Enviar link
          </button>
        </form>
      )}
      {backToLogin}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  // O token chega no fragmento (#token=…). Lido uma vez e retirado da barra de endereço.
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
  const [status, setStatus] = useState<"checking" | "valid" | "invalid">(token ? "checking" : "invalid");
  const [invalidMsg, setInvalidMsg] = useState("Este link é inválido, já foi usado ou expirou. Peça um novo.");
  const [values, setValues] = useState({ newPassword: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useSeo("Nova senha | Painel Eclipse Rock");

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname);
    if (!token) return;
    apiSend("POST", "/api/auth/reset/check", { token })
      .then(() => setStatus("valid"))
      .catch((err) => {
        if (err instanceof ApiError && err.status !== 410) setInvalidMsg(err.message);
        setStatus("invalid");
      });
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs: Record<string, string> = {};
    const r = resetPasswordInput.safeParse({ token, newPassword: values.newPassword });
    if (!r.success) Object.assign(errs, fieldErrors(r.error));
    if (!values.confirm) errs.confirm = "Repita a nova senha.";
    else if (values.confirm !== values.newPassword) errs.confirm = "As senhas não são iguais.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(errs.newPassword ? "new-password" : "confirm-password")?.focus();
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await apiSend("POST", "/api/auth/reset", { token, newPassword: values.newPassword });
      navigate("/admin/login", { replace: true, state: { notice: "Senha alterada. Entre com a nova senha." } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        setInvalidMsg(err.message);
        setStatus("invalid");
      } else if (err instanceof ApiError && err.fields) setErrors(err.fields);
      else setFormError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente novamente.");
      setBusy(false);
    }
  }

  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: "" }));
  };

  return (
    <AuthShell title="Nova senha" subtitle="Crie uma nova senha para entrar no painel.">
      {status === "checking" && <LoadingState />}
      {status === "invalid" && (
        <div className="mt-8 space-y-4">
          <FormAlert>{invalidMsg}</FormAlert>
          <Link to="/admin/esqueci-senha" className="btn btn-primary w-full">
            Pedir um novo link
          </Link>
        </div>
      )}
      {status === "valid" && (
        <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
          <Field label="Nova senha" required error={errors.newPassword} hint="Mínimo de 10 caracteres, com letras e números.">
            <input id="new-password" className="input" type="password" autoComplete="new-password" value={values.newPassword} onChange={set("newPassword")} autoFocus />
          </Field>
          <Field label="Repita a nova senha" required error={errors.confirm}>
            <input id="confirm-password" className="input" type="password" autoComplete="new-password" value={values.confirm} onChange={set("confirm")} />
          </Field>
          {formError && <FormAlert>{formError}</FormAlert>}
          <p className="text-sm text-mist">Ao salvar, você sai de todos os aparelhos e entra de novo com a nova senha.</p>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
            Salvar nova senha
          </button>
        </form>
      )}
      {backToLogin}
    </AuthShell>
  );
}
