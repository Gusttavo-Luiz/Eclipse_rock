# Eclipse Rock 2.0 — site oficial

Site oficial da banda **Eclipse Rock** (Rock 2000s • Pop Punk • Emo • tributo à Pitty), com site público e painel administrativo para a equipe atualizar shows, integrantes, fotos, vídeos, textos e acompanhar pedidos de contratação — sem mexer no código.

---

## Sobre a referência e o conteúdo

O site de referência (`eclipse-rock-hub.base44.app`) é uma aplicação renderizada no navegador. Durante o desenvolvimento só foi possível ler os **metadados** dele (título, descrição, tags de compartilhamento). Por isso:

- **Conteúdo pré-carregado** (apenas o que estava confirmado):
  - nome, identificação musical e descrição, vindos dos metadados da referência;
  - Instagram `@eclipserockoficial`;
  - os quatro integrantes com seus perfis: Isabella Land, M.A.M. Filho, Mamute Ferreira e Rodrigo Di.
- **Nada foi inventado.** Não há shows, telefones, e-mails, instrumentos, datas de fundação ou fotos pré-cadastrados.
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
  - botão de WhatsApp com mensagem pré-preenchida.
- **Demais páginas e itens:** contato, rodapé, Política de Privacidade (LGPD) e página 404.

**Painel** (`/admin`)
- **Login:** sessão em cookie `httpOnly`; o painel tem dois papéis, **admin** e **editor**.
- **Visão geral:** contagens reais, próximo show, solicitações recentes e log de atividade.
- **Shows:**
  - criar, editar, excluir e buscar;
  - publicar ou despublicar e alterar o status;
  - link de ingressos, mapa e imagem de divulgação.
- **Solicitações:**
  - busca, filtro por status e paginação;
  - detalhe com o status de atendimento (nova → em atendimento → proposta enviada → confirmada → encerrada);
  - observações internas com autor e data;
  - responder por WhatsApp ou e-mail;
  - exclusão definitiva só para admin, para pedidos de eliminação de dados (LGPD).
- **Integrantes, Galeria e Vídeos:** CRUD completo, publicar/ocultar e reordenação.
- **Configurações** (só admin): textos, logo, foto do topo, foto da seção "A banda", imagem de compartilhamento, redes, WhatsApp, e-mails e SEO.
- **Usuários** (só admin) e **Minha conta** (troca de senha).

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, React Router, Lucide |
| Backend | Node.js + Express (TypeScript), um único servidor que entrega API e site |
| Banco | SQLite (`better-sqlite3`) com migrações versionadas, chaves estrangeiras e índices |
| Imagens | `sharp`: valida o conteúdo real, remove EXIF/GPS, gera WebP em 480/960/1600/2400 px |
| Validação | `zod`, com os **mesmos schemas** no cliente e no servidor (`shared/schemas.ts`) |
| Testes | Vitest + Supertest (21 testes de API, segurança e persistência) |

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
  src/seo.ts            meta tags, Open Graph, JSON-LD, sitemap, robots
  src/cli.ts            criação de administrador
  tests/api.test.ts
shared/                 schemas e tipos usados pelos dois lados
```

**Tabelas:**

| Tabela | Conteúdo |
|---|---|
| `users` | contas do painel |
| `sessions` | sessões de login |
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

- **Typecheck e testes:** typecheck sem erros, build de produção ok e **21/21 testes** passando. Os testes cobrem:
  - bloqueio de rotas sem login e permissões por papel;
  - CSRF, origem inválida e desativação de usuário com encerramento de sessão;
  - validação (links `javascript:`, UF, telefone, e-mail, data) e campo-armadilha;
  - publicação/despublicação, ordem cronológica e separação entre shows futuros e passados;
  - persistência de solicitações, status e observações;
  - upload que rejeita arquivo falso, SVG e envio sem login;
  - escape de HTML no SEO, sitemap e robots;
  - limite de tentativas de login.
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

## Publicar em produção

1. Defina as variáveis do `.env.example`, principalmente:
   - `APP_SECRET` (32+ caracteres; o servidor não sobe sem ele);
   - `DATA_DIR` apontando para um **disco persistente**;
   - `SITE_URL`;
   - `TRUST_PROXY=1`.
2. Faça o build e suba o servidor:
   ```bash
   npm ci && npm run build
   node dist/server/cli.js create-admin --email voce@exemplo.com --name "Seu nome"
   npm start
   ```
   Ou use o Docker:
   ```bash
   docker build -t eclipse-rock .
   docker run -p 3001:3001 -v eclipse-data:/data -e APP_SECRET=... -e SITE_URL=https://eclipserock.com.br eclipse-rock
   docker exec -it <container> node dist/server/cli.js create-admin --email ... --name "..."
   ```
3. Sirva o site **somente por HTTPS**. Plataformas como Render, Railway e Fly.io já fornecem HTTPS; com Nginx, use Let's Encrypt.
4. Aponte o domínio (`eclipserock.com.br`) e envie `https://eclipserock.com.br/sitemap.xml` no Google Search Console.
5. **Backup:** copie periodicamente a pasta `DATA_DIR`, que contém o banco e as imagens.

O servidor roda como **uma instância**. Os limites de requisição ficam em memória; para escalar horizontalmente, troque-os por Redis.

## Primeiros passos no painel

1. **Configurações:**
   - envie o logotipo oficial, a foto do topo e a imagem de compartilhamento (1200×630);
   - preencha o WhatsApp comercial e o e-mail;
   - revise o texto "A banda".
2. **Integrantes:** fotos oficiais e instrumento/função **quando confirmados**.
3. **Shows:** cadastre os shows confirmados, como o Rodrigo Rockfest com o link oficial da Sympla.
4. **Galeria e Vídeos:** fotos reais e vídeos oficiais do YouTube.
5. **Usuários:** crie contas de **editor** para quem só atualiza conteúdo.

## Integrações pendentes / próximos passos

- **Aviso de nova solicitação por e-mail ou WhatsApp:** ainda não configurado. As solicitações são gravadas e aparecem no painel (com destaque para as novas), mas nenhuma notificação é enviada. Para isso, é preciso um provedor de e-mail (SMTP/Resend etc.).
- **Conteúdo da referência:** textos e imagens do site original que não puderam ser lidos devem ser incluídos pelo painel.
- **Instrumentos dos integrantes, YouTube, Spotify, e-mail e telefone oficiais:** aguardam confirmação da banda.
- **Recuperação de senha por e-mail:** depende do provedor de e-mail. Até lá, um admin redefine a senha em **Usuários** ou pelo comando `create-admin`, que atualiza um usuário existente.
