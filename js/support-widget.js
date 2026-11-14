(() => {
  if (window.__boxcellinkSupportLoaded) return;
  window.__boxcellinkSupportLoaded = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  // Load the widget stylesheet independently. The widget itself must remain
  // clickable even if Supabase is unavailable or still initializing.
  if (!document.querySelector('link[data-bc-support-style]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/css/support-widget.css';
    style.dataset.bcSupportStyle = '1';
    document.head.appendChild(style);
  }

  const path = (location.pathname || '').toLowerCase();
  if (/\/(admin|admin-vip|review-admin|telegram-admin|users|payments|support-inbox)(\.html)?\/?$/.test(path)) return;
  if (!document.body || document.getElementById('bc-support-root')) return;

  const groupUrl = 'https://t.me/+03WCfVAwaWUzZTkx';
  const channelUrl = window.BOXCELLINK_TELEGRAM_CHANNEL_URL || '';
  const root = document.createElement('div');
  root.id = 'bc-support-root';
  root.innerHTML = `
    <div class="bc-support-menu" id="bcSupportMenu" aria-hidden="true" inert>
      <a class="bc-support-choice bc-support-admin" href="#" id="bcSupportChat">
        <span class="bc-support-choice-icon"><i class="fa-solid fa-headset" aria-hidden="true"></i></span>
        <span>Chat Support Admin</span>
      </a>
      <a class="bc-support-choice bc-support-channel" href="${channelUrl ? esc(channelUrl) : '#'}" ${channelUrl ? 'target="_blank" rel="noopener noreferrer"' : 'aria-disabled="true"'}>
        <span class="bc-support-choice-icon"><i class="fa-brands fa-telegram" aria-hidden="true"></i></span>
        <span>Channel Telegram</span>
      </a>
      <a class="bc-support-choice bc-support-group" href="${groupUrl}" target="_blank" rel="noopener noreferrer">
        <span class="bc-support-choice-icon"><i class="fa-brands fa-telegram" aria-hidden="true"></i></span>
        <span>Group Chat Telegram</span>
      </a>
    </div>
    <button type="button" class="bc-support-toggle" id="bcSupportToggle" aria-label="Buka menu support" aria-expanded="false" aria-controls="bcSupportMenu">
      <i class="fa-solid fa-comments" aria-hidden="true"></i>
    </button>
    <section class="bc-support-chat" id="bcSupportPanel" aria-label="Chat Support Admin" aria-hidden="true" hidden>
      <header>
        <div><b><i class="fa-solid fa-headset" aria-hidden="true"></i> Chat Support Admin</b><small>Tim bantuan BoxCellink</small></div>
        <button type="button" id="bcSupportClose" aria-label="Tutup chat"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </header>
      <div class="bc-support-faq" id="bcSupportFaq" aria-label="Panduan BoxCellink"><b><i class="fa-solid fa-circle-question"></i> Pusat bantuan cepat</b><div id="bcSupportFaqChoices"></div><div id="bcSupportFaqAnswer" aria-live="polite"></div></div>
      <div class="bc-support-messages" id="bcSupportMessages" aria-live="polite">
        <div class="bc-support-empty">Memuat percakapan...</div>
      </div>
      <form id="bcSupportForm" hidden>
        <input id="bcSupportInput" maxlength="4000" placeholder="Tulis pesan..." autocomplete="off" required>
        <button type="submit" aria-label="Kirim pesan"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i></button>
      </form>
      <div class="bc-support-foot" id="bcSupportFoot"></div>
    </section>`;
  document.body.appendChild(root);

  const toggle = $('#bcSupportToggle', root);
  const menu = $('#bcSupportMenu', root);
  const panel = $('#bcSupportPanel', root);
  const chatLink = $('#bcSupportChat', root);
  const closeButton = $('#bcSupportClose', root);
  const form = $('#bcSupportForm', root);
  const input = $('#bcSupportInput', root);
  const messagesEl = $('#bcSupportMessages', root);
  const foot = $('#bcSupportFoot', root);
  const faqChoices=$('#bcSupportFaqChoices',root),faqAnswer=$('#bcSupportFaqAnswer',root);
  const faqGroups=[
    {title:'Mulai menggunakan BoxCellink',items:[
      ['Bagaimana cara bergabung BoxCellink?','Buka menu Daftar, isi data akun, lalu konfirmasi email jika diminta. Setelah berhasil, masuk menggunakan email dan kata sandi.'],
      ['Bagaimana cara saya mendaftar?','Pilih tombol Daftar pada navbar atau halaman utama, lengkapi formulir, lalu ikuti instruksi konfirmasi yang tampil.'],
      ['Bagaimana cara saya login?','Pilih Masuk, masukkan email dan kata sandi akun BoxCellink. Jika lupa kata sandi, gunakan tautan Lupa Kata Sandi.'],
      ['Bagaimana cara melihat Box Video?','Buka menu BoxVidey atau Box Video. Pilih kategori atau gunakan pencarian, lalu buka video yang ingin ditonton. Video publik dapat ditonton tanpa login; konten login/VIP mengikuti aturan aksesnya.'],
      ['Bagaimana cara mengakses Media Telegram?','Buka menu Media Telegram, cari judul atau kategori, lalu pilih Lihat Review. Ikuti informasi akses pada halaman review; tautan Telegram akan dibuka melalui alur yang tersedia.']
    ]},
    {title:'Penghasilan, referral & withdraw',items:[
      ['Bagaimana cara menghasilkan uang di BoxCellink?','Gunakan fitur Referral & Hadiah atau program afiliasi jika tersedia pada akun. Bagikan link referral secara wajar dan ikuti ketentuan program untuk memperoleh saldo/komisi.'],
      ['Bagaimana cara share referral?','Masuk ke menu Referral & Hadiah, salin link referral pribadi, lalu bagikan kepada teman. Perolehan hadiah mengikuti syarat referral yang ditampilkan di halaman tersebut.'],
      ['Bagaimana cara saya withdraw?','Ajukan atau lengkapi data afiliasi terlebih dahulu. Setelah status afiliasi disetujui dan saldo memenuhi batas minimum, buka Saldo & Afiliasi lalu kirim pengajuan withdraw.'],
      ['Bagaimana cara cek saldo referral?','Buka menu Saldo & Afiliasi atau Referral & Hadiah untuk melihat saldo, komisi, dan riwayat yang tersedia.']
    ]},
    {title:'Pembayaran & bantuan akun',items:[
      ['Bagaimana cara saya membayar?','Pilih paket atau media yang ingin dibeli, lanjutkan ke checkout, lalu bayar menggunakan QR/metode yang ditampilkan. Tunggu status pembayaran terverifikasi sebelum menutup halaman.'],
      ['Bagaimana cara konsultasi dengan admin?','Pilih Chat Support Admin pada tombol bantuan. Login diperlukan agar percakapan tersimpan dan admin dapat membalasnya.'],
      ['Bagaimana cara support admin?','Gunakan Chat Support Admin untuk mengirim pertanyaan atau laporan. Sertakan judul halaman dan pesan error agar admin lebih mudah membantu.'],
      ['Bagaimana cara gabung Telegram resmi?','Gunakan tautan Grup/Channel Telegram resmi yang tersedia di halaman Media Telegram atau pemberitahuan komunitas. Pastikan tautannya berasal dari website BoxCellink.']
    ]}
  ];
  function renderFaq(groupIndex=null){
    if(!faqChoices)return;
    faqAnswer.textContent='';
    if(groupIndex===null){faqChoices.innerHTML=faqGroups.map((g,i)=>`<button type="button" data-faq-group="${i}">${esc(g.title)} <i class="fa-solid fa-chevron-right"></i></button>`).join('');return;}
    const g=faqGroups[groupIndex];faqChoices.innerHTML=`<button type="button" data-faq-back="1"><i class="fa-solid fa-arrow-left"></i> Kembali</button>`+g.items.map((item,i)=>`<button type="button" data-faq-question="${i}" data-faq-group="${groupIndex}">${esc(item[0])}</button>`).join('');
  }
  renderFaq();
  faqChoices?.addEventListener('click',event=>{
    const group=event.target.closest('[data-faq-group]'),question=event.target.closest('[data-faq-question]'),back=event.target.closest('[data-faq-back]');
    if(back){renderFaq();return;}
    if(question){const item=faqGroups[Number(question.dataset.faqGroup)]?.items[Number(question.dataset.faqQuestion)];if(item)faqAnswer.innerHTML=`<b>${esc(item[0])}</b><p>${esc(item[1])}</p><button type="button" data-faq-back="1">Pilih pertanyaan lain</button>`;return;}
    if(group)renderFaq(Number(group.dataset.faqGroup));
  });

  const closeMenu = () => {
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    menu.inert = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Buka menu support');
    toggle.innerHTML = '<i class="fa-solid fa-comments" aria-hidden="true"></i>';
  };
  const openMenu = () => {
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    menu.inert = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Tutup menu support');
    toggle.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
  };
  const closeChat = () => {
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    closeMenu();
    toggle.focus({ preventScroll: true });
  };

  let currentUser = null;
  let conversation = null;
  let busy = false;
  let refreshTimer = null;
  let loadingChat = false;

  toggle.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    if (!panel.hidden) {
      closeChat();
      return;
    }
    if (menu.classList.contains('is-open')) closeMenu();
    else openMenu();
  });

  chatLink.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    messagesEl.innerHTML = '<div class="bc-support-empty">Menghubungkan ke layanan bantuan...</div>';
    await loadChat();
  });

  closeButton.addEventListener('click', closeChat);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!panel.hidden) closeChat();
      else closeMenu();
    }
  });
  document.addEventListener('click', event => {
    if (!root.contains(event.target) && menu.classList.contains('is-open')) closeMenu();
  });

  function showLoginPrompt() {
    form.hidden = true;
    messagesEl.innerHTML = '<div class="bc-support-empty"><strong>Masuk untuk menghubungi admin</strong><br>Silakan login ke akun BoxCellink agar percakapan bantuan tersimpan dan dapat dibalas oleh tim admin.</div>';
    foot.innerHTML = '<a href="/login.html?next=' + encodeURIComponent(location.pathname + location.search) + '">Masuk ke akun</a>';
  }

  function showServiceError(message) {
    form.hidden = true;
    messagesEl.innerHTML = '<div class="bc-support-empty">' + esc(message) + '</div>';
    foot.textContent = 'Silakan muat ulang halaman atau hubungi admin melalui grup Telegram.';
  }

  async function loadChat() {
    if (loadingChat) return;
    loadingChat = true;
    try {
      const client = window.sb;
      if (!client?.auth?.getUser || typeof client.from !== 'function') {
        showServiceError('Layanan chat belum terhubung. Silakan coba beberapa saat lagi.');
        return;
      }
      const { data: authData, error: authError } = await client.auth.getUser();
      currentUser = authData?.user || null;
      if (authError || !currentUser) {
        showLoginPrompt();
        return;
      }

      form.hidden = false;
      foot.textContent = 'Pesan hanya dapat dilihat oleh Anda dan admin.';
      const { data: rows, error: findError } = await client
        .from('support_conversations')
        .select('id,status')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (findError) {
        showServiceError('Fitur chat belum siap. Pastikan migrasi SQL Support Chat sudah dijalankan di Supabase.');
        console.error('Support conversation lookup failed:', findError);
        return;
      }

      conversation = rows?.[0] || null;
      if (!conversation) {
        const { data: newRow, error: createError } = await client
          .from('support_conversations')
          .insert({ user_id: currentUser.id, subject: 'Chat Support' })
          .select('id,status')
          .single();
        if (createError) {
          showServiceError('Tidak dapat memulai chat. Periksa izin tabel Support Chat di Supabase.');
          console.error('Support conversation creation failed:', createError);
          return;
        }
        conversation = newRow;
      }

      await renderMessages();
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(() => {
        if (!panel.hidden) renderMessages();
      }, 7000);
    } catch (error) {
      console.error('Support chat initialization failed:', error);
      showServiceError('Terjadi kendala saat membuka chat. Silakan coba lagi.');
    } finally {
      loadingChat = false;
    }
  }

  async function renderMessages() {
    if (!conversation || !currentUser || !window.sb?.from) return;
    try {
      const { data, error } = await window.sb
        .from('support_messages')
        .select('id,sender_id,body,created_at,edited_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });
      if (error) {
        console.warn('Support messages load failed:', error);
        return;
      }
      if (!data?.length) {
        messagesEl.innerHTML = '<div class="bc-support-empty">Belum ada pesan. Silakan sampaikan kebutuhan bantuan Anda.</div>';
        return;
      }
      messagesEl.innerHTML = data.map(message => `
        <div class="bc-support-bubble ${message.sender_id === currentUser.id ? 'mine' : 'theirs'}">
          <div>${esc(message.body)}</div>
          <small>${message.sender_id === currentUser.id ? 'Anda' : 'Admin'} · ${new Date(message.created_at).toLocaleString('id-ID')}${message.edited_at ? ' · diedit' : ''}</small>
        </div>`).join('');
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch (error) {
      console.warn('Support message rendering failed:', error);
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !conversation || !currentUser || !window.sb?.from) return;
    const body = input.value.trim();
    if (!body) return;
    busy = true;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const { error } = await window.sb.from('support_messages').insert({
        conversation_id: conversation.id,
        sender_id: currentUser.id,
        body
      });
      if (error) {
        foot.textContent = 'Pesan gagal dikirim. Silakan coba lagi.';
        console.error('Support message send failed:', error);
      } else {
        input.value = '';
        await renderMessages();
      }
    } catch (error) {
      foot.textContent = 'Pesan gagal dikirim. Silakan coba lagi.';
      console.error('Support message send exception:', error);
    } finally {
      button.disabled = false;
      busy = false;
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !panel.hidden) renderMessages();
  });
})();
