/**
 * CLI administrativa.
 *   npm run create-admin -- --email voce@exemplo.com --name "Seu nome"
 * A senha é lida da variável ADMIN_PASSWORD ou digitada (sem eco) no terminal.
 * Em produção (build): node dist/server/cli.js create-admin --email ... --name ...
 */
import readline from "node:readline";
import { password as passwordSchema, userCreateInput } from "../../shared/schemas";
import { hashPassword } from "./auth";
import { openDb } from "./db";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    out._writeToOutput = (s: string) => {
      if (s.includes(question)) out.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function createAdmin() {
  const email = arg("email");
  const name = arg("name") ?? "Administrador";
  if (!email) {
    console.error('Uso: npm run create-admin -- --email voce@exemplo.com --name "Seu nome"');
    process.exit(1);
  }
  let password = process.env.ADMIN_PASSWORD;
  if (!password) password = await askHidden("Senha (mín. 10 caracteres, letras e números): ");
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) {
    console.error(pw.error.issues[0].message);
    process.exit(1);
  }
  const d = userCreateInput.safeParse({ name, email, role: "admin", password });
  if (!d.success) {
    console.error(d.error.issues.map((i) => i.message).join("\n"));
    process.exit(1);
  }
  const db = openDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(d.data.email) as { id: number } | undefined;
  const hash = await hashPassword(d.data.password);
  if (existing) {
    db.prepare("UPDATE users SET password_hash = ?, role = 'admin', active = 1, updated_at = ? WHERE id = ?").run(
      hash,
      new Date().toISOString(),
      existing.id,
    );
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(existing.id);
    console.log(`Usuário ${d.data.email} atualizado como administrador (nova senha definida).`);
  } else {
    db.prepare("INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, 'admin', ?)").run(d.data.name, d.data.email, hash);
    console.log(`Administrador ${d.data.email} criado.`);
  }
  db.close();
}

const cmd = process.argv[2];
if (cmd === "create-admin") createAdmin();
else {
  console.error("Comandos: create-admin");
  process.exit(1);
}
