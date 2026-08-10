# ⚡ Quick Start - 5 Minutos

Comece agora! Este arquivo tem apenas os passos essenciais.

## 1️⃣ Supabase (2 min)

```bash
# Acesse https://supabase.com
# Crie um projeto (grátis)
# Copie a URL e a chave (Project Settings > API)
```

## 2️⃣ Setup Local (2 min)

```bash
# Clone ou copie a pasta do projeto
cd votacao-app

# Instale dependências
npm install

# Crie .env na raiz com:
SUPABASE_URL=sua-url-aqui
SUPABASE_KEY=sua-chave-aqui
JWT_SECRET=gereumasenhaaleatoriaaqui
PORT=3000
```

## 3️⃣ Database (1 min)

```bash
# No Supabase:
# SQL Editor > Novo Query
# Cole todo conteúdo de schema.sql
# Clique em Executar (▶️)
```

## 4️⃣ Rodar

```bash
npm start

# Acesse:
# http://localhost:3000         (votação)
# http://localhost:3000/admin.html  (admin)
```

## 5️⃣ Admin

1. Clique em "Criar conta"
2. Username + senha (min 6 caracteres)
3. Pronto! Você é admin

---

## 🎯 Usar

**Admin Dashboard:**
- Criar categoria (nome + datas)
- Editar e adicionar opções
- Deletar categoria

**Site de Votação:**
- Visitantes votam em categorias abertas
- Veem resultados após encerramento

---

## 🚀 Deploy Render (Extra)

```bash
# 1. Push no GitHub
git add .
git commit -m "Initial"
git push

# 2. Acesse render.com
# 3. New > Web Service
# 4. Conecte GitHub
# 5. Add Environment Variables:
#    SUPABASE_URL
#    SUPABASE_KEY
#    JWT_SECRET

# 6. Deploy!
```

---

**Pronto! Seu sistema de votação está rodando!** 🎉

Dúvidas? Veja os outros arquivos (README.md, GUIA_DE_USO.md)
