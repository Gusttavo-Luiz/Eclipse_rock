import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import type { ImageRef } from "../../../shared/types";
import { ApiError, uploadImage } from "../lib/api";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-none sm:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-mist">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Interruptor acessível (role="switch"). */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  showLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  showLabel?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={showLabel ? undefined : label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-[44px] items-center gap-3 rounded-lg text-sm disabled:opacity-50"
    >
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-ok/80" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-moon shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </span>
      {showLabel && <span>{label}</span>}
      <span className={showLabel ? "text-mist" : "sr-only"}>{checked ? "Publicado" : "Oculto"}</span>
    </button>
  );
}

export function PublishedBadge({ published }: { published: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        published ? "border-ok/40 bg-ok/10 text-ok" : "border-mist/40 bg-mist/10 text-mist"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${published ? "bg-ok" : "bg-mist"}`} aria-hidden />
      {published ? "Publicado" : "Rascunho"}
    </span>
  );
}

/** Seleção + envio de imagem, com pré-visualização e remoção. */
export function ImageField({
  label,
  value,
  onChange,
  hint,
  error,
  aspect = "aspect-video",
}: {
  label: string;
  value: ImageRef | null;
  onChange: (img: ImageRef | null) => void;
  hint?: string;
  error?: string;
  aspect?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setErr(null);
    if (file.size > 10 * 1024 * 1024) {
      setErr("Arquivo muito grande (máx. 10 MB).");
      return;
    }
    setBusy(true);
    try {
      onChange(await uploadImage(file));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Falha no envio.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const shownError = err ?? error;
  return (
    <div>
      <span className="field-label">
        {label} <span className="font-normal text-mist">(opcional)</span>
      </span>
      <div className={`relative overflow-hidden rounded-xl border border-dashed border-line bg-abyss/50 ${aspect}`}>
        {value ? (
          <img src={value.src} srcSet={value.srcset} sizes="400px" alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-mist">Nenhuma imagem</div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-abyss/70" role="status">
            <Loader2 className="animate-spin" aria-hidden />
            <span className="sr-only">Enviando imagem…</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          <ImagePlus size={16} aria-hidden />
          {value ? "Trocar imagem" : "Enviar imagem"}
        </button>
        {value && (
          <button type="button" className="btn btn-quiet btn-sm text-mist" onClick={() => onChange(null)} disabled={busy}>
            <Trash2 size={16} aria-hidden />
            Remover
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          tabIndex={-1}
          aria-label={label}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      {hint && <p className="field-hint">{hint}</p>}
      {shownError && (
        <p className="field-error" role="alert">
          {shownError}
        </p>
      )}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginação" className="mt-6 flex items-center justify-between gap-4">
      <p className="text-sm text-mist">
        Página {page} de {pages} · {total} registros
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Anterior
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Próxima
        </button>
      </div>
    </nav>
  );
}

/** Tabela responsiva: rola horizontalmente só dentro do próprio contêiner. */
export function TableWrap({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="surface overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-[640px] text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold [&_th]:text-mist [&_thead]:border-b [&_thead]:border-line [&_tbody_tr]:border-b [&_tbody_tr]:border-line/60 [&_tbody_tr:last-child]:border-0">
        {children}
      </table>
    </div>
  );
}
