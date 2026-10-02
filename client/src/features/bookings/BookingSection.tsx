import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { EVENT_TYPES, UFS } from "../../../../shared/constants";
import { todayISO, type PublicSettings } from "../../../../shared/types";
import { Field } from "../../components/Field";
import { InstagramIcon } from "../../components/icons";
import { WhatsAppButton } from "../../components/WhatsAppButton";
import { ApiError, apiSend } from "../../lib/api";
import { formatPhone } from "../../lib/format";
import { instagramUrl } from "../../lib/links";

const EMPTY = {
  name: "",
  company: "",
  phone: "",
  email: "",
  eventType: "",
  eventDate: "",
  city: "",
  state: "",
  venue: "",
  audience: "",
  message: "",
  consent: false,
  website: "",
};
type Form = typeof EMPTY;

export function BookingSection({ settings }: { settings: PublicSettings }) {
  return (
    <section id="contrate" aria-labelledby="contrate-title" className="relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_10%_20%,rgb(123_63_228/0.22),transparent_50%),radial-gradient(ellipse_at_90%_90%,rgb(224_53_155/0.14),transparent_45%)]" />
      <div className="container-page grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 id="contrate-title" className="display text-[clamp(2.75rem,7.5vw,5rem)]">
            Leve a Eclipse Rock para o seu evento
          </h2>
          <p className="mt-6 max-w-lg text-lg text-moon/85">
            Bares, casas de show, festivais, eventos corporativos e festas: conte como é o seu evento e a equipe responde com
            disponibilidade e proposta.
          </p>
          <ul className="mt-8 space-y-3 text-moon/85">
            {["Repertório de rock 2000s, pop punk, emo e tributo à Pitty", "Atendimento direto com a equipe da banda", "Resposta pelo telefone ou e-mail que você informar"].map((t) => (
              <li key={t} className="flex gap-3">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-magenta-soft" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
          {(settings.whatsapp || settings.contactEmail) && (
            <div className="mt-10">
              <p className="mb-3 text-sm font-semibold text-mist">Prefere falar direto?</p>
              <div className="flex flex-wrap gap-3">
                <WhatsAppButton settings={settings} />
                {settings.contactEmail && (
                  <a href={`mailto:${settings.contactEmail}?subject=${encodeURIComponent("Contratação — Eclipse Rock")}`} className="btn btn-ghost">
                    <Mail size={18} aria-hidden />
                    {settings.contactEmail}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="surface p-5 sm:p-8">
          <BookingForm settings={settings} />
        </div>
      </div>
    </section>
  );
}

export function BookingForm({ settings }: { settings: PublicSettings }) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const today = todayISO();

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  function focusFirstError(errs: Record<string, string>) {
    const first = Object.keys(errs).find((k) => errs[k]);
    if (!first) return;
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "sending") return; // impede envio duplicado
    setServerError(null);
    // validação carregada sob demanda (mantém o zod fora do carregamento inicial da página)
    const { bookingInput, fieldErrors } = await import("../../../../shared/schemas");
    const parsed = bookingInput.safeParse(form);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      focusFirstError(errs);
      return;
    }
    setStatus("sending");
    try {
      await apiSend("POST", "/api/public/bookings", form);
      setStatus("sent");
      setForm(EMPTY);
      requestAnimationFrame(() => doneRef.current?.focus());
    } catch (err) {
      setStatus("idle");
      if (err instanceof ApiError && err.fields) {
        setErrors(err.fields);
        focusFirstError(err.fields);
      }
      setServerError(err instanceof ApiError ? err.message : "Não foi possível enviar agora. Tente novamente.");
    }
  }

  if (status === "sent") {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" className="flex flex-col items-start gap-4 py-6 outline-none">
        <CheckCircle2 size={44} className="text-ok" aria-hidden />
        <h3 className="display text-4xl">Solicitação recebida</h3>
        <p className="text-moon/85">
          Seus dados foram registrados e a equipe da {settings.bandName} vai entrar em contato pelo telefone ou e-mail informado.
        </p>
        <div className="flex flex-wrap gap-3">
          <WhatsAppButton settings={settings} label="Adiantar a conversa no WhatsApp" />
          <button type="button" className="btn btn-ghost" onClick={() => setStatus("idle")}>
            Enviar outra solicitação
          </button>
        </div>
      </div>
    );
  }

  const input = (k: keyof Form, props: Record<string, unknown> = {}) => ({
    name: k,
    className: "input",
    value: form[k] as string,
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
    ...props,
  });

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-labelledby="form-title" aria-busy={status === "sending"}>
      <h3 id="form-title" className="text-xl font-semibold">
        Solicitar orçamento
      </h3>
      <p className="mt-1 text-sm text-mist">
        Campos com <span className="text-magenta-soft">*</span> são obrigatórios.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Seu nome" required error={errors.name}>
          <input {...input("name")} autoComplete="name" maxLength={120} />
        </Field>
        <Field label="Empresa ou evento" error={errors.company}>
          <input {...input("company")} autoComplete="organization" maxLength={140} />
        </Field>
        <Field label="Telefone ou WhatsApp" required error={errors.phone}>
          <input
            {...input("phone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 91234-5678"
            maxLength={20}
            onBlur={() => form.phone && set("phone", formatPhone(form.phone))}
          />
        </Field>
        <Field label="E-mail" required error={errors.email}>
          <input {...input("email")} type="email" inputMode="email" autoComplete="email" maxLength={254} />
        </Field>
        <Field label="Tipo de evento" required error={errors.eventType}>
          <select {...input("eventType")}>
            <option value="">Selecione</option>
            {EVENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Data prevista" required error={errors.eventDate}>
          <input {...input("eventDate")} type="date" min={today} />
        </Field>
        <Field label="Cidade" required error={errors.city}>
          <input {...input("city")} autoComplete="address-level2" maxLength={80} />
        </Field>
        <Field label="Estado" required error={errors.state}>
          <select {...input("state")} autoComplete="address-level1">
            <option value="">UF</option>
            {UFS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </Field>
        <Field label="Local ou estabelecimento" error={errors.venue}>
          <input {...input("venue")} maxLength={140} />
        </Field>
        <Field label="Público estimado" error={errors.audience}>
          <input {...input("audience")} type="number" inputMode="numeric" min={1} placeholder="Ex.: 200" />
        </Field>
        <Field label="Mensagem" error={errors.message} className="sm:col-span-2" hint="Horário, duração do show, estrutura de som disponível…">
          <textarea {...input("message")} maxLength={2000} rows={4} />
        </Field>

        {/* honeypot: invisível para pessoas, preenchido por robôs */}
        <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
          <label>
            Não preencha este campo
            <input name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} />
          </label>
        </div>

        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-moon/85">
            <input
              type="checkbox"
              name="consent"
              checked={form.consent}
              onChange={(e) => set("consent", e.target.checked)}
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={errors.consent ? "consent-err" : undefined}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#E0359B]"
            />
            <span>
              Concordo que a {settings.bandName} use estes dados para responder à minha solicitação, conforme a{" "}
              <Link to="/privacidade" className="text-violet-soft underline underline-offset-2 hover:text-magenta-soft" target="_blank">
                Política de Privacidade
              </Link>
              .
            </span>
          </label>
          {errors.consent && (
            <p id="consent-err" className="field-error">
              {errors.consent}
            </p>
          )}
        </div>
      </div>

      {serverError && (
        <div role="alert" className="mt-6 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-moon">
          {serverError}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="submit" className="btn btn-primary" disabled={status === "sending"}>
          {status === "sending" && <Loader2 size={18} className="animate-spin" aria-hidden />}
          {status === "sending" ? "Enviando…" : "Enviar solicitação"}
        </button>
        {settings.instagram && !settings.whatsapp && (
          <a href={instagramUrl(settings.instagram)} target="_blank" rel="noopener noreferrer" className="btn btn-quiet text-mist">
            <InstagramIcon size={18} />
            Ou fale pelo Instagram
          </a>
        )}
      </div>
    </form>
  );
}
