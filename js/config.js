// Isi dari Supabase Project Settings → API.
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
