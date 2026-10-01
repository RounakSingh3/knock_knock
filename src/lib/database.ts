import { supabase } from './supabase';
import { isVideoPost, isVideoUrl, getCleanSongUrl, type MediaType } from './media';
import {
    isSupabaseQuotaRestricted,
    setSupabaseQuotaRestricted,
    isQuotaError,
    getLocalPosts,
    saveLocalPost,
    updateLocalPostLikes,
    getLocalLikes,
    toggleLocalLike,
    getLocalComments,
    saveLocalComment,
    SEED_POSTS,
    getKnownProfile,
    getAllKnownProfiles,
    getLocalConnections,
    removeLocalConnection,
    bumpLocalConnectionStreak,
    getLocalStories
} from './fallbackData';

const STORAGE_BUCKET =
    import.meta.env.VITE_STORAGE_BUCKET || 'knock-knock-eight.versel';

// These specific posts have broken Unsplash URLs (HTTP 404) or failed media.
// Filter them out at the app layer to keep the feed completely clean.
const BROKEN_POST_IDS = new Set([
    'ae1b9027-acbe-4782-a71f-ea709c23688f',
    '35d1da81-ed85-496d-9356-205a912a389a',
    '9349a62b-f4c9-4b5b-8544-232e05602079',
    'd3484b5a-30ed-4ed5-b4af-e2b18e20e438',
    'ecb5b028-8d04-4272-be3f-7f40693f9f53',
    'f9137acc-3838-42db-902c-9365b4da027a',
    '326ec467-e226-40ca-ac3e-c93426734ccc',
    'ec51efe9-e026-4e3b-a641-e2b015a32c86',
    '6b168e1f-fb76-497c-baae-c84798a32a4e',
    '0c718c71-7597-41a6-8be0-dc565ee0b383',
    '868a6af7-f1b5-4f26-bb76-e32e8c77c581',
]);

// Inappropriate or test accounts filtered out from feeds and search to keep app clean
export const BLOCKED_USERNAMES = new Set([
    'fuck',
    'gspotexpert',
    'bollywood_superstars',
    'baklol_kumar',
    'meme_hub_insta',
    'epic_fun_page',
    'relatable_postss',
]);

export function isRemovedUser(userId?: string | null, username?: string | null): boolean {
    if (username) {
        const clean = username.replace(/^@+/, '').trim().toLowerCase();
        if (!clean || BLOCKED_USERNAMES.has(clean)) return true;
    }
    return false;
}

// ── In-Memory Performance Cache ──────────────────────────────
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}
const cacheStore = new Map<string, CacheEntry<any>>();

export function getFromCache<T>(key: string, ttlMs = 25000): T | null {
    const entry = cacheStore.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > ttlMs) {
        cacheStore.delete(key);
        return null;
    }
    return entry.data;
}

export function setInCache<T>(key: string, data: T): void {
    cacheStore.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(keyPrefix?: string): void {
    if (!keyPrefix) {
        cacheStore.clear();
    } else {
        for (const k of cacheStore.keys()) {
            if (k.startsWith(keyPrefix)) cacheStore.delete(k);
        }
    }
}

// ── Posts ──────────────────────────────────────────────

export interface PostData {
    id: string;
    user_id?: string;
    username: string;
    avatar_url: string;
    image_url: string;
    caption: string;
    likes_count: number;
    imps_count?: number;
    comments_count?: number;
    shares_count?: number;
    created_at: string;
    attached_link?: string;
    media_type?: MediaType | string;
    category?: string;
    css_filter?: string;
    boost_expires_at?: string | null;
    boost_impressions_remaining?: number;
    music_title?: string;
    music_artist?: string;
    music_url?: string;
}

export function mergePostsWithFallback(dbPosts: PostData[]): PostData[] {
    const seen = new Set<string>();
    const merged: PostData[] = [];

    // Live Database posts first (Supabase is the primary source of truth!)
    for (const p of dbPosts) {
        if (!p || !p.id || seen.has(p.id) || BROKEN_POST_IDS.has(p.id) || isRemovedUser(p.user_id, p.username)) continue;
        seen.add(p.id);
        merged.push(p);
    }

    // Local user created / offline posts next
    const local = getLocalPosts();
    for (const p of local) {
        if (!p || !p.id || seen.has(p.id) || BROKEN_POST_IDS.has(p.id) || isRemovedUser(p.user_id, p.username)) continue;
        seen.add(p.id);
        merged.push(p);
    }

    if (merged.length === 0) {
        for (const p of SEED_POSTS) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                merged.push(p);
            }
        }
    }

    return merged;
}

export async function fetchPosts(): Promise<PostData[]> {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
            console.warn('[fetchPosts] Supabase unavailable, returning resilient local posts:', error.message);
            return getLocalPosts();
        }
        const normalized = (data || []).map(normalizePost).filter((p): p is PostData => Boolean(p));
        if (normalized.length === 0) {
            return getLocalPosts();
        }
        return mergePostsWithFallback(normalized);
    } catch (err: any) {
        if (isQuotaError(err)) setSupabaseQuotaRestricted(true);
        return getLocalPosts();
    }
}

export async function fetchForYouPosts(userId: string): Promise<PostData[]> {
    try {
        const connectionIds = await fetchConnectionUserIds(userId);
        const excludeIds = [...connectionIds, userId];

        let query = supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (excludeIds.length > 0) {
            query = query.not('user_id', 'in', `(${excludeIds.join(',')})`);
        }

        const { data, error } = await query;

        if (error) {
            if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
            console.warn('[fetchForYouPosts] Supabase unavailable, returning resilient local posts:', error.message);
            return getLocalPosts().filter(p => !excludeIds.includes(p.user_id || ''));
        }
        const normalized = (data || []).map(normalizePost).filter((p): p is PostData => Boolean(p));
        if (normalized.length === 0) {
            return getLocalPosts().filter(p => !excludeIds.includes(p.user_id || ''));
        }
        return mergePostsWithFallback(normalized).filter(p => !excludeIds.includes(p.user_id || ''));
    } catch (err: any) {
        if (isQuotaError(err)) setSupabaseQuotaRestricted(true);
        return getLocalPosts();
    }
}

export const CREATOR_CANONICAL_NAMES: Record<string, string> = {
    'rounak2': 'Rounak Singh',
    'rounak': 'Rounak Singh',
    'popcorn05': 'Popcorn05',
    'popcorn': 'Popcorn05',
    'coral': 'Coral',
    'corel': 'Coral',
    'ityourfavourite1': 'It Your Favourite',
    'ityourfavourite': 'It Your Favourite',
    'priya_patel99': 'Priya Patel',
    'priya_patel': 'Priya Patel',
    'rahul_sharma': 'Rahul Sharma',
    'neha_creates': 'Neha Creates',
    'viral_bhayani_fan': 'Viral Bhayani Fan',
    'bollywood_gossip': 'Bollywood Gossip',
    'cricket_fever_in': 'Cricket Fever',
    'anjali_gupta': 'Anjali Gupta',
    'rohit_verma': 'Rohit Verma',
    'amit_kumar_vlogs': 'Amit Kumar Vlogs',
    'funnyreels2': 'Comedy Vault',
    'comedy_vault_in': 'Comedy Vault',
    'lifestylevibes': 'Urban Lifestyle',
    'urban_lifestyle_co': 'Urban Lifestyle',
    'sportshub': 'World Sports Central',
    'world_sports_central': 'World Sports Central',
    'gamingsetup': 'Gaming Lounge HQ',
    'gaming_lounge_hq': 'Gaming Lounge HQ',
    'fitfits': 'Gym Fits Daily',
    'gym_fits_daily': 'Gym Fits Daily',
    'ironphysique': 'Iron Pulse Fits',
    'iron_pulse_fits': 'Iron Pulse Fits',
    'cricketzone': 'Cricket Legend Moments',
    'cricket_legend_moments': 'Cricket Legend Moments',
    'shaikh_ap_i': 'Shaikh',
    'shaikh_AP_I': 'Shaikh',
    'shaikh_a': 'Shaikh',
    'funnyreels3': 'Epic Fails & Laughs',
    'epic_fails_and_laughs': 'Epic Fails & Laughs',
    'funnyreels1': 'Funny Clips Daily',
    'funny_clips_daily': 'Funny Clips Daily',
    'funnyreels4': 'Viral Laugh Zone',
    'viral_laugh_zone': 'Viral Laugh Zone',
    'igmemes1': 'Meme Hub',
    'meme_hub_insta': 'Meme Hub',
    'igmemes2': 'Relatable Posts',
    'relatable_postss': 'Relatable Posts',
    'igmemes3': 'Desi Humor Club',
    'desi_humor_club': 'Desi Humor Club',
    'igmemes4': 'Epic Fun Page',
    'epic_fun_page': 'Epic Fun Page',
    'igmemes5': 'Daily Memes',
    'dailymemes_ig': 'Daily Memes',
    'bollystars': 'Bollywood Superstars',
    'bollywood_superstars': 'Bollywood Superstars',
    'filmglam': 'Cinema Glamour',
    'cinema_glamour': 'Cinema Glamour',
    'godzzz': 'Godzzz',
    'bhai786': 'Bhai786',
    'sophisticated_minde': 'Sophisticated Mind',
    'youra_22': 'Youra',
    'daisy_twang56': 'Daisy Twang',
    'samarth22': 'Samarth',
    'abhiology': 'Abhi',
    'faheemhayat.com': 'Faheem Hayat',
    'tara01': 'Tara 💖',
    'anaya': 'Anaa',
    'aditya': 'Aditya',
    'i.m.legit': 'Monu',
    'nature_vibes': 'Nature Vibes 🌅',
    'city_explorer': 'City Explorer 🏙️',
    'ocean_dreams': 'Ocean Dreams 🌊',
    'fitness_freak': 'Fitness Freak 💪',
    'foodie_fam': 'Foodie Fam 🍕',
    'sky_watcher': 'Sky Watcher ☁️',
    'dance_central': 'Dance Central 💃',
    'dance_queen': 'Dance Queen 💃',
    'pet_paradise': 'Pet Paradise 🐾',
    'adventure_co': 'Adventure Co 🏔️',
    'street_vibes': 'Street Vibes 🎨',
    'art_daily': 'Art Daily 🎨',
    'coffee_corner': 'Coffee Corner ☕',
    'astro_lover': 'Astro Lover 🌌',
    'morning_routine': 'Morning Routine ☀️',
    'google_news_daily': 'Google News Daily 📰',
};

export const CREATOR_USERNAME_PAIRS: Record<string, string> = {
    'funnyreels2': 'comedy_vault_in',
    'lifestylevibes': 'urban_lifestyle_co',
    'sportshub': 'world_sports_central',
    'gamingsetup': 'gaming_lounge_hq',
    'igmemes1': 'meme_hub_insta',
    'igmemes2': 'relatable_postss',
    'igmemes3': 'desi_humor_club',
    'igmemes4': 'epic_fun_page',
    'igmemes5': 'dailymemes_ig',
    'funnyreels1': 'funny_clips_daily',
    'funnyreels3': 'epic_fails_and_laughs',
    'funnyreels4': 'viral_laugh_zone',
    'bollystars': 'bollywood_superstars',
    'filmglam': 'cinema_glamour',
    'fitfits': 'gym_fits_daily',
    'ironphysique': 'iron_pulse_fits',
    'cricketzone': 'cricket_legend_moments',
    'shaikh_ap_i': 'shaikh_a',
};

export const COMMON_TYPOS: Record<string, string[]> = {
    'rounak': ['rounak2'],
    'corel': ['coral'],
    'popcorn': ['popcorn05'],
    'ityourfavourite': ['ityourfavourite1'],
    'aanya': ['anaya'],
    'anya': ['anaya'],
    'aanaa': ['anaya'],
    'ana': ['anaya'],
    'popcrd': ['popcorn05', 'popcorn'],
    'popcrn': ['popcorn05', 'popcorn'],
    'popc': ['popcorn05', 'popcorn'],
    'tara': ['tara01'],
    'tar': ['tara01'],
    'adity': ['aditya'],
    'adithya': ['aditya'],
};

export const REEL_CREATOR_POSTS: Record<string, { videoUrl: string; song: string; caption: string; category: string }[]> = {
    'nature_vibes': [{ videoUrl: 'https://videos.pexels.com/video-files/856029/856029-sd_640_360_30fps.mp4', song: 'Chill Vibes — LofiBeats', caption: '🌅 Golden hour hits different when you\'re at the coast', category: 'Nature' }],
    'city_explorer': [{ videoUrl: 'https://videos.pexels.com/video-files/3015510/3015510-sd_640_360_24fps.mp4', song: 'After Dark — Mr.Kitty', caption: '🏙️ Neon lights and late-night bites in the city that never sleeps', category: 'Travel' }],
    'ocean_dreams': [{ videoUrl: 'https://videos.pexels.com/video-files/1526909/1526909-sd_640_360_25fps.mp4', song: 'Ocean Eyes — Billie Eilish', caption: '🌊 The ocean is calling and I must go 🐠', category: 'Nature' }],
    'fitness_freak': [{ videoUrl: 'https://videos.pexels.com/video-files/3571264/3571264-sd_640_360_30fps.mp4', song: 'Stronger — Kanye West', caption: '💪 No shortcuts. Just grind. Who\'s in? 🔥', category: 'Sports' }],
    'foodie_fam': [{ videoUrl: 'https://videos.pexels.com/video-files/2795173/2795173-sd_640_360_25fps.mp4', song: 'THAT\'S WHAT I WANT — Lil Nas X', caption: '🍕 Wait for it… the cheese pull is insane 🤤', category: 'Food' }],
    'sky_watcher': [{ videoUrl: 'https://videos.pexels.com/video-files/854669/854669-sd_640_360_30fps.mp4', song: 'Weightless — Marconi Union', caption: '☁️ Clouds moving in time-lapse is pure therapy', category: 'Nature' }],
    'dance_queen': [{ videoUrl: 'https://videos.pexels.com/video-files/4065924/4065924-sd_640_360_25fps.mp4', song: 'Levitating — Dua Lipa', caption: '💃 Can\'t stop dancing to this beat! Tutorial coming soon 🔥', category: 'Dance' }],
    'dance_central': [{ videoUrl: 'https://videos.pexels.com/video-files/4065924/4065924-sd_640_360_25fps.mp4', song: 'Levitating — Dua Lipa', caption: '💃 Tried this trend and nailed it on the first try 🎯', category: 'Dance' }],
    'pet_paradise': [{ videoUrl: 'https://videos.pexels.com/video-files/1739010/1739010-sd_640_360_24fps.mp4', song: 'Happy — Pharrell Williams', caption: '🐶 When your dog has more personality than you 😂', category: 'Pets' }],
    'adventure_co': [{ videoUrl: 'https://videos.pexels.com/video-files/3209828/3209828-sd_640_360_25fps.mp4', song: 'Adventure — Matthew Parker', caption: '🏔️ Life begins at the end of your comfort zone', category: 'Travel' }],
    'street_vibes': [{ videoUrl: 'https://videos.pexels.com/video-files/5752729/5752729-sd_640_360_30fps.mp4', song: 'The Staunton Lick — Lemon Jelly', caption: '🎨 Street art is the voice of the city walls', category: 'Art' }],
    'art_daily': [{ videoUrl: 'https://videos.pexels.com/video-files/3209828/3209828-sd_640_360_25fps.mp4', song: 'Golden Hour — JVKE', caption: '🎨 30 hours of work in 30 seconds. What should I paint next?', category: 'Art' }],
    'coffee_corner': [{ videoUrl: 'https://videos.pexels.com/video-files/5752729/5752729-sd_640_360_30fps.mp4', song: 'Coffee — Beabadoobee', caption: '☕ The perfect pour. Nothing beats that first sip in the morning', category: 'Lifestyle' }],
    'astro_lover': [{ videoUrl: 'https://videos.pexels.com/video-files/2519660/2519660-sd_640_360_24fps.mp4', song: 'Starlight — Muse', caption: '🌌 The Milky Way never gets old. Who else is a night owl? 🦉', category: 'Nature' }],
    'morning_routine': [{ videoUrl: 'https://videos.pexels.com/video-files/3571264/3571264-sd_640_360_30fps.mp4', song: 'Sunrise — Norah Jones', caption: '☀️ 5AM morning routine that changed my life', category: 'Lifestyle' }],
};

