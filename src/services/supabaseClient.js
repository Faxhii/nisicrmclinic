import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'nisiclinic_supabase_url';
const STORAGE_KEY_ANON = 'nisiclinic_supabase_key';

let supabaseInstance = null;

export function getSupabaseCredentials() {
  const url = localStorage.getItem(STORAGE_KEY_URL) || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem(STORAGE_KEY_ANON) || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return { url: url.trim(), key: key.trim() };
}

export function isSupabaseConfigured() {
  const { url, key } = getSupabaseCredentials();
  return Boolean(url && key && url.startsWith('http'));
}

export function getSupabase() {
  const { url, key } = getSupabaseCredentials();
  if (!url || !key) return null;

  if (!supabaseInstance || supabaseInstance._url !== url) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
      supabaseInstance._url = url;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseInstance;
}

export function saveSupabaseConfig(url, key) {
  const cleanUrl = (url || '').trim();
  const cleanKey = (key || '').trim();

  if (cleanUrl) {
    localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
  } else {
    localStorage.removeItem(STORAGE_KEY_URL);
  }

  if (cleanKey) {
    localStorage.setItem(STORAGE_KEY_ANON, cleanKey);
  } else {
    localStorage.removeItem(STORAGE_KEY_ANON);
  }

  supabaseInstance = null;
  getSupabase();
}

export function clearSupabaseConfig() {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_ANON);
  supabaseInstance = null;
}

export async function testSupabaseConnection(overrideUrl, overrideKey) {
  const url = (overrideUrl || getSupabaseCredentials().url || '').trim();
  const key = (overrideKey || getSupabaseCredentials().key || '').trim();

  if (!url || !key) {
    return { success: false, message: 'Supabase URL and Anon Key are required.' };
  }

  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    return { success: false, message: 'Supabase URL must start with https://' };
  }

  const startTime = Date.now();
  try {
    const testClient = createClient(url, key);
    const { data, error } = await testClient.from('patients').select('patient_id').limit(1);

    const latency = Date.now() - startTime;

    if (error) {
      // Check if table doesn't exist yet
      if (error.code === '42P01') {
        return {
          success: true,
          latency,
          needsSchema: true,
          message: 'Connected to Supabase! However, the database tables are not created yet. Please execute the SQL migration script.'
        };
      }
      return { success: false, message: `Supabase Error: ${error.message} (${error.code || 'unknown'})` };
    }

    return {
      success: true,
      latency,
      needsSchema: false,
      message: `Successfully connected to Supabase in ${latency}ms! Database tables are ready.`
    };
  } catch (err) {
    return { success: false, message: `Connection failed: ${err.message}` };
  }
}
