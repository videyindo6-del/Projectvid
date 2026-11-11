// Isi dua nilai ini dari Supabase Project Settings -> API.
window.BOXCELLINK_SUPABASE_URL = window.BOXCELLINK_SUPABASE_URL || 'https://djxcdwnpheufoojfzorx.supabase.co';
window.BOXCELLINK_SUPABASE_ANON_KEY = window.BOXCELLINK_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeGNkd25waGV1Zm9vamZ6b3J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MDUxNTQsImV4cCI6MjEwOTI4MTE1NH0.FjWsw4XWoHvjUiFR7zmXMKNHBTZAxr8Sct8SKnrdFsQ';
window.BOXCELLINK_SUPABASE_CONFIGURED = !window.BOXCELLINK_SUPABASE_URL.includes('YOUR_PROJECT') && !window.BOXCELLINK_SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
if(window.supabase && window.BOXCELLINK_SUPABASE_CONFIGURED) window.sb=window.supabase.createClient(window.BOXCELLINK_SUPABASE_URL,window.BOXCELLINK_SUPABASE_ANON_KEY);

// Isi URL channel Telegram resmi untuk tombol Support -> Channel Telegram.
window.BOXCELLINK_TELEGRAM_CHANNEL_URL = window.BOXCELLINK_TELEGRAM_CHANNEL_URL || '';
