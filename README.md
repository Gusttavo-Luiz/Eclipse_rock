# Eclipse Rock 2.0 — site oficial

Site oficial da banda **Eclipse Rock** (Rock 2000s • Pop Punk • Emo • tributo à Pitty), com site público e painel administrativo para a equipe atualizar shows, integrantes, fotos, vídeos, textos e acompanhar pedidos de contratação — sem mexer no código.

---

## Sobre a referência e o conteúdo

O site de referência (`eclipse-rock-hub.base44.app`) é uma aplicação renderizada no navegador. Durante o desenvolvimento só foi possível ler os **metadados** dele (título, descrição, tags de compartilhamento). Por isso:

- **Conteúdo pré-carregado** (apenas o que estava confirmado):
  - nome, identificação musical e descrição, vindos dos metadados da referência;
  - Instagram `@eclipserockoficial`;
  - os quatro integrantes com seus perfis: Isabella, Mauro, Mamute e Rodrigo.
- **Fotos dos integrantes** enviadas pela banda (recortadas em 4:5, em `server/seed/members/`): importadas automaticamente na primeira subida do servidor, pelo mesmo processamento das fotos enviadas no painel. A importação acontece uma vez só: depois, trocar ou remover a foto no painel vale de vez.
- **Nada foi inventado.** Não há shows, telefones, e-mails, instrumentos ou datas de fundação pré-cadastrados.
- O texto "A banda" foi redigido apenas com os fatos confirmados e pode ser substituído no painel, em **Configurações**.
- **Rodrigo Rockfest:** cadastre em **Shows → Novo show** depois de validar o endereço e o link oficial da Sympla.
- **Seções que se adaptam:** Galeria e Vídeos só aparecem (inclusive no menu) quando houver conteúdo publicado. Os botões de WhatsApp e e-mail só aparecem quando esses contatos forem configurados.

## O que foi construído

**Site público** (`/`, `/shows`, `/shows/:slug`, `/privacidade`)
- **Hero:** eclipse desenhado em SVG (lua, coroa magenta/violeta, estrelas), CTAs "Próximos shows" e "Contrate a banda", redes sociais e faixa com o próximo show.
- **A banda:** apresentação, repertório e integrantes (foto ou monograma, Instagram).
- **Agenda:**
  - o próximo show aparece em destaque;
  - a lista segue o formato de cartaz de turnê, em ordem cronológica;
  - o estado de cada show (à venda, confirmado, esgotado, cancelado, realizado) é mostrado com **ícone + texto**;
  - cada show tem botões de ingressos, "Como chegar" e "Compartilhar";
  - filtros por cidade e período aparecem a partir de 6 shows;
  - há página própria por show e uma página de agenda completa com os shows anteriores;
  - com a agenda vazia, a seção leva ao Instagram e ao formulário de contratação.
- **Galeria:** grade responsiva, filtro por categoria e lightbox acessível (teclado, deslizar, Escape, foco restaurado).
- **Vídeos:** o player do YouTube (modo privacidade reforçada) só é carregado quando a pessoa clica para assistir.
- **Contratação:**
  - formulário com validação no cliente e no servidor, erros por campo e foco no primeiro erro;
  - proteção contra envio duplicado e campo-armadilha contra robôs;
  - consentimento LGPD obrigatório;
  - a confirmação só aparece depois que a solicitação é gravada no banco;
  - botão de WhatsApp com mensagem pré-preenchida;
  - aviso por e-mail para a equipe a cada nova solicitação (Resend ou SMTP).
- **Demais páginas e itens:** contato, rodapé, Política de Privacidade (LGPD) e página 404.

**Painel** (`/admin`)
- **Login:** sessão em cookie `httpOnly`; o painel tem dois papéis, **admin** e **editor**.
- **Esqueci minha senha:** link de uso único por e-mail, válido por 60 minutos (aparece no login quando o envio de e-mail está configurado).
- **Visão geral:** contagens reais, próximo show, solicitações recentes e log de atividade.
- **Shows:**
  - criar, editar, excluir e buscar;
  - publicar ou despublicar e alterar o status;
  - link de ingressos, mapa e imagem de divulgação.
- **Solicitações:**
  - busca, filtro por status e paginação;
  - detalhe com o status de atendimento (nova → em atendimento → proposta enviada → confirmada → encerrada);
  - observações internas com autor e data;
  - situação do aviso por e-mail (enviado, falhou ou não enviado) e botão para tentar de novo;
  - responder por WhatsApp ou e-mail;
  - exclusão definitiva só para admin, para pedidos de eliminação de dados (LGPD).
