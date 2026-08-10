# 🚀 Guia de Deploy - Render

Este documento mostra exatamente como deploiar seu site no Render (gratuitamente).

## ⚡ 5 Minutos para o Ar

### Passo 1: GitHub

Se ainda não tem o projeto no GitHub:

```bash
# Estando na pasta do projeto
git init
git add .
git commit -m "Initial commit"
git branch -M main

# Depois, crie um repositório no GitHub e faça:
git remote add origin https://github.com/seu-usuario/votacao-app.git
git push -u origin main
```

### Passo 2: Conectar no Render

1. Acesse https://render.com
2. Clique em **Sign Up** (cadastro gratuito)
3. Faça login com GitHub (mais fácil!)
4. Clique em **"New +"**
5. Selecione **"Web Service"**

### Passo 3: Configurar Serviço

Na tela de criação:

1. **Connect Repository**
   - Selecione seu repositório GitHub
   - Se não aparecer, clique em "Configure account" para autorizar

2. **Configurações Básicas:**
   - **Name**: `votacao-app` (ou seu nome)
   - **Environment**: `Node`
   - **Region**: `Ohio` (mais rápido para BR, ou escolha perto de você)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

3. **Plan**: Deixe em `Free`

### Passo 4: Variáveis de Ambiente

Clique em **"Advanced"** (parte inferior) e em **"Add Environment Variable"**:

Adicione as 3 variáveis:

```
Variável 1:
Key: SUPABASE_URL
Value: https://seu-projeto.supabase.co

Variável 2:
Key: SUPABASE_KEY
Value: sua-chave-anon-do-supabase

Variável 3:
Key: JWT_SECRET
Value: gerar-uma-senha-aleatoria-super-segura
```

Para gerar JWT_SECRET seguro, execute no terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Passo 5: Deploy

Clique em **"Create Web Service"** e pronto!

Render vai:
1. Fazer pull do seu GitHub
2. Instalar dependências (`npm install`)
3. Iniciar o servidor (`npm start`)
4. Gerar um URL público

**Isso leva 3-5 minutos.**

---

## ✅ Verificar Deploy

Quando ficar verde (✅ Live):

1. Clique no URL (ex: `https://votacao-app.onrender.com`)
2. Você deve ver a página de votação
3. Acesse o admin: `https://votacao-app.onrender.com/admin.html`
4. Crie um admin e teste!

---

## 🔄 Atualizar Site

Sempre que fizer mudanças:

```bash
git add .
git commit -m "Descrição da mudança"
git push origin main
```

Render faz redeploy automaticamente! ✨

---

## 📊 Monitorar Deploy

Na dashboard do Render:

1. **Logs** - Vê erro em tempo real
2. **Metrics** - CPU, memória, requisições
3. **Events** - Histórico de deploys

Se der erro, clique em **"Manual Deploy"** > **"Deploy latest commit"**

---

## 🎯 Troubleshooting Deploy

### "Build failed"

Geralmente é porque falta uma dependência:

```bash
# Localmente, teste:
npm install
npm start

# Se funcionar local, é problema de variáveis:
# Cheque .env.example vs suas variáveis no Render
```

### "Application failed to start"

Provavelmente falta variável de ambiente:

1. Clique em **"Environment"**
2. Adicione todas as 3 variáveis:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `JWT_SECRET`
3. Clique em **"Manual Deploy"** > **"Deploy latest commit"**

### "Cannot connect to Supabase"

Verifique as credenciais:
1. Vá no Supabase projeto
2. Copie URL e chave novamente
3. Atualize no Render

### Timeout na votação

Pode ser problema de RLS policies no Supabase:
1. Vá em **Authentication** > **Policies**
2. Verifique se as policies permitem INSERT em `votes`
3. Se necessário, abra acesso público (less secure)

---

## 💰 Custo

**Totalmente gratuito!**

- Render: Free tier inclui 750 horas/mês (suficiente)
- Supabase: Free tier inclui 500MB banco + 2GB storage

**Limits:**
- Render roda 24/7 (se usar todas 750 horas)
- Depois volta só durante o horário - não é problema
- Reinicia a cada 15 min se inativo (cold start)

---

## 🔐 Manutenção

### Mudar Senha Admin

1. Acesse seu site admin
2. Clique em **Sair**
3. Clique em **"Criar conta"**
4. Use um novo username/senha
5. Faça login

A senha antiga não funciona mais.

### Backup de Votos

No Supabase:
1. Vá em **SQL Editor**
2. Execute:
```sql
SELECT * FROM votes;
```
3. Copie os resultados para um arquivo seguro

### Deletar Dados Sensíveis

```sql
-- Deletar TODOS os votos
DELETE FROM votes;

-- Deletar uma categoria específica (DELETE em cascade)
DELETE FROM categories WHERE id = X;
```

---

## 📈 Próximos Passos

### Customizar URL

Por padrão Render gera URL tipo `votacao-app-xyz123.onrender.com`

Para ter URL bonita (ex: `votacao-app.com`):
1. Compre um domínio (Namecheap, Google Domains, etc)
2. No Render, clique em **"Settings"**
3. Em **"Custom Domain"**, adicione seu domínio
4. Configure DNS no seu provedor com as instruções

### Adicionar Mais Funcionalidades

Ideias:
- Email de confirmação de voto
- Gráficos mais bonitos
- Dark mode
- API pública para integrações
- Webhooks após encerramento

---

## 📞 Precisa de Ajuda?

1. **Erro no Render?** - Clique em **Logs** e veja a mensagem
2. **Erro no Supabase?** - Vá em **Logs** no dashboard Supabase
3. **Dúvida de configuração?** - Leia `README.md` e `GUIA_DE_USO.md`

---

**Parabéns! Seu site de votação está no ar! 🎉**

Compartilhe o link com seus amigos e comece a votação!

```
Site de votação: https://seu-app.onrender.com
Painel admin: https://seu-app.onrender.com/admin.html
```
