/** Ícones de marcas (o Lucide não inclui logotipos de marcas). Traços simplificados, herdando currentColor. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20, rest: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  "aria-hidden": true as const,
  focusable: false as const,
  ...rest,
});

export const InstagramIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" />
  </svg>
);

export const YouTubeIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="currentColor">
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15.1V8.9l5.2 3.1L10 15.1Z" />
  </svg>
);

export const WhatsAppIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="currentColor">
    <path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2Zm0 17.7c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.8 2c0 1.2.9 2.3 1 2.5.1.2 1.7 2.6 4.1 3.6 1.5.7 2.1.7 2.9.6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.4-.4Z" />
  </svg>
);

export const SpotifyIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round">
    <circle cx="12" cy="12" r="9.5" />
    <path d="M7 9.6c3.6-1.1 7.4-.8 10.4.9M7.6 12.7c2.9-.8 5.9-.5 8.3.8M8.2 15.6c2.2-.5 4.4-.3 6.2.6" />
  </svg>
);

export const TikTokIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="currentColor">
    <path d="M16.6 3c.3 2 1.6 3.6 3.6 3.9v2.8c-1.4 0-2.7-.4-3.7-1.1v6.2A5.7 5.7 0 1 1 10.8 9v2.9a2.9 2.9 0 1 0 2.1 2.8V3h3.7Z" />
  </svg>
);

export const FacebookIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="currentColor">
    <path d="M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z" />
  </svg>
);

export const BRAND_ICONS = {
  instagram: InstagramIcon,
  youtube: YouTubeIcon,
  spotify: SpotifyIcon,
  tiktok: TikTokIcon,
  facebook: FacebookIcon,
};

/** Lua crescente — elemento de identidade. */
export const CrescentIcon = ({ size, ...p }: P) => (
  <svg {...base(size, p)} fill="currentColor">
    <path d="M14.5 2.5a9.5 9.5 0 1 0 7 15.9A8 8 0 0 1 14.5 2.5Z" />
  </svg>
);
