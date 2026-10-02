import { Link } from "react-router-dom";
import { navItems, useSite } from "../lib/site";
import { Logo } from "./EclipseArt";
import { SocialLinks } from "./SocialLinks";

export function Footer() {
  const { data } = useSite();
  const s = data?.settings;
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-auto overflow-hidden border-t border-line/70 bg-abyss">
      <div className="starfield pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div className="container-page relative grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:py-16">
        <div>
          {s ? <Logo settings={s} /> : <span className="display text-4xl">Eclipse Rock</span>}
          {s && <p className="mt-4 max-w-sm text-mist">{s.tagline}</p>}
          {s && <SocialLinks settings={s} className="mt-6" />}
        </div>

        <nav aria-label="Navegação do rodapé">
          <h2 className="mb-3 text-sm font-semibold text-moon">Navegação</h2>
          <ul className="space-y-1">
            {navItems(data).map((i) => (
              <li key={i.id}>
                <Link to={`/#${i.id}`} className="inline-flex min-h-[40px] items-center text-mist hover:text-moon">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Links institucionais">
          <h2 className="mb-3 text-sm font-semibold text-moon">Mais</h2>
          <ul className="space-y-1">
            <li>
              <Link to="/shows" className="inline-flex min-h-[40px] items-center text-mist hover:text-moon">
                Agenda completa
              </Link>
            </li>
            <li>
              <Link to="/privacidade" className="inline-flex min-h-[40px] items-center text-mist hover:text-moon">
                Política de Privacidade
              </Link>
            </li>
            <li>
              <Link to="/admin" className="inline-flex min-h-[40px] items-center text-mist hover:text-moon">
                Área da equipe
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="container-page relative flex flex-col gap-2 border-t border-line/50 py-6 pb-[max(24px,env(safe-area-inset-bottom))] text-sm text-mist sm:flex-row sm:justify-between">
        <p>
          © {year} {s?.bandName ?? "Eclipse Rock"}. Todos os direitos reservados.
        </p>
        <Link to="/privacidade" className="hover:text-moon">
          Privacidade e dados pessoais (LGPD)
        </Link>
      </div>
    </footer>
  );
}
