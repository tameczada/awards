(() => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  const els = {
    gate: document.getElementById('token-gate'),
    root: document.getElementById('dashboard-root'),
    grid: document.getElementById('dash-grid'),
    connStatus: document.getElementById('dash-conn-status'),
    updatedAt: document.getElementById('dash-updated-at'),
  };

  if (!token) {
    els.gate.style.display = 'flex';
    return;
  }
  els.gate.style.display = 'none';
  els.root.style.display = 'block';

  const STATUS_LABEL = { aberta: 'Aberta agora', encerrada: 'Encerrada', agendada: 'Em breve' };

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

  function renderCard(cat) {
    const thumb = cat.image_url ? `style="background-image:url('${cat.image_url}')"` : '';
    const maxVotes = cat.options.length ? cat.options[0].votes : 0;

    const optionsHtml = cat.options.length
      ? cat.options
          .map((o, i) => {
            const isLeader = i === 0 && o.votes > 0;
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
          })
          .join('')
      : '<p class="dash-empty-options">Nenhuma opção cadastrada ainda.</p>';

    return `
      <article class="dash-card">
        <div class="dash-card-head">
          <div class="dash-card-thumb" ${thumb}></div>
          <div class="dash-card-title">
            <h2>${escapeHtml(cat.name)}</h2>
            <span>${STATUS_LABEL[cat.status] || cat.status} · ${cat.total_votes} voto${cat.total_votes === 1 ? '' : 's'}</span>
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
      const cats = data.categories || [];
      if (!cats.length) {
        els.grid.innerHTML = `<div class="empty-state"><h3>Nenhuma categoria ainda</h3></div>`;
      } else {
        els.grid.innerHTML = cats.map(renderCard).join('');
      }
      els.updatedAt.textContent = `atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
    } catch (e) {
      /* mantém o último snapshot visível em caso de falha pontual */
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
