import fs from "node:fs";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { hashPassword } from "../src/auth";
import { config } from "../src/config";
import { openDb, type DB } from "../src/db";
import { renderHead, resolveHead } from "../src/seo";

let db: DB;
let app: ReturnType<typeof createApp>;
const H = { "X-Requested-With": "eclipse-rock" };

const future = (days: number) => {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
};

async function login(email: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").set(H).send({ email, password });
  expect(res.status).toBe(200);
  return agent;
}

beforeAll(async () => {
  fs.rmSync(config.dataDir, { recursive: true, force: true });
  db = openDb(":memory:");
  app = createApp(db);
  const ins = db.prepare("INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)");
  ins.run("Admin", "admin@teste.com", "admin", await hashPassword("SenhaAdmin123"));
  ins.run("Editor", "editor@teste.com", "editor", await hashPassword("SenhaEditor123"));
});

afterAll(() => {
  db.close();
  fs.rmSync(config.dataDir, { recursive: true, force: true });
});

describe("conteúdo inicial", () => {
  it("expõe apenas dados confirmados", async () => {
    const res = await request(app).get("/api/public/home");
    expect(res.status).toBe(200);
    expect(res.body.settings.bandName).toBe("Eclipse Rock");
    expect(res.body.settings.instagram).toBe("eclipserockoficial");
    expect(res.body.settings.whatsapp).toBeNull();
    expect(res.body.settings.contactEmail).toBeNull();
    expect(res.body.members.map((m: { name: string }) => m.name)).toEqual([
      "Isabella",
      "Mauro",
      "Mamute",
      "Rodrigo",
    ]);
    expect(res.body.members.map((m: { monogram: string | null }) => m.monogram)).toEqual([null, "MA", "MM", null]);
    expect(res.body.members.every((m: { role: string | null }) => m.role === null)).toBe(true);
    expect(res.body.upcoming).toEqual([]);
  });

  it("sigla do card é editável, vira maiúscula e aceita até 3 caracteres", async () => {
    const admin = await login("editor@teste.com", "SenhaEditor123");
    const list = (await admin.get("/api/admin/members")).body as { id: number; name: string; instagram: string; sortOrder: number }[];
    const m = list.find((x) => x.name === "Isabella")!;
    const base = { name: m.name, instagram: m.instagram, sortOrder: m.sortOrder, published: true };
    const ok = await admin.put(`/api/admin/members/${m.id}`).set(H).send({ ...base, monogram: "is" });
    expect(ok.status).toBe(200);
    expect(ok.body.monogram).toBe("IS");
    expect((await admin.put(`/api/admin/members/${m.id}`).set(H).send({ ...base, monogram: "ISAB" })).status).toBe(422);
    const cleared = await admin.put(`/api/admin/members/${m.id}`).set(H).send({ ...base, monogram: "" });
    expect(cleared.body.monogram).toBeNull();
  });
});

