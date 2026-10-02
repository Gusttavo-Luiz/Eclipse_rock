import { CheckCircle2, Send, TriangleAlert } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { settingsInput } from "../../../../shared/schemas";
import type { AdminSettings, ImageRef } from "../../../../shared/types";
import { Field } from "../../components/Field";
import { LoadingState } from "../../components/States";
import { useToast } from "../../components/Toast";
import { ApiError, apiSend } from "../../lib/api";
import { formatPhone } from "../../lib/format";
import { useSeo } from "../../lib/seo";
import { useApi } from "../../lib/useApi";
import { AdminError } from "../AdminError";
import { useAdminForm } from "../useAdminForm";
import { ImageField, PageHeader } from "../ui";

type ImgKey = "logo" | "heroImage" | "aboutImage" | "ogImage";

const EMPTY = {
  bandName: "",
  tagline: "",
  heroText: "",
  aboutText: "",
  instagram: "",
  youtubeUrl: "",
  spotifyUrl: "",
  tiktokUrl: "",
  facebookUrl: "",
  whatsapp: "",
  whatsappMessage: "",
  contactEmail: "",
  privacyEmail: "",
  notifyEmails: "",
  logoId: null as number | null,
  heroImageId: null as number | null,
  aboutImageId: null as number | null,
  ogImageId: null as number | null,
  seoTitle: "",
  seoDescription: "",
  siteUrl: "",
};

