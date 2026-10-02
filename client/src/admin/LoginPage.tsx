import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { EclipseArt } from "../components/EclipseArt";
import { Field } from "../components/Field";
import { ApiError } from "../lib/api";
import { useSeo } from "../lib/seo";
import { useAuth } from "./auth";

export function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useSeo("Entrar | Painel Eclipse Rock");

  const from = (location.state as { from?: string } | null)?.from ?? "/admin";
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
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-12">
      <EclipseArt className="pointer-events-none absolute -right-40 -top-40 w-[640px] opacity-40" />
      <div className="surface relative w-full max-w-md p-6 sm:p-8">
        <h1 className="font-display text-4xl font-extrabold uppercase">Área da equipe</h1>
        <p className="mt-1 text-mist">Entre para gerenciar o site da Eclipse Rock.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
          <Field label="E-mail" required>
            <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <Field label="Senha" required>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && (
            <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
            Entrar
          </button>
        </form>
        <a href="/" className="mt-6 inline-block text-sm text-mist hover:text-moon">
          Voltar ao site
        </a>
      </div>
    </main>
  );
}
