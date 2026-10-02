import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Field } from "../components/Field";
import { api, ApiError } from "../lib/api";
import { useSeo } from "../lib/seo";
import { useAuth } from "./auth";
import { AuthShell, FormAlert } from "./AuthShell";

export function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canReset, setCanReset] = useState(false);
  useSeo("Entrar | Painel Eclipse Rock");

  useEffect(() => {
    api<{ passwordReset: boolean }>("/api/auth/options")
      .then((o) => setCanReset(o.passwordReset))
      .catch(() => setCanReset(false));
  }, []);

  const state = location.state as { from?: string; notice?: string } | null;
  const from = state?.from ?? "/admin";
  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!email || !password) {
      setError("Informe e-mail e senha.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar.");
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Área da equipe" subtitle="Entre para gerenciar o site da Eclipse Rock.">
      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        {state?.notice && !error && <FormAlert tone="ok">{state.notice}</FormAlert>}
        <Field label="E-mail" required>
          <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label="Senha" required>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <FormAlert>{error}</FormAlert>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
          Entrar
        </button>
      </form>
      <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm">
        <a href="/" className="text-mist hover:text-moon">
          Voltar ao site
        </a>
        {canReset && (
          <Link to="/admin/esqueci-senha" state={{ email }} className="text-violet-soft underline underline-offset-2 hover:text-moon">
            Esqueci minha senha
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
