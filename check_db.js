import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mock.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'mock';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(5);
  console.log(data, error);
}

check();
