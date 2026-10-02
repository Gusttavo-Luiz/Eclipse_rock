import { createContext, useContext, type ReactNode } from "react";
import type { BandMember, EventItem, GalleryImage, PublicSettings, VideoItem } from "../../../shared/types";
import { useApi, type Resource } from "./useApi";

export interface HomeData {
  settings: PublicSettings;
  members: BandMember[];
  upcoming: EventItem[];
  gallery: GalleryImage[];
  videos: VideoItem[];
}

const Ctx = createContext<Resource<HomeData> | null>(null);

/** Carrega uma única vez o conteúdo publicado usado no site público. */
export function SiteProvider({ children }: { children: ReactNode }) {
  const home = useApi<HomeData>("/api/public/home");
  return <Ctx.Provider value={home}>{children}</Ctx.Provider>;
}

export function useSite() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSite fora do SiteProvider");
  return v;
}

export interface NavItem {
  id: string;
  label: string;
}

/** Itens de navegação: seções sem conteúdo publicado não aparecem (nada de links para o vazio). */
export function navItems(d: HomeData | undefined): NavItem[] {
  return [
    { id: "inicio", label: "Início" },
    { id: "banda", label: "A Banda" },
    { id: "shows", label: "Shows" },
    ...(d?.gallery.length ? [{ id: "galeria", label: "Galeria" }] : []),
    ...(d?.videos.length ? [{ id: "videos", label: "Vídeos" }] : []),
    { id: "contrate", label: "Contrate" },
    { id: "contato", label: "Contato" },
  ];
}