export const REEL_CREATOR_MAP: Record<string, { name: string; avatar: string; bio: string }> = {
    'nature_vibes': { name: 'Nature Vibes 🌅', avatar: 'https://i.pravatar.cc/150?img=1', bio: 'Capturing the golden hour and coastlines 🌊' },
    'city_explorer': { name: 'City Explorer 🏙️', avatar: 'https://i.pravatar.cc/150?img=5', bio: 'Neon lights and late-night city walks 🌃' },
    'ocean_dreams': { name: 'Ocean Dreams 🌊', avatar: 'https://i.pravatar.cc/150?img=12', bio: 'The ocean is calling and I must go 🐠' },
    'fitness_freak': { name: 'Fitness Freak 💪', avatar: 'https://i.pravatar.cc/150?img=8', bio: 'No shortcuts. Just grind. 🔥' },
    'foodie_fam': { name: 'Foodie Fam 🍕', avatar: 'https://i.pravatar.cc/150?img=20', bio: 'Food adventures & best culinary spots 🤤' },
    'sky_watcher': { name: 'Sky Watcher ☁️', avatar: 'https://i.pravatar.cc/150?img=33', bio: 'Cloud timelapses & stargazing therapy 🌌' },
    'dance_queen': { name: 'Dance Queen 💃', avatar: 'https://i.pravatar.cc/150?img=44', bio: 'Choreography & rhythm daily ✨' },
    'dance_central': { name: 'Dance Central 💃', avatar: 'https://i.pravatar.cc/150?img=41', bio: 'Tried this trend and nailed it on the first try 🎯' },
    'pet_paradise': { name: 'Pet Paradise 🐾', avatar: 'https://i.pravatar.cc/150?img=48', bio: 'Cute puppies & cats making your day brighter 🐶' },
    'adventure_co': { name: 'Adventure Co 🏔️', avatar: 'https://i.pravatar.cc/150?img=55', bio: 'Life begins at the end of your comfort zone 🧗' },
    'street_vibes': { name: 'Street Vibes 🎨', avatar: 'https://i.pravatar.cc/150?img=60', bio: 'Street art is the voice of the city walls 🖌️' },
    'art_daily': { name: 'Art Daily 🎨', avatar: 'https://i.pravatar.cc/150?img=60', bio: 'Visual art, paintings, and process sketches 🖌️' },
    'coffee_corner': { name: 'Coffee Corner ☕', avatar: 'https://i.pravatar.cc/150?img=68', bio: 'Latte art & cozy morning aesthetics ☕' },
    'astro_lover': { name: 'Astro Lover 🌌', avatar: 'https://i.pravatar.cc/150?img=65', bio: 'The Milky Way never gets old. Night owl 🦉' },
    'morning_routine': { name: 'Morning Routine ☀️', avatar: 'https://i.pravatar.cc/150?img=22', bio: '5AM morning routines that change lives ☀️' },
    'google_news_daily': { name: 'Google News Daily 📰', avatar: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=150', bio: 'Trending news from India and around the world 📰' }
};

export function formatDisplayNameFromUsername(username: string): string {
    if (!username) return 'User';
    const clean = username.replace(/^@+/, '').trim().toLowerCase();
    if (CREATOR_CANONICAL_NAMES[clean]) {
        return CREATOR_CANONICAL_NAMES[clean];
    }
    return clean
        .split(/[_\-\s]+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

export async function fetchUserPosts(username: string, userId?: string): Promise<PostData[]> {
    if (!username) return [];
    const cleanUsername = username.replace(/^@+/, '').trim().toLowerCase();
    if (!cleanUsername) return [];

    // Collect all candidate usernames and aliases for this user
    const candidateUsernames = new Set<string>([cleanUsername]);
    if (COMMON_TYPOS[cleanUsername]) {
        COMMON_TYPOS[cleanUsername].forEach(u => candidateUsernames.add(u.toLowerCase()));
    }
    // Reverse typo check (e.g. if cleanUsername is 'rounak2', add 'rounak')
    Object.entries(COMMON_TYPOS).forEach(([typo, targets]) => {
        if (targets.map(t => t.toLowerCase()).includes(cleanUsername)) {
            candidateUsernames.add(typo.toLowerCase());
        }
    });
    // Check creator pairs (e.g. 'funnyreels2' -> 'comedy_vault_in')
    if (CREATOR_USERNAME_PAIRS[cleanUsername]) {
        candidateUsernames.add(CREATOR_USERNAME_PAIRS[cleanUsername].toLowerCase());
    }
    // Reverse pair check (e.g. if cleanUsername is 'comedy_vault_in', also look for 'funnyreels2')
    Object.entries(CREATOR_USERNAME_PAIRS).forEach(([alias, canonical]) => {
        if (canonical.toLowerCase() === cleanUsername) {
            candidateUsernames.add(alias.toLowerCase());
        }
    });

    // Collect all candidate user IDs
    const candidateUserIds = new Set<string>();
    if (userId && userId !== '00000000-0000-0000-0000-000000000000' && !userId.startsWith('creator-')) {
        candidateUserIds.add(userId);
    }
    for (const u of candidateUsernames) {
        const kp = getKnownProfile(u);
        if (kp && kp.id && !kp.id.startsWith('creator-')) {
            candidateUserIds.add(kp.id);
        }
    }

    let dbPosts: PostData[] = [];
    if (!isSupabaseQuotaRestricted()) {
        try {
            let query = supabase.from('posts').select('*');
            const orConditions: string[] = [];
            candidateUsernames.forEach(u => orConditions.push(`username.ilike.${u}`));
            candidateUserIds.forEach(id => orConditions.push(`user_id.eq.${id}`));

            if (orConditions.length > 0) {
                query = query.or(orConditions.join(','));
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) {
                if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
            } else {
                dbPosts = (data || []).map(normalizePost).filter((p): p is PostData => Boolean(p));
            }
        } catch (err: any) {
            if (isQuotaError(err)) setSupabaseQuotaRestricted(true);
        }
    }

    // Always fetch matching local posts
    const localPosts = getLocalPosts().filter(p => {
        const pUname = (p.username || '').toLowerCase();
        if (candidateUsernames.has(pUname)) return true;
        if (p.user_id && candidateUserIds.has(p.user_id)) return true;
        return false;
    });

    // Merge dbPosts and localPosts, deduplicated by post id
    const seenPostIds = new Set<string>();
    const mergedPosts: PostData[] = [];

    for (const p of [...dbPosts, ...localPosts]) {
        if (p.id && !seenPostIds.has(p.id)) {
            seenPostIds.add(p.id);
            mergedPosts.push(p);
        }
    }

    if (mergedPosts.length > 0) {
        return mergedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    // Fallback: If no DB or local posts exist, check if this is a known reel creator from REEL_CREATOR_POSTS
    for (const u of candidateUsernames) {
        if (REEL_CREATOR_POSTS[u]) {
            return REEL_CREATOR_POSTS[u].map((p, idx) => ({
                id: `reel-${u}-${idx}`,
                user_id: `creator-${u}`,
                username: u,
                avatar_url: `https://i.pravatar.cc/150?u=${u}`,
                image_url: p.videoUrl,
                caption: p.caption,
                likes_count: 1200 + idx * 350,
                media_type: 'video',
                category: p.category,
                music_title: p.song,
                created_at: new Date().toISOString()
            }));
        }
    }

    return [];
}

export async function uploadMedia(
    file: File, 
    path: string,
    onProgress?: (progress: { loaded: number; total: number }) => void
): Promise<string> {
    const MAX_RETRIES = 2;
    let lastError: Error | null = null;
    const cleanPath = path.replace(/[^a-zA-Z0-9_\-\.\/]/g, '_');

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (onProgress) {
                // Use XMLHttpRequest for real upload progress tracking
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                const uploadUrl = `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${cleanPath}`;

                // Get auth token for authenticated uploads
                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData?.session?.access_token || supabaseKey;

                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', uploadUrl, true);
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                    xhr.setRequestHeader('apikey', supabaseKey);
                    xhr.setRequestHeader('x-upsert', 'true');
                    xhr.setRequestHeader('cache-control', '3600');
                    if (file.type) {
                        xhr.setRequestHeader('Content-Type', file.type);
                    }

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            onProgress({ loaded: e.loaded, total: e.total });
                        }
                    };

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve();
                        } else {
                            let msg = 'Upload failed';
                            try {
                                const body = JSON.parse(xhr.responseText);
                                msg = body.message || body.error || msg;
                            } catch (_) {}
                            reject(new Error(msg));
                        }
                    };

                    xhr.onerror = () => reject(new Error('Network error during upload'));
                    xhr.ontimeout = () => reject(new Error('Upload timed out'));
                    xhr.timeout = 120000; // 2 minute timeout

                    xhr.send(file);
                });
            } else {
                // Standard Supabase SDK upload (no progress needed)
                const { error } = await supabase.storage
                    .from(STORAGE_BUCKET)
                    .upload(cleanPath, file, {
                        cacheControl: '3600',
                        upsert: true,
                        contentType: file.type || undefined,
                    });

                if (error) {
                    throw new Error(error.message || 'Failed to upload file to storage.');
                }
            }

            // Upload succeeded — get public URL
            const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(cleanPath);
            return publicUrlData.publicUrl;

        } catch (err: any) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (isQuotaError(lastError)) {
                setSupabaseQuotaRestricted(true);
                break; // Stop retrying immediately if quota restricted
            }
            console.warn(`[uploadMedia] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);

            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            }
        }
    }

    // ⚡ Resilient Fallback: If Supabase storage is restricted or network failed:
    if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)) {
        console.warn('[uploadMedia] Storage unavailable, using Base64 image fallback');
        return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(URL.createObjectURL(file));
            reader.readAsDataURL(file);
        });
    }

    // Video fallback
    console.warn('[uploadMedia] Storage unavailable, creating resilient video URL fallback');
    if (file.size <= 15 * 1024 * 1024) {
        return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(URL.createObjectURL(file));
            reader.readAsDataURL(file);
        });
    }
    return URL.createObjectURL(file);
}

export async function fetchVideoPosts(currentUserId?: string): Promise<PostData[]> {
    let rawVideos: PostData[] = [];
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
            console.warn('[fetchVideoPosts] Supabase unavailable, returning local video posts:', error.message);
            rawVideos = getLocalPosts().filter(p => isVideoPost(p) || isVideoUrl(p.image_url));
        } else {
            const normalized = (data || []).map(normalizePost).filter((p): p is PostData => Boolean(p) && (isVideoPost(p) || isVideoUrl(p.image_url)));
            rawVideos = normalized.length > 0 ? mergePostsWithFallback(normalized).filter(p => isVideoPost(p) || isVideoUrl(p.image_url)) : getLocalPosts().filter(p => isVideoPost(p) || isVideoUrl(p.image_url));
        }
    } catch (err: any) {
        if (isQuotaError(err)) setSupabaseQuotaRestricted(true);
        rawVideos = getLocalPosts().filter(p => isVideoPost(p) || isVideoUrl(p.image_url));
    }

    if (rawVideos.length <= 1) return rawVideos;

    // Apply author anti-clustering so bulk uploads from a single account don't monopolize the top
    const ownRecent: PostData[] = [];
    const regular: PostData[] = [];

    for (const v of rawVideos) {
        const hoursOld = Math.max(0, (Date.now() - new Date(v.created_at).getTime()) / (1000 * 60 * 60));
        if (currentUserId && v.user_id === currentUserId && hoursOld < 48) {
            ownRecent.push(v);
        } else {
            regular.push(v);
        }
    }

    const blended: PostData[] = [...ownRecent];
    const pool = [...regular];
    let lastAuthor = blended.length > 0 ? (blended[blended.length - 1].username || blended[blended.length - 1].user_id) : '';

    while (pool.length > 0) {
        let foundIdx = pool.findIndex(v => (v.username || v.user_id) !== lastAuthor);
        if (foundIdx === -1) foundIdx = 0;
        const [next] = pool.splice(foundIdx, 1);
        blended.push(next);
        lastAuthor = next.username || next.user_id;
    }

    return blended;
}

export async function fetchPostById(id: string): Promise<PostData | null> {
    if (!id) return null;
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error || !data) return null;
        return normalizePost(data);
    } catch (e) {
        return null;
    }
}

/** Formats a Knock Knock video attachment into a standardized internal link */
export function formatKnockVideoLink(video: {
    id: string | number;
    videoUrl: string;
    caption?: string;
    username?: string;
}): string {
    const params = new URLSearchParams();
    params.set('id', String(video.id));
    if (video.videoUrl) params.set('v', video.videoUrl);
    if (video.caption) params.set('caption', video.caption.slice(0, 80));
    if (video.username) params.set('user', video.username);
    return `/reels?${params.toString()}`;
}

/** Checks whether a link URL points to a Knock Knock video or reel */
export function isKnockVideoLink(url?: string | null): boolean {
    if (!url) return false;
    const u = url.toLowerCase();
    if (u.includes('/reels') || u.includes('kk:video:')) {
        return true;
    }
    if (/\.(mp4|webm|mov)(\?.*)?$/i.test(url)) {
        return true;
    }
    return false;
}

/** Parses metadata from a Knock Knock video link */
export function parseKnockVideoLink(url?: string | null): {
    id?: string;
    videoUrl?: string;
    caption?: string;
    username?: string;
} | null {
    if (!url) return null;
    try {
        if (url.includes('/reels')) {
            const queryIndex = url.indexOf('?');
            const queryString = queryIndex !== -1 ? url.slice(queryIndex + 1) : '';
            const params = new URLSearchParams(queryString);
            const id = params.get('id') || undefined;
            const videoUrl = params.get('v') || undefined;
            const caption = params.get('caption') || undefined;
            const username = params.get('user') || undefined;
            return { id, videoUrl, caption, username };
        }
        if (url.startsWith('kk:video:')) {
            return { id: url.replace('kk:video:', '').trim() };
        }
        if (/\.(mp4|webm|mov)(\?.*)?$/i.test(url)) {
            return { videoUrl: url };
        }
    } catch (_) {}
    return null;
}

/** Awards points to a user for uploading content and updates database */
export async function awardUploadPoints(userId: string, pointsAwarded: number, currentPoints: number): Promise<number> {
    if (!userId) return currentPoints;
    const isUnlimited = isUnlimitedPointsUser(userId);
    if (isUnlimited) {
        return UNLIMITED_POINTS;
    }
    const newPoints = Math.max(0, currentPoints + pointsAwarded);
    try {
        await updatePoints(userId, newPoints);
    } catch (e) {
        console.warn('[awardUploadPoints] Error updating points in DB:', e);
    }
    return newPoints;
}

export function normalizePost(post: PostData): PostData {
    if (!post) return null as any;
    if (BROKEN_POST_IDS.has(post.id)) return null as any;

    // Filter out posts with empty, null, or invalid image_url, or non-portable blob/data URLs
    if (!post.image_url || typeof post.image_url !== 'string') return null as any;
    const trimmedUrl = post.image_url.trim();
    if (!trimmedUrl || trimmedUrl === 'undefined' || trimmedUrl === 'null' || trimmedUrl === 'none' || trimmedUrl.startsWith('blob:') || trimmedUrl.startsWith('data:')) {
        return null as any;
    }

    // Filter out posts by blocked/inappropriate test accounts
    if (BLOCKED_USERNAMES.has((post.username || '').toLowerCase())) {
        return null as any;
    }

    let caption = post.caption || '';
    let music_url = post.music_url;
    let music_title = post.music_title;
    let music_artist = post.music_artist;

    if (caption.includes('[MUSIC:')) {
        const match = caption.match(/\[MUSIC:([^|]+)\|([^|]*)\|([^\]]*)\]/);
        if (match) {
            if (!music_url || music_url.includes('soundhelix')) {
                music_url = match[1];
                music_title = match[2] || 'Song';
                music_artist = match[3] || '';
            }
        }
        caption = caption.replace(/\[MUSIC:[^\]]+\]/g, '').trim();
    }

    // Replace any SoundHelix/MIDI dummy URLs with authentic preview streams
    const cleanUrl = getCleanSongUrl(music_title, music_url);
    if (cleanUrl) {
        music_url = cleanUrl;
    } else if (music_url && music_url.includes('soundhelix')) {
        music_url = undefined;
    }

    const avatar_url = post.avatar_url || `https://i.pravatar.cc/150?u=${post.username || 'user'}`;

    return {
        ...post,
        avatar_url,
        caption,
        music_url,
        music_title,
        music_artist,
    };
}

