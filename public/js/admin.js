(() => {
  const API = '/api';
  let token = localStorage.getItem('admin_token') || null;
  let categoriesCache = [];
  let openCatId = null;

  const $ = (id) => document.getElementById(id);

  const els = {
    authScreen: $('auth-screen'),
    dashboard: $('dashboard'),
    loginForm: $('login-form'),
    loginMsg: $('login-msg'),
    setupCard: $('setup-card'),
    setupForm: $('setup-form'),
    setupMsg: $('setup-msg'),
    showSetup: $('show-setup'),
    showLogin: $('show-login'),
    adminUsername: $('admin-username'),
    logoutBtn: $('logout-btn'),
    toast: $('admin-toast'),
    catList: $('categories-admin-list'),
    newCatBtn: $('new-category-btn'),
    modal: $('category-modal'),
    modalTitle: $('category-modal-title'),
    modalClose: $('category-modal-close'),
    catForm: $('category-form'),
    catFormMsg: $('category-form-msg'),
    settingsForm: $('settings-form'),
    bgUpload: $('bg-upload'),
    bgPreview: $('bg-preview'),
    bgStatus: $('bg-status'),
  };

  function showToast(msg, isErr = false) {
    els.toast.textContent = msg;
    els.toast.classList.toggle('err', isErr);
    els.toast.classList.add('show');
    setTimeout(() => els.toast.classList.remove('show'), 3200);
  }

  async function api(path, opts = {}) {
    const headers = opts.headers || {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (!(opts.body instanceof FormData) && opts.body) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API}${path}`, { ...opts, headers });
    let data = null;
    try { data = await res.json(); } catch { /* sem corpo */ }
    if (res.status === 401) {
      logout();
      throw new Error('Sessão expirada, faça login novamente');
    }
    if (!res.ok) throw new Error((data && data.error) || 'Erro na requisição');
    return data;
  }

  function escapeHtml(str) {
    const p = document.createElement('p');
    p.textContent = str || '';
    return p.innerHTML;
  }

  // ===== AUTH =====
  function logout() {
    token = null;
    localStorage.removeItem('admin_token');
    els.dashboard.style.display = 'none';
    els.authScreen.style.display = 'flex';
  }

  async function checkSession() {
    if (!token) return;
    try {
      const me = await api('/admin/me');
      els.adminUsername.textContent = me.username;
      els.authScreen.style.display = 'none';
      els.dashboard.style.display = 'grid';
      loadCategoriesAdmin();
      loadSettingsAdmin();
    } catch {
      logout();
    }
  }

  els.showSetup.addEventListener('click', () => {
    els.loginForm.closest('.auth-card').style.display = 'none';
    els.setupCard.style.display = 'block';
  });
  els.showLogin.addEventListener('click', () => {
    els.setupCard.style.display = 'none';
    els.loginForm.closest('.auth-card').style.display = 'block';
  });

  els.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    els.loginMsg.textContent = '';
    els.loginMsg.classList.remove('ok');
    const btn = $('login-btn');
    btn.disabled = true;
    try {
      const data = await api('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: $('login-username').value.trim(), password: $('login-password').value }),
      });
      token = data.token;
      localStorage.setItem('admin_token', token);
      els.loginMsg.textContent = 'Entrando…';
      els.loginMsg.classList.add('ok');
      await checkSession();
    } catch (err) {
      els.loginMsg.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  els.setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    els.setupMsg.textContent = '';
    els.setupMsg.classList.remove('ok');
    const btn = $('setup-btn');
    btn.disabled = true;
    try {
      await api('/admin/setup', {
        method: 'POST',
        body: JSON.stringify({
          setup_key: $('setup-key').value,
          username: $('setup-username').value.trim(),
          password: $('setup-password').value,
        }),
      });
      els.setupMsg.textContent = 'Admin criado! Faça login.';
      els.setupMsg.classList.add('ok');
      setTimeout(() => els.showLogin.click(), 1200);
    } catch (err) {
      els.setupMsg.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  els.logoutBtn.addEventListener('click', logout);

  // ===== TABS =====
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
      $(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // ===== CONFIGURAÇÕES =====
  let currentSettings = {};

  async function loadSettingsAdmin() {
    try {
      const s = await api('/settings');
      currentSettings = s;
      $('settings-title').value = s.site_title || '';
      $('settings-subtitle').value = s.site_subtitle || '';

      // fundo: imagem ou cor
      const mode = s.background_mode === 'color' ? 'color' : 'image';
      setBgMode(mode, { silent: true });
      if (s.background_image_url) {
        els.bgPreview.style.backgroundImage = `url('${s.background_image_url}')`;
        els.bgPreview.textContent = '';
      } else {
        els.bgPreview.textContent = 'Nenhuma imagem definida ainda';
      }
      const bgColor = s.background_color || '#16110d';
      $('bg-color-input').value = bgColor;
      $('bg-color-hex').value = bgColor.toUpperCase();

      // tema de cores
      if (window.applyVotacaoTheme) window.applyVotacaoTheme(s.theme, s.custom_colors);
      renderThemeSwatches(s.theme || 'premiere');
      renderCustomColorFields(s.custom_colors || {});
      $('custom-colors-panel').style.display = s.theme === 'custom' ? 'block' : 'none';

      // tipografia
      if (window.applyVotacaoFont) window.applyVotacaoFont(s.font_pair);
      renderFontSwatches(s.font_pair || 'classic');
    } catch (err) {
      showToast(err.message, true);
    }
  }

  // ===== FUNDO: IMAGEM OU COR =====
  function setBgMode(mode, { silent = false } = {}) {
    document.querySelectorAll('#bg-mode-toggle .mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    $('bg-image-panel').style.display = mode === 'image' ? 'block' : 'none';
    $('bg-color-panel').style.display = mode === 'color' ? 'block' : 'none';
    if (!silent) saveBgMode(mode);
  }

  async function saveBgMode(mode) {
    try {
      await api('/admin/settings', { method: 'PUT', body: JSON.stringify({ background_mode: mode }) });
      showToast(mode === 'image' ? 'Usando imagem de fundo' : 'Usando cor sólida de fundo');
    } catch (err) {
      showToast(err.message, true);
    }
  }

  document.querySelectorAll('#bg-mode-toggle .mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => setBgMode(btn.dataset.mode));
  });

  $('bg-color-input').addEventListener('input', (e) => {
    $('bg-color-hex').value = e.target.value.toUpperCase();
  });
  $('bg-color-hex').addEventListener('input', (e) => {
    let v = e.target.value.trim();
    if (v && !v.startsWith('#')) v = `#${v}`;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) $('bg-color-input').value = v;
  });
  $('bg-color-save').addEventListener('click', async () => {
    const hex = $('bg-color-input').value;
    try {
      await api('/admin/settings', { method: 'PUT', body: JSON.stringify({ background_color: hex, background_mode: 'color' }) });
      showToast('Cor de fundo aplicada!');
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // ===== TEMA DE CORES =====
  function renderThemeSwatches(activeKey) {
    const container = $('theme-swatches');
    if (!container || !window.VOTACAO_THEMES) return;
    container.innerHTML = '';
    Object.entries(window.VOTACAO_THEMES).forEach(([key, t]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `theme-swatch ${key === activeKey ? 'active' : ''}`;
      btn.dataset.theme = key;
      btn.innerHTML = `
        <span class="theme-swatch-dots">
          <span style="background:${t.swatch[0]}"></span>
          <span style="background:${t.swatch[1]}"></span>
        </span>
        <span class="theme-swatch-label">${t.label}</span>
      `;
      btn.addEventListener('click', () => selectTheme(key));
      container.appendChild(btn);
    });

    const customBtn = document.createElement('button');
    customBtn.type = 'button';
    customBtn.className = `theme-swatch ${activeKey === 'custom' ? 'active' : ''}`;
    customBtn.dataset.theme = 'custom';
    customBtn.innerHTML = `
      <span class="theme-swatch-dots">
        <span style="background:conic-gradient(from 0deg, #cba135, #ff4f9a, #34c78a, #3fa9e8, #a875e8, #cba135)"></span>
      </span>
      <span class="theme-swatch-label">Personalizado</span>
    `;
    customBtn.addEventListener('click', () => selectTheme('custom'));
    container.appendChild(customBtn);
  }

  async function selectTheme(key) {
    renderThemeSwatches(key);
    $('custom-colors-panel').style.display = key === 'custom' ? 'block' : 'none';

    if (key === 'custom') {
      // aplica as cores personalizadas já salvas (ou os defaults atuais) sem precisar salvar de novo
      if (window.applyVotacaoTheme) window.applyVotacaoTheme('custom', currentSettings.custom_colors || {});
    } else if (window.applyVotacaoTheme) {
      window.applyVotacaoTheme(key);
    }

    try {
      await api('/admin/settings', { method: 'PUT', body: JSON.stringify({ theme: key }) });
      currentSettings.theme = key;
      showToast(key === 'custom' ? 'Modo personalizado ativado' : 'Tema aplicado!');
    } catch (err) {
      showToast(err.message, true);
    }
  }

  // ===== CORES PERSONALIZADAS =====
  const COLOR_FIELD_LABELS = {
    gold: 'Destaque principal',
    goldSoft: 'Destaque claro',
    crimson: 'Cor secundária',
    crimsonSoft: 'Secundária clara',
    void: 'Fundo da página',
    card: 'Fundo dos cartões',
    cream: 'Cor do texto',
  };
  const COLOR_FIELD_DEFAULTS = {
    gold: '#cba135', goldSoft: '#e4c874', crimson: '#7a1f2b', crimsonSoft: '#9c3040',
    void: '#16110d', card: '#211a14', cream: '#f3e9d7',
  };

  function renderCustomColorFields(customColors) {
    const grid = $('custom-colors-grid');
    if (!grid || !window.VOTACAO_COLOR_KEYS) return;
    grid.innerHTML = '';
    window.VOTACAO_COLOR_KEYS.forEach((key) => {
      const value = customColors[key] || COLOR_FIELD_DEFAULTS[key];
      const field = document.createElement('label');
      field.className = 'custom-color-field';
      field.innerHTML = `
        <input type="color" data-color-key="${key}" value="${value}" />
        <span>${COLOR_FIELD_LABELS[key]}</span>
      `;
      grid.appendChild(field);
    });

    grid.querySelectorAll('input[type="color"]').forEach((input) => {
      input.addEventListener('input', () => {
        const colors = collectCustomColors();
        if (window.applyVotacaoTheme) window.applyVotacaoTheme('custom', colors);
      });
    });
  }

  function collectCustomColors() {
    const colors = {};
    document.querySelectorAll('#custom-colors-grid input[type="color"]').forEach((input) => {
      colors[input.dataset.colorKey] = input.value;
    });
    return colors;
  }

  $('custom-colors-save').addEventListener('click', async () => {
    const colors = collectCustomColors();
    try {
      await api('/admin/settings', { method: 'PUT', body: JSON.stringify({ theme: 'custom', custom_colors: colors }) });
      currentSettings.theme = 'custom';
      currentSettings.custom_colors = colors;
      renderThemeSwatches('custom');
      showToast('Cores personalizadas salvas!');
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // ===== TIPOGRAFIA =====
  function renderFontSwatches(activeKey) {
    const container = $('font-swatches');
    if (!container || !window.VOTACAO_FONTS) return;
    container.innerHTML = '';
    Object.entries(window.VOTACAO_FONTS).forEach(([key, f]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `font-swatch ${key === activeKey ? 'active' : ''}`;
      btn.innerHTML = `
        <div class="font-swatch-preview" style="font-family:${f.display};font-style:${f.italic ? 'italic' : 'normal'}">Aa</div>
        <div class="font-swatch-label">${f.label}</div>
      `;
      btn.addEventListener('click', () => selectFont(key));
      container.appendChild(btn);
    });
  }

  async function selectFont(key) {
    if (window.applyVotacaoFont) window.applyVotacaoFont(key);
    renderFontSwatches(key);
    try {
      await api('/admin/settings', { method: 'PUT', body: JSON.stringify({ font_pair: key }) });
      currentSettings.font_pair = key;
      showToast('Fonte aplicada!');
    } catch (err) {
      showToast(err.message, true);
    }
  }

  els.settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ site_title: $('settings-title').value, site_subtitle: $('settings-subtitle').value }),
      });
      showToast('Textos salvos!');
    } catch (err) {
      showToast(err.message, true);
    }
  });

  els.bgUpload.addEventListener('change', async () => {
    const file = els.bgUpload.files[0];
    if (!file) return;
    els.bgStatus.textContent = 'Enviando imagem…';
    try {
      const fd = new FormData();
      fd.append('image', file);
      const data = await api('/admin/settings/background', { method: 'POST', body: fd });
      els.bgPreview.style.backgroundImage = `url('${data.background_image_url}')`;
      els.bgPreview.textContent = '';
      els.bgStatus.textContent = 'Imagem de fundo atualizada ✓';
      showToast('Imagem de fundo atualizada!');
    } catch (err) {
      console.error('Falha ao enviar imagem de fundo:', err);
      els.bgStatus.textContent = '';
      showToast(err.message, true);
    } finally {
      els.bgUpload.value = '';
    }
  });

  // ===== CATEGORIAS: LISTAGEM =====
  async function loadCategoriesAdmin({ silent = false } = {}) {
    if (!silent) els.catList.innerHTML = `<div class="loading-state"><div class="spinner"></div>Carregando…</div>`;
    try {
      categoriesCache = await api('/admin/categories');
      renderCategoriesAdmin();
      // reabre o painel que estava expandido antes do refresh, se ainda existir
      if (openCatId && categoriesCache.some((c) => c.id === openCatId)) {
        const body = $(`cat-body-${openCatId}`);
        if (body) {
          body.classList.add('open');
          await renderCategoryBody(openCatId, body);
        }
      }
    } catch (err) {
      els.catList.innerHTML = `<div class="empty-state"><h3>Erro ao carregar</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function renderCategoriesAdmin() {
    if (!categoriesCache.length) {
      els.catList.innerHTML = `<div class="empty-state"><h3>Nenhuma categoria ainda</h3><p>Clique em "Nova categoria" para começar.</p></div>`;
      return;
    }
    els.catList.innerHTML = '';
    categoriesCache.forEach((cat) => {
      const card = document.createElement('div');
      card.className = 'admin-cat-card';
      const thumb = cat.image_url ? `style="background-image:url('${cat.image_url}')"` : '';
      card.innerHTML = `
        <div class="admin-cat-head" data-toggle="${cat.id}">
          <div class="admin-cat-thumb" ${thumb}></div>
          <div class="admin-cat-title">
            <strong>${escapeHtml(cat.name)}</strong>
            <span>${cat.options_count} opç${cat.options_count === 1 ? 'ão' : 'ões'}</span>
          </div>
          <span class="badge ${cat.status}">${cat.status}</span>
          <div class="admin-cat-actions">
            <button class="icon-btn" data-edit="${cat.id}">editar</button>
            <button class="icon-btn danger" data-delete="${cat.id}">excluir</button>
          </div>
        </div>
        <div class="admin-cat-body" id="cat-body-${cat.id}"></div>
      `;
      els.catList.appendChild(card);
    });

    els.catList.querySelectorAll('[data-toggle]').forEach((head) => {
      head.addEventListener('click', (e) => {
        if (e.target.closest('.admin-cat-actions')) return;
        toggleCategoryBody(head.dataset.toggle);
      });
    });
    els.catList.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openCategoryModal(btn.dataset.edit));
    });
    els.catList.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteCategory(btn.dataset.delete));
    });
  }

  async function toggleCategoryBody(id) {
    const body = $(`cat-body-${id}`);
    const isOpen = body.classList.contains('open');
    document.querySelectorAll('.admin-cat-body.open').forEach((b) => b.classList.remove('open'));
    if (isOpen) { openCatId = null; return; }
    body.classList.add('open');
    openCatId = id;
    body.innerHTML = `<div class="loading-state"><div class="spinner"></div>Carregando opções…</div>`;
    await renderCategoryBody(id, body);
  }

  async function renderCategoryBody(id, body) {
    const cat = categoriesCache.find((c) => c.id === id);
    try {
      const detail = await api(`/admin/categories/${id}/results`).catch(() => null);
      const options = await fetch(`${API}/categories/${id}`).then((r) => r.json()).then((d) => d.options || []);

      const optionsHtml = options.map((o) => {
        const thumb = o.image_url ? `style="background-image:url('${o.image_url}')"` : '';
        return `
          <div class="option-admin-row" data-option="${o.id}">
            <div class="admin-cat-thumb" ${thumb}></div>
            <input type="text" value="${escapeHtml(o.name)}" data-option-name="${o.id}" />
            <label class="upload-label">
              <input type="file" accept="image/*" hidden data-option-image="${o.id}" />
              <span class="icon-btn">imagem</span>
            </label>
            <button class="icon-btn danger" data-option-delete="${o.id}">✕</button>
          </div>
        `;
      }).join('');

      let resultsHtml = '';
      if (detail && detail.total_votes >= 0) {
        resultsHtml = `
          <div class="results-mini">
            <h4>Apuração em tempo real · ${detail.total_votes} voto${detail.total_votes === 1 ? '' : 's'}</h4>
            ${detail.results.map((r) => `
              <div class="result-row" style="margin-bottom:0.6rem">
                <div class="result-top"><span class="result-name">${escapeHtml(r.name)}</span><span class="result-pct">${r.percent}%</span></div>
                <div class="result-bar-track"><div class="result-bar-fill" style="width:${r.percent}%"></div></div>
                <div class="result-votes">${r.votes} voto${r.votes === 1 ? '' : 's'}</div>
              </div>
            `).join('')}
          </div>
        `;
      }

      body.innerHTML = `
        <div class="cat-image-row">
          <div class="admin-cat-thumb" ${cat.image_url ? `style="background-image:url('${cat.image_url}')"` : ''}></div>
          <label class="upload-label">
            <input type="file" accept="image/*" hidden id="cat-image-${id}" />
            <span class="btn btn-ghost">Trocar imagem da categoria</span>
          </label>
        </div>
        <div class="options-admin-list">${optionsHtml || '<p class="ticket-desc">Nenhuma opção ainda.</p>'}</div>
        <div class="add-option-row">
          <input type="text" placeholder="Nome da nova opção" id="new-option-name-${id}" />
          <button class="btn btn-ghost" id="add-option-btn-${id}">+ adicionar</button>
        </div>
        ${resultsHtml}
      `;

      $(`cat-image-${id}`).addEventListener('change', (e) => uploadCategoryImage(id, e.target.files[0], e.target));

      body.querySelectorAll('[data-option-name]').forEach((input) => {
        input.addEventListener('blur', () => updateOptionName(input.dataset.optionName, input.value));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
      });
      body.querySelectorAll('[data-option-image]').forEach((input) => {
        input.addEventListener('change', (e) => uploadOptionImage(input.dataset.optionImage, e.target.files[0], e.target));
      });
      body.querySelectorAll('[data-option-delete]').forEach((btn) => {
        btn.addEventListener('click', () => deleteOption(btn.dataset.optionDelete));
      });
      $(`add-option-btn-${id}`).addEventListener('click', () => addOption(id));
      $(`new-option-name-${id}`).addEventListener('keydown', (e) => { if (e.key === 'Enter') addOption(id); });
    } catch (err) {
      body.innerHTML = `<p class="ticket-desc">${escapeHtml(err.message)}</p>`;
    }
  }

  async function refreshOpenBody() {
    if (!openCatId) return;
    const body = $(`cat-body-${openCatId}`);
    if (body) await renderCategoryBody(openCatId, body);
  }

  // ===== CATEGORIAS: CRUD =====
  els.newCatBtn.addEventListener('click', () => openCategoryModal(null));

  function openCategoryModal(id) {
    els.catFormMsg.textContent = '';
    if (id) {
      const cat = categoriesCache.find((c) => c.id === id);
      els.modalTitle.textContent = 'Editar categoria';
      $('category-id').value = cat.id;
      $('category-name').value = cat.name;
      $('category-description').value = cat.description || '';
      $('category-status').value = cat.status;
      $('category-order').value = cat.display_order || 0;
      $('category-starts').value = toLocalInput(cat.starts_at);
      $('category-ends').value = toLocalInput(cat.ends_at);
    } else {
      els.modalTitle.textContent = 'Nova categoria';
      els.catForm.reset();
      $('category-id').value = '';
      $('category-order').value = 0;
    }
    els.modal.classList.add('open');
  }

  function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  els.modalClose.addEventListener('click', () => els.modal.classList.remove('open'));
  els.modal.addEventListener('click', (e) => { if (e.target === els.modal) els.modal.classList.remove('open'); });

  els.catForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('category-id').value;
    const payload = {
      name: $('category-name').value.trim(),
      description: $('category-description').value.trim(),
      status: $('category-status').value,
      display_order: Number($('category-order').value) || 0,
      starts_at: $('category-starts').value ? new Date($('category-starts').value).toISOString() : null,
      ends_at: $('category-ends').value ? new Date($('category-ends').value).toISOString() : null,
    };
    const btn = $('category-save-btn');
    btn.disabled = true;
    try {
      if (id) {
        await api(`/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/admin/categories', { method: 'POST', body: JSON.stringify(payload) });
      }
      els.modal.classList.remove('open');
      showToast('Categoria salva!');
      await loadCategoriesAdmin();
    } catch (err) {
      els.catFormMsg.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  async function deleteCategory(id) {
    if (!confirm('Excluir esta categoria e todas as suas opções e votos? Essa ação não pode ser desfeita.')) return;
    try {
      await api(`/admin/categories/${id}`, { method: 'DELETE' });
      showToast('Categoria excluída');
      await loadCategoriesAdmin();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  async function uploadCategoryImage(id, file, inputEl) {
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('image', file);
      await api(`/admin/categories/${id}/image`, { method: 'POST', body: fd });
      showToast('Imagem da categoria atualizada!');
      await loadCategoriesAdmin({ silent: true });
    } catch (err) {
      console.error('Falha ao enviar imagem da categoria:', err);
      showToast(err.message, true);
    } finally {
      if (inputEl) inputEl.value = '';
    }
  }

  // ===== OPÇÕES: CRUD =====
  async function addOption(categoryId) {
    const input = $(`new-option-name-${categoryId}`);
    const name = input.value.trim();
    if (!name) return;
    input.disabled = true;
    try {
      await api('/admin/options', { method: 'POST', body: JSON.stringify({ category_id: categoryId, name }) });
      showToast('Opção adicionada!');
      openCatId = categoryId;
      await loadCategoriesAdmin({ silent: true });
      // devolve o foco pro campo de nova opção pra permitir adicionar várias seguidas
      const freshInput = $(`new-option-name-${categoryId}`);
      if (freshInput) freshInput.focus();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      input.disabled = false;
    }
  }

  async function updateOptionName(id, name) {
    if (!name.trim()) return;
    try {
      await api(`/admin/options/${id}`, { method: 'PUT', body: JSON.stringify({ name: name.trim() }) });
    } catch (err) {
      showToast(err.message, true);
    }
  }

  async function uploadOptionImage(id, file, inputEl) {
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('image', file);
      await api(`/admin/options/${id}/image`, { method: 'POST', body: fd });
      showToast('Imagem da opção atualizada!');
      await refreshOpenBody();
    } catch (err) {
      console.error('Falha ao enviar imagem da opção:', err);
      showToast(err.message, true);
    } finally {
      if (inputEl) inputEl.value = '';
    }
  }

  async function deleteOption(id) {
    if (!confirm('Excluir esta opção e todos os votos associados?')) return;
    try {
      await api(`/admin/options/${id}`, { method: 'DELETE' });
      showToast('Opção excluída');
      await loadCategoriesAdmin({ silent: true });
    } catch (err) {
      showToast(err.message, true);
    }
  }

  checkSession();
  if (!token) els.authScreen.style.display = 'flex';
})();
