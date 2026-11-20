(() => {
  const form = document.getElementById('registerForm');
  if (!form) return;
  const toast = document.getElementById('toast');
  const registerView = document.getElementById('registerView');
  const successView = document.getElementById('successView');
  const usernameInput = document.getElementById('username');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirmPassword');
  const consent = document.getElementById('registerConsent');
  const submit = document.getElementById('registerSubmit');
  const savedKey = 'boxcellink_saved_accounts';
  const makeRecoveryCode = () => { const bytes = new Uint8Array(10); crypto.getRandomValues(bytes); return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase().match(/.{1,4}/g).join('-'); };
  let hasSession = false;
  const notify = (message, type = 'success') => {
    if (!toast) return;
    toast.className = `toast show ${type}`; toast.replaceChildren();
    const icon = document.createElement('i'); icon.className = `fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`;
    const text = document.createElement('span'); text.textContent = String(message ?? ''); toast.append(icon, text);
    clearTimeout(window.__toast); window.__toast = setTimeout(() => toast.classList.remove('show'), 3500);
  };
  const setFeedback = (element, text, state = '') => { element.textContent = text; element.className = `validation-message ${state}`; };
  const usernameValid = () => /^[a-z0-9_.]{3,24}$/.test(usernameInput.value.trim().toLowerCase());
  function passwordStrength(value) {
    if (!value) return { score: 0, label: 'Belum diisi', state: '' };
    let score = 0;
    if (value.length >= 8) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    if (value.length >= 12) score++;
    if (value.length < 8 || score <= 1) return { score: 1, label: 'Lemah', state: 'weak' };
    if (score <= 3) return { score: 2, label: 'Sedang', state: 'medium' };
    return { score: 3, label: 'Kuat', state: 'strong' };
  }
  function updateStrength() {
    const result = passwordStrength(passwordInput.value);
    document.querySelector('.strength-bars')?.setAttribute('data-strength', result.state);
    document.getElementById('strengthLabel').textContent = result.label;
    document.getElementById('strengthLabel').className = result.state;
    document.getElementById('passwordFeedback').textContent = passwordInput.value.length && passwordInput.value.length < 8 ? 'Kata sandi terlalu pendek. Gunakan minimal 8 karakter.' : 'Gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol agar lebih kuat.';
    document.getElementById('passwordFeedback').className = `field-hint ${result.state}`;
  }
  function updateConfirm() {
    const feedback = document.getElementById('confirmFeedback');
    const wrap = confirmInput.closest('.input-shell');
    if (!confirmInput.value) { setFeedback(feedback, 'Ulangi kata sandi yang sama.', ''); wrap.classList.remove('is-valid', 'is-invalid'); }
    else if (confirmInput.value !== passwordInput.value) { setFeedback(feedback, 'Kata sandi belum cocok.', 'invalid'); wrap.classList.add('is-invalid'); wrap.classList.remove('is-valid'); }
    else { setFeedback(feedback, 'Kata sandi cocok.', 'valid'); wrap.classList.add('is-valid'); wrap.classList.remove('is-invalid'); }
  }
  function updateUsername() {
    const value = usernameInput.value.trim().toLowerCase(); const feedback = document.getElementById('usernameFeedback');
    if (!value) { setFeedback(feedback, '', ''); usernameInput.closest('.input-shell').classList.remove('is-valid', 'is-invalid'); return; }
    if (!usernameValid()) { setFeedback(feedback, 'Username 3–24 karakter: huruf kecil, angka, titik, atau garis bawah.', 'invalid'); usernameInput.closest('.input-shell').classList.add('is-invalid'); usernameInput.closest('.input-shell').classList.remove('is-valid'); }
    else { setFeedback(feedback, 'Format username valid.', 'valid'); usernameInput.closest('.input-shell').classList.add('is-valid'); usernameInput.closest('.input-shell').classList.remove('is-invalid'); }
  }
  function validateForm() {
    const emailValid = emailInput.validity.valid && emailInput.value.trim().length > 0;
    const nameValid = nameInput.value.trim().length >= 2;
    const passValid = passwordInput.value.length >= 8;
    const confirmValid = confirmInput.value.length > 0 && confirmInput.value === passwordInput.value;
    submit.disabled = !(usernameValid() && nameValid && emailValid && passValid && confirmValid && consent.checked);
  }
  [usernameInput, nameInput, emailInput, passwordInput, confirmInput].forEach(input => input.addEventListener('input', () => {
    if (input === usernameInput) { usernameInput.value = usernameInput.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''); updateUsername(); }
    if (input === passwordInput) { updateStrength(); updateConfirm(); }
    if (input === confirmInput) updateConfirm();
    validateForm();
  }));
  consent.addEventListener('change', validateForm);
  document.querySelectorAll('.password-toggle').forEach(button => button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.target); const icon = button.querySelector('i');
    const show = input.type === 'password'; input.type = show ? 'text' : 'password'; icon.className = `fa-regular ${show ? 'fa-eye-slash' : 'fa-eye'}`;
  }));
  updateStrength(); updateConfirm(); validateForm();

  form.addEventListener('submit', async event => {
    event.preventDefault();
    updateUsername(); updateConfirm(); validateForm();
    if (submit.disabled) return;
    if (!window.sb?.auth) { notify('Koneksi Supabase belum tersedia. Periksa konfigurasi js/config.js.', 'error'); return; }
    const username = usernameInput.value.trim().toLowerCase();
    const name = nameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const referralCode = (new URLSearchParams(location.search).get('ref') || localStorage.getItem('boxcellink_affiliate_code') || '').trim().toUpperCase();
    const original = submit.innerHTML; submit.disabled = true; submit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Membuat akun…</span>';
    try {
      // Fast feedback only; the unique database index remains the authoritative check.
      try {
        const { data: existing, error: lookupError } = await window.sb.from('profiles').select('id').ilike('username', username).limit(1).maybeSingle();
        if (!lookupError && existing?.id) throw new Error('Username sudah digunakan. Silakan pilih username lain.');
      } catch (lookupError) { if (lookupError?.message?.includes('Username sudah digunakan')) throw lookupError; }
      const { data, error } = await window.sb.auth.signUp({
        email, password,
        options: { data: { full_name: name, username, referral_code: referralCode || null } }
      });
      if (error) throw error;
      hasSession = !!data?.session;
      const recoveryCode = makeRecoveryCode();
      if (!hasSession) throw new Error('Supabase belum membuat sesi otomatis. Pastikan Confirm Email dinonaktifkan sebelum pendaftaran.');
      const { error: recoveryError } = await window.sb.rpc('set_my_recovery_code', { p_recovery_code: recoveryCode });
      if (recoveryError) throw new Error('Akun dibuat, tetapi kode pemulihan gagal disimpan. Hubungi admin sebelum keluar: ' + recoveryError.message);
      document.getElementById('recoveryCodeDisplay').textContent = recoveryCode;
      try {
        const accounts = JSON.parse(localStorage.getItem(savedKey) || '[]');
        const clean = (Array.isArray(accounts) ? accounts : []).filter(account => account && account.email?.toLowerCase() !== email);
        clean.unshift({ name, username, email }); localStorage.setItem(savedKey, JSON.stringify(clean.slice(0, 5)));
        localStorage.setItem('boxcellink_login_email', username);
      } catch (storageError) { console.warn('Local account shortcut could not be saved:', storageError); }
      document.getElementById('successAvatar').textContent = name.charAt(0).toUpperCase();
      document.getElementById('successName').textContent = name;
      document.getElementById('successFullName').textContent = name;
      document.getElementById('successUsername').textContent = `@${username}`;
      document.getElementById('successEmail').textContent = email;
      registerView.hidden = true; successView.hidden = false;
      const note = document.getElementById('successNote');
      note.textContent = hasSession ? 'Akunmu siap digunakan. Tekan Selesai untuk membuka dashboard.' : 'Akun berhasil dibuat. Jika verifikasi email diaktifkan, buka email konfirmasi terlebih dahulu sebelum login.';
      notify('Akun berhasil dibuat. Simpan ringkasan akunmu.', 'success');
      successView.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      notify(error?.message || 'Pendaftaran gagal. Periksa data dan coba kembali.', 'error');
    } finally {
      submit.innerHTML = original; validateForm();
    }
  });

  document.getElementById('screenshotBtn')?.addEventListener('click', async () => {
    const card = document.getElementById('accountCard');
    try {
      if (!window.html2canvas) throw new Error('Fitur screenshot belum tersedia.');
      const canvas = await window.html2canvas(card, { backgroundColor: '#ffffff', scale: Math.min(2, window.devicePixelRatio || 2), useCORS: true, logging: false });
      const link = document.createElement('a'); link.download = 'BoxCellink-Ringkasan-Akun.png'; link.href = canvas.toDataURL('image/png'); link.click();
      notify('Screenshot ringkasan akun berhasil disimpan.');
    } catch (error) { notify('Screenshot otomatis gagal. Gunakan fitur screenshot perangkat pada kartu akun.', 'error'); }
  });
  document.getElementById('doneBtn')?.addEventListener('click', async () => {
    if (hasSession) { location.replace('/dashboard.html'); return; }
    try {
      const { data } = await window.sb.auth.getSession();
      if (data?.session) { location.replace('/dashboard.html'); return; }
    } catch {}
    const identifier = document.getElementById('successUsername').textContent.replace(/^@/, '');
    try { localStorage.setItem('boxcellink_login_email', identifier); } catch {}
    location.replace('/login.html?registered=1');
  });
})();
