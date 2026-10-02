import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { hashPassword } from "../src/auth";
import { openDb, type DB } from "../src/db";
import { createMailer, type Mail, type Mailer } from "../src/mailer";

const H = { "X-Requested-With": "eclipse-rock" };
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const booking = {
  name: "Maria Contratante",
  company: "Festival <Rock>",
  phone: "(11) 91234-5678",
  email: "maria@exemplo.com",
  eventType: "Festival",
  eventDate: future(60),
  city: "Campinas",
  state: "SP",
  venue: "",
  audience: "300",
  message: "Orçamento, por favor. <script>alert(1)</script>",
  consent: true,
  website: "",
};

/** Mailer falso: guarda os envios e pode simular falha do provedor. */
function fakeMailer() {
  const sent: Mail[] = [];
  const m: Mailer & { sent: Mail[]; fail: string | null } = {
    provider: "test",
    from: "Eclipse Rock <avisos@teste.com>",
    sent,
    fail: null,
    async send(mail) {
      if (m.fail) throw new Error(m.fail);
      sent.push(mail);
    },
  };
  return m;
}

const dbs: DB[] = [];
afterEach(() => {
  while (dbs.length) dbs.pop()!.close();
  vi.unstubAllGlobals();
});

async function setup(mailer: Mailer | null) {
  const db = openDb(":memory:");
  dbs.push(db);
  const app = createApp(db, { mailer });
  const ins = db.prepare("INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)");
  ins.run("Admin", "admin@teste.com", "admin", await hashPassword("SenhaAdmin123"));
  ins.run("Editor", "editor@teste.com", "editor", await hashPassword("SenhaEditor123"));
  const login = async (email: string, password: string) => {
    const agent = request.agent(app);
    expect((await agent.post("/api/auth/login").set(H).send({ email, password })).status).toBe(200);
    return agent;
  };
  /** Salva configurações mantendo as atuais. */
  const saveSettings = async (agent: request.Agent, patch: Record<string, unknown>) => {
    const cur = (await agent.get("/api/admin/settings")).body;
    return agent.put("/api/admin/settings").set(H).send({ ...cur, ...patch });
  };
  /** Envia uma solicitação e espera o aviso (assíncrono) ser registrado. */
  const submit = async () => {
    const res = await request(app).post("/api/public/bookings").send(booking);
    expect(res.status).toBe(201);
    const id = res.body.id as number;
    await vi.waitFor(() => {
      const r = db.prepare("SELECT notify_status FROM booking_requests WHERE id = ?").get(id) as { notify_status: string | null };
      expect(r.notify_status).not.toBeNull();
    });
    return id;
  };
  return { db, app, login, saveSettings, submit };
}