describe("autenticação e autorização", () => {
  it("bloqueia rotas administrativas sem login", async () => {
    for (const [method, url] of [
      ["get", "/api/admin/dashboard"],
      ["get", "/api/admin/bookings"],
      ["post", "/api/admin/events"],
      ["put", "/api/admin/settings"],
      ["get", "/api/admin/users"],
    ] as const) {
      const res = await request(app)[method](url).set(H).send({});
      expect(res.status, `${method} ${url}`).toBe(401);
    }
  });

  it("recusa senha errada com mensagem genérica", async () => {
    const a = await request(app).post("/api/auth/login").set(H).send({ email: "admin@teste.com", password: "errada" });
    const b = await request(app).post("/api/auth/login").set(H).send({ email: "naoexiste@teste.com", password: "errada" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });

  it("cria sessão com cookie httpOnly e encerra no logout", async () => {
    const res = await request(app).post("/api/auth/login").set(H).send({ email: "admin@teste.com", password: "SenhaAdmin123" });
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/er_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(res.body.user).not.toHaveProperty("password_hash");

    const agent = await login("admin@teste.com", "SenhaAdmin123");
    expect((await agent.get("/api/auth/me")).body.user.email).toBe("admin@teste.com");
    await agent.post("/api/auth/logout").set(H);
    expect((await agent.get("/api/admin/dashboard")).status).toBe(401);
  });

  it("exige cabeçalho anti-CSRF e origem válida", async () => {
    const agent = await login("admin@teste.com", "SenhaAdmin123");
    const noHeader = await agent.post("/api/admin/events").send({});
    expect(noHeader.status).toBe(403);
    const badOrigin = await agent.post("/api/admin/events").set(H).set("Origin", "https://site-malicioso.com").send({});
    expect(badOrigin.status).toBe(403);
  });

  it("editor gerencia conteúdo, mas não configurações nem usuários", async () => {
    const editor = await login("editor@teste.com", "SenhaEditor123");
    expect((await editor.get("/api/admin/events")).status).toBe(200);
    expect((await editor.put("/api/admin/settings").set(H).send({})).status).toBe(403);
    expect((await editor.get("/api/admin/users")).status).toBe(403);
    expect((await editor.delete("/api/admin/bookings/1").set(H)).status).toBe(403);
  });

  it("usuário desativado perde a sessão imediatamente", async () => {
    const admin = await login("admin@teste.com", "SenhaAdmin123");
    const created = await admin
      .post("/api/admin/users")
      .set(H)
      .send({ name: "Temp", email: "temp@teste.com", role: "editor", password: "SenhaTemp1234" });
    expect(created.status).toBe(201);
    const temp = await login("temp@teste.com", "SenhaTemp1234");
    expect((await temp.get("/api/admin/dashboard")).status).toBe(200);
    await admin.put(`/api/admin/users/${created.body.id}`).set(H).send({ name: "Temp", role: "editor", active: false });
    expect((await temp.get("/api/admin/dashboard")).status).toBe(401);
  });

  it("admin não pode remover o próprio acesso", async () => {
    const admin = await login("admin@teste.com", "SenhaAdmin123");
    const me = (await admin.get("/api/auth/me")).body.user;
    const res = await admin.put(`/api/admin/users/${me.id}`).set(H).send({ name: "Admin", role: "editor", active: true });
    expect(res.status).toBe(422);
  });
});

describe("eventos", () => {
  const base = {
    title: "Show de Teste",
    date: future(20),
    time: "22:00",
    venue: "Casa de Teste",
    city: "São Paulo",
    state: "SP",
    address: null,
    mapsUrl: null,
    ticketUrl: "https://www.sympla.com.br/evento/teste/1",
    description: null,
    status: "on_sale",
    imageId: null,
    published: false,
  };

  it("valida links e campos obrigatórios", async () => {
    const admin = await login("admin@teste.com", "SenhaAdmin123");
    const res = await admin
      .post("/api/admin/events")
      .set(H)
      .send({ ...base, title: "", ticketUrl: "javascript:alert(1)", state: "XX" });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(["title", "ticketUrl", "state"]));
  });

  it("só aparece no site depois de publicado e respeita a ordem cronológica", async () => {
    const admin = await login("admin@teste.com", "SenhaAdmin123");
    const a = await admin.post("/api/admin/events").set(H).send(base);
    expect(a.status).toBe(201);
    expect(a.body.slug).toBe(`show-de-teste-${base.date}`);
    expect((await request(app).get("/api/public/events")).body).toHaveLength(0);
    expect((await request(app).get(`/api/public/events/${a.body.slug}`)).status).toBe(404);

    await admin.patch(`/api/admin/events/${a.body.id}`).set(H).send({ published: true });
    const sooner = await admin
      .post("/api/admin/events")
      .set(H)
      .send({ ...base, title: "Show Antes", date: future(5), published: true });
    const past = await admin
      .post("/api/admin/events")
      .set(H)
      .send({ ...base, title: "Show Passado", date: "2024-01-10", published: true });

    const upcoming = (await request(app).get("/api/public/events")).body;
    expect(upcoming.map((e: { title: string }) => e.title)).toEqual(["Show Antes", "Show de Teste"]);
    const pastList = (await request(app).get("/api/public/events?scope=past")).body;
    expect(pastList.map((e: { title: string }) => e.title)).toEqual(["Show Passado"]);
    expect(pastList[0].isPast).toBe(true);

    const detail = await request(app).get(`/api/public/events/${a.body.slug}`);
    expect(detail.status).toBe(200);
    expect(detail.body.ticketUrl).toBe(base.ticketUrl);

    await admin.patch(`/api/admin/events/${sooner.body.id}`).set(H).send({ status: "cancelled" });
    expect((await request(app).get(`/api/public/events/${sooner.body.slug}`)).body.status).toBe("cancelled");

    expect((await admin.delete(`/api/admin/events/${past.body.id}`).set(H)).status).toBe(204);
    expect((await request(app).get("/api/public/events?scope=past")).body).toHaveLength(0);
  });

  it("gera SEO com dados estruturados reais e escapa HTML", async () => {
    const admin = await login("admin@teste.com", "SenhaAdmin123");
    const ev = await admin
      .post("/api/admin/events")
      .set(H)
      .send({ ...base, title: 'Rock "Fest" <script>alert(1)</script>', published: true });
    const head = renderHead(db, resolveHead(db, `/shows/${ev.body.slug}`));
    expect(head).toContain('"@type":"MusicEvent"');
    expect(head).toContain(`"startDate":"${base.date}T22:00:00-03:00"`);
    expect(head).not.toContain("<script>alert");
    expect(head).toContain("&lt;script&gt;");

    const sm = await request(app).get("/sitemap.xml");
    expect(sm.text).toContain(`/shows/${ev.body.slug}`);
    const rb = await request(app).get("/robots.txt");
    expect(rb.text).toContain("Disallow: /admin");

    expect(resolveHead(db, "/shows/nao-existe").status).toBe(404);
    expect(renderHead(db, resolveHead(db, "/admin"))).toContain("noindex");
  });
});

describe("solicitações de contratação", () => {
  const valid = {
    name: "Maria Contratante",
    company: "",
    phone: "(11) 91234-5678",
    email: "MARIA@exemplo.com",
    eventType: "Festival",
    eventDate: future(60),
    city: "Campinas",
    state: "sp",
    venue: "",
    audience: "300",
    message: "Gostaríamos de um orçamento.",
    consent: true,
    website: "",
  };

  it("valida campos e formatos", async () => {
    const res = await request(app)
      .post("/api/public/bookings")
      .send({ ...valid, email: "invalido", phone: "123", eventDate: "2020-01-01", consent: false });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(["email", "phone", "eventDate", "consent"]));
  });

  it("descarta envios de robôs (honeypot)", async () => {
    const res = await request(app).post("/api/public/bookings").send({ ...valid, website: "http://spam" });
    expect(res.status).toBe(400);
  });

  it("registra, lista, altera status e guarda observações", async () => {
    const res = await request(app).post("/api/public/bookings").send(valid);
    expect(res.status).toBe(201);
    const id = res.body.id;

    const admin = await login("admin@teste.com", "SenhaAdmin123");
    const list = await admin.get("/api/admin/bookings?q=Campinas");
    expect(list.body.total).toBe(1);
    const b = list.body.items[0];
    expect(b).toMatchObject({ status: "new", email: "maria@exemplo.com", phone: "11912345678", state: "SP", audience: 300 });

    const upd = await admin.patch(`/api/admin/bookings/${id}`).set(H).send({ status: "proposal_sent" });
    expect(upd.body.status).toBe("proposal_sent");
    expect((await admin.patch(`/api/admin/bookings/${id}`).set(H).send({ status: "aprovada" })).status).toBe(422);

    const note = await admin.post(`/api/admin/bookings/${id}/notes`).set(H).send({ body: "Enviar proposta até sexta." });
    expect(note.status).toBe(201);

    // persistência: nova leitura direta
    const detail = await admin.get(`/api/admin/bookings/${id}`);
    expect(detail.body.booking.status).toBe("proposal_sent");
    expect(detail.body.notes[0]).toMatchObject({ body: "Enviar proposta até sexta.", authorName: "Admin" });

    const filtered = await admin.get("/api/admin/bookings?status=new");
    expect(filtered.body.total).toBe(0);

    const dash = await admin.get("/api/admin/dashboard");
    expect(dash.body.bookingsTotal).toBe(1);
    expect(dash.body.bookingsOpen).toBe(1);
  });
});

