import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { SiteProvider } from "../lib/site";

export function PublicLayout() {
  const { pathname, hash } = useLocation();
  // Ao trocar de página (sem âncora), volta ao topo.
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0 });
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SiteProvider>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <div className="flex min-h-[100svh] flex-col">
        <Header />
        <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
          <Outlet />
        </main>
        <Footer />
      </div>
    </SiteProvider>
  );
}
