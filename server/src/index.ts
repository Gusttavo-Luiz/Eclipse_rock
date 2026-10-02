import { createApp } from "./app";
import { assertProductionConfig, config } from "./config";
import { openDb } from "./db";
import { createMailer } from "./mailer";

assertProductionConfig();
const db = openDb();
const mailer = createMailer();
const app = createApp(db, { serveClient: config.isProd, mailer });

const server = app.listen(config.port, () => {
  console.log(`Eclipse Rock rodando em http://localhost:${config.port} (${config.isProd ? "produção" : "desenvolvimento"})`);
  console.log(
    mailer
      ? `Avisos de novas solicitações por e-mail: ${mailer.provider.toUpperCase()}, remetente ${mailer.from}`
      : "Avisos por e-mail desligados (defina MAIL_FROM e RESEND_API_KEY ou SMTP_HOST para ativar).",
  );
  const users = (db.prepare("SELECT COUNT(*) n FROM users").get() as { n: number }).n;
  if (!users) console.log('Nenhum usuário administrador. Crie um com: npm run create-admin -- --email voce@exemplo.com --name "Seu nome"');
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
