import type { PublicSettings } from "../../../shared/types";
import { socialLinks } from "../lib/links";
import { BRAND_ICONS } from "./icons";

/** Ícones das redes oficiais — só aparecem os canais efetivamente configurados. */
export function SocialLinks({ settings, size = "md", className = "" }: { settings: PublicSettings; size?: "md" | "lg"; className?: string }) {
  const links = socialLinks(settings);
  if (!links.length) return null;
  const dim = size === "lg" ? "h-12 w-12" : "h-11 w-11";
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="Redes sociais oficiais">
      {links.map((l) => {
        const Icon = BRAND_ICONS[l.key];
        return (
          <li key={l.key}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${dim} inline-flex items-center justify-center rounded-full border border-moon/20 bg-abyss/40 text-moon transition-colors hover:border-magenta-soft hover:text-magenta-soft`}
              aria-label={`${settings.bandName} no ${l.label} (abre em nova aba)`}
            >
              <Icon size={size === "lg" ? 22 : 20} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