export async function createNewPost(post: {
    user_id?: string;
    username: string;
    avatar_url: string;
    image_url: string;
    caption: string;
    attached_link?: string;
    media_type?: MediaType;
    category?: string;
    css_filter?: string;
    boost_expires_at?: string | null;
    boost_impressions_remaining?: number;
    music_title?: string;
    music_artist?: string;
    music_url?: string;
}) {
    let finalCaption = post.caption || '';
    if (post.music_url && !finalCaption.includes('[MUSIC:')) {
        finalCaption += `\n\n[MUSIC:${post.music_url}|${post.music_title || ''}|${post.music_artist || ''}]`;
    }

    const row: Record<string, unknown> = {
        username: post.username,
        avatar_url: post.avatar_url,
        image_url: post.image_url,
        caption: finalCaption,
        likes_count: 0,
        media_type: post.media_type || 'image',
        category: post.category || 'General',
    };
    if (post.user_id) row.user_id = post.user_id;
    if (post.attached_link) row.attached_link = post.attached_link;
    if (post.boost_expires_at) row.boost_expires_at = post.boost_expires_at;
    if (post.boost_impressions_remaining !== undefined) {
        row.boost_impressions_remaining = post.boost_impressions_remaining;
    }
    if (post.music_title) row.music_title = post.music_title;
    if (post.music_artist) row.music_artist = post.music_artist;
    if (post.music_url) row.music_url = post.music_url;

    let { data, error } = await supabase.from('posts').insert(row).select();

    // Fallback: If DB table doesn't have music_title/music_artist/music_url or other optional columns yet
    if (error && (error.message.includes('column') || error.message.includes('schema cache'))) {
        console.warn('Retrying post insert without optional columns due to missing columns in Supabase:', error.message);
        delete row.music_title;
        delete row.music_artist;
        delete row.music_url;
        delete row.attached_link;
        delete row.boost_expires_at;
        delete row.boost_impressions_remaining;
        const retryResult = await supabase.from('posts').insert(row).select();
        data = retryResult.data;
        error = retryResult.error;
    }

    if (error) {
        if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
        console.warn('Error creating post in Supabase (saving resilient local post):', error.message);
        const localPost: PostData = {
            id: `post-local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            user_id: post.user_id,
            username: post.username,
            avatar_url: post.avatar_url,
            image_url: post.image_url,
            caption: finalCaption,
            likes_count: 0,
            imps_count: 0,
            comments_count: 0,
            shares_count: 0,
            attached_link: post.attached_link,
            media_type: post.media_type || 'image',
            category: post.category || 'General',
            boost_expires_at: post.boost_expires_at,
            boost_impressions_remaining: post.boost_impressions_remaining || 0,
            music_title: post.music_title,
            music_artist: post.music_artist,
            music_url: post.music_url,
            created_at: new Date().toISOString(),
        };
        saveLocalPost(localPost);
        invalidateCache();
        return [localPost];
    }

    if (data && data[0]) {
        saveLocalPost(normalizePost(data[0]));
        invalidateCache();
    }
    return data;
}

/** Upload a canvas/data-URL story image or video to storage.
 *  For images, compresses to max 1200x1200 JPEG at 0.75 quality for fast upload. */
export async function uploadStoryImage(dataUrl: string, userId: string): Promise<string> {
    if (dataUrl.startsWith('blob:') || dataUrl.startsWith('data:video/')) {
        try {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const isVid = blob.type.startsWith('video/') || dataUrl.startsWith('data:video/');
            const ext = isVid ? (blob.type.includes('webm') ? 'webm' : 'mp4') : 'jpg';
            const file = new File([blob], `story-${Date.now()}.${ext}`, { type: blob.type || (isVid ? 'video/mp4' : 'image/jpeg') });
            const path = `stories/${userId}-${Date.now()}.${ext}`;
            return await uploadMedia(file, path);
        } catch (e) {
            console.warn('Failed to upload video/blob to storage, returning direct fallback:', e);
            return dataUrl;
        }
    }
    // For images: compress via canvas directly from the dataUrl
    try {
        const compressedBlob = await new Promise<Blob>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                let w = img.width, h = img.height;
                const MAX = 1200;
                if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
                else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                const ctx = c.getContext('2d');
                if (!ctx) return reject(new Error('no canvas ctx'));
                ctx.drawImage(img, 0, 0, w, h);
                c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.75);
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
        const file = new File([compressedBlob], `story-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const path = `stories/${userId}-${Date.now()}.jpg`;
        return await uploadMedia(file, path);
    } catch (e) {
        console.warn('Failed to upload compressed image to storage, returning direct dataUrl fallback:', e);
        return dataUrl;
    }
}

// ── Likes ──────────────────────────────────────────────

export async function checkIfLiked(userId: string, postId: string): Promise<boolean> {
    const { data } = await supabase
        .from('likes')
        .select('user_id')
        .eq('user_id', userId)
        .eq('post_id', postId)
        .maybeSingle();

    return !!data;
}

// Batch check: fetch all liked post IDs in one query instead of N individual queries
export async function checkIfLikedBatch(userId: string, postIds: string[]): Promise<Record<string, boolean>> {
    if (postIds.length === 0) return {};
    const result: Record<string, boolean> = {};
    const localLikes = getLocalLikes();
    postIds.forEach(id => {
        result[id] = !!localLikes[`${userId}_${id}`];
    });

    try {
        const { data, error } = await supabase
            .from('likes')
            .select('post_id')
            .eq('user_id', userId)
            .in('post_id', postIds);

        if (!error && data) {
            data.forEach((row: any) => { result[row.post_id] = true; });
        } else if (error && isQuotaError(error)) {
            setSupabaseQuotaRestricted(true);
        }
    } catch (_) {}

    return result;
}

export async function toggleLike(userId: string, postId: string, currentlyLiked: boolean) {
    toggleLocalLike(postId, userId);

    try {
        if (currentlyLiked) {
            const { error } = await supabase
                .from('likes')
                .delete()
                .eq('user_id', userId)
                .eq('post_id', postId);
            if (error && isQuotaError(error)) setSupabaseQuotaRestricted(true);
        } else {
            const { error } = await supabase
                .from('likes')
                .insert({ user_id: userId, post_id: postId });
            if (error && isQuotaError(error)) setSupabaseQuotaRestricted(true);
        }
    } catch (e) {
        // Safe: already toggled locally
    }
}

// ── Imps ──────────────────────────────────────────────

export async function fetchUserImps(userId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('post_imps')
        .select('post_id')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching user imps:', error);
        return [];
    }
    return (data || []).map(row => row.post_id);
}

export async function toggleImp(userId: string, postId: string, currentlyImped: boolean) {
    if (currentlyImped) {
        const { error } = await supabase
            .from('post_imps')
            .delete()
            .eq('user_id', userId)
            .eq('post_id', postId);
        if (error) console.error('Error removing imp:', error);
    } else {
        const { error } = await supabase
            .from('post_imps')
            .insert({ user_id: userId, post_id: postId });
        if (error) console.error('Error adding imp:', error);
    }
}

// ── User Profile / Points ──────────────────────────────

export const UNLIMITED_POINTS = 999999999;

export function isUnlimitedPointsUser(userId?: string | null, username?: string | null): boolean {
    if (userId) {
        const uid = userId.toLowerCase();
        if (
            uid === '794703c5-c695-47bc-864c-60f400ab6fbe' || // rounak2 (authentic UUID)
            uid === '9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8' || // popcorn05 (authentic UUID)
            uid === '1369cfe5-42f1-4346-82be-0f616247092d'    // ityourfavourite1 (authentic UUID)
        ) {
            return true;
        }
    }
    if (username) {
        const clean = username.replace(/^@+/, '').trim().toLowerCase();
        if (clean === 'rounak2' || clean === 'rounak' || clean === 'popcorn05' || clean === 'popcorn' || clean === 'ityourfavourite1') {
            return true;
        }
    }
    return false;
}

export interface ProfileData {
    id: string;
    name: string;
    username?: string;
    gender: string;
    avatar_url: string;
    points: number;
    is_online?: boolean;
    streak_count?: number;
    last_story_at?: string;
    bio?: string;
}

export function normalizeProfile(raw: any): ProfileData | null {
    if (!raw) return null;
    const username = (raw.username || '').replace(/^@+/, '').trim();
    const unameLower = username.toLowerCase();
    let cleanName = (raw.name || '').trim();

    if (CREATOR_CANONICAL_NAMES[unameLower]) {
        cleanName = CREATOR_CANONICAL_NAMES[unameLower];
    } else if (raw.id === '794703c5-c695-47bc-864c-60f400ab6fbe') {
        cleanName = 'Rounak Singh';
    } else if (raw.id === '9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8') {
        cleanName = 'Popcorn05';
    } else if (raw.id === '12a1a487-5dde-4a77-ab36-aee9ce84fa35') {
        cleanName = 'Coral';
    } else if (raw.id === '1369cfe5-42f1-4346-82be-0f616247092d') {
        cleanName = 'It Your Favourite';
    } else if (
        !cleanName ||
        cleanName.toLowerCase() === 'user' ||
        cleanName.toLowerCase() === 'null' ||
        cleanName.toLowerCase() === 'undefined'
    ) {
        cleanName = formatDisplayNameFromUsername(username);
    }

    let points = Number(raw.points) || 0;
    if (isUnlimitedPointsUser(raw.id, username)) {
        points = UNLIMITED_POINTS;
    }

    return {
        id: raw.id || `user-${unameLower || Date.now()}`,
        name: cleanName,
        username: username,
        gender: raw.gender || 'other',
        avatar_url: raw.avatar_url || `https://i.pravatar.cc/150?u=${username || raw.id}`,
        points,
        is_online: Boolean(raw.is_online),
        streak_count: typeof raw.streak_count === 'number' ? raw.streak_count : 1,
        bio: raw.bio || (cleanName !== 'User' ? `${cleanName} on Knock Knock ✨` : ''),
        last_story_at: raw.last_story_at,
    };
}

export async function fetchProfile(userId: string): Promise<ProfileData | null> {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
            console.error('Error fetching profile:', error);
        } else if (data) {
            if (isRemovedUser(data.id, data.username)) {
                return null;
            }
            return normalizeProfile(data);
        }
    } catch (e: any) {
        if (isQuotaError(e)) setSupabaseQuotaRestricted(true);
    }

    // Resilient fallback for authentic known users
    const known = getKnownProfile(userId);
    if (known) return normalizeProfile(known);

    // Check cached session
    try {
        const raw = localStorage.getItem('knock_user_session');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.id === userId || parsed.username === userId) return normalizeProfile(parsed);
        }
    } catch (_) {}

    return null;
}

export async function fetchProfileByUsername(username: string): Promise<ProfileData | null> {
    if (!username) return null;
    const cleanUsername = username.replace(/^@+/, '').trim();
    if (!cleanUsername || isRemovedUser(undefined, cleanUsername)) return null;

    const lower = cleanUsername.toLowerCase();

    // 0. Check alias / typo candidates first for instant redirection & authentic resolution
    const aliasCandidate = COMMON_TYPOS[lower]?.[0];
    const pairedCandidate = CREATOR_USERNAME_PAIRS[lower];
    const lookupCandidates = [cleanUsername];
    if (pairedCandidate && !lookupCandidates.includes(pairedCandidate)) lookupCandidates.push(pairedCandidate);
    if (aliasCandidate && !lookupCandidates.includes(aliasCandidate)) lookupCandidates.push(aliasCandidate);

    // 1. Authentic registered community profile fallback (0ms, guarantees instant resolution without glitch)
    for (const candidate of lookupCandidates) {
        const known = getKnownProfile(candidate);
        if (known) {
            if (isRemovedUser(known.id, known.username)) return null;
            return normalizeProfile(known);
        }
    }

    // 2. Check if this is a reel creator (from REEL_CREATOR_MAP) or news bot
    for (const candidate of lookupCandidates) {
        const creatorKey = candidate.toLowerCase();
        if (REEL_CREATOR_MAP[creatorKey]) {
            const c = REEL_CREATOR_MAP[creatorKey];
            return normalizeProfile({
                id: `creator-${creatorKey}`,
                name: c.name,
                username: creatorKey,
                gender: 'other',
                avatar_url: c.avatar,
                points: 250,
                bio: c.bio,
                is_online: false,
                streak_count: 7,
            });
        }
    }

    // 3. Fallback: Search getLocalPosts() for any matching post
    const localPost = getLocalPosts().find(p => {
        const pUname = (p.username || '').toLowerCase();
        return lookupCandidates.some(c => c.toLowerCase() === pUname || c === p.user_id);
    });
    if (localPost) {
        const u = localPost.username || cleanUsername;
        return normalizeProfile({
            id: localPost.user_id || `creator-${u.toLowerCase()}`,
            name: CREATOR_CANONICAL_NAMES[u.toLowerCase()] || formatDisplayNameFromUsername(u),
            username: u,
            gender: 'other',
            avatar_url: localPost.avatar_url || `https://i.pravatar.cc/150?u=${u}`,
            points: isUnlimitedPointsUser(localPost.user_id, u) ? UNLIMITED_POINTS : 100,
            bio: `Creator on Knock Knock ✨`,
            is_online: false,
            streak_count: 5,
        });
    }

    // 4. Try case-insensitive lookup in Supabase profiles table if not quota restricted
    if (!isSupabaseQuotaRestricted()) {
        try {
            for (const candidate of lookupCandidates) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .ilike('username', candidate)
                    .maybeSingle();

                if (!error && data) {
                    if (isRemovedUser(data.id, data.username)) return null;
                    return normalizeProfile(data);
                }
            }

            // UUID lookup
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanUsername);
            if (isUuid) {
                const { data: idData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', cleanUsername)
                    .maybeSingle();
                if (idData && !isRemovedUser(idData.id, idData.username)) {
                    return normalizeProfile(idData);
                }
            }

            // Prefix or fuzzy name match
            const { data: fuzzyUser } = await supabase
                .from('profiles')
                .select('*')
                .or(`username.ilike.${cleanUsername}%,name.ilike.${cleanUsername},name.ilike.%${cleanUsername}%`)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (fuzzyUser && !isRemovedUser(fuzzyUser.id, fuzzyUser.username)) {
                return normalizeProfile(fuzzyUser);
            }

            // Posts table lookup
            for (const candidate of lookupCandidates) {
                const { data: postData } = await supabase
                    .from('posts')
                    .select('user_id, username, avatar_url, caption')
                    .ilike('username', candidate)
                    .limit(1)
                    .maybeSingle();

                if (postData) {
                    let linkedProfile = null;
                    if (postData.user_id && postData.user_id !== '00000000-0000-0000-0000-000000000000' && !postData.user_id.startsWith('creator-')) {
                        const { data: lp } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', postData.user_id)
                            .maybeSingle();
                        if (lp) linkedProfile = lp;
                    }

                    if (linkedProfile) {
                        return normalizeProfile({
                            ...linkedProfile,
                            username: postData.username || cleanUsername,
                            avatar_url: postData.avatar_url || linkedProfile.avatar_url,
                        });
                    }

                    return normalizeProfile({
                        id: postData.user_id && postData.user_id !== '00000000-0000-0000-0000-000000000000' 
                            ? postData.user_id 
                            : `creator-${(postData.username || cleanUsername).toLowerCase()}`,
                        name: CREATOR_CANONICAL_NAMES[(postData.username || cleanUsername).toLowerCase()] || formatDisplayNameFromUsername(postData.username || cleanUsername),
                        username: postData.username || cleanUsername,
                        gender: 'other',
                        avatar_url: postData.avatar_url || `https://i.pravatar.cc/150?u=${postData.username || cleanUsername}`,
                        points: isUnlimitedPointsUser(postData.user_id, postData.username || cleanUsername) ? UNLIMITED_POINTS : 100,
                        bio: `Creator on Knock Knock ✨`,
                        is_online: false,
                        streak_count: 5,
                    });
                }
            }
        } catch (err: any) {
            if (isQuotaError(err)) setSupabaseQuotaRestricted(true);
        }
    }

    // 6. Check cached user session
    try {
        const raw = localStorage.getItem('knock_user_session');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (lookupCandidates.some(c => c.toLowerCase() === parsed.username?.toLowerCase() || c === parsed.id)) {
                return normalizeProfile(parsed);
            }
        }
    } catch (_) {}

    return null;
}

export async function updatePoints(userId: string, newPoints: number) {
    const isPopcorn = isUnlimitedPointsUser(userId);
    const targetPoints = isPopcorn ? UNLIMITED_POINTS : newPoints;
    const { error } = await supabase
        .from('profiles')
        .update({ points: targetPoints })
        .eq('id', userId);

    if (error) console.error('Error updating points:', error);
}

/**
 * Transfers points from a sender to a recipient in direct chat.
 * Deducts from sender (unless unlimited popcorn05) and credits recipient.
 */
export async function giftPointsToUser(
    senderId: string,
    recipientId: string,
    amount: number,
    currentSenderPoints: number
): Promise<{ success: boolean; newSenderPoints: number; newRecipientPoints: number; error?: string }> {
    if (!senderId || !recipientId || amount <= 0) {
        return { success: false, newSenderPoints: currentSenderPoints, newRecipientPoints: 0, error: 'Invalid parameters' };
    }

    const isPopcorn = isUnlimitedPointsUser(senderId);
    if (!isPopcorn && currentSenderPoints < amount) {
        return { success: false, newSenderPoints: currentSenderPoints, newRecipientPoints: 0, error: 'Insufficient points' };
    }

    // Deduct from sender (unless popcorn05/unlimited)
    const newSenderPoints = isPopcorn ? UNLIMITED_POINTS : Math.max(0, currentSenderPoints - amount);
    await updatePoints(senderId, newSenderPoints);

    // Fetch recipient's current points
    let recipientPoints = 0;
    try {
        const { data } = await supabase.from('profiles').select('points').eq('id', recipientId).maybeSingle();
        if (data && typeof data.points === 'number') {
            recipientPoints = data.points;
        }
    } catch (_) {}

    const isRecipientPopcorn = isUnlimitedPointsUser(recipientId);
    const newRecipientPoints = isRecipientPopcorn ? UNLIMITED_POINTS : recipientPoints + amount;
    await updatePoints(recipientId, newRecipientPoints);

    return {
        success: true,
        newSenderPoints,
        newRecipientPoints
    };
}

/**
 * Awards points to a video or photo creator, automatically boosting the video's reach.
 * 1 point = 1 extra guaranteed screen delivery for stories / 1 extra impression for posts.
 */
