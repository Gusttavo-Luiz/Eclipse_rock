import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { PublicSettings } from "../../../shared/types";
import { navItems, useSite } from "../lib/site";
import { Logo } from "./EclipseArt";
import { SocialLinks } from "./SocialLinks";

function useActiveSection(ids: string[], enabled: boolean) {
  const [active, setActive] = useState<string>("inicio");
  useEffect(() => {
    if (!enabled) return;
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        let best = "";
        let bestRatio = 0;
        for (const id of ids) {
          const r = visible.get(id) ?? 0;
          if (r > bestRatio) {
            best = id;
            bestRatio = r;
          }
        }
        if (best) setActive(best);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.01, 0.25, 0.5, 1] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids.join(","), enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return active;
}

export function Header() {
  const { data } = useSite();
  const settings = data?.settings;
  const items = navItems(data);
  const location = useLocation();
  const isHome = location.pathname === "/";
  const active = useActiveSection(
    items.map((i) => i.id),
    isHome && !!data,
  );
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fecha o menu ao navegar
  useEffect(() => setOpen(false), [location.key]);

  useEffect(() => {
    if (!open) return;
    document.documentElement.style.overflow = "hidden";
    menuRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const solid = scrolled || !isHome || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)] transition-[background-color,border-color,backdrop-filter] duration-300 ${
        solid ? "border-b border-line/70 bg-abyss/85 backdrop-blur-md" : "border-b border-transparent bg-gradient-to-b from-abyss/70 to-transparent"
      }`}
    >
      <div className="container-page flex h-[68px] items-center justify-between gap-4">
        <Link to="/#inicio" className="shrink-0 rounded-md" aria-label={`${settings?.bandName ?? "Eclipse Rock"} — página inicial`}>
          {settings ? <Logo settings={settings} compact /> : <span className="display text-[1.7rem]">Eclipse Rock</span>}
        </Link>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => {
              const current = isHome && active === item.id;
              return (
                <li key={item.id}>
                  <Link
                    to={`/#${item.id}`}
                    aria-current={current ? "location" : undefined}
                    className={`relative inline-flex min-h-[44px] items-center rounded-lg px-3 text-[0.95rem] font-medium transition-colors ${
                      current ? "text-moon" : "text-mist hover:text-moon"
                    }`}
                  >
                    {item.label}
                    <span
                      aria-hidden
                      className={`absolute inset-x-3 bottom-1.5 h-0.5 rounded-full bg-gradient-to-r from-violet to-magenta transition-opacity ${
                        current ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/#shows" className="btn btn-primary btn-sm hidden sm:inline-flex">
            Próximos shows
          </Link>
          <button
            ref={toggleRef}
            type="button"
            className="btn btn-quiet h-11 w-11 p-0 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={24} aria-hidden /> : <Menu size={24} aria-hidden />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      <div
        id="mobile-nav"
        ref={menuRef}
        hidden={!open}
        className="h-[calc(100svh-68px-env(safe-area-inset-top))] overflow-y-auto border-t border-line/70 bg-abyss/97 lg:hidden"
      >
        <MobileNav items={items} active={isHome ? active : ""} settings={settings} />
      </div>
    </header>
  );
}

function MobileNav({ items, active, settings }: { items: { id: string; label: string }[]; active: string; settings?: PublicSettings }) {
  return (
    <nav aria-label="Menu" className="container-page flex min-h-full flex-col justify-between gap-10 py-8 pb-[max(32px,env(safe-area-inset-bottom))]">
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to={`/#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              className={`display block py-2.5 text-5xl transition-colors ${active === item.id ? "text-magenta-soft" : "text-moon hover:text-violet-soft"}`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/#shows" className="btn btn-primary">
            Próximos shows
          </Link>
          <Link to="/#contrate" className="btn btn-ghost">
            Contrate a banda
          </Link>
        </div>
        {settings && <SocialLinks settings={settings} />}
      </div>
    </nav>
  );
}
