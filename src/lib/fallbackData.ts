import type { PostData, StoryData, ProfileData, CommentData } from './database';

// Global flag tracking if Supabase is currently quota-restricted or offline
let _isQuotaRestricted = false;
const quotaListeners = new Set<(isRestricted: boolean) => void>();

export function isSupabaseQuotaRestricted(): boolean {
    return _isQuotaRestricted;
}

export function setSupabaseQuotaRestricted(restricted: boolean) {
    if (_isQuotaRestricted !== restricted) {
        _isQuotaRestricted = restricted;
        quotaListeners.forEach(listener => listener(restricted));
    }
}

export function onQuotaStatusChange(listener: (isRestricted: boolean) => void): () => void {
    quotaListeners.add(listener);
    return () => quotaListeners.delete(listener);
}

export function isQuotaError(err: any): boolean {
    if (!err) return false;
    const msg = typeof err === 'string' ? err : (err.message || err.error || JSON.stringify(err));
    const status = err.status || err.statusCode || (err.response && err.response.status);
    return (
        status === 402 ||
        msg.includes('402') ||
        msg.includes('exceed_cached_egress_quota') ||
        msg.includes('restricted due to the following violations') ||
        msg.includes('spend caps') ||
        msg.includes('quota')
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// RICH SEED POSTS (0-Egress, high speed CDNs with real iTunes music & posters)
// ─────────────────────────────────────────────────────────────────────────────
export const SEED_POSTS: PostData[] = [
    {
        id: 'seed-fav-1',
        user_id: '00000000-0000-0000-0000-000000000001',
        username: 'ityourfavourite1',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        image_url: 'https://videos.pexels.com/video-files/856029/856029-sd_640_360_30fps.mp4#POSTER:https%3A%2F%2Fimages.pexels.com%2Fvideos%2F856029%2Ffree-video-856029.jpg',
        caption: '✨ Late night city lights & memories that stay forever 🔥 #viral #trending #reels',
        likes_count: 5820,
        imps_count: 14200,
        comments_count: 194,
        shares_count: 512,
        media_type: 'video',
        category: 'Lifestyle',
        music_title: 'Chill Vibes — LofiBeats',
        music_artist: 'LofiBeats',
        music_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/09/81/85/0981857c-ef55-7eb1-d631-f7e1068bd2dc/mzaf_17162354108241480327.plus.aac.p.m4a',
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
        id: 'seed-fav-2',
        user_id: '00000000-0000-0000-0000-000000000001',
        username: 'ityourfavourite1',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        image_url: 'https://videos.pexels.com/video-files/3015510/3015510-sd_640_360_24fps.mp4#POSTER:https%3A%2F%2Fimages.pexels.com%2Fvideos%2F3015510%2Ffree-video-3015510.jpg',
        caption: '⚡ When the bass hits just right. Who else loves neon nights? 🌌 #music #dance #vibes',
        likes_count: 8930,
        imps_count: 22100,
        comments_count: 320,
        shares_count: 890,
        media_type: 'video',
        category: 'Music',
        music_title: 'After Dark — Mr.Kitty',
        music_artist: 'Mr.Kitty',
        music_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/3e/cb/52/3ecb5294-5ea1-e392-7262-1b10cc67a299/mzaf_17548677748266742699.plus.aac.p.m4a',
        created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    },
    {
        id: 'seed-reel-ocean',
        user_id: '00000000-0000-0000-0000-000000000002',
        username: 'ocean_dreams',
        avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
        image_url: 'https://videos.pexels.com/video-files/1526909/1526909-sd_640_360_25fps.mp4#POSTER:https%3A%2F%2Fimages.pexels.com%2Fvideos%2F1526909%2Ffree-video-1526909.jpg',
        caption: '🌊 Crystal clear waters & tropical vibes 🐠 Watch till the end! #nature #travel #explore',
        likes_count: 12400,
        imps_count: 34000,
        comments_count: 412,
        shares_count: 1230,
        media_type: 'video',
        category: 'Nature',
        music_title: 'Ocean Eyes — Billie Eilish',
        music_artist: 'Billie Eilish',
        music_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/d6/59/2b/d6592b0b-1e7e-4743-b2e4-f2af038fd783/mzaf_7697277787797935735.plus.aac.p.m4a',
        created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    },
    {
        id: 'seed-reel-fitness',
        user_id: '00000000-0000-0000-0000-000000000003',
        username: 'fitness_freak',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        image_url: 'https://videos.pexels.com/video-files/3571264/3571264-sd_640_360_30fps.mp4#POSTER:https%3A%2F%2Fimages.pexels.com%2Fvideos%2F3571264%2Ffree-video-3571264.jpg',
        caption: '💪 5 AM grind hits different. Keep pushing your limits! 🔥 #fitness #gym #motivation',
        likes_count: 7320,
        imps_count: 18900,
        comments_count: 245,
        shares_count: 670,
        media_type: 'video',
        category: 'Sports',
        music_title: 'Stronger — Kanye West',
        music_artist: 'Kanye West',
        music_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/9e/cc/69/9ecc6918-a8dc-354f-909f-ccc20a0a7a33/mzaf_7863921970418240507.plus.aac.p.m4a',
        created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    },
    {
        id: 'seed-reel-food',
        user_id: '00000000-0000-0000-0000-000000000004',
        username: 'foodie_fam',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        image_url: 'https://videos.pexels.com/video-files/2795173/2795173-sd_640_360_25fps.mp4#POSTER:https%3A%2F%2Fimages.pexels.com%2Fvideos%2F2795173%2Ffree-video-2795173.jpg',
        caption: '🍕 The ultimate hot cheese pull! Would you eat this whole slice? 🤤 #food #delicious #treat',
        likes_count: 15300,
        imps_count: 42000,
        comments_count: 580,
        shares_count: 2100,
        media_type: 'video',
        category: 'Food',
        music_title: "THAT'S WHAT I WANT — Lil Nas X",
        music_artist: 'Lil Nas X',
        music_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ac/57/e0/ac57e012-013a-dbc9-8526-ed12c2dacc66/mzaf_4836012189133996186.plus.aac.p.m4a',
        created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    },
    {
        id: 'seed-reel-dance',
        user_id: '00000000-0000-0000-0000-000000000005',
        username: 'dance_queen',
        avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
        image_url: 'https://videos.pexels.com/video-files/4065924/4065924-sd_640_360_25fps.mp4#POSTER:https%3A%2F%2Fimages.pexels.com%2Fvideos%2F4065924%2Ffree-video-4065924.jpg',
        caption: '💃 New choreo drop! Tell me what you think in comments 🎶 #dance #choreo #trending',
        likes_count: 9800,
        imps_count: 27000,
        comments_count: 380,
        shares_count: 950,
        media_type: 'video',
        category: 'Dance',
        music_title: 'Starboy — The Weeknd',
        music_artist: 'The Weeknd',
        music_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a',
        created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    },
    {
        id: 'seed-photo-sunset',
        user_id: '00000000-0000-0000-0000-000000000006',
        username: 'nature_vibes',
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        image_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
        caption: '🌅 Peaceful sunset horizons. Breathe in, breathe out. 🌊 #nature #peace #sunset',
        likes_count: 4320,
        imps_count: 11200,
        comments_count: 98,
        shares_count: 145,
        media_type: 'image',
        category: 'Nature',
        created_at: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
    },
    {
        id: 'seed-photo-tech',
        user_id: '00000000-0000-0000-0000-000000000007',
        username: 'tech_guru',
        avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
        image_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80',
        caption: '💻 Modern desk setup ready for building the future. How does your desk look? ⚡ #tech #coding',
        likes_count: 6710,
        imps_count: 16800,
        comments_count: 165,
        shares_count: 280,
        media_type: 'image',
        category: 'Tech',
        created_at: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
    }
];

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL PERSISTENCE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function getLocalPosts(): PostData[] {
    try {
        if (typeof window === 'undefined') return SEED_POSTS;
        const stored = localStorage.getItem('knock_local_posts');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Ensure seed posts are merged with user created posts
                const existingIds = new Set(parsed.map((p: PostData) => p.id));
                const missingSeeds = SEED_POSTS.filter(s => !existingIds.has(s.id));
                return [...parsed, ...missingSeeds];
            }
        }
    } catch (_) {}
    // Initialize storage with seeds
    try {
        localStorage.setItem('knock_local_posts', JSON.stringify(SEED_POSTS));
    } catch (_) {}
    return SEED_POSTS;
}