- **Integrantes, Galeria e Vídeos:** CRUD completo, publicar/ocultar e reordenação.
- **Configurações** (só admin): textos, logo, foto do topo, foto da seção "A banda", imagem de compartilhamento, redes, WhatsApp, e-mails, SEO e destinatários dos avisos de novas solicitações (com botão de e-mail de teste).
- **Usuários** (só admin): convite por e-mail (a pessoa cria a própria senha) ou senha inicial definida pelo admin; situação do convite e botão para reenviar.
- **Minha conta:** troca de senha.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, React Router, Lucide |
| Backend | Node.js + Express (TypeScript), um único servidor que entrega API e site |
| Banco | SQLite (`better-sqlite3`) com migrações versionadas, chaves estrangeiras e índices |
| Imagens | `sharp`: valida o conteúdo real, remove EXIF/GPS, gera WebP em 480/960/1600/2400 px |
| Validação | `zod`, com os **mesmos schemas** no cliente e no servidor (`shared/schemas.ts`) |
| E-mail | Resend (API HTTP) ou SMTP (`nodemailer`), escolhido pelas variáveis de ambiente |
| Testes | Vitest + Supertest (52 testes de API, segurança, persistência, avisos por e-mail, recuperação de senha, convites e primeiro acesso) |
| Publicação | Render (Blueprint em `render.yaml`) + verificação no GitHub Actions |

**Por que SQLite?** Para um site de banda, um servidor só com um arquivo de banco é a solução mais simples e robusta de operar: sem serviço extra, backup é copiar a pasta `data/`. O acesso ao banco está concentrado em `server/src/repo.ts` e nas rotas, o que facilita migrar para PostgreSQL no futuro, se o volume exigir.

## Estrutura

```
client/                 site e painel (React)
  src/components/       Header, Footer, Modal/Confirm, Toast, Field, Img, SocialLinks…
  src/features/         band, events, gallery, videos, bookings
  src/pages/            Home, Shows, Evento, Privacidade, 404
  src/admin/            painel (carregado sob demanda, fora do bundle público)
  src/lib/              api, formatação, links, SEO, hooks
  src/index.css         tokens do design system (cores, tipografia, raios, sombras, movimento)
server/
  src/db.ts             esquema + migrações + conteúdo confirmado
  src/auth.ts           senhas (scrypt), sessões, papéis, CSRF, auditoria
  src/routes/           public.ts, auth.ts, admin.ts
  src/uploads.ts        processamento seguro de imagens
  src/mailer.ts         envio de e-mail (Resend ou SMTP)
  src/notifications.ts  aviso de nova solicitação para a equipe
  src/passwordReset.ts  links de recuperação de senha e de convite, e-mails da conta
  src/seo.ts            meta tags, Open Graph, JSON-LD, sitemap, robots
  src/cli.ts            criação de administrador
  src/bootstrap.ts      primeiro administrador por ADMIN_EMAIL (convite na primeira subida)
  src/seedPhotos.ts     importa as fotos do conteúdo inicial (server/seed/members) uma única vez
  seed/members/         fotos dos integrantes enviadas pela banda
  tests/api.test.ts
  tests/notifications.test.ts
  tests/passwordReset.test.ts
  tests/invites.test.ts
  tests/bootstrap.test.ts
shared/                 schemas, tipos e conteúdo inicial usados pelos dois lados
client/src/demo/        API simulada da demonstração estática (GitHub Pages)
```

**Tabelas:**

| Tabela | Conteúdo |
|---|---|
| `users` | contas do painel |
| `sessions` | sessões de login |
| `password_resets` | links de recuperação de senha e de convite (só o hash do token) |
| `uploads` | imagens enviadas |
| `events` | shows |
| `band_members` | integrantes |
| `gallery_images` | fotos da galeria |
| `videos` | vídeos |
| `booking_requests` | solicitações de contratação |
| `booking_notes` | observações internas das solicitações |
| `site_settings` | configurações do site |
| `audit_log` | log de ações administrativas |
| `schema_migrations` | controle das migrações |

## Executar localmente

Requisitos: Node.js 20.12+ (recomendado 22).

```bash
npm install
cp .env.example .env            # em dev, APP_SECRET pode ficar vazio
npm run create-admin -- --email voce@exemplo.com --name "Seu nome"   # pede a senha no terminal
npm run dev                     # API em :3001 e site em http://localhost:5173
```

Painel: `http://localhost:5173/admin`.

## Testes e verificações

```bash
npm run typecheck   # TypeScript do cliente e do servidor
npm test            # testes de API
npm run build       # build de produção
```

**Executado antes da entrega:**

