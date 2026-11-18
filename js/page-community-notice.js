(() => {
  'use strict';
  // The floating Telegram/WhatsApp/YouTube icons are mounted by support-widget.js
  // on every public page. This file only owns the expandable notice on Review Detail.
  const path = (location.pathname || '').toLowerCase();
  const isReviewDetail = path.startsWith('/r/') || /review-detail(?:\.html)?\/?$/.test(path);
  if (!isReviewDetail || !document.body) return;

  const safeUrl = value => {
    try {
      const u = new URL(String(value || '').trim());
      return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
    } catch (_) { return ''; }
  };

  const showReviewNotice = async () => {
    if (!window.sb) return;
    try {
      const { data, error } = await window.sb.from('site_link_settings')
        .select('value').eq('key', 'notice_review_detail').maybeSingle();
      if (error) throw error;
      const n = data?.value || {};
      if (!n.enabled) return;

      const config = window.BOXCELLINK_COMMUNITY_LINKS || {};
      const tg = safeUrl(n.telegram_url || config.telegram?.url);
      const wa = safeUrl(n.whatsapp_url || config.whatsapp?.url);
      if (!tg && !wa) return;

      if (!document.getElementById('bc-review-community-style')) {
        const style = document.createElement('style');
        style.id = 'bc-review-community-style';
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
      }

      if (document.querySelector('.bc-review-community-notice')) return;
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showReviewNotice, { once: true });
  } else {
    showReviewNotice();
  }
})();
