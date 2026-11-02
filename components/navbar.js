const links = [
  ['index.html', 'Boxcell Videy', 'home'],
  ['pages/telegram.html', 'Code Bot Telegram', 'telegram'],
  ['pages/telegram.html#review', 'Review', 'review'],
  ['pages/telegram.html#download', 'Link Download', 'download'],
  ['pages/login.html', 'Masuk', 'login'],
  ['pages/register.html', 'Daftar', 'register']
];

export function mountNavbar(active = '') {
  const root = document.querySelector('[data-site-navbar]');
  if (!root) return;
  const base = root.dataset.base || './';
  root.innerHTML = `
    <header class="site-head">
      <a class="brand" href="${base}index.html"><b>B</b> Boxcellink</a>
      <nav aria-label="Navigasi utama">
        ${links.map(([href, label, key]) => `<a class="${active === key ? 'active' : ''} ${key === 'register' ? 'btn primary' : ''}" href="${base}${href}">${label}</a>`).join('')}
      </nav>
    </header>`;
}
