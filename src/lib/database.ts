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
        .neq('id', excludeUserId);

    if (error) {
        console.error('Error fetching all profiles:', error);
        return [];
    }
    return data || [];
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

