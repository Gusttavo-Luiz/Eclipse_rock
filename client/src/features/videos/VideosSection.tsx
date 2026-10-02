import { Play } from "lucide-react";
import { useState } from "react";
import type { VideoItem } from "../../../../shared/types";
import { SectionHeading } from "../../components/SectionHeading";

/**
 * Fachada leve do YouTube: mostra só a miniatura e carrega o player (youtube-nocookie)
 * quando a pessoa clica. Evita centenas de KB de JavaScript na carga inicial.
 */
export function LiteYouTube({ video }: { video: VideoItem }) {
  const [active, setActive] = useState(false);
  const thumb = video.thumbnail?.src ?? `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`;
  return (
    <div className="relative aspect-video overflow-hidden rounded-[var(--radius-card)] border border-line bg-night">
      {active ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button type="button" onClick={() => setActive(true)} className="group absolute inset-0 h-full w-full" aria-label={`Assistir: ${video.title}`}>
          <img src={thumb} alt="" loading="lazy" decoding="async" width={480} height={360} className="h-full w-full object-cover opacity-85 transition group-hover:opacity-100" />
          <span className="absolute inset-0 bg-gradient-to-t from-abyss/70 to-transparent" />
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-violet to-magenta shadow-[var(--shadow-glow)] transition-transform group-hover:scale-105">
            <Play size={26} className="ml-1 fill-current text-white" aria-hidden />
          </span>
        </button>
      )}
    </div>
  );
}

export function VideosSection({ videos }: { videos: VideoItem[] }) {
  const [category, setCategory] = useState("");
  if (!videos.length) return null;
  const categories = [...new Set(videos.map((v) => v.category).filter(Boolean) as string[])];
  const visible = category ? videos.filter((v) => v.category === category) : videos;
  const [featured, ...rest] = visible;

  return (
    <section id="videos" aria-labelledby="videos-title" className="py-24 sm:py-32">
      <div className="container-page">
        <SectionHeading id="videos-title" title="Vídeos" />
        {categories.length > 1 && (
          <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filtrar vídeos por categoria">
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
                {c || "Todos"}
              </button>
            ))}
          </div>
        )}

        {featured && (
          <article className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-end">
            <LiteYouTube key={featured.id} video={featured} />
            <VideoMeta video={featured} large />
          </article>
        )}
        {rest.length > 0 && (
          <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((v) => (
              <li key={v.id}>
                <article>
                  <LiteYouTube video={v} />
                  <VideoMeta video={v} />
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function VideoMeta({ video, large }: { video: VideoItem; large?: boolean }) {
  return (
    <div className={large ? "" : "mt-3"}>
      {(video.category || video.eventTitle) && (
        <p className="text-sm text-violet-soft">{[video.category, video.eventTitle].filter(Boolean).join(" — ")}</p>
      )}
      <h3 className={`font-display font-extrabold uppercase leading-tight ${large ? "text-4xl sm:text-5xl" : "text-2xl"}`}>{video.title}</h3>
      {video.description && <p className={`mt-2 text-mist ${large ? "" : "line-clamp-3 text-sm"}`}>{video.description}</p>}
    </div>
  );
}
