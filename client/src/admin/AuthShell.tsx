import type { ReactNode } from "react";
import { EclipseArt } from "../components/EclipseArt";

/** Moldura das telas fora do painel (login, recuperação de senha). */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-12">
      <EclipseArt className="pointer-events-none absolute -right-40 -top-40 w-[640px] opacity-40" />
      <div className="surface relative w-full max-w-md p-6 sm:p-8">
        <h1 className="font-display text-4xl font-extrabold uppercase">{title}</h1>
        <p className="mt-1 text-mist">{subtitle}</p>
        {children}
      </div>
    </main>
  );
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "ok"; children: ReactNode }) {
  const cls = tone === "error" ? "border-danger/40 bg-danger/10" : "border-ok/40 bg-ok/10";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${cls}`}>
      {children}
    </p>
  );
}
