const API_URL = '/api';
let token = localStorage.getItem('adminToken');
let currentEditingCategory = null;

if (token) {
  showDashboard();
  loadCategories();
} else {
  showLogin();
}

// ===================== AUTENTICAÇÃO VIA CHAVE =====================
document.getElementById('keyForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = document.getElementById('adminKey').value;
  const errorDiv = document.getElementById('keyError');

  try {
    const response = await fetch(`${API_URL}/auth/validate-key/${key}`);
    const data = await response.json();

    if (!response.ok) {
      errorDiv.textContent = '❌ Chave inválida!';
      errorDiv.style.display = 'block';
      document.getElementById('adminKey').value = '';
      return;
    }

    localStorage.setItem('adminToken', data.token);
    token = data.token;
    document.getElementById('adminKey').value = '';
    errorDiv.style.display = 'none';
    showDashboard();
    loadCategories();
    showMessage('✅ Acesso concedido!', 'success');
  } catch (error) {
    console.error('Erro ao validar chave:', error);
    errorDiv.textContent = '❌ Erro ao validar chave';
    errorDiv.style.display = 'block';
  }
});

function logout() {
  if (confirm('Deseja realmente fazer logout?')) {
    localStorage.removeItem('adminToken');
    token = null;
    showLogin();
  }
}

function showLogin() {
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('registerSection').style.display = 'none';
  document.getElementById('dashboardSection').style.display = 'none';
}

function showDashboard() {
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('registerSection').style.display = 'none';
  document.getElementById('dashboardSection').style.display = 'block';
  document.getElementById('userInfo').textContent = `Logado como: ${token ? 'Admin' : 'Desconectado'}`;
}

// ===================== CATEGORIAS =====================
document.getElementById('categoryForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('categoryName').value;
  const start_date = document.getElementById('startDate').value;
  const end_date = document.getElementById('endDate').value;

  if (new Date(start_date) >= new Date(end_date)) {
    showMessage('Data de início deve ser anterior à data de encerramento!', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, start_date, end_date })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error, 'error');
      return;
    }

    document.getElementById('categoryName').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    loadCategories();
    showMessage('Categoria criada com sucesso!', 'success');
  } catch (error) {
    showMessage('Erro ao criar categoria: ' + error.message, 'error');
  }
});

