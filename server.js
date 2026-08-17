require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { WebSocketServer } = require('ws');
const { createClient } = require('@supabase/supabase-js');
const twitchBot = require('./twitch');

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

// ===== SERVIDOR HTTP + WEBSOCKET (dashboard ao vivo) =====
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

async function isValidDashboardToken(token) {
  if (!token) return false;
  const { data } = await supabase.from('dashboard_config').select('token').eq('id', 1).single();
  return !!data && data.token === token;
}

wss.on('connection', async (ws, req) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const ok = await isValidDashboardToken(token);
    if (!ok) {
      ws.close(4001, 'unauthorized');
      return;
    }
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  } catch {
    ws.close(4000, 'bad request');
  }
});

// descarta conexões mortas periodicamente
const wsHeartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);
wsHeartbeat.unref();

function broadcastDashboard(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(msg);
  });
}

// agrupa votos rápidos (ex: vários votos chegando juntos) num único broadcast
let broadcastPending = false;
function scheduleDashboardUpdate() {
  if (broadcastPending) return;
  broadcastPending = true;
  setTimeout(() => {
    broadcastPending = false;
    broadcastDashboard({ type: 'update' });
  }, 700);
}

// toast em tempo real "Fulano votou em X" — só dispara se a opção estiver
// ligada no painel admin (dashboard_show_vote_toasts). Envia sempre a opção
// escolhida, mesmo com a categoria ainda não revelada (comportamento
// intencional, decidido junto com o Luyan — é pra dar "hype" em tempo real).
async function maybeBroadcastVoteToast({ categoryName, optionName, voterName }) {
  try {
    const { data: settings } = await supabase.from('site_settings').select('dashboard_show_vote_toasts').eq('id', 1).single();
    if (!settings || !settings.dashboard_show_vote_toasts) return;
    broadcastDashboard({
      type: 'vote_toast',
      voter_name: voterName || 'Alguém',
      category_name: categoryName,
      option_name: optionName,
    });
  } catch (e) {
    /* falha ao checar a config não deve derrubar o voto em si */
  }
}

