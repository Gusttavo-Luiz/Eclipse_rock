import { useId } from "react";
import type { PublicSettings } from "../../../shared/types";
import { CrescentIcon } from "./icons";

/**
 * Eclipse desenhado em SVG — a peça de identidade do hero.
 * Disco escuro, coroa em magenta/violeta/azul e o "anel de diamante" de luz na borda.
 */
export function EclipseArt({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 600 600" className={className} aria-hidden focusable="false" role="presentation">
      <defs>
        <radialGradient id={`corona-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="52%" stopColor="#E0359B" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#7B3FE4" stopOpacity="0.55" />
          <stop offset="74%" stopColor="#5B8CFF" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#05040A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`disc-${id}`} cx="42%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#120f24" />
          <stop offset="100%" stopColor="#05040A" />
        </radialGradient>
        <linearGradient id={`rim-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F3F1FA" stopOpacity="0" />
          <stop offset="55%" stopColor="#F27CC0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F3F1FA" stopOpacity="1" />
        </linearGradient>
        <filter id={`blur-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id={`soft-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* coroa */}
      <g className="origin-center animate-corona" style={{ transformBox: "fill-box" }}>
        <circle cx="300" cy="300" r="290" fill={`url(#corona-${id})`} />
        <circle cx="300" cy="300" r="176" fill="none" stroke="#E0359B" strokeOpacity="0.55" strokeWidth="10" filter={`url(#blur-${id})`} />
      </g>

      {/* disco da lua */}
      <circle cx="300" cy="300" r="168" fill={`url(#disc-${id})`} />

      {/* borda iluminada (anel de diamante) */}
      <path
        d="M 420 182 A 168 168 0 0 1 452 380"
        fill="none"
        stroke={`url(#rim-${id})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="452" cy="380" r="7" fill="#F3F1FA" />
      <circle cx="452" cy="380" r="20" fill="#F27CC0" opacity="0.6" filter={`url(#soft-${id})`} />

      {/* estrelas */}
      {[
        [64, 92, 1.6], [520, 64, 2.2], [556, 520, 1.4], [92, 470, 2], [150, 210, 1.1], [470, 150, 1.2], [36, 300, 1.3], [300, 30, 1.1], [560, 300, 1.6],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={i % 3 === 0 ? "#A98BF5" : "#F3F1FA"} opacity={0.75} />
      ))}
    </svg>
  );
}

/** Logotipo oficial (quando enviado pelo painel) ou marca tipográfica. */
export function Logo({ settings, className = "", compact }: { settings: PublicSettings; className?: string; compact?: boolean }) {
  if (settings.logo) {
    return (
      <img
        src={settings.logo.src}
        alt={settings.bandName}
        width={settings.logo.width}
        height={settings.logo.height}
        className={`w-auto object-contain ${compact ? "h-9" : "h-12"} ${className}`}
      />
    );
  }
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <CrescentIcon size={compact ? 22 : 28} className="text-magenta-soft" />
      <span className={`display ${compact ? "text-[1.7rem]" : "text-4xl"} leading-none tracking-wide`}>{settings.bandName}</span>
    </span>
  );
}
