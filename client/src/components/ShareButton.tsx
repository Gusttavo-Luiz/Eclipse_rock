import { Share2 } from "lucide-react";
import { share } from "../lib/links";
import { useToast } from "./Toast";

export function ShareButton({
  title,
  text,
  url,
  label = "Compartilhar",
  className = "btn btn-ghost",
}: {
  title: string;
  text?: string;
  url: string;
  label?: string;
  className?: string;
}) {
  const toast = useToast();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const r = await share({ title, text, url });
        if (r === "copied") toast("Link copiado. É só colar onde quiser compartilhar.");
        if (r === "failed") toast("Não foi possível compartilhar. Copie o endereço da barra do navegador.", "error");
      }}
    >
      <Share2 size={18} aria-hidden />
      {label}
    </button>
  );
}
