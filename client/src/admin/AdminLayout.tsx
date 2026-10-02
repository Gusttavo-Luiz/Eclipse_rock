import { CalendarDays, ExternalLink, Images, Inbox, LayoutDashboard, LogOut, Menu, Settings, UserCircle, Users, Video, X, Mic2 } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { CrescentIcon } from "../components/icons";
import { useAuth } from "./auth";

const NAV = [
  { to: "/admin", label: "Visão geral", Icon: LayoutDashboard, end: true },
  { to: "/admin/shows", label: "Shows", Icon: CalendarDays },
  { to: "/admin/solicitacoes", label: "Solicitações", Icon: Inbox },
  { to: "/admin/integrantes", label: "Integrantes", Icon: Mic2 },
  { to: "/admin/galeria", label: "Galeria", Icon: Images },
  { to: "/admin/videos", label: "Vídeos", Icon: Video },
  { to: "/admin/configuracoes", label: "Configurações", Icon: Settings, adminOnly: true },
  { to: "/admin/usuarios", label: "Usuários", Icon: Users, adminOnly: true },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const items = NAV.filter((n) => !n.adminOnly || user?.role === "admin");

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 px-5">
        <CrescentIcon size={22} className="text-magenta-soft" />
        <span className="font-display text-2xl font-extrabold uppercase">Eclipse Rock</span>
      </div>
      <nav aria-label="Painel" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-1">
          {items.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                    isActive ? "bg-violet/20 text-moon" : "text-mist hover:bg-moon/5 hover:text-moon"
                  }`
                }
              >
                <Icon size={18} aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="space-y-1 border-t border-line p-3">
        <a href="/" target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm text-mist hover:bg-moon/5 hover:text-moon">
          <ExternalLink size={18} aria-hidden />
          Ver site
        </a>
        <NavLink
          to="/admin/conta"
          className={({ isActive }) =>
            `flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm ${isActive ? "bg-violet/20 text-moon" : "text-mist hover:bg-moon/5 hover:text-moon"}`
          }
        >
          <UserCircle size={18} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{user?.name}</span>
        </NavLink>
        <button type="button" onClick={logout} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-sm text-mist hover:bg-moon/5 hover:text-moon">
          <LogOut size={18} aria-hidden />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100svh] bg-abyss lg:pl-64">
      <a href="#admin-main" className="skip-link">
        Pular para o conteúdo
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-night/60 lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-abyss/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <span className="inline-flex items-center gap-2 font-display text-xl font-extrabold uppercase">
          <CrescentIcon size={18} className="text-magenta-soft" /> Painel
        </span>
        <button type="button" className="btn btn-quiet h-11 w-11 p-0" aria-expanded={open} aria-controls="admin-drawer" aria-label={open ? "Fechar menu" : "Abrir menu"} onClick={() => setOpen((o) => !o)}>
          {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" id="admin-drawer">
          <button type="button" className="absolute inset-0 bg-abyss/80" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-night">{sidebar}</aside>
        </div>
      )}

      <main id="admin-main" className="mx-auto max-w-6xl px-4 py-8 pb-[max(32px,env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}