async function loadCategories() {
  try {
    const response = await fetch(`${API_URL}/categories`);
    const categories = await response.json();

    const container = document.getElementById('categoriesList');
    container.innerHTML = '';

    if (categories.length === 0) {
      container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">Nenhuma categoria criada ainda</p>';
      return;
    }

    categories.forEach(category => {
      const now = new Date();
      const startDate = new Date(category.start_date);
      const endDate = new Date(category.end_date);
      let status, statusText;

      if (now < startDate) {
        status = 'not-started';
        statusText = '⏱️ Não iniciada';
      } else if (now > endDate) {
        status = 'ended';
        statusText = '✅ Encerrada';
      } else {
        status = 'open';
        statusText = '🔴 Aberta';
      }

      const card = document.createElement('div');
      card.className = 'category-card';
      card.innerHTML = `
        <h3>${category.name}</h3>
        <div class="category-info">
          <span class="status-badge ${status}">${statusText}</span>
          <span>📅 Início: ${formatDateTime(category.start_date)}</span>
          <span>📅 Fim: ${formatDateTime(category.end_date)}</span>
          <span>🗳️ Opções: ${category.options?.length || 0}</span>
        </div>
        <div class="options-list">
          ${category.options?.map(opt => `
            <div class="option-item">
              <span class="option-text">${opt.text}</span>
            </div>
          `).join('') || '<p style="font-size: 12px; color: #999;">Sem opções</p>'}
        </div>
        <div class="category-actions">
          <button class="btn-small btn-edit" onclick="editCategory(${category.id})">✏️ Editar</button>
          <button class="btn-small btn-delete" onclick="deleteCategory(${category.id})">🗑️ Deletar</button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (error) {
    showMessage('Erro ao carregar categorias: ' + error.message, 'error');
  }
}

async function editCategory(categoryId) {
  try {
    const response = await fetch(`${API_URL}/categories`);
    const categories = await response.json();
    const category = categories.find(c => c.id === categoryId);

    if (!category) return;

    currentEditingCategory = category;

    document.getElementById('editCategoryName').value = category.name;
    document.getElementById('editStartDate').value = category.start_date.replace('Z', '');
    document.getElementById('editEndDate').value = category.end_date.replace('Z', '');

    const optionsList = document.getElementById('optionsList');
    optionsList.innerHTML = category.options?.map(opt => `
      <div class="option-item">
        <input type="text" value="${opt.text}" class="option-edit" data-id="${opt.id}" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <button class="btn-remove" onclick="deleteOption(${opt.id})">✕</button>
      </div>
    `).join('') || '';

    document.getElementById('editForm').onsubmit = async (e) => {
      e.preventDefault();
      await saveCategory();
    };

    document.getElementById('editModal').style.display = 'flex';
  } catch (error) {
    showMessage('Erro ao abrir categoria: ' + error.message, 'error');
  }
}

async function saveCategory() {
  const name = document.getElementById('editCategoryName').value;
  const start_date = document.getElementById('editStartDate').value;
  const end_date = document.getElementById('editEndDate').value;

  try {
    const response = await fetch(`${API_URL}/categories/${currentEditingCategory.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, start_date, end_date })
    });

    if (!response.ok) {
      const data = await response.json();
      showMessage(data.error, 'error');
      return;
    }

    // Salvar opções editadas
    const optionInputs = document.querySelectorAll('.option-edit');
    for (const input of optionInputs) {
      const optionId = input.dataset.id;
      const text = input.value;

      if (text.trim()) {
        await fetch(`${API_URL}/options/${optionId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ text })
        });
      }
    }

    closeModal();
    loadCategories();
    showMessage('Categoria atualizada com sucesso!', 'success');
  } catch (error) {
    showMessage('Erro ao salvar categoria: ' + error.message, 'error');
  }
}

async function deleteCategory(categoryId) {
  if (!confirm('Deseja realmente deletar esta categoria e todas as suas opções e votos?')) return;

  try {
    const response = await fetch(`${API_URL}/categories/${categoryId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const data = await response.json();
      showMessage(data.error, 'error');
      return;
    }

    loadCategories();
    showMessage('Categoria deletada com sucesso!', 'success');
  } catch (error) {
    showMessage('Erro ao deletar categoria: ' + error.message, 'error');
  }
}

async function deleteOption(optionId) {
  try {
    const response = await fetch(`${API_URL}/options/${optionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Erro ao deletar opção');

    document.querySelector(`[data-id="${optionId}"]`).parentElement.remove();
    showMessage('Opção removida!', 'success');
  } catch (error) {
    showMessage('Erro: ' + error.message, 'error');
  }
}

function addOptionInput() {
  const newOptionText = document.getElementById('newOptionText').value.trim();
  if (!newOptionText) {
    showMessage('Digite o texto da opção', 'error');
    return;
  }

  addOption(newOptionText);
  document.getElementById('newOptionText').value = '';
}

async function addOption(text) {
  try {
    const response = await fetch(`${API_URL}/options`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ category_id: currentEditingCategory.id, text })
    });

    const option = await response.json();

    if (!response.ok) {
      showMessage(option.error, 'error');
      return;
    }

    const optionsList = document.getElementById('optionsList');
    const optionDiv = document.createElement('div');
    optionDiv.className = 'option-item';
    optionDiv.innerHTML = `
      <input type="text" value="${option.text}" class="option-edit" data-id="${option.id}" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
      <button class="btn-remove" onclick="deleteOption(${option.id})">✕</button>
    `;
    optionsList.appendChild(optionDiv);
    showMessage('Opção adicionada!', 'success');
  } catch (error) {
    showMessage('Erro ao adicionar opção: ' + error.message, 'error');
  }
}

function closeModal() {
  document.getElementById('editModal').style.display = 'none';
  currentEditingCategory = null;
}

// ===================== UTILITÁRIOS =====================
function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR');
}

function showMessage(message, type = 'info') {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.textContent = message;
  document.body.insertAdjacentElement('afterbegin', div);

  setTimeout(() => div.remove(), 4000);
}
