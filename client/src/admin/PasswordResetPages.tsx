import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { fieldErrors, forgotPasswordInput, resetPasswordInput } from "../../../shared/schemas";
import { Field } from "../components/Field";
import { LoadingState } from "../components/States";
import { ApiError, apiSend } from "../lib/api";
import { useSeo } from "../lib/seo";
import { useAuth } from "./auth";
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

type LinkMode = "reset" | "invite";

const MODE = {
  reset: {
    title: "Nova senha",
    subtitle: "Crie uma nova senha para entrar no painel.",
    seo: "Nova senha | Painel Eclipse Rock",
    check: "/api/auth/reset/check",
    submit: "/api/auth/reset",
    button: "Salvar nova senha",
    note: "Ao salvar, você sai de todos os aparelhos e entra de novo com a nova senha.",
    invalid: "Este link é inválido, já foi usado ou expirou. Peça um novo.",
  },
  invite: {
    title: "Bem-vindo(a)",
    subtitle: "Crie sua senha para acessar o painel da Eclipse Rock.",
    seo: "Aceitar convite | Painel Eclipse Rock",
    check: "/api/auth/invite/check",
    submit: "/api/auth/invite/accept",
    button: "Criar senha e entrar",
    note: null,
    invalid: "Este convite é inválido, já foi usado ou expirou. Peça a um administrador para reenviar.",
  },
} as const;

export const ResetPasswordPage = () => <LinkPasswordPage mode="reset" />;
export const AcceptInvitePage = () => <LinkPasswordPage mode="invite" />;

/** Tela aberta por um link enviado por e-mail (recuperação de senha ou convite). */
function LinkPasswordPage({ mode }: { mode: LinkMode }) {
  const m = MODE[mode];
  const navigate = useNavigate();
  const { refresh } = useAuth();
  // O token chega no fragmento (#token=…). Lido uma vez e retirado da barra de endereço.
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
  const [status, setStatus] = useState<"checking" | "valid" | "invalid">(token ? "checking" : "invalid");
  const [invalidMsg, setInvalidMsg] = useState<string>(m.invalid);
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null);
  const [values, setValues] = useState({ newPassword: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useSeo(m.seo);

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname);
    if (!token) return;
    apiSend<{ name?: string; email?: string }>("POST", m.check, { token })
      .then((r) => {
        if (r?.email) setAccount({ name: r.name ?? "", email: r.email });
        setStatus("valid");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status !== 410) setInvalidMsg(err.message);
        setStatus("invalid");
      });
  }, [token, m.check]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs: Record<string, string> = {};
    const r = resetPasswordInput.safeParse({ token, newPassword: values.newPassword });
    if (!r.success) Object.assign(errs, fieldErrors(r.error));
    if (!values.confirm) errs.confirm = "Repita a senha.";
    else if (values.confirm !== values.newPassword) errs.confirm = "As senhas não são iguais.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(errs.newPassword ? "new-password" : "confirm-password")?.focus();
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await apiSend("POST", m.submit, { token, newPassword: values.newPassword });
      if (mode === "invite") {
        await refresh();
        navigate("/admin", { replace: true });
      } else {
        navigate("/admin/login", { replace: true, state: { notice: "Senha alterada. Entre com a nova senha." } });
      }
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
    <AuthShell title={m.title} subtitle={m.subtitle}>
      {status === "checking" && <LoadingState />}
      {status === "invalid" && (
        <div className="mt-8 space-y-4">
          <FormAlert>{invalidMsg}</FormAlert>
          {mode === "reset" ? (
            <Link to="/admin/esqueci-senha" className="btn btn-primary w-full">
              Pedir um novo link
            </Link>
          ) : null}
        </div>
      )}
      {status === "valid" && (
        <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
          {account && (
            <p className="rounded-lg border border-line p-3 text-sm">
              Olá, <strong>{account.name.split(" ")[0]}</strong>! Seu login será <strong className="break-all">{account.email}</strong>.
            </p>
          )}
          {/* Ajuda o gerenciador de senhas a associar a senha ao login certo. */}
          {account && <input type="email" autoComplete="username" value={account.email} readOnly hidden />}
          <Field label={mode === "invite" ? "Senha" : "Nova senha"} required error={errors.newPassword} hint="Mínimo de 10 caracteres, com letras e números.">
            <input id="new-password" className="input" type="password" autoComplete="new-password" value={values.newPassword} onChange={set("newPassword")} autoFocus />
          </Field>
          <Field label={mode === "invite" ? "Repita a senha" : "Repita a nova senha"} required error={errors.confirm}>
            <input id="confirm-password" className="input" type="password" autoComplete="new-password" value={values.confirm} onChange={set("confirm")} />
          </Field>
          {formError && <FormAlert>{formError}</FormAlert>}
          {m.note && <p className="text-sm text-mist">{m.note}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
            {m.button}
          </button>
        </form>
      )}
      {backToLogin}
    </AuthShell>
  );
}