- **Typecheck e testes:** typecheck sem erros, build de produção ok e **52/52 testes** passando. Os testes cobrem:
  - bloqueio de rotas sem login e permissões por papel;
  - CSRF, origem inválida e desativação de usuário com encerramento de sessão;
  - validação (links `javascript:`, UF, telefone, e-mail, data) e campo-armadilha;
  - publicação/despublicação, ordem cronológica e separação entre shows futuros e passados;
  - persistência de solicitações, status e observações;
  - upload que rejeita arquivo falso, SVG e envio sem login;
  - escape de HTML no SEO, sitemap e robots;
  - limite de tentativas de login;
  - aviso por e-mail: destinatários, fallback para o e-mail comercial, escape de HTML, falha do provedor sem perder a solicitação, reenvio e e-mail de teste;
  - recuperação de senha: fluxo completo, uso único, expiração, link novo invalida o anterior, limite por hora e por IP, conta inativa, resposta igual para e-mail cadastrado ou não;
  - convites: fluxo completo com login automático, só admin, falha de envio, reenvio, expiração em 7 dias, conta desativada, senha definida pelo admin e convite e recuperação com links separados;
  - primeiro acesso por `ADMIN_EMAIL`: convite na primeira subida, sem reenvio a cada reinício, nova tentativa após falha ou expiração.
- **Teste no navegador** (Chromium, 1440 px e 390 px, com dados de teste em banco temporário):
  - menu mobile fecha após a seleção;
  - erros do formulário recebem foco;
  - envio real do formulário de contratação;
  - lightbox (setas e Escape);
  - redirecionamento ao login;
  - alteração de status e observação persistidas após recarregar;
  - sem rolagem horizontal.
- **Acessibilidade (axe):** WCAG 2.2 AA com **0 violações** nas páginas públicas e do painel.
- **Segurança:** cabeçalhos (CSP, HSTS, nosniff, frame-ancestors), nenhum segredo no bundle e acesso a arquivos fora de `/uploads` bloqueado.

## Demonstração no GitHub Pages

Para mostrar o visual do site sem servidor, `.github/workflows/pages.yml` publica uma **versão de demonstração** no GitHub Pages a cada push (em `https://<usuário>.github.io/<repositório>/`).

- É só o site público, com o conteúdo inicial confirmado e uma faixa avisando que é demonstração.
- O formulário de contratação e o painel não funcionam (avisam que funcionam na versão publicada). Não há banco: nada do que é cadastrado no Render aparece aqui.
- Fica fora dos buscadores (`noindex`), para não competir com o site oficial.
- Build local: `VITE_DEMO=1 VITE_BASE=/speed-bistro/ npm run build:client`.

Na primeira vez, ative em **Settings → Pages → Build and deployment → Source: GitHub Actions** e rode o workflow de novo (aba **Actions**).

## Publicar no Render (recomendado)

O repositório já traz o `render.yaml` (Blueprint) com tudo configurado: serviço web Node 22, disco persistente de 1 GB em `/var/data` (banco + imagens), health check em `/api/health`, `APP_SECRET` gerado pelo próprio Render e publicação automática a cada push, depois que a verificação do GitHub (CI) passar.

**Custos:** o disco persistente exige plano pago. O plano **Starter** custa cerca de US$ 7/mês, mais cerca de US$ 0,25/GB/mês de disco. O plano gratuito não serve: sem disco, banco e fotos se perdem a cada deploy. O Resend tem plano gratuito que atende o volume de uma banda.

### 1. E-mail (Resend): antes de publicar

