import { supabase } from './supabase';

// ── Posts ──────────────────────────────────────────────

export interface PostData {
    id: string;
    username: string;
    avatar_url: string;
    image_url: string;
    caption: string;
    likes_count: number;
    created_at: string;
    attached_link?: string;
}

export async function fetchPosts(): Promise<PostData[]> {
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching posts:', error);
        return [];
    }
    return data || [];
}

export async function fetchUserPosts(username: string): Promise<PostData[]> {
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('username', username)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching user posts:', error);
        return [];
    }
    return data || [];
}

export async function uploadMedia(file: File, path: string): Promise<string | null> {
    const { data, error } = await supabase.storage
        .from('media')
        .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) {
        console.error('Error uploading media:', error);
        return null;
    }

    const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(path);
    return publicUrlData.publicUrl;
}

export async function createNewPost(post: { username: string; avatar_url: string; image_url: string; caption: string; attached_link?: string }) {
    // Generate a unique ID (uuid) for the post, although Supabase usually auto-generates if we omit 'id' (assuming id is auto-uuid)
    const { data, error } = await supabase
        .from('posts')
        .insert({
            username: post.username,
            avatar_url: post.avatar_url,
            image_url: post.image_url,
            caption: post.caption,
            likes_count: 0,
            attached_link: post.attached_link
        });

    if (error) {
        console.error('Error creating post:', error);
        throw error;
    }
    return data;
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

export async function toggleLike(userId: string, postId: string, currentlyLiked: boolean) {
    if (currentlyLiked) {
        const { error } = await supabase
            .from('likes')
            .delete()
            .eq('user_id', userId)
            .eq('post_id', postId);
        if (error) console.error('Error removing like:', error);
    } else {
        const { error } = await supabase
            .from('likes')
            .insert({ user_id: userId, post_id: postId });
        if (error) console.error('Error adding like:', error);
    }
}

// ── User Profile / Points ──────────────────────────────

export interface ProfileData {
    id: string;
    name: string;
    gender: string;
    avatar_url: string;
    points: number;
}

export async function fetchProfile(userId: string): Promise<ProfileData | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
    return data;
}

export async function fetchProfileByUsername(username: string): Promise<ProfileData | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();

    if (error) {
        console.error('Error fetching profile by username:', error);
        return null;
    }
    return data;
}

export async function updatePoints(userId: string, newPoints: number) {
    const { error } = await supabase
        .from('profiles')
        .update({ points: newPoints })
        .eq('id', userId);

    if (error) console.error('Error updating points:', error);
}

// ── Stories ─────────────────────────────────────────────

export interface StoryData {
    id: string;
    user_id: string | null;
    image_url: string;
    filter_name: string;
    is_boosted: boolean;
    created_at: string;
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
    return data || [];
}

export async function createStory(userId: string, imageUrl: string, filterName: string, isBoosted: boolean) {
    const { error } = await supabase
        .from('stories')
        .insert({
            user_id: userId,
            image_url: imageUrl,
            filter_name: filterName,
            is_boosted: isBoosted,
        });

    if (error) console.error('Error creating story:', error);
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
    return data || [];
}
