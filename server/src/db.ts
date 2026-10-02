import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "./config";

export type DB = Database.Database;

/**
 * Migrações versionadas. Nunca edite uma migração já publicada:
 * adicione uma nova ao final do array.
 */
const migrations: { name: string; sql: string }[] = [
  {
    name: "001_initial",
    sql: `
      CREATE TABLE users (
        id            INTEGER PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name          TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('admin','editor')),
        active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
        last_login_at TEXT,
        created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE TABLE sessions (
        token_hash  TEXT PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at  TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX idx_sessions_user ON sessions(user_id);
      CREATE INDEX idx_sessions_expires ON sessions(expires_at);

      CREATE TABLE uploads (
        id          INTEGER PRIMARY KEY,
        key         TEXT NOT NULL UNIQUE,
        width       INTEGER NOT NULL,
        height      INTEGER NOT NULL,
        variants    TEXT NOT NULL,            -- JSON: [480, 960, 1600]
        bytes       INTEGER NOT NULL,
        original_name TEXT,
        created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE TABLE events (
        id          INTEGER PRIMARY KEY,
        slug        TEXT NOT NULL UNIQUE,
        title       TEXT NOT NULL,
        date        TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        time        TEXT,
        venue       TEXT NOT NULL,
        city        TEXT NOT NULL,
        state       TEXT NOT NULL CHECK (length(state) = 2),
        address     TEXT,
        maps_url    TEXT,
        ticket_url  TEXT,
        description TEXT,
        status      TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','on_sale','sold_out','cancelled')),
        image_id    INTEGER REFERENCES uploads(id) ON DELETE SET NULL,
        published   INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX idx_events_public ON events(published, date);

      CREATE TABLE band_members (
        id          INTEGER PRIMARY KEY,
        name        TEXT NOT NULL,
        role        TEXT,
        instagram   TEXT,
        photo_id    INTEGER REFERENCES uploads(id) ON DELETE SET NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        published   INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0,1)),
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE TABLE gallery_images (
        id          INTEGER PRIMARY KEY,
        upload_id   INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
        alt         TEXT NOT NULL,
        caption     TEXT,
        category    TEXT,
        event_id    INTEGER REFERENCES events(id) ON DELETE SET NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        published   INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0,1)),
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX idx_gallery_public ON gallery_images(published, sort_order);

      CREATE TABLE videos (
        id           INTEGER PRIMARY KEY,
        title        TEXT NOT NULL,
        description  TEXT,
        url          TEXT NOT NULL,
        youtube_id   TEXT NOT NULL,
        thumbnail_id INTEGER REFERENCES uploads(id) ON DELETE SET NULL,
        category     TEXT,
        event_id     INTEGER REFERENCES events(id) ON DELETE SET NULL,
        sort_order   INTEGER NOT NULL DEFAULT 0,
        published    INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0,1)),
        created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX idx_videos_public ON videos(published, sort_order);

      CREATE TABLE booking_requests (
        id          INTEGER PRIMARY KEY,
        name        TEXT NOT NULL,
        company     TEXT,
        phone       TEXT NOT NULL,
        email       TEXT NOT NULL,
        event_type  TEXT NOT NULL,
        event_date  TEXT NOT NULL,
        city        TEXT NOT NULL,
        state       TEXT NOT NULL,
        venue       TEXT,
        audience    INTEGER,
        message     TEXT,
        status      TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','in_progress','proposal_sent','confirmed','closed')),
        consent_at  TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX idx_bookings_status ON booking_requests(status, created_at);

      CREATE TABLE booking_notes (
        id          INTEGER PRIMARY KEY,
        booking_id  INTEGER NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        body        TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX idx_booking_notes ON booking_notes(booking_id);

      CREATE TABLE site_settings (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE TABLE audit_log (
        id          INTEGER PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action      TEXT NOT NULL,
        entity      TEXT NOT NULL,
        entity_id   INTEGER,
        summary     TEXT,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX idx_audit_created ON audit_log(created_at);
    `,
  },
  {
    // Conteúdo inicial CONFIRMADO (metadados do site de referência + perfis informados no briefing).
    // Nada de eventos, números, instrumentos ou contatos inventados.
    name: "002_seed_confirmed_content",
    sql: `
      INSERT INTO site_settings (key, value) VALUES ('site', json('${JSON.stringify({
        bandName: "Eclipse Rock",
        tagline: "Rock 2000s • Pop Punk • Emo",
        heroText:
          "Rock 2000s, Pop Punk, Emo e tributo à Pitty. Confira os próximos shows e venha cantar com a gente.",
        aboutText: [
          "A Eclipse Rock é uma banda dedicada ao rock dos anos 2000. O repertório passa pelo pop punk, pelo emo e pelos clássicos do rock alternativo que marcaram a era da MTV — e inclui um tributo à Pitty.",
          "A proposta é transformar cada show em um grande coro: as músicas que tanta gente cantou no quarto, no fone de ouvido e na pista, tocadas ao vivo com a energia que elas pedem.",
          "Se essas faixas fizeram parte da sua história, o convite está feito: venha cantar com a gente.",
        ].join("\n\n"),
        instagram: "eclipserockoficial",
        youtubeUrl: null,
        spotifyUrl: null,
        tiktokUrl: null,
        facebookUrl: null,
        whatsapp: null,
        whatsappMessage: "Olá, Eclipse Rock! Gostaria de saber mais sobre a contratação da banda para um evento.",
        contactEmail: null,
        privacyEmail: null,
        logoId: null,
        heroImageId: null,
        aboutImageId: null,
        ogImageId: null,
        seoTitle: "Eclipse Rock | Rock 2000s • Pop Punk • Emo",
        seoDescription:
          "Eclipse Rock — Rock 2000s, Pop Punk, Emo e tributo à Pitty. Confira os próximos shows e venha cantar com a gente.",
        siteUrl: "https://eclipserock.com.br",
      }).replace(/'/g, "''")}'));

      INSERT INTO band_members (name, instagram, sort_order, published) VALUES
        ('Isabella Land', 'itsbellaland', 1, 1),
        ('M.A.M. Filho', 'mam.filho', 2, 1),
        ('Mamute Ferreira', 'mamute.ferreira', 3, 1),
        ('Rodrigo Di', 'rodrigodi', 4, 1);
    `,
  },
  {
    // Resultado do aviso por e-mail enviado à equipe quando chega uma solicitação.
    name: "003_booking_notifications",
    sql: `
      ALTER TABLE booking_requests ADD COLUMN notify_status TEXT CHECK (notify_status IN ('sent','failed','skipped'));
      ALTER TABLE booking_requests ADD COLUMN notify_detail TEXT;
      ALTER TABLE booking_requests ADD COLUMN notified_at TEXT;
    `,
  },
  {
    // Links de recuperação de senha: só o hash do token é guardado; uso único e validade curta.
    name: "004_password_resets",
    sql: `
      CREATE TABLE password_resets (
        id          INTEGER PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  TEXT NOT NULL UNIQUE,
        expires_at  TEXT NOT NULL,
        used_at     TEXT,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX idx_password_resets_user ON password_resets(user_id, created_at);
    `,
  },
  {
    // Convites por e-mail: o mesmo mecanismo de link, com outro tipo e validade maior.
    // invite_pending = conta criada por convite que ainda não definiu a senha.
    name: "005_user_invites",
    sql: `
      ALTER TABLE password_resets ADD COLUMN kind TEXT NOT NULL DEFAULT 'reset' CHECK (kind IN ('reset','invite'));
      ALTER TABLE users ADD COLUMN invite_pending INTEGER NOT NULL DEFAULT 0 CHECK (invite_pending IN (0,1));
    `,
  },
];

export function openDb(file = path.join(config.dataDir, "eclipse-rock.sqlite")): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

export function migrate(db: DB) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);
  const applied = new Set(
    (db.prepare("SELECT name FROM schema_migrations").all() as { name: string }[]).map((r) => r.name),
  );
  for (const m of migrations) {
    if (applied.has(m.name)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(m.name);
    })();
  }
}

export const nowIso = () => new Date().toISOString();
