// Isi dua nilai ini dari Supabase Project Settings -> API.
window.BOXCELLINK_SUPABASE_URL = window.BOXCELLINK_SUPABASE_URL || 'https://djxcdwnpheufoojfzorx.supabase.co';
window.BOXCELLINK_SUPABASE_ANON_KEY = window.BOXCELLINK_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeGNkd25waGV1Zm9vamZ6b3J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MDUxNTQsImV4cCI6MjEwOTI4MTE1NH0.FjWsw4XWoHvjUiFR7zmXMKNHBTZAxr8Sct8SKnrdFsQ';
window.BOXCELLINK_SUPABASE_CONFIGURED = !window.BOXCELLINK_SUPABASE_URL.includes('YOUR_PROJECT') && !window.BOXCELLINK_SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
if(window.supabase && window.BOXCELLINK_SUPABASE_CONFIGURED) window.sb=window.supabase.createClient(window.BOXCELLINK_SUPABASE_URL,window.BOXCELLINK_SUPABASE_ANON_KEY);

// Isi URL channel Telegram resmi untuk tombol Support -> Channel Telegram.
window.BOXCELLINK_TELEGRAM_CHANNEL_URL = window.BOXCELLINK_TELEGRAM_CHANNEL_URL || '';
// Presence heartbeat: mencatat member login dan pengunjung tamu untuk statistik admin.
(function startBoxcellinkPresence(){
  if (!window.sb || window.__boxcellinkPresenceStarted) return;
  window.__boxcellinkPresenceStarted = true;
  const storageKey = 'boxcellink_presence_visitor_v1';
  let visitorKey = '';
  try {
    visitorKey = localStorage.getItem(storageKey) || '';
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(visitorKey)) {
      visitorKey = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('bc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 18));
      localStorage.setItem(storageKey, visitorKey);
    }
  } catch (_) {
    visitorKey = 'bc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 18);
  }
  let busy = false;
  const heartbeat = async () => {
    if (busy || !window.sb || document.visibilityState === 'prerender') return;
    busy = true;
    try {
      await window.sb.rpc('heartbeat_site_presence', { p_visitor_key: visitorKey });
    } catch (err) { console.warn('Presence heartbeat:', err?.message || err); }
    finally { busy = false; }
  };
  heartbeat();
  window.setInterval(() => { if (document.visibilityState === 'visible') heartbeat(); }, 45000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') heartbeat(); });
  window.sb.auth.onAuthStateChange(() => { window.setTimeout(heartbeat, 250); });
})();
