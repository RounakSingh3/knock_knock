import { supabase } from './supabase';
import type { ProfileData } from './database';

/**
 * Synthetic email domain used for username-based auth.
 * Supabase Auth requires email — we map username → username@knockknock.app.
 * No real email is sent (email confirmation is disabled in dashboard).
 */
const EMAIL_DOMAIN = 'knockknock.app';

function usernameToEmail(username: string): string {
    return `${username.toLowerCase()}@${EMAIL_DOMAIN}`;
}

// ── Sign Up ──

export interface SignUpParams {
    username: string;
    password: string;
    name: string;
    gender: string;
    dob: string;
}

export async function signUp(params: SignUpParams) {
    const email = usernameToEmail(params.username);
    const username = params.username.toLowerCase();

    const { data, error } = await supabase.auth.signUp({
        email,
        password: params.password,
        options: {
            data: {
                username,
                name: params.name,
                gender: params.gender,
                dob: params.dob,
                avatar_url: `https://i.pravatar.cc/150?u=${username}`,
            },
        },
    });

    if (error) throw error;

    if (data.user) {
        await ensureUserProfile(data.user.id, params);
    }

    return data;
}

/** Create or update profile row (no password — Auth handles that). */
export async function ensureUserProfile(userId: string, params: Pick<SignUpParams, 'username' | 'name' | 'gender' | 'dob'>) {
    const username = params.username.toLowerCase();
    const row = {
        id: userId,
        username,
        name: params.name,
        gender: params.gender,
        dob: params.dob,
        avatar_url: `https://i.pravatar.cc/150?u=${username}`,
    };

    const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' });

    if (error) {
        console.error('ensureUserProfile:', error);
        throw error;
    }
}

// ── Sign In ──

export async function signIn(username: string, password: string) {
    const email = usernameToEmail(username);

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw error;
    return data;
}

// ── Sign Out ──

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

// ── Session Helpers ──

export async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
}

export function onAuthStateChange(callback: (userId: string | null) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(session?.user?.id ?? null);
    });
    return subscription;
}

// ── Fetch Profile for Current Session ──

export async function fetchCurrentProfile(): Promise<ProfileData | null> {
    const session = await getSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

    if (error) {
        console.error('Error fetching current profile:', error);
        return null;
    }
    return data;
}

// ── Check Username Availability ──

export async function checkUsernameAvailable(username: string): Promise<boolean> {
    if (!username.trim() || username.length < 3) return false;

    const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.toLowerCase())
        .maybeSingle();

    return !data;
}