1. Crie uma conta em [resend.com](https://resend.com) → **Domains** → adicione `eclipserock.com.br` e cadastre no seu DNS os registros que ele mostrar. A verificação pode levar algumas horas.
2. **API Keys** → crie uma chave com permissão de envio (`re_...`).

Sem e-mail o site funciona, mas sem avisos de solicitações, convites e recuperação de senha. O primeiro admin, nesse caso, é criado pelo Shell (veja o passo 3).

### 2. Criar o serviço

1. No [Render](https://dashboard.render.com): **New → Blueprint** → conecte o GitHub e escolha este repositório e a branch.
2. O Render pede os valores marcados no `render.yaml`:

| Variável | O que colocar |
|---|---|
| `SITE_URL` | Deixe **vazio** por enquanto (usa o endereço `.onrender.com`). Preencha no passo 4. |
| `ADMIN_EMAIL` / `ADMIN_NAME` | E-mail e nome de quem vai administrar o site. |
| `MAIL_FROM` | `Eclipse Rock <avisos@eclipserock.com.br>` (domínio verificado no Resend). |
| `RESEND_API_KEY` | A chave `re_...` do Resend. |

3. Confirme. O primeiro deploy leva alguns minutos. Em **Logs** deve aparecer `Eclipse Rock rodando…` e `[primeiro acesso] convite de administrador enviado…`.

### 3. Primeiro acesso

- **Com e-mail configurado:** abra o convite que chegou no `ADMIN_EMAIL`, crie a senha e você já entra no painel. O convite vale 7 dias; se expirar, reinicie o serviço (**Manual Deploy → Restart service**) para receber outro. Depois que alguém entra no painel, `ADMIN_EMAIL` deixa de ter efeito e pode ser apagado.
- **Sem e-mail:** no Render, aba **Shell**:
  ```bash
  node dist/server/cli.js create-admin --email voce@exemplo.com --name "Seu nome"
  ```

Em seguida, siga os "Primeiros passos no painel" abaixo.

### 4. Domínio próprio

1. No serviço: **Settings → Custom Domains** → adicione `eclipserock.com.br` e `www.eclipserock.com.br` e crie no DNS os registros que o Render indicar. O certificado HTTPS é emitido automaticamente.
2. Em **Environment**, defina `SITE_URL=https://eclipserock.com.br` e salve; o serviço reinicia.
3. No painel do site, em **Configurações → SEO**, confirme o "Endereço do site".
4. Envie `https://eclipserock.com.br/sitemap.xml` no Google Search Console.

### Dia a dia

- **Atualizações:** cada push na branch configurada passa pela verificação do GitHub (typecheck, testes e build, em `.github/workflows/ci.yml`) e, se passar, é publicado. Serviços com disco não têm deploy sem interrupção: o site fica fora do ar por alguns segundos durante cada publicação.
- **Backup:** o Render tira snapshots diários do disco (restauráveis em **Disks**). Para uma cópia própria e consistente do banco com o site no ar, no Shell:
  ```bash
  node -e "require('better-sqlite3')('/var/data/eclipse-rock.sqlite').backup('/var/data/backup.sqlite').then(() => console.log('ok'))"
  ```
  Depois baixe `backup.sqlite` e a pasta `/var/data/uploads` (fotos) para fora do Render.
- **Monitoramento:** o Render reinicia o serviço se `/api/health` parar de responder. Os logs mostram falhas de e-mail com o prefixo `[aviso]`, `[convite]`, `[senha]` ou `[primeiro acesso]`.
- **Uma instância só:** o banco SQLite fica no disco de uma única instância. Não aumente o número de instâncias.

> Nota: o `render.yaml` foi escrito seguindo a especificação de Blueprint do Render, mas não pôde ser validado contra o Render a partir deste ambiente. Se o Render recusar algum campo (por exemplo, `autoDeployTrigger`), remova a linha e ajuste a opção equivalente em **Settings** do serviço.

## Publicar em outro lugar (Docker ou servidor próprio)

1. Defina as variáveis do `.env.example`, principalmente:
   - `APP_SECRET` (32+ caracteres; o servidor não sobe sem ele);
   - `DATA_DIR` apontando para um **disco persistente**;
   - `SITE_URL`;
   - `TRUST_PROXY=1`.
2. Faça o build e suba o servidor:
   ```bash
   npm ci && npm run build
   npm start
   ```
   Ou use o Docker:
   ```bash
   docker build -t eclipse-rock .
   docker run -p 3001:3001 -v eclipse-data:/data -e APP_SECRET=... -e SITE_URL=https://eclipserock.com.br eclipse-rock
   ```
   Primeiro admin: defina `ADMIN_EMAIL` (com e-mail configurado) ou rode `node dist/server/cli.js create-admin --email ... --name "..."` (no Docker, com `docker exec -it <container>`).
3. Sirva o site **somente por HTTPS** (com Nginx, use Let's Encrypt).
4. **Backup:** copie periodicamente a pasta `DATA_DIR`, que contém o banco e as imagens.

## Aviso de nova solicitação por e-mail

A cada pedido de contratação enviado pelo site, a equipe recebe um e-mail com todos os dados, um botão para abrir a solicitação no painel e um link de WhatsApp. **Responder o e-mail fala direto com o contratante** (o endereço dele vai como "responder para").

- O envio acontece em segundo plano: o contratante vê a confirmação assim que a solicitação é gravada, sem esperar o e-mail.
- Se o provedor falhar, a solicitação **não se perde**. No detalhe da solicitação, o painel mostra se o aviso foi enviado, falhou (com o motivo) ou não foi enviado, e oferece **Tentar enviar de novo**. Falhas também aparecem na atividade recente da visão geral.

**Configurar com Resend (recomendado):**
1. Crie uma conta em [resend.com](https://resend.com) e verifique o domínio (ex.: `eclipserock.com.br`), adicionando os registros DNS indicados.
2. Gere uma API key.
3. Defina `MAIL_FROM="Eclipse Rock <avisos@eclipserock.com.br>"` e `RESEND_API_KEY=re_...` e reinicie o servidor.

**Configurar com SMTP** (Google Workspace, Zoho, Brevo, provedor de hospedagem): defina `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASS`. No Gmail/Google Workspace, use uma *senha de app*. O SMTP só é usado se `RESEND_API_KEY` estiver vazio.

**No painel:** em **Configurações → Avisos de novas solicitações**, informe até 5 e-mails que recebem os avisos (se ficar vazio, usa o e-mail comercial), salve e clique em **Enviar e-mail de teste**. Ao subir, o servidor informa no log se o envio está ativo.

## Recuperação de senha

Com o envio de e-mail configurado, a tela de login mostra **Esqueci minha senha**:

1. A pessoa informa o e-mail e recebe um link (válido por **60 minutos**, **uso único**). A resposta é a mesma para e-mails cadastrados ou não, para não revelar quem tem conta.
2. O link abre a tela **Nova senha**. Ao salvar, todas as sessões da conta são encerradas e a pessoa entra de novo com a nova senha.
3. Um e-mail avisa que a senha foi alterada (também enviado quando a senha é trocada em **Minha conta**).

Proteções:
- o banco guarda só o hash do token;
- o token vai no fragmento da URL (`#token=…`), que não é enviado a servidores nem vaza pelo Referer;
- um link novo invalida o anterior;
- no máximo 3 links por conta por hora, mais um limite de pedidos por IP;
- contas desativadas não recebem nem usam links.

Em produção, os links usam `SITE_URL` (ou o "Endereço do site" das Configurações), nunca o cabeçalho Host da requisição. Sem e-mail configurado, um admin redefine a senha em **Usuários** ou pelo comando `create-admin`, que atualiza um usuário existente.

## Convite de usuários por e-mail

Em **Usuários → Novo usuário**, o admin escolhe como a pessoa vai entrar:

- **Enviar convite por e-mail** (padrão quando o e-mail está configurado): a pessoa recebe um link válido por **7 dias**, cria a própria senha e já entra no painel. Ninguém além dela conhece a senha.
- **Definir uma senha inicial agora:** o admin repassa a senha por um canal seguro.

Enquanto o convite não é aceito, a lista mostra **Convite pendente** com a validade do link. O botão de enviar reenvia o convite (gera um link novo e invalida o anterior), inclusive depois que o link expira. Se o envio falhar, o usuário é criado mesmo assim e o painel mostra o motivo da falha.

O link de convite usa as mesmas proteções da recuperação de senha e não serve como link de recuperação (nem o contrário). Se o admin definir a senha de um usuário pendente, ou se a pessoa usar "Esqueci minha senha", o convite é concluído e o link antigo deixa de valer. Contas desativadas não aceitam convite.

> WhatsApp: o aviso automático por WhatsApp exige a API oficial do WhatsApp Business (Meta), com conta comercial verificada e modelos de mensagem aprovados. Por isso o aviso é por e-mail; no celular, a notificação do app de e-mail cumpre o mesmo papel.

O servidor roda como **uma instância**. Os limites de requisição ficam em memória; para escalar horizontalmente, troque-os por Redis.

## Primeiros passos no painel

1. **Configurações:**
   - envie o logotipo oficial, a foto do topo e a imagem de compartilhamento (1200×630);
   - preencha o WhatsApp comercial e o e-mail;
   - em "Avisos de novas solicitações", informe quem recebe os avisos e envie um e-mail de teste;
   - revise o texto "A banda".
2. **Integrantes:** instrumento/função **quando confirmados** (as fotos já vêm do conteúdo inicial).
3. **Shows:** cadastre os shows confirmados, como o Rodrigo Rockfest com o link oficial da Sympla.
4. **Galeria e Vídeos:** fotos reais e vídeos oficiais do YouTube.
5. **Usuários:** crie contas de **editor** para quem só atualiza conteúdo.

## Integrações pendentes / próximos passos

- **Publicar:** o código e o `render.yaml` estão prontos; falta criar a conta no Resend, verificar o domínio e criar o Blueprint no Render (veja "Publicar no Render").
- **Conteúdo da referência:** textos e imagens do site original que não puderam ser lidos devem ser incluídos pelo painel.
- **Instrumentos dos integrantes, YouTube, Spotify, e-mail e telefone oficiais:** aguardam confirmação da banda.
