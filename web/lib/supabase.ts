import { createClient } from '@supabase/supabase-js';

// Single shared Supabase client for the whole frontend.
// Creating multiple instances with the same storage key causes the
// "Multiple GoTrueClient instances" warning and undefined behaviour.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  url && key ? createClient(url, key, { global: { fetch } }) : null;
