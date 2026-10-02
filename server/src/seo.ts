/**
 * SEO no servidor: injeta <title>, meta tags, canonical, Open Graph e dados estruturados
 * no index.html antes de entregá-lo, para que buscadores e redes sociais leiam o conteúdo real.
 */
import type { EventItem, PublicSettings } from "../../shared/types";
import type { DB } from "./db";
import { getEventBy, getPublicSettings, listPublicEvents } from "./repo";

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jsonLd = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

interface Head {
  status: number;
  title: string;
  description: string;
  path: string;
  image?: string | null;
  noindex?: boolean;
  type?: string;
  ld?: unknown[];
}

function abs(base: string, p: string) {
  return /^https?:\/\//.test(p) ? p : base + p;
}

export function musicGroupLd(s: PublicSettings) {
  const sameAs = [
    s.instagram && `https://www.instagram.com/${s.instagram}/`,
    s.youtubeUrl,
    s.spotifyUrl,
    s.tiktokUrl,
    s.facebookUrl,
  ].filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    name: s.bandName,
    url: s.siteUrl + "/",
    genre: ["Rock", "Pop Punk", "Emo"],
    description: s.seoDescription,
    ...(s.logo ? { logo: abs(s.siteUrl, s.logo.src) } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function musicEventLd(e: EventItem, s: PublicSettings) {
  const startDate = e.time ? `${e.date}T${e.time}:00-03:00` : e.date;
  const offers =
    e.ticketUrl && e.status !== "cancelled"
      ? {
          offers: {
            "@type": "Offer",
            url: e.ticketUrl,
            availability: e.status === "sold_out" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
          },
        }
      : {};
  return {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    name: e.title,
    startDate,
    url: `${s.siteUrl}/shows/${e.slug}`,
    eventStatus: e.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: e.venue,
      address: {
        "@type": "PostalAddress",
        ...(e.address ? { streetAddress: e.address } : {}),
        addressLocality: e.city,
        addressRegion: e.state,
        addressCountry: "BR",
      },
    },
    performer: { "@type": "MusicGroup", name: s.bandName, url: s.siteUrl + "/" },
    ...(e.image ? { image: [abs(s.siteUrl, e.image.src)] } : {}),
    ...(e.description ? { description: e.description } : {}),
    ...offers,
  };
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso + "T12:00:00Z"),
  );

export function resolveHead(db: DB, pathname: string): Head {
  const s = getPublicSettings(db);
  const clean = pathname.replace(/\/+$/, "") || "/";

  if (clean === "/") {
    const upcoming = listPublicEvents(db, "upcoming").slice(0, 10);
    return {
      status: 200,
      title: s.seoTitle,
      description: s.seoDescription,
      path: "/",
      image: s.ogImage?.src ?? s.heroImage?.src ?? null,
      ld: [musicGroupLd(s), ...upcoming.map((e) => musicEventLd(e, s))],
    };
  }
  if (clean === "/shows") {
    return {
      status: 200,
      title: `Agenda de shows | ${s.bandName}`,
      description: `Próximos shows e apresentações anteriores da ${s.bandName}. Datas, locais e ingressos oficiais.`,
      path: "/shows",
      image: s.ogImage?.src ?? null,
    };
  }
  const m = clean.match(/^\/shows\/([a-z0-9-]{1,120})$/);
  if (m) {
    const e = getEventBy(db, "slug", m[1], true);
    if (e) {
      return {
        status: 200,
        title: `${e.title} — ${fmtDate(e.date)} | ${s.bandName}`,
        description: `${s.bandName} em ${e.venue}, ${e.city}/${e.state}, ${fmtDate(e.date)}${e.time ? ` às ${e.time}` : ""}.${
          e.status === "cancelled" ? " Evento cancelado." : e.status === "sold_out" ? " Ingressos esgotados." : ""
        }`,
        path: `/shows/${e.slug}`,
        image: e.image?.src ?? s.ogImage?.src ?? null,
        type: "event",
        ld: [musicEventLd(e, s)],
      };
    }
  }
  if (clean === "/privacidade") {
    return {
      status: 200,
      title: `Política de Privacidade | ${s.bandName}`,
      description: `Como a ${s.bandName} coleta, usa e protege dados pessoais enviados pelo site.`,
      path: "/privacidade",
    };
  }
  if (clean === "/admin" || clean.startsWith("/admin/")) {
    return { status: 200, title: `Painel | ${s.bandName}`, description: "", path: clean, noindex: true };
  }
  return { status: 404, title: `Página não encontrada | ${s.bandName}`, description: s.seoDescription, path: clean, noindex: true };
}

export function renderHead(db: DB, h: Head): string {
  const s = getPublicSettings(db);
  const url = s.siteUrl + h.path;
  const img = h.image ? abs(s.siteUrl, h.image) : null;
  return [
    `<title>${esc(h.title)}</title>`,
    h.description && `<meta name="description" content="${esc(h.description)}">`,
    h.noindex ? `<meta name="robots" content="noindex, nofollow">` : `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:site_name" content="${esc(s.bandName)}">`,
    `<meta property="og:locale" content="pt_BR">`,
    `<meta property="og:type" content="${h.type === "event" ? "article" : "website"}">`,
    `<meta property="og:title" content="${esc(h.title)}">`,
    h.description && `<meta property="og:description" content="${esc(h.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    img && `<meta property="og:image" content="${esc(img)}">`,
    `<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${esc(h.title)}">`,
    h.description && `<meta name="twitter:description" content="${esc(h.description)}">`,
    img && `<meta name="twitter:image" content="${esc(img)}">`,
    ...(h.ld ?? []).map(jsonLd),
  ]
    .filter(Boolean)
    .join("\n    ");
}

export function sitemap(db: DB): string {
  const s = getPublicSettings(db);
  const events = listPublicEvents(db, "all");
  const urls = [
    { loc: "/", lastmod: null as string | null },
    { loc: "/shows", lastmod: null },
    { loc: "/privacidade", lastmod: null },
    ...events.map((e) => ({ loc: `/shows/${e.slug}`, lastmod: e.updatedAt.slice(0, 10) })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => `  <url><loc>${esc(s.siteUrl + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`)
  .join("\n")}
</urlset>
`;
}

export function robots(db: DB): string {
  const s = getPublicSettings(db);
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${s.siteUrl}/sitemap.xml\n`;
}
