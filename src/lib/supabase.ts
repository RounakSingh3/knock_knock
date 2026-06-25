import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables. Please create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Persist session in localStorage so users stay logged in across reloads
        persistSession: true,
        // Auto-refresh the token when needed
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
    realtime: {
        // Throttle realtime events to avoid hammering the server
        params: { eventsPerSecond: 5 },
    },
});