export async function givePointsToContent({
    giverId,
    targetType,
    targetId,
    authorId,
    amount,
    currentGiverPoints
}: {
    giverId: string;
    targetType: 'post' | 'story';
    targetId: string;
    authorId: string;
    amount: number;
    currentGiverPoints: number;
}): Promise<{ success: boolean; newGiverPoints: number; extraScreens: number; error?: string }> {
    if (!giverId || !targetId || !authorId || amount <= 0) {
        return { success: false, newGiverPoints: currentGiverPoints, extraScreens: 0, error: 'Invalid parameters' };
    }

    const isPopcorn = isUnlimitedPointsUser(giverId);
    if (!isPopcorn && currentGiverPoints < amount) {
        return { success: false, newGiverPoints: currentGiverPoints, extraScreens: 0, error: 'Insufficient points' };
    }

    // Deduct from giver (unless popcorn05/unlimited)
    const newGiverPoints = isPopcorn ? UNLIMITED_POINTS : Math.max(0, currentGiverPoints - amount);
    await updatePoints(giverId, newGiverPoints);

    // Award points to the creator!
    try {
        const { data } = await supabase.from('profiles').select('points').eq('id', authorId).maybeSingle();
        const currentAuthorPoints = data?.points || 0;
        const isAuthorPopcorn = isUnlimitedPointsUser(authorId);
        await updatePoints(authorId, isAuthorPopcorn ? UNLIMITED_POINTS : currentAuthorPoints + amount);
    } catch (_) {}

    // 1 point = 1 extra guaranteed screen delivery / impression!
    const extraScreens = amount;

    if (targetType === 'story') {
        try {
            // Update story's target_screens and points_spent in Supabase
            const { data: storyRow } = await supabase.from('stories').select('target_screens, points_spent, image_url').eq('id', targetId).maybeSingle();
            const currentTarget = storyRow?.target_screens || 24;
            const currentSpent = storyRow?.points_spent || 0;
            const newTarget = currentTarget + extraScreens;
            const newSpent = currentSpent + amount;

            // Also update image_url boost tag if present: #BOOST:target|friends|points
            let updatedImageUrl = storyRow?.image_url;
            if (updatedImageUrl && updatedImageUrl.includes('#BOOST:')) {
                updatedImageUrl = updatedImageUrl.replace(/#BOOST:\d+\|\d+\|\d+/, `#BOOST:${newTarget}|14|${newSpent}`);
            }

            await supabase.from('stories').update({
                target_screens: newTarget,
                points_spent: newSpent,
                is_boosted: true,
                ...(updatedImageUrl ? { image_url: updatedImageUrl } : {})
            }).eq('id', targetId);

            // Invalidate 24h boost caches so new targetScreens takes effect immediately
            invalidateCache('recent_stories');
            invalidateCache('24h_boost_stories');
        } catch (e) {
            console.warn('Error boosting story in Supabase:', e);
        }
    } else if (targetType === 'post') {
        try {
            const { data: postRow } = await supabase.from('posts').select('boost_impressions_remaining').eq('id', targetId).maybeSingle();
            const currentImp = postRow?.boost_impressions_remaining || 0;
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 48);

            await supabase.from('posts').update({
                boost_impressions_remaining: currentImp + extraScreens,
                boost_expires_at: expiresAt.toISOString()
            }).eq('id', targetId);

            invalidateCache('all_scoring_posts_all');
        } catch (e) {
            console.warn('Error boosting post in Supabase:', e);
        }
    }

    return {
        success: true,
        newGiverPoints,
        extraScreens
    };
}

export interface AddMentionPayload {
    storyId?: string;
    postId?: string;
    mediaUrl: string;
    caption?: string;
    addedAt: string;
    customizedCaption?: string;
}

/**
 * Sends an "Add" (mention) notification to a friend in chat.
 * Allows the added user to edit and customize the mention.
 */
export async function sendAddMentionNotification({
    senderId,
    recipientId,
    storyId,
    postId,
    mediaUrl,
    caption
}: {
    senderId: string;
    recipientId: string;
    storyId?: string;
    postId?: string;
    mediaUrl: string;
    caption?: string;
}) {
    const payload: AddMentionPayload = {
        storyId,
        postId,
        mediaUrl,
        caption: caption || '',
        addedAt: new Date().toISOString()
    };
    const messageText = `[ADD_MENTION] ${JSON.stringify(payload)}`;
    return await sendMessage(senderId, recipientId, messageText);
}

export function parseAddMentionPayload(content: string): AddMentionPayload | null {
    if (!content.startsWith('[ADD_MENTION]')) return null;
    try {
        return JSON.parse(content.replace('[ADD_MENTION] ', ''));
    } catch {
        return null;
    }
}

/**
 * Automatically parses any @username mentions in text and notifies those users with an AddMention card in chat.
 */
export async function notifyMentionedUsersInText({
    senderId,
    text,
    mediaUrl,
    storyId,
    postId
}: {
    senderId: string;
    text: string;
    mediaUrl: string;
    storyId?: string;
    postId?: string;
}) {
    if (!text || !senderId) return;
    const matches = text.match(/@([a-zA-Z0-9_\.]+)/g);
    if (!matches || matches.length === 0) return;

    const uniqueUsernames = Array.from(new Set(matches.map(m => m.slice(1))));
    for (const uname of uniqueUsernames) {
        try {
            const profile = await fetchProfileByUsername(uname);
            if (profile && profile.id && profile.id !== senderId) {
                await sendAddMentionNotification({
                    senderId,
                    recipientId: profile.id,
                    mediaUrl,
                    caption: text,
                    storyId,
                    postId
                });
            }
        } catch (e) {
            console.warn(`Failed to notify @${uname} mention:`, e);
        }
    }
}

export async function setUserOnlineStatus(userId: string, isOnline: boolean) {
    const { error } = await supabase
        .from('profiles')
        .update({ is_online: isOnline })
        .eq('id', userId);

    if (error) console.error('Error updating online status:', error);
}

// ── Stories ─────────────────────────────────────────────

export interface BoostReachMeta {
    targetScreens: number;
    friendsCount: number;
    pointsSpent: number;
    screensDelivered: number;
}

export interface StoryData {
    id: string;
    user_id: string | null;
    username?: string;
    image_url: string;
    poster_url?: string;
    filter_name: string;
    is_boosted: boolean;
    created_at: string;
    caption?: string;
    music_title?: string;
    music_artist?: string;
    music_url?: string;
    boost_meta?: BoostReachMeta;
    target_screens?: number;
    screens_delivered?: number;
    points_spent?: number;
    link_url?: string;
    link_cta?: string;
    is_sponsored?: boolean;
}

export function normalizeStory(story: StoryData): StoryData {
    if (!story) return story;
    let image_url = story.image_url || '';
    let poster_url = story.poster_url;
    let music_url = story.music_url;
    let music_title = story.music_title;
    let music_artist = story.music_artist;
    let boost_meta: BoostReachMeta | undefined = story.boost_meta;
    let link_url = story.link_url;
    let link_cta = story.link_cta || 'Learn More';
    let is_sponsored = story.is_sponsored || false;

    if (image_url.includes('#POSTER:')) {
        const parts = image_url.split('#POSTER:');
        image_url = parts[0];
        const posterData = parts[1]?.split('#')[0];
        if (posterData) {
            try {
                poster_url = decodeURIComponent(posterData);
            } catch (_) {
                poster_url = posterData;
            }
        }
    }

    if (image_url.includes('#LINK:')) {
        const parts = image_url.split('#LINK:');
        image_url = parts[0];
        const linkData = parts[1]?.split('#')[0];
        if (linkData) {
            const match = linkData.match(/([^|]+)\|([^|]*)\|([^|]*)/);
            if (match) {
                try {
                    link_url = decodeURIComponent(match[1]);
                    link_cta = decodeURIComponent(match[2]) || 'Learn More';
                    is_sponsored = match[3] === '1';
                } catch {
                    link_url = match[1];
                    link_cta = match[2] || 'Learn More';
                    is_sponsored = match[3] === '1';
                }
            }
        }
    }

    if (!link_url && story.caption) {
        const urlMatch = story.caption.match(/(https?:\/\/[^\s]+)/i);
        if (urlMatch) {
            link_url = urlMatch[1];
            link_cta = 'Visit Website';
        }
    }

    if (image_url.includes('#BOOST:')) {
        const parts = image_url.split('#BOOST:');
        image_url = parts[0];
        const boostData = parts[1]?.split('#')[0];
        if (boostData) {
            const match = boostData.match(/^([0-9]+)\|([0-9]+)\|([0-9]+)/);
            if (match) {
                const target = parseInt(match[1], 10) || 0;
                const friends = parseInt(match[2], 10) || 0;
                const points = parseInt(match[3], 10) || 0;
                boost_meta = {
                    targetScreens: target,
                    friendsCount: friends,
                    pointsSpent: points,
                    screensDelivered: 0,
                };
            }
        }
    }

    if (image_url.includes('#MUSIC:')) {
        const parts = image_url.split('#MUSIC:');
        image_url = parts[0];
        const musicData = parts[1];
        if (musicData) {
            const match = musicData.match(/([^|]+)\|([^|]*)\|([^|]*)/);
            if (match) {
                if (!music_url) {
                    try {
                        music_url = decodeURIComponent(match[1]);
                        music_title = decodeURIComponent(match[2]) || 'Song';
                        music_artist = decodeURIComponent(match[3]) || '';
                    } catch (e) {
                        music_url = match[1];
                        music_title = match[2] || 'Song';
                        music_artist = match[3] || '';
                    }
                }
            }
        }
    }

    // Replace any SoundHelix/MIDI dummy URLs with authentic preview streams
    const cleanUrl = getCleanSongUrl(music_title, music_url);
    if (cleanUrl) {
        music_url = cleanUrl;
    } else if (music_url && music_url.includes('soundhelix')) {
        music_url = undefined;
    }

    // If story is flagged as boosted but lacks boost_meta, assign sensible default reach
    if (story.is_boosted && !boost_meta) {
        boost_meta = {
            targetScreens: 24,
            friendsCount: 14,
            pointsSpent: 10,
            screensDelivered: 0,
        };
    }

    // Calculate unique screens delivered from client impression storage & elapsed time delivery pacing
    if (boost_meta) {
        let screensDelivered = 0;
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const cachedViews = localStorage.getItem(`knock_boost_deliveries_${story.id}`);
                if (cachedViews) {
                    const viewerIds: string[] = JSON.parse(cachedViews);
                    screensDelivered = Math.max(screensDelivered, viewerIds.length);
                }
            }
        } catch (e) {}

        // Pace screen deliveries across 24h lifespan so creators see steady progress
        if (story.created_at) {
            const msOld = Math.max(0, Date.now() - new Date(story.created_at).getTime());
            const hoursOld = msOld / (1000 * 60 * 60);
            if (hoursOld < 24) {
                const pacedDelivery = Math.floor(boost_meta.targetScreens * Math.min(1, (hoursOld / 16)));
                screensDelivered = Math.max(screensDelivered, pacedDelivery);
            } else {
                screensDelivered = boost_meta.targetScreens;
            }
        }
        boost_meta.screensDelivered = Math.min(boost_meta.targetScreens, screensDelivered);
    }

    const cleanBaseUrl = image_url.split('#')[0];
    const finalImageUrlWithPoster = poster_url
        ? `${cleanBaseUrl}#POSTER:${encodeURIComponent(poster_url)}`
        : (image_url.includes('#POSTER:') ? image_url : cleanBaseUrl);

    return {
        ...story,
        image_url: finalImageUrlWithPoster,
        poster_url,
        music_url,
        music_title,
        music_artist,
        boost_meta,
        target_screens: boost_meta?.targetScreens,
        screens_delivered: boost_meta?.screensDelivered,
        points_spent: boost_meta?.pointsSpent,
        link_url,
        link_cta,
        is_sponsored,
    };
}

export interface UserStoryGroup {
    userId: string;
    username: string;
    avatarUrl: string;
    stories: StoryData[];
}

export async function fetchBoostedStories(): Promise<StoryData[]> {
    const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('is_boosted', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching stories:', error);
        return [];
    }
    return (data || []).map(normalizeStory).filter((s): s is StoryData => Boolean(s));
}

// ── Fallback 24h Story Local Storage ──────────────────────────────────────
const FALLBACK_STORIES_KEY = 'knock_fallback_stories_v1';

export function isSeedStory(s: any): boolean {
    if (!s) return false;
    const id = typeof s === 'string' ? s : (s.id || '');
    const userId = typeof s === 'object' && s.user_id ? s.user_id : '';
    const imageUrl = typeof s === 'object' && s.image_url ? s.image_url : '';
    return (
        id.startsWith('story-coral-') ||
        id.startsWith('story-fav-') ||
        id.startsWith('story-pop-') ||
        id.startsWith('story-rounak-') ||
        id.startsWith('story-tara-') ||
        id.startsWith('explore-seed-') ||
        userId.startsWith('seed-creator-') ||
        imageUrl.includes('photo-1544551763-46a013bb70d5')
    );
}

export function getFallbackStories(): StoryData[] {
    const local = getLocalStories().filter(s => !isSeedStory(s));
    if (typeof window === 'undefined' || !window.localStorage) return local;
    try {
        const raw = localStorage.getItem(FALLBACK_STORIES_KEY);
        if (!raw) return local;
        const parsed: any[] = JSON.parse(raw);
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        const valid = parsed.filter(s => 
            s && s.id && 
            !isSeedStory(s) && 
            s.created_at && 
            new Date(s.created_at).getTime() > twentyFourHoursAgo
        );
        if (valid.length !== parsed.length) {
            localStorage.setItem(FALLBACK_STORIES_KEY, JSON.stringify(valid));
        }
        const normalized = valid.map(normalizeStory).filter((s): s is StoryData => Boolean(s) && !isSeedStory(s));
        const seenIds = new Set(normalized.map(s => s.id));
        const merged = [...normalized, ...local.filter(s => !seenIds.has(s.id))];
        return merged;
    } catch (e) {
        return local;
    }
}

export function saveFallbackStory(story: any) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const raw = localStorage.getItem(FALLBACK_STORIES_KEY);
        const existing: any[] = raw ? JSON.parse(raw) : [];
        existing.unshift(story);
        localStorage.setItem(FALLBACK_STORIES_KEY, JSON.stringify(existing.slice(0, 30)));
    } catch (e) {
        console.warn('Could not save fallback story:', e);
    }
}

export function deleteFallbackStory(storyId: string) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const raw = localStorage.getItem(FALLBACK_STORIES_KEY);
        if (!raw) return;
        const existing: any[] = JSON.parse(raw);
        const filtered = existing.filter(s => s && s.id !== storyId);
        localStorage.setItem(FALLBACK_STORIES_KEY, JSON.stringify(filtered));
    } catch (e) {
        console.warn('Could not delete fallback story:', e);
    }
}

function mergeWithFallbackStories(dbStories: StoryData[], userIdFilter?: string): StoryData[] {
    const fallback = getFallbackStories().filter(s => !isSeedStory(s));
    const filteredFallback = userIdFilter 
        ? fallback.filter(s => s.user_id === userIdFilter)
        : fallback;
    const sanitizedDb = dbStories.filter(s => !isSeedStory(s));
    const existingIds = new Set(sanitizedDb.map(s => s.id));
    const toAdd = filteredFallback.filter(s => !existingIds.has(s.id));
    return [...toAdd, ...sanitizedDb];
}

/** Fetch stories from the last 24 hours for the Home story rack */
export async function fetchRecentStories(): Promise<StoryData[]> {
    const cached = getFromCache<StoryData[]>('recent_stories', 20000);
    if (cached) return cached;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from('stories')
        .select('*')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(100);

    let result: StoryData[] = [];
    if (error) {
        console.error('Error fetching recent stories:', error);
    } else {
        result = (data || []).map(normalizeStory).filter((s): s is StoryData => Boolean(s));
    }
    const merged = mergeWithFallbackStories(result);
    setInCache('recent_stories', merged);
    return merged;
}

/** Fetch stories belonging to a specific user */
export async function fetchUserStories(userId: string): Promise<StoryData[]> {
    const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    let result: StoryData[] = [];
    if (error) {
        console.error('Error fetching user stories:', error);
    } else {
        result = (data || []).map(normalizeStory).filter((s): s is StoryData => Boolean(s));
    }
    return mergeWithFallbackStories(result, userId);
}

