# 🏆 Votação Oficial

Sistema completo de votação por categoria (ex: "Pior filme do ano", "Melhor meme"),
com painel administrativo próprio, banco de dados Supabase e pronto para deploy no Render.

## O que tem

- **Site público**: grid de categorias estilo "ingresso de premiação", votação com
  1 voto por pessoa por categoria, resultados só aparecem depois que a categoria encerra.
- **Painel admin** (`/admin.html`): login protegido, CRUD completo de categorias e opções,
  upload de imagem por categoria, upload da imagem de fundo (ou cor sólida), temas de
  cor (prontos ou 100% personalizados), tipografia, e apuração de votos em tempo real.
- **Dashboard ao vivo** (`/dashboard.html`): página separada, sem login (acesso por
  token na URL), com cards de todas as categorias atualizando via WebSocket em tempo
  real — pronta pra usar como fonte de navegador no OBS.
- **Votação pelo chat da Twitch**: bot que entra no canal via `tmi.js` (WebSocket) e
  registra votos de comandos tipo `!votar 2`, com 1 voto por espectador por categoria.
- **Backend**: Node.js + Express, com Supabase (Postgres + Storage) como banco e
  repositório de imagens.

## Stack

- Node.js + Express + `ws` (WebSocket) pro dashboard ao vivo
- `tmi.js` (cliente de chat da Twitch via WebSocket) pra votação pelo chat
- Supabase (Postgres + Storage) — via `@supabase/supabase-js` com a **service role key**
- JWT + bcrypt para autenticação do admin
- Multer para upload de imagens (memória → Supabase Storage)
- Frontend: HTML + CSS + JS puro (sem framework, sem build step)

## 1. Configurar o Supabase

1. No seu projeto Supabase, abra **SQL Editor** e rode o conteúdo inteiro do arquivo
   `schema.sql` (cria as tabelas, políticas de RLS e o bucket de imagens `site-media`).
2. Em **Settings → API**, copie:
   - `Project URL` → vai virar `SUPABASE_URL`
   - `service_role` key (não é a `anon`!) → vai virar `SUPABASE_SERVICE_KEY`

> ⚠️ A `service_role` key tem acesso total ao banco e ignora RLS. Ela só é usada no
> backend (nunca no navegador) — é assim que o admin consegue escrever mesmo com o
> RLS bloqueando escrita pública.

## 2. Rodar localmente

```bash
npm install
cp .env.example .env
# edite o .env com SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET e ADMIN_SETUP_KEY
npm start
```

Acesse:
- Site público: http://localhost:3000
- Painel admin: http://localhost:3000/admin.html

No admin, clique em **"Primeiro acesso? Criar admin"**, informe a `ADMIN_SETUP_KEY`
que você colocou no `.env`, escolha usuário e senha. Depois é só logar normalmente.

## 3. Deploy no Render

1. Suba este projeto para um repositório no GitHub.
2. No Render: **New → Web Service**, conecte o repositório (o `render.yaml` já configura
   build/start automaticamente — Build: `npm install`, Start: `npm start`).
3. Em **Environment**, adicione as variáveis:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `JWT_SECRET` (o Render pode gerar um valor aleatório sozinho)
   - `ADMIN_SETUP_KEY` (idem)
4. Deploy. Quando terminar, acesse `https://seu-app.onrender.com/admin.html` e crie o
   admin do mesmo jeito que localmente.

Detalhes completos em `DEPLOY_RENDER.md`.

## Estrutura

```
votacao-app/
├── server.js               # backend Express + WebSocket (todas as rotas)
├── twitch.js                # módulo do bot de chat da Twitch (tmi.js)
├── schema.sql                # script para rodar no Supabase
├── package.json
├── render.yaml               # deploy automático no Render
├── .env.example
└── public/
    ├── index.html            # site público
    ├── admin.html             # painel admin
    ├── dashboard.html          # dashboard ao vivo (OBS/navegador)
    ├── css/
    │   ├── style.css          # identidade visual (site + base do admin)
    │   ├── admin.css           # estilos específicos do painel
    │   └── dashboard.css        # estilos do dashboard ao vivo
    └── js/
        ├── themes.js           # paletas de cor + pares de fonte
        ├── votacao.js          # lógica da votação pública
        ├── admin.js            # lógica do painel admin
        └── dashboard.js         # lógica do dashboard (WebSocket)
```

## Segurança implementada

- Senhas de admin com bcrypt (12 rounds)
- Sessão via JWT (expira em 12h)
- Rate limiting no login e na votação
- Voto único por categoria via hash (id anônimo do navegador + categoria + segredo do servidor)
- RLS no Supabase: leitura pública liberada, escrita só pela service role key (backend)
- Criação do admin protegida por uma chave de setup (`ADMIN_SETUP_KEY`) que só existe no `.env`

## Documentação extra

- `DEPLOY_RENDER.md` — passo a passo detalhado do deploy
- `GUIA_DE_USO.md` — como usar o painel no dia a dia
