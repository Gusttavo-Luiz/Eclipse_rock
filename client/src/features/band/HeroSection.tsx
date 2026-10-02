import { CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import type { EventItem, PublicSettings } from "../../../../shared/types";
import { EclipseArt } from "../../components/EclipseArt";
import { Img } from "../../components/Img";
import { SocialLinks } from "../../components/SocialLinks";
import { parts } from "../../lib/format";

export function HeroSection({ settings, nextEvent }: { settings: PublicSettings; nextEvent: EventItem | null }) {
  const [first, ...rest] = settings.bandName.split(" ");
  return (
    <section id="inicio" aria-labelledby="hero-title" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      {/* camadas de fundo */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_35%,rgb(123_63_228/0.28),transparent_55%),radial-gradient(ellipse_at_15%_90%,rgb(91_140_255/0.14),transparent_50%)]" />
      <div className="starfield absolute inset-0 -z-10 opacity-70" aria-hidden />
      {settings.heroImage && (
        <div className="absolute inset-0 -z-10">
          <Img
            image={settings.heroImage}
            alt=""
            sizes="100vw"
            priority
            className="h-full w-full object-cover object-[50%_30%] opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-abyss via-abyss/75 to-abyss/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-abyss via-transparent to-abyss/50" />
        </div>
      )}

      <EclipseArt
        className={`pointer-events-none absolute -z-10 aspect-square ${
          settings.heroImage
            ? "-right-[30vw] top-[6vh] w-[95vw] opacity-60 mix-blend-screen md:-right-[8vw] md:w-[62vw] lg:w-[52vw]"
            : "-right-[34vw] top-[8vh] w-[110vw] opacity-90 sm:-right-[20vw] md:-right-[6vw] md:top-1/2 md:w-[60vw] md:-translate-y-1/2 lg:w-[52vw] xl:right-[2vw] xl:w-[44vw]"
        }`}
      />

      <div className="container-page flex flex-1 flex-col justify-end pb-10 pt-[calc(68px+22vh)] md:justify-center md:pb-24 md:pt-[68px]">
        <div className="max-w-3xl">
          <p className="mb-5 font-display text-xl font-extrabold uppercase tracking-[0.08em] text-violet-soft sm:text-2xl">
            {settings.tagline}
          </p>
          <h1 id="hero-title" className="display text-[clamp(4.6rem,19vw,12rem)] drop-shadow-[0_6px_30px_rgb(5_4_10/0.8)]">
            <span className="block">{first}</span>
            {rest.length > 0 && (
              <span className="block pl-[0.06em] sm:pl-[0.5em]">{rest.join(" ")}</span>
            )}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-moon/85 sm:text-xl">{settings.heroText}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/#shows" className="btn btn-primary px-7 uppercase">
              Próximos shows
            </Link>
            <Link to="/#contrate" className="btn btn-ghost px-7 uppercase">
              Contrate a banda
            </Link>
          </div>
          <SocialLinks settings={settings} className="mt-7" />
        </div>
      </div>

      {nextEvent && <NextShowStrip event={nextEvent} />}
    </section>
  );
}

function NextShowStrip({ event }: { event: EventItem }) {
  const p = parts(event.date);
  return (
    <div className="relative border-t border-line/60 bg-abyss/70 backdrop-blur-md">
      <div className="container-page">
        <Link
          to={`/shows/${event.slug}`}
          className="group flex min-h-[64px] items-center gap-4 py-3 text-sm sm:text-base"
        >
          <CalendarDays size={20} className="shrink-0 text-magenta-soft" aria-hidden />
          <span className="text-mist">Próximo show</span>
          <span className="font-display text-2xl font-extrabold uppercase leading-none">
            {p.day} {p.month}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium group-hover:text-magenta-soft">
            {event.title} — {event.city}/{event.state}
          </span>
          <span className="hidden text-violet-soft underline-offset-4 group-hover:underline sm:inline">Ver detalhes</span>
        </Link>
      </div>
    </div>
  );
}
