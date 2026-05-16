const urlParams = new URLSearchParams(window.location.search);
const tournamentId = urlParams.get('id');
let currentUser = JSON.parse(localStorage.getItem('user') || '{}');

function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

async function loadTournament() {
    try {
        const tournament = await apiRequest(`/tournaments/${tournamentId}`);

        document.getElementById('title').textContent = tournament.title;
        document.getElementById('status').textContent = tournament.status;
        document.getElementById('tournamentDetails').style.display = 'block';
        document.getElementById('game').textContent = tournament.game;
        document.getElementById('type').textContent = tournament.type === 'esports' ? 'Киберспорт' : 'Спорт';
        document.getElementById('format').textContent = {
            single_elim: 'Single Elimination',
            double_elim: 'Double Elimination',
            round_robin: 'Round Robin'
        }[tournament.format] || tournament.format;
        document.getElementById('description').textContent = tournament.description || '—';
        document.getElementById('startDate').textContent = tournament.start_date
            ? new Date(tournament.start_date).toLocaleString() : '—';
        document.getElementById('deadline').textContent = tournament.registration_deadline
            ? new Date(tournament.registration_deadline).toLocaleString() : '—';
        document.getElementById('maxTeams').textContent = tournament.max_teams;

        const extraDiv = document.getElementById('extraFields');
        extraDiv.innerHTML = '';
        if (tournament.type === 'esports') {
            if (tournament.platform) {
                extraDiv.appendChild(createFieldElement('Платформа', tournament.platform));
            }
            if (tournament.server) {
                extraDiv.appendChild(createFieldElement('Сервер', tournament.server));
            }
            if (tournament.discord_link) {
                const div = document.createElement('div');
                div.innerHTML = `Discord: <a href="${escapeHtml(tournament.discord_link)}" target="_blank">${escapeHtml(tournament.discord_link)}</a>`;
                extraDiv.appendChild(div);
            }
        }

        // Загрузка команд
        const teams = await apiRequest(`/tournaments/${tournamentId}/teams`);
        document.getElementById('teamsCount').textContent = teams.length;

        if (teams.length > 0) {
            const teamsContainer = document.createElement('div');
            teamsContainer.innerHTML = '<p>Команды-участники:</p>';
            const list = document.createElement('ul');
            teams.forEach(t => {
                const li = document.createElement('li');
                li.textContent = `${t.name} (капитан: ${t.captain_nickname})`;
                list.appendChild(li);
            });
            teamsContainer.appendChild(list);
            extraDiv.appendChild(teamsContainer);
        } else {
            const p = document.createElement('p');
            p.textContent = 'Команд-участников пока нет';
            extraDiv.appendChild(p);
        }

        // === СТРОГАЯ ПРОВЕРКА: ОРГАНИЗАТОР? ===
        const isOrganizer = (currentUser.id === tournament.created_by);

        // Блок статуса заявки для участника (только для авторизованных)
        if (currentUser.id && !isOrganizer) {
            await loadMyRequestStatus(tournament);
        }

        // Секция регистрации (только для участников и если регистрация открыта)
        if (tournament.status === 'registration_open' && !isOrganizer && currentUser.role === 'participant') {
            document.getElementById('registrationSection').style.display = 'block';
        }

        // Секция управления для организатора
        if (isOrganizer) {
            document.getElementById('organizerSection').style.display = 'block';
            if (tournament.status === 'registration_open' || tournament.status === 'registration_closed') {
                document.getElementById('startBracketBtn').style.display = 'inline-block';
            }
            const requests = await apiRequest(`/tournaments/${tournamentId}/requests`);
            renderRequests(requests);
        }

        // Сетка матчей
        if (tournament.status === 'in_progress' || tournament.status === 'finished') {
            const matches = await apiRequest(`/tournaments/${tournamentId}/matches`);
            renderBracket(matches);
            document.getElementById('bracketSection').style.display = 'block';
            // Ввод результатов только для организатора
            if (isOrganizer || currentUser.role === 'organizer') {
                document.getElementById('resultSection').style.display = 'block';
            }
        }
    } catch (err) {
        console.error('Ошибка загрузки турнира:', err);
        alert('Ошибка: ' + err.message);
    }
}

