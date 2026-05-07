import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
    console.log("Testing Supabase connection...");
    const dummyContent = 'test';
    const { data, error } = await supabase.storage.from('media').upload('test.txt', dummyContent, { upsert: true });
    if (error) {
        console.error("Upload error details:");
        console.error(JSON.stringify(error, null, 2));
    } else {
        console.log("Upload success!", data);
    }
}

testUpload();
