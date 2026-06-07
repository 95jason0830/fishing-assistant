import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 伺服器端用 service role（繞過 RLS）
export const supabase = createClient(url, serviceKey || anonKey);

// 客戶端用 anon key
export const supabaseClient = createClient(url, anonKey);
