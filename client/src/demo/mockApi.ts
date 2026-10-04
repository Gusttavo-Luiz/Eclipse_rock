/**
 * API simulada da versão de demonstração estática (GitHub Pages), sem servidor.
 * Usa só o conteúdo inicial confirmado; formulário e painel avisam que funcionam na versão publicada.
 * Só entra no bundle quando VITE_DEMO=1.
 */
import { SEED_ABOUT_PHOTO, SEED_GALLERY, SEED_MEMBERS, SEED_SETTINGS } from "../../../shared/seed";
import type { BandMember, GalleryImage, ImageRef, PublicSettings } from "../../../shared/types";
import isabella from "../../../server/seed/members/isabella.webp";
import mamute from "../../../server/seed/members/mamute.webp";
import mauro from "../../../server/seed/members/mauro.webp";
import rodrigo from "../../../server/seed/members/rodrigo.webp";
import banda from "../../../server/seed/gallery/banda.webp";
import isabellaPalco from "../../../server/seed/gallery/isabella-palco.webp";
import mamuteBaixo from "../../../server/seed/gallery/mamute-baixo.webp";
import mauroGuitarra from "../../../server/seed/gallery/mauro-guitarra.webp";
import rodrigoBateria from "../../../server/seed/gallery/rodrigo-bateria.webp";
import isabellaCantando from "../../../server/seed/gallery/isabella-cantando.webp";
import isabellaPb from "../../../server/seed/gallery/isabella-pb.webp";
import mauroPalco from "../../../server/seed/gallery/mauro-palco.webp";
import rodrigoEclipse from "../../../server/seed/gallery/rodrigo-eclipse.webp";
import rodrigoRock from "../../../server/seed/gallery/rodrigo-rock.webp";
import isabellaMicrofone from "../../../server/seed/gallery/isabella-microfone.webp";
import { ApiError } from "../lib/api";

export const DEMO_NOTICE =
  "Esta é uma versão de demonstração. O envio de formulários e o painel da equipe funcionam na versão publicada do site.";

const siteUrl = () => (window.location.origin + import.meta.env.BASE_URL).replace(/\/$/, "");

function settings(): PublicSettings {
  const { logoId, heroImageId, aboutImageId, ogImageId, ...s } = SEED_SETTINGS;
  void logoId, heroImageId, aboutImageId, ogImageId;
  return { ...s, logo: null, heroImage: null, aboutImage: photo(SEED_ABOUT_PHOTO, 100), ogImage: null, siteUrl: siteUrl() };
}

// Mesmas fotos que o servidor importa na primeira subida (dimensões dos arquivos em server/seed/members).
const PHOTOS: Record<string, { src: string; width: number; height: number }> = {
  "isabella.webp": { src: isabella, width: 524, height: 655 },
  "mauro.webp": { src: mauro, width: 524, height: 655 },
  "mamute.webp": { src: mamute, width: 426, height: 532 },
  "rodrigo.webp": { src: rodrigo, width: 428, height: 535 },
  "banda.webp": { src: banda, width: 983, height: 657 },
  "isabella-palco.webp": { src: isabellaPalco, width: 434, height: 641 },
  "mauro-guitarra.webp": { src: mauroGuitarra, width: 433, height: 655 },
  "rodrigo-bateria.webp": { src: rodrigoBateria, width: 436, height: 653 },
  "mamute-baixo.webp": { src: mamuteBaixo, width: 436, height: 649 },
  "isabella-cantando.webp": { src: isabellaCantando, width: 935, height: 618 },
  "mauro-palco.webp": { src: mauroPalco, width: 886, height: 655 },
  "rodrigo-rock.webp": { src: rodrigoRock, width: 672, height: 641 },
  "isabella-pb.webp": { src: isabellaPb, width: 424, height: 654 },
  "rodrigo-eclipse.webp": { src: rodrigoEclipse, width: 432, height: 653 },
  "isabella-microfone.webp": { src: isabellaMicrofone, width: 374, height: 666 },
};

function photo(file: string | null, id: number): ImageRef | null {
  const p = file ? PHOTOS[file] : undefined;
  return p ? { id, width: p.width, height: p.height, src: p.src, srcset: `${p.src} ${p.width}w` } : null;
}

const gallery: GalleryImage[] = SEED_GALLERY.map((g, i) => ({
  id: i + 1,
  uploadId: 100 + i,
  image: photo(g.file, 100 + i)!,
  alt: g.alt,
  caption: null,
  category: g.category,
  eventId: null,
  eventTitle: null,
  sortOrder: i + 1,
  published: true,
}));

const members: BandMember[] = SEED_MEMBERS.map((m, i) => ({
  id: i + 1,
  name: m.name,
  role: null,
  instagram: m.instagram,
  monogram: m.monogram,
  photo: photo(m.photo, i + 1),
  photoId: null,
  sortOrder: i + 1,
  published: true,
}));

export async function demoApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const url = new URL(path, window.location.origin);
  const p = url.pathname;
  if (method === "GET") {
    if (p === "/api/public/home") return { settings: settings(), members, upcoming: [], gallery, videos: [] } as T;
    if (p === "/api/public/settings") return settings() as T;
    if (p === "/api/public/events") return [] as T;
    if (p === "/api/public/members") return members as T;
    if (p === "/api/public/gallery") return gallery as T;
    if (p === "/api/public/videos") return [] as T;
    if (p.startsWith("/api/public/events/")) throw new ApiError(404, "Show não encontrado.");
    if (p === "/api/auth/me") return { user: null } as T;
    if (p === "/api/auth/options") return { passwordReset: false, invites: false } as T;
  }
  throw new ApiError(503, DEMO_NOTICE);
}
