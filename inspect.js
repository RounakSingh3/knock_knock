import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = envContent.split('\n').reduce((acc, line) => {
    const [key, ...val] = line.split('=');
    if (key) acc[key.trim()] = val.join('=').trim();
    return acc;
}, {});

const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_ANON_KEY
);

async function inspectTables() {
    console.log('--- ALL TABLES CHECK ---');
    const { data: posts } = await supabase.from('posts').select('id, username, caption, image_url');
    console.log(`Posts left: ${posts ? posts.length : 0}`);
    if (posts) {
        posts.forEach(p => console.log(`Post: @${p.username} | ${p.image_url}`));
    }

    const { data: stories } = await supabase.from('stories').select('id, username, image_url');
    console.log(`Stories left: ${stories ? stories.length : 0}`);
    if (stories) {
        stories.forEach(s => console.log(`Story: @${s.username} | ${s.image_url}`));
    }
}

inspectTables();
