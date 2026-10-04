import { useCallback, useMemo, useState } from "react";
import type { GalleryImage } from "../../../../shared/types";
import { Img } from "../../components/Img";
import { SectionHeading } from "../../components/SectionHeading";
import { Lightbox } from "./Lightbox";

export function GallerySection({ images }: { images: GalleryImage[] }) {
  const [category, setCategory] = useState("");
  const [index, setIndex] = useState<number | null>(null);
  const categories = useMemo(() => [...new Set(images.map((i) => i.category).filter(Boolean) as string[])], [images]);
  const visible = category ? images.filter((i) => i.category === category) : images;
  const close = useCallback(() => setIndex(null), []);
  if (!images.length) return null;

  return (
    <section id="galeria" aria-labelledby="galeria-title" className="py-24 sm:py-32">
      <div className="container-page">
        <SectionHeading id="galeria-title" title="Galeria" />

        {categories.length > 1 && (
          <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filtrar fotos por categoria">
            {["", ...categories].map((c) => (
              <button
                key={c || "all"}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={`min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors ${
                  category === c ? "border-magenta-soft bg-magenta/15 text-moon" : "border-line text-mist hover:text-moon"
                }`}
              >
                {c || "Todas"}
              </button>
            ))}
          </div>
        )}

        <ul className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
          {visible.map((img, i) => (
            <li key={img.id} className={i === 0 && visible.length >= 5 ? "col-span-2 row-span-2" : ""}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                className="group relative block aspect-square w-full overflow-hidden rounded-[var(--radius-card)] bg-night"
                aria-label={`Ampliar foto: ${img.alt}`}
              >
                <Img
                  image={img.image}
                  alt=""
                  sizes={i === 0 && visible.length >= 5 ? "(min-width: 1024px) 600px, 100vw" : "(min-width: 1024px) 300px, 50vw"}
                  className="h-full w-full object-cover object-[center_25%] transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transform-none"
                />
                <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-moon/10 transition group-hover:ring-violet-soft/60" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Lightbox images={visible} index={index} onIndex={setIndex} onClose={close} />
    </section>
  );
}
