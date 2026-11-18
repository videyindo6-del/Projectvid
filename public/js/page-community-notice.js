(() => {
  'use strict';
  if (window.__boxcellinkCommunityDockLoaded) return;
  window.__boxcellinkCommunityDockLoaded = true;

  const config = window.BOXCELLINK_COMMUNITY_LINKS || {};
  const safeUrl = value => {
    try {
      const url = new URL(String(value || '').trim());
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  };

  // Render only on Watch, Review Media, and Review Detail routes.
  const path = (location.pathname || '').toLowerCase();
  const isWatch = /(?:^|\/)watch(?:\.html)?\/?$/.test(path) || path.startsWith('/watch/');
  const isReviewDetail = path.startsWith('/r/') || /review-detail(?:\.html)?\/?$/.test(path);
  const isReview = /review(?:\.html)?\/?$/.test(path) && !isReviewDetail;
  if (!isWatch && !isReview && !isReviewDetail) return;
  if (!document.body || document.getElementById('bc-community-dock')) return;

  const css = document.createElement('style');
  css.id = 'bc-community-dock-style';
  css.textContent = `
    #bc-community-dock {
      position: fixed !important;
      right: 22px !important;
      bottom: 174px !important;
      z-index: 2147482000 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-end !important;
      justify-content: flex-end !important;
      gap: 9px !important;
      pointer-events: none !important;
    }
    #bc-community-dock .bc-community-icon {
      width: 48px !important;
      height: 48px !important;
      flex: 0 0 48px !important;
      display: grid !important;
      place-items: center !important;
      border-radius: 50% !important;
      color: #fff !important;
      text-decoration: none !important;
      font-size: 23px !important;
      line-height: 1 !important;
      box-shadow: 0 7px 20px rgba(15,35,58,.25) !important;
      border: 2px solid #fff !important;
      pointer-events: auto !important;
      transition: transform .18s ease, filter .18s ease !important;
    }
    #bc-community-dock .bc-community-icon:hover {
      transform: translateY(-2px) scale(1.04);
      filter: brightness(1.06);
    }
    #bc-community-dock .bc-community-icon.telegram { background: #229ed9 !important; }
    #bc-community-dock .bc-community-icon.whatsapp { background: #20b967 !important; }
    #bc-community-dock .bc-community-icon.youtube { background: #e62117 !important; }
    #bc-community-dock .bc-community-icon.is-unconfigured {
      opacity: .72 !important;
      cursor: default !important;
    }
    #bc-community-dock .bc-community-icon:focus-visible {
      outline: 3px solid #fbbf24 !important;
      outline-offset: 3px !important;
    }
    @media (max-width: 600px) {
      #bc-community-dock {
        right: 14px !important;
        bottom: 164px !important;
        gap: 8px !important;
      }
      #bc-community-dock .bc-community-icon {
        width: 44px !important;
        height: 44px !important;
        flex-basis: 44px !important;
        font-size: 21px !important;
      }
    }
  `;
  document.head.appendChild(css);

  const items = [
    { key: 'telegram', icon: 'fa-brands fa-telegram', label: 'Telegram' },
    { key: 'whatsapp', icon: 'fa-brands fa-whatsapp', label: 'WhatsApp' },
    { key: 'youtube', icon: 'fa-brands fa-youtube', label: 'YouTube' }
  ];

  const dock = document.createElement('nav');
  dock.id = 'bc-community-dock';
  dock.setAttribute('aria-label', 'Link komunitas resmi');
  dock.innerHTML = items.map(item => {
    const entry = config[item.key] || {};
    const href = safeUrl(entry.url);
    const label = String(entry.label || `Buka ${item.label}`);
    const title = label.replace(/[<>&"']/g, '');
    if (href) {
      return `<a class="bc-community-icon ${item.key}" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${title}" title="${title}"><i class="${item.icon}" aria-hidden="true"></i></a>`;
    }
    return `<span class="bc-community-icon ${item.key} is-unconfigured" role="img" aria-label="${title} — link belum diatur" title="${title} — link belum diatur"><i class="${item.icon}" aria-hidden="true"></i></span>`;
  }).join('');

  const mount = () => {
    if (!document.body || document.getElementById('bc-community-dock')) return;
    document.body.appendChild(dock);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }

  // Keep the existing expandable join notice on Review Detail.
  // Its title/description/toggle remain admin-controlled; links fall back
  // to the dedicated JS config so the notice still works if DB settings are empty.
  const showReviewNotice = async () => {
    if (!isReviewDetail || !window.sb) return;
    try {
      const { data, error } = await window.sb.from('site_link_settings')
        .select('value').eq('key', 'notice_review_detail').maybeSingle();
      if (error) return;
      const n = data?.value || {};
      if (!n.enabled) return;
      const tg = safeUrl(n.telegram_url || config.telegram?.url);
      const wa = safeUrl(n.whatsapp_url || config.whatsapp?.url);
      if (!tg && !wa) return;

      const style = document.createElement('style');
      style.textContent = `
        .bc-review-community-notice{display:flex;align-items:center;gap:12px;flex-wrap:wrap;
          margin:14px auto;padding:14px;max-width:1100px;background:#eff6ff;
          border:1px solid #bfdbfe;border-radius:14px;color:#17324d;position:relative;
          z-index:8;box-shadow:0 8px 22px #17324d12}
        .bc-review-community-copy{flex:1;min-width:180px}
        .bc-review-community-copy b{display:block;font-weight:800}
        .bc-review-community-copy p{margin:4px 0 0;font-size:13px;line-height:1.5}
        .bc-review-community-actions{display:flex;gap:8px;flex-wrap:wrap}
        .bc-review-community-actions a{display:inline-flex;align-items:center;gap:7px;
          background:#229ed9;color:#fff!important;padding:9px 12px;border-radius:9px;
          text-decoration:none!important;font-weight:750;font-size:13px;white-space:nowrap}
        .bc-review-community-actions a.wa{background:#20a95d}
        .bc-review-community-close{border:0;background:transparent;font-size:22px;
          cursor:pointer;color:inherit;padding:2px 6px}
        @media(max-width:600px){.bc-review-community-actions{width:100%}
          .bc-review-community-actions a{flex:1;justify-content:center}}
      `;
      document.head.appendChild(style);

      const box = document.createElement('aside');
      box.className = 'bc-review-community-notice';
      box.setAttribute('role', 'region');
      box.setAttribute('aria-label', 'Gabung komunitas resmi');
      const copy = document.createElement('div');
      copy.className = 'bc-review-community-copy';
      const title = document.createElement('b');
      title.textContent = n.title || 'Gabung komunitas resmi';
      const desc = document.createElement('p');
      desc.textContent = n.description || 'Dapatkan informasi dan update terbaru BoxCellink.';
      copy.append(title, desc);
      const actions = document.createElement('div');
      actions.className = 'bc-review-community-actions';
      const addAction = (url, label, icon, cls) => {
        if (!url) return;
        const a = document.createElement('a');
        if (cls) a.className = cls;
        a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        const i = document.createElement('i'); i.className = icon;
        a.append(i, document.createTextNode(' ' + label));
        actions.appendChild(a);
      };
      addAction(tg, n.telegram_button || 'Gabung Telegram', 'fa-brands fa-telegram');
      addAction(wa, n.whatsapp_button || 'Gabung WhatsApp', 'fa-brands fa-whatsapp', 'wa');
      const close = document.createElement('button');
      close.type = 'button'; close.className = 'bc-review-community-close';
      close.setAttribute('aria-label', 'Tutup'); close.textContent = '×';
      close.addEventListener('click', () => box.remove());
      box.append(copy, actions, close);
      const main = document.querySelector('main');
      if (main) main.prepend(box); else document.body.prepend(box);
    } catch (err) {
      console.warn('Review community notice unavailable', err);
    }
  };
  showReviewNotice();
})();
