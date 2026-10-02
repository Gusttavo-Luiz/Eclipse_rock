import { Mail } from "lucide-react";
import type { BandMember, PublicSettings } from "../../../../shared/types";
import { InstagramIcon } from "../../components/icons";
import { ShareButton } from "../../components/ShareButton";
import { SocialLinks } from "../../components/SocialLinks";
import { WhatsAppButton } from "../../components/WhatsAppButton";
import { instagramUrl } from "../../lib/links";

export function ContactSection({ settings, members }: { settings: PublicSettings; members: BandMember[] }) {
  const withIg = members.filter((m) => m.instagram);
  return (
    <section id="contato" aria-labelledby="contato-title" className="relative py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-magenta/50 to-transparent" aria-hidden />
      <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div>
          <h2 id="contato-title" className="display text-[clamp(2.75rem,8vw,5.5rem)]">
            Contato
          </h2>
          <p className="mt-5 max-w-lg text-lg text-moon/85">
            Novidades, bastidores e datas novas saem primeiro nas redes oficiais.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {settings.instagram && (
              <a href={instagramUrl(settings.instagram)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                <InstagramIcon size={19} />
                @{settings.instagram}
                <span className="sr-only">(abre o Instagram em nova aba)</span>
              </a>
            )}
            <WhatsAppButton settings={settings} />
            {settings.contactEmail && (
              <a href={`mailto:${settings.contactEmail}`} className="btn btn-ghost">
                <Mail size={18} aria-hidden />
                {settings.contactEmail}
              </a>
            )}
            <ShareButton title={settings.seoTitle} text={settings.seoDescription} url={window.location.origin + "/"} label="Compartilhar o site" />
          </div>
          <SocialLinks settings={{ ...settings, instagram: null }} className="mt-6" />
        </div>

        {withIg.length > 0 && (
          <div className="surface p-6">
            <h3 className="text-sm font-semibold text-mist">Siga também os integrantes</h3>
            <ul className="mt-3 divide-y divide-line/70">
              {withIg.map((m) => (
                <li key={m.id}>
                  <a
                    href={instagramUrl(m.instagram!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[52px] items-center justify-between gap-4 py-2 hover:text-magenta-soft"
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="inline-flex items-center gap-1.5 text-sm text-violet-soft">
                      <InstagramIcon size={16} />@{m.instagram}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
