import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'seu-secret-super-seguro';

// ===================== AUTENTICAÇÃO =====================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e password obrigatórios' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('admin_users')
      .insert([{ username, password_hash: hashedPassword }])
      .select();

    if (error) throw error;

    res.json({ message: 'Admin criado com sucesso', user: data[0] });
  } catch (error) {
    console.error('Erro ao registrar:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const validPassword = await bcrypt.compare(password, data.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    const token = jwt.sign({ id: data.id, username: data.username }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({ token, message: 'Login realizado com sucesso' });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ error: error.message });
  }
});

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

// ===================== CATEGORIAS =====================
app.get('/api/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*, options(id, text)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
    const { name, start_date, end_date } = req.body;

    if (!name || !start_date || !end_date) {
      return res.status(400).json({ error: 'Nome, data início e fim obrigatórios' });
    }

    const { data, error } = await supabase
      .from('categories')
      .insert([{ name, start_date, end_date }])
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, start_date, end_date } = req.body;

    const { data, error } = await supabase
      .from('categories')
      .update({ name, start_date, end_date })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Categoria deletada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================== OPÇÕES =====================
app.post('/api/options', authenticateToken, async (req, res) => {
  try {
    const { category_id, text } = req.body;

    if (!category_id || !text) {
      return res.status(400).json({ error: 'Category ID e text obrigatórios' });
    }

    const { data, error } = await supabase
      .from('options')
      .insert([{ category_id, text }])
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/options/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    const { data, error } = await supabase
      .from('options')
      .update({ text })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/options/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('options')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Opção deletada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================== VOTAÇÃO =====================
app.post('/api/vote', async (req, res) => {
  try {
    const { category_id, option_id } = req.body;
    const clientIp = req.ip;

    // Verifica se já votou nesta categoria
    const { data: existingVote, error: checkError } = await supabase
      .from('votes')
      .select('id')
      .eq('category_id', category_id)
      .eq('voter_ip', clientIp)
      .single();

    if (existingVote) {
      return res.status(400).json({ error: 'Você já votou nesta categoria' });
    }

    const { data, error } = await supabase
      .from('votes')
      .insert([{ category_id, option_id, voter_ip: clientIp }])
      .select();

    if (error) throw error;
    res.json({ message: 'Voto registrado com sucesso', vote: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================== RESULTADOS =====================
app.get('/api/results/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Pega a categoria
    const { data: category, error: catError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (catError) throw catError;

    // Verifica se já encerrou
    const now = new Date();
    const endDate = new Date(category.end_date);

    if (now < endDate) {
      return res.status(403).json({ error: 'Votação ainda está aberta' });
    }

    // Pega todas as opções com contagem de votos
    const { data: options, error: optError } = await supabase
      .from('options')
      .select(`
        id,
        text,
        votes(id)
      `)
      .eq('category_id', categoryId);

    if (optError) throw optError;

    // Processa resultados
    const totalVotes = options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);
    
    const results = options
      .map(opt => ({
        id: opt.id,
        text: opt.text,
        votes: opt.votes?.length || 0,
        percentage: totalVotes > 0 ? ((opt.votes?.length || 0) / totalVotes * 100).toFixed(2) : 0
      }))
      .sort((a, b) => b.votes - a.votes);

    res.json({
      category,
      totalVotes,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================== VERIFICAÇÃO DE STATUS =====================
app.get('/api/categories/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: category, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    const now = new Date();
    const startDate = new Date(category.start_date);
    const endDate = new Date(category.end_date);

    let status;
    if (now < startDate) status = 'not_started';
    else if (now > endDate) status = 'ended';
    else status = 'open';

    res.json({ status, category });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Admin: http://localhost:${PORT}/admin.html`);
  console.log(`🗳️  Votação: http://localhost:${PORT}`);
});
