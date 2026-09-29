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
        "caption": "Knock Knock Video' });  108:         } else {  109:             window.open(currentStory.link_url, '_blank', 'noopener,noreferrer');  110:         }  The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.  ==================== Created At: 2026-09-23T00:29:30+05:30 Completed At: 2026-09-23T00:29:30+05:30 File Path: `file:///c:/Users/rick7/knock%20knock/src/components/StoryViewer.tsx` Total Lines: 1044 Total Bytes: 46745 Showing lines 595 to 630 The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space. 595:   596:             {/* Story Image / Video */}  597:             {isVideoUrl(currentStory.image_url) ? (  598:                 <video  599:                     ref={storyVideoRef}  600:                     src={currentStory.image_url}  601:                     autoPlay  602:                     playsInline  603:                     muted={Boolean(currentStory.music_url || currentStory.music_title)}  604:                     className=\"story-image\"  605:                     onTimeUpdate={handleVideoTimeUpdate}  606:                     onEnded={handleVideoEnded}  607:                     onError={() => {  608:                         console.warn('Video failed to load in StoryViewer:', currentStory.id);  609:                         handleNextStory();  610:                     }}  611:                     style={{ filter: currentStory.filter_name ? (FILTER_MAP[currentStory.filter_name] || 'none') : 'none', objectFit: 'contain' }}  612:                 />  613:             ) : (  614:                 <img   615:                     src={currentStory.image_url}   616:                     alt=\"Story\"   617:                     className=\"story-image\"  618:                     onError={() => {  619:                         console.warn('Image failed to load in StoryViewer:', currentStory.id);  620:                         handleNextStory();  621:                     }}  622:                     style={{ filter: currentStory.filter_name ? (FILTER_MAP[currentStory.filter_name] || 'none') : 'none' }}  623:                 />  624:             )}  625:   626:             {/* Toast when converted to Snap */}  627:             {snapConvertedToast && (  628:                 <div style={{  629:                     position: 'absolute",
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
        "id": "13d6d695-d5b6-414a-8596-0362b727a16a",
        "user_id": "9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8",
        "username": "rounak2",
        "avatar_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/794703c5-c695-47bc-864c-60f400ab6fbe-1786022693330.jpg?filter=grayscale%281%29+contrast%281.1%29+brightness%281.1%29#FALLBACK:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1550745165-9bc0b252726f%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "\\n\\n",
        "likes_count": 965,
        "imps_count": 3790,
        "comments_count": 28,
        "shares_count": 5,
        "media_type": "image",
        "category": "General",
        "music_title": "Dooriyan",
        "music_artist": "Pritam & Mohit Chauhan",
        "music_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/3a/fd/6c/3afd6c59-09a1-8587-795c-537fdb807e5f/mzaf_14422382797970666821.plus.aac.p.m4a",
        "created_at": "2026-09-21T19:36:58.906Z"
    },
    {
        "id": "35d1da81-ed85-496d-9356-205a912a389a",
        "user_id": "c1000000-0000-0000-0000-000000000001",
        "username": "bollywood_superstars",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        "image_url": "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=800&auto=format&fit=crop",
        "caption": "Alia Bhatt wins international hearts with stunning red carpet appearance 🌟👗 #AliaBhatt ✨ #7",
        "likes_count": 780,
        "imps_count": 3080,
        "comments_count": 23,
        "shares_count": 15,
        "media_type": "image",
        "category": "Entertainment",
        "created_at": "2026-09-22T15:36:58.906Z"
    },
    {
        "id": "65fae274-73e8-4469-bad9-afff7beb9c66",
        "user_id": "c1000000-0000-0000-0000-000000000001",
        "username": "bollywood_superstars",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        "image_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop",
        "caption": "King Khan Shah Rukh Khan in dapper new photoshoot! Royalty personified 👑✨ #SRK #KingKhan #Bollywood ✨ #9",
        "likes_count": 817,
        "imps_count": 3222,
        "comments_count": 24,
        "shares_count": 16,
        "media_type": "image",
        "category": "Entertainment",
        "created_at": "2026-09-22T11:36:58.906Z"
    },
    {
        "id": "d75a61cf-b622-4997-8d8d-9f7497c35b17",
        "user_id": "c1000000-0000-0000-0000-000000000001",
        "username": "bollywood_superstars",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        "image_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop",
        "caption": "Ranbir Kapoor looking sharp at grand cinema premiere! Charisma on point 🎥🍿 #RanbirKapoor ✨ #11",
        "likes_count": 854,
        "imps_count": 3364,
        "comments_count": 25,
        "shares_count": 17,
        "media_type": "image",
        "category": "Entertainment",
        "created_at": "2026-09-22T07:36:58.906Z"
    },
    {
        "id": "0dfa9f28-062b-476f-b54c-5c85e009c1cf",
        "user_id": "c1000000-0000-0000-0000-000000000001",
        "username": "bollywood_superstars",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        "image_url": "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop",
        "caption": "King Khan Shah Rukh Khan in dapper new photoshoot! Royalty personified 👑✨ #SRK #KingKhan #Bollywood ✨ #33",
        "likes_count": 928,
        "imps_count": 3648,
        "comments_count": 27,
        "shares_count": 19,
        "media_type": "image",
        "category": "Entertainment",
        "created_at": "2026-09-21T23:36:58.906Z"
    },
    {
        "id": "f274be27-6334-4ece-972b-291809d70c84",
        "user_id": "c1000000-0000-0000-0000-000000000001",
        "username": "bollywood_superstars",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        "image_url": "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&auto=format&fit=crop",
        "caption": "Ranbir Kapoor looking sharp at grand cinema premiere! Charisma on point 🎥🍿 #RanbirKapoor ✨ #43",
        "likes_count": 152,
        "imps_count": 732,
        "comments_count": 29,
        "shares_count": 6,
        "media_type": "image",
        "category": "Entertainment",
        "created_at": "2026-09-21T15:36:58.906Z"
    },
    {
        "id": "8daab2e2-3b5e-4e47-ac75-b9ad2410a4ca",
        "user_id": "c1000000-0000-0000-0000-000000000001",
        "username": "bollywood_superstars",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        "image_url": "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop",
        "caption": "Alia Bhatt wins international hearts with stunning red carpet appearance 🌟👗 #AliaBhatt ✨ #15",
        "likes_count": 633,
        "imps_count": 2578,
        "comments_count": 17,
        "shares_count": 19,
        "media_type": "image",
        "category": "Entertainment",
        "created_at": "2026-09-19T11:36:58.906Z"
    },
    {
        "id": "843d6aa8-03e7-47f7-8d53-45012a9e8c93",
        "user_id": "c1000000-0000-0000-0000-000000000001",
        "username": "bollywood_superstars",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        "image_url": "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&auto=format&fit=crop",
        "caption": "King Khan Shah Rukh Khan in dapper new photoshoot! Royalty personified 👑✨ #SRK #KingKhan #Bollywood ✨ #17",
        "likes_count": 670,
        "imps_count": 2720,
        "comments_count": 18,
        "shares_count": 5,
        "media_type": "image",
        "category": "Entertainment",
        "created_at": "2026-09-19T07:36:58.906Z"
    },
    {
        "id": "749d1823-d085-47e4-b1d3-4a37693ca23b",
        "user_id": "c1000000-0000-0000-0000-000000000001",
        "username": "bollywood_superstars",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        "image_url": "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&auto=format&fit=crop",
        "caption": "Ranbir Kapoor looking sharp at grand cinema premiere! Charisma on point 🎥🍿 #RanbirKapoor ✨ #19",
        "likes_count": 707,
        "imps_count": 2862,
        "comments_count": 19,
        "shares_count": 6,
        "media_type": "image",
        "category": "Entertainment",
        "created_at": "2026-09-19T03:36:58.906Z"
    },
    {
        "id": "ea28ee91-4c86-436d-8b56-2ed563cfbd98",
        "user_id": "c1000000-0000-0000-0000-000000000001",
        "username": "bollywood_superstars",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        "image_url": "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=800&auto=format&fit=crop",
        "caption": "Allu Arjun Pushpa 2 hype breaks every streaming metric in cinema history 🪓🔥 #Pushpa2 #AlluArjun ✨ #21",
        "likes_count": 744,
        "imps_count": 3004,
        "comments_count": 20,
        "shares_count": 7,
        "media_type": "image",
        "category": "Entertainment",
        "created_at": "2026-09-18T23:36:58.906Z"
    },
    {
        "id": "8ea3f5de-e55a-4825-9765-b7a63a4dc151",
        "user_id": "c1000000-0000-0000-0000-000000000001",
        "username": "bollywood_superstars",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        "image_url": "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop",
        "caption": "Allu Arjun Pushpa 2 hype breaks every streaming metric in cinema history 🪓🔥 #Pushpa2 #AlluArjun ✨ #29",
        "likes_count": 818,
        "imps_count": 3288,
        "comments_count": 22,
        "shares_count": 9,
        "media_type": "image",
        "category": "Entertainment",
        "created_at": "2026-09-18T15:36:58.906Z"
    },
    {
        "id": "df01d88f-89a2-439e-b30d-e92d63b9c5e6",
        "user_id": "c1000000-0000-0000-0000-000000000001",
        "username": "bollywood_superstars",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        "image_url": "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop",
        "caption": "Alia Bhatt wins international hearts with stunning red carpet appearance 🌟👗 #AliaBhatt ✨ #31",
        "likes_count": 855,
        "imps_count": 3430,
        "comments_count": 23,
        "shares_count": 10,
        "media_type": "image",
        "category": "Entertainment",
        "created_at": "2026-09-18T11:36:58.906Z"
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
        "id": "009cbcdb-0927-4f2c-9b28-43009883d04b",
        "user_id": "creator-baklol_kumar",
        "username": "baklol_kumar",
        "avatar_url": "https://i.pravatar.cc/150?u=baklol_kumar",
        "image_url": "https://ktruosvlqnpcuzayrqkk.supabase.co/storage/v1/object/public/knock-knock-eight.versel/posts/a9d849cf-1221-4e7e-819a-9723f6d1c99d-1778358724263.jpeg#FALLBACK:https%3A%2F%2Fimages.unsplash.com%2Fphoto-1534528741775-53994a69daeb%3Fw%3D800%26auto%3Dformat%26fit%3Dcrop",
        "caption": "test",
        "likes_count": 853,
        "imps_count": 3298,
        "comments_count": 27,
        "shares_count": 9,
        "media_type": "image",
        "category": "General",
        "created_at": "2026-09-26T03:36:58.905Z"
    },
    {
        "id": "767d2424-0642-40cc-9ca9-833ea39da3d2",
        "user_id": "creator-meme_hub_insta",
        "username": "meme_hub_insta",
        "avatar_url": "https://i.pravatar.cc/150?u=meme_hub_insta",
        "image_url": "https://i.imgflip.com/38el31.jpg",
        "caption": "Me calculating how much sleep I'll get if I sleep at exactly 4:17 AM 💀📱 #relatable #memesdaily 😂🔥 #181\"   },   {     id: '96584ce6-8f0d-47d5-8405-94c4e101555e",
        "likes_count": 890,
        "imps_count": 3440,
        "comments_count": 28,
        "shares_count": 10,
        "media_type": "image",
        "category": "General",
        "created_at": "2026-09-25T23:36:58.905Z"
    },
    {
        "id": "26818029-ceff-4775-9872-b6241b8c6229",
        "user_id": "creator-meme_hub_insta",
        "username": "meme_hub_insta",
        "avatar_url": "https://i.pravatar.cc/150?u=meme_hub_insta",
        "image_url": "https://i.imgflip.com/43a45p.png",
        "caption": "Me laughing at my own joke while trying to explain it to my friends 🤣🙌 #friendshipgoals #funnymemes 😂🔥 #66'   },   {     id: 'e1852c89-8a5d-4afc-b082-b783669118da",
        "likes_count": 927,
        "imps_count": 3582,
        "comments_count": 29,
        "shares_count": 11,
        "media_type": "image",
        "category": "General",
        "created_at": "2026-09-25T19:36:58.905Z"
    },
    {
        "id": "98065b39-bf14-4f9c-b98b-4b36b1e4e05c",
        "user_id": "creator-epic_fun_page",
        "username": "epic_fun_page",
        "avatar_url": "https://i.pravatar.cc/150?u=epic_fun_page",
        "image_url": "https://i.imgflip.com/3kwur5.jpg",
        "caption": "The panic when you're watching a video on mute and accidentally click the maximum volume button 🔊💀 😂🔥 #499\"   },   {     id: '05c46dcc-edc2-415e-8ff8-c6439de6216d",
        "likes_count": 964,
        "imps_count": 3724,
        "comments_count": 30,
        "shares_count": 12,
        "media_type": "image",
        "category": "General",
        "created_at": "2026-09-25T15:36:58.905Z"
    },
    {
        "id": "3d913761-41bb-4199-8921-6cbbf44f5a73",
        "user_id": "creator-relatable_postss",
        "username": "relatable_postss",
        "avatar_url": "https://i.pravatar.cc/150?u=relatable_postss",
        "image_url": "https://i.imgflip.com/1tl71a.jpg",
        "caption": "Nobody:\\n' +       'My brain during a serious exam: *playing the IPL theme song on loop* 🧠😂 #examseason 😂🔥 #262'   },   {     id: 'ab4c588d-8b0d-41cb-90df-2bc7b35019b4",
        "likes_count": 151,
        "imps_count": 666,
        "comments_count": 31,
        "shares_count": 13,
        "media_type": "image",
        "category": "General",
        "created_at": "2026-09-25T11:36:58.905Z"
    },
    {
        "id": "899ed5fe-0246-4b6f-9be8-349c5da6338b",
        "user_id": "creator-epic_fun_page",
        "username": "epic_fun_page",
        "avatar_url": "https://i.pravatar.cc/150?u=epic_fun_page",
        "image_url": "https://i.imgflip.com/58eyvu.png",
        "caption": "My WiFi disconnecting for 0.001 seconds during the final ranked match 📶💥 #gamers #bgmimemes 😂🔥 #249'   },   {     id: 'fdf6a5b1-0c77-4e86-b471-8321a30c9c3b",
        "likes_count": 188,
        "imps_count": 808,
        "comments_count": 32,
        "shares_count": 14,
        "media_type": "image",
        "category": "General",
        "created_at": "2026-09-25T07:36:58.905Z"
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
        "id": "ae1b9027-acbe-4782-a71f-ea709c23688f",
        "user_id": "creator-amit_kumar_vlogs",
        "username": "amit_kumar_vlogs",
        "avatar_url": "https://i.pravatar.cc/150?u=amit_kumar_vlogs",
        "image_url": "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=800&auto=format&fit=crop",
        "caption": "Bhai yeh kya dekh liya maine? Wait till the end! 😂💀 #ComedyIndia",
        "likes_count": 448,
        "imps_count": 1868,
        "comments_count": 12,
        "shares_count": 14,
        "media_type": "image",
        "category": "General",
        "created_at": "2026-09-20T07:36:58.906Z"
    },
    {
        "id": "9349a62b-f4c9-4b5b-8544-232e05602079",
        "user_id": "creator-cricket_fever_in",
        "username": "cricket_fever_in",
        "avatar_url": "https://i.pravatar.cc/150?u=cricket_fever_in",
        "image_url": "https://images.unsplash.com/photo-1444464666168-49b626eba1cc?auto=format&fit=crop&w=800&q=80",
        "caption": "My mom reacts to my new haircut... hilarious! 😂😂 #DesiMoms",
        "likes_count": 485,
        "imps_count": 2010,
        "comments_count": 13,
        "shares_count": 15,
        "media_type": "image",
        "category": "General",
        "created_at": "2026-09-20T03:36:58.906Z"
    },
    {
        "id": "ecb5b028-8d04-4272-be3f-7f40693f9f53",
        "user_id": "creator-viral_bhayani_fan",
        "username": "viral_bhayani_fan",
        "avatar_url": "https://i.pravatar.cc/150?u=viral_bhayani_fan",
        "image_url": "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&auto=format&fit=crop",
        "caption": "Just another day fighting Bangalore traffic... 🚦🚗 #TechCity",
        "likes_count": 522,
        "imps_count": 2152,
        "comments_count": 14,
        "shares_count": 16,
        "media_type": "image",
        "category": "General",
        "created_at": "2026-09-19T23:36:58.906Z"
    },
    {
        "id": "326ec467-e226-40ca-ac3e-c93426734ccc",
        "user_id": "creator-cricket_legend_moments",
        "username": "cricket_legend_moments",
        "avatar_url": "https://i.pravatar.cc/150?u=cricket_legend_moments",
        "image_url": "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop",
        "caption": "Rohit Sharma pulling for a majestic six! Effortless timing from the Hitman 🏏🔥 #RohitSharma #IPL ✨ #9",
        "likes_count": 559,
        "imps_count": 2294,
        "comments_count": 15,
        "shares_count": 17,
        "media_type": "image",
        "category": "General",
        "created_at": "2026-09-19T19:36:58.906Z"
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
// LOCAL PERSISTENCE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'knock_local_posts_v4';

export function getLocalPosts(): PostData[] {
    try {
        if (typeof window === 'undefined') return SEED_POSTS;
        const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('knock_local_posts');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Filter out any obsolete generic mock seed IDs
                const cleaned = parsed.filter((p: PostData) => !p.id.startsWith('seed-fav-') && !p.id.startsWith('seed-reel-') && !p.id.startsWith('seed-photo-'));
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