// ===== HELPERS =====
function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function computeStatus(cat) {
  const now = new Date();
  if (cat.status === 'encerrada') return 'encerrada';
  if (cat.ends_at && new Date(cat.ends_at) < now) return 'encerrada';
  if (cat.starts_at && new Date(cat.starts_at) > now) return 'agendada';
  // pausa manual: só faz sentido enquanto a categoria estaria aberta;
  // se já encerrou ou ainda não começou, os casos acima já resolveram antes
  if (cat.paused) return 'pausada';
  // já passou do horário de início (e não passou do fim, ou não tem fim definido)
  // então a categoria abre sozinha, mesmo que o status manual ainda esteja "agendada"
  if (cat.starts_at) return 'aberta';
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

// snapshot agregado de todas as categorias + opções + contagem de votos,
// usado pelo dashboard ao vivo. Uma consulta por tabela, agregação em memória
// (evita N+1 queries por categoria).
// snapshot completo (todas as categorias, sem censura) — usado no modo "mostrar todas"
async function getLiveSnapshot() {
  const [catsRes, optsRes, votesRes] = await Promise.all([
    supabase.from('categories').select('*').order('display_order', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('options').select('*').order('display_order', { ascending: true }),
    supabase.from('votes').select('category_id, option_id'),
  ]);
  if (catsRes.error) throw catsRes.error;
  if (optsRes.error) throw optsRes.error;
  if (votesRes.error) throw votesRes.error;

  const votesByOption = {};
  const votesByCategory = {};
  (votesRes.data || []).forEach((v) => {
    votesByOption[v.option_id] = (votesByOption[v.option_id] || 0) + 1;
    votesByCategory[v.category_id] = (votesByCategory[v.category_id] || 0) + 1;
  });

  const optionsByCategory = {};
  (optsRes.data || []).forEach((o) => {
    if (!optionsByCategory[o.category_id]) optionsByCategory[o.category_id] = [];
    optionsByCategory[o.category_id].push(o);
  });

  const categoryOptions = (catsRes.data || []).map((c) => ({ id: c.id, name: c.name, status: computeStatus(c) }));

  const categories = (catsRes.data || []).map((cat) => {
    const total = votesByCategory[cat.id] || 0;
    const options = (optionsByCategory[cat.id] || [])
      .map((o) => {
        const votes = votesByOption[o.id] || 0;
        return { id: o.id, name: o.name, image_url: o.image_url, votes, percent: total ? Math.round((votes / total) * 1000) / 10 : 0 };
      })
      .sort((a, b) => b.votes - a.votes);
    return { id: cat.id, name: cat.name, image_url: cat.image_url, card_size: cat.card_size, ends_at: cat.ends_at, status: computeStatus(cat), total_votes: total, options };
  });

  return { categoryOptions, categories, optionsByCategory, votesByOption, votesByCategory, rawCategories: catsRes.data || [] };
}

// payload real enviado ao dashboard: aplica o foco numa categoria e a censura
// dos votos individuais até a revelação (a ordem das opções também não pode
// vazar o ranking, então em modo censurado usa a ordem de cadastro, não a de votos)
async function getDashboardPayload() {
  const { data: cfg, error: cfgErr } = await supabase.from('dashboard_config').select('*').eq('id', 1).single();
  if (cfgErr) throw cfgErr;
  // select(*) em vez de nomear as colunas: se o schema.sql com as colunas novas
  // (focused_category_id/revealed) ainda não foi rodado no banco, isso evita que
  // a consulta quebre inteira — só cai de volta pro modo "mostrar todas".
  const focusedCategoryId = cfg.focused_category_id || null;
  const revealed = !!cfg.revealed;

  const full = await getLiveSnapshot();

  if (!focusedCategoryId) {
    return {
      focused_category_id: null,
      revealed: false,
      category_options: full.categoryOptions,
      categories: full.categories,
    };
  }

  const cat = full.rawCategories.find((c) => c.id === focusedCategoryId);
  if (!cat) {
    // categoria em foco foi excluída — volta pro modo "mostrar todas"
    return {
      focused_category_id: null,
      revealed: false,
      category_options: full.categoryOptions,
      categories: full.categories,
    };
  }

  const total = full.votesByCategory[cat.id] || 0;
  const rawOptions = full.optionsByCategory[cat.id] || [];

  let options;
  if (revealed) {
    options = rawOptions
      .map((o) => {
        const votes = full.votesByOption[o.id] || 0;
        return { id: o.id, name: o.name, image_url: o.image_url, votes, percent: total ? Math.round((votes / total) * 1000) / 10 : 0 };
      })
      .sort((a, b) => b.votes - a.votes);
  } else {
    // censurado: mantém a ordem de cadastro (não a de votos, pra não vazar o ranking)
    // e nunca envia números individuais — só o total geral, que não revela o vencedor
    options = rawOptions.map((o) => ({ id: o.id, name: o.name, image_url: o.image_url, votes: null, percent: null }));
  }

  const focusedCategory = {
    id: cat.id,
    name: cat.name,
    image_url: cat.image_url,
    card_size: cat.card_size,
    ends_at: cat.ends_at,
    status: computeStatus(cat),
    total_votes: total,
    options,
  };

  return {
    focused_category_id: focusedCategoryId,
    revealed,
    category_options: full.categoryOptions,
    categories: [focusedCategory],
  };
}

async function dashboardTokenRequired(req, res, next) {
  const token = req.query.token || (req.body && req.body.token);
  const ok = await isValidDashboardToken(token);
  if (!ok) return res.status(401).json({ error: 'Token do dashboard inválido' });
  next();
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
    .select('id, name, description, image_url, status, starts_at, ends_at, display_order, card_size, paused')
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
  const { category_id, option_id, voter_id, voter_name } = req.body;
  if (!category_id || !option_id || !voter_id) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const { data: cat, error: catErr } = await supabase.from('categories').select('*').eq('id', category_id).single();
  if (catErr || !cat) return res.status(404).json({ error: 'Categoria não encontrada' });
  if (computeStatus(cat) !== 'aberta') return res.status(403).json({ error: 'Votação não está aberta nesta categoria' });

  const { data: opt } = await supabase.from('options').select('id, name').eq('id', option_id).eq('category_id', category_id).single();
  if (!opt) return res.status(400).json({ error: 'Opção inválida para esta categoria' });

  const ip = getClientIp(req);
  const voterHash = crypto
    .createHash('sha256')
    .update(`${voter_id}:${category_id}:${process.env.JWT_SECRET}`)
    .digest('hex');

  // nome é opcional (a página de votação atual não pede nome) — quando
  // enviado, fica salvo pra aparecer no popup "quem votou em quê" do dashboard
  const cleanName = typeof voter_name === 'string' ? voter_name.trim().slice(0, 60) : null;

  const { error: insertErr } = await supabase.from('votes').insert({
    category_id,
    option_id,
    voter_hash: voterHash,
    voter_ip: ip,
    voter_name: cleanName || null,
  });

  if (insertErr) {
    if (insertErr.code === '23505') {
      return res.status(409).json({ error: 'Você já votou nesta categoria' });
    }
    return res.status(500).json({ error: insertErr.message });
  }

  scheduleDashboardUpdate();
  maybeBroadcastVoteToast({ categoryName: cat.name, optionName: opt.name, voterName: cleanName });
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
  const { site_title, site_subtitle, theme, font_pair, background_mode, background_color, custom_colors, dashboard_bg_from_card, dashboard_show_voters, dashboard_show_vote_toasts } = req.body;
  const update = { updated_at: new Date().toISOString() };

  if (site_title !== undefined) update.site_title = site_title;
  if (site_subtitle !== undefined) update.site_subtitle = site_subtitle;

  if (dashboard_bg_from_card !== undefined) update.dashboard_bg_from_card = !!dashboard_bg_from_card;
  if (dashboard_show_voters !== undefined) update.dashboard_show_voters = !!dashboard_show_voters;
  if (dashboard_show_vote_toasts !== undefined) update.dashboard_show_vote_toasts = !!dashboard_show_vote_toasts;

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
  const { name, description, status, starts_at, ends_at, display_order, card_size } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
  if (card_size && !['pequeno', 'medio', 'grande'].includes(card_size)) {
    return res.status(400).json({ error: 'Tamanho de card inválido' });
  }

  const { data, error } = await supabase
    .from('categories')
    .insert({
      name,
      description: description || null,
      status: status || 'agendada',
      starts_at: starts_at || null,
      ends_at: ends_at || null,
      display_order: display_order || 0,
      card_size: card_size || 'medio',
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  scheduleDashboardUpdate();
  res.json(data);
});

app.put('/api/admin/categories/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { name, description, status, starts_at, ends_at, display_order, card_size, paused } = req.body;
  if (card_size !== undefined && !['pequeno', 'medio', 'grande'].includes(card_size)) {
    return res.status(400).json({ error: 'Tamanho de card inválido' });
  }
  const update = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (status !== undefined) update.status = status;
  if (starts_at !== undefined) update.starts_at = starts_at || null;
  if (ends_at !== undefined) update.ends_at = ends_at || null;
  if (display_order !== undefined) update.display_order = display_order;
  if (card_size !== undefined) update.card_size = card_size;
  if (paused !== undefined) update.paused = !!paused;

  const { data, error } = await supabase.from('categories').update(update).eq('id', id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  scheduleDashboardUpdate();
  res.json(data);
});

app.delete('/api/admin/categories/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  scheduleDashboardUpdate();
  res.json({ success: true });
});

// pausa ou retoma a votação de uma categoria (ninguém consegue votar
// enquanto pausada, mesmo com o horário agendado ainda dentro da janela)
// sem precisar mexer no status/agendamento da categoria
app.post('/api/admin/categories/:id/pause', authRequired, async (req, res) => {
  const { id } = req.params;
  const { paused } = req.body;
  const { data, error } = await supabase
    .from('categories')
    .update({ paused: !!paused })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  scheduleDashboardUpdate();
  res.json({ ...data, status: computeStatus(data) });
});

// apaga todos os votos de uma categoria (zera a contagem), sem apagar a
// categoria nem as opções cadastradas
app.post('/api/admin/categories/:id/reset-votes', authRequired, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('votes').delete().eq('category_id', id);
  if (error) return res.status(500).json({ error: error.message });
  scheduleDashboardUpdate();
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
    scheduleDashboardUpdate();
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
  scheduleDashboardUpdate();
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
  scheduleDashboardUpdate();
  res.json(data);
});

app.delete('/api/admin/options/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('options').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  scheduleDashboardUpdate();
  res.json({ success: true });
});

