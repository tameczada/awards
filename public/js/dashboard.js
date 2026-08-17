(() => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  let dashboardBgFromCard = false;
  let dashboardShowVoters = false;

  // aplica o mesmo tema/cores/fonte definidos no admin (Configurações → Aparência)
  // — /api/settings é público, não depende do token do dashboard
  async function loadSettings() {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      const s = await res.json();
      if (window.applyVotacaoTheme) window.applyVotacaoTheme(s.theme, s.custom_colors);
      if (window.applyVotacaoFont) window.applyVotacaoFont(s.font_pair);
      dashboardBgFromCard = !!s.dashboard_bg_from_card;
      dashboardShowVoters = !!s.dashboard_show_voters;
    } catch (e) { /* segue com o tema padrão */ }
  }
  loadSettings();
  setInterval(loadSettings, 20000); // pega a tempo se o admin ligar/desligar a opção

  const els = {
    gate: document.getElementById('token-gate'),
    root: document.getElementById('dashboard-root'),
    grid: document.getElementById('dash-grid'),
    connStatus: document.getElementById('dash-conn-status'),
    updatedAt: document.getElementById('dash-updated-at'),
    focusSelect: document.getElementById('dash-focus-select'),
    prevBtn: document.getElementById('dash-prev-btn'),
    nextBtn: document.getElementById('dash-next-btn'),
    navIndicator: document.getElementById('dash-nav-indicator'),
    revealBtn: document.getElementById('dash-reveal-btn'),
    hideBtn: document.getElementById('dash-hide-btn'),
    voteNumbers: document.getElementById('dash-vote-numbers'),
    nextBar: document.getElementById('dash-next-bar'),
    nextName: document.getElementById('dash-next-name'),
    bgBlur: document.getElementById('dash-bg-blur'),
    curtainOverlay: document.getElementById('curtain-overlay'),
    curtainBtn: document.getElementById('curtain-btn'),
    curtainSound: document.getElementById('curtain-sound'),
    votersModal: document.getElementById('voters-modal'),
    votersModalTitle: document.getElementById('voters-modal-title'),
    votersModalBody: document.getElementById('voters-modal-body'),
    votersCloseBtn: document.getElementById('voters-close-btn'),
    votersModalOverlay: document.querySelector('.voters-modal-overlay'),
    voteToastContainer: document.getElementById('vote-toast-container'),
  };

  if (!token) {
    els.gate.style.display = 'flex';
    return;
  }
  els.gate.style.display = 'none';
  els.root.style.display = 'block';

  // ===== cortina de abertura =====
  els.curtainOverlay.style.display = 'flex';

  function playCurtainFanfare() {
    // ===== TENTAR TOCAR MP3 PRIMEIRO =====
    // readyState >= 2 significa que o navegador já carregou dados suficientes
    // do arquivo pra tocar; se o MP3 não existir (404) ou não carregar, cai no catch
    if (els.curtainSound && els.curtainSound.src) {
      els.curtainSound.currentTime = 0; // reinicia do começo
      const playPromise = els.curtainSound.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => { /* MP3 tocando normalmente */ })
          .catch(() => {
            // fallback para som sintetizado se o MP3 falhar (ex: arquivo não existe)
            playCurtainFanfareSynthetic();
          });
        return; // saiu aqui, não toca som sintetizado
      }
    }

    // ===== FALLBACK: SOM SINTETIZADO =====
    playCurtainFanfareSynthetic();
  }

  function playCurtainFanfareSynthetic() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.value = 0.20;
      master.connect(ctx.destination);

      // "sopro" de tecido abrindo: ruído filtrado com o tom caindo,
      // sincronizado com o começo do movimento da cortina
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 1.6, ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.Q.value = 0.6;
      noiseFilter.frequency.setValueAtTime(1600, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 1.5);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.1, now + 0.2);
      noiseGain.gain.linearRampToValueAtTime(0, now + 1.6);
      noise.connect(noiseFilter).connect(noiseGain).connect(master);
      noise.start(now);
      noise.stop(now + 1.6);

      // sininho suave (fundamental + oitava mais baixa, ondas senoidais) — chega
      // perto do fim do movimento da cortina, tipo um "revelou!" discreto
      const notes = [392.0, 493.88, 587.33, 783.99]; // sol·si·ré·sol
      notes.forEach((freq, i) => {
        const start = now + 1.0 + i * 0.26;
        [1, 2].forEach((mult, h) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq * mult;
          const peak = h === 0 ? 0.15 : 0.045;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(peak, start + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.0008, start + 1.3);
          osc.connect(gain).connect(master);
          osc.start(start);
          osc.stop(start + 1.35);
        });
      });
    } catch (e) { /* navegador sem suporte a Web Audio — segue sem som */ }
  }
  els.curtainBtn.addEventListener('click', () => {
    playCurtainFanfare();
    els.curtainOverlay.classList.add('open');
    // espera a transição terminar (3.6s + atraso de 0.2s do painel direito) antes
    // de tirar a cortina de vez — via inline style, não só classe, senão o estilo
    // inline que a mostrou (style.display='flex') continua vencendo e ela some
    // visualmente mas fica travando clique em tudo por baixo pra sempre
    setTimeout(() => { els.curtainOverlay.style.display = 'none'; }, 9000);
  });

  // ===== popup "quem votou em quê" =====
  function closeVotersModal() {
    els.votersModal.style.display = 'none';
  }
  els.votersCloseBtn.addEventListener('click', closeVotersModal);
  els.votersModalOverlay.addEventListener('click', closeVotersModal);

  async function openVotersModal(categoryId, categoryName) {
    els.votersModalTitle.textContent = categoryName ? `Quem votou · ${categoryName}` : 'Quem votou em quê';
    els.votersModalBody.innerHTML = '<div class="loading-state"><div class="spinner"></div>Carregando…</div>';
    els.votersModal.style.display = 'flex';

    try {
      const res = await fetch(`/api/dashboard/voters/${categoryId}?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        els.votersModalBody.innerHTML = `<p class="voters-modal-error">${escapeHtml(data.error || 'Não foi possível carregar.')}</p>`;
        return;
      }
      renderVotersModal(data);
    } catch (e) {
      els.votersModalBody.innerHTML = '<p class="voters-modal-error">Erro de rede ao carregar. Tente novamente.</p>';
    }
  }

  function renderVotersModal(data) {
    const options = data.options || [];
    if (!options.length) {
      els.votersModalBody.innerHTML = '<p class="voters-empty-note">Essa categoria ainda não tem opções.</p>';
      return;
    }
    els.votersModalBody.innerHTML = options.map((o) => {
      const namesHtml = o.voters.length
        ? `<div class="voters-name-list">${o.voters.map((n) => `<span class="voters-name-chip">${escapeHtml(n)}</span>`).join('')}</div>`
        : '';
      const anonHtml = o.anonymous_count > 0
        ? `<p class="voters-anonymous-note">+ ${o.anonymous_count} voto${o.anonymous_count === 1 ? '' : 's'} anônimo${o.anonymous_count === 1 ? '' : 's'} (pelo site, sem nome)</p>`
        : '';
      const emptyHtml = (!o.voters.length && !o.anonymous_count)
        ? '<p class="voters-empty-note">Ninguém votou aqui ainda.</p>'
        : '';
      return `
        <div class="voters-option-block">
          <div class="voters-option-head">
            <h3>${escapeHtml(o.name)}</h3>
            <span class="voters-option-count">${o.votes} voto${o.votes === 1 ? '' : 's'}</span>
          </div>
          ${namesHtml}${anonHtml}${emptyHtml}
        </div>
      `;
    }).join('');
  }

  // delegação de evento: os cards são recriados a cada refresh do grid,
  // então o listener fica no container fixo, não em cada botão individual
  els.grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.dash-voters-btn');
    if (!btn) return;
    openVotersModal(btn.dataset.categoryId, btn.dataset.categoryName);
  });

  const STATUS_LABEL = { aberta: 'Aberta agora', encerrada: 'Encerrada', agendada: 'Em breve', pausada: 'Pausada' };
  let lastRevealed = false; // pra disparar a animação só na transição censurado -> revelado
  let lastFocusedId; // pra disparar a transição de entrada só quando a categoria em foco muda
  let isFirstSnapshot = true; // dispara o suspense das opções também no primeiro carregamento da página

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

  // navega pra categoria anterior/próxima da lista (mesma ordem do dropdown);
  // partindo de "mostrar todas", → vai pra primeira e ← vai pra última
  let currentCategoryOptions = [];
  function navigateCategory(direction) {
    if (!currentCategoryOptions.length) return;
    const idx = currentCategoryOptions.findIndex((c) => c.id === els.focusSelect.value);
    const nextIdx = idx === -1
      ? (direction === 1 ? 0 : currentCategoryOptions.length - 1)
      : (idx + direction + currentCategoryOptions.length) % currentCategoryOptions.length;
    postAction('/api/dashboard/focus', { category_id: currentCategoryOptions[nextIdx].id });
  }
  els.prevBtn.addEventListener('click', () => navigateCategory(-1));
  els.nextBtn.addEventListener('click', () => navigateCategory(1));

  function updateFocusControls(data) {
    currentCategoryOptions = data.category_options || [];
    // só reconstrói as options do select se a lista de categorias mudou,
    // pra não perder o foco do usuário no dropdown a cada refresh
    const wanted = ['<option value="">Mostrar todas as categorias</option>']
      .concat(currentCategoryOptions.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`))
      .join('');
    if (els.focusSelect.dataset.rendered !== wanted) {
      els.focusSelect.innerHTML = wanted;
      els.focusSelect.dataset.rendered = wanted;
    }
    els.focusSelect.value = data.focused_category_id || '';

    const hasFocus = !!data.focused_category_id;
    els.revealBtn.style.display = hasFocus && !data.revealed ? 'inline-flex' : 'none';
    els.hideBtn.style.display = hasFocus && data.revealed ? 'inline-block' : 'none';

    // indicador "N / total" de qual categoria está em foco na lista
    const navIdx = currentCategoryOptions.findIndex((c) => c.id === data.focused_category_id);
    els.navIndicator.textContent = navIdx !== -1
      ? `${navIdx + 1} / ${currentCategoryOptions.length}`
      : (currentCategoryOptions.length ? `todas · ${currentCategoryOptions.length}` : '');
    const noCats = currentCategoryOptions.length === 0;
    els.prevBtn.disabled = noCats;
    els.nextBtn.disabled = noCats;

    // tarjinha "a seguir" no rodapé: só faz sentido com uma categoria em foco
    // e mais de uma categoria cadastrada (senão "a seguir" seria ela mesma)
    if (navIdx !== -1 && currentCategoryOptions.length > 1) {
      const nextIdx = (navIdx + 1) % currentCategoryOptions.length;
      els.nextName.textContent = currentCategoryOptions[nextIdx].name;
      els.nextBar.style.display = 'flex';
    } else {
      els.nextBar.style.display = 'none';
    }

    // a categoria escolhida acima também é a categoria ativa pro voto via
    // chat da Twitch (!votar N) — mostra a numeração das opções aqui
    const catInfo = currentCategoryOptions.find((c) => c.id === data.focused_category_id);
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

  // OPT_REVEAL_DELAY_MS: intervalo entre a opção anterior aparecer e a próxima
  // OPT_REVEAL_FIRST_DELAY_MS: pausa antes da 1ª opção (depois do título do card)
  const OPT_REVEAL_DELAY_MS = 3000;
  const OPT_REVEAL_FIRST_DELAY_MS = 5000;

  function renderOption(o, index, isFocusedMode, revealed, maxVotes, staggerReveal) {
    const thumb = o.image_url ? `<span class="dash-option-thumb" style="background-image:url('${o.image_url}')"></span>` : '';
    // suspense: só aplica o delay escalonado quando o card está "entrando" de
    // verdade (categoria nova em foco / primeiro carregamento) — em refreshes
    // normais (voto novo chegando, poll periódico) as opções já visíveis não
    // devem sumir e reaparecer de novo, senão fica piscando toda hora
    const staggerStyle = staggerReveal
      ? ` style="animation-delay:${(OPT_REVEAL_FIRST_DELAY_MS + index * OPT_REVEAL_DELAY_MS) / 1000}s"`
      : '';
    const staggerClass = staggerReveal ? ' stagger-in' : '';
    if (isFocusedMode && !revealed) {
      return `
        <div class="dash-option censored${staggerClass}"${staggerStyle}>
          <div class="dash-option-top">
            ${thumb}
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
      <div class="dash-option ${isLeader ? 'leader' : ''}${staggerClass}"${staggerStyle}>
        <div class="dash-option-top">
          ${thumb}
          <span class="dash-option-name">${isLeader ? '👑 ' : ''}${escapeHtml(o.name)}</span>
          <span class="dash-option-pct">${o.votes} · ${o.percent}%</span>
        </div>
        <div class="dash-bar-track"><div class="dash-bar-fill" style="width:${width}%"></div></div>
      </div>
    `;
  }

  function renderCard(cat, isFocusedMode, revealed, justRevealed, entering, staggerReveal) {
    const hasBg = !!cat.image_url;
    const bgStyle = hasBg ? ` style="background-image:url('${cat.image_url}')"` : '';
    const sizeClass = `size-${cat.card_size === 'pequeno' || cat.card_size === 'grande' ? cat.card_size : 'medio'}`;
    const censored = isFocusedMode && !revealed;
    const maxVotes = cat.options.length && !censored ? cat.options[0].votes : 0;
    // contagem regressiva: útil pra categoria aberta ou pausada com prazo de fim definido
    // (mesmo pausada, o prazo continua correndo e ela fecha sozinha na hora certa)
    const countdownHtml = ((cat.status === 'aberta' || cat.status === 'pausada') && cat.ends_at)
      ? `<span class="dash-countdown" data-ends-at="${cat.ends_at}">encerra em …</span>`
      : '';

    let optionsHtml;
    if (cat.options.length) {
      optionsHtml = cat.options.map((o, i) => renderOption(o, i, isFocusedMode, revealed, maxVotes, staggerReveal)).join('');
    } else {
      optionsHtml = '<p class="dash-empty-options">Nenhuma opção cadastrada ainda.</p>';
    }

    const totalLabel = censored
      ? `${cat.total_votes} voto${cat.total_votes === 1 ? '' : 's'} até agora`
      : `${STATUS_LABEL[cat.status] || cat.status} · ${cat.total_votes} voto${cat.total_votes === 1 ? '' : 's'}`;

    // botão "ver quem votou": só aparece se o admin ligou a opção E os
    // resultados dessa categoria não estão censurados no momento (senão o
    // popup também precisaria censurar, e fica mais simples só escondê-lo)
    const votersBtnHtml = (dashboardShowVoters && !censored)
      ? `<button type="button" class="dash-voters-btn" data-category-id="${cat.id}" data-category-name="${escapeHtml(cat.name)}">👥 Ver quem votou</button>`
      : '';

    return `
      <article class="dash-card ${sizeClass} ${hasBg ? 'has-bg' : ''} ${justRevealed ? 'revealing' : ''} ${entering ? 'entering' : ''}"${bgStyle}>
        <div class="dash-card-head">
          <div class="dash-card-title">
            <h2>${escapeHtml(cat.name)}</h2>
            <span>${totalLabel}</span>
          </div>
          ${countdownHtml}
        </div>
        <div class="dash-options">${optionsHtml}</div>
        ${votersBtnHtml}
      </article>
    `;
  }

  // atualiza o texto de todos os contadores regressivos a cada segundo,
  // sem precisar re-renderizar o grid inteiro (isso evitaria animações e
  // manteria o resto do card intacto)
  function fmtCountdown(ms) {
    if (ms <= 0) return 'encerrando…';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `encerra em ${h}:${pad(m)}:${pad(s)}` : `encerra em ${pad(m)}:${pad(s)}`;
  }

  function tickCountdowns() {
    document.querySelectorAll('.dash-countdown[data-ends-at]').forEach((el) => {
      const remaining = new Date(el.dataset.endsAt).getTime() - Date.now();
      el.textContent = fmtCountdown(remaining);
      el.classList.toggle('ending-soon', remaining > 0 && remaining < 60000);
    });
  }
  setInterval(tickCountdowns, 1000);

  // fundo desfocado com a imagem da categoria em foco (opcional, liga no admin)
  let lastBgImage;
  function updateBgBlur(imageUrl) {
    const wanted = dashboardBgFromCard && imageUrl ? imageUrl : null;
    if (wanted === lastBgImage) return;
    lastBgImage = wanted;
    if (wanted) {
      els.bgBlur.style.backgroundImage = `url('${wanted}')`;
      els.bgBlur.classList.add('active');
    } else {
      els.bgBlur.classList.remove('active');
    }
  }

  // evita que duas chamadas de fetchSnapshot() em paralelo (ex: a inicial +
  // a que dispara assim que o WebSocket conecta, que acontecem quase juntas)
  // se atropelem — só a resposta da chamada MAIS RECENTE tem permissão de
  // renderizar; isso é o que fazia o suspense parecer "não funcionar": a 2ª
  // chamada terminava logo depois da 1ª e sobrescrevia o HTML sem o efeito
  let fetchSeq = 0;
  async function fetchSnapshot() {
    const seq = ++fetchSeq;
    try {
      const res = await fetch(`/api/dashboard/live?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      if (seq !== fetchSeq) return; // já saiu uma chamada mais nova, descarta esta
      if (res.status === 401) {
        els.grid.innerHTML = `<div class="empty-state"><h3>Token inválido</h3><p>Gere um novo link no painel admin.</p></div>`;
        return;
      }
      const data = await res.json();
      if (seq !== fetchSeq) return; // idem, checa de novo depois do 2º await
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
      const focusChanged = data.focused_category_id !== lastFocusedId;
      lastFocusedId = data.focused_category_id;

      // suspense das opções (aparecem uma a uma): dispara quando o card é
      // "novo" — categoria trocou, mudou de modo (foco ⇄ mostrar todas), ou é
      // o primeiro carregamento da página. Em refreshes normais (voto novo
      // chegando, poll de 20s na mesma categoria) NÃO dispara de novo, senão
      // as opções ficariam sumindo e reaparecendo a cada atualização
      const staggerReveal = focusChanged || isFirstSnapshot;
      isFirstSnapshot = false;

      els.grid.classList.toggle('focused', isFocusedMode);

      const focusedCat = isFocusedMode ? cats.find((c) => c.id === data.focused_category_id) : null;
      updateBgBlur(focusedCat ? focusedCat.image_url : null);

      if (!cats.length) {
        els.grid.innerHTML = `<div class="empty-state"><h3>Nenhuma categoria ainda</h3></div>`;
      } else {
        els.grid.innerHTML = cats.map((c) => renderCard(c, isFocusedMode, data.revealed, justRevealed, isFocusedMode && focusChanged, staggerReveal)).join('');
        tickCountdowns(); // evita esperar 1s pro primeiro texto do contador aparecer
      }
      els.updatedAt.textContent = `atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
    } catch (e) {
      console.error('Erro de rede ao buscar snapshot do dashboard:', e);
      /* mantém o último snapshot visível em caso de falha pontual de rede */
    }
  }

  // ===== toast em tempo real "Fulano votou em X" =====
  const MAX_TOASTS = 4; // evita empilhar demais se vários votos chegarem juntos
  const TOAST_DURATION_MS = 5000;

  function showVoteToast({ voter_name, category_name, option_name }) {
    const el = document.createElement('div');
    el.className = 'vote-toast';
    el.innerHTML = `
      <span class="vote-toast-icon"></span>
      <span class="vote-toast-text">
        <strong>${escapeHtml(voter_name || 'Alguém')}</strong> votou em <strong>${escapeHtml(option_name || '')}</strong>
        ${category_name ? `<span class="vote-toast-option">${escapeHtml(category_name)}</span>` : ''}
      </span>
    `;
    els.voteToastContainer.appendChild(el);

    // limita quantos toasts ficam empilhados ao mesmo tempo
    while (els.voteToastContainer.children.length > MAX_TOASTS) {
      els.voteToastContainer.removeChild(els.voteToastContainer.firstChild);
    }

    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 400);
    }, TOAST_DURATION_MS);
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
        else if (msg.type === 'vote_toast') showVoteToast(msg);
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
