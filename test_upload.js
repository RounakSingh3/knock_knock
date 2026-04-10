const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpload() {
  console.log('Testing upload to "media" bucket...');
  const testFileContent = 'Hello, this is a test file to verify uploads.';
  
  const { data, error } = await supabase.storage
    .from('media')
    .upload('test_folder/test.txt', testFileContent, {
      contentType: 'text/plain',
      upsert: true
    });

  if (error) {
    console.error('❌ Upload Failed!');
    console.error('Reason:', error.message);
    if (error.message.toLowerCase().includes('row-level security') || error.message.includes('RLS') || error.message.includes('policy')) {
        console.error('It looks like your RLS policies are preventing INSERT on the media bucket.');
    }
  } else {
    console.log('✅ Upload Succeeded!', data);
    const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl('test_folder/test.txt');
    console.log('🔗 Public URL:', publicUrlData.publicUrl);
  }
}

testUpload();
