import type { PostData, StoryData, ProfileData, CommentData, ConnectionWithProfile } from './database';

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
    const msg = (typeof err === 'string' ? err : (err.message || err.error || JSON.stringify(err))).toLowerCase();
    const status = err.status || err.statusCode || (err.response && err.response.status);
    return (
        status === 402 ||
        msg.includes('402') ||
        msg.includes('exceed_cached_egress_quota') ||
        msg.includes('restricted due to the following violations') ||
        msg.includes('used up its quota') ||
        msg.includes('unable to serve requests') ||
        msg.includes('billing') ||
        msg.includes('spend caps') ||
        msg.includes('quota') ||
        msg.includes('egress') ||
        msg.includes('payment required')
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN PROFILES (All authenticated users and creators on Knock Knock)
// ─────────────────────────────────────────────────────────────────────────────
export const KNOWN_PROFILES: ProfileData[] = [
    {
        "id": "1369cfe5-42f1-4346-82be-0f616247092d",
        "username": "ityourfavourite1",
        "name": "Our Favourite ✨",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        "points": 999999999,
        "streak_count": 14,
        "gender": "female",
        "is_online": true,
        "bio": "Welcome to our favorite space ✨ Trending & Viral reels daily"
    },
    {
        "id": "9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8",
        "username": "rounak2",
        "name": "Rounak Singh ⚡",
        "avatar_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        "points": 999999999,
        "streak_count": 21,
        "gender": "male",
        "is_online": true,
        "bio": "Next-gen AI gadgets, tech & viral moments 🚀"
    },
    {
        "id": "794703c5-c695-47bc-864c-60f400ab6fbe",
        "username": "popcorn05",
        "name": "Popcorn 🍿",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        "points": 999999999,
        "streak_count": 18,
        "gender": "female",
        "is_online": true,
        "bio": "Movies, music & trending vibes 🍿💃"
    },
    {
        "id": "12a1a487-5dde-4a77-ab36-aee9ce84fa35",
        "username": "coral",
        "name": "Coral lia 🪸",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
        "points": 500,
        "streak_count": 9,
        "gender": "female",
        "is_online": true,
        "bio": "Capturing peaceful moments & visual stories 🌊"
    },
    {
        "id": "1d9a782d-6990-4018-9232-6aefe57a3db6",
        "username": "tara01",
        "name": "Tara ✨",
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
        "points": 450,
        "streak_count": 12,
        "gender": "female",
        "is_online": true,
        "bio": "Loveee lifeeeeee 🎨"
    },
    {
        "id": "8400dfe6-f113-474f-89e2-3150a2c52908",
        "username": "anaya",
        "name": "Anaya",
        "avatar_url": "https://i.pravatar.cc/150?u=anaya",
        "points": 320,
        "streak_count": 7,
        "gender": "female",
        "is_online": true,
        "bio": "Coffee, books & sunset walks ☕"
    },
    {
        "id": "db5d5090-0230-4ad7-ac2c-97e704e46687",
        "username": "aditya",
        "name": "Aditya",
        "avatar_url": "https://i.pravatar.cc/150?u=aditya",
        "points": 280,
        "streak_count": 5,
        "gender": "male",
        "is_online": true,
        "bio": "Building, coding & gym grind 💪"
    },
    {
        "id": "c51a35d0-2455-401f-9b24-e0c836091bc2",
        "username": "samarth22",
        "name": "Samarth",
        "avatar_url": "https://i.pravatar.cc/150?u=samarth22",
        "points": 310,
        "streak_count": 6,
        "gender": "male",
        "is_online": true,
        "bio": "Good vibes only 💫"
    },
    {
        "id": "c1000000-0000-0000-0000-000000000010",
        "username": "rahul_sharma",
        "name": "Rahul Sharma",
        "avatar_url": "https://i.pravatar.cc/150?u=102",
        "points": 190,
        "streak_count": 4,
        "gender": "male",
        "is_online": true,
        "bio": "Weekend explorer & photographer 📸"
    },
    {
        "id": "c1000000-0000-0000-0000-000000000011",
        "username": "priya_patel99",
        "name": "Priya Patel",
        "avatar_url": "https://i.pravatar.cc/150?u=103",
        "points": 220,
        "streak_count": 6,
        "gender": "female",
        "is_online": true,
        "bio": "Music enthusiast & dancer 💃"
    },
    {
        "id": "c1000000-0000-0000-0000-000000000012",
        "username": "amit_kumar_vlogs",
        "name": "Amit Kumar",
        "avatar_url": "https://i.pravatar.cc/150?u=105",
        "points": 340,
        "streak_count": 8,
        "gender": "male",
        "is_online": true,
        "bio": "Vlogger & cricket lover 🏏"
    },
    {
        "id": "c1000000-0000-0000-0000-000000000013",
        "username": "neha_creates",
        "name": "Neha Singh",
        "avatar_url": "https://i.pravatar.cc/150?u=106",
        "points": 410,
        "streak_count": 10,
        "gender": "female",
        "is_online": true,
        "bio": "Digital artist & storyteller 🎨"
    },
    {
        "id": "c1000000-0000-0000-0000-000000000014",
        "username": "rohit_verma",
        "name": "Rohit Verma",
        "avatar_url": "https://i.pravatar.cc/150?u=108",
        "points": 175,
        "streak_count": 3,
        "gender": "male",
        "is_online": true,
        "bio": "Comedy & lifestyle sketches 😂"
    },
    {
        "id": "c1000000-0000-0000-0000-000000000015",
        "username": "cricket_fever_in",
        "name": "Cricket Fever",
        "avatar_url": "https://i.pravatar.cc/150?u=107",
        "points": 520,
        "streak_count": 11,
        "gender": "other",
        "is_online": true,
        "bio": "All cricket updates, stats & sixes 🏏🔥"
    },
    {
        "id": "c1000000-0000-0000-0000-000000000016",
        "username": "instantbollywood",
        "name": "Instant Bollywood",
        "avatar_url": "https://i.pravatar.cc/150?u=101",
        "points": 890,
        "streak_count": 15,
        "gender": "other",
        "is_online": true,
        "bio": "Bollywood red carpet, celebrity paparazzi & trailers 🎬"
    },
    {
        "id": "c1000000-0000-0000-0000-000000000017",
        "username": "viral_bhayani_fan",
        "name": "Viral Updates",
        "avatar_url": "https://i.pravatar.cc/150?u=104",
        "points": 640,
        "streak_count": 9,
        "gender": "other",
        "is_online": true,
        "bio": "Every celebrity airport look & viral video ⚡"
    },
        {
        "id": "c1000000-0000-0000-0000-000000000019",
        "username": "comedy_vault_in",
        "name": "Comedy Vault 🎭",
        "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
        "points": 820,
        "streak_count": 14,
        "gender": "other",
        "is_online": true,
        "bio": "Non-stop laughs, memes & reels 🎭😂"
    },
    {
        "id": "creator-nature_vibes",
        "username": "nature_vibes",
        "name": "Nature Vibes 🌿",
        "avatar_url": "https://i.pravatar.cc/150?img=1",
        "points": 4200,
        "streak_count": 11,
        "gender": "male",
        "is_online": true,
        "bio": "Capturing the golden hour and coastlines 🌊"
    },
    {
        "id": "creator-city_explorer",
        "username": "city_explorer",
        "name": "City Explorer 🏙️",
        "avatar_url": "https://i.pravatar.cc/150?img=5",
        "points": 3100,
        "streak_count": 8,
        "gender": "other",
        "is_online": true,
        "bio": "Neon lights and late-night city walks 🌌"
    },
    {
        "id": "creator-ocean_dreams",
        "username": "ocean_dreams",
        "name": "Ocean Dreams 🌊",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
        "points": 2800,
        "streak_count": 7,
        "gender": "other",
        "is_online": true,
        "bio": "Deep blue oceans & coral beauty 🐠"
    }
];

export function getKnownProfile(identifier: string): ProfileData | null {
    if (!identifier) return null;
    const clean = identifier.replace(/^@+/, '').trim().toLowerCase();
    const found = KNOWN_PROFILES.find(p => 
        (p.username && p.username.toLowerCase() === clean) || 
        (p.id && p.id.toLowerCase() === clean)
    );
    return found ? { ...found } : null;
}

export function getAllKnownProfiles(): ProfileData[] {
    return [...KNOWN_PROFILES];
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTIC APP SEED POSTS (Restored from database history: ityourfavourite1,
// coral, popcorn05, rounak2, Bollywood stars, and community creators)
// ─────────────────────────────────────────────────────────────────────────────
export const SEED_POSTS: PostData[] = [
    {
        "id": "e0ee2058-c843-434c-a283-5081e32b33e8",
        "user_id": "1369cfe5-42f1-4346-82be-0f616247092d",
        "username": "ityourfavourite1",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1369cfe5-42f1-4346-82be-0f616247092d-1790251043433.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "#trending #foryou #ananyapandey",
        "likes_count": 446,
        "imps_count": 1736,
        "comments_count": 16,
        "shares_count": 13,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-27T23:36:58.904Z"
    },
    {
        "id": "2780c728-673e-4328-95d4-9f478750bed7",
        "user_id": "1369cfe5-42f1-4346-82be-0f616247092d",
        "username": "ityourfavourite1",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1369cfe5-42f1-4346-82be-0f616247092d-1790250917276.mp4?filter=contrast%281.2%29+saturate%281.35%29#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1524504388940-b1c1722653e1%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "#trending #kritisanon #foryou",
        "likes_count": 483,
        "imps_count": 1878,
        "comments_count": 17,
        "shares_count": 14,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-27T19:36:58.905Z"
    },
    {
        "id": "89263984-8734-4c39-abfa-ced552d8dc18",
        "user_id": "1369cfe5-42f1-4346-82be-0f616247092d",
        "username": "ityourfavourite1",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1369cfe5-42f1-4346-82be-0f616247092d-1790250525263.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1517841905240-472988babdf9%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "#viral #sharadhakapoor",
        "likes_count": 520,
        "imps_count": 2020,
        "comments_count": 18,
        "shares_count": 15,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-27T15:36:58.905Z"
    },
    {
        "id": "8998552d-132f-4b23-b52a-9d455e97e362",
        "user_id": "1369cfe5-42f1-4346-82be-0f616247092d",
        "username": "ityourfavourite1",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1369cfe5-42f1-4346-82be-0f616247092d-1790250393758.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1509631179647-0177331693ae%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "#malaikaarora",
        "likes_count": 594,
        "imps_count": 2304,
        "comments_count": 20,
        "shares_count": 17,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-27T07:36:58.905Z"
    },
    {
        "id": "52b23ede-dc9d-4c4d-8371-c01b5c916013",
        "user_id": "1369cfe5-42f1-4346-82be-0f616247092d",
        "username": "ityourfavourite1",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1369cfe5-42f1-4346-82be-0f616247092d-1790250320016.mp4?filter=contrast%281.2%29+saturate%281.35%29#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "#trending",
        "likes_count": 631,
        "imps_count": 2446,
        "comments_count": 21,
        "shares_count": 18,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-27T03:36:58.905Z"
    },
    {
        "id": "c65aebd3-3e5c-46b0-9f61-dabdd733e660",
        "user_id": "1369cfe5-42f1-4346-82be-0f616247092d",
        "username": "ityourfavourite1",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1369cfe5-42f1-4346-82be-0f616247092d-1790251043433.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "#trending #foryou #ananyapandey",
        "likes_count": 668,
        "imps_count": 2588,
        "comments_count": 22,
        "shares_count": 19,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-26T23:36:58.905Z"
    },
    {
        "id": "2263bf34-d852-4542-ab68-74a6cb5d5940",
        "user_id": "1369cfe5-42f1-4346-82be-0f616247092d",
        "username": "ityourfavourite1",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/stories/1369cfe5-42f1-4346-82be-0f616247092d-1790250611179.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1509631179647-0177331693ae%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "#malaikaarora",
        "likes_count": 705,
        "imps_count": 2730,
        "comments_count": 23,
        "shares_count": 5,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-26T19:36:58.905Z"
    },
    {
        "id": "c51a35d0-2455-401f-9b24-e0c836091bc2",
        "user_id": "1369cfe5-42f1-4346-82be-0f616247092d",
        "username": "ityourfavourite1",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/stories/1369cfe5-42f1-4346-82be-0f616247092d-1790250611179.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1509631179647-0177331693ae%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "#malaikaarora",
        "likes_count": 742,
        "imps_count": 2872,
        "comments_count": 24,
        "shares_count": 6,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-26T15:36:58.905Z"
    },
    {
        "id": "22333e58-8009-42ec-bdd0-b2a669f4ca65",
        "user_id": "1369cfe5-42f1-4346-82be-0f616247092d",
        "username": "ityourfavourite1",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1369cfe5-42f1-4346-82be-0f616247092d-1790250454935.jpg#FALLBACK:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1494790108377-be9c29b29330%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "#trending #viral #sahibabali",
        "likes_count": 557,
        "imps_count": 2162,
        "comments_count": 19,
        "shares_count": 16,
        "media_type": "image",
        "category": "General",
        "created_at": "2026-09-27T11:36:58.905Z"
    },
    {
        "id": "f61b3efa-9772-45de-b9dc-db53124ee05b",
        "user_id": "12a1a487-5dde-4a77-ab36-aee9ce84fa35",
        "username": "coral",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/stories/794703c5-c695-47bc-864c-60f400ab6fbe-1790101277787.mp4#BOOST:5|5|0#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1544551763-46a013bb70d5%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 410,
        "imps_count": 1660,
        "comments_count": 13,
        "shares_count": 5,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-24T07:36:58.906Z"
    },
    {
        "id": "709973b8-b7fe-40e3-a876-7377006078d9",
        "user_id": "12a1a487-5dde-4a77-ab36-aee9ce84fa35",
        "username": "coral",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/12a1a487-5dde-4a77-ab36-aee9ce84fa35-1790006172650.mp4?filter=contrast%281.2%29+saturate%281.35%29#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1544551763-46a013bb70d5%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 484,
        "imps_count": 1944,
        "comments_count": 15,
        "shares_count": 7,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-23T23:36:58.906Z"
    },
    {
        "id": "d32a96e0-4855-4714-ae94-8a043a60b112",
        "user_id": "12a1a487-5dde-4a77-ab36-aee9ce84fa35",
        "username": "coral",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/e0ee2058-c843-434c-a283-5081e32b33e8-1780679313328.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1544551763-46a013bb70d5%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 521,
        "imps_count": 2086,
        "comments_count": 16,
        "shares_count": 8,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-23T19:36:58.906Z"
    },
    {
        "id": "9c15de65-dbd3-4ad4-894c-1895f67c5da5",
        "user_id": "12a1a487-5dde-4a77-ab36-aee9ce84fa35",
        "username": "coral",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/12a1a487-5dde-4a77-ab36-aee9ce84fa35-1790006172650.mp4?filter=contrast%281.2%29+saturate%281.35%29#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1544551763-46a013bb70d5%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 595,
        "imps_count": 2370,
        "comments_count": 18,
        "shares_count": 10,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-23T11:36:58.906Z"
    },
    {
        "id": "12a1a487-5dde-4a77-ab36-aee9ce84fa35",
        "user_id": "12a1a487-5dde-4a77-ab36-aee9ce84fa35",
        "username": "coral",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/12a1a487-5dde-4a77-ab36-aee9ce84fa35-1790006636765.mp4?filter=contrast%281.2%29+saturate%281.35%29#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1544551763-46a013bb70d5%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 632,
        "imps_count": 2512,
        "comments_count": 19,
        "shares_count": 11,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-23T07:36:58.906Z"
    },
    {
        "id": "31a3accd-beac-4128-9130-ec9fd2d46894",
        "user_id": "12a1a487-5dde-4a77-ab36-aee9ce84fa35",
        "username": "coral",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/12a1a487-5dde-4a77-ab36-aee9ce84fa35-1790006322762.mp4?filter=contrast%281.2%29+saturate%281.35%29#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1544551763-46a013bb70d5%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 669,
        "imps_count": 2654,
        "comments_count": 20,
        "shares_count": 12,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-23T03:36:58.906Z"
    },
    {
        "id": "9b73cce5-4cbc-4faa-a795-0a67b3a4d11b",
        "user_id": "12a1a487-5dde-4a77-ab36-aee9ce84fa35",
        "username": "coral",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/12a1a487-5dde-4a77-ab36-aee9ce84fa35-1790006222321.mp4?filter=contrast%281.2%29+saturate%281.35%29#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1544551763-46a013bb70d5%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 706,
        "imps_count": 2796,
        "comments_count": 21,
        "shares_count": 13,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-22T23:36:58.906Z"
    },
    {
        "id": "f904d037-5e43-4dce-81b4-873c773166e8",
        "user_id": "12a1a487-5dde-4a77-ab36-aee9ce84fa35",
        "username": "coral",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/12a1a487-5dde-4a77-ab36-aee9ce84fa35-1790006087867.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1544551763-46a013bb70d5%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "♂️",
        "likes_count": 743,
        "imps_count": 2938,
        "comments_count": 22,
        "shares_count": 14,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-22T19:36:58.906Z"
    },
    {
        "id": "62fa7c30-1c10-4a83-a13b-3652c861be0a",
        "user_id": "794703c5-c695-47bc-864c-60f400ab6fbe",
        "username": "popcorn05",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/794703c5-c695-47bc-864c-60f400ab6fbe-1789889502222.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 224,
        "imps_count": 884,
        "comments_count": 10,
        "shares_count": 7,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-28T23:36:58.904Z"
    },
    {
        "id": "3c740bb7-d439-4cbf-bda6-a96d8796f598",
        "user_id": "794703c5-c695-47bc-864c-60f400ab6fbe",
        "username": "popcorn05",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/stories/794703c5-c695-47bc-864c-60f400ab6fbe-1785013193701.jpg#FALLBACK:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "with my friend abhinav",
        "likes_count": 187,
        "imps_count": 742,
        "comments_count": 9,
        "shares_count": 6,
        "media_type": "image",
        "category": "General",
        "created_at": "2026-09-29T03:36:58.904Z"
    },
    {
        "id": "cbe9e8ae-852a-4258-b376-c2cbe3ba3ec5",
        "user_id": "794703c5-c695-47bc-864c-60f400ab6fbe",
        "username": "popcorn05",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/stories/794703c5-c695-47bc-864c-60f400ab6fbe-1785013193701.jpg#FALLBACK:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1550745165-9bc0b252726f%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "💃 Tried this trend and nailed it on the first try 🎯",
        "likes_count": 779,
        "imps_count": 3014,
        "comments_count": 25,
        "shares_count": 7,
        "media_type": "image",
        "category": "General",
        "created_at": "2026-09-26T11:36:58.905Z"
    },
    {
        "id": "df031716-a191-43a0-ba25-e4aafa6860be",
        "user_id": "794703c5-c695-47bc-864c-60f400ab6fbe",
        "username": "popcorn05",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        "image_url": "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop",
        "caption": "Ahhhhhh wohhhhh\\n\\n[MUSIC:https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/fb/74/fb/fb74fb0b-83f3-186a-4833-e0ebdb86cf10/mzaf_6965137412837280913.plus.aac.p.m4a|Take My Breath Away (Love Theme from \\",
        "likes_count": 891,
        "imps_count": 3506,
        "comments_count": 26,
        "shares_count": 18,
        "media_type": "image",
        "category": "General",
        "created_at": "2026-09-22T03:36:58.906Z"
    },
    {
        "id": "e0e55e88-80ca-4af8-8ded-88ae442decc3",
        "user_id": "794703c5-c695-47bc-864c-60f400ab6fbe",
        "username": "popcorn05",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8-1787926877098.jpg#FALLBACK:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "🌧️🌧️🌧️🌧️🌧️🌧️\\n\\n[MUSIC:https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/09/51/0d/09510dea-6579-5cd0-b13b-696abc2c520b/mzaf_10718921821360997069.plus.aac.p.m4a|Apna Bana Le (From \\",
        "likes_count": 781,
        "imps_count": 3146,
        "comments_count": 21,
        "shares_count": 8,
        "media_type": "image",
        "category": "General",
        "created_at": "2026-09-18T19:36:58.906Z"
    },
    {
        "id": "a0e88fbb-e13d-40c6-9978-15cf747c5afc",
        "user_id": "9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8",
        "username": "rounak2",
        "avatar_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8-1786734971377.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1550745165-9bc0b252726f%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "🚀 Next-gen AI gadgets that will blow your mind! #Tech #Future #Viral #Trending",
        "likes_count": 150,
        "imps_count": 600,
        "comments_count": 8,
        "shares_count": 5,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-29T07:36:58.901Z"
    },
    {
        "id": "76c36b45-e907-4447-a8f7-dcc76a5d4a65",
        "user_id": "9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8",
        "username": "rounak2",
        "avatar_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/794703c5-c695-47bc-864c-60f400ab6fbe-1789889460531.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1550745165-9bc0b252726f%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 261,
        "imps_count": 1026,
        "comments_count": 11,
        "shares_count": 8,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-28T19:36:58.904Z"
    },
    {
        "id": "4bf7ea0c-7249-4e0e-8f29-269fa87148c5",
        "user_id": "9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8",
        "username": "rounak2",
        "avatar_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/794703c5-c695-47bc-864c-60f400ab6fbe-1789889422754.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1550745165-9bc0b252726f%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 298,
        "imps_count": 1168,
        "comments_count": 12,
        "shares_count": 9,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-28T15:36:58.904Z"
    },
    {
        "id": "1b23f662-ec3c-478d-92c9-d3a22f107f26",
        "user_id": "9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8",
        "username": "rounak2",
        "avatar_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/794703c5-c695-47bc-864c-60f400ab6fbe-1789889392885.mp4?filter=contrast%281.2%29+saturate%281.35%29#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1550745165-9bc0b252726f%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 335,
        "imps_count": 1310,
        "comments_count": 13,
        "shares_count": 10,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-28T11:36:58.904Z"
    },
    {
        "id": "2ec5e11b-fe9a-44d2-a9fe-35fb5f56131c",
        "user_id": "9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8",
        "username": "rounak2",
        "avatar_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        "image_url": "https://videos.pexels.com/video-files/856029/856029-sd_640_360_30fps.mp4#LINK:https%3A%2F%2Fzara.com|Shop%20Collection|1#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1550745165-9bc0b252726f%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "🚀 Next-gen AI gadgets that will blow your mind! #Tech #Future #Viral #Trending",
        "likes_count": 372,
        "imps_count": 1452,
        "comments_count": 14,
        "shares_count": 11,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-28T07:36:58.904Z"
    },
    {
        "id": "874a5ea9-c17a-46d9-b44e-b47932630d76",
        "user_id": "9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8",
        "username": "rounak2",
        "avatar_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/e0ee2058-c843-434c-a283-5081e32b33e8-1780679313328.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1550745165-9bc0b252726f%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "Knock Knock Video 🚀✨",
        "likes_count": 409,
        "imps_count": 1594,
        "comments_count": 15,
        "shares_count": 12,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-28T03:36:58.904Z"
    },
    {
        "id": "a5ebd7a8-a072-4b70-ab26-5aa3bbee7395",
        "user_id": "9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8",
        "username": "rounak2",
        "avatar_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/794703c5-c695-47bc-864c-60f400ab6fbe-1789889460531.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1550745165-9bc0b252726f%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 373,
        "imps_count": 1518,
        "comments_count": 12,
        "shares_count": 19,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-24T11:36:58.906Z"
    },
    {
        "id": "04197d98-3d46-41ee-b0c4-043e5b48e06f",
        "user_id": "9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8",
        "username": "rounak2",
        "avatar_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/12a1a487-5dde-4a77-ab36-aee9ce84fa35-1790006348732.mp4?filter=contrast%281.2%29+saturate%281.35%29#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1550745165-9bc0b252726f%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "# #trending #viral #foryou #ad",
        "likes_count": 558,
        "imps_count": 2228,
        "comments_count": 17,
        "shares_count": 9,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-23T15:36:58.906Z"
    },
    {
        "id": "46cd6ce5-88c8-465d-a314-d84223980281",
        "user_id": "creator-samarth22",
        "username": "samarth22",
        "avatar_url": "https://i.pravatar.cc/150?u=samarth22",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/794703c5-c695-47bc-864c-60f400ab6fbe-1780251256952.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "Good vide 💫",
        "likes_count": 816,
        "imps_count": 3156,
        "comments_count": 26,
        "shares_count": 8,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-26T07:36:58.905Z"
    },
    {
        "id": "00000000-0000-0000-0000-000000000000",
        "user_id": "creator-google_news_daily",
        "username": "google_news_daily",
        "avatar_url": "https://i.pravatar.cc/150?u=google_news_daily",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1d9a782d-6990-4018-9232-6aefe57a3db6-1788365669127.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1550745165-9bc0b252726f%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "🎨 30 hours of work in 30 seconds. What should I paint next?', category: 'Art' }],  +            'coffee_corner': [{ videoUrl: 'https://videos.pexels.com/video-files/5752729/5752729-sd_640_360_30fps.mp4', song: 'Coffee — Beabadoobee', caption: '☕ The perfect pour. Nothing beats that first sip in the morning', category: 'Lifestyle' }],  +            'astro_lover': [{ videoUrl: 'https://videos.pexels.com/video-files/2519660/2519660-sd_640_360_24fps.mp4', song: 'Starlight — Muse', caption: '🌌 The Milky Way never gets old. Who else is a night owl? 🦉', category: 'Nature' }],  +            'morning_routine': [{ videoUrl: 'https://videos.pexels.com/video-files/3571264/3571264-sd_640_360_30fps.mp4', song: 'Sunrise — Norah Jones', caption: '☀️ 5AM morning routine that changed my life', category: 'Lifestyle' }],  +        };  +  +        const creatorKey = cleanUsername.toLowerCase();  +        if (REEL_CREATOR_POSTS[creatorKey]) {  +            return REEL_CREATOR_POSTS[creatorKey].map((p, idx) => ({  +                id: `reel-${creatorKey}-${idx}`,  +                username: creatorKey,  +                avatar_url: `https://i.pravatar.cc/150?u=${creatorKey}`,  +                image_url: p.videoUrl,  +                caption: p.caption,  +                likes_count: 1200 + idx * 350,  +                media_type: 'video",
        "likes_count": 225,
        "imps_count": 950,
        "comments_count": 8,
        "shares_count": 15,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-25T03:36:58.906Z"
    },
    {
        "id": "1d9a782d-6990-4018-9232-6aefe57a3db6",
        "user_id": "1d9a782d-6990-4018-9232-6aefe57a3db6",
        "username": "tara01",
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1d9a782d-6990-4018-9232-6aefe57a3db6-1788365669127.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "What is loveeeee",
        "likes_count": 262,
        "imps_count": 1092,
        "comments_count": 9,
        "shares_count": 16,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-24T23:36:58.906Z"
    },
    {
        "id": "ebfbd7d4-355f-4eee-bbdc-4ec41049f0a5",
        "user_id": "1d9a782d-6990-4018-9232-6aefe57a3db6",
        "username": "tara01",
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
        "image_url": "https://videos.pexels.com/video-files/3015510/3015510-sd_640_360_24fps.mp4#LINK:https%3A%2F%2Fstore.apple.com|Explore%20Gadgets|1#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "🎨 Street art is the voice of the city walls",
        "likes_count": 299,
        "imps_count": 1234,
        "comments_count": 10,
        "shares_count": 17,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-24T19:36:58.906Z"
    },
    {
        "id": "db5d5090-0230-4ad7-ac2c-97e704e46687",
        "user_id": "creator-aditya",
        "username": "aditya",
        "avatar_url": "https://i.pravatar.cc/150?u=aditya",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/e0ee2058-c843-434c-a283-5081e32b33e8-1789649639698.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 336,
        "imps_count": 1376,
        "comments_count": 11,
        "shares_count": 18,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-24T15:36:58.906Z"
    },
    {
        "id": "38707ec8-c920-49fe-9a26-80eb02eae2bd",
        "user_id": "1d9a782d-6990-4018-9232-6aefe57a3db6",
        "username": "tara01",
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/12a1a487-5dde-4a77-ab36-aee9ce84fa35-1790006636765.mp4?filter=contrast%281.2%29+saturate%281.35%29#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 447,
        "imps_count": 1802,
        "comments_count": 14,
        "shares_count": 6,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-24T03:36:58.906Z"
    },
    {
        "id": "913a3253-7c34-4fb7-a413-66f34afd9bb2",
        "user_id": "creator-amit_kumar_vlogs",
        "username": "amit_kumar_vlogs",
        "avatar_url": "https://i.pravatar.cc/150?u=amit_kumar_vlogs",
        "image_url": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1531415074868-036b107e775a%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "What a match! Virat Kohli is a legend! 🏏🔥 #CricketFever",
        "likes_count": 189,
        "imps_count": 874,
        "comments_count": 30,
        "shares_count": 7,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-21T11:36:58.906Z"
    },
    {
        "id": "7ef5d83a-bedf-41c8-ad6b-aa6e38266a7b",
        "user_id": "creator-rohit_verma",
        "username": "rohit_verma",
        "avatar_url": "https://i.pravatar.cc/150?u=rohit_verma",
        "image_url": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1550745165-9bc0b252726f%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "My mom reacts to my new haircut... hilarious! 😂😂 #DesiMoms",
        "likes_count": 226,
        "imps_count": 1016,
        "comments_count": 31,
        "shares_count": 8,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-21T07:36:58.906Z"
    },
    {
        "id": "56fa0911-a20b-4c6b-97d8-6b26ed65b6c9",
        "user_id": "creator-cricket_fever_in",
        "username": "cricket_fever_in",
        "avatar_url": "https://i.pravatar.cc/150?u=cricket_fever_in",
        "image_url": "https://media.w3.org/2010/05/sintel/trailer.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "This new song is stuck in my head! 🎶🕺 #TrendingReels",
        "likes_count": 263,
        "imps_count": 1158,
        "comments_count": 32,
        "shares_count": 9,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-21T03:36:58.906Z"
    },
    {
        "id": "649604c8-88d4-4486-8605-779fe288069d",
        "user_id": "1d9a782d-6990-4018-9232-6aefe57a3db6",
        "username": "tara01",
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1d9a782d-6990-4018-9232-6aefe57a3db6-1788365669127.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "What is loveeeee",
        "likes_count": 300,
        "imps_count": 1300,
        "comments_count": 8,
        "shares_count": 10,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-20T23:36:58.906Z"
    },
    {
        "id": "57ba0fae-d272-43bc-acec-c95a8ec877bd",
        "user_id": "creator-epic_fails_and_laughs",
        "username": "epic_fails_and_laughs",
        "avatar_url": "https://i.pravatar.cc/150?u=epic_fails_and_laughs",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8-1785491738814.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "Cats living in 2050 while we are stuck in 2026 🐱🚀 #funnycats #animalsdoingthings 🍿🎬 #7",
        "likes_count": 337,
        "imps_count": 1442,
        "comments_count": 9,
        "shares_count": 11,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-20T19:36:58.906Z"
    },
    {
        "id": "3079d69f-8065-4a17-ac2b-2a56fab35fae",
        "user_id": "creator-viral_laugh_zone",
        "username": "viral_laugh_zone",
        "avatar_url": "https://i.pravatar.cc/150?u=viral_laugh_zone",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/89f9373e-a948-402b-8e52-b2d7ff088047-1784644485023.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1550745165-9bc0b252726f%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "Trying to explain to my mom that the parcel is an 'investment' and not another waste of money 📦🤡 🍿🎬 #20",
        "likes_count": 374,
        "imps_count": 1584,
        "comments_count": 10,
        "shares_count": 12,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-20T15:36:58.906Z"
    },
    {
        "id": "3e7969c2-55ee-4c26-9201-429dd604437c",
        "user_id": "creator-viral_laugh_zone",
        "username": "viral_laugh_zone",
        "avatar_url": "https://i.pravatar.cc/150?u=viral_laugh_zone",
        "image_url": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "That one friend who falls in slow motion and takes everyone down with them 📉😂 #friendship 🍿🎬 #60",
        "likes_count": 411,
        "imps_count": 1726,
        "comments_count": 11,
        "shares_count": 13,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-20T11:36:58.906Z"
    },
    {
        "id": "6b168e1f-fb76-497c-baae-c84798a32a4e",
        "user_id": "creator-gaming_lounge_hq",
        "username": "gaming_lounge_hq",
        "avatar_url": "https://i.pravatar.cc/150?u=gaming_lounge_hq",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1d9a782d-6990-4018-9232-6aefe57a3db6-1788365669127.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "Cyberpunk neon battle station ready for the weekend ranked grind 🎮🕹️ #gamingsetup #battlestation ✨ #10",
        "likes_count": 596,
        "imps_count": 2436,
        "comments_count": 16,
        "shares_count": 18,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-19T15:36:58.906Z"
    },
    {
        "id": "ad8a8663-2b11-4982-b530-74660b76037e",
        "user_id": "1d9a782d-6990-4018-9232-6aefe57a3db6",
        "username": "tara01",
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1d9a782d-6990-4018-9232-6aefe57a3db6-1788365722709.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "Lifeeeee",
        "likes_count": 892,
        "imps_count": 3572,
        "comments_count": 24,
        "shares_count": 11,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-18T07:36:58.906Z"
    },
    {
        "id": "bf5ac787-7239-433a-8363-f9ab78fb57f8",
        "user_id": "1d9a782d-6990-4018-9232-6aefe57a3db6",
        "username": "tara01",
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1d9a782d-6990-4018-9232-6aefe57a3db6-1788365745047.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 929,
        "imps_count": 3714,
        "comments_count": 25,
        "shares_count": 12,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-18T03:36:58.906Z"
    },
    {
        "id": "589c4f84-664e-4664-91c2-f8c667244986",
        "user_id": "1d9a782d-6990-4018-9232-6aefe57a3db6",
        "username": "tara01",
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1d9a782d-6990-4018-9232-6aefe57a3db6-1788365833941.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "Neve give up",
        "likes_count": 966,
        "imps_count": 656,
        "comments_count": 26,
        "shares_count": 13,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-17T23:36:58.906Z"
    },
    {
        "id": "e25593d6-f240-433f-b0a4-897301b94cfd",
        "user_id": "1d9a782d-6990-4018-9232-6aefe57a3db6",
        "username": "tara01",
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1d9a782d-6990-4018-9232-6aefe57a3db6-1788365764265.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 153,
        "imps_count": 798,
        "comments_count": 27,
        "shares_count": 14,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-17T19:36:58.906Z"
    },
    {
        "id": "b61e7484-e316-49bd-8be6-193a0c648e8c",
        "user_id": "1d9a782d-6990-4018-9232-6aefe57a3db6",
        "username": "tara01",
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1d9a782d-6990-4018-9232-6aefe57a3db6-1788365789691.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 190,
        "imps_count": 940,
        "comments_count": 28,
        "shares_count": 15,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-17T15:36:58.906Z"
    },
    {
        "id": "79a6e664-b40a-440c-834f-8d7d53f3c9d2",
        "user_id": "1d9a782d-6990-4018-9232-6aefe57a3db6",
        "username": "tara01",
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1d9a782d-6990-4018-9232-6aefe57a3db6-1788365812702.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "",
        "likes_count": 227,
        "imps_count": 1082,
        "comments_count": 29,
        "shares_count": 16,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-17T11:36:58.906Z"
    },
    {
        "id": "445016e2-42a2-4992-a1a3-b314a5b0ef72",
        "user_id": "1d9a782d-6990-4018-9232-6aefe57a3db6",
        "username": "tara01",
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/1d9a782d-6990-4018-9232-6aefe57a3db6-1788365875987.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "Loveee lifeeeeee",
        "likes_count": 264,
        "imps_count": 1224,
        "comments_count": 30,
        "shares_count": 17,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-17T07:36:58.906Z"
    },
    {
        "id": "1b8fa524-08d9-4ba6-84ee-f84b01a40212",
        "user_id": "creator-funny_clips_daily",
        "username": "funny_clips_daily",
        "avatar_url": "https://i.pravatar.cc/150?u=funny_clips_daily",
        "image_url": "https://vjs.zencdn.net/v/oceans.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1514306191717-452ec28c7814%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "When your dog hears the chip packet open from 3 rooms away 🐶⚡ #doglovers #comedyreels 🍿🎬 #45",
        "likes_count": 301,
        "imps_count": 1366,
        "comments_count": 31,
        "shares_count": 18,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-17T03:36:58.906Z"
    },
    {
        "id": "c01d8bed-031b-4ece-b953-46088cb2eaa9",
        "user_id": "c1000000-0000-0000-0000-000000000002",
        "username": "comedy_vault_in",
        "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/e0ee2058-c843-434c-a283-5081e32b33e8-1780679313328.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "When you try to act cool in front of your crush and this happens 😂🙌 #relatable #viralvideo 🍿🎬 #26",
        "likes_count": 338,
        "imps_count": 1508,
        "comments_count": 32,
        "shares_count": 19,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-16T23:36:58.906Z"
    },
    {
        "id": "5d6b8135-32fc-4949-a600-ba355b34a048",
        "user_id": "c1000000-0000-0000-0000-000000000002",
        "username": "comedy_vault_in",
        "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
        "image_url": "https://media.w3.org/2010/05/sintel/trailer.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "When you try to act cool in front of your crush and this happens 😂🙌 #relatable #viralvideo 🍿🎬 #50",
        "likes_count": 375,
        "imps_count": 1650,
        "comments_count": 8,
        "shares_count": 5,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-16T19:36:58.906Z"
    },
    {
        "id": "0a018bea-4db1-4482-81e3-fe54b32c5d05",
        "user_id": "c1000000-0000-0000-0000-000000000002",
        "username": "comedy_vault_in",
        "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
        "image_url": "https://www.w3schools.com/html/mov_bbb.mp4#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "Me walking out of the exam hall knowing I wrote pure poetry on page 4 📝🫠 #studentproblems 🍿🎬 #58",
        "likes_count": 412,
        "imps_count": 1792,
        "comments_count": 9,
        "shares_count": 6,
        "media_type": "video",
        "category": "General",
        "created_at": "2026-09-16T15:36:58.907Z"
    }
];

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTIC STORIES
// ─────────────────────────────────────────────────────────────────────────────
export const SEED_STORIES: StoryData[] = [
    {
        "id": "story-fav-1",
        "user_id": "1369cfe5-42f1-4346-82be-0f616247092d",
        "username": "ityourfavourite1",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        "image_url": "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&auto=format&fit=crop#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1509631179647-0177331693ae%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "✨ Malaika Arora vibes today! #trending #story",
        "is_boosted": true,
        "likes_count": 420,
        "created_at": "2026-09-29T08:03:46.018Z"
    },
    {
        "id": "story-coral-1",
        "user_id": "12a1a487-5dde-4a77-ab36-aee9ce84fa35",
        "username": "coral",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
        "image_url": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1544551763-46a013bb70d5%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "🌊 Peaceful ocean waves & coral reefs #boost",
        "is_boosted": true,
        "likes_count": 310,
        "created_at": "2026-09-29T07:18:46.077Z"
    },
    {
        "id": "story-pop-1",
        "user_id": "794703c5-c695-47bc-864c-60f400ab6fbe",
        "username": "popcorn05",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        "image_url": "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1489599849927-2ee91cede3ba%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "Movie night with friends! 🍿🎶",
        "likes_count": 245,
        "created_at": "2026-09-29T06:18:46.077Z"
    },
    {
        "id": "story-rounak-1",
        "user_id": "9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8",
        "username": "rounak2",
        "avatar_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        "image_url": "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1550745165-9bc0b252726f%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "Next-gen gadgets test bench 🚀⚡",
        "likes_count": 512,
        "created_at": "2026-09-29T05:28:46.077Z"
    },
    {
        "id": "story-tara-1",
        "user_id": "1d9a782d-6990-4018-9232-6aefe57a3db6",
        "username": "tara01",
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
        "image_url": "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=800&auto=format&fit=crop#POSTER:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1518173946687-a4c8a383392e%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "Street art in the evening light 🎨✨",
        "likes_count": 180,
        "created_at": "2026-09-29T03:48:46.077Z"
    }
];

export function getLocalStories(): StoryData[] {
    const now = Date.now();
    const refreshTimestamp = (s: StoryData, idx: number): StoryData => {
        const time = new Date(s.created_at).getTime();
        if (isNaN(time) || now - time > 23 * 60 * 60 * 1000) {
            return {
                ...s,
                created_at: new Date(now - (idx + 1) * 90 * 60 * 1000).toISOString()
            };
        }
        return s;
    };

    try {
        if (typeof window === 'undefined') return SEED_STORIES.map(refreshTimestamp);
        const stored = localStorage.getItem('knock_local_stories');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const existingIds = new Set(parsed.map((s: StoryData) => s.id));
                const missing = SEED_STORIES.filter(s => !existingIds.has(s.id));
                return [...parsed, ...missing].map(refreshTimestamp);
            }
        }
    } catch (_) {}
    const refreshed = SEED_STORIES.map(refreshTimestamp);
    try {
        localStorage.setItem('knock_local_stories', JSON.stringify(refreshed));
    } catch (_) {}
    return refreshed;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTIC CONNECTIONS & FRIENDS
// ─────────────────────────────────────────────────────────────────────────────
export const SEED_CONNECTIONS: ConnectionWithProfile[] = [
    {
        "id": "conn-fav-1",
        "user_a": "current_user",
        "user_b": "1369cfe5-42f1-4346-82be-0f616247092d",
        "streak_count": 14,
        "compatibility_percent": 96,
        "shared_likes": 12,
        "last_interaction_at": "2026-09-29T08:18:46.077Z",
        "streakStatus": "active",
        "profile": {
            "id": "1369cfe5-42f1-4346-82be-0f616247092d",
            "username": "ityourfavourite1",
            "name": "Our Favourite ✨",
            "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
            "points": 999999999,
            "streak_count": 14,
            "gender": "female",
            "is_online": true,
            "bio": "Welcome to our favorite space ✨ Trending & Viral reels daily"
        }
    },
    {
        "id": "conn-pop-2",
        "user_a": "current_user",
        "user_b": "794703c5-c695-47bc-864c-60f400ab6fbe",
        "streak_count": 18,
        "compatibility_percent": 92,
        "shared_likes": 9,
        "last_interaction_at": "2026-09-29T07:48:46.077Z",
        "streakStatus": "active",
        "profile": {
            "id": "794703c5-c695-47bc-864c-60f400ab6fbe",
            "username": "popcorn05",
            "name": "Popcorn 🍿",
            "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
            "points": 999999999,
            "streak_count": 18,
            "gender": "female",
            "is_online": true,
            "bio": "Movies, music & trending vibes 🍿💃"
        }
    },
    {
        "id": "conn-coral-3",
        "user_a": "current_user",
        "user_b": "12a1a487-5dde-4a77-ab36-aee9ce84fa35",
        "streak_count": 9,
        "compatibility_percent": 88,
        "shared_likes": 7,
        "last_interaction_at": "2026-09-29T06:48:46.077Z",
        "streakStatus": "active",
        "profile": {
            "id": "12a1a487-5dde-4a77-ab36-aee9ce84fa35",
            "username": "coral",
            "name": "Coral lia 🪸",
            "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
            "points": 500,
            "streak_count": 9,
            "gender": "female",
            "is_online": true,
            "bio": "Capturing peaceful moments & visual stories 🌊"
        }
    },
    {
        "id": "conn-rounak-4",
        "user_a": "current_user",
        "user_b": "9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8",
        "streak_count": 21,
        "compatibility_percent": 94,
        "shared_likes": 15,
        "last_interaction_at": "2026-09-29T08:33:46.077Z",
        "streakStatus": "active",
        "profile": {
            "id": "9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8",
            "username": "rounak2",
            "name": "Rounak Singh ⚡",
            "avatar_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
            "points": 999999999,
            "streak_count": 21,
            "gender": "male",
            "is_online": true,
            "bio": "Next-gen AI gadgets, tech & viral moments 🚀"
        }
    },
    {
        "id": "conn-tara-5",
        "user_a": "current_user",
        "user_b": "1d9a782d-6990-4018-9232-6aefe57a3db6",
        "streak_count": 12,
        "compatibility_percent": 85,
        "shared_likes": 8,
        "last_interaction_at": "2026-09-29T04:48:46.077Z",
        "streakStatus": "active",
        "profile": {
            "id": "1d9a782d-6990-4018-9232-6aefe57a3db6",
            "username": "tara01",
            "name": "Tara ✨",
            "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
            "points": 450,
            "streak_count": 12,
            "gender": "female",
            "is_online": true,
            "bio": "Loveee lifeeeeee 🎨"
        }
    },
    {
        "id": "conn-aditya-6",
        "user_a": "current_user",
        "user_b": "db5d5090-0230-4ad7-ac2c-97e704e46687",
        "streak_count": 5,
        "compatibility_percent": 78,
        "shared_likes": 4,
        "last_interaction_at": "2026-09-29T02:48:46.077Z",
        "streakStatus": "active",
        "profile": {
            "id": "db5d5090-0230-4ad7-ac2c-97e704e46687",
            "username": "aditya",
            "name": "Aditya",
            "avatar_url": "https://i.pravatar.cc/150?u=aditya",
            "points": 280,
            "streak_count": 5,
            "gender": "male",
            "is_online": true,
            "bio": "Building, coding & gym grind 💪"
        }
    },
    {
        "id": "conn-anaya-7",
        "user_a": "current_user",
        "user_b": "8400dfe6-f113-474f-89e2-3150a2c52908",
        "streak_count": 7,
        "compatibility_percent": 81,
        "shared_likes": 5,
        "last_interaction_at": "2026-09-29T00:48:46.077Z",
        "streakStatus": "active",
        "profile": {
            "id": "8400dfe6-f113-474f-89e2-3150a2c52908",
            "username": "anaya",
            "name": "Anaya",
            "avatar_url": "https://i.pravatar.cc/150?u=anaya",
            "points": 320,
            "streak_count": 7,
            "gender": "female",
            "is_online": true,
            "bio": "Coffee, books & sunset walks ☕"
        }
    },
    {
        "id": "conn-rahul-8",
        "user_a": "current_user",
        "user_b": "c1000000-0000-0000-0000-000000000010",
        "streak_count": 4,
        "compatibility_percent": 74,
        "shared_likes": 3,
        "last_interaction_at": "2026-09-28T22:48:46.077Z",
        "streakStatus": "active",
        "profile": {
            "id": "c1000000-0000-0000-0000-000000000010",
            "username": "rahul_sharma",
            "name": "Rahul Sharma",
            "avatar_url": "https://i.pravatar.cc/150?u=102",
            "points": 190,
            "streak_count": 4,
            "gender": "male",
            "is_online": true,
            "bio": "Weekend explorer & photographer 📸"
        }
    }
];

export function getLocalConnections(userId?: string): ConnectionWithProfile[] {
    try {
        if (typeof window === 'undefined') return SEED_CONNECTIONS;
        const stored = localStorage.getItem('knock_local_connections');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const existingIds = new Set(parsed.map((c: ConnectionWithProfile) => c.id));
                const missing = SEED_CONNECTIONS.filter(c => !existingIds.has(c.id));
                return [...parsed, ...missing];
            }
        }
    } catch (_) {}
    try {
        localStorage.setItem('knock_local_connections', JSON.stringify(SEED_CONNECTIONS));
    } catch (_) {}
    return SEED_CONNECTIONS;
}