export function SettingsAdmin() {
  const res = useApi<AdminSettings>("/api/admin/settings");
  const form = useAdminForm(EMPTY);
  const [imgs, setImgs] = useState<Record<ImgKey, ImageRef | null>>({ logo: null, heroImage: null, aboutImage: null, ogImage: null });
  const [testing, setTesting] = useState(false);
  const toast = useToast();
  useSeo("Configurações | Painel Eclipse Rock");

  useEffect(() => {
    const s = res.data;
    if (!s) return;
    const out = { ...EMPTY } as Record<string, unknown>;
    for (const k of Object.keys(EMPTY)) out[k] = (s as unknown as Record<string, unknown>)[k] ?? (k.endsWith("Id") ? null : "");
    out.notifyEmails = s.notifyEmails.join(", ");
    form.setValues(out as typeof EMPTY);
    setImgs({ logo: s.logo, heroImage: s.heroImage, aboutImage: s.aboutImage, ogImage: s.ogImage });
  }, [res.data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (res.loading) return <LoadingState />;
  if (res.error) return <AdminError error={res.error} onRetry={res.reload} />;

  const v = form.values;
  const e = form.errors;
  const bind = (k: keyof typeof EMPTY) => ({
    className: "input",
    value: (v[k] as string) ?? "",
    onChange: (ev: { target: { value: string } }) => form.set(k, ev.target.value as never),
  });
  const img = (key: ImgKey, label: string, hint: string, aspect: string) => (
    <ImageField
      label={label}
      value={imgs[key]}
      aspect={aspect}
      hint={hint}
      error={e[`${key}Id`]}
      onChange={(i) => {
        setImgs((s) => ({ ...s, [key]: i }));
        form.set(`${key}Id` as keyof typeof EMPTY, (i?.id ?? null) as never);
      }}
    />
  );

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const saved = await form.submit(settingsInput, (vals) => apiSend<AdminSettings>("PUT", "/api/admin/settings", vals), "Configurações salvas. O site já reflete as mudanças.");
    if (saved) res.setData(() => saved);
  }

  async function sendTest() {
    if (testing) return;
    setTesting(true);
    try {
      const r = await apiSend<{ to: string[] }>("POST", "/api/admin/settings/test-email");
      toast(`E-mail de teste enviado para ${r.to.join(", ")}. Confira a caixa de entrada e o spam.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Erro ao enviar o teste.", "error");
    } finally {
      setTesting(false);
    }
  }

  const mail = res.data!.mail;

  const Section = ({ id, title, children, desc }: { id: string; title: string; desc?: string; children: React.ReactNode }) => (
    <section className="surface p-5 sm:p-6" aria-labelledby={id}>
      <h2 id={id} className="font-semibold">
        {title}
      </h2>
      {desc && <p className="mt-1 text-sm text-mist">{desc}</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );

  return (
    <>
      <PageHeader title="Configurações" description="Textos, imagens, contatos e SEO do site. Somente administradores podem alterar." />
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {Section({
          id: "s-banda",
          title: "Banda e textos",
          children: (
            <>
              <Field label="Nome da banda" required error={e.bandName}>
                <input {...bind("bandName")} maxLength={80} />
              </Field>
              <Field label="Identificação musical" required error={e.tagline}>
                <input {...bind("tagline")} maxLength={120} />
              </Field>
              <Field label="Texto do topo (hero)" required error={e.heroText} className="sm:col-span-2">
                <textarea {...bind("heroText")} rows={2} maxLength={400} />
              </Field>
              <Field label="Sobre a banda" required error={e.aboutText} className="sm:col-span-2" hint="Separe parágrafos com uma linha em branco. Não inclua datas, números ou conquistas sem confirmação.">
                <textarea {...bind("aboutText")} rows={8} maxLength={5000} />
              </Field>
            </>
          ),
        })}

        {Section({
          id: "s-img",
          title: "Imagens",
          desc: "Use somente fotos reais e autorizadas da banda.",
          children: (
            <>
              {img("logo", "Logotipo oficial", "PNG com fundo transparente. Sem logo, o site usa a marca tipográfica.", "aspect-[3/1]")}
              {img("heroImage", "Foto do topo", "Foto horizontal de show. Fica atrás do título, escurecida.", "aspect-video")}
              {img("aboutImage", "Foto da seção “A banda”", "Formato vertical (4:5) funciona melhor.", "aspect-[4/5]")}
              {img("ogImage", "Imagem de compartilhamento", "1200 × 630 px, usada em WhatsApp, Instagram e redes ao compartilhar o link.", "aspect-[1200/630]")}
            </>
          ),
        })}

        {Section({
          id: "s-redes",
          title: "Redes sociais",
          desc: "Só aparecem no site os canais preenchidos.",
          children: (
            <>
              <Field label="Instagram oficial" error={e.instagram} hint="@perfil">
                <input {...bind("instagram")} placeholder="@eclipserockoficial" />
              </Field>
              <Field label="YouTube" error={e.youtubeUrl}>
                <input {...bind("youtubeUrl")} type="url" placeholder="https://www.youtube.com/@…" />
              </Field>
              <Field label="Spotify" error={e.spotifyUrl}>
                <input {...bind("spotifyUrl")} type="url" placeholder="https://open.spotify.com/artist/…" />
              </Field>
              <Field label="TikTok" error={e.tiktokUrl}>
                <input {...bind("tiktokUrl")} type="url" placeholder="https://www.tiktok.com/@…" />
              </Field>
              <Field label="Facebook" error={e.facebookUrl}>
                <input {...bind("facebookUrl")} type="url" placeholder="https://www.facebook.com/…" />
              </Field>
            </>
          ),
        })}

        {Section({
          id: "s-contato",
          title: "Contato comercial",
          children: (
            <>
              <Field
                label="WhatsApp comercial"
                error={e.whatsapp}
                hint={v.whatsapp ? `Formato internacional. Exibição: ${formatPhone(v.whatsapp)}` : "55 + DDD + número. Sem número, os botões de WhatsApp ficam ocultos."}
              >
                <input {...bind("whatsapp")} inputMode="tel" placeholder="5511912345678" />
              </Field>
              <Field label="E-mail comercial" error={e.contactEmail}>
                <input {...bind("contactEmail")} type="email" />
              </Field>
              <Field label="Mensagem pré-preenchida do WhatsApp" error={e.whatsappMessage} className="sm:col-span-2">
                <input {...bind("whatsappMessage")} maxLength={300} />
              </Field>
              <Field label="E-mail para privacidade (LGPD)" error={e.privacyEmail} hint="Canal para pedidos de acesso ou exclusão de dados. Se vazio, usa o e-mail comercial.">
                <input {...bind("privacyEmail")} type="email" />
              </Field>
            </>
          ),
        })}

        {Section({
          id: "s-avisos",
          title: "Avisos de novas solicitações",
          desc: "A cada pedido de contratação enviado pelo site, a equipe recebe um e-mail com os dados e um link para o painel. Responder o e-mail fala direto com o contratante.",
          children: (
            <>
              <Field
                label="E-mails que recebem os avisos"
                error={e.notifyEmails}
                className="sm:col-span-2"
                hint="Até 5 endereços, separados por vírgula. Não aparecem no site. Se vazio, usa o e-mail comercial."
              >
                <input {...bind("notifyEmails")} placeholder="contato@eclipserock.com.br, produtor@exemplo.com" autoComplete="off" />
              </Field>
              <div className="sm:col-span-2 flex flex-col gap-3 rounded-lg border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                {mail.provider ? (
                  <p className="flex items-start gap-2 text-sm">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok" aria-hidden />
                    <span>
                      Envio ativo ({mail.provider === "smtp" ? "SMTP" : mail.provider === "resend" ? "Resend" : mail.provider}), remetente{" "}
                      <span className="break-all">{mail.from}</span>.{" "}
                      {mail.recipients.length ? (
                        <span className="text-mist">Destinatários salvos: {mail.recipients.join(", ")}.</span>
                      ) : (
                        <span className="text-warn">Nenhum destinatário salvo ainda.</span>
                      )}
                    </span>
                  </p>
                ) : (
                  <p className="flex items-start gap-2 text-sm">
                    <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
                    <span>
                      O envio de e-mail ainda não foi configurado no servidor. As solicitações continuam chegando no painel. Para ativar, quem
                      cuida da hospedagem define <code>MAIL_FROM</code> e <code>RESEND_API_KEY</code> (ou os dados de SMTP).
                    </span>
                  </p>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm shrink-0"
                  onClick={sendTest}
                  disabled={!mail.provider || !mail.recipients.length || testing}
                  title="Usa a configuração já salva"
                >
                  <Send size={16} aria-hidden /> {testing ? "Enviando…" : "Enviar e-mail de teste"}
                </button>
              </div>
            </>
          ),
        })}

        {Section({
          id: "s-seo",
          title: "SEO e compartilhamento",
          children: (
            <>
              <Field label="Título da página inicial" required error={e.seoTitle} hint={`${v.seoTitle.length}/70 caracteres`}>
                <input {...bind("seoTitle")} maxLength={70} />
              </Field>
              <Field label="Endereço do site" required error={e.siteUrl} hint="Usado em links canônicos, sitemap e compartilhamento.">
                <input {...bind("siteUrl")} type="url" />
              </Field>
              <Field label="Descrição para buscadores" required error={e.seoDescription} className="sm:col-span-2" hint={`${v.seoDescription.length}/200 caracteres`}>
                <textarea {...bind("seoDescription")} rows={2} maxLength={200} />
              </Field>
            </>
          ),
        })}

        <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-line bg-abyss/90 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          <button type="submit" className="btn btn-primary" disabled={form.saving}>
            {form.saving ? "Salvando…" : "Salvar configurações"}
          </button>
        </div>
      </form>
    </>
  );
}