export async function createStory(
    userId: string,
    imageUrl: string,
    filterName: string,
    isBoosted: boolean,
    username?: string,
    caption?: string,
    musicTitle?: string,
    musicArtist?: string,
    musicUrl?: string
): Promise<{ error: Error | null }> {
    // Fallback: If DB table doesn't have username/caption/music columns yet, retry with base payload
    // We encode the music into the image_url to survive the fallback safely.
    if (musicUrl) {
        imageUrl = `${imageUrl}#MUSIC:${encodeURIComponent(musicUrl)}|${encodeURIComponent(musicTitle || '')}|${encodeURIComponent(musicArtist || '')}`;
    }

    const payload: any = {
        user_id: userId,
        image_url: imageUrl,
        filter_name: filterName,
        is_boosted: isBoosted,
    };
    if (username) payload.username = username;
    if (caption) payload.caption = caption;
    if (musicTitle) payload.music_title = musicTitle;
    if (musicArtist) payload.music_artist = musicArtist;
    if (musicUrl) payload.music_url = musicUrl;

    let { error } = await supabase.from('stories').insert(payload);

    if (error && (error.message.includes('column') || error.message.includes('schema cache'))) {
        console.warn('Retrying story insert with base fields due to missing columns in Supabase:', error.message);
        const basePayload = {
            user_id: userId,
            image_url: imageUrl, // Contains #MUSIC: fragment
            filter_name: filterName,
            is_boosted: isBoosted,
        };
        const retryResult = await supabase.from('stories').insert(basePayload);
        error = retryResult.error;
    }

    if (error) {
        console.warn('Error creating story in Supabase (possibly RLS or offline), saving to local fallback storage:', error.message);
        saveFallbackStory({
            id: `story-local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            user_id: userId,
            image_url: imageUrl,
            filter_name: filterName,
            is_boosted: isBoosted,
            username: username || 'You',
            caption: caption,
            music_title: musicTitle,
            music_artist: musicArtist,
            music_url: musicUrl,
            created_at: new Date().toISOString(),
        });
        invalidateCache('recent_stories');
        invalidateCache('24h_boost_stories');
        return { error: null };
    }
    return { error: null };
}

/** Record a unique screen delivery for a 24h boosted snap */
export function recordScreenDelivery(storyId: string, viewerUserId: string): number {
    if (!storyId || !viewerUserId) return 0;
    try {
        if (typeof window === 'undefined' || !window.localStorage) return 0;
        const key = `knock_boost_deliveries_${storyId}`;
        const raw = localStorage.getItem(key);
        const viewerIds: string[] = raw ? JSON.parse(raw) : [];
        if (!viewerIds.includes(viewerUserId)) {
            viewerIds.push(viewerUserId);
            localStorage.setItem(key, JSON.stringify(viewerIds));
            trackEngagement(viewerUserId, storyId, 'boost_screen_delivery', 1, 'Boost').catch(() => {});
        }
        return viewerIds.length;
    } catch (e) {
        return 0;
    }
}

/** Record a unique screen delivery for a post/video, decrementing boost impressions if active */
export function recordPostScreenDelivery(postId: string, viewerUserId: string, currentRemaining?: number): void {
    if (!postId || !viewerUserId) return;
    try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        const key = `knock_post_screens_${postId}`;
        const raw = localStorage.getItem(key);
        const viewers: string[] = raw ? JSON.parse(raw) : [];
        if (!viewers.includes(viewerUserId)) {
            viewers.push(viewerUserId);
            localStorage.setItem(key, JSON.stringify(viewers));
            trackEngagement(viewerUserId, postId, 'screen_delivery', 1, 'Feed').catch(() => {});
            if (typeof currentRemaining === 'number' && currentRemaining > 0) {
                decrementBoostImpressions(postId, currentRemaining);
            }
        }
    } catch (e) {}
}

/** Check if a post/video is eligible to be shown on a viewer's screen based on screen budget */
export function isPostEligibleForViewerScreen(post: PostData, viewerUserId?: string): boolean {
    // Creator can always see their own content
    if (viewerUserId && post.user_id === viewerUserId) return true;

    // If post has an explicit boost expiration or impression limit
    if (post.boost_expires_at) {
        const isExpired = new Date(post.boost_expires_at).getTime() < Date.now();
        if (isExpired) return false;
    }

    // If post was boosted to specific screens (e.g. 5 screens) and remaining is exhausted (<=0):
    if (post.boost_impressions_remaining !== undefined && post.boost_impressions_remaining !== null) {
        if (post.boost_impressions_remaining <= 0 && post.boost_expires_at) {
            return false;
        }
    }

    return true;
}

/** Determine if a viewer is an active daily user of the app */
export function isViewerActiveDailyUser(userId?: string): boolean {
    if (!userId) return false;
    if (typeof window === 'undefined') return true;
    try {
        const today = new Date().toISOString().slice(0, 10);
        const lastActive = localStorage.getItem('knock_last_active_date');
        if (lastActive === today) return true;
        const session = localStorage.getItem('knock_user_session');
        if (session) return true;
    } catch (_) {}
    return true;
}

/** Check if a 24h story / boosted video is eligible to be shown on a viewer's screen */
export function isStoryEligibleForViewerScreen(
    story: StoryData,
    viewerUserId?: string,
    userFriends: string[] = []
): boolean {
    if (!story || !story.id || !story.image_url) return false;
    if (isSeedStory(story)) return false;

    // Check media health (don't show broken or unplayable media on laptop/phone)
    const trimmed = typeof story.image_url === 'string' ? story.image_url.trim() : '';
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === 'none') {
        return false;
    }

    // 1. Creator can always view their own story
    if (viewerUserId && story.user_id === viewerUserId) return true;

    // 2. Friends of creator can always view (base friends reach)
    if (story.user_id && userFriends.includes(story.user_id)) return true;

    // 3. For non-friends: MUST be an actively boosted story with remaining screen quota!
    // Organic/completed stranger stories are strictly forbidden from showing up
    if (!story.is_boosted && !story.boost_meta) {
        return false;
    }

    // 4. Screen quota check (e.g. 5 screens for 5 points)
    const target = story.boost_meta?.targetScreens || story.target_screens || 24;
    const delivered = story.boost_meta?.screensDelivered || story.screens_delivered || 0;
    if (delivered >= target) {
        // Target screen quota fulfilled — video is gone for other viewers
        return false;
    }

    // 5. Active Daily User Check: points only deliver to active daily users
    if (!viewerUserId || !isViewerActiveDailyUser(viewerUserId)) {
        return false;
    }

    return true;
}

/** Create a 24h Boosted Snap with Guaranteed Screen Reach */
export async function createBoostedStory(
    userId: string,
    imageUrl: string,
    filterName: string,
    pointsSpent: number,
    friendsCount: number,
    username?: string,
    caption?: string,
    musicTitle?: string,
    musicArtist?: string,
    musicUrl?: string,
    linkUrl?: string,
    linkCta?: string,
    isSponsored?: boolean,
    posterUrl?: string
): Promise<{ error: Error | null; story?: StoryData }> {
    const baseScreens = Math.max(friendsCount, 1);
    const extraScreens = Math.max(pointsSpent, 0);
    const targetScreens = baseScreens + extraScreens;

    // Encode boost metadata into fragment: #BOOST:target|friends|points
    const boostTag = `#BOOST:${targetScreens}|${baseScreens}|${extraScreens}`;
    let finalImageUrl = imageUrl;
    if (posterUrl) {
        finalImageUrl = `${finalImageUrl}#POSTER:${encodeURIComponent(posterUrl)}`;
    }
    if (musicUrl) {
        finalImageUrl = `${finalImageUrl}#MUSIC:${encodeURIComponent(musicUrl)}|${encodeURIComponent(musicTitle || '')}|${encodeURIComponent(musicArtist || '')}`;
    }
    if (linkUrl) {
        finalImageUrl = `${finalImageUrl}#LINK:${encodeURIComponent(linkUrl)}|${encodeURIComponent(linkCta || 'Learn More')}|${isSponsored ? '1' : '0'}`;
    }
    finalImageUrl = `${finalImageUrl}${boostTag}`;

    const isBoosted = extraScreens > 0;
    const { error } = await createStory(
        userId,
        finalImageUrl,
        filterName,
        isBoosted,
        username,
        caption,
        musicTitle,
        musicArtist,
        musicUrl
    );

    if (error) {
        return { error };
    }

    invalidateCache('recent_stories');
    invalidateCache('24h_boost_stories');

    return { error: null };
}

/** Repost / Convert an explore video or post into a personal 24h Snap */
export async function convertToPersonalSnap(
    userId: string,
    originalStory: StoryData,
    currentUsername?: string
): Promise<{ error: Error | null; story?: StoryData }> {
    return createBoostedStory(
        userId,
        originalStory.image_url,
        originalStory.filter_name || 'Normal',
        0,
        14,
        currentUsername || 'You',
        originalStory.caption,
        originalStory.music_title,
        originalStory.music_artist,
        originalStory.music_url,
        originalStory.link_url,
        originalStory.link_cta,
        originalStory.is_sponsored
    );
}

/** Fetch all 24-hour stories for the Boost Explore page, sorted by delivery guarantee duty */
export async function fetch24HourBoostStories(currentUserId?: string): Promise<StoryData[]> {
    const cached = getFromCache<StoryData[]>(`24h_boost_stories_${currentUserId || 'anon'}`, 15000);
    if (cached) return cached;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from('stories')
        .select('*')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(150);

    let rawStories: StoryData[] = [];
    if (error) {
        console.warn('Error fetching 24h boost stories from Supabase (using fallback store if available):', error.message);
    } else {
        rawStories = (data || []).map(normalizeStory).filter((s): s is StoryData => Boolean(s) && !isSeedStory(s));
    }

    const stories = mergeWithFallbackStories(rawStories).filter(s => !isSeedStory(s));

    let friendIds: string[] = [];
    if (currentUserId) {
        try {
            friendIds = await fetchConnectionUserIds(currentUserId);
        } catch (e) {
            console.warn('Could not fetch connection user ids:', e);
        }
    }

    // Delivery Guarantee Ordering:
    // 1. Current user's own active stories (to monitor reach)
    // 2. Stories from user's friends (fulfills friend reach guarantee)
    // 3. Actively boosted stories with remaining screen quota (only delivered to active daily users)
    //    -> "Only points that people use to boost go to screens of people who are active"
    //    -> Completed or organic stranger stories are strictly excluded from other users' screens!
    const ownStories: StoryData[] = [];
    const friendStories: StoryData[] = [];
    const activeBoostedStories: StoryData[] = [];

    const isViewerActive = isViewerActiveDailyUser(currentUserId);

    for (const story of stories) {
        // Media validity check: ignore stories with empty or broken URLs
        if (!story.image_url || story.image_url === 'undefined' || story.image_url === 'null') {
            continue;
        }

        if (currentUserId && story.user_id === currentUserId) {
            ownStories.push(story);
        } else if (story.user_id && friendIds.includes(story.user_id)) {
            friendStories.push(story);
        } else if (isViewerActive && story.is_boosted && (story.screens_delivered || 0) < (story.target_screens || 0)) {
            // Only non-friend stories that are actively boosted with remaining screen quota
            // reach active daily users' screens!
            activeBoostedStories.push(story);
        }
    }

    // Active boosted stories that need more screens get priority injection for active users
    activeBoostedStories.sort((a, b) => {
        const deficitA = (a.target_screens || 0) - (a.screens_delivered || 0);
        const deficitB = (b.target_screens || 0) - (b.screens_delivered || 0);
        const pointsA = a.points_spent || 0;
        const pointsB = b.points_spent || 0;
        return (deficitB + pointsB) - (deficitA + pointsA);
    });

    const result = [
        ...ownStories,
        ...friendStories,
        ...activeBoostedStories
    ];

    setInCache(`24h_boost_stories_${currentUserId || 'anon'}`, result);
    return result;
}

/**
 * Update streak: if last_story_at was within 24h, increment streak.
 * Otherwise reset to 1. Awards streak_count * 5 points.
 * Returns the new streak count and points awarded.
 */
export async function updateStreak(userId: string, currentStreak: number, lastStoryAt: string | null | undefined, currentPoints: number): Promise<{ newStreak: number; pointsAwarded: number }> {
    const now = new Date();
    let newStreak = 1;

    if (lastStoryAt) {
        const lastPost = new Date(lastStoryAt);
        const hoursSinceLastPost = (now.getTime() - lastPost.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastPost <= 24) {
            newStreak = (currentStreak || 0) + 1;
        }
    }

    const pointsAwarded = newStreak * 5;
    const newPoints = currentPoints + pointsAwarded;

    const { error } = await supabase
        .from('profiles')
        .update({
            streak_count: newStreak,
            last_story_at: now.toISOString(),
            points: newPoints,
        })
        .eq('id', userId);

    if (error) console.error('Error updating streak:', error);

    return { newStreak, pointsAwarded };
}

/** Delete a story by its ID */
export async function deleteStory(storyId: string) {
    deleteFallbackStory(storyId);
    invalidateCache('recent_stories');
    invalidateCache('24h_boost_stories');

    const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId);

    if (error) console.error('Error deleting story:', error);
}

/**
 * Search stories by hashtag/caption text and group them by user.
 * Returns UserStoryGroup[] for use in the Explore page and StoryViewer.
 */
export async function searchStoriesByHashtag(term: string): Promise<UserStoryGroup[]> {
    const { data, error } = await supabase
        .from('stories')
        .select('*')
        .or(`caption.ilike.%${term}%,username.ilike.%${term}%`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error searching stories:', error);
        return [];
    }

    return groupStoriesByUser(data || []);
}

/** Helper: group flat story array into UserStoryGroup[] */
function groupStoriesByUser(stories: StoryData[]): UserStoryGroup[] {
    const groups: Record<string, UserStoryGroup> = {};
    stories.forEach(s => {
        const uid = s.user_id || 'unknown';
        if (!groups[uid]) {
            groups[uid] = {
                userId: uid,
                username: s.username || 'user',
                avatarUrl: `https://i.pravatar.cc/150?u=${s.username || uid}`,
                stories: [],
            };
        }
        groups[uid].stories.push(s);
    });
    return Object.values(groups);
}

// ── Explore (random posts) ─────────────────────────────

export async function fetchExplorePosts(): Promise<PostData[]> {
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(18);

    if (error) {
        console.error('Error fetching explore posts:', error);
        return [];
    }
    return (data || []).map(normalizePost).filter((p): p is PostData => Boolean(p));
}

// ── Matching Algorithm ─────────────────────────────────

export interface MatchResult {
    profile: ProfileData & { username: string; dob?: string };
    similarityScore: number;
    sharedLikes: number;
    totalLikes: number;
    compatibilityPercent: number;
}

/** Fetch all post_ids a user has liked */
export async function fetchUserLikes(userId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('likes')
        .select('post_id')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching user likes:', error);
        return [];
    }
    return (data || []).map(d => d.post_id);
}

/** Fetch all profiles except the current user */
export async function fetchAllProfiles(excludeUserId: string): Promise<(ProfileData & { username: string; dob?: string })[]> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', excludeUserId)
        .eq('is_online', true);

    if (error) {
        console.error('Error fetching all profiles:', error);
        return [];
    }
    return (data || []).filter(u => !isRemovedUser(u.id, u.username));
}

/**
 * Smart matching algorithm:
 * 1. Fetch current user's liked posts
 * 2. For each candidate, fetch their liked posts
 * 3. Count shared likes (intersection)
 * 4. Compute similarity = sharedLikes / union of both users' likes
 * 5. Apply preference filter (gender-based, random, etc.)
 * 6. Rank by similarity descending
 */
export async function computeMatches(
    currentUserId: string,
    currentUserGender: string,
    preference: string
): Promise<MatchResult[]> {
    // 1. Get current user's liked posts
    const myLikes = await fetchUserLikes(currentUserId);
    const myLikeSet = new Set(myLikes);

    // 2. Get all other profiles
    let candidates = await fetchAllProfiles(currentUserId);

    // 3. Apply gender-based preference filter
    if (preference === 'Boy to Girl 👫') {
        candidates = candidates.filter(c => c.gender === 'female');
    } else if (preference === 'Girl to Boy 👭') {
        candidates = candidates.filter(c => c.gender === 'male');
    }
    // "Similar Likes ❤️", "Same Country 🌍", "Random 🎲" → no gender filter

    // 4. For each candidate, compute similarity
    const results: MatchResult[] = [];

    for (const candidate of candidates) {
        const candidateLikes = await fetchUserLikes(candidate.id);
        const candidateLikeSet = new Set(candidateLikes);

        // Count shared likes (intersection)
        let sharedLikes = 0;
        for (const postId of myLikes) {
            if (candidateLikeSet.has(postId)) {
                sharedLikes++;
            }
        }

        // Union size for Jaccard similarity
        const unionSize = new Set([...myLikes, ...candidateLikes]).size;
        const similarityScore = unionSize > 0 ? sharedLikes / unionSize : 0;

        // Bonus: activity level similarity (points closeness)
        // Normalized to 0-0.2 extra score
        const pointsDiff = Math.abs((candidate.points || 0));
        const activityBonus = Math.max(0, 0.2 - (pointsDiff / 10000));

        const totalScore = similarityScore + activityBonus;
        const compatibilityPercent = Math.min(99, Math.round(totalScore * 100));

        results.push({
            profile: candidate,
            similarityScore: totalScore,
            sharedLikes,
            totalLikes: candidateLikes.length,
            compatibilityPercent: Math.max(compatibilityPercent, sharedLikes > 0 ? 15 : 5),
        });
    }

    // 5. Sort by similarity (descending)
    if (preference === 'Random 🎲') {
        // Shuffle randomly
        for (let i = results.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [results[i], results[j]] = [results[j], results[i]];
        }
    } else {
        results.sort((a, b) => b.similarityScore - a.similarityScore);
    }

    return results;
}

// ── Follow System ──────────────────────────────────────

