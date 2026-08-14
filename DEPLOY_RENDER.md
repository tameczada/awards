# Deploy no Render — passo a passo

## 1. Preparar o Supabase (antes de tudo)

1. Acesse seu projeto em https://supabase.com/dashboard
2. Vá em **SQL Editor** → **New query**
3. Cole todo o conteúdo do arquivo `schema.sql` deste projeto e clique em **Run**
4. Confirme que apareceram as tabelas `admins`, `site_settings`, `categories`,
   `options`, `votes` em **Table Editor**
5. Confirme que existe um bucket `site-media` em **Storage** (marcado como público)
6. Vá em **Settings → API** e anote:
   - **Project URL**
   - **service_role** key (na seção "Project API keys" — é a secreta, não a `anon`)

## 2. Subir o código pro GitHub

```bash
cd votacao-app
git init
git add .
git commit -m "Sistema de votação pronto para deploy"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/votacao-app.git
git push -u origin main
```

(`.env` já está no `.gitignore`, então suas chaves não vão pro repositório.)

## 3. Criar o Web Service no Render

1. Acesse https://dashboard.render.com
2. **New +** → **Web Service**
3. Conecte o repositório que você acabou de criar
4. O Render detecta o `render.yaml` automaticamente, mas confirme:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (ou o que preferir)

## 4. Variáveis de ambiente

Em **Environment** (ou durante a criação), adicione:

| Variável | Valor |
|---|---|
| `SUPABASE_URL` | a Project URL que você copiou |
| `SUPABASE_SERVICE_KEY` | a service_role key que você copiou |
| `JWT_SECRET` | deixe o Render gerar (`generateValue`) ou cole uma string aleatória longa |
| `ADMIN_SETUP_KEY` | idem — string aleatória que só você vai saber |

## 5. Deploy e primeiro acesso

1. Clique em **Create Web Service** — o Render vai instalar dependências e subir o app
2. Quando o deploy terminar, acesse `https://SEU-APP.onrender.com/admin.html`
3. Clique em **"Primeiro acesso? Criar admin"**
4. Preencha a `ADMIN_SETUP_KEY` (a mesma que você colocou nas env vars), escolha usuário
   e senha do admin
5. Faça login e comece a criar suas categorias

### Dica de segurança
Depois de criar o admin, você pode trocar o valor de `ADMIN_SETUP_KEY` no Render
(Environment → editar → salvar, o serviço reinicia sozinho) para impedir que alguém
tente criar outro admin usando a chave antiga.

## Observações sobre o plano Free do Render

- O serviço "dorme" depois de um tempo sem acessos e demora ~30-50s para acordar no
  primeiro request — normal no plano gratuito, não é bug.
- Não há disco persistente no Free, mas isso não é um problema aqui: todas as imagens
  vão para o Supabase Storage, não para o disco do Render.
