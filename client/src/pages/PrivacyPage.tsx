import { Link } from "react-router-dom";
import { LoadingState } from "../components/States";
import { instagramUrl } from "../lib/links";
import { useSeo } from "../lib/seo";
import { useSite } from "../lib/site";

export function PrivacyPage() {
  const { data } = useSite();
  const s = data?.settings;
  useSeo(s ? `Política de Privacidade | ${s.bandName}` : undefined);
  if (!s) return <LoadingState className="min-h-[70svh] pt-24" />;

  const email = s.privacyEmail ?? s.contactEmail;
  const channel = email ? (
    <a href={`mailto:${email}`} className="text-violet-soft underline underline-offset-2">
      {email}
    </a>
  ) : s.instagram ? (
    <>
      mensagem direta no Instagram oficial{" "}
      <a href={instagramUrl(s.instagram)} target="_blank" rel="noopener noreferrer" className="text-violet-soft underline underline-offset-2">
        @{s.instagram}
      </a>
    </>
  ) : (
    "os canais de contato indicados neste site"
  );

  return (
    <div className="container-page pb-24 pt-32 sm:pt-40">
      <h1 className="display text-[clamp(3rem,9vw,6rem)]">Política de Privacidade</h1>
      <p className="mt-4 text-mist">Atualizada em outubro de 2026.</p>

      <div className="mt-12 max-w-[68ch] space-y-10 text-moon/85 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:font-extrabold [&_h2]:uppercase [&_h2]:text-moon [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">
        <section>
          <h2>Quem somos</h2>
          <p>
            Este é o site oficial da banda {s.bandName}, responsável (controladora) pelos dados pessoais enviados por aqui, nos termos da Lei
            Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
          </p>
        </section>

        <section>
          <h2>Quais dados coletamos</h2>
          <p>Só coletamos dados que você mesmo envia pelo formulário de contratação:</p>
          <ul className="mt-3">
            <li>nome, telefone/WhatsApp e e-mail;</li>
            <li>empresa ou nome do evento, tipo de evento, data, cidade, estado, local e público estimado;</li>
            <li>a mensagem que você escrever.</li>
          </ul>
          <p className="mt-3">
            Não usamos cookies de publicidade nem ferramentas de rastreamento no site público. O endereço IP é usado apenas
            momentaneamente para limitar envios abusivos e não é armazenado junto com a sua solicitação.
          </p>
        </section>

        <section>
          <h2>Para que usamos</h2>
          <ul>
            <li>responder à sua solicitação e enviar proposta de apresentação;</li>
            <li>combinar detalhes do evento, caso a contratação avance.</li>
          </ul>
          <p className="mt-3">
            A base legal é o seu consentimento e a execução de procedimentos preliminares a um contrato (art. 7º, I e V, da LGPD). Seus dados
            não são vendidos nem usados para outras finalidades.
          </p>
        </section>

        <section>
          <h2>Com quem compartilhamos</h2>
          <p>
            Os dados ficam disponíveis apenas para a equipe autorizada da banda, no painel administrativo protegido por senha, e no provedor
            de hospedagem do site. Não compartilhamos com terceiros para fins comerciais.
          </p>
        </section>

        <section>
          <h2>Por quanto tempo guardamos</h2>
          <p>
            Pelo tempo necessário para atender à solicitação e cumprir eventuais obrigações legais. Você pode pedir a exclusão a qualquer
            momento.
          </p>
        </section>

        <section>
          <h2>Cookies e conteúdo de terceiros</h2>
          <ul>
            <li>Um cookie essencial de sessão é usado apenas na área restrita da equipe, para manter o login.</li>
            <li>
              Vídeos do YouTube só são carregados quando você clica para assistir (modo de privacidade reforçada); a partir daí, valem as
              políticas do YouTube/Google.
            </li>
            <li>Links para Instagram, WhatsApp, mapas e sites de venda de ingressos seguem as políticas desses serviços.</li>
          </ul>
        </section>

        <section>
          <h2>Seus direitos</h2>
          <p>
            Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade ou exclusão dos seus dados, além de
            revogar o consentimento (art. 18 da LGPD).
          </p>
          <p className="mt-3">Para isso, fale com a gente por {channel}.</p>
        </section>

        <p>
          <Link to="/" className="btn btn-ghost">
            Voltar ao site
          </Link>
        </p>
      </div>
    </div>
  );
}