export function removeLocalConnection(connectionId: string): void {
    try {
        if (typeof window === 'undefined') return;
        const current = getLocalConnections();
        const updated = current.filter(c => c.id !== connectionId);
        localStorage.setItem('knock_local_connections', JSON.stringify(updated));
    } catch (_) {}
}

export function bumpLocalConnectionStreak(connectionId: string): number {
    try {
        if (typeof window === 'undefined') return 1;
        const current = getLocalConnections();
        let newStreak = 1;
        const updated = current.map(c => {
            if (c.id === connectionId) {
                newStreak = (c.streak_count || 1) + 1;
                return {
                    ...c,
                    streak_count: newStreak,
                    streakStatus: 'active' as const,
                    last_interaction_at: new Date().toISOString()
                };
            }
            return c;
        });
        localStorage.setItem('knock_local_connections', JSON.stringify(updated));
        return newStreak;
    } catch (_) {
        return 1;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL POST PERSISTENCE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'knock_local_posts_v5';
const FAKE_ACCOUNTS = new Set(['bollywood_superstars', 'baklol_kumar', 'meme_hub_insta', 'epic_fun_page', 'relatable_postss']);

export function getLocalPosts(): PostData[] {
    try {
        if (typeof window === 'undefined') return SEED_POSTS;
        const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('knock_local_posts');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Filter out any obsolete generic mock seed IDs
                const cleaned = parsed.filter((p: PostData) => p && !p.id.startsWith('seed-fav-') && !p.id.startsWith('seed-reel-') && !p.id.startsWith('seed-photo-') && !FAKE_ACCOUNTS.has(p.username) && !(p.media_type === 'image' && p.image_url?.includes('images.unsplash.com') && p.username !== 'popcorn05' && p.username !== 'ityourfavourite1'));
                const existingIds = new Set(cleaned.map((p: PostData) => p.id));
                const missingSeeds = SEED_POSTS.filter(s => !existingIds.has(s.id));
                const merged = [...cleaned, ...missingSeeds];
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                    localStorage.setItem('knock_local_posts', JSON.stringify(merged));
                } catch (_) {}
                return merged;
            }
        }
    } catch (_) {}

    // Initialize storage with authentic posts
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_POSTS));
        localStorage.setItem('knock_local_posts', JSON.stringify(SEED_POSTS));
    } catch (_) {}
    return SEED_POSTS;
}

export function saveLocalPost(post: PostData): void {
    try {
        if (typeof window === 'undefined') return;
        const posts = getLocalPosts();
        const updated = [post, ...posts.filter(p => p.id !== post.id)];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
