// create-tournament.html
if (!localStorage.getItem('token')) {
  window.location.href = 'login.html';
}

document.getElementById('createForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  data.minTeams = parseInt(data.minTeams);
  data.maxTeams = parseInt(data.maxTeams);
  try {
    await apiRequest('/tournaments', { method: 'POST', body: JSON.stringify(data) });
    alert('Турнир создан');
    window.location.href = 'dashboard.html';
  } catch (err) {
    alert(err.message);
  }
});

// Показать/скрыть поля в зависимости от типа турнира
document.getElementById('type')?.addEventListener('change', function() {
  const esportsFields = document.getElementById('esportsFields');
  const sportsFields = document.getElementById('sportsFields');
  if (this.value === 'esports') {
    esportsFields.style.display = 'block';
    sportsFields.style.display = 'none';
  } else if (this.value === 'sports') {
    esportsFields.style.display = 'none';
    sportsFields.style.display = 'block';
  } else {
    esportsFields.style.display = 'none';
    sportsFields.style.display = 'none';
  }
});