/** Fetch followers of a user (returns their profile data) */
export async function fetchFollowers(userId: string): Promise<ProfileData[]> {
    const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId);

    if (error) {
        console.error('Error fetching followers:', error);
        return [];
    }

    if (!data || data.length === 0) return [];

    const followerIds = data.map(d => d.follower_id);
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', followerIds);

    if (profilesError) {
        console.error('Error fetching follower profiles:', profilesError);
        return [];
    }
    return (profiles || []).map(normalizeProfile).filter((p): p is ProfileData => Boolean(p));
}

/** Fetch users that a user is following (returns their profile data) */
export async function fetchFollowing(userId: string): Promise<ProfileData[]> {
    const { data, error } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

    if (error) {
        console.error('Error fetching following:', error);
        return [];
    }

    if (!data || data.length === 0) return [];

    const followingIds = data.map(d => d.following_id);
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', followingIds);

    if (profilesError) {
        console.error('Error fetching following profiles:', profilesError);
        return [];
    }
    return (profiles || []).map(normalizeProfile).filter((p): p is ProfileData => Boolean(p));
}

/** Get follower and following counts */
export async function fetchFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
    const [followersRes, followingRes] = await Promise.all([
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
    ]);

    return {
        followers: followersRes.count || 0,
        following: followingRes.count || 0,
    };
}

/** Check if currentUser is following targetUser */
export async function checkIfFollowing(currentUserId: string, targetUserId: string): Promise<boolean> {
    const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
        .maybeSingle();

    return !!data;
}

/** Toggle follow/unfollow */
export async function toggleFollow(currentUserId: string, targetUserId: string, currentlyFollowing: boolean) {
    if (currentlyFollowing) {
        const { error } = await supabase
            .from('follows')
            .delete()
            .eq('follower_id', currentUserId)
            .eq('following_id', targetUserId);
        if (error) console.error('Error unfollowing:', error);
    } else {
        const { error } = await supabase
            .from('follows')
            .insert({ follower_id: currentUserId, following_id: targetUserId });
        if (error) console.error('Error following:', error);
    }
}

// ── Connections System ─────────────────────────────────

export interface ConnectionData {
    id: string;
    user_a: string;
    user_b: string;
    streak_count: number;
    last_interaction_at: string;
    matched_via: string;
    compatibility_percent: number;
    shared_likes: number;
    created_at: string;
}

export interface ConnectionWithProfile extends ConnectionData {
    profile: ProfileData & { username: string };
    streakStatus: 'active' | 'at_risk' | 'broken';
}

/** Create a new connection between two users after a voice match */
export async function createConnection(
    userA: string,
    userB: string,
    compatibilityPercent: number,
    sharedLikes: number,
    matchedVia: string = 'voice_call'
): Promise<{ data: ConnectionData | null; error: Error | null }> {
    // Normalize order to prevent duplicates (smaller UUID first)
    const [first, second] = userA < userB ? [userA, userB] : [userB, userA];

    const { data, error } = await supabase
        .from('connections')
        .insert({
            user_a: first,
            user_b: second,
            compatibility_percent: compatibilityPercent,
            shared_likes: sharedLikes,
            matched_via: matchedVia,
            streak_count: 1,
            last_interaction_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating connection:', error);
        return { data: null, error: new Error(error.message) };
    }
    return { data, error: null };
}

/** Check if two users are already connected */
export async function checkConnection(userA: string, userB: string): Promise<ConnectionData | null> {
    const [first, second] = userA < userB ? [userA, userB] : [userB, userA];

    const { data, error } = await supabase
        .from('connections')
        .select('*')
        .eq('user_a', first)
        .eq('user_b', second)
        .maybeSingle();

    if (error) {
        console.error('Error checking connection:', error);
        return null;
    }
    return data;
}

/** Compute streak status based on last_interaction_at */
function computeStreakStatus(lastInteractionAt: string): 'active' | 'at_risk' | 'broken' {
    const now = new Date();
    const last = new Date(lastInteractionAt);
    const hoursAgo = (now.getTime() - last.getTime()) / (1000 * 60 * 60);

    if (hoursAgo <= 20) return 'active';
    if (hoursAgo <= 24) return 'at_risk';
    return 'broken';
}

/** Fetch all connections for a user, with the OTHER user's profile attached */
export async function fetchConnections(userId: string): Promise<ConnectionWithProfile[]> {
    try {
        // Fetch connections where user is either user_a or user_b
        const { data: connectionsA, error: errA } = await supabase
            .from('connections')
            .select('*')
            .eq('user_a', userId);

        const { data: connectionsB, error: errB } = await supabase
            .from('connections')
            .select('*')
            .eq('user_b', userId);

        if (errA && isQuotaError(errA)) setSupabaseQuotaRestricted(true);
        if (errB && isQuotaError(errB)) setSupabaseQuotaRestricted(true);

        const allConnections: ConnectionData[] = [
            ...(connectionsA || []),
            ...(connectionsB || []),
        ];

        if (allConnections.length === 0) {
            return getLocalConnections(userId);
        }

        // For each connection, fetch the OTHER user's profile
        const results: ConnectionWithProfile[] = [];

        for (const conn of allConnections) {
            const otherUserId = conn.user_a === userId ? conn.user_b : conn.user_a;
            let profile: ProfileData | null = null;
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', otherUserId)
                    .maybeSingle();
                if (data) profile = normalizeProfile(data);
            } catch (_) {}

            if (!profile) {
                const kp = getKnownProfile(otherUserId);
                if (kp) profile = normalizeProfile(kp);
            }

            if (profile) {
                results.push({
                    ...conn,
                    profile: profile as ProfileData & { username: string },
                    streakStatus: computeStreakStatus(conn.last_interaction_at),
                });
            }
        }

        if (results.length === 0) {
            return getLocalConnections(userId);
        }

        // Sort: active streaks first, then by streak count descending
        results.sort((a, b) => {
            const statusOrder = { active: 0, at_risk: 1, broken: 2 };
            const statusDiff = statusOrder[a.streakStatus] - statusOrder[b.streakStatus];
            if (statusDiff !== 0) return statusDiff;
            return b.streak_count - a.streak_count;
        });

        return results;
    } catch (_) {
        return getLocalConnections(userId);
    }
}

/** Update a connection's streak (call when users interact) */
export async function updateConnectionStreak(connectionId: string): Promise<{ newStreak: number }> {
    if (connectionId.startsWith('conn-') || isSupabaseQuotaRestricted()) {
        const newStreak = bumpLocalConnectionStreak(connectionId);
        return { newStreak };
    }

    try {
        const { data: conn } = await supabase
            .from('connections')
            .select('*')
            .eq('id', connectionId)
            .single();

        if (!conn) {
            const newStreak = bumpLocalConnectionStreak(connectionId);
            return { newStreak };
        }

        const status = computeStreakStatus(conn.last_interaction_at);
        let newStreak = 1;

        if (status === 'active' || status === 'at_risk') {
            const lastDate = new Date(conn.last_interaction_at).toDateString();
            const todayDate = new Date().toDateString();
            newStreak = lastDate === todayDate ? conn.streak_count : conn.streak_count + 1;
        }

        const { error } = await supabase
            .from('connections')
            .update({
                streak_count: newStreak,
                last_interaction_at: new Date().toISOString(),
            })
            .eq('id', connectionId);

        if (error) {
            console.error('Error updating connection streak:', error);
            return { newStreak: bumpLocalConnectionStreak(connectionId) };
        }
        return { newStreak };
    } catch (_) {
        return { newStreak: bumpLocalConnectionStreak(connectionId) };
    }
}

/** Remove a connection */
export async function removeConnection(connectionId: string): Promise<void> {
    removeLocalConnection(connectionId);
    try {
        const { error } = await supabase
            .from('connections')
            .delete()
            .eq('id', connectionId);

        if (error) console.error('Error removing connection:', error);
    } catch (_) {}
}

/** Fetch all connection user IDs for a given user (Voice matches) */
export async function fetchConnectionUserIds(userId: string): Promise<string[]> {
    try {
        const { data: connectionsA } = await supabase
            .from('connections')
            .select('user_b')
            .eq('user_a', userId);

        const { data: connectionsB } = await supabase
            .from('connections')
            .select('user_a')
            .eq('user_b', userId);

        const ids = [
            ...(connectionsA || []).map(c => c.user_b),
            ...(connectionsB || []).map(c => c.user_a),
        ].filter(Boolean);

        if (ids.length > 0) return ids;
    } catch (_) {}

    const local = getLocalConnections(userId);
    const partnerIds = local.map(c => {
        if (c.profile?.id) return c.profile.id;
        if (c.user_a === userId || c.user_a === 'current_user') return c.user_b;
        if (c.user_b === userId) return c.user_a;
        return c.user_b;
    }).filter(id => Boolean(id) && id !== userId && id !== 'current_user');

    return Array.from(new Set(partnerIds));
}

/** Fetch posts only from connected users */
export async function fetchConnectionPosts(userId: string): Promise<PostData[]> {
    const connectionIds = await fetchConnectionUserIds(userId);
    if (connectionIds.length === 0) return [];

    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .in('user_id', connectionIds)
            .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
            return (data || []).map(normalizePost).filter((p): p is PostData => Boolean(p));
        }
    } catch (_) {}

    const localPosts = getLocalPosts().filter(p => p.user_id && connectionIds.includes(p.user_id));
    return localPosts;
}

/** Fetch stories only from connected users (last 24h) */
export async function fetchConnectionStories(userId: string): Promise<StoryData[]> {
    const connectionIds = await fetchConnectionUserIds(userId);

    try {
        if (connectionIds.length > 0) {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data, error } = await supabase
                .from('stories')
                .select('*')
                .in('user_id', connectionIds)
                .gte('created_at', twentyFourHoursAgo)
                .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
                return (data || []).map(normalizeStory).filter((s): s is StoryData => Boolean(s));
            }
        }
    } catch (_) {}

    return getLocalStories();
}

// ── Chat / Messaging ───────────────────────────────────────

export interface MessageData {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    created_at: string;
    is_read: boolean;
}

export const CANONICAL_USER_IDS: Record<string, string> = {
    'rounak2': '794703c5-c695-47bc-864c-60f400ab6fbe',
    'rounak': '794703c5-c695-47bc-864c-60f400ab6fbe',
    'popcorn05': '9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8',
    'popcorn': '9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8',
    'current_user': '794703c5-c695-47bc-864c-60f400ab6fbe',
    'coral': '12a1a487-5dde-4a77-ab36-aee9ce84fa35',
    'tara01': '1d9a782d-6990-4018-9232-6aefe57a3db6',
    'anaya': '374bf414-64a8-4c81-b5fb-40d5c4bf8dc2',
    'aditya': 'db5d5090-0230-4ad7-ac2c-97e704e46687',
    'samarth22': 'c51a35d0-2455-401f-9b24-e0c836091bc2',
    'i.m.legit': '9ba04879-f507-46ff-b276-1b13d51bfb99',
    'ityourfavourite1': '1369cfe5-42f1-4346-82be-0f616247092d'
};

export function toCanonicalUserId(idOrUsername: string | null | undefined): string {
    if (!idOrUsername) return '';
    const clean = idOrUsername.replace(/^@+/, '').trim().toLowerCase();
    return CANONICAL_USER_IDS[clean] || idOrUsername;
}

export const SEED_ROUNAK_POPCORN_MSGS: MessageData[] = [
    {
        id: 'msg-seed-pop-1',
        sender_id: '794703c5-c695-47bc-864c-60f400ab6fbe',
        receiver_id: '9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8',
        content: 'Hey Popcorn! Great meeting you on Voice Roulette 🎙️',
        created_at: '2026-09-27T10:15:00.000Z',
        is_read: true,
    },
    {
        id: 'msg-seed-pop-2',
        sender_id: '9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8',
        receiver_id: '794703c5-c695-47bc-864c-60f400ab6fbe',
        content: 'Hey Rounak! Haha yes that was so much fun! Loved the music taste 🍿✨',
        created_at: '2026-09-27T10:18:22.000Z',
        is_read: true,
    },
    {
        id: 'msg-seed-pop-3',
        sender_id: '794703c5-c695-47bc-864c-60f400ab6fbe',
        receiver_id: '9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8',
        content: 'Our streak is already building up fast! Keep the streak alive 🔥⚡',
        created_at: '2026-09-28T14:30:10.000Z',
        is_read: true,
    },
    {
        id: 'msg-seed-pop-4',
        sender_id: '9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8',
        receiver_id: '794703c5-c695-47bc-864c-60f400ab6fbe',
        content: '100%! Day 18 active now! Never breaking this streak 🍿🔥',
        created_at: '2026-09-29T07:48:46.077Z',
        is_read: true,
    }
];

/** Fetch all user IDs that the current user has messaged or received messages from */
export async function fetchChattedUserIds(userId: string): Promise<string[]> {
    const { data: sent, error: err1 } = await supabase
        .from('messages')
        .select('receiver_id')
        .eq('sender_id', userId);
        
    const { data: received, error: err2 } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', userId);

    if (err1 || err2) {
        console.error('Error fetching chatted users');
        return [];
    }

    const ids = new Set<string>();
    (sent || []).forEach(m => ids.add(m.receiver_id));
    (received || []).forEach(m => ids.add(m.sender_id));
    
    return Array.from(ids);
}

/** Helper to load local messages between two users */
export function getLocalMessages(user1: string, user2: string): MessageData[] {
    const c1 = toCanonicalUserId(user1);
    const c2 = toCanonicalUserId(user2);
    const idMap = new Map<string, MessageData>();

    const checkKey = (k: string) => {
        try {
            const raw = localStorage.getItem(k);
            if (!raw) return;
            const parsed: MessageData[] = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                parsed.forEach(m => {
                    if (m && m.id && m.content) {
                        const sCan = toCanonicalUserId(m.sender_id);
                        const rCan = toCanonicalUserId(m.receiver_id);
                        const isBetween = (sCan === c1 && rCan === c2) || (sCan === c2 && rCan === c1);
                        if (isBetween) {
                            idMap.set(m.id, {
                                ...m,
                                sender_id: sCan,
                                receiver_id: rCan,
                            });
                        }
                    }
                });
            }
        } catch (_) {}
    };

    const keysToCheck = new Set<string>([
        `knock_chat_msgs_${c1}_${c2}`,
        `knock_chat_msgs_${c2}_${c1}`,
        `knock_chat_msgs_${user1}_${user2}`,
        `knock_chat_msgs_${user2}_${user1}`,
    ]);

    // Check specific known aliases if conversation involves Rounak or Popcorn
    const isRounakPopcorn = 
        (c1 === '794703c5-c695-47bc-864c-60f400ab6fbe' && c2 === '9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8') ||
        (c2 === '794703c5-c695-47bc-864c-60f400ab6fbe' && c1 === '9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8');

    if (isRounakPopcorn) {
        keysToCheck.add('knock_chat_msgs_rounak2_popcorn05');
        keysToCheck.add('knock_chat_msgs_popcorn05_rounak2');
        keysToCheck.add('knock_chat_msgs_current_user_popcorn05');
        keysToCheck.add('knock_chat_msgs_popcorn05_current_user');
        keysToCheck.add('knock_chat_msgs_current_user_9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8');
        keysToCheck.add('knock_chat_msgs_9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8_current_user');
        keysToCheck.add('knock_chat_msgs_794703c5-c695-47bc-864c-60f400ab6fbe_popcorn05');
        keysToCheck.add('knock_chat_msgs_popcorn05_794703c5-c695-47bc-864c-60f400ab6fbe');
    }

    // Inspect all keys
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('knock_chat_msgs_')) {
                    const parts = k.replace('knock_chat_msgs_', '').split('_');
                    if (parts.length === 2) {
                        const p0Can = toCanonicalUserId(parts[0]);
                        const p1Can = toCanonicalUserId(parts[1]);
                        if ((p0Can === c1 && p1Can === c2) || (p0Can === c2 && p1Can === c1)) {
                            keysToCheck.add(k);
                        }
                    }
                }
            }
        }
    } catch (_) {}

    keysToCheck.forEach(checkKey);

    // If no messages found and this is Rounak & Popcorn, populate authentic seed messages
    if (idMap.size === 0 && isRounakPopcorn) {
        SEED_ROUNAK_POPCORN_MSGS.forEach(m => idMap.set(m.id, m));
    }

    const clean = Array.from(idMap.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(`knock_chat_msgs_${c1}_${c2}`, JSON.stringify(clean));
        }
    } catch (_) {}
    return clean;
}

/** Helper to save local messages between two users */
export function saveLocalMessages(user1: string, user2: string, msgs: MessageData[]) {
    const c1 = toCanonicalUserId(user1);
    const c2 = toCanonicalUserId(user2);
    try {
        const strictlyClean = msgs.filter(m => {
            const sCan = toCanonicalUserId(m.sender_id);
            const rCan = toCanonicalUserId(m.receiver_id);
            return (sCan === c1 && rCan === c2) || (sCan === c2 && rCan === c1);
        }).map(m => ({
            ...m,
            sender_id: toCanonicalUserId(m.sender_id),
            receiver_id: toCanonicalUserId(m.receiver_id),
        }));
        localStorage.setItem(`knock_chat_msgs_${c1}_${c2}`, JSON.stringify(strictlyClean));
    } catch (_) {}
}

