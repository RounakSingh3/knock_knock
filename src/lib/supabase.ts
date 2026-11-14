import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables. Please create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
}

// Abort any Supabase HTTP request that stalls (mobile network switch, tab backgrounded, etc.)
// while allowing 120s for large video/media file uploads.
const fetchWithTimeout: typeof fetch = (input, init: RequestInit = {}) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request)?.url || '';
    const method = (init.method || 'GET').toUpperCase();
    const isMediaUpload =
        (method === 'POST' || method === 'PUT') &&
        urlStr.includes('/storage/v1/object/') &&
        !urlStr.includes('/storage/v1/object/list/');
    const timeoutMs = isMediaUpload ? 120000 : 8000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (init.signal) {
        if (init.signal.aborted) controller.abort();
        else init.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { fetch: fetchWithTimeout },
    auth: {
        // Persist session in localStorage so users stay logged in across reloads
        persistSession: true,
        // Auto-refresh the token when needed
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Prevent navigator.locks multi-tab deadlock on mobile & desktop browsers
        lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => await fn(),
    },
    realtime: {
        // Throttle realtime events to avoid hammering the server
        params: { eventsPerSecond: 5 },
    },
});
