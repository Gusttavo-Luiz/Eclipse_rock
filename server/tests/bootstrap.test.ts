import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { hashPassword } from "../src/auth";
import { bootstrapAdmin } from "../src/bootstrap";
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
const fresh = () => {
  const db = openDb(":memory:");
  dbs.push(db);
  return db;
};
afterEach(() => {
  while (dbs.length) dbs.pop()!.close();
  vi.restoreAllMocks();
});
const quiet = () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
};
const opts = { email: "dona@banda.com", name: "Dona da Banda" };

describe("primeiro administrador por ADMIN_EMAIL", () => {
  it("banco vazio: cria o admin pendente, envia convite e ele entra pelo link", async () => {
    quiet();
    const db = fresh();
    const mailer = fakeMailer();
    expect(await bootstrapAdmin(db, mailer, opts)).toBe("sent");
    expect(db.prepare("SELECT name, role, invite_pending FROM users").all()).toEqual([
      { name: "Dona da Banda", role: "admin", invite_pending: 1 },
    ]);
    const mail = mailer.sent[0];
    expect(mail.to).toEqual(["dona@banda.com"]);
    expect(mail.text).toContain("Você foi convidado(a) para o painel da Eclipse Rock como administrador(a)");
    expect(mail.text).toContain("https://eclipserock.com.br/admin/convite#token=");

    const app = createApp(db, { mailer });
    const token = mail.text.match(/#token=([\w-]+)/)![1];
    const res = await request(app).post("/api/auth/invite/accept").set(H).send({ token, newPassword: "DonaSenha2026" });
    expect(res.body.user).toMatchObject({ email: "dona@banda.com", role: "admin" });

    // depois disso, reiniciar o servidor não faz mais nada
    expect(await bootstrapAdmin(db, mailer, opts)).toBe("has-users");
    expect(mailer.sent).toHaveLength(1);
  });

  it("não reenvia a cada reinício enquanto o convite vale; reenvia se expirou", async () => {
    quiet();
    const db = fresh();
    const mailer = fakeMailer();
    await bootstrapAdmin(db, mailer, opts);
    expect(await bootstrapAdmin(db, mailer, opts)).toBe("invite-valid");
    expect(mailer.sent).toHaveLength(1);
    db.prepare("UPDATE password_resets SET expires_at = ?").run(new Date(Date.now() - 1000).toISOString());
    expect(await bootstrapAdmin(db, mailer, opts)).toBe("sent");
    expect(mailer.sent).toHaveLength(2);
    expect((db.prepare("SELECT COUNT(*) n FROM users").get() as { n: number }).n).toBe(1);
  });

  it("falha no envio libera nova tentativa no próximo reinício", async () => {
    quiet();
    const db = fresh();
    const mailer = fakeMailer();
    mailer.fail = "domain not verified";
    expect(await bootstrapAdmin(db, mailer, opts)).toBe("failed");
    mailer.fail = null;
    expect(await bootstrapAdmin(db, mailer, opts)).toBe("sent");
  });

  it("não faz nada se já há quem entre no painel, sem ADMIN_EMAIL ou sem e-mail configurado", async () => {
    quiet();
    const db = fresh();
    const mailer = fakeMailer();
    expect(await bootstrapAdmin(db, mailer, { email: "", name: "" })).toBe("skipped");
    expect(await bootstrapAdmin(db, null, opts)).toBe("no-mailer");
    expect((db.prepare("SELECT COUNT(*) n FROM users").get() as { n: number }).n).toBe(0);

    db.prepare("INSERT INTO users (name, email, role, password_hash) VALUES ('A', 'a@b.com', 'admin', ?)").run(await hashPassword("SenhaAdmin123"));
    expect(await bootstrapAdmin(db, mailer, opts)).toBe("has-users");
    expect(mailer.sent).toHaveLength(0);
  });

  it("health check confirma que o banco responde", async () => {
    const db = fresh();
    const res = await request(createApp(db, { mailer: null })).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});
