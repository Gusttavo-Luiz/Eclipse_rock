import { Link } from "react-router-dom";
import type { PublicSettings } from "../../../../shared/types";
import { CrescentIcon } from "../../components/icons";
import { Img } from "../../components/Img";

/** Estilos que fazem parte do repertório (confirmados no briefing e nos metadados do site original). */
const REPERTOIRE = ["Rock dos anos 2000", "Pop punk", "Emo", "Tributo à Pitty", "Clássicos da MTV e do rock alternativo"];

export function AboutSection({ settings }: { settings: PublicSettings }) {
  const paragraphs = settings.aboutText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <section id="banda" aria-labelledby="banda-title" className="relative py-24 sm:py-32">
      <div className="container-page grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
        <div>
          <h2 id="banda-title" className="display text-[clamp(2.75rem,8vw,5.5rem)]">
            A banda
          </h2>
          <div className="prose-band mt-8 max-w-[62ch] text-lg leading-relaxed text-moon/85">
            {paragraphs.map((p, i) => (
              <p key={i} className={i === 0 ? "text-xl text-moon sm:text-2xl sm:leading-snug" : ""}>
                {p}
              </p>
            ))}
          </div>

          <h3 className="mt-10 text-sm font-semibold text-mist">No repertório</h3>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Estilos do repertório">
            {REPERTOIRE.map((r) => (
              <li key={r} className="rounded-full border border-line bg-night/70 px-4 py-2 text-sm font-medium">
                {r}
              </li>
            ))}
          </ul>

          <Link to="/#integrantes" className="btn btn-ghost mt-10">
            Conheça os integrantes
          </Link>
        </div>

        <div className="relative">
          {settings.aboutImage ? (
            <figure className="relative">
              <div className="absolute -inset-3 -z-10 rounded-[28px] bg-gradient-to-br from-violet/40 via-transparent to-magenta/30 blur-2xl" aria-hidden />
              {/* Vertical: recorte 4:5. Horizontal (ex.: foto do grupo): proporção original, sem cortar ninguém. */}
              <Img
                image={settings.aboutImage}
                alt={`Foto da banda ${settings.bandName}`}
                sizes="(min-width: 1024px) 560px, 100vw"
                className={`w-full rounded-[var(--radius-panel)] object-cover ${
                  settings.aboutImage.width > settings.aboutImage.height ? "" : "aspect-[4/5]"
                }`}
              />
            </figure>
          ) : (
            <MoonPhases />
          )}
        </div>
      </div>
    </section>
  );
}

/** Composição gráfica quando ainda não há foto oficial — não simula uma fotografia. */
function MoonPhases() {
  return (
    <div className="surface starfield relative flex aspect-[4/5] items-center justify-center overflow-hidden sm:aspect-square lg:aspect-[4/5]" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgb(224_53_155/0.25),transparent_55%)]" />
      <div className="relative grid grid-cols-3 gap-6 sm:gap-10">
        {[0.15, 0.4, 1, 0.4, 0.15, 0.6].map((o, i) => (
          <CrescentIcon key={i} size={i === 2 ? 96 : 64} className="text-moon" style={{ opacity: o, transform: `rotate(${i * 34}deg)` }} />
        ))}
      </div>
    </div>
  );
}