describe("uploads", () => {
  it("rejeita arquivo que não é imagem, mesmo com MIME de imagem", async () => {
    const admin = await login("admin@teste.com", "SenhaAdmin123");
    const res = await admin
      .post("/api/admin/uploads")
      .set(H)
      .attach("file", Buffer.from("<?php echo 'x'; ?>"), { filename: "foto.png", contentType: "image/png" });
    expect(res.status).toBe(422);
    const svg = await admin
      .post("/api/admin/uploads")
      .set(H)
      .attach("file", Buffer.from("<svg onload=alert(1)></svg>"), { filename: "x.svg", contentType: "image/svg+xml" });
    expect(svg.status).toBe(422);
  });

  it("processa imagem real, gera variantes WebP e permite usar na galeria", async () => {
    const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#7B3FE4" } }).png().toBuffer();
    const admin = await login("admin@teste.com", "SenhaAdmin123");
    const up = await admin.post("/api/admin/uploads").set(H).attach("file", png, { filename: "palco.png", contentType: "image/png" });
    expect(up.status).toBe(201);
    expect(up.body.srcset).toMatch(/480w/);
    expect(up.body.width).toBe(1200);

    const file = await request(app).get(up.body.src);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toBe("image/webp");

    const g = await admin
      .post("/api/admin/gallery")
      .set(H)
      .send({ uploadId: up.body.id, alt: "Palco iluminado de roxo", caption: null, category: "Shows", eventId: null, published: true });
    expect(g.status).toBe(201);
    expect((await request(app).get("/api/public/gallery")).body).toHaveLength(1);

    await admin.patch(`/api/admin/gallery/${g.body.id}`).set(H).send({ published: false });
    expect((await request(app).get("/api/public/gallery")).body).toHaveLength(0);
  });

  it("exige login para enviar", async () => {
    const res = await request(app).post("/api/admin/uploads").set(H).attach("file", Buffer.from("x"), "a.png");
    expect(res.status).toBe(401);
  });
});

