import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { EclipseArt } from "../components/EclipseArt";
import { ErrorState } from "../components/States";
import { AboutSection } from "../features/band/AboutSection";
import { ContactSection } from "../features/band/ContactSection";
import { HeroSection } from "../features/band/HeroSection";
import { MembersSection } from "../features/band/MembersSection";
import { BookingSection } from "../features/bookings/BookingSection";
import { EventsSection } from "../features/events/EventsSection";
import { GallerySection } from "../features/gallery/GallerySection";
import { VideosSection } from "../features/videos/VideosSection";
import { useSeo } from "../lib/seo";
import { useSite } from "../lib/site";

export function HomePage() {
  const { data, error, loading, reload } = useSite();
  const location = useLocation();
  useSeo(data?.settings.seoTitle, data?.settings.seoDescription);

  // Rola até a seção indicada na URL (#shows etc.) quando o conteúdo estiver pronto.
  useEffect(() => {
    if (!data || !location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const el = document.getElementById(id);
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start" });
      if (id !== "inicio") {
        const heading = el.querySelector<HTMLElement>("h2");
        if (heading) {
          heading.setAttribute("tabindex", "-1");
          heading.focus({ preventScroll: true });
        }
      }
    });
  }, [data, location.key, location.hash]);

  if (loading && !data) {
    return (
      <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden" role="status" aria-label="Carregando">
        <EclipseArt className="w-[min(70vw,420px)] opacity-60" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="container-page pt-32 pb-24">
        <ErrorState message={error?.message ?? "Não foi possível carregar o site."} onRetry={reload} />
      </div>
    );
  }

  const next = data.upcoming.find((e) => e.status !== "cancelled") ?? null;
  return (
    <>
      <HeroSection settings={data.settings} nextEvent={next} />
      <AboutSection settings={data.settings} />
      <MembersSection members={data.members} />
      <EventsSection events={data.upcoming} settings={data.settings} />
      <GallerySection images={data.gallery} />
      <VideosSection videos={data.videos} />
      <BookingSection settings={data.settings} />
      <ContactSection settings={data.settings} members={data.members} />
    </>
  );
}
