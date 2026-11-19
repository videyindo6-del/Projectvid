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

  // Render the three community shortcuts independently of Supabase.
  // Links are read from /js/community-links-config.js; icons remain visible
  // even while that file is loading or a link has not been configured.
  const mountCommunityDock = () => {
    if (document.getElementById('bc-community-dock')) return;
    const items = [
      { key: 'telegram', icon: 'fa-brands fa-telegram', label: 'Telegram' },
      { key: 'whatsapp', icon: 'fa-brands fa-whatsapp', label: 'WhatsApp' },
      { key: 'youtube', icon: 'fa-brands fa-youtube', label: 'YouTube' }
    ];
    const dock = document.createElement('nav');
    dock.id = 'bc-community-dock';
    dock.setAttribute('aria-label', 'Link komunitas resmi');
    dock.innerHTML = items.map(item =>
      `<a class="bc-community-icon ${item.key} is-unconfigured" href="#" aria-label="${item.label}" title="${item.label}" aria-disabled="true"><i class="${item.icon}" aria-hidden="true"></i></a>`
    ).join('');
    dock.addEventListener('click', event => {
      const link = event.target.closest('a[aria-disabled="true"]');
      if (link) event.preventDefault();
    });
    document.body.appendChild(dock);

    const applyLinks = () => {
      const config = window.BOXCELLINK_COMMUNITY_LINKS || {};
      items.forEach(item => {
        const anchor = dock.querySelector(`.${item.key}`);
        const raw = String(config[item.key]?.url || '').trim();
        let href = '';
        try {
          const parsed = new URL(raw);
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') href = parsed.href;
        } catch (_) {}
        if (href) {
          anchor.href = href;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          anchor.classList.remove('is-unconfigured');
          anchor.removeAttribute('aria-disabled');
          anchor.title = config[item.key]?.label || `Buka ${item.label}`;
          anchor.setAttribute('aria-label', anchor.title);
        } else {
          anchor.removeAttribute('target');
          anchor.removeAttribute('rel');
          anchor.href = '#';
          anchor.classList.add('is-unconfigured');
          anchor.setAttribute('aria-disabled', 'true');
        }
      });
    };

    applyLinks();
    const ensureConfig = () => {
      if (window.BOXCELLINK_COMMUNITY_LINKS) { applyLinks(); return; }
      const existing = document.querySelector('script[data-bc-community-config]');
      if (existing) { existing.addEventListener('load', applyLinks, { once: true }); return; }
      const script = document.createElement('script');
      script.src = '/js/community-links-config.js?v=20261118-3';
      script.dataset.bcCommunityConfig = '1';
      script.onload = applyLinks;
      script.onerror = () => console.warn('Community link config gagal dimuat:', script.src);
      document.head.appendChild(script);
    };
    ensureConfig();
    // Re-apply after all page scripts have initialized; this also repairs cached old widget instances.
    window.addEventListener('load', ensureConfig, { once: true });
  };

  const root = document.createElement('div');
  root.id = 'bc-support-root';
  root.innerHTML = `
    <button type="button" class="bc-support-toggle" id="bcSupportToggle" aria-label="Buka Chat Support" aria-expanded="false" aria-controls="bcSupportPanel">
      <i class="fa-solid fa-headset" aria-hidden="true"></i>
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
  mountCommunityDock();
  document.body.appendChild(root);
  // Community notifications for the support widget, configured in Admin > Link & Notifikasi.
  (async () => {
    try {
      if (!window.sb) return;
      const { data, error } = await sb.from('site_link_settings').select('value')
        .eq('key', 'notice_widget').maybeSingle();
      if (error) throw error;
      const n = data?.value || {};
      if (!n.enabled) return;
      const valid = value => /^https?:\/\//i.test(String(value || '').trim());
      const items = [
        { key:'telegram', url:valid(n.telegram_url)?n.telegram_url.trim():'', label:n.telegram_button||'Gabung Telegram', icon:'fa-brands fa-telegram', delay:5000 },
        { key:'whatsapp', url:valid(n.whatsapp_url)?n.whatsapp_url.trim():'', label:n.whatsapp_button||'Gabung WhatsApp', icon:'fa-brands fa-whatsapp', delay:10000 }
      ].filter(item=>item.url);
      items.forEach(item=>{
        const notice=document.createElement('aside');
        notice.className=`bc-community-notice ${item.key}`;
        notice.innerHTML=`<button class="bc-community-close" type="button" aria-label="Tutup">×</button><span class="bc-community-icon"><i class="${item.icon}"></i></span><b>${esc(n.title||'Gabung komunitas resmi')}</b><p>${esc(n.description||'Dapatkan informasi dan update terbaru BoxCellink.')}</p><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.label)}</a>`;
        const floating=document.createElement('a');
        floating.className=`bc-community-float ${item.key}`;
        floating.href=item.url;floating.target='_blank';floating.rel='noopener noreferrer';
        floating.setAttribute('aria-label',`Buka ${item.key}`);
        floating.innerHTML=`<i class="${item.icon}"></i>`;
        floating.hidden=true;notice.hidden=true;
        document.body.append(notice,floating);
        const dismiss=()=>{notice.hidden=true;floating.hidden=false;};
        notice.querySelector('.bc-community-close').addEventListener('click',dismiss);
        notice.querySelector('a').addEventListener('click',()=>{notice.dataset.dismissed='1';});
        window.setTimeout(()=>{if(notice.dataset.dismissed!=='1')notice.hidden=false;},item.delay);
      });
    } catch(error) { console.warn('Widget community notice unavailable',error); }
  })();

  const toggle = $('#bcSupportToggle', root);
  const panel = $('#bcSupportPanel', root);
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
      ,['Saya sudah membayar Media Telegram, tetapi akses belum terbuka. Apa yang harus dilakukan?','Setelah pembayaran berhasil, tunggu beberapa menit agar sistem menyelesaikan verifikasi dan memperbarui akses. Muat ulang halaman review atau periksa status pembayaran. Jika akses tetap belum terbuka, pilih Chat Admin dan kirim kode pesanan/bukti transaksi tanpa membagikan PIN, kata sandi, atau OTP pribadi.']
      ,['Bagaimana jika Media Telegram yang saya cari tidak tersedia?','Kamu dapat mengajukan request kepada admin. Sebutkan judul atau jenis media yang dicari, lalu admin akan memeriksa apakah permintaan tersebut bisa dipenuhi.']
      ,['Bagaimana cara membeli Media Telegram?','Buka Media Telegram, pilih review yang diinginkan, baca detail dan harga akses, lalu tekan tombol pembelian. Selesaikan pembayaran dan tunggu beberapa menit sampai status akses diperbarui. Jika ada kendala, hubungi admin melalui Chat Admin.']
    ]},
    {title:'Media Telegram & pembelian',items:[
      ['Panduan membeli Media Telegram','Buka menu Media Telegram, pilih kategori atau cari judul, buka review, periksa deskripsi dan harga, lalu lanjutkan pembelian. Setelah pembayaran berhasil, tunggu beberapa menit untuk verifikasi dan pembukaan akses.'],
      ['Pembayaran berhasil tetapi akses belum masuk','Tunggu beberapa menit, muat ulang halaman review, lalu periksa status pembayaran. Jika masih terkunci, hubungi admin dan sertakan kode pesanan agar transaksi dapat diperiksa.'],
      ['Media tidak tersedia atau ingin request','Kirim judul media atau kebutuhan yang kamu cari melalui Chat Admin. Admin akan memeriksa ketersediaan dan memberi informasi lanjutan.'],
      ['Saya punya pertanyaan lain','Gunakan Chat Admin untuk menyampaikan pertanyaan, kendala pembelian, atau permintaan khusus.']
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
    if(question){const item=faqGroups[Number(question.dataset.faqGroup)]?.items[Number(question.dataset.faqQuestion)];if(item)faqAnswer.innerHTML=`<b>${esc(item[0])}</b><p>${esc(item[1])}</p><button type="button" class="bc-support-contact-admin" data-contact-admin="${esc(item[0])}">Chat Admin / Ajukan Request</button><button type="button" data-faq-back="1">Pilih pertanyaan lain</button>`;return;}
    if(group)renderFaq(Number(group.dataset.faqGroup));
  });

  faqAnswer?.addEventListener('click',event=>{
    const contact=event.target.closest('[data-contact-admin]');
    if(!contact)return;
    if(!currentUser){
      messagesEl.innerHTML='<div class="bc-support-empty"><strong>Masuk untuk menghubungi admin</strong><br>Login terlebih dahulu agar permintaan tersimpan dan dapat dibalas admin.</div>';
      foot.innerHTML='<a href="/login.html?next='+encodeURIComponent(location.pathname+location.search)+'">Masuk ke akun</a>';
      return;
    }
    form.hidden=false;
    input.value='[Permintaan: '+contact.dataset.contactAdmin+'] ';
    input.focus();
    input.scrollIntoView({behavior:'smooth',block:'nearest'});
  });

  const closeChat = () => {
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Buka Chat Support');
    toggle.innerHTML = '<i class="fa-solid fa-headset" aria-hidden="true"></i>';
    toggle.focus({ preventScroll: true });
  };

  let currentUser = null;
  let conversation = null;
  let busy = false;
  let refreshTimer = null;
  let loadingChat = false;

  toggle.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (!panel.hidden) {
      closeChat();
      return;
    }
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Tutup Chat Support');
    toggle.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    messagesEl.innerHTML = '<div class="bc-support-empty">Menghubungkan ke layanan bantuan...</div>';
    await loadChat();
  });


  closeButton.addEventListener('click', closeChat);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) closeChat();
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
