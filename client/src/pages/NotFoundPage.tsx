import { Link } from "react-router-dom";
import { CrescentIcon } from "../components/icons";
import { useSeo } from "../lib/seo";

export function NotFoundPage({ message = "O endereço pode ter mudado ou a página foi removida." }: { message?: string }) {
  useSeo("Página não encontrada | Eclipse Rock");
  return (
    <div className="container-page flex min-h-[80svh] flex-col items-start justify-center pb-24 pt-32">
      <CrescentIcon size={64} className="text-magenta-soft" />
      <h1 className="display mt-6 text-[clamp(3.5rem,12vw,8rem)]">Página não encontrada</h1>
      <p className="mt-4 max-w-lg text-lg text-mist">{message}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/" className="btn btn-primary">
          Ir para o início
        </Link>
        <Link to="/shows" className="btn btn-ghost">
          Ver agenda
        </Link>
      </div>
    </div>
  );
}
