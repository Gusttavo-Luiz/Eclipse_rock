import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { hashPassword } from "../src/auth";
import { openDb, type DB } from "../src/db";
import type { Mail, Mailer } from "../src/mailer";

const H = { "X-Requested-With": "eclipse-rock" };

function fakeMailer() {
  const m: Mailer & { sent: Mail[]; fail: string | null } = {
    provider: "test",
    from: "Eclipse Rock <avisos@teste.com>",
    sent: [],
    fail: null,
    async send(mail) {
      if (m.fail) throw new Error(m.fail);
      m.sent.push(mail);
    },
  };
  return m;
}

const dbs: DB[] = [];
afterEach(() => {
  while (dbs.length) dbs.pop()!.close();
  vi.restoreAllMocks();
});

async function setup(mailer: ReturnType<typeof fakeMailer> | null) {
  const db = openDb(":memory:");
  dbs.push(db);
  const app = createApp(db, { mailer });
  const ins = db.prepare("INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)");
  ins.run("Ana Admin", "admin@teste.com", "admin", await hashPassword("SenhaAdmin123"));
  ins.run("Edu Editor", "editor@teste.com", "editor", await hashPassword("SenhaEditor123"));
  const login = async (email: string, password: string) => {
    const agent = request.agent(app);
    expect((await agent.post("/api/auth/login").set(H).send({ email, password })).status).toBe(200);
    return agent;
  };
  const admin = await login("admin@teste.com", "SenhaAdmin123");
  const tokenOf = (mail: Mail) => mail.text.match(/#token=([\w-]+)/)?.[1] ?? "";
  const invite = (data: Record<string, unknown> = {}) =>
    admin.post("/api/admin/users").set(H).send({ name: "Bia Baixista", email: "Bia@Banda.com", role: "editor", sendInvite: true, ...data });
  return { db, app, admin, login, tokenOf, invite };
}

describe("convite de usuário por e-mail", () => {
  it("fluxo completo: admin convida, pessoa cria a senha e já entra no painel", async () => {
    const mailer = fakeMailer();
    const { app, admin, tokenOf, invite } = await setup(mailer);

    const res = await invite();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: "bia@banda.com", invitePending: true, inviteError: null, active: true });
    expect(res.body.inviteExpiresAt).toBeTruthy();
    const days = (Date.parse(res.body.inviteExpiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);

    expect(mailer.sent).toHaveLength(1);
    const mail = mailer.sent[0];
    expect(mail.to).toEqual(["bia@banda.com"]);
    expect(mail.subject).toBe("Convite para o painel da Eclipse Rock");
    expect(mail.text).toContain("Ana Admin convidou você");
    expect(mail.text).toContain("editor(a)");
    expect(mail.text).toMatch(/\/admin\/convite#token=/);
    const token = tokenOf(mail);

    // sem senha conhecida, não entra
    expect((await request(app).post("/api/auth/login").set(H).send({ email: "bia@banda.com", password: "" })).status).toBe(422);

    // o token de convite não serve como link de recuperação (e vice-versa)
    expect((await request(app).post("/api/auth/reset/check").set(H).send({ token })).status).toBe(410);

    const check = await request(app).post("/api/auth/invite/check").set(H).send({ token });
    expect(check.body).toEqual({ name: "Bia Baixista", email: "bia@banda.com" });

    const bia = request.agent(app);
    const accept = await bia.post("/api/auth/invite/accept").set(H).send({ token, newPassword: "BiaSenha2026" });
    expect(accept.status).toBe(200);
    expect(accept.body.user).toMatchObject({ email: "bia@banda.com", role: "editor" });
    expect((await bia.get("/api/auth/me")).body.user.email).toBe("bia@banda.com");
    expect((await bia.get("/api/admin/dashboard")).status).toBe(200);

    // uso único
    expect((await request(app).post("/api/auth/invite/accept").set(H).send({ token, newPassword: "Outra2026xx" })).status).toBe(410);

    const users = (await admin.get("/api/admin/users")).body as { email: string; invitePending: boolean; inviteExpiresAt: string | null }[];
    expect(users.find((u) => u.email === "bia@banda.com")).toMatchObject({ invitePending: false, inviteExpiresAt: null });
    expect((await request(app).post("/api/auth/login").set(H).send({ email: "bia@banda.com", password: "BiaSenha2026" })).status).toBe(200);
  });

  it("só admin convida; e-mail duplicado e senha obrigatória sem convite são validados", async () => {
    const mailer = fakeMailer();
    const { login, invite, admin } = await setup(mailer);
    const editor = await login("editor@teste.com", "SenhaEditor123");
    expect((await editor.post("/api/admin/users").set(H).send({ name: "X", email: "x@banda.com", role: "editor", sendInvite: true })).status).toBe(403);

    expect((await invite({ email: "editor@teste.com" })).status).toBe(422);
    const noPw = await admin.post("/api/admin/users").set(H).send({ name: "Sem Senha", email: "s@banda.com", role: "editor" });
    expect(noPw.status).toBe(422);
    expect(noPw.body.fields.password).toMatch(/convite/);

    // caminho antigo (senha inicial) continua funcionando, sem convite
    const withPw = await admin.post("/api/admin/users").set(H).send({ name: "Com Senha", email: "c@banda.com", role: "editor", password: "SenhaInicial123" });
    expect(withPw.status).toBe(201);
    expect(withPw.body.invitePending).toBe(false);
    expect(mailer.sent).toHaveLength(0);
  });

  it("sem e-mail configurado, convite é recusado e a opção fica indisponível", async () => {
    const { app, invite } = await setup(null);
    expect((await invite()).status).toBe(409);
    expect((await request(app).get("/api/auth/options")).body.invites).toBe(false);
  });

  it("falha no envio mantém o usuário pendente; reenvio gera link novo e invalida o anterior", async () => {
    const mailer = fakeMailer();
    const { app, admin, tokenOf, invite } = await setup(mailer);
    vi.spyOn(console, "error").mockImplementation(() => {});

    mailer.fail = "Resend respondeu 403: domain not verified";
    const res = await invite();
    expect(res.status).toBe(201);
    expect(res.body.invitePending).toBe(true);
    expect(res.body.inviteError).toContain("domain not verified");

    mailer.fail = null;
    const r1 = await admin.post(`/api/admin/users/${res.body.id}/invite`).set(H);
    expect(r1.status).toBe(200);
    const first = tokenOf(mailer.sent[0]);
    const r2 = await admin.post(`/api/admin/users/${res.body.id}/invite`).set(H);
    expect(r2.status).toBe(200);
    const second = tokenOf(mailer.sent[1]);
    expect((await request(app).post("/api/auth/invite/check").set(H).send({ token: first })).status).toBe(410);
    expect((await request(app).post("/api/auth/invite/check").set(H).send({ token: second })).status).toBe(200);

    mailer.fail = "connect ECONNREFUSED";
    const r3 = await admin.post(`/api/admin/users/${res.body.id}/invite`).set(H);
    expect(r3.status).toBe(502);
  });

  it("não reenvia convite para quem já tem senha ou está desativado", async () => {
    const mailer = fakeMailer();
    const { db, admin, invite } = await setup(mailer);
    const editorId = (db.prepare("SELECT id FROM users WHERE email = 'editor@teste.com'").get() as { id: number }).id;
    expect((await admin.post(`/api/admin/users/${editorId}/invite`).set(H)).status).toBe(409);

    const res = await invite();
    await admin.put(`/api/admin/users/${res.body.id}`).set(H).send({ name: "Bia Baixista", role: "editor", active: false });
    expect((await admin.post(`/api/admin/users/${res.body.id}/invite`).set(H)).status).toBe(409);
  });

  it("conta desativada não aceita o convite", async () => {
    const mailer = fakeMailer();
    const { app, admin, tokenOf, invite } = await setup(mailer);
    const res = await invite();
    await admin.put(`/api/admin/users/${res.body.id}`).set(H).send({ name: "Bia Baixista", role: "editor", active: false });
    const accept = await request(app).post("/api/auth/invite/accept").set(H).send({ token: tokenOf(mailer.sent[0]), newPassword: "BiaSenha2026" });
    expect(accept.status).toBe(410);
  });

  it("senha definida pelo admin conclui o convite e invalida o link", async () => {
    const mailer = fakeMailer();
    const { app, admin, tokenOf, invite } = await setup(mailer);
    const res = await invite();
    const upd = await admin
      .put(`/api/admin/users/${res.body.id}`)
      .set(H)
      .send({ name: "Bia Baixista", role: "editor", active: true, password: "DefinidaAdmin123" });
    expect(upd.body).toMatchObject({ invitePending: false, inviteExpiresAt: null });
    const token = tokenOf(mailer.sent[0]);
    expect((await request(app).post("/api/auth/invite/check").set(H).send({ token })).status).toBe(410);
  });

  it("convite expira em 7 dias", async () => {
    const mailer = fakeMailer();
    const { app, db, tokenOf, invite, admin } = await setup(mailer);
    const res = await invite();
    db.prepare("UPDATE password_resets SET expires_at = ? WHERE kind = 'invite'").run(new Date(Date.now() - 1000).toISOString());
    const token = tokenOf(mailer.sent[0]);
    expect((await request(app).post("/api/auth/invite/accept").set(H).send({ token, newPassword: "BiaSenha2026" })).status).toBe(410);
    const users = (await admin.get("/api/admin/users")).body as { id: number; invitePending: boolean; inviteExpiresAt: string | null }[];
    expect(users.find((u) => u.id === res.body.id)).toMatchObject({ invitePending: true, inviteExpiresAt: null });
  });

  it("convidado que pede recuperação de senha também conclui o convite", async () => {
    const mailer = fakeMailer();
    const { app, admin, invite } = await setup(mailer);
    const res = await invite();
    await request(app).post("/api/auth/forgot").set(H).send({ email: "bia@banda.com" });
    await vi.waitFor(() => expect(mailer.sent).toHaveLength(2));
    const resetToken = mailer.sent[1].text.match(/#token=([\w-]+)/)![1];
    expect((await request(app).post("/api/auth/reset").set(H).send({ token: resetToken, newPassword: "BiaSenha2026" })).status).toBe(200);
    const users = (await admin.get("/api/admin/users")).body as { id: number; invitePending: boolean }[];
    expect(users.find((u) => u.id === res.body.id)?.invitePending).toBe(false);
  });
});