async function loadMyRequestStatus(tournament) {
    const statusContainer = document.getElementById('myRequestStatus');
    if (!statusContainer) return;

    try {
        const requests = await apiRequest(`/tournaments/${tournamentId}/my-requests`);
        statusContainer.innerHTML = '';

        if (requests.length === 0) {
            if (tournament.status === 'registration_open') {
                statusContainer.innerHTML = '<p class="text-muted">Вы ещё не подали заявку.</p>';
            }
            return;
        }

        const req = requests[0];
        let statusHtml = '';
        let alertClass = '';

        switch (req.status) {
            case 'pending':
                statusHtml = '⏳ Ваша заявка на рассмотрении.';
                alertClass = 'alert-info';
                break;
            case 'approved':
                statusHtml = '✅ Ваша заявка <strong>одобрена</strong>!';
                alertClass = 'alert-success';
                break;
            case 'rejected':
                statusHtml = '❌ Ваша заявка отклонена.';
                alertClass = 'alert-danger';
                break;
            default:
                statusHtml = `Статус: ${escapeHtml(req.status)}`;
                alertClass = 'alert-secondary';
        }

        statusContainer.innerHTML = `<div class="alert ${alertClass}">${statusHtml}</div>`;
    } catch (err) {
        console.error('Ошибка загрузки статуса заявки:', err);
    }
}

function createFieldElement(label, value) {
    const div = document.createElement('div');
    div.textContent = `${label}: ${value}`;
    return div;
}

function renderBracket(matches) {
    const container = document.getElementById('bracket');
    container.innerHTML = '';
    matches.forEach(m => {
        const matchDiv = document.createElement('div');
        matchDiv.className = 'match-item';
        matchDiv.innerHTML = `
            <p>Раунд ${m.round}: Команда ${escapeHtml(String(m.team1_id))} vs Команда ${m.team2_id ? escapeHtml(String(m.team2_id)) : 'BYE'}</p>
            <p>Счёт: ${m.score1 ?? '-'} : ${m.score2 ?? '-'} ${m.winner_id ? `| Победитель: ${escapeHtml(String(m.winner_id))}` : ''}</p>
            <p>${escapeHtml(m.status)}</p>
        `;
        container.appendChild(matchDiv);
    });
}

function renderRequests(requests) {
    const container = document.getElementById('requestsList');
    container.innerHTML = '';

    if (requests.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'Нет заявок';
        container.appendChild(p);
        return;
    }

    requests.forEach(r => {
        const requestDiv = document.createElement('div');
        requestDiv.className = 'request-item';
        requestDiv.innerHTML = `
            <p>От: ${escapeHtml(r.user_nickname)} (${escapeHtml(r.type)})</p>
            <p>Статус: ${escapeHtml(r.status)}</p>
            ${r.status === 'pending' ?
                `<button class="approve-btn" data-id="${r.id}">Одобрить</button>
                 <button class="reject-btn" data-id="${r.id}">Отклонить</button>`
                : ''}
        `;
        container.appendChild(requestDiv);
    });

    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            await apiRequest(`/requests/${id}/approve`, { method: 'PUT' });
            loadTournament();
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

// === Обработчики формы регистрации (доступны всем, но скрыты для организатора) ===
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

document.getElementById('regType')?.addEventListener('change', function() {
    const teamNameGroup = document.getElementById('teamNameGroup');
    if (teamNameGroup) {
        teamNameGroup.style.display = this.value === 'team' ? 'block' : 'none';
    }
});

// Генерация сетки (обработчик, но кнопка видна только организатору)
document.getElementById('startBracketBtn')?.addEventListener('click', async () => {
    try {
        await apiRequest(`/tournaments/${tournamentId}/start-bracket`, { method: 'POST' });
        alert('Сетка сгенерирована');
        loadTournament();
    } catch (err) {
        alert(err.message);
    }
});

// Модальное окно переноса (только организатор)
let rescheduleModal;
document.addEventListener('DOMContentLoaded', () => {
    const modalEl = document.getElementById('rescheduleModal');
    if (modalEl) {
        rescheduleModal = new bootstrap.Modal(modalEl);
    }
});

document.getElementById('rescheduleBtn')?.addEventListener('click', () => {
    rescheduleModal?.show();
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
        rescheduleModal?.hide();
        loadTournament();
    } catch (err) {
        alert(err.message);
    }
});

// Ввод результата (обработчик, секция видна только организатору)
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

loadTournament();