import type { PublicSettings } from "../../../shared/types";
import { whatsappUrl } from "../lib/links";
import { WhatsAppIcon } from "./icons";

/** Só renderiza quando o WhatsApp comercial estiver configurado no painel. */
export function WhatsAppButton({
  settings,
  message,
  label = "Chamar no WhatsApp",
  className = "btn btn-ghost",
}: {
  settings: PublicSettings;
  message?: string;
  label?: string;
  className?: string;
}) {
  if (!settings.whatsapp) return null;
  return (
    <a
      href={whatsappUrl(settings.whatsapp, message ?? settings.whatsappMessage)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      <WhatsAppIcon size={19} />
      {label}
      <span className="sr-only">(abre o WhatsApp em nova aba)</span>
    </a>
  );
}
