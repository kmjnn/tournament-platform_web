const urlParams = new URLSearchParams(window.location.search);
const tournamentId = urlParams.get('id');
let currentUser = JSON.parse(localStorage.getItem('user') || '{}');

console.log('Текущий пользователь:', currentUser);

async function loadTournament() {
  try {
    const tournament = await apiRequest(`/tournaments/${tournamentId}`);
    console.log('Турнир:', tournament);

    // Заполняем базовые поля
    document.getElementById('title').innerText = tournament.title;
    document.getElementById('status').innerText = tournament.status;

    // Детали
    document.getElementById('tournamentDetails').style.display = 'block';
    document.getElementById('game').innerText = tournament.game;
    document.getElementById('type').innerText = tournament.type === 'esports' ? 'Киберспорт' : 'Спорт';
    document.getElementById('format').innerText = {
      single_elim: 'Single Elimination',
      double_elim: 'Double Elimination',
      round_robin: 'Round Robin'
    }[tournament.format] || tournament.format;
    document.getElementById('description').innerText = tournament.description || '—';
    document.getElementById('startDate').innerText = tournament.start_date ? new Date(tournament.start_date).toLocaleString() : '—';
    document.getElementById('deadline').innerText = tournament.registration_deadline ? new Date(tournament.registration_deadline).toLocaleString() : '—';
    document.getElementById('maxTeams').innerText = tournament.max_teams;

    // Дополнительные поля (киберспорт)
    const extraDiv = document.getElementById('extraFields');
    extraDiv.innerHTML = '';
    if (tournament.type === 'esports') {
      if (tournament.platform) extraDiv.innerHTML += `<p><strong>Платформа:</strong> ${tournament.platform}</p>`;
      if (tournament.server) extraDiv.innerHTML += `<p><strong>Сервер:</strong> ${tournament.server}</p>`;
      if (tournament.discord_link) extraDiv.innerHTML += `<p><strong>Discord:</strong> <a href="${tournament.discord_link}" target="_blank">${tournament.discord_link}</a></p>`;
    }

    // Загрузка команд (одобренные)
    const teams = await apiRequest(`/tournaments/${tournamentId}/teams`);
    document.getElementById('teamsCount').innerText = teams.length;
    // Показываем список команд, если есть
    if (teams.length > 0) {
      const listHtml = teams.map(t => `<li>${t.name} (капитан: ${t.captain_nickname})</li>`).join('');
      extraDiv.innerHTML += `<p><strong>Команды-участники:</strong></p><ul>${listHtml}</ul>`;
    } else {
      extraDiv.innerHTML += `<p><strong>Команд-участников пока нет</strong></p>`;
    }

    // Отображаем секцию регистрации (для участника)
    if (tournament.status === 'registration_open' && currentUser.role === 'participant') {
      document.getElementById('registrationSection').style.display = 'block';
    }

    // Организатор
    if (currentUser.id === tournament.created_by) {
      document.getElementById('organizerSection').style.display = 'block';
      // Кнопка генерации сетки видна, если статус "registration_closed" или "in_progress"
      if (tournament.status === 'registration_open' || tournament.status === 'registration_closed') {
        document.getElementById('startBracketBtn').style.display = 'inline-block';
      }
      // Загрузить заявки
      const requests = await apiRequest(`/tournaments/${tournamentId}/requests`);
      renderRequests(requests);
    }

    // Сетка и результаты
    if (tournament.status === 'in_progress' || tournament.status === 'finished') {
      const matches = await apiRequest(`/tournaments/${tournamentId}/matches`);
      renderBracket(matches);
      document.getElementById('bracketSection').style.display = 'block';
      if (currentUser.role === 'organizer') {
        document.getElementById('resultSection').style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Ошибка загрузки турнира:', err);
    alert('Ошибка: ' + err.message);
  }
}

function renderBracket(matches) {
  const container = document.getElementById('bracket');
  container.innerHTML = matches.map(m => `
    <div class="card mb-2">
      <div class="card-body">
        <strong>Раунд ${m.round}</strong>: Команда ${m.team1_id} vs Команда ${m.team2_id || 'BYE'}<br>
        Счёт: ${m.score1 ?? '-'} : ${m.score2 ?? '-'} 
        ${m.winner_id ? ` | Победитель: ${m.winner_id}` : ''}
        <span class="badge bg-secondary">${m.status}</span>
      </div>
    </div>
  `).join('');
}

function renderRequests(requests) {
  const container = document.getElementById('requestsList');
  if (requests.length === 0) {
    container.innerHTML = '<p>Нет заявок</p>';
    return;
  }
  container.innerHTML = requests.map(r => `
    <div class="card mb-2">
      <div class="card-body">
        <p>От: ${r.user_nickname} (${r.type}) ${r.team_name ? '→ ' + r.team_name : ''}</p>
        <p>Статус: ${r.status}</p>
        ${r.status === 'pending' ? `
          <button class="btn btn-sm btn-success approve-btn" data-id="${r.id}">Одобрить</button>
          <button class="btn btn-sm btn-danger reject-btn" data-id="${r.id}">Отклонить</button>
        ` : ''}
      </div>
    </div>
  `).join('');

  // Навесить обработчики
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      await apiRequest(`/requests/${id}/approve`, { method: 'PUT' });
      loadTournament(); // перезагрузить
    });
  });
  document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      await apiRequest(`/requests/${id}/reject`, { method: 'PUT' });
      loadTournament();
    });
  });
}

// Обработчик формы заявки
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = document.getElementById('regType').value;
  const teamName = document.getElementById('teamName')?.value;
  try {
    await apiRequest(`/tournaments/${tournamentId}/register`, {
      method: 'POST',
      body: JSON.stringify({ type, teamName })
    });
    alert('Заявка отправлена');
    loadTournament();
  } catch (err) {
    alert(err.message);
  }
});

// Показать/скрыть поле названия команды
document.getElementById('regType')?.addEventListener('change', function() {
  document.getElementById('teamNameGroup').style.display = this.value === 'team' ? 'block' : 'none';
});

// Кнопка генерации сетки
document.getElementById('startBracketBtn')?.addEventListener('click', async () => {
  try {
    await apiRequest(`/tournaments/${tournamentId}/start-bracket`, { method: 'POST' });
    alert('Сетка сгенерирована');
    loadTournament();
  } catch (err) {
    alert(err.message);
  }
});

// Модальное окно для переноса
const rescheduleModal = new bootstrap.Modal(document.getElementById('rescheduleModal'));
document.getElementById('rescheduleBtn')?.addEventListener('click', () => {
  rescheduleModal.show();
});
document.getElementById('confirmReschedule')?.addEventListener('click', async () => {
  const newDate = document.getElementById('newDate').value;
  if (!newDate) {
    alert('Выберите дату');
    return;
  }
  try {
    await apiRequest(`/tournaments/${tournamentId}/reschedule`, {
      method: 'PUT',
      body: JSON.stringify({ newDate })
    });
    rescheduleModal.hide();
    loadTournament();
  } catch (err) {
    alert(err.message);
  }
});

// Ввод результата матча
document.getElementById('resultForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const matchId = document.getElementById('matchId').value;
  const score1 = document.getElementById('score1').value;
  const score2 = document.getElementById('score2').value;
  const winnerId = document.getElementById('winnerId').value;
  try {
    await apiRequest('/matches/result', {
      method: 'PUT',
      body: JSON.stringify({ matchId, score1, score2, winnerId })
    });
    alert('Результат сохранён');
    loadTournament();
  } catch (err) {
    alert(err.message);
  }
});

// Запуск
loadTournament();