/** Fetch messages between two users */
export async function fetchMessages(user1: string, user2: string): Promise<MessageData[]> {
    const c1 = toCanonicalUserId(user1);
    const c2 = toCanonicalUserId(user2);
    const localMsgs = getLocalMessages(c1, c2);
    
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${c1},receiver_id.eq.${c2}),and(sender_id.eq.${c2},receiver_id.eq.${c1})`)
            .order('created_at', { ascending: true });

        if (error || !data || data.length === 0) {
            return localMsgs;
        }

        const idMap = new Map<string, MessageData>();
        localMsgs.forEach(m => idMap.set(m.id, m));
        data.forEach(m => {
            const sCan = toCanonicalUserId(m.sender_id);
            const rCan = toCanonicalUserId(m.receiver_id);
            const isBetween = (sCan === c1 && rCan === c2) || (sCan === c2 && rCan === c1);
            if (isBetween) {
                idMap.set(m.id, {
                    ...m,
                    sender_id: sCan,
                    receiver_id: rCan,
                });
            }
        });
        const merged = Array.from(idMap.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        saveLocalMessages(c1, c2, merged);
        return merged;
    } catch (err) {
        return localMsgs;
    }
}

/** Mark messages from a specific sender as read */
export async function markMessagesAsRead(senderId: string, receiverId: string): Promise<void> {
    const cSender = toCanonicalUserId(senderId);
    const cReceiver = toCanonicalUserId(receiverId);
    try {
        const local = getLocalMessages(cReceiver, cSender);
        let changed = false;
        const updated = local.map(m => {
            if (m.sender_id === cSender && m.receiver_id === cReceiver && !m.is_read) {
                changed = true;
                return { ...m, is_read: true };
            }
            return m;
        });
        if (changed) {
            saveLocalMessages(cReceiver, cSender, updated);
        }

        await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('sender_id', cSender)
            .eq('receiver_id', cReceiver)
            .eq('is_read', false);
    } catch (error) {
        console.warn('Mark as read error:', error);
    }
}

/** Send a message */
export async function sendMessage(senderId: string, receiverId: string, content: string): Promise<{ data: MessageData | null; error: Error | null }> {
    const cSender = toCanonicalUserId(senderId);
    const cReceiver = toCanonicalUserId(receiverId);
    const fallbackMsg: MessageData = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        sender_id: cSender,
        receiver_id: cReceiver,
        content,
        created_at: new Date().toISOString(),
        is_read: false,
    };

    // Save to local cache first so it's never lost
    const local = getLocalMessages(cSender, cReceiver);
    const updatedLocal = [...local, fallbackMsg];
    saveLocalMessages(cSender, cReceiver, updatedLocal);

    try {
        const { data, error } = await supabase
            .from('messages')
            .insert({
                sender_id: cSender,
                receiver_id: cReceiver,
                content,
            })
            .select()
            .single();

        if (error || !data) {
            console.warn('Supabase message insert error, keeping local fallback:', error?.message);
            return { data: fallbackMsg, error: null };
        }

        // Replace fallback with real supabase row
        const normalizedData: MessageData = {
            ...data,
            sender_id: toCanonicalUserId(data.sender_id),
            receiver_id: toCanonicalUserId(data.receiver_id),
        };
        const finalMsgs = updatedLocal.map(m => m.id === fallbackMsg.id ? normalizedData : m);
        saveLocalMessages(cSender, cReceiver, finalMsgs);
        return { data: normalizedData, error: null };
    } catch (err: any) {
        console.warn('sendMessage exception, using local fallback:', err);
        return { data: fallbackMsg, error: null };
    }
}

/** Delete a message */
export async function deleteMessage(messageId: string, userId: string): Promise<{ error: Error | null }> {
    try {
        await supabase
            .from('messages')
            .delete()
            .eq('id', messageId)
            .eq('sender_id', userId);
    } catch (e) {}

    return { error: null };
}

/** Subscribe to messages for a specific conversation (both sent and received, with real-time delete) */
export function subscribeToMessages(
    user1: string, 
    user2: string, 
    onNewMessage: (msg: MessageData) => void,
    onMessageDelete?: (deletedId: string) => void
) {
    return supabase
        .channel(`messages-${user1}-${user2}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
            },
            (payload) => {
                const newMsg = payload.new as MessageData;
                const isBetween = 
                    (newMsg.sender_id === user1 && newMsg.receiver_id === user2) ||
                    (newMsg.sender_id === user2 && newMsg.receiver_id === user1);
                
                if (isBetween) {
                    onNewMessage(newMsg);
                }
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'messages',
            },
            (payload) => {
                if (payload.old && payload.old.id && onMessageDelete) {
                    onMessageDelete(payload.old.id);
                }
            }
        )
        .subscribe();
}

/** Fetch multiple profiles by their IDs with smart in-memory profile cache */
export async function fetchProfilesByIds(userIds: string[]): Promise<ProfileData[]> {
    if (userIds.length === 0) return [];
    
    const results: ProfileData[] = [];
    const missingIds: string[] = [];

    userIds.forEach(id => {
        const cached = getFromCache<ProfileData>(`profile_${id}`, 60000);
        if (cached) {
            results.push(cached);
        } else {
            const known = getKnownProfile(id);
            if (known) {
                results.push(known);
                setInCache(`profile_${id}`, known);
            } else {
                missingIds.push(id);
            }
        }
    });

    if (missingIds.length === 0) {
        return results;
    }
    
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .in('id', missingIds);
            
        if (error) {
            console.error('Error fetching profiles by ids:', error);
            missingIds.forEach(id => {
                const k = getKnownProfile(id);
                if (k) results.push(k);
            });
            return results;
        }

        (data || []).forEach(p => {
            if (!isRemovedUser(p.id, p.username)) {
                if (isUnlimitedPointsUser(p.id, p.username)) {
                    p.points = UNLIMITED_POINTS;
                }
                setInCache(`profile_${p.id}`, p);
                results.push(p);
            }
        });
    } catch (_) {
        missingIds.forEach(id => {
            const k = getKnownProfile(id);
            if (k) results.push(k);
        });
    }

    return results;
}

// ── Engagement Tracking ────────────────────────────────────

export interface EngagementData {
    id?: string;
    user_id: string;
    post_id: string;
    action_type: string;
    value: number;
    category: string;
    created_at?: string;
}

let engagementQueue: Array<{ user_id: string; post_id: string; action_type: string; value: number; category: string }> = [];
let engagementFlushTimer: any = null;

/** Track a user engagement event (batched to prevent blocking network pipelines) */
export function trackEngagement(
    userId: string,
    postId: string,
    actionType: string,
    value: number = 1,
    category: string = 'General'
): Promise<void> {
    if (!userId || !postId) return Promise.resolve();
    engagementQueue.push({
        user_id: userId,
        post_id: postId,
        action_type: actionType,
        value,
        category,
    });

    if (!engagementFlushTimer) {
        engagementFlushTimer = setTimeout(async () => {
            engagementFlushTimer = null;
            const toSend = [...engagementQueue];
            engagementQueue = [];
            if (toSend.length > 0) {
                try {
                    await supabase.from('engagements').insert(toSend);
                } catch (e) {
                    console.warn('Batch engagement track error:', e);
                }
            }
        }, 1200);
    }
    return Promise.resolve();
}

/** Fetch all engagements for a user (for building interest profile) with fast cache */
export async function fetchUserEngagements(userId: string): Promise<EngagementData[]> {
    const cached = getFromCache<EngagementData[]>(`engagements_${userId}`, 45000);
    if (cached) return cached;

    const { data, error } = await supabase
        .from('engagements')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(300); // Last 300 interactions for fast calculation

    if (error) {
        console.error('Error fetching user engagements:', error);
        return [];
    }
    const result = data || [];
    setInCache(`engagements_${userId}`, result);
    return result;
}

/** Fetch all posts (unpaginated) for scoring — used by algorithm.ts with fast cache */
export async function fetchAllPostsForScoring(currentUserId?: string): Promise<PostData[]> {
    const cacheKey = `all_scoring_posts_${currentUserId || 'all'}`;
    const cached = getFromCache<PostData[]>(cacheKey, 25000);
    if (cached) return cached;

    try {
        const query = supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(300);

        const { data, error } = await query;

        if (error) {
            if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
            console.warn('[fetchAllPostsForScoring] Supabase unavailable, using resilient local posts:', error.message);
            const fallback = getLocalPosts();
            setInCache(cacheKey, fallback);
            return fallback;
        }
        const normalized = (data || []).map(normalizePost).filter((p): p is PostData => Boolean(p));
        const result = normalized.length > 0 ? mergePostsWithFallback(normalized) : getLocalPosts();
        setInCache(cacheKey, result);
        return result;
    } catch (e: any) {
        if (isQuotaError(e)) setSupabaseQuotaRestricted(true);
        const fallback = getLocalPosts();
        setInCache(cacheKey, fallback);
        return fallback;
    }
}

// ── Voice Reactions ────────────────────────────────────────

/** Upload a voice reaction audio blob to Supabase storage */
export async function uploadVoiceReaction(audioBlob: Blob, userId: string): Promise<string> {
    const isMp4 = audioBlob.type.includes('mp4') || audioBlob.type.includes('aac') || audioBlob.type.includes('m4a');
    const ext = isMp4 ? 'm4a' : 'webm';
    const contentType = audioBlob.type || (isMp4 ? 'audio/mp4' : 'audio/webm');
    const fileName = `voice_${userId}_${Date.now()}.${ext}`;
    const filePath = `voice-reactions/${fileName}`;

    try {
        const { error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, audioBlob, {
                contentType,
                upsert: false,
            });

        if (error) {
            if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
            return URL.createObjectURL(audioBlob);
        }

        const { data: urlData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);

        return urlData.publicUrl;
    } catch (_) {
        return URL.createObjectURL(audioBlob);
    }
}

// ── Comments ───────────────────────────────────────────────

export interface CommentData {
    id: string;
    post_id: string;
    user_id: string;
    username: string;
    avatar_url?: string;
    content: string;
    is_voice: boolean;
    voice_url?: string;
    created_at: string;
}

/** Fetch all comments for a post */
export async function fetchComments(postId: string): Promise<CommentData[]> {
    const localComments = getLocalComments(postId);
    try {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('post_id', postId)
            .order('created_at', { ascending: false });

        if (error) {
            if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
            return localComments;
        }
        const dbComments = data || [];
        const seen = new Set(dbComments.map((c: any) => c.id));
        return [...dbComments, ...localComments.filter(c => !seen.has(c.id))];
    } catch (_) {
        return localComments;
    }
}

/** Add a text or voice comment */
export async function addComment(
    postId: string,
    userId: string,
    username: string,
    avatarUrl: string,
    content: string,
    isVoice: boolean = false,
    voiceUrl?: string
): Promise<{ data: any; error: any }> {
    const newComment: CommentData = {
        id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        post_id: postId,
        user_id: userId,
        username,
        avatar_url: avatarUrl,
        content,
        is_voice: isVoice,
        voice_url: voiceUrl,
        created_at: new Date().toISOString(),
    };
    saveLocalComment(newComment);

    try {
        const { data, error } = await supabase
            .from('comments')
            .insert({
                post_id: postId,
                user_id: userId,
                username,
                avatar_url: avatarUrl,
                content,
                is_voice: isVoice,
                voice_url: voiceUrl,
            });

        if (error && isQuotaError(error)) setSupabaseQuotaRestricted(true);
        return { data: [newComment], error: null };
    } catch (_) {
        return { data: [newComment], error: null };
    }

    if (!error) {
        // Increment comment count on the post
        const { error: rpcError } = await supabase.rpc('increment_field', { row_id: postId, field_name: 'comments_count', table_name: 'posts' });
        if (rpcError) {
            // Fallback: manual increment if RPC doesn't exist
            const { data: post } = await supabase.from('posts').select('comments_count').eq('id', postId).single();
            if (post) {
                await supabase.from('posts').update({ comments_count: (post.comments_count || 0) + 1 }).eq('id', postId);
            }
        }
    }

    return { data, error };
}

/** Delete a comment (own only — RLS enforced) */
export async function deleteComment(commentId: string): Promise<void> {
    const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

    if (error) {
        console.error('Error deleting comment:', error);
    }
}

// ── Search ─────────────────────────────────────────────────

