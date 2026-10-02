import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Modal acessível sobre o elemento nativo <dialog> (showModal):
 * foco preso no diálogo, fundo inerte, Escape fecha e o foco volta ao elemento de origem.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  labelledBy,
  className = "",
  hideHeader,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "full";
  labelledBy?: string;
  className?: string;
  hideHeader?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      d.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && d.open) {
      d.close();
    }
    return () => {
      if (!open) return;
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const handleClose = () => {
      document.documentElement.style.overflow = "";
      (opener.current as HTMLElement | null)?.focus?.();
      onClose();
    };
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d.addEventListener("close", handleClose);
    d.addEventListener("cancel", handleCancel);
    return () => {
      d.removeEventListener("close", handleClose);
      d.removeEventListener("cancel", handleCancel);
    };
  }, [onClose]);

  const widths = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", full: "max-w-none" };
  const titleId = labelledBy ?? "modal-title";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // clique no fundo
      }}
      className={`m-auto w-[calc(100%-24px)] ${widths[size]} max-h-[calc(100svh-24px)] overflow-visible bg-transparent p-0 text-moon backdrop:bg-abyss/80 backdrop:backdrop-blur-sm ${className}`}
    >
      {open && (
        <div className="surface max-h-[calc(100svh-24px)] overflow-y-auto shadow-[var(--shadow-panel)]">
          {!hideHeader && (
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-night/95 px-5 py-4 backdrop-blur sm:px-6">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              <button type="button" className="btn btn-quiet -mr-2 h-11 w-11 p-0" onClick={onClose} aria-label="Fechar">
                <X size={20} aria-hidden />
              </button>
            </div>
          )}
          {hideHeader && <h2 id={titleId} className="sr-only">{title}</h2>}
          <div className={hideHeader ? "" : "p-5 sm:p-6"}>{children}</div>
        </div>
      )}
    </dialog>
  );
}

// ---------- Confirmação ----------
interface ConfirmOpts {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}
type ConfirmFn = (o: ConfirmOpts) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback<ConfirmFn>((o) => new Promise((resolve) => setState({ ...o, resolve })), []);
  const done = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => done(false)} title={state?.title ?? ""} size="sm" labelledBy="confirm-title">
        <div className="text-mist">{state?.message}</div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={() => done(false)} autoFocus>
            Cancelar
          </button>
          <button type="button" className={`btn ${state?.danger ? "btn-danger" : "btn-primary"}`} onClick={() => done(true)}>
            {state?.confirmLabel ?? "Confirmar"}
          </button>
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);
