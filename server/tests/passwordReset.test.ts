import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { hashPassword } from "../src/auth";
import { openDb, type DB } from "../src/db";
import type { Mail, Mailer } from "../src/mailer";

const H = { "X-Requested-With": "eclipse-rock" };

function fakeMailer() {
  const sent: Mail[] = [];
  const m: Mailer & { sent: Mail[] } = {
    provider: "test",
    from: "Eclipse Rock <avisos@teste.com>",
    sent,
    async send(mail) {
      sent.push(mail);
    },
  };
  return m;
}

const dbs: DB[] = [];
afterEach(() => {
  while (dbs.length) dbs.pop()!.close();
  vi.useRealTimers();
});

async function setup(mailer: Mailer | null) {
  const db = openDb(":memory:");
  dbs.push(db);
  const app = createApp(db, { mailer });
  const ins = db.prepare("INSERT INTO users (name, email, role, password_hash, active) VALUES (?, ?, ?, ?, ?)");
  ins.run("Ana Admin", "admin@teste.com", "admin", await hashPassword("SenhaAdmin123"), 1);
  ins.run("Inativo", "inativo@teste.com", "editor", await hashPassword("SenhaInativo123"), 0);
  const login = (email: string, password: string) => request.agent(app).post("/api/auth/login").set(H).send({ email, password });
  const forgot = (email: string) => request(app).post("/api/auth/forgot").set(H).send({ email });
  /** Extrai o token do último e-mail de recuperação. */
  const lastToken = () => {
    const mail = [...(mailer as ReturnType<typeof fakeMailer>).sent].reverse().find((m) => m.subject.startsWith("Redefinir"));
    return mail?.text.match(/#token=([\w-]+)/)?.[1] ?? null;
  };
  return { db, app, login, forgot, lastToken };
}

describe("recuperação de senha por e-mail", () => {
  it("fluxo completo: pede link, troca a senha, encerra sessões e avisa por e-mail", async () => {
    const mailer = fakeMailer();
    const { app, db, login, forgot, lastToken } = await setup(mailer);

    // sessão aberta antes da troca
    const agent = request.agent(app);
    await agent.post("/api/auth/login").set(H).send({ email: "admin@teste.com", password: "SenhaAdmin123" });
    expect((await agent.get("/api/auth/me")).body.user).not.toBeNull();

    expect((await request(app).get("/api/auth/options")).body).toEqual({ passwordReset: true });
    const res = await forgot("ADMIN@teste.com");
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(mailer.sent).toHaveLength(1));
    const mail = mailer.sent[0];
    expect(mail.to).toEqual(["admin@teste.com"]);
    expect(mail.text).toContain("Olá, Ana!");
    expect(mail.text).toMatch(/\/admin\/redefinir-senha#token=/);
    const token = lastToken()!;

    // só o hash fica no banco
    const stored = db.prepare("SELECT token_hash FROM password_resets").get() as { token_hash: string };
    expect(stored.token_hash).not.toBe(token);

    expect((await request(app).post("/api/auth/reset/check").set(H).send({ token })).status).toBe(200);

    const weak = await request(app).post("/api/auth/reset").set(H).send({ token, newPassword: "curta" });
    expect(weak.status).toBe(422);
    expect(weak.body.fields.newPassword).toBeTruthy();

    const ok = await request(app).post("/api/auth/reset").set(H).send({ token, newPassword: "NovaSenha2026" });
    expect(ok.status).toBe(200);

    expect((await agent.get("/api/auth/me")).body.user).toBeNull();
    expect((await login("admin@teste.com", "SenhaAdmin123")).status).toBe(401);
    expect((await login("admin@teste.com", "NovaSenha2026")).status).toBe(200);

    // uso único
    const again = await request(app).post("/api/auth/reset").set(H).send({ token, newPassword: "OutraSenha2026" });
    expect(again.status).toBe(410);
    expect((await request(app).post("/api/auth/reset/check").set(H).send({ token })).status).toBe(410);

    await vi.waitFor(() => expect(mailer.sent.some((m) => m.subject.startsWith("Sua senha foi alterada"))).toBe(true));
    expect(db.prepare("SELECT summary FROM audit_log WHERE entity = 'user' AND action = 'update'").get()).toEqual({
      summary: "Senha redefinida pelo link enviado por e-mail",
    });
  });

  it("não revela se o e-mail existe e não envia para conta inexistente ou inativa", async () => {
    const mailer = fakeMailer();
    const { forgot } = await setup(mailer);
    const a = await forgot("admin@teste.com");
    const b = await forgot("ninguem@teste.com");
    const c = await forgot("inativo@teste.com");
    expect([a.status, b.status, c.status]).toEqual([200, 200, 200]);
    expect(a.body).toEqual(b.body);
    expect(b.body).toEqual(c.body);
    await new Promise((r) => setTimeout(r, 20));
    expect(mailer.sent.map((m) => m.to[0])).toEqual(["admin@teste.com"]);
  });

  it("um link novo invalida o anterior e há limite de links por hora", async () => {
    const mailer = fakeMailer();
    const { app, forgot, lastToken } = await setup(mailer);
    await forgot("admin@teste.com");
    const first = lastToken()!;
    await forgot("admin@teste.com");
    const second = lastToken()!;
    expect(second).not.toBe(first);
    expect((await request(app).post("/api/auth/reset/check").set(H).send({ token: first })).status).toBe(410);
    expect((await request(app).post("/api/auth/reset/check").set(H).send({ token: second })).status).toBe(200);

    await forgot("admin@teste.com"); // 3º link na hora
    const third = lastToken();
    expect((await forgot("admin@teste.com")).status).toBe(200); // 4º: resposta igual, mas sem e-mail
    expect(lastToken()).toBe(third);
    expect(mailer.sent).toHaveLength(3);
  });

  it("link expira em 60 minutos", async () => {
    const mailer = fakeMailer();
    const { app, db, forgot, lastToken } = await setup(mailer);
    await forgot("admin@teste.com");
    const token = lastToken()!;
    db.prepare("UPDATE password_resets SET expires_at = ?").run(new Date(Date.now() - 1000).toISOString());
    const res = await request(app).post("/api/auth/reset").set(H).send({ token, newPassword: "NovaSenha2026" });
    expect(res.status).toBe(410);
  });

  it("conta desativada depois do pedido não consegue usar o link", async () => {
    const mailer = fakeMailer();
    const { app, db, forgot, lastToken } = await setup(mailer);
    await forgot("admin@teste.com");
    db.prepare("UPDATE users SET active = 0 WHERE email = 'admin@teste.com'").run();
    const res = await request(app).post("/api/auth/reset").set(H).send({ token: lastToken(), newPassword: "NovaSenha2026" });
    expect(res.status).toBe(410);
  });

  it("sem e-mail configurado, a opção fica indisponível", async () => {
    const { app, forgot } = await setup(null);
    expect((await request(app).get("/api/auth/options")).body).toEqual({ passwordReset: false });
    expect((await forgot("admin@teste.com")).status).toBe(503);
  });

  it("exige o cabeçalho anti-CSRF e limita pedidos por IP", async () => {
    const mailer = fakeMailer();
    const { app, forgot } = await setup(mailer);
    expect((await request(app).post("/api/auth/forgot").send({ email: "admin@teste.com" })).status).toBe(403);
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await forgot(`x${i}@teste.com`)).status);
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it("troca de senha logada também avisa por e-mail", async () => {
    const mailer = fakeMailer();
    const { app } = await setup(mailer);
    const agent = request.agent(app);
    await agent.post("/api/auth/login").set(H).send({ email: "admin@teste.com", password: "SenhaAdmin123" });
    const res = await agent.post("/api/auth/password").set(H).send({ currentPassword: "SenhaAdmin123", newPassword: "NovaSenha2026" });
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(mailer.sent[0]?.subject).toMatch(/^Sua senha foi alterada/));
  });

  it("em desenvolvimento, sem SITE_URL, o link aponta para o endereço local", async () => {
    const mailer = fakeMailer();
    const { app } = await setup(mailer);
    await request(app).post("/api/auth/forgot").set(H).set("Host", "localhost:5173").send({ email: "admin@teste.com" });
    await vi.waitFor(() => expect(mailer.sent).toHaveLength(1));
    expect(mailer.sent[0].text).toContain("http://localhost:5173/admin/redefinir-senha#token=");
  });
});