app.post('/api/admin/options/:id/image', authRequired, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });
  try {
    const url = await uploadImage(req.file, 'options');
    const { data, error } = await supabase.from('options').update({ image_url: url }).eq('id', req.params.id).select().single();
    if (error) throw error;
    scheduleDashboardUpdate();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// DASHBOARD AO VIVO
// =====================================================

// endpoint público (protegido por token próprio, não pelo login admin)
// pensado pra ser usado como fonte de navegador no OBS ou aberto direto
app.get('/api/dashboard/live', dashboardTokenRequired, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const payload = await getDashboardPayload();
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// define (ou limpa, com category_id vazio/nulo) qual categoria fica em foco
// no dashboard. Trocar de categoria sempre volta pro estado censurado.
// essa mesma categoria também vira a categoria ativa pro voto via chat da
// Twitch (!votar N) — o controle de categoria ativa vive só aqui, na página
// do dashboard, em vez de duplicado no painel admin.
app.post('/api/dashboard/focus', dashboardTokenRequired, async (req, res) => {
  const { category_id } = req.body;
  const { error } = await supabase
    .from('dashboard_config')
    .update({ focused_category_id: category_id || null, revealed: false, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) return res.status(500).json({ error: error.message });
  const { error: twitchErr } = await supabase
    .from('twitch_config')
    .update({ active_category_id: category_id || null, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (twitchErr) return res.status(500).json({ error: twitchErr.message });
  broadcastDashboard({ type: 'update' });
  res.json({ success: true });
});

app.post('/api/dashboard/reveal', dashboardTokenRequired, async (req, res) => {
  const { error } = await supabase
    .from('dashboard_config')
    .update({ revealed: true, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) return res.status(500).json({ error: error.message });
  broadcastDashboard({ type: 'update' });
  res.json({ success: true });
});

// re-censura a categoria em foco sem trocar de categoria (caso de engano)
app.post('/api/dashboard/hide', dashboardTokenRequired, async (req, res) => {
  const { error } = await supabase
    .from('dashboard_config')
    .update({ revealed: false, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) return res.status(500).json({ error: error.message });
  broadcastDashboard({ type: 'update' });
  res.json({ success: true });
});

// lista quem votou em cada opção de uma categoria — só funciona se o admin
// ligou "mostrar quem votou" nas configurações, e só libera os nomes depois
// que a categoria foi revelada (se ela for a categoria em foco no momento;
// no modo "mostrar todas" não existe censura, então libera direto)
app.get('/api/dashboard/voters/:categoryId', dashboardTokenRequired, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { categoryId } = req.params;

  const { data: settings } = await supabase.from('site_settings').select('dashboard_show_voters').eq('id', 1).single();
  if (!settings || !settings.dashboard_show_voters) {
    return res.status(403).json({ error: 'Esse recurso está desativado no painel admin.' });
  }

  const { data: cfg } = await supabase.from('dashboard_config').select('focused_category_id, revealed').eq('id', 1).single();
  const isFocusedHere = cfg && cfg.focused_category_id === categoryId;
  if (isFocusedHere && !cfg.revealed) {
    return res.status(403).json({ error: 'Os resultados dessa categoria ainda não foram revelados.' });
  }

  const { data: cat, error: catErr } = await supabase.from('categories').select('id, name').eq('id', categoryId).single();
  if (catErr || !cat) return res.status(404).json({ error: 'Categoria não encontrada' });

  const [optsRes, votesRes] = await Promise.all([
    supabase.from('options').select('id, name').eq('category_id', categoryId).order('display_order', { ascending: true }),
    supabase.from('votes').select('option_id, voter_name').eq('category_id', categoryId),
  ]);
  if (optsRes.error) return res.status(500).json({ error: optsRes.error.message });
  if (votesRes.error) return res.status(500).json({ error: votesRes.error.message });

  const votersByOption = {};
  (votesRes.data || []).forEach((v) => {
    if (!votersByOption[v.option_id]) votersByOption[v.option_id] = [];
    votersByOption[v.option_id].push(v.voter_name || null);
  });

  const options = (optsRes.data || [])
    .map((o) => {
      const voters = votersByOption[o.id] || [];
      const named = voters.filter((n) => n).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const anonymousCount = voters.length - named.length;
      return { id: o.id, name: o.name, votes: voters.length, voters: named, anonymous_count: anonymousCount };
    })
    .sort((a, b) => b.votes - a.votes);

  res.json({ category: { id: cat.id, name: cat.name }, options });
});

app.get('/api/admin/dashboard-token', authRequired, async (req, res) => {
  const { data, error } = await supabase.from('dashboard_config').select('token').eq('id', 1).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ token: data.token });
});

app.post('/api/admin/dashboard-token/regenerate', authRequired, async (req, res) => {
  const newToken = crypto.randomBytes(24).toString('hex');
  const { data, error } = await supabase
    .from('dashboard_config')
    .update({ token: newToken, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('token')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ token: data.token });
});

// =====================================================
// TWITCH: VOTAÇÃO PELO CHAT
// =====================================================

app.get('/api/admin/twitch-config', authRequired, async (req, res) => {
  const { data, error } = await supabase.from('twitch_config').select('*').eq('id', 1).single();
  if (error) return res.status(500).json({ error: error.message });
  const live = twitchBot.getStatus();
  res.json({
    bot_username: data.bot_username,
    channel_name: data.channel_name,
    active_category_id: data.active_category_id,
    reply_in_chat: data.reply_in_chat,
    enabled: data.enabled,
    has_token: !!data.oauth_token,
    live,
  });
});

app.put('/api/admin/twitch-config', authRequired, async (req, res) => {
  const { bot_username, oauth_token, channel_name, active_category_id, reply_in_chat } = req.body;
  const update = { updated_at: new Date().toISOString() };
  if (bot_username !== undefined) update.bot_username = bot_username;
  if (channel_name !== undefined) update.channel_name = channel_name;
  if (active_category_id !== undefined) update.active_category_id = active_category_id || null;
  if (reply_in_chat !== undefined) update.reply_in_chat = !!reply_in_chat;
  // só sobrescreve o token se um novo foi enviado (campo vazio = manter o atual)
  if (oauth_token) update.oauth_token = oauth_token;

  const { data, error } = await supabase.from('twitch_config').update(update).eq('id', 1).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({
    bot_username: data.bot_username,
    channel_name: data.channel_name,
    active_category_id: data.active_category_id,
    reply_in_chat: data.reply_in_chat,
    enabled: data.enabled,
    has_token: !!data.oauth_token,
  });
});

app.post('/api/admin/twitch-config/connect', authRequired, async (req, res) => {
  const { data: cfg, error } = await supabase.from('twitch_config').select('*').eq('id', 1).single();
  if (error) return res.status(500).json({ error: error.message });
  if (!cfg.bot_username || !cfg.oauth_token || !cfg.channel_name) {
    return res.status(400).json({ error: 'Preencha usuário do bot, token e canal antes de conectar' });
  }
  try {
    const status = await twitchBot.connect({
      username: cfg.bot_username,
      token: cfg.oauth_token,
      channel: cfg.channel_name,
      replyInChat: cfg.reply_in_chat,
    });
    await supabase.from('twitch_config').update({ enabled: true }).eq('id', 1);
    res.json({ success: true, live: status });
  } catch (err) {
    res.status(500).json({ error: `Não foi possível conectar: ${err.message}` });
  }
});

app.post('/api/admin/twitch-config/disconnect', authRequired, async (req, res) => {
  await twitchBot.disconnect();
  await supabase.from('twitch_config').update({ enabled: false }).eq('id', 1);
  res.json({ success: true });
});

app.get('/api/admin/twitch-config/status', authRequired, (req, res) => {
  res.json(twitchBot.getStatus());
});

// processa comandos de voto vindos do chat da Twitch
twitchBot.setVoteHandler(async ({ optionIndex, twitchUserId, displayName }) => {
  const { data: cfg } = await supabase.from('twitch_config').select('active_category_id').eq('id', 1).single();
  if (!cfg || !cfg.active_category_id) return { message: 'nenhuma votação está ativa pro chat agora.' };

  const { data: cat } = await supabase.from('categories').select('*').eq('id', cfg.active_category_id).single();
  if (!cat || computeStatus(cat) !== 'aberta') return { message: 'a votação não está aberta no momento.' };

  const { data: options } = await supabase
    .from('options')
    .select('id, name')
    .eq('category_id', cfg.active_category_id)
    .order('display_order', { ascending: true });
  if (!options || !options.length) return { message: 'essa categoria ainda não tem opções.' };
  if (optionIndex < 1 || optionIndex > options.length) {
    return { message: `opção inválida, escolha de 1 a ${options.length}.` };
  }

  const option = options[optionIndex - 1];
  const voterHash = crypto
    .createHash('sha256')
    .update(`twitch:${twitchUserId}:${cfg.active_category_id}:${process.env.JWT_SECRET}`)
    .digest('hex');

  const { error: insertErr } = await supabase.from('votes').insert({
    category_id: cfg.active_category_id,
    option_id: option.id,
    voter_hash: voterHash,
    voter_ip: 'twitch-chat',
    voter_name: displayName || null,
  });

  if (insertErr) {
    if (insertErr.code === '23505') return { message: 'você já votou nessa categoria!' };
    return { message: 'erro ao registrar seu voto, tenta de novo.' };
  }

  scheduleDashboardUpdate();
  maybeBroadcastVoteToast({ categoryName: cat.name, optionName: option.name, voterName: displayName });
  return { message: `voto em "${option.name}" registrado! 🎉` };
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

async function attemptTwitchAutoConnect() {
  try {
    const { data: cfg } = await supabase.from('twitch_config').select('*').eq('id', 1).single();
    if (cfg && cfg.enabled && cfg.bot_username && cfg.oauth_token && cfg.channel_name) {
      await twitchBot.connect({
        username: cfg.bot_username,
        token: cfg.oauth_token,
        channel: cfg.channel_name,
        replyInChat: cfg.reply_in_chat,
      });
      console.log(`Bot da Twitch reconectado automaticamente ao canal ${cfg.channel_name}`);
    }
  } catch (err) {
    console.error('Falha ao reconectar bot da Twitch automaticamente:', err.message);
  }
}

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  attemptTwitchAutoConnect();
});
