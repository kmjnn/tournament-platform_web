document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = 'dashboard.html';
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nickname = document.getElementById('nickname').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;
  try {
    await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nickname, email, password, role })
    });
    alert('Registered! Now log in.');
    window.location.href = 'login.html';
  } catch (err) {
    alert(err.message);
  }
});