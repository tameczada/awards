(() => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  // aplica o mesmo tema/cores/fonte definidos no admin (Configurações → Aparência)
  // — /api/settings é público, não depende do token do dashboard
  async function loadSettings() {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      const s = await res.json();
      if (window.applyVotacaoTheme) window.applyVotacaoTheme(s.theme, s.custom_colors);
      if (window.applyVotacaoFont) window.applyVotacaoFont(s.font_pair);
    } catch (e) { /* segue com o tema padrão */ }
  }
  loadSettings();

  const els = {
    gate: document.getElementById('token-gate'),
    root: document.getElementById('dashboard-root'),
    grid: document.getElementById('dash-grid'),
    connStatus: document.getElementById('dash-conn-status'),
    updatedAt: document.getElementById('dash-updated-at'),
    focusSelect: document.getElementById('dash-focus-select'),
    revealBtn: document.getElementById('dash-reveal-btn'),
    hideBtn: document.getElementById('dash-hide-btn'),
    voteNumbers: document.getElementById('dash-vote-numbers'),
  };

  if (!token) {
    els.gate.style.display = 'flex';
    return;
  }
  els.gate.style.display = 'none';
  els.root.style.display = 'block';

  const STATUS_LABEL = { aberta: 'Aberta agora', encerrada: 'Encerrada', agendada: 'Em breve', pausada: 'Pausada' };
  let lastRevealed = false; // pra disparar a animação só na transição censurado -> revelado

  function escapeHtml(str) {
    const p = document.createElement('p');
    p.textContent = str || '';
    return p.innerHTML;
  }

  function setConnStatus(state) {
    if (state === 'ok') {
      els.connStatus.textContent = '● conectado';
      els.connStatus.className = 'conn-status ok';
    } else if (state === 'connecting') {
      els.connStatus.textContent = 'conectando…';
      els.connStatus.className = 'conn-status';
    } else {
      els.connStatus.textContent = '● desconectado — tentando reconectar';
      els.connStatus.className = 'conn-status err';
    }
  }

  async function postAction(path, body) {
    try {
      const res = await fetch(`${path}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      if (!res.ok) throw new Error();
      fetchSnapshot();
    } catch (e) {
      /* falha silenciosa — o próximo fetch periódico corrige o estado exibido */
    }
  }

  els.focusSelect.addEventListener('change', () => {
    postAction('/api/dashboard/focus', { category_id: els.focusSelect.value || null });
  });
  els.revealBtn.addEventListener('click', () => postAction('/api/dashboard/reveal'));
  els.hideBtn.addEventListener('click', () => postAction('/api/dashboard/hide'));

  function updateFocusControls(data) {
    // só reconstrói as options do select se a lista de categorias mudou,
    // pra não perder o foco do usuário no dropdown a cada refresh
    const wanted = ['<option value="">Mostrar todas as categorias</option>']
      .concat((data.category_options || []).map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`))
      .join('');
    if (els.focusSelect.dataset.rendered !== wanted) {
      els.focusSelect.innerHTML = wanted;
      els.focusSelect.dataset.rendered = wanted;
    }
    els.focusSelect.value = data.focused_category_id || '';

    const hasFocus = !!data.focused_category_id;
    els.revealBtn.style.display = hasFocus && !data.revealed ? 'inline-flex' : 'none';
    els.hideBtn.style.display = hasFocus && data.revealed ? 'inline-block' : 'none';

    // a categoria escolhida acima também é a categoria ativa pro voto via
    // chat da Twitch (!votar N) — mostra a numeração das opções aqui
    const catInfo = (data.category_options || []).find((c) => c.id === data.focused_category_id);
    renderVoteNumbers(data.focused_category_id, catInfo ? catInfo.status : null);
  }

  let lastVoteNumbersCatId; // evita rebuscar as opções a cada refresh periódico
  async function renderVoteNumbers(categoryId, status) {
    if (!categoryId) {
      els.voteNumbers.innerHTML = '';
      lastVoteNumbersCatId = null;
      return;
    }
    if (status !== 'aberta') {
      els.voteNumbers.innerHTML = '<span class="num-hint">Voto pelo chat indisponível — categoria não está "Aberta".</span>';
      lastVoteNumbersCatId = null;
      return;
    }
    if (lastVoteNumbersCatId === categoryId) return;
    lastVoteNumbersCatId = categoryId;
    try {
      const cat = await fetch(`/api/categories/${categoryId}`).then((r) => r.json());
      const options = cat.options || [];
      if (!options.length) {
        els.voteNumbers.innerHTML = '<span class="num-hint">Essa categoria ainda não tem opções.</span>';
        return;
      }
      els.voteNumbers.innerHTML = '<span class="num-hint">Vote no chat:</span>'
        + options.map((o, i) => `<span class="num-row"><strong>!votar ${i + 1}</strong> ${escapeHtml(o.name)}</span>`).join('');
    } catch {
      els.voteNumbers.innerHTML = '';
    }
  }

  function renderOption(o, index, isFocusedMode, revealed, maxVotes) {
    if (isFocusedMode && !revealed) {
      return `
        <div class="dash-option censored">
          <div class="dash-option-top">
            <span class="dash-option-name">${escapeHtml(o.name)}</span>
            <span class="censor-lock">🔒 em segredo</span>
          </div>
          <div class="dash-bar-track"><div class="dash-bar-fill" style="width:0%"></div></div>
        </div>
      `;
    }
    // nos modos "mostrar todas" e "revelado", o servidor já manda as opções
    // ordenadas por votos (maior primeiro), então índice 0 é sempre o líder
    const isLeader = index === 0 && o.votes > 0;
    const width = maxVotes ? Math.max((o.votes / maxVotes) * 100, o.votes > 0 ? 4 : 0) : 0;
    return `
      <div class="dash-option ${isLeader ? 'leader' : ''}">
        <div class="dash-option-top">
          <span class="dash-option-name">${isLeader ? '👑 ' : ''}${escapeHtml(o.name)}</span>
          <span class="dash-option-pct">${o.votes} · ${o.percent}%</span>
        </div>
        <div class="dash-bar-track"><div class="dash-bar-fill" style="width:${width}%"></div></div>
      </div>
    `;
  }

  function renderCard(cat, isFocusedMode, revealed, justRevealed) {
    const hasBg = !!cat.image_url;
    const bgStyle = hasBg ? ` style="background-image:url('${cat.image_url}')"` : '';
    const sizeClass = `size-${cat.card_size === 'pequeno' || cat.card_size === 'grande' ? cat.card_size : 'medio'}`;
    const censored = isFocusedMode && !revealed;
    const maxVotes = cat.options.length && !censored ? cat.options[0].votes : 0;

    let optionsHtml;
    if (cat.options.length) {
      optionsHtml = cat.options.map((o, i) => renderOption(o, i, isFocusedMode, revealed, maxVotes)).join('');
    } else {
      optionsHtml = '<p class="dash-empty-options">Nenhuma opção cadastrada ainda.</p>';
    }

    const totalLabel = censored
      ? `${cat.total_votes} voto${cat.total_votes === 1 ? '' : 's'} até agora`
      : `${STATUS_LABEL[cat.status] || cat.status} · ${cat.total_votes} voto${cat.total_votes === 1 ? '' : 's'}`;

    return `
      <article class="dash-card ${sizeClass} ${hasBg ? 'has-bg' : ''} ${justRevealed ? 'revealing' : ''}"${bgStyle}>
        <div class="dash-card-head">
          <div class="dash-card-title">
            <h2>${escapeHtml(cat.name)}</h2>
            <span>${totalLabel}</span>
          </div>
        </div>
        <div class="dash-options">${optionsHtml}</div>
      </article>
    `;
  }

  async function fetchSnapshot() {
    try {
      const res = await fetch(`/api/dashboard/live?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      if (res.status === 401) {
        els.grid.innerHTML = `<div class="empty-state"><h3>Token inválido</h3><p>Gere um novo link no painel admin.</p></div>`;
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        console.error('Falha ao carregar dashboard:', data.error);
        els.grid.innerHTML = `<div class="empty-state"><h3>Erro ao carregar categorias</h3><p>${escapeHtml(data.error || 'Tente recarregar a página.')}</p></div>`;
        return;
      }
      updateFocusControls(data);

      const cats = data.categories || [];
      const isFocusedMode = !!data.focused_category_id;
      const justRevealed = isFocusedMode && data.revealed && !lastRevealed;
      lastRevealed = isFocusedMode ? data.revealed : false;

      els.grid.classList.toggle('focused', isFocusedMode);

      if (!cats.length) {
        els.grid.innerHTML = `<div class="empty-state"><h3>Nenhuma categoria ainda</h3></div>`;
      } else {
        els.grid.innerHTML = cats.map((c) => renderCard(c, isFocusedMode, data.revealed, justRevealed)).join('');
      }
      els.updatedAt.textContent = `atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
    } catch (e) {
      console.error('Erro de rede ao buscar snapshot do dashboard:', e);
      /* mantém o último snapshot visível em caso de falha pontual de rede */
    }
  }

  // ===== WEBSOCKET COM RECONEXÃO AUTOMÁTICA =====
  let ws = null;
  let reconnectDelay = 1000;

  function connectWs() {
    setConnStatus('connecting');
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}/ws?token=${encodeURIComponent(token)}`);

    ws.addEventListener('open', () => {
      setConnStatus('ok');
      reconnectDelay = 1000;
      fetchSnapshot();
    });

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'update') fetchSnapshot();
      } catch (e) { /* ignora mensagens malformadas */ }
    });

    ws.addEventListener('close', () => {
      setConnStatus('err');
      setTimeout(connectWs, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.6, 15000);
    });

    ws.addEventListener('error', () => {
      ws.close();
    });
  }

  fetchSnapshot();
  connectWs();

  // fallback: além do WS, revalida por polling a cada 20s (rede instável, OBS etc)
  setInterval(fetchSnapshot, 20000);
})();
