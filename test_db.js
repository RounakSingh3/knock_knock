import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('posts').select('id, image_url, css_filter, created_at, caption').order('created_at', { ascending: false }).limit(5);
  console.log('Recent posts:');
  if (data) {
    for (const post of data) {
      console.log(`- ID: ${post.id}, URL: ${post.image_url}, Filter: ${post.css_filter}, Caption: ${post.caption}`);
    }
  }
  if (error) console.log('Error:', error);
}

test();
