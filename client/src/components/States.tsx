import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { CrescentIcon } from "./icons";

export function LoadingState({ label = "Carregando…", className = "" }: { label?: string; className?: string }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-3 py-16 text-mist ${className}`}>
      <Loader2 className="animate-spin" size={20} aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className = "",
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={`surface flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center ${className}`}>
      <AlertTriangle className="shrink-0 text-warn" aria-hidden />
      <p className="flex-1 text-moon">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  actions,
  className = "",
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`surface relative overflow-hidden p-8 sm:p-10 ${className}`}>
      <CrescentIcon size={120} className="pointer-events-none absolute -right-6 -top-6 text-violet/15" />
      <h3 className="display text-3xl sm:text-4xl">{title}</h3>
      {children && <div className="mt-3 max-w-xl text-mist">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
