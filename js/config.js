// Isi dua nilai ini dari Supabase Project Settings → API.
window.BOXCELLINK_SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
window.BOXCELLINK_SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
window.sb = supabase.createClient(window.BOXCELLINK_SUPABASE_URL, window.BOXCELLINK_SUPABASE_ANON_KEY);
