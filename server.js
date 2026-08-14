require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== VALIDAÇÃO DE ENV =====
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET', 'ADMIN_SETUP_KEY'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('Faltam variáveis de ambiente:', missing.join(', '));
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const BUCKET = 'site-media';

// ===== MIDDLEWARE =====
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Apenas imagens são permitidas'));
    cb(null, true);
  },
});

const voteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de voto. Aguarde um momento.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' },
});

// ===== HELPERS =====
function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function computeStatus(cat) {
  const now = new Date();
  if (cat.status === 'encerrada') return 'encerrada';
  if (cat.starts_at && new Date(cat.starts_at) > now) return 'agendada';
  if (cat.ends_at && new Date(cat.ends_at) < now) return 'encerrada';
  if (cat.status === 'aberta') return 'aberta';
  return cat.status;
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

async function uploadImage(file, prefix) {
  const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const filename = `${prefix}/${crypto.randomUUID()}.${ext || 'jpg'}`;
  const { error } = await supabase.storage.from(BUCKET).upload(filename, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

// =====================================================
// ROTAS PÚBLICAS
// =====================================================

app.get('/api/settings', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/categories', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, description, image_url, status, starts_at, ends_at, display_order')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  const withStatus = data.map((c) => ({ ...c, status: computeStatus(c) }));
  res.json(withStatus);
});

app.get('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { data: cat, error: catErr } = await supabase.from('categories').select('*').eq('id', id).single();
  if (catErr || !cat) return res.status(404).json({ error: 'Categoria não encontrada' });

  const { data: options, error: optErr } = await supabase
    .from('options')
    .select('id, name, image_url, display_order')
    .eq('category_id', id)
    .order('display_order', { ascending: true });
  if (optErr) return res.status(500).json({ error: optErr.message });

  const status = computeStatus(cat);
  const payload = { ...cat, status, options };

  if (status === 'encerrada') {
    const { data: votes } = await supabase.from('votes').select('option_id').eq('category_id', id);
    const counts = {};
    (votes || []).forEach((v) => (counts[v.option_id] = (counts[v.option_id] || 0) + 1));
    const total = votes ? votes.length : 0;
    payload.options = options
      .map((o) => ({ ...o, votes: counts[o.id] || 0, percent: total ? Math.round(((counts[o.id] || 0) / total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.votes - a.votes);
    payload.total_votes = total;
  }

  res.json(payload);
});

app.post('/api/vote', voteLimiter, async (req, res) => {
  const { category_id, option_id, voter_id } = req.body;
  if (!category_id || !option_id || !voter_id) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const { data: cat, error: catErr } = await supabase.from('categories').select('*').eq('id', category_id).single();
  if (catErr || !cat) return res.status(404).json({ error: 'Categoria não encontrada' });
  if (computeStatus(cat) !== 'aberta') return res.status(403).json({ error: 'Votação não está aberta nesta categoria' });

  const { data: opt } = await supabase.from('options').select('id').eq('id', option_id).eq('category_id', category_id).single();
  if (!opt) return res.status(400).json({ error: 'Opção inválida para esta categoria' });

  const ip = getClientIp(req);
  const voterHash = crypto
    .createHash('sha256')
    .update(`${voter_id}:${category_id}:${process.env.JWT_SECRET}`)
    .digest('hex');

  const { error: insertErr } = await supabase.from('votes').insert({
    category_id,
    option_id,
    voter_hash: voterHash,
    voter_ip: ip,
  });

  if (insertErr) {
    if (insertErr.code === '23505') {
      return res.status(409).json({ error: 'Você já votou nesta categoria' });
    }
    return res.status(500).json({ error: insertErr.message });
  }

  res.json({ success: true });
});

app.get('/api/vote/status/:categoryId', async (req, res) => {
  const { categoryId } = req.params;
  const { voter_id } = req.query;
  if (!voter_id) return res.json({ voted: false });
  const voterHash = crypto
    .createHash('sha256')
    .update(`${voter_id}:${categoryId}:${process.env.JWT_SECRET}`)
    .digest('hex');
  const { data } = await supabase.from('votes').select('option_id').eq('category_id', categoryId).eq('voter_hash', voterHash).maybeSingle();
  res.json({ voted: !!data, option_id: data ? data.option_id : null });
});

// =====================================================
// AUTENTICAÇÃO ADMIN
// =====================================================

// Cria o primeiro (e único, se quiser) admin. Protegido por chave de setup no .env,
// não por login (porque ainda não existe nenhum admin no início).
app.post('/api/admin/setup', authLimiter, async (req, res) => {
  const { setup_key, username, password } = req.body;
  if (setup_key !== process.env.ADMIN_SETUP_KEY) {
    return res.status(403).json({ error: 'Chave de setup inválida' });
  }
  if (!username || !password || password.length < 8) {
    return res.status(400).json({ error: 'Usuário obrigatório e senha com mínimo 8 caracteres' });
  }
  const { data: existing } = await supabase.from('admins').select('id').eq('username', username).maybeSingle();
  if (existing) return res.status(409).json({ error: 'Usuário já existe' });

  const hash = await bcrypt.hash(password, 12);
  const { error } = await supabase.from('admins').insert({ username, password_hash: hash });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/admin/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios' });

  const { data: admin } = await supabase.from('admins').select('*').eq('username', username).maybeSingle();
  if (!admin) return res.status(401).json({ error: 'Credenciais inválidas' });

  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

  const token = jwt.sign({ id: admin.id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, username: admin.username });
});

app.get('/api/admin/me', authRequired, (req, res) => {
  res.json({ username: req.admin.username });
});

// =====================================================
// ADMIN: CONFIGURAÇÕES DO SITE
// =====================================================

const VALID_THEMES = ['premiere', 'rose', 'esmeralda', 'oceano', 'royal', 'custom'];
const VALID_FONTS = ['classic', 'elegante', 'moderno', 'impacto', 'jornal', 'divertido'];
const VALID_BG_MODES = ['image', 'color'];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const CUSTOM_COLOR_KEYS = ['gold', 'goldSoft', 'crimson', 'crimsonSoft', 'void', 'card', 'cream'];

app.put('/api/admin/settings', authRequired, async (req, res) => {
  const { site_title, site_subtitle, theme, font_pair, background_mode, background_color, custom_colors } = req.body;
  const update = { updated_at: new Date().toISOString() };

  if (site_title !== undefined) update.site_title = site_title;
  if (site_subtitle !== undefined) update.site_subtitle = site_subtitle;

  if (theme !== undefined) {
    if (!VALID_THEMES.includes(theme)) return res.status(400).json({ error: 'Tema inválido' });
    update.theme = theme;
  }

  if (font_pair !== undefined) {
    if (!VALID_FONTS.includes(font_pair)) return res.status(400).json({ error: 'Fonte inválida' });
    update.font_pair = font_pair;
  }

  if (background_mode !== undefined) {
    if (!VALID_BG_MODES.includes(background_mode)) return res.status(400).json({ error: 'Modo de fundo inválido' });
    update.background_mode = background_mode;
  }

  if (background_color !== undefined) {
    if (background_color !== null && !HEX_RE.test(background_color)) {
      return res.status(400).json({ error: 'Cor de fundo inválida (use formato #RRGGBB)' });
    }
    update.background_color = background_color;
  }

  if (custom_colors !== undefined) {
    if (custom_colors !== null) {
      if (typeof custom_colors !== 'object' || Array.isArray(custom_colors)) {
        return res.status(400).json({ error: 'Cores personalizadas inválidas' });
      }
      const cleaned = {};
      for (const key of Object.keys(custom_colors)) {
        if (!CUSTOM_COLOR_KEYS.includes(key)) continue;
        const val = custom_colors[key];
        if (val && !HEX_RE.test(val)) return res.status(400).json({ error: `Cor inválida para "${key}" (use #RRGGBB)` });
        if (val) cleaned[key] = val;
      }
      update.custom_colors = cleaned;
    } else {
      update.custom_colors = null;
    }
  }

  const { data, error } = await supabase.from('site_settings').update(update).eq('id', 1).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/admin/settings/background', authRequired, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });
  try {
    const url = await uploadImage(req.file, 'backgrounds');
    const { data, error } = await supabase
      .from('site_settings')
      .update({ background_image_url: url, background_mode: 'image', updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// ADMIN: CATEGORIAS
// =====================================================

app.get('/api/admin/categories', authRequired, async (req, res) => {
  const { data, error } = await supabase
    .from('categories')
    .select('*, options(count)')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map((c) => ({ ...c, status: computeStatus(c), options_count: c.options?.[0]?.count || 0 })));
});

app.post('/api/admin/categories', authRequired, async (req, res) => {
  const { name, description, status, starts_at, ends_at, display_order } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  const { data, error } = await supabase
    .from('categories')
    .insert({
      name,
      description: description || null,
      status: status || 'agendada',
      starts_at: starts_at || null,
      ends_at: ends_at || null,
      display_order: display_order || 0,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/admin/categories/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { name, description, status, starts_at, ends_at, display_order } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (status !== undefined) update.status = status;
  if (starts_at !== undefined) update.starts_at = starts_at || null;
  if (ends_at !== undefined) update.ends_at = ends_at || null;
  if (display_order !== undefined) update.display_order = display_order;

  const { data, error } = await supabase.from('categories').update(update).eq('id', id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/admin/categories/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/admin/categories/:id/image', authRequired, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });
  try {
    const url = await uploadImage(req.file, 'categories');
    const { data, error } = await supabase
      .from('categories')
      .update({ image_url: url })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/categories/:id/results', authRequired, async (req, res) => {
  const { id } = req.params;
  const { data: options, error: optErr } = await supabase.from('options').select('id, name, image_url').eq('category_id', id);
  if (optErr) return res.status(500).json({ error: optErr.message });
  const { data: votes } = await supabase.from('votes').select('option_id').eq('category_id', id);
  const counts = {};
  (votes || []).forEach((v) => (counts[v.option_id] = (counts[v.option_id] || 0) + 1));
  const total = votes ? votes.length : 0;
  const results = options
    .map((o) => ({ ...o, votes: counts[o.id] || 0, percent: total ? Math.round(((counts[o.id] || 0) / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.votes - a.votes);
  res.json({ total_votes: total, results });
});

// =====================================================
// ADMIN: OPÇÕES
// =====================================================

app.post('/api/admin/options', authRequired, async (req, res) => {
  const { category_id, name, display_order } = req.body;
  if (!category_id || !name) return res.status(400).json({ error: 'Categoria e nome são obrigatórios' });

  const { data, error } = await supabase
    .from('options')
    .insert({ category_id, name, display_order: display_order || 0 })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/admin/options/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { name, display_order } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (display_order !== undefined) update.display_order = display_order;

  const { data, error } = await supabase.from('options').update(update).eq('id', id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/admin/options/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('options').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/admin/options/:id/image', authRequired, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });
  try {
    const url = await uploadImage(req.file, 'options');
    const { data, error } = await supabase.from('options').update({ image_url: url }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== SPA fallback / erros =====
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Rota não encontrada' });
  next();
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof multer.MulterError || err.message === 'Apenas imagens são permitidas') {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
