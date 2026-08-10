const API_URL = '/api';
let votedCategories = JSON.parse(localStorage.getItem('votedCategories') || '[]');
let allCategories = [];

// Carregar categorias ao iniciar
loadCategories();

// ===================== CARREGAMENTO =====================
async function loadCategories() {
  try {
    const response = await fetch(`${API_URL}/categories`);
    allCategories = await response.json();

    const container = document.getElementById('categoriesContainer');
    const emptyState = document.getElementById('emptyState');
    container.innerHTML = '';

    let activeCategories = 0;

    for (const category of allCategories) {
      const statusResponse = await fetch(`${API_URL}/categories/${category.id}/status`);
      const statusData = await statusResponse.json();
      const status = statusData.status;

      if (status === 'open') {
        activeCategories++;
        renderVoteCard(category, status);
      } else if (status === 'ended') {
        renderVoteCard(category, status);
      }
    }

    if (activeCategories === 0 && allCategories.length === 0) {
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
    }
  } catch (error) {
    console.error('Erro ao carregar categorias:', error);
    showVotingMessage('Erro ao carregar categorias', 'error');
  }
}

function renderVoteCard(category, status) {
  const container = document.getElementById('categoriesContainer');
  
  const startDate = new Date(category.start_date);
  const endDate = new Date(category.end_date);
  let statusText, statusClass;

  if (status === 'open') {
    statusText = '🔴 Votação Aberta';
    statusClass = 'open';
  } else if (status === 'ended') {
    statusText = '✅ Votação Encerrada';
    statusClass = 'ended';
  } else {
    statusText = '⏱️ Não iniciada';
    statusClass = 'not-started';
  }

  const card = document.createElement('div');
  card.className = 'vote-card';
  card.innerHTML = `
    <div class="vote-card-header">
      <div class="vote-card-title">${category.name}</div>
      <div class="vote-card-date">
        ${status === 'ended' ? '📊 Resultados disponíveis' : '⏰ Encerra em: ' + formatDateTime(category.end_date)}
      </div>
    </div>
    <div class="vote-card-body">
      <div class="vote-card-status">
        <span class="status-badge ${statusClass}">${statusText}</span>
      </div>
      ${status === 'open' ? `
        <button class="vote-btn" onclick="openVotingModal(${category.id})">
          ${votedCategories.includes(category.id) ? '✓ Já votou' : 'Votar Agora'}
        </button>
      ` : `
        <button class="vote-btn" onclick="openResultsModal(${category.id})">
          Ver Resultados
        </button>
      `}
    </div>
  `;
  
  container.appendChild(card);
}

// ===================== VOTAÇÃO MODAL =====================
async function openVotingModal(categoryId) {
  if (votedCategories.includes(categoryId)) {
    showVotingMessage('Você já votou nesta categoria!', 'info');
    return;
  }

  const category = allCategories.find(c => c.id === categoryId);
  if (!category) return;

  document.getElementById('categoryTitle').textContent = category.name;
  const optionsContainer = document.getElementById('votingOptions');
  optionsContainer.innerHTML = '';

  if (!category.options || category.options.length === 0) {
    optionsContainer.innerHTML = '<p style="text-align: center; color: #999;">Nenhuma opção disponível</p>';
  } else {
    category.options.forEach(option => {
      const div = document.createElement('div');
      div.className = 'voting-option';
      div.textContent = option.text;
      div.onclick = () => selectOption(div, option.id, categoryId);
      optionsContainer.appendChild(div);
    });
  }

  document.getElementById('votingStatus').innerHTML = '';
  document.getElementById('votingModal').style.display = 'flex';
}

function selectOption(element, optionId, categoryId) {
  document.querySelectorAll('.voting-option').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');

  const statusDiv = document.getElementById('votingStatus');
  statusDiv.innerHTML = `
    <button class="vote-btn" onclick="submitVote(${categoryId}, ${optionId})">✓ Confirmar Voto</button>
  `;
}

async function submitVote(categoryId, optionId) {
  try {
    const response = await fetch(`${API_URL}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, option_id: optionId })
    });

    const data = await response.json();

    if (!response.ok) {
      showVotingMessage(data.error, 'error');
      return;
    }

    votedCategories.push(categoryId);
    localStorage.setItem('votedCategories', JSON.stringify(votedCategories));

    const statusDiv = document.getElementById('votingStatus');
    statusDiv.className = 'voting-status success';
    statusDiv.textContent = '✅ Voto registrado com sucesso!';

    setTimeout(() => {
      closeVotingModal();
      loadCategories();
    }, 2000);
  } catch (error) {
    showVotingMessage('Erro ao votar: ' + error.message, 'error');
  }
}

function closeVotingModal() {
  document.getElementById('votingModal').style.display = 'none';
}

// ===================== RESULTADOS MODAL =====================
async function openResultsModal(categoryId) {
  const category = allCategories.find(c => c.id === categoryId);
  if (!category) return;

  try {
    const response = await fetch(`${API_URL}/results/${categoryId}`);
    const data = await response.json();

    if (!response.ok) {
      showVotingMessage(data.error, 'error');
      return;
    }

    document.getElementById('resultsTitle').textContent = category.name;

    const statsDiv = document.getElementById('resultStats');
    statsDiv.innerHTML = `
      <div class="result-stat">
        📊 Total de votos: <strong>${data.totalVotes}</strong>
      </div>
      <div class="result-stat">
        📅 Encerrada em: <strong>${formatDateTime(data.category.end_date)}</strong>
      </div>
    `;

    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = '';

    if (data.results.length === 0) {
      resultsList.innerHTML = '<p style="text-align: center; color: #999;">Nenhum voto registrado</p>';
    } else {
      data.results.forEach((result, index) => {
        const percentage = parseFloat(result.percentage);
        const div = document.createElement('div');
        div.className = 'result-item';
        div.innerHTML = `
          <div class="result-header">
            <div class="result-text">
              ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '•'} ${result.text}
            </div>
            <div class="result-votes">${result.votes} votos (${percentage.toFixed(1)}%)</div>
          </div>
          <div class="result-bar-container">
            <div class="result-bar" style="width: ${percentage}%;">
              ${percentage > 5 ? `${percentage.toFixed(1)}%` : ''}
            </div>
          </div>
        `;
        resultsList.appendChild(div);
      });
    }

    document.getElementById('resultsModal').style.display = 'flex';
  } catch (error) {
    showVotingMessage('Erro ao carregar resultados: ' + error.message, 'error');
  }
}

function closeResultsModal() {
  document.getElementById('resultsModal').style.display = 'none';
}

// ===================== UTILITÁRIOS =====================
function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR');
}

function showVotingMessage(message, type = 'info') {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.textContent = message;
  document.body.insertAdjacentElement('afterbegin', div);

  setTimeout(() => div.remove(), 4000);
}

// Atualizar categorias a cada 30 segundos
setInterval(() => {
  loadCategories();
}, 30000);

// Fechar modal ao clicar fora
window.onclick = (event) => {
  const votingModal = document.getElementById('votingModal');
  const resultsModal = document.getElementById('resultsModal');

  if (event.target === votingModal) {
    votingModal.style.display = 'none';
  }
  if (event.target === resultsModal) {
    resultsModal.style.display = 'none';
  }
};
