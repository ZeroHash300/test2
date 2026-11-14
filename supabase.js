import { createClient } from '@supabase/supabase-js';

// Nilai diisi lewat file .env (lokal) atau GitHub Secrets (saat build).
// Anon key memang dirancang untuk publik; keamanan dijaga oleh Row Level Security di database.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key) : null;
