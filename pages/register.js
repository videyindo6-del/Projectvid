import { mountNavbar } from '../components/navbar.js';
mountNavbar('register');
import { sb } from '../js/config.js';
const form = document.getElementById('registerForm');
const msg = document.getElementById('message');
form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fullName = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const { error } = await sb.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  msg.textContent = error ? error.message : 'Akun dibuat. Jika konfirmasi email aktif, periksa inbox lalu masuk.';
});
