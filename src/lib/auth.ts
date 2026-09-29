import { supabase } from './supabase';
import { isUnlimitedPointsUser, UNLIMITED_POINTS, type ProfileData } from './database';
import { isQuotaError, setSupabaseQuotaRestricted } from './fallbackData';

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

    try {
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

        if (error) {
            if (isQuotaError(error)) {
                setSupabaseQuotaRestricted(true);
            }
            throw error;
        }

        if (data.user) {
            try {
                await ensureUserProfile(data.user.id, params);
            } catch (ue: any) {
                if (isQuotaError(ue)) setSupabaseQuotaRestricted(true);
            }
        }

        return data;
    } catch (err: any) {
        if (isQuotaError(err) || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
            console.warn('[signUp] Supabase restricted/offline, using resilient local registration:', err.message);
            setSupabaseQuotaRestricted(true);
            const localId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const localProfile: ProfileData = {
                id: localId,
                username,
                name: params.name,
                gender: params.gender,
                avatar_url: `https://i.pravatar.cc/150?u=${username}`,
                points: 100,
                streak_count: 1,
                is_online: true,
                bio: `Hello! I'm ${params.name}`,
            };
            localStorage.setItem('knock_user_session', JSON.stringify(localProfile));
            return {
                user: { id: localId, email } as any,
                session: { access_token: 'local-token', user: { id: localId, email } } as any,
            };
        }
        throw err;
    }
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
        if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
        console.error('ensureUserProfile:', error);
        throw error;
    }
}

// ── Sign In ──

export async function signIn(username: string, password: string) {
    const email = usernameToEmail(username);
    const cleanUser = username.toLowerCase().trim();

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            if (isQuotaError(error)) {
                setSupabaseQuotaRestricted(true);
            }
            throw error;
        }
        return data;
    } catch (err: any) {
        if (isQuotaError(err) || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
            console.warn('[signIn] Supabase restricted/offline, using resilient local login:', err.message);
            setSupabaseQuotaRestricted(true);
            // Check if existing session has this username
            let existing: ProfileData | null = null;
            try {
                const raw = localStorage.getItem('knock_user_session');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed.username === cleanUser) existing = parsed;
                }
            } catch (_) {}

            const localProfile: ProfileData = existing || {
                id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                username: cleanUser,
                name: cleanUser,
                gender: 'other',
                avatar_url: `https://i.pravatar.cc/150?u=${cleanUser}`,
                points: 100,
                streak_count: 1,
                is_online: true,
                bio: `Hey there! I am ${cleanUser}`,
            };
            localStorage.setItem('knock_user_session', JSON.stringify(localProfile));
            return {
                user: { id: localProfile.id, email } as any,
                session: { access_token: 'local-token', user: { id: localProfile.id, email } } as any,
            };
        }
        throw err;
    }
}

// ── Sign Out ──

export async function signOut() {
    try {
        localStorage.removeItem('knock_user_session');
        const { error } = await supabase.auth.signOut();
        if (error && !isQuotaError(error)) throw error;
    } catch (e) {
        // Sign out locally regardless
        localStorage.removeItem('knock_user_session');
    }
}

// ── Session Helpers ──

export async function getSession() {
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
            if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
            // Fall back to local session if exists
            const raw = localStorage.getItem('knock_user_session');
            if (raw) {
                const parsed = JSON.parse(raw);
                return { access_token: 'local-token', user: { id: parsed.id, email: usernameToEmail(parsed.username) } } as any;
            }
            return null;
        }
        return data.session;
    } catch (e: any) {
        if (isQuotaError(e)) setSupabaseQuotaRestricted(true);
        const raw = localStorage.getItem('knock_user_session');
        if (raw) {
            const parsed = JSON.parse(raw);
            return { access_token: 'local-token', user: { id: parsed.id, email: usernameToEmail(parsed.username) } } as any;
        }
        return null;
    }
}

export function onAuthStateChange(callback: (userId: string | null) => void) {
    try {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            callback(session?.user?.id ?? null);
        });
        return subscription;
    } catch (_) {
        return { unsubscribe: () => {} } as any;
    }
}

// ── Fetch Profile for Current Session ──

export async function fetchCurrentProfile(): Promise<ProfileData | null> {
    try {
        const session = await getSession();
        if (!session?.user) {
            const cached = localStorage.getItem('knock_user_session');
            return cached ? JSON.parse(cached) : null;
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

        if (error) {
            if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
            const cached = localStorage.getItem('knock_user_session');
            return cached ? JSON.parse(cached) : null;
        }

        if (data && isUnlimitedPointsUser(data.id, data.username)) {
            data.points = UNLIMITED_POINTS;
        }
        return data;
    } catch (e: any) {
        if (isQuotaError(e)) setSupabaseQuotaRestricted(true);
        const cached = localStorage.getItem('knock_user_session');
        return cached ? JSON.parse(cached) : null;
    }
}

// ── Check Username Availability ──

export async function checkUsernameAvailable(username: string): Promise<boolean> {
    if (!username.trim() || username.length < 3) return false;

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('username')
            .eq('username', username.toLowerCase())
            .maybeSingle();

        if (error) {
            if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
            return true; // Don't block registration on quota error
        }

        return !data;
    } catch (e: any) {
        if (isQuotaError(e)) setSupabaseQuotaRestricted(true);
        return true;
    }
}
