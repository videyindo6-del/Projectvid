import { mountNavbar } from '../components/navbar.js';
mountNavbar('login');
import { sb } from '../js/config.js';
const form = document.getElementById('loginForm');
const msg = document.getElementById('message');
form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { msg.textContent = error.message; return; }
  const { data: profile } = await sb.from('profiles').select('role').eq('id', data.user.id).single();
  location.href = profile?.role === 'admin' ? '../admin/index.html' : '../index.html';
});