export function saveLocalPost(post: PostData): void {
    try {
        if (typeof window === 'undefined') return;
        const posts = getLocalPosts();
        const updated = [post, ...posts.filter(p => p.id !== post.id)];
        localStorage.setItem('knock_local_posts', JSON.stringify(updated));
    } catch (_) {}
}

export function updateLocalPostLikes(postId: string, delta: number): void {
    try {
        if (typeof window === 'undefined') return;
        const posts = getLocalPosts();
        const updated = posts.map(p => {
            if (p.id === postId) {
                return { ...p, likes_count: Math.max(0, (p.likes_count || 0) + delta) };
            }
            return p;
        });
        localStorage.setItem('knock_local_posts', JSON.stringify(updated));
    } catch (_) {}
}

export function getLocalLikes(): Record<string, boolean> {
    try {
        if (typeof window === 'undefined') return {};
        const raw = localStorage.getItem('knock_local_likes');
        return raw ? JSON.parse(raw) : {};
    } catch (_) {
        return {};
    }
}

export function toggleLocalLike(postId: string, userId: string): boolean {
    try {
        if (typeof window === 'undefined') return true;
        const likes = getLocalLikes();
        const key = `${userId}_${postId}`;
        const isLiked = !likes[key];
        likes[key] = isLiked;
        localStorage.setItem('knock_local_likes', JSON.stringify(likes));
        updateLocalPostLikes(postId, isLiked ? 1 : -1);
        return isLiked;
    } catch (_) {
        return true;
    }
}

export function getLocalComments(postId: string): CommentData[] {
    try {
        if (typeof window === 'undefined') return [];
        const raw = localStorage.getItem(`knock_comments_${postId}`);
        return raw ? JSON.parse(raw) : [];
    } catch (_) {
        return [];
    }
}

export function saveLocalComment(comment: CommentData): void {
    try {
        if (typeof window === 'undefined') return;
        const comments = getLocalComments(comment.post_id);
        const updated = [comment, ...comments];
        localStorage.setItem(`knock_comments_${comment.post_id}`, JSON.stringify(updated));
    } catch (_) {}
}
