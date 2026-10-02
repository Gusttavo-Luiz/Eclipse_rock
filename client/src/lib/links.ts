import type { EventItem, PublicSettings } from "../../../shared/types";

export const instagramUrl = (handle: string) => `https://www.instagram.com/${encodeURIComponent(handle)}/`;

export function whatsappUrl(number: string, message?: string | null) {
  const q = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${number.replace(/\D/g, "")}${q}`;
}

/** Link de localização: usa o link cadastrado ou monta uma busca no Google Maps com o endereço real. */
export function mapsUrl(e: Pick<EventItem, "mapsUrl" | "address" | "venue" | "city" | "state">) {
  if (e.mapsUrl) return e.mapsUrl;
  const q = [e.venue, e.address, `${e.city} - ${e.state}`].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function socialLinks(s: PublicSettings) {
  return [
    s.instagram && { key: "instagram", label: "Instagram", href: instagramUrl(s.instagram) },
    s.youtubeUrl && { key: "youtube", label: "YouTube", href: s.youtubeUrl },
    s.spotifyUrl && { key: "spotify", label: "Spotify", href: s.spotifyUrl },
    s.tiktokUrl && { key: "tiktok", label: "TikTok", href: s.tiktokUrl },
    s.facebookUrl && { key: "facebook", label: "Facebook", href: s.facebookUrl },
  ].filter(Boolean) as { key: "instagram" | "youtube" | "spotify" | "tiktok" | "facebook"; label: string; href: string }[];
}

/** Compartilhamento nativo quando disponível; senão copia o link. Retorna o que aconteceu. */
export async function share(data: { title: string; text?: string; url: string }): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(data.url);
    return "copied";
  } catch {
    return "failed";
  }
}
