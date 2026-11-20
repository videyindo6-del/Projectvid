(() => {
  const form = document.getElementById('loginForm');
  if (!form) return;
  const toast = document.getElementById('toast');
  const loginInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const consent = document.getElementById('loginConsent');
  const submit = document.getElementById('loginSubmit');
  const savedKey = 'boxcellink_saved_accounts';
  const t = id => window.BoxI18n?.t(id) || id;
  const notify = (message, type = 'success') => {
    if (!toast) return;
    toast.className = `toast show ${type}`;
    toast.replaceChildren();
    const icon = document.createElement('i'); icon.className = `fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`;
    const text = document.createElement('span'); text.textContent = String(message ?? '');
    toast.append(icon, text); clearTimeout(window.__toast); window.__toast = setTimeout(() => toast.classList.remove('show'), 3200);
  };
  const readAccounts = () => { try { const a = JSON.parse(localStorage.getItem(savedKey) || '[]'); return Array.isArray(a) ? a.filter(x => x && typeof x.email === 'string').slice(0, 5) : []; } catch { return []; } };
  const writeAccounts = list => { try { localStorage.setItem(savedKey, JSON.stringify(list.slice(0, 5))); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const saved = document.getElementById('savedAccounts');
  const refreshButton = () => { submit.disabled = !(loginInput.value.trim() && passwordInput.value && consent.checked); };
  function renderAccounts() {
    const accounts = readAccounts();
    if (!saved || !accounts.length) { if (saved) saved.hidden = true; return; }
    saved.hidden = false;
    saved.innerHTML = `<div class="saved-title"><i class="fa-regular fa-clock"></i> Akun yang pernah digunakan di perangkat ini</div>` + accounts.map(account => `
      <button type="button" class="saved-account" data-email="${esc(account.email)}" data-username="${esc(account.username || '')}">
        <span class="saved-avatar">${esc((account.name || account.username || account.email).charAt(0).toUpperCase())}</span>
        <span class="saved-account-info"><strong>${esc(account.name || account.username || 'Akun BoxCellink')}</strong><small>${esc(account.username ? '@' + account.username + ' · ' : '')}${esc(account.email)}</small></span>
        <i class="fa-solid fa-chevron-right saved-chevron"></i>
      </button>`).join('');
    saved.querySelectorAll('.saved-account').forEach(button => button.addEventListener('click', () => {
      loginInput.value = button.dataset.username || button.dataset.email;
      passwordInput.value = '';
      refreshButton();
      passwordInput.focus();
    }));
  }
  renderAccounts();
  const prefill = localStorage.getItem('boxcellink_login_email');
  if (prefill) { loginInput.value = prefill; localStorage.removeItem('boxcellink_login_email'); }
  document.querySelectorAll('.password-toggle').forEach(button => button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.target); const icon = button.querySelector('i');
    const show = input.type === 'password'; input.type = show ? 'text' : 'password';
    icon.className = `fa-regular ${show ? 'fa-eye-slash' : 'fa-eye'}`;
  }));
  [loginInput, passwordInput].forEach(input => input.addEventListener('input', refreshButton));
  consent.addEventListener('change', refreshButton);
  refreshButton();

  const deviceId = () => {
    try { let id = localStorage.getItem('boxcellink_device_id'); if (!id) { id = crypto?.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem('boxcellink_device_id', id); } return id; }
    catch { return 'browser-session'; }
  };
  const deviceLabel = () => {
    const ua = navigator.userAgent || '';
    const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Device';
    return `${browser} · ${os}`;
  };
  async function resolveLoginIdentifier(identifier) {
    if (identifier.includes('@')) return identifier.toLowerCase();
    // Username is the preferred non-email identifier.
    try {
      const { data, error } = await window.sb.from('profiles').select('email,username,full_name').ilike('username', identifier).limit(1).maybeSingle();
      if (!error && data?.email) return data.email;
    } catch (error) { console.warn('Username lookup unavailable:', error); }
    // Keep compatibility with accounts created before username registration existed.
    const { data, error } = await window.sb.from('profiles').select('email,username,full_name').ilike('full_name', identifier).limit(1).maybeSingle();
    if (error) throw error;
    if (!data?.email) throw new Error('Username atau nama tidak ditemukan. Coba gunakan Gmail yang terdaftar.');
    return data.email;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!loginInput.value.trim() || !passwordInput.value || !consent.checked) { refreshButton(); return; }
    if (!window.sb?.auth) { notify('Supabase belum dikonfigurasi. Periksa js/config.js.', 'error'); return; }
    const original = submit.innerHTML; submit.disabled = true; submit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Memeriksa akun…</span>';
    try {
      const identifier = loginInput.value.trim();
      const email = await resolveLoginIdentifier(identifier);
      const { data, error } = await window.sb.auth.signInWithPassword({ email, password: passwordInput.value });
      if (error) throw error;
      const { data: profile, error: profileError } = await window.sb.from('profiles').select('role,full_name,username,email,is_banned').eq('id', data.user.id).maybeSingle();
      if (profileError) console.warn('Profile details unavailable:', profileError);
      if (profile?.is_banned) { await window.sb.auth.signOut(); throw new Error('Akun ini sedang dibatasi oleh admin.'); }
      try { await window.sb.rpc('record_account_login', { p_device_id: deviceId(), p_device_label: deviceLabel(), p_user_agent: navigator.userAgent || '' }); }
      catch (deviceError) { console.warn('Account device history unavailable:', deviceError); }
      const accounts = readAccounts().filter(account => account.email.toLowerCase() !== email.toLowerCase());
      accounts.unshift({ name: profile?.full_name || data.user.user_metadata?.full_name || identifier, username: profile?.username || data.user.user_metadata?.username || '', email });
      writeAccounts(accounts);
      notify('Berhasil masuk. Mengarahkan ke dashboard…');
      const requested = new URLSearchParams(location.search).get('next') || '';
      const safeNext = requested.startsWith('/') && !requested.startsWith('//') && !/^\/(login|register|forgot-password)(\.html)?([/?]|$)/i.test(requested) ? requested : null;
      const fallback = profile?.role === 'admin' ? '/admin.html' : '/dashboard.html';
      setTimeout(() => location.replace(safeNext || fallback), 450);
    } catch (error) {
      notify(error?.message || t('loginFailed'), 'error');
      submit.disabled = false;
    } finally {
      submit.innerHTML = original;
      refreshButton();
    }
  });
})();