describe("vídeos e integrantes", () => {
  it("aceita apenas links válidos do YouTube", async () => {
    const admin = await login("admin@teste.com", "SenhaAdmin123");
    const bad = await admin.post("/api/admin/videos").set(H).send({ title: "X", url: "https://vimeo.com/123", published: true });
    expect(bad.status).toBe(422);
    const ok = await admin
      .post("/api/admin/videos")
      .set(H)
      .send({ title: "Ao vivo", url: "https://youtu.be/dQw4w9WgXcQ", published: true });
    expect(ok.status).toBe(201);
    expect(ok.body.youtubeId).toBe("dQw4w9WgXcQ");
  });

  it("normaliza perfis do Instagram e permite ocultar integrante", async () => {
    const admin = await login("admin@teste.com", "SenhaAdmin123");
    const m = await admin
      .post("/api/admin/members")
      .set(H)
      .send({ name: "Teste", instagram: "https://www.instagram.com/perfil.teste/", sortOrder: 9, published: false });
    expect(m.body.instagram).toBe("perfil.teste");
    const pub = (await request(app).get("/api/public/members")).body;
    expect(pub.find((x: { name: string }) => x.name === "Teste")).toBeUndefined();
  });
});

describe("configurações", () => {
  it("admin atualiza WhatsApp e o site público reflete", async () => {
    const admin = await login("admin@teste.com", "SenhaAdmin123");
    const current = (await admin.get("/api/admin/settings")).body;
    const bad = await admin.put("/api/admin/settings").set(H).send({ ...current, whatsapp: "123" });
    expect(bad.status).toBe(422);
    const ok = await admin.put("/api/admin/settings").set(H).send({ ...current, whatsapp: "+55 (11) 99999-0000" });
    expect(ok.status).toBe(200);
    expect((await request(app).get("/api/public/settings")).body.whatsapp).toBe("5511999990000");
  });
});

describe("limite de tentativas", () => {
  it("bloqueia excesso de logins", async () => {
    let last = 0;
    for (let i = 0; i < 15; i++) {
      last = (await request(app).post("/api/auth/login").set(H).send({ email: "x@teste.com", password: "y" })).status;
    }
    expect(last).toBe(429);
  });
});
