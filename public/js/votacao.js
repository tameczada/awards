(() => {
  const API = '/api';

  const els = {
    hero: document.getElementById('hero'),
    siteTitle: document.getElementById('site-title'),
    siteSubtitle: document.getElementById('site-subtitle'),
    metaTotal: document.getElementById('meta-total-cat'),
    metaOpen: document.getElementById('meta-open'),
    metaClosed: document.getElementById('meta-closed'),
    catContainer: document.getElementById('categories-container'),
    listView: document.getElementById('list-view'),
    detailView: document.getElementById('detail-view'),
    detailContent: document.getElementById('detail-content'),
    backBtn: document.getElementById('back-btn'),
    toast: document.getElementById('toast'),
  };

  function getVoterId() {
    let id = localStorage.getItem('voter_id');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      localStorage.setItem('voter_id', id);
    }
    return id;
  }
  els.toast.style.display="none"
  function showToast(msg, isErr = false) {
    els.toast.style.display="block"
    els.toast.textContent = msg;
    els.toast.classList.toggle('err', isErr);
    els.toast.classList.add('show');
    setTimeout(() => els.toast.classList.remove('show'), 3200);
    els.toast.style.display="none"
  }

  const STATUS_LABEL = { aberta: 'Aberta agora', encerrada: 'Encerrada', agendada: 'Em breve' };

  function fmtDate(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  async function loadSettings() {
    try {
      const res = await fetch(`${API}/settings`, { cache: 'no-store' });
      const s = await res.json();
      if (s.site_title) { els.siteTitle.textContent = s.site_title; document.title = s.site_title; }
      if (s.site_subtitle) els.siteSubtitle.textContent = s.site_subtitle;

      if (s.background_mode === 'color' && s.background_color) {
        els.hero.style.backgroundImage = 'none';
        els.hero.style.backgroundColor = s.background_color;
      } else if (s.background_image_url) {
        els.hero.style.backgroundColor = '';
        els.hero.style.backgroundImage = `url('${s.background_image_url}')`;
      }

      if (window.applyVotacaoTheme) window.applyVotacaoTheme(s.theme, s.custom_colors);
      if (window.applyVotacaoFont) window.applyVotacaoFont(s.font_pair);
    } catch (e) { /* segue com defaults */ }
  }

  function ticketCard(cat) {
    const div = document.createElement('article');
    div.className = 'ticket';
    div.dataset.id = cat.id;
    const bg = cat.image_url ? `background-image:url('${cat.image_url}')` : '';
    div.innerHTML = `
      <div class="ticket-poster" style="${bg}">
        <span class="ticket-status ${cat.status}">${STATUS_LABEL[cat.status] || cat.status}</span>
        <div class="ticket-title">${escapeHtml(cat.name)}</div>
      </div>
      <div class="ticket-perf"></div>
      <div class="ticket-body">
        <p class="ticket-desc">${escapeHtml(cat.description || '')}</p>
        <div class="ticket-foot">
          <span>${cat.status === 'encerrada' ? 'ver resultado' : cat.status === 'agendada' ? fmtDate(cat.starts_at) || 'a definir' : 'vote agora'}</span>
          <span class="ticket-cta">abrir →</span>
        </div>
      </div>
    `;
    div.addEventListener('click', () => openCategory(cat.id));
    return div;
  }

  function escapeHtml(str) {
    const p = document.createElement('p');
    p.textContent = str || '';
    return p.innerHTML;
  }

  async function loadCategories() {
    try {
      const res = await fetch(`${API}/categories`, { cache: 'no-store' });
      const cats = await res.json();
      els.catContainer.innerHTML = '';

      if (!cats.length) {
        els.catContainer.innerHTML = `<div class="empty-state"><h3>Nenhuma categoria ainda</h3><p>Volte em breve — as categorias estão sendo preparadas.</p></div>`;
        els.metaTotal.textContent = '0';
        els.metaOpen.textContent = '0';
        els.metaClosed.textContent = '0';
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'grid-categories';
      cats.forEach((c) => grid.appendChild(ticketCard(c)));
      els.catContainer.appendChild(grid);

      els.metaTotal.textContent = cats.length;
      els.metaOpen.textContent = cats.filter((c) => c.status === 'aberta').length;
      els.metaClosed.textContent = cats.filter((c) => c.status === 'encerrada').length;
    } catch (e) {
      els.catContainer.innerHTML = `<div class="empty-state"><h3>Não foi possível carregar</h3><p>Tente recarregar a página.</p></div>`;
    }
  }

  async function openCategory(id) {
    els.listView.style.display = 'none';
    els.detailView.classList.add('active');
    els.detailContent.innerHTML = `<div class="loading-state"><div class="spinner"></div>Carregando…</div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const res = await fetch(`${API}/categories/${id}`);
      if (!res.ok) throw new Error();
      const cat = await res.json();

      if (cat.status === 'encerrada') {
        renderResults(cat);
      } else if (cat.status === 'agendada') {
        renderScheduled(cat);
      } else {
        const statusRes = await fetch(`${API}/vote/status/${id}?voter_id=${getVoterId()}`);
        const voteStatus = await statusRes.json();
        renderVoting(cat, voteStatus);
      }
    } catch (e) {
      els.detailContent.innerHTML = `<div class="empty-state"><h3>Categoria não encontrada</h3></div>`;
    }
  }

  function posterBlock(cat) {
    const bg = cat.image_url ? `background-image:url('${cat.image_url}')` : '';
    return `<div class="detail-poster" style="${bg}"></div>`;
  }

  function renderScheduled(cat) {
    els.detailContent.innerHTML = `
      <div class="detail-header">
        ${posterBlock(cat)}
        <div class="detail-info">
          <span class="eyebrow">Em breve</span>
          <h2>${escapeHtml(cat.name)}</h2>
          <p>${escapeHtml(cat.description || '')}</p>
          <p class="eyebrow" style="margin-top:1.2rem">${cat.starts_at ? 'abre em ' + fmtDate(cat.starts_at) : 'data a definir'}</p>
        </div>
      </div>
    `;
  }

  function renderVoting(cat, voteStatus) {
    const alreadyVoted = voteStatus.voted;
    let selected = alreadyVoted ? voteStatus.option_id : null;

    const optionsHtml = cat.options.map((o) => {
      const thumb = o.image_url ? `style="background-image:url('${o.image_url}')"` : '';
      const isSel = o.id === selected;
      return `
        <button type="button" class="option-row ${isSel ? 'selected' : ''}" data-id="${o.id}" ${alreadyVoted ? 'disabled' : ''}>
          <span class="option-thumb" ${thumb}></span>
          <span class="option-name">${escapeHtml(o.name)}</span>
          <span class="option-radio"></span>
        </button>
      `;
    }).join('');

    els.detailContent.innerHTML = `
      <div class="detail-header">
        ${posterBlock(cat)}
        <div class="detail-info">
          <span class="eyebrow">Votação aberta</span>
          <h2>${escapeHtml(cat.name)}</h2>
          <p>${escapeHtml(cat.description || '')}</p>
        </div>
      </div>
      <div class="options-list">${cat.options.length ? optionsHtml : '<p class="ticket-desc">Nenhuma opção cadastrada ainda.</p>'}</div>
      <div class="vote-actions">
        <button class="btn btn-gold" id="vote-submit" ${alreadyVoted || !cat.options.length ? 'disabled' : ''}>
          ${alreadyVoted ? 'Voto registrado' : 'Confirmar voto'}
        </button>
        <span class="vote-feedback ${alreadyVoted ? 'ok' : ''}" id="vote-feedback">
          ${alreadyVoted ? '✓ você já votou nesta categoria' : ''}
        </span>
      </div>
    `;

    if (!alreadyVoted) {
      const rows = els.detailContent.querySelectorAll('.option-row');
      rows.forEach((row) => {
        row.addEventListener('click', () => {
          rows.forEach((r) => r.classList.remove('selected'));
          row.classList.add('selected');
          selected = row.dataset.id;
        });
      });

      document.getElementById('vote-submit').addEventListener('click', async (e) => {
        if (!selected) {
          showToast('Escolha uma opção antes de votar', true);
          return;
        }
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = 'Enviando…';
        try {
          const res = await fetch(`${API}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category_id: cat.id, option_id: selected, voter_id: getVoterId() }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao votar');
          btn.textContent = 'Voto registrado';
          document.getElementById('vote-feedback').textContent = '✓ voto registrado com sucesso';
          document.getElementById('vote-feedback').classList.add('ok');
          rows.forEach((r) => (r.disabled = true));
          showToast('Voto registrado com sucesso!');
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Confirmar voto';
          document.getElementById('vote-feedback').textContent = err.message;
          document.getElementById('vote-feedback').classList.add('err');
          showToast(err.message, true);
        }
      });
    }
  }

  function renderResults(cat) {
    const max = cat.options[0] ? cat.options[0].votes : 0;
    const rowsHtml = cat.options.map((o, i) => {
      const width = max ? Math.max((o.votes / max) * 100, o.votes > 0 ? 4 : 0) : 0;
      return `
        <div class="result-row ${i === 0 && o.votes > 0 ? 'rank-1' : ''}">
          <div class="result-top">
            <span class="result-name"><span class="result-rank">${String(i + 1).padStart(2, '0')}</span>${escapeHtml(o.name)}</span>
            <span class="result-pct">${o.percent}%</span>
          </div>
          <div class="result-bar-track"><div class="result-bar-fill" style="width:${width}%"></div></div>
          <div class="result-votes">${o.votes} voto${o.votes === 1 ? '' : 's'}</div>
        </div>
      `;
    }).join('');

    els.detailContent.innerHTML = `
      <div class="detail-header">
        ${posterBlock(cat)}
        <div class="detail-info">
          <span class="eyebrow">Votação encerrada · ${cat.total_votes} voto${cat.total_votes === 1 ? '' : 's'} no total</span>
          <h2>${escapeHtml(cat.name)}</h2>
          <p>${escapeHtml(cat.description || '')}</p>
        </div>
      </div>
      <div class="results-list">${cat.options.length ? rowsHtml : '<p class="ticket-desc">Nenhuma opção nesta categoria.</p>'}</div>
    `;
  }

  els.backBtn.addEventListener('click', () => {
    els.detailView.classList.remove('active');
    els.listView.style.display = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  loadSettings();
  loadCategories();
})();
