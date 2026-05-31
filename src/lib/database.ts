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
        .from('knock-knock-eight.versel')
        .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) {
        console.error('Error uploading media:', error);
        return null;
    }

    const { data: publicUrlData } = supabase.storage.from('knock-knock-eight.versel').getPublicUrl(path);
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
    username?: string;
    gender: string;
    avatar_url: string;
    points: number;
    is_online?: boolean;
    streak_count?: number;
    last_story_at?: string;
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

export async function setUserOnlineStatus(userId: string, isOnline: boolean) {
    const { error } = await supabase
        .from('profiles')
        .update({ is_online: isOnline })
        .eq('id', userId);

    if (error) console.error('Error updating online status:', error);
}

// ── Stories ─────────────────────────────────────────────

export interface StoryData {
    id: string;
    user_id: string | null;
    username?: string;
    image_url: string;
    filter_name: string;
    is_boosted: boolean;
    created_at: string;
    caption?: string;
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
    return data || [];
}

/** Fetch stories from the last 24 hours for the Home story rack */
export async function fetchRecentStories(): Promise<StoryData[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from('stories')
        .select('*')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching recent stories:', error);
        return [];
    }
    return data || [];
}

/** Fetch stories belonging to a specific user */
export async function fetchUserStories(userId: string): Promise<StoryData[]> {
    const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching user stories:', error);
        return [];
    }
    return data || [];
}

export async function createStory(userId: string, imageUrl: string, filterName: string, isBoosted: boolean, username?: string) {
    const { error } = await supabase
        .from('stories')
        .insert({
            user_id: userId,
            image_url: imageUrl,
            filter_name: filterName,
            is_boosted: isBoosted,
            username: username || null,
        });

    if (error) console.error('Error creating story:', error);
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
        .neq('id', excludeUserId)
        .eq('is_online', true);

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
    return profiles || [];
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
    return profiles || [];
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
        .select('id')
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