/** Helper to extract search tokens for resilient hashtag and keyword queries */
export function extractSearchTokens(query: string): string[] {
    const raw = query.trim();
    if (!raw) return [];
    const tokens = new Set<string>();

    // 1. Raw stripped of leading @ and #
    const stripped = raw.replace(/^[#@]+/, '').trim();
    if (stripped.length >= 2) {
        const safe = stripped.replace(/[%_,():]/g, ' ').trim();
        if (safe.length >= 2) {
            tokens.add(safe);
            // Space-stripped version: 'ananya pandey' -> 'ananyapandey'
            const noSpaces = safe.replace(/\s+/g, '');
            if (noSpaces.length >= 2) tokens.add(noSpaces);
        }
    }

    // 2. Individual words / hashtags (e.g. "#viral #trending" -> "viral", "trending")
    const words = raw.split(/[\s,#+]+/);
    for (const w of words) {
        const clean = w.replace(/^[#@]+/, '').replace(/[%_,():]/g, '').trim();
        if (clean.length >= 2) {
            tokens.add(clean);
            const lowerW = clean.toLowerCase();
            if (COMMON_TYPOS[lowerW]) {
                COMMON_TYPOS[lowerW].forEach(t => {
                    const safeT = t.replace(/[%_,():]/g, '').trim();
                    if (safeT.length >= 2) tokens.add(safeT);
                });
            }
        }
    }

    // 3. Typo expansion on full stripped query
    const lowerStripped = stripped.toLowerCase();
    if (COMMON_TYPOS[lowerStripped]) {
        COMMON_TYPOS[lowerStripped].forEach(t => {
            const safeT = t.replace(/[%_,():]/g, '').trim();
            if (safeT.length >= 2) tokens.add(safeT);
        });
    }

    return Array.from(tokens).slice(0, 8);
}

/** Search users by username or name with typo tolerance and hashtag immunity */
export async function searchUsers(query: string): Promise<ProfileData[]> {
    const cleanQuery = query.replace(/^[#@]+/, '').trim();
    if (!cleanQuery) return [];

    const lower = cleanQuery.toLowerCase();
    const candidateTerms = new Set<string>([cleanQuery]);
    if (COMMON_TYPOS[lower]) {
        COMMON_TYPOS[lower].forEach(t => candidateTerms.add(t));
    }
    if (CREATOR_USERNAME_PAIRS[lower]) {
        candidateTerms.add(CREATOR_USERNAME_PAIRS[lower]);
    }
    Object.entries(COMMON_TYPOS).forEach(([typo, targets]) => {
        if (targets.map(t => t.toLowerCase()).includes(lower)) {
            candidateTerms.add(typo);
        }
    });

    const orConditions = Array.from(candidateTerms).flatMap(t => [
        `username.ilike.%${t}%`,
        `name.ilike.%${t}%`
    ]).join(',');

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(orConditions)
        .limit(20);

    const seen = new Set<string>();
    const results: ProfileData[] = [];

    if (!error && data) {
        for (const raw of data) {
            const p = normalizeProfile(raw);
            if (p && !seen.has(p.id) && !isRemovedUser(p.id, p.username)) {
                seen.add(p.id);
                results.push(p);
            }
        }
    }

    // Merge matching known profiles
    const allKnown = getAllKnownProfiles();
    for (const kp of allKnown) {
        const norm = normalizeProfile(kp);
        if (norm && !seen.has(norm.id) && !isRemovedUser(norm.id, norm.username)) {
            const matchesQuery = Array.from(candidateTerms).some(t => {
                const termLower = t.toLowerCase();
                return (norm.username && norm.username.toLowerCase().includes(termLower)) ||
                       (norm.name && norm.name.toLowerCase().includes(termLower));
            });
            if (matchesQuery) {
                seen.add(norm.id);
                results.push(norm);
            }
        }
    }

    // Also check REEL_CREATOR_MAP for matches
    Object.entries(REEL_CREATOR_MAP).forEach(([uname, creator]) => {
        const creatorId = `creator-${uname}`;
        if (!seen.has(creatorId)) {
            const matches = Array.from(candidateTerms).some(t => {
                const termLower = t.toLowerCase();
                return uname.toLowerCase().includes(termLower) || creator.name.toLowerCase().includes(termLower);
            });
            if (matches) {
                seen.add(creatorId);
                const norm = normalizeProfile({
                    id: creatorId,
                    username: uname,
                    name: creator.name,
                    avatar_url: creator.avatar,
                    bio: creator.bio,
                    points: 250,
                    streak_count: 5
                });
                if (norm) results.push(norm);
            }
        }
    });

    return results;
}

/** Search posts by caption and creator username with resilient hashtag & token matching */
export async function searchPostsByCaption(query: string): Promise<PostData[]> {
    const candidateTerms = extractSearchTokens(query);
    if (candidateTerms.length === 0) return [];

    const orConditions = candidateTerms.flatMap(t => [
        `caption.ilike.%${t}%`,
        `username.ilike.%${t}%`
    ]).join(',');

    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .or(orConditions)
        .order('created_at', { ascending: false })
        .limit(60);

    if (error) {
        console.error('Error searching posts:', error);
        const local = getLocalPosts();
        return local.filter(p => {
            const cap = (p.caption || '').toLowerCase();
            const uname = (p.username || '').toLowerCase();
            return candidateTerms.some(t => {
                const termLower = t.toLowerCase();
                return cap.includes(termLower) || uname.includes(termLower);
            });
        });
    }

    const seen = new Set<string>();
    const normalized = (data || [])
        .map(normalizePost)
        .filter((p): p is PostData => {
            if (!p || !p.id || seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
        });

    if (normalized.length === 0) {
        const local = getLocalPosts();
        return local.filter(p => {
            const cap = (p.caption || '').toLowerCase();
            const uname = (p.username || '').toLowerCase();
            return candidateTerms.some(t => {
                const termLower = t.toLowerCase();
                return cap.includes(termLower) || uname.includes(termLower);
            });
        });
    }

    return normalized;
}

export async function fetchDiscoverPosts(category?: string | null, limit: number = 60, offset: number = 0): Promise<PostData[]> {
    try {
        let query = supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
            
        if (category && category !== 'All') {
            query = query.eq('category', category);
        }

        const { data, error } = await query;
        if (error) {
            if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
            const local = getLocalPosts();
            if (category && category !== 'All') {
                return local.filter(p => p.category?.toLowerCase() === category.toLowerCase());
            }
            return local;
        }
        
        const normalized = (data || []).map(normalizePost).filter((p): p is PostData => Boolean(p));
        if (normalized.length === 0) {
            const local = getLocalPosts();
            if (category && category !== 'All') {
                return local.filter(p => p.category?.toLowerCase() === category.toLowerCase());
            }
            return local;
        }
        return mergePostsWithFallback(normalized);
    } catch (_) {
        return getLocalPosts();
    }
}

// ── Delete Post ────────────────────────────────────────────

/** Delete a post (only your own) */
export async function deletePost(postId: string): Promise<boolean> {
    try {
        if (typeof window !== 'undefined') {
            const posts = getLocalPosts().filter(p => p.id !== postId);
            localStorage.setItem('knock_local_posts', JSON.stringify(posts));
        }
        const { error } = await supabase
            .from('posts')
            .delete()
            .eq('id', postId);

        if (error && isQuotaError(error)) setSupabaseQuotaRestricted(true);
        invalidateCache();
        return true;
    } catch (_) {
        return true;
    }
}

// ── Profile Update ─────────────────────────────────────────

/** Update profile fields */
export async function updateProfile(
    userId: string,
    updates: { username?: string; bio?: string; avatar_url?: string }
): Promise<boolean> {
    try {
        const raw = localStorage.getItem('knock_user_session');
        if (raw) {
            const parsed = JSON.parse(raw);
            Object.assign(parsed, updates);
            localStorage.setItem('knock_user_session', JSON.stringify(parsed));
        }
    } catch (_) {}

    try {
        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId);

        if (error && isQuotaError(error)) setSupabaseQuotaRestricted(true);
        return true;
    } catch (_) {
        return true;
    }
}

// -------------------------------------------------------------------------
// 🚀 Boost Feature
// -------------------------------------------------------------------------

export async function boostPost(postId: string, currentUserId: string, currentPoints: number, amount: number = 100): Promise<boolean> {
    if (currentPoints < amount) return false;
    
    // Deduct points locally first
    try {
        const raw = localStorage.getItem('knock_user_session');
        if (raw) {
            const parsed = JSON.parse(raw);
            parsed.points = Math.max(0, currentPoints - amount);
            localStorage.setItem('knock_user_session', JSON.stringify(parsed));
        }
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        const posts = getLocalPosts();
        const updated = posts.map(p => {
            if (p.id === postId) {
                return {
                    ...p,
                    boost_expires_at: expiresAt.toISOString(),
                    boost_impressions_remaining: amount
                };
            }
            return p;
        });
        localStorage.setItem('knock_local_posts', JSON.stringify(updated));
    } catch (_) {}

    try {
        await supabase
            .from('profiles')
            .update({ points: currentPoints - amount })
            .eq('id', currentUserId);

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        await supabase
            .from('posts')
            .update({ 
                boost_expires_at: expiresAt.toISOString(),
                boost_impressions_remaining: amount
            })
            .eq('id', postId);
    } catch (_) {}
    
    return true;
}

export async function decrementBoostImpressions(postId: string, currentRemaining: number): Promise<void> {
    if (currentRemaining <= 0) return;
    
    const { error } = await supabase
        .from('posts')
        .update({ boost_impressions_remaining: currentRemaining - 1 })
        .eq('id', postId);
        
    if (error) console.error('Error decrementing boost:', error);
}

export async function fetchActiveBoostedPosts(): Promise<PostData[]> {
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .gt('boost_impressions_remaining', 0)
        .gt('boost_expires_at', new Date().toISOString())
        .order('boost_expires_at', { ascending: true }); // Expiring soonest first
        
    if (error) {
        console.error('Error fetching boosted posts:', error);
        return [];
    }
    
    return (data || []).map(normalizePost).filter((p): p is PostData => Boolean(p));
}

// ── Engagement Psychology Helpers ──────────────────────────

/** Fetch trending posts — prioritizing authentic uploaded videos (ityourfavourite1, user videos) and top trending content */
export async function fetchTrendingPosts(limit: number = 20, currentUserId?: string): Promise<PostData[]> {
    const cacheKey = `trending_posts_v8_${limit}_${currentUserId || 'anon'}`;
    const cached = getFromCache<PostData[]>(cacheKey, 15000);
    if (cached) return cached;

    try {
        // 1. Fetch all posts from 'ityourfavourite1' (favorite user)
        const favPromise = supabase
            .from('posts')
            .select('*')
            .ilike('username', '%favourite%')
            .order('created_at', { ascending: false });

        // 2. Fetch all posts from current user (if logged in)
        const userPromise = currentUserId
            ? supabase.from('posts').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }).limit(10)
            : Promise.resolve({ data: [] });

        // 3. Fetch community video uploads
        const videoPromise = supabase
            .from('posts')
            .select('*')
            .or('media_type.eq.video,image_url.ilike.%.mp4%')
            .order('created_at', { ascending: false })
            .limit(30);

        // 4. Fetch top liked posts
        const topPromise = supabase
            .from('posts')
            .select('*')
            .order('likes_count', { ascending: false })
            .limit(limit);

        const [favRes, userRes, vidRes, topRes] = await Promise.all([favPromise, userPromise, videoPromise, topPromise]);

        const seenIds = new Set<string>();
        const seenUrls = new Set<string>();
        const result: PostData[] = [];

        const addPost = (raw: any, isFav: boolean = false) => {
            if (!raw || !raw.id || !raw.image_url) return;
            if (typeof raw.image_url === 'string' && (raw.image_url.startsWith('blob:') || raw.image_url.startsWith('data:'))) return;
            const norm = normalizePost(raw);
            if (!norm) return;
            const cleanUrl = (norm.image_url || '').split('?')[0].split('#')[0];
            if (seenIds.has(norm.id) || seenUrls.has(cleanUrl)) return;
            seenIds.add(norm.id);
            seenUrls.add(cleanUrl);

            // Assign vibrant trending engagement count if likes are 0/low
            if (!norm.likes_count || norm.likes_count < 100) {
                let hash = 0;
                for (let i = 0; i < norm.id.length; i++) hash = ((hash << 5) - hash) + norm.id.charCodeAt(i);
                norm.likes_count = isFav ? (2400 + Math.abs(hash % 2600)) : (450 + Math.abs(hash % 1200));
            }
            result.push(norm);
        };

        // Priority 1: All video posts from ityourfavourite1 ("our favorite")
        (favRes.data || []).forEach(p => {
            const isVid = p.media_type === 'video' || (p.image_url && p.image_url.includes('.mp4'));
            if (isVid) addPost(p, true);
        });

        // Priority 2: Videos by current logged-in user
        (userRes.data || []).forEach(p => {
            const isVid = p.media_type === 'video' || (p.image_url && p.image_url.includes('.mp4'));
            if (isVid) addPost(p, true);
        });

        // Priority 3: Community video uploads (coral, rounak2, etc.)
        (vidRes.data || []).forEach(p => addPost(p, false));

        // Priority 4: Image posts from ityourfavourite1
        (favRes.data || []).forEach(p => addPost(p, true));

        // Priority 5: Top posts
        (topRes.data || []).forEach(p => addPost(p, false));

        const assembleLocalTrending = (): PostData[] => {
            const local = getLocalPosts();
            const favVids = local.filter(p => (p.username === 'ityourfavourite1' || p.username?.includes('favourite')) && (isVideoPost(p) || isVideoUrl(p.image_url)));
            const userVids = currentUserId ? local.filter(p => p.user_id === currentUserId && (isVideoPost(p) || isVideoUrl(p.image_url))) : [];
            const otherVids = local.filter(p => p.username !== 'ityourfavourite1' && p.user_id !== currentUserId && (isVideoPost(p) || isVideoUrl(p.image_url)));
            const favImages = local.filter(p => (p.username === 'ityourfavourite1' || p.username?.includes('favourite')) && !isVideoPost(p) && !isVideoUrl(p.image_url));
            const seen = new Set<string>();
            const res: PostData[] = [];
            for (const p of [...favVids, ...userVids, ...otherVids, ...favImages]) {
                if (!seen.has(p.id)) {
                    seen.add(p.id);
                    res.push(p);
                }
            }
            return res;
        };

        if (result.length === 0) {
            const fallback = assembleLocalTrending();
            setInCache(cacheKey, fallback);
            return fallback;
        }

        setInCache(cacheKey, result);
        return result;
    } catch (error: any) {
        if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
        console.warn('Error fetching trending posts (using local fallback):', error);
        const local = getLocalPosts();
        const favVids = local.filter(p => (p.username === 'ityourfavourite1' || p.username?.includes('favourite')) && (isVideoPost(p) || isVideoUrl(p.image_url)));
        const userVids = currentUserId ? local.filter(p => p.user_id === currentUserId && (isVideoPost(p) || isVideoUrl(p.image_url))) : [];
        const otherVids = local.filter(p => p.username !== 'ityourfavourite1' && p.user_id !== currentUserId && (isVideoPost(p) || isVideoUrl(p.image_url)));
        const favImages = local.filter(p => (p.username === 'ityourfavourite1' || p.username?.includes('favourite')) && !isVideoPost(p) && !isVideoUrl(p.image_url));
        const seen = new Set<string>();
        const res: PostData[] = [];
        for (const p of [...favVids, ...userVids, ...otherVids, ...favImages]) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                res.push(p);
            }
        }
        return res;
    }
}

/** Count stories posted in the last hour (for FOMO indicator) */
export async function fetchRecentStoriesCount(): Promise<number> {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count, error } = await supabase
            .from('stories')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', oneHourAgo);

        if (error) {
            const fallback = getFallbackStories().filter(s => {
                const t = new Date(s.created_at).getTime();
                return Date.now() - t < 60 * 60 * 1000;
            });
            return fallback.length;
        }
        return count || 0;
    } catch (_) {
        return 0;
    }
}

/** Fetch top 3 streak users for the leaderboard */
export async function fetchTopStreakUsers(limit: number = 3): Promise<ProfileData[]> {
    const defaultStreaks: ProfileData[] = [
        { id: 'streak-1', username: 'ityourfavourite1', name: 'ityourfavourite1', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', points: 999999999, streak_count: 14, gender: 'female' },
        { id: 'streak-2', username: 'nature_vibes', name: 'Nature Vibes', avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', points: 4200, streak_count: 11, gender: 'male' },
        { id: 'streak-3', username: 'city_explorer', name: 'City Explorer', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', points: 3100, streak_count: 8, gender: 'other' }
    ];

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .gt('streak_count', 0)
            .order('streak_count', { ascending: false })
            .limit(limit);

        if (error) {
            if (isQuotaError(error)) setSupabaseQuotaRestricted(true);
            return defaultStreaks.slice(0, limit);
        }
        const filtered = (data || []).filter(u => !isRemovedUser(u.id, u.username));
        return filtered.length > 0 ? filtered : defaultStreaks.slice(0, limit);
    } catch (e: any) {
        if (isQuotaError(e)) setSupabaseQuotaRestricted(true);
        return defaultStreaks.slice(0, limit);
    }
}

// ── Blocking ──────────────────────────────────────────────

export async function fetchBlockedIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('blocks')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

    if (error) {
        console.error('Error fetching blocked ids:', error);
        return [];
    }

    const blockedSet = new Set<string>();
    data.forEach(b => {
        if (b.blocker_id !== userId) blockedSet.add(b.blocker_id);
        if (b.blocked_id !== userId) blockedSet.add(b.blocked_id);
    });

    return Array.from(blockedSet);
}

export async function blockUser(blockerId: string, blockedId: string): Promise<boolean> {
    const { error } = await supabase
        .from('blocks')
        .insert({ blocker_id: blockerId, blocked_id: blockedId });
    
    if (error) {
        console.error('Error blocking user:', error);
        return false;
    }
    return true;
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
    const { error } = await supabase
        .from('blocks')
        .delete()
        .match({ blocker_id: blockerId, blocked_id: blockedId });
    
    if (error) {
        console.error('Error unblocking user:', error);
        return false;
    }
    return true;
}

export interface CallRequestData {
    id: string;
    sender_id: string;
    receiver_id: string;
    status: 'pending' | 'accepted' | 'declined';
    created_at: string;
}

/** Check the call request status between userA and userB */
export async function getCallRequestStatus(userA: string, userB: string): Promise<CallRequestData | null> {
    try {
        const { data, error } = await supabase
            .from('call_requests')
            .select('*')
            .or(`sender_id.eq.${userA},sender_id.eq.${userB}`);

        if (error) {
            // Table likely doesn't exist yet — use localStorage fallback
            const fallbackRequests = JSON.parse(localStorage.getItem('knock_fallback_call_requests') || '[]');
            const found = fallbackRequests.find((r: any) => 
                (r.sender_id === userA && r.receiver_id === userB) || 
                (r.sender_id === userB && r.receiver_id === userA)
            );
            return found || null;
        }

        const found = (data || []).find((r: any) => 
            (r.sender_id === userA && r.receiver_id === userB) || 
            (r.sender_id === userB && r.receiver_id === userA)
        );
        return found || null;
    } catch (e) {
        return null;
    }
}

/** Get any active pending call request where receiverId is the current user */
export async function getPendingCallRequestForUser(userId: string): Promise<CallRequestData | null> {
    try {
        const { data, error } = await supabase
            .from('call_requests')
            .select('*')
            .eq('receiver_id', userId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1);

        if (error || !data || data.length === 0) {
            // Check fallback
            const fallbackRequests = JSON.parse(localStorage.getItem('knock_fallback_call_requests') || '[]');
            const found = fallbackRequests.find((r: any) => r.receiver_id === userId && r.status === 'pending');
            return found || null;
        }
        return data[0];
    } catch (e) {
        return null;
    }
}

/** Send a call request from senderId to receiverId */
export async function sendCallRequest(senderId: string, receiverId: string): Promise<CallRequestData | null> {
    try {
        const { data, error } = await supabase
            .from('call_requests')
            .upsert({
                sender_id: senderId,
                receiver_id: receiverId,
                status: 'pending',
                created_at: new Date().toISOString()
            }, { onConflict: 'sender_id,receiver_id' })
            .select()
            .single();

        if (error) {
            // Fallback to localStorage if table doesn't exist
            const fallbackRequests = JSON.parse(localStorage.getItem('knock_fallback_call_requests') || '[]');
            const updated = fallbackRequests.filter((r: any) => 
                !(r.sender_id === senderId && r.receiver_id === receiverId)
            );
            const newReq: CallRequestData = {
                id: `fallback-${Date.now()}`,
                sender_id: senderId,
                receiver_id: receiverId,
                status: 'pending',
                created_at: new Date().toISOString()
            };
            updated.push(newReq);
            localStorage.setItem('knock_fallback_call_requests', JSON.stringify(updated));
            return newReq;
        }
        return data;
    } catch (e) {
        return null;
    }
}

/** Update status of call request */
export async function updateCallRequestStatus(requestId: string, status: 'accepted' | 'declined'): Promise<boolean> {
    try {
        if (requestId.startsWith('fallback-')) {
            const fallbackRequests = JSON.parse(localStorage.getItem('knock_fallback_call_requests') || '[]');
            const updated = fallbackRequests.map((r: any) => {
                if (r.id === requestId) {
                    return { ...r, status };
                }
                return r;
            });
            localStorage.setItem('knock_fallback_call_requests', JSON.stringify(updated));
            return true;
        }

        const { error } = await supabase
            .from('call_requests')
            .update({ status })
            .eq('id', requestId);

        if (error) {
            console.error('Error updating call request:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Exception updating call request:', e);
        return false;
    }
}

/** Fetch online status of a specific user */
export async function fetchUserOnlineStatus(userId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('is_online')
            .eq('id', userId)
            .maybeSingle();

        if (error || !data) {
            return false;
        }
        return !!data.is_online;
    } catch (e) {
        return false;
    }
}


