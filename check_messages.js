import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
    const [key, ...val] = line.split('=');
    if (key) acc[key.trim()] = val.join('=').trim();
    return acc;
}, {});

const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    const { data: messages, error } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(10);
    if (error) console.error(error);
    console.log('Latest messages:', messages);
}
run();
