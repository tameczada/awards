function renderTwitchCategoryOptions(activeId) {
    const select = $('twitch-active-category');
    const openCats = categoriesCache.filter((c) => c.status === 'aberta');
    select.innerHTML = '<option value="">— nenhuma —</option>' + openCats.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    select.value = activeId || '';
    renderTwitchOptionNumbers(activeId);
  }

  async function renderTwitchOptionNumbers(categoryId) {
    const box = $('twitch-option-numbers');
    if (!categoryId) { box.innerHTML = ''; return; }
    try {
      const cat = await fetch(`${API}/categories/${categoryId}`).then((r) => r.json());
      const options = cat.options || [];
      if (!options.length) { box.innerHTML = '<p class="ticket-desc">Essa categoria não tem opções ainda.</p>'; return; }
      box.innerHTML = options.map((o, i) => `<div class="num-row"><strong>!votar ${i + 1}</strong> — ${escapeHtml(o.name)}</div>`).join('');
    } catch {
      box.innerHTML = '';
    }
  }

  $('twitch-active-category').addEventListener('change', async (e) => {
    const value = e.target.value || null;
    try {
      await api('/admin/twitch-config', { method: 'PUT', body: JSON.stringify({ active_category_id: value }) });
      // a categoria ativa pro chat também vira o foco/filtro do dashboard ao vivo
      await api('/admin/dashboard/focus', { method: 'POST', body: JSON.stringify({ category_id: value }) });
      showToast(value ? 'Categoria ativa no chat e no dashboard!' : 'Voltou a mostrar todas as categorias no dashboard');
      renderTwitchOptionNumbers(value);
    } catch (err) {
      showToast(err.message, true);
    }
  });