describe("aviso de nova solicitação por e-mail", () => {
  it("sem provedor configurado, salva a solicitação e registra que o aviso não foi enviado", async () => {
    const { login, submit } = await setup(null);
    const id = await submit();
    const admin = await login("admin@teste.com", "SenhaAdmin123");
    const detail = await admin.get(`/api/admin/bookings/${id}`);
    expect(detail.body.booking.notification).toMatchObject({ status: "skipped" });
    expect((await admin.get("/api/admin/settings")).body.mail).toEqual({ provider: null, from: null, recipients: [] });
  });

  it("sem destinatário, não envia e explica o motivo", async () => {
    const mailer = fakeMailer();
    const { login, submit } = await setup(mailer);
    const id = await submit();
    expect(mailer.sent).toHaveLength(0);
    const admin = await login("admin@teste.com", "SenhaAdmin123");
    const n = (await admin.get(`/api/admin/bookings/${id}`)).body.booking.notification;
    expect(n.status).toBe("skipped");
    expect(n.detail).toMatch(/destinatário/);
  });

  it("usa o e-mail comercial quando não há lista de avisos e escapa o conteúdo", async () => {
    const mailer = fakeMailer();
    const { login, saveSettings, submit } = await setup(mailer);
    const admin = await login("admin@teste.com", "SenhaAdmin123");
    expect((await saveSettings(admin, { contactEmail: "contato@banda.com" })).status).toBe(200);

    const id = await submit();
    expect(mailer.sent).toHaveLength(1);
    const mail = mailer.sent[0];
    expect(mail.to).toEqual(["contato@banda.com"]);
    expect(mail.replyTo).toBe("maria@exemplo.com");
    expect(mail.subject).toContain("Festival em Campinas/SP");
    expect(mail.text).toContain("(11) 91234-5678");
    expect(mail.text).toContain(`/admin/solicitacoes/${id}`);
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("Festival &lt;Rock&gt;");
    expect(mail.html).not.toContain("<script>");

    const n = (await admin.get(`/api/admin/bookings/${id}`)).body.booking.notification;
    expect(n.status).toBe("sent");
  });

  it("valida a lista de avisos, remove duplicados e não a expõe no site público", async () => {
    const mailer = fakeMailer();
    const { app, login, saveSettings, submit } = await setup(mailer);
    const admin = await login("admin@teste.com", "SenhaAdmin123");

    const bad = await saveSettings(admin, { notifyEmails: "ok@banda.com, invalido" });
    expect(bad.status).toBe(422);
    expect(bad.body.fields.notifyEmails).toBeTruthy();

    const many = await saveSettings(admin, { notifyEmails: "a@b.com,c@d.com,e@f.com,g@h.com,i@j.com,k@l.com" });
    expect(many.status).toBe(422);

    const ok = await saveSettings(admin, { contactEmail: "contato@banda.com", notifyEmails: "Produtor@Banda.com; produtor@banda.com, vocal@banda.com" });
    expect(ok.status).toBe(200);
    expect(ok.body.notifyEmails).toEqual(["produtor@banda.com", "vocal@banda.com"]);
    expect(ok.body.mail).toMatchObject({ provider: "test", recipients: ["produtor@banda.com", "vocal@banda.com"] });

    const pub = await request(app).get("/api/public/settings");
    expect(pub.body.notifyEmails).toBeUndefined();
    expect(pub.body.mail).toBeUndefined();
    expect(JSON.stringify(pub.body)).not.toContain("produtor@banda.com");

    await submit();
    expect(mailer.sent[0].to).toEqual(["produtor@banda.com", "vocal@banda.com"]);
  });

  it("falha do provedor não perde a solicitação, fica registrada e pode ser reenviada", async () => {
    const mailer = fakeMailer();
    const { db, app, login, saveSettings, submit } = await setup(mailer);
    const admin = await login("admin@teste.com", "SenhaAdmin123");
    await saveSettings(admin, { notifyEmails: "contato@banda.com" });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    mailer.fail = "Resend respondeu 403: domain not verified";
    const id = await submit();
    const n = (await admin.get(`/api/admin/bookings/${id}`)).body.booking.notification;
    expect(n).toMatchObject({ status: "failed", detail: "Resend respondeu 403: domain not verified" });
    // log sem dados do contratante
    expect(JSON.stringify(err.mock.calls)).not.toContain("maria@exemplo.com");
    expect(db.prepare("SELECT COUNT(*) n FROM audit_log WHERE action = 'notify_failed'").get()).toEqual({ n: 1 });
    err.mockRestore();

    mailer.fail = null;
    const editor = await login("editor@teste.com", "SenhaEditor123");
    const again = await editor.post(`/api/admin/bookings/${id}/notify`).set(H);
    expect(again.status).toBe(200);
    expect(again.body.notification.status).toBe("sent");
    expect(mailer.sent).toHaveLength(1);
    expect((await request(app).post(`/api/admin/bookings/${id}/notify`).set(H)).status).toBe(401);
  });

  it("e-mail de teste: só admin, exige provedor e destinatário", async () => {
    const off = await setup(null);
    const offAdmin = await off.login("admin@teste.com", "SenhaAdmin123");
    expect((await offAdmin.post("/api/admin/settings/test-email").set(H)).status).toBe(409);

    const mailer = fakeMailer();
    const { login, saveSettings } = await setup(mailer);
    const admin = await login("admin@teste.com", "SenhaAdmin123");
    const editor = await login("editor@teste.com", "SenhaEditor123");
    expect((await editor.post("/api/admin/settings/test-email").set(H)).status).toBe(403);
    expect((await admin.post("/api/admin/settings/test-email").set(H)).status).toBe(422);

    await saveSettings(admin, { notifyEmails: "contato@banda.com" });
    const ok = await admin.post("/api/admin/settings/test-email").set(H);
    expect(ok.status).toBe(200);
    expect(ok.body.to).toEqual(["contato@banda.com"]);
    expect(mailer.sent[0].subject).toContain("Teste");

    mailer.fail = "connect ECONNREFUSED";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fail = await admin.post("/api/admin/settings/test-email").set(H);
    expect(fail.status).toBe(502);
    expect(fail.body.error).toContain("ECONNREFUSED");
  });
});

describe("escolha do provedor", () => {
  const base = { from: "", resendApiKey: "", smtp: { host: "", port: 587, secure: false, user: "", pass: "" } };

  it("desliga sem remetente e prioriza Resend sobre SMTP", () => {
    expect(createMailer(base)).toBeNull();
    expect(createMailer({ ...base, resendApiKey: "re_x" })).toBeNull();
    expect(createMailer({ ...base, from: "a@b.com" })).toBeNull();
    expect(createMailer({ ...base, from: "a@b.com", smtp: { ...base.smtp, host: "smtp.b.com" } })?.provider).toBe("smtp");
    expect(createMailer({ ...base, from: "a@b.com", resendApiKey: "re_x", smtp: { ...base.smtp, host: "smtp.b.com" } })?.provider).toBe("resend");
  });

  it("chama a API do Resend com autenticação e trata erro", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const m = createMailer({ ...base, from: "Banda <a@b.com>", resendApiKey: "re_123" })!;
    await m.send({ to: ["x@y.com"], subject: "Oi", text: "t", html: "<p>t</p>", replyTo: "r@y.com" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_123");
    expect(JSON.parse(init.body as string)).toMatchObject({ from: "Banda <a@b.com>", to: ["x@y.com"], reply_to: "r@y.com" });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Invalid API key" }), { status: 401 }));
    await expect(m.send({ to: ["x@y.com"], subject: "Oi", text: "t", html: "t" })).rejects.toThrow("401: Invalid API key");
  });
});
