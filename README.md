# 🗳️ Sistema de Votação por Categoria

Um site moderno e pronto para deploy de votação por categoria com painel admin completo e banco de dados Supabase.

## ✨ Funcionalidades

- ✅ **Painel Admin com autenticação** - Login seguro com JWT
- 📂 **Gerenciamento de categorias** - CRUD completo
- 🎯 **Adicionar opções** - Customize cada categoria
- 📅 **Controle de datas** - Defina início e fim das votações
- 🗳️ **Votação por IP** - Um voto por pessoa por categoria
- 📊 **Resultados** - Visualize após encerramento (porcentagem, ranking)
- 🎨 **Design responsivo** - Funciona em mobile e desktop
- 🚀 **Deploy pronto** - Render + Supabase

## 🛠️ Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Database**: Supabase (PostgreSQL)
- **Deploy**: Render
- **Autenticação**: JWT + Bcrypt

## 📋 Pré-requisitos

1. **Conta Supabase** (gratuita)
2. **Conta Render** (gratuita)
3. **Node.js 16+** (para testes locais)
4. **Git** (para deploy)

## 🚀 Setup Local

### 1. Clonar o projeto
```bash
git clone seu-repo-aqui
cd votacao-app
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Vá em **SQL Editor** e execute o conteúdo de `schema.sql`
4. Copie sua **URL do projeto** e **API Key anon**

### 4. Criar arquivo `.env`
```bash
cp .env.example .env
```

Edite `.env` com suas credenciais:
```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua-chave-anon
JWT_SECRET=gerar-uma-senha-aleatoria-super-segura
PORT=3000
```

Para gerar um JWT_SECRET seguro, use:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Rodar localmente
```bash
npm start
```

A aplicação estará em:
- 🌐 **Votação**: http://localhost:3000
- 🔐 **Admin**: http://localhost:3000/admin.html

### 6. Criar primeira conta admin

1. Acesse http://localhost:3000/admin.html
2. Clique em "Criar conta"
3. Defina username e senha
4. Faça login

## 📚 Como Usar

### Criar uma Votação

1. **No painel admin**, preencha o formulário:
   - Nome da categoria (ex: "Pior filme de 2024")
   - Data/hora de início
   - Data/hora de encerramento

2. **Clique em "Criar Categoria"**

3. **Edite a categoria** para adicionar opções (ex: "Filme A", "Filme B", etc)

### Votar

1. **Na página pública** (home)
2. Selecione uma categoria com votação aberta
3. Escolha uma opção
4. Clique em "Confirmar Voto"

### Ver Resultados

- Categorias **encerradas** mostram um botão "Ver Resultados"
- Resulta mostra: ranking, total de votos, porcentagem por opção

## 🌐 Deploy no Render

### 1. Fazer push no GitHub
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Conectar no Render

1. Acesse [render.com](https://render.com)
2. Clique em **"New +"** > **"Web Service"**
3. Conecte seu repositório GitHub
4. Configure:
   - **Name**: `votacao-app` (ou seu nome)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 3. Adicionar variáveis de ambiente

Clique em **"Environment"** e adicione:

```
SUPABASE_URL = sua-url-supabase
SUPABASE_KEY = sua-chave-supabase
JWT_SECRET = sua-senha-aleatoria
```

### 4. Deploy

Clique em **"Deploy"** e aguarde! 🚀

Seu site estará disponível em: `seu-nome.onrender.com`

## 📱 Estrutura de Pastas

```
votacao-app/
├── server.js              # Servidor Express
├── schema.sql             # Script SQL do Supabase
├── package.json
├── render.yaml            # Config Render
├── .env.example
├── README.md
└── public/
    ├── index.html         # Página de votação
    ├── admin.html         # Painel admin
    ├── css/
    │   └── style.css      # Estilos
    └── js/
        ├── votacao.js     # Lógica votação
        └── admin.js       # Lógica admin
```

## 🔑 Endpoints da API

### Autenticação
- `POST /api/auth/register` - Criar admin
- `POST /api/auth/login` - Login

### Categorias
- `GET /api/categories` - Listar todas
- `POST /api/categories` - Criar (requer auth)
- `PUT /api/categories/:id` - Editar (requer auth)
- `DELETE /api/categories/:id` - Deletar (requer auth)

### Opções
- `POST /api/options` - Criar opção (requer auth)
- `PUT /api/options/:id` - Editar (requer auth)
- `DELETE /api/options/:id` - Deletar (requer auth)

### Votação
- `POST /api/vote` - Registrar voto
- `GET /api/results/:categoryId` - Obter resultados
- `GET /api/categories/:id/status` - Verificar status

## 🔒 Segurança

- ✅ Senhas com hash (bcrypt)
- ✅ Autenticação com JWT
- ✅ Um voto por IP por categoria
- ✅ Validação de datas
- ✅ Resultados visíveis só após encerramento

## 🐛 Troubleshooting

### "Erro de conexão Supabase"
- Verifique URL e chave no `.env`
- Confirme que o schema foi executado
- Teste a conexão no Supabase SQL Editor

### "Erro 401 ao fazer login"
- Certifique-se que o admin foi criado
- Verifique se JWT_SECRET está igual localmente e no Render
- Limpe localStorage e tente novamente

### "Votação não aparece"
- Verifique se a data de início passou
- Confirme se a data de encerramento ainda não passou
- Refresque a página

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique o console (F12) para erros
2. Confira os logs no Render
3. Teste localmente antes de fazer deploy

## 📄 Licença

MIT - Use livremente!

---

**Desenvolvido com ❤️ para votações incríveis!**
