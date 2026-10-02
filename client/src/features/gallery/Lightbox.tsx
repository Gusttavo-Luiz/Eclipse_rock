import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type { GalleryImage } from "../../../../shared/types";

/**
 * Visualização ampliada. <dialog> nativo: foco preso, Escape fecha, foco volta à miniatura.
 * Navegação por setas do teclado, botões e gesto de deslizar.
 */
export function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: GalleryImage[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const touchX = useRef<number | null>(null);
  const open = index !== null;
  const img = open ? images[index] : null;

  const go = useCallback(
    (delta: number) => {
      if (index === null) return;
      onIndex((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndex],
  );

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement as HTMLElement;
      d.showModal();
      document.documentElement.style.overflow = "hidden";
    }
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCloseEv = () => {
      document.documentElement.style.overflow = "";
      opener.current?.focus();
      onClose();
    };
    d.addEventListener("close", onCloseEv);
    return () => d.removeEventListener("close", onCloseEv);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  // pré-carrega a próxima imagem
  useEffect(() => {
    if (index === null || images.length < 2) return;
    const n = images[(index + 1) % images.length];
    const pre = new Image();
    pre.srcset = n.image.srcset;
    pre.sizes = "100vw";
  }, [index, images]);

  return (
    <dialog
      ref={ref}
      aria-label="Foto ampliada"
      className="m-0 h-[100dvh] max-h-none w-screen max-w-none bg-abyss/95 p-0 text-moon backdrop:bg-abyss/90"
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      {img && index !== null && (
        <div className="flex h-full flex-col" onClick={(e) => e.target === e.currentTarget && ref.current?.close()}>
          <div className="flex items-center justify-between gap-4 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-2">
            <p className="text-sm text-mist" aria-live="polite">
              {index + 1} de {images.length}
            </p>
            <button type="button" className="btn btn-quiet h-12 w-12 p-0" onClick={() => ref.current?.close()} aria-label="Fechar foto ampliada" autoFocus>
              <X size={26} aria-hidden />
            </button>
          </div>

          <figure className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-2 sm:px-16">
            <img
              key={img.id}
              src={img.image.src}
              srcSet={img.image.srcset}
              sizes="100vw"
              alt={img.alt}
              width={img.image.width}
              height={img.image.height}
              className="max-h-full w-auto max-w-full object-contain"
            />
            {(img.caption || img.eventTitle) && (
              <figcaption className="mt-3 max-w-2xl px-4 text-center text-sm text-moon/85">
                {img.caption}
                {img.caption && img.eventTitle && " — "}
                {img.eventTitle && <span className="text-mist">{img.eventTitle}</span>}
              </figcaption>
            )}
          </figure>

          {images.length > 1 && (
            <div className="flex justify-center gap-3 px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:pointer-events-none sm:absolute sm:inset-x-0 sm:top-1/2 sm:-translate-y-1/2 sm:justify-between sm:py-0">
              <button type="button" className="btn btn-ghost pointer-events-auto h-12 w-12 p-0" onClick={() => go(-1)} aria-label="Foto anterior">
                <ChevronLeft size={24} aria-hidden />
              </button>
              <button type="button" className="btn btn-ghost pointer-events-auto h-12 w-12 p-0" onClick={() => go(1)} aria-label="Próxima foto">
                <ChevronRight size={24} aria-hidden />
              </button>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
