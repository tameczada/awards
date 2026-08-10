# 📖 Guia Completo de Uso - Sistema de Votação

## 📑 Índice

1. [Setup Inicial](#setup-inicial)
2. [Admin - Painel de Controle](#admin---painel-de-controle)
3. [Votação - Site Público](#votação---site-público)
4. [Exemplos Práticos](#exemplos-práticos)
5. [Dicas e Boas Práticas](#dicas-e-boas-práticas)

---

## 🚀 Setup Inicial

### Passo 1: Preparar o Supabase

1. Vá para https://supabase.com/dashboard
2. Crie um novo projeto (ou use um existente)
3. Aguarde 2-3 minutos enquanto o projeto é criado
4. Vá em **SQL Editor** (lado esquerdo)
5. Clique em **"Novo Query"**
6. Cole todo o conteúdo do arquivo `schema.sql`
7. Clique em **"Executar"** (▶️)

Sucesso! Suas tabelas estão criadas. ✅

### Passo 2: Obter Credenciais

1. Vá em **Project Settings** (⚙️)
2. Clique em **API** (lado esquerdo)
3. Copie:
   - **Project URL** (coloca em `SUPABASE_URL`)
   - **anon public key** (coloca em `SUPABASE_KEY`)

### Passo 3: Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5...
JWT_SECRET=seu_secret_super_seguro_aleatorio
PORT=3000
```

### Passo 4: Rodar Localmente

```bash
npm install
npm start
```

Pronto! Acesse:
- **Votação**: http://localhost:3000
- **Admin**: http://localhost:3000/admin.html

---

## 🔐 Admin - Painel de Controle

### Login/Registro

**Na primeira vez:**
1. Acesse http://localhost:3000/admin.html
2. Clique em **"Criar conta"** (parte inferior)
3. Defina um **username** e **senha** (mín. 6 caracteres)
4. Clique em **"Criar"**
5. Você voltará ao login
6. Faça login com suas credenciais

**Próximos acessos:**
1. Acesse http://localhost:3000/admin.html
2. Digite username e senha
3. Clique em **"Entrar"**

### Criar uma Categoria

1. **Preenchça o formulário:**
   - **Nome**: "Pior filme de 2024" (máximo 255 caracteres)
   - **Início**: Data e hora quando a votação começa
   - **Encerramento**: Data e hora quando a votação fecha

2. **Clique em "➕ Criar Categoria"**

**Exemplo:**
```
Nome: Melhor anime 2024
Início: 01/01/2025 às 09:00
Encerramento: 31/01/2025 às 23:59
```

### Adicionar Opções a uma Categoria

1. Na lista de categorias, clique em **"✏️ Editar"**
2. Você verá a categoria aberta em um modal
3. Role para baixo até **"Opções"**
4. Digite o nome da opção no campo
5. Clique em **"➕"** para adicionar
6. Repita para cada opção

**Exemplo para "Melhor anime 2024":**
- "Anime A"
- "Anime B"
- "Anime C"
- "Anime D"

### Editar Categoria

1. Clique em **"✏️ Editar"** na categoria
2. Modifique:
   - Nome
   - Datas
   - Opções (edite no campo ou clique ✕ para remover)
3. Clique em **"💾 Salvar"**

### Deletar Categoria

1. Clique em **"🗑️ Deletar"** na categoria
2. Confirme a exclusão

**⚠️ Aviso**: Isso deleta a categoria, todas as opções e TODOS os votos!

---

## 🗳️ Votação - Site Público

### Interface do Votante

1. **Acesse http://localhost:3000 (ou seu domínio)**
2. Você verá um grid com as categorias
3. Cada card mostra:
   - Nome da categoria
   - Status (Aberta/Encerrada/Não iniciada)
   - Data de encerramento

### Votando

**Se a votação está ABERTA:**
1. Clique em **"Votar Agora"**
2. Selecione uma opção (muda de cor ao clicar)
3. Clique em **"✓ Confirmar Voto"**
4. Pronto! ✅

**Se a votação está ENCERRADA:**
1. Clique em **"Ver Resultados"**
2. Você verá:
   - Total de votos
   - Ranking (🥇 1º lugar, 🥈 2º, etc)
   - Porcentagem por opção
   - Gráfico visual

### Limitações

- ✅ **Um voto por pessoa por categoria** (controlado por IP)
- ✅ **Não pode votar em categorias não iniciadas**
- ✅ **Não pode ver resultados enquanto votação está aberta**
- ✅ **Histórico guardado em localStorage** (local do navegador)

---

## 📚 Exemplos Práticos

### Caso 1: Eleição de Melhor Filme

**Admin:**
1. Cria categoria: "Eleição - Melhor Filme 2024"
2. Início: 15/01/2025 09:00
3. Fim: 22/01/2025 17:00
4. Adiciona opções:
   - "Filme A"
   - "Filme B"
   - "Filme C"
   - "Filme D"
   - "Nenhum dos anteriores"

**Votantes:**
1. Acessam o site
2. Clicam em "Votar Agora"
3. Escolhem seu filme favorito
4. Confirmam o voto

**Após 22/01:**
- Votantes clicam em "Ver Resultados"
- Veem ranking completo com porcentagens

### Caso 2: Eleição com Múltiplas Categorias

Você pode criar várias categorias ao mesmo tempo:

**Categoria 1:** "Melhor Série"
**Categoria 2:** "Melhor Anime"
**Categoria 3:** "Melhor Filme"
**Categoria 4:** "Pior Tradução"

Cada votante pode:
- ✅ Votar uma vez em cada categoria
- ✅ Ver resultados de categorias encerradas
- ✅ Votar em categorias abertas

---

## 💡 Dicas e Boas Práticas

### Organização de Datas

```
Hoje: 10 de janeiro de 2025

Bom:
Início: 10/01 às 10:00 (agora)
Fim: 17/01 às 23:59 (uma semana)

Ruim:
Início: 10/01 às 10:00
Fim: 10/01 às 11:00 (muito curto!)
```

### Nomeando Categorias

✅ Bom:
- "Melhor anime winter 2025"
- "Pior filme de ficção científica"
- "Tech gadget favorito 2024"

❌ Ruim:
- "Votação 1"
- "xxxxx"
- "😀😀😀😀"

### Quantidade de Opções

✅ Ideal: 3-5 opções
⚠️ Limite recomendado: até 20
❌ Muito: 50+ (fica bagunçado)

### Administradores

- **Um por projeto** é ideal (no free tier)
- Se quiser múltiplos admins, crie contas diferentes
- Cada admin tem suas próprias credenciais

### Segurança

- 🔐 Senhas são hasheadas (bcryptjs)
- 🔐 Tokens JWT expiraminam em 7 dias
- 🔐 Votos são registrados por IP (difícil de burlar)
- 🔐 Senha mínima de 6 caracteres (use mais forte!)

---

## 🚨 Problemas Comuns

### "Votação não aparece no site"

**Verificar:**
1. A data de início já passou?
2. A data de fim ainda não chegou?
3. Há pelo menos uma opção na categoria?

**Solução:**
- Edite a categoria e ajuste as datas
- Adicione opções se necessário

### "Não consigo votar"

**Verificar:**
1. Você já votou nesta categoria?
   - Histórico guardado em localStorage
   - Limpar cache do navegador resolve

2. A votação está aberta?
   - Veja o status no card

**Solução:**
```javascript
// No console do navegador (F12):
localStorage.removeItem('votedCategories');
location.reload();
```

### "Resultados não aparecem"

**Verificar:**
1. A votação realmente encerrou?
2. Há votos registrados?

**Solução:**
- Espere até a data de encerramento
- Verifique no Supabase se há votos (SQL: `SELECT * FROM votes`)

### "Erro ao conectar Supabase"

**Verificar:**
1. URL e chave estão corretas em `.env`?
2. RLS policies estão ok no Supabase?
3. Internet funcionando?

**Solução:**
- Teste no Supabase SQL Editor: `SELECT 1`
- Regenere a chave se necessário

---

## 🎯 Checklist para Launch

Antes de colocar em produção:

- [ ] Testou criação de categoria localmente?
- [ ] Adicionou opções com sucesso?
- [ ] Votou e viu o voto ser registrado?
- [ ] Viu resultados após encerramento?
- [ ] Configurou corretamente no Render?
- [ ] Testou em móvel/tablet?
- [ ] Mudou a senha padrão do admin?
- [ ] JWT_SECRET é aleatório e forte?
- [ ] Schema do Supabase está criado?
- [ ] Deploy no Render foi bem-sucedido?

---

**Parabéns! Você está pronto para usar o sistema de votação!** 🎉
