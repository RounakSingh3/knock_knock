import { supabase } from './supabase';

// ── Types ──────────────────────────────────────────────

export interface ProfileData {
    id: string;
    username: string;
    name: string;
    gender: string;
    dob?: string;
    avatar_url: string;
    points: number;
    created_at?: string;
}

export interface PostData {
    id: string;
    user_id: string;
    username: string;
    avatar_url: string;
    image_url: string;
    caption: string;
    attached_link?: string;
    likes_count: number;
    created_at: string;
}

// ── Posts ──────────────────────────────────────────────

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

export async function createNewPost(post: {
    user_id: string;
    username: string;
    avatar_url: string;
    image_url: string;
    caption: string;
    attached_link?: string;
}) {
    const { data, error } = await supabase
        .from('posts')
        .insert({
            user_id: post.user_id,
            username: post.username,
            avatar_url: post.avatar_url,
            image_url: post.image_url,
            caption: post.caption,
            attached_link: post.attached_link,
            likes_count: 0,
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

<<<<<<< HEAD
export async function fetchUserLikedPostIds(userId: string): Promise<Set<string>> {
    const { data, error } = await supabase.from('likes').select('post_id').eq('user_id', userId);
    if (error) return new Set();
    return new Set((data || []).map(d => d.post_id));
=======
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
>>>>>>> 3b4f6af (feat: Combined Instagram + Snapchat stories redesign with streak system)
}

export async function fetchAllLikes(): Promise<Record<string, Set<string>>> {
    const { data, error } = await supabase.from('likes').select('user_id, post_id');
    const result: Record<string, Set<string>> = {};
    if (error) {
        console.error('Error fetching all likes:', error);
        return result;
    }
    for (const row of (data || [])) {
        if (!result[row.user_id]) result[row.user_id] = new Set();
        result[row.user_id].add(row.post_id);
    }
    return result;
}

// ── Bookmarks ──────────────────────────────────────────

export async function checkIfBookmarked(userId: string, postId: string): Promise<boolean> {
    const { data } = await supabase
        .from('bookmarks')
        .select('user_id')
        .eq('user_id', userId)
        .eq('post_id', postId)
        .maybeSingle();
    return !!data;
}

export async function toggleBookmark(userId: string, postId: string, currentlyBookmarked: boolean) {
    if (currentlyBookmarked) {
        const { error } = await supabase.from('bookmarks').delete().eq('user_id', userId).eq('post_id', postId);
        if (error) console.error('Error removing bookmark:', error);
    } else {
        const { error } = await supabase.from('bookmarks').insert({ user_id: userId, post_id: postId });
        if (error) console.error('Error adding bookmark:', error);
    }
}

export async function fetchUserBookmarkedPostIds(userId: string): Promise<Set<string>> {
    const { data, error } = await supabase.from('bookmarks').select('post_id').eq('user_id', userId);
    if (error) return new Set();
    return new Set((data || []).map(d => d.post_id));
}

// ── Comments ───────────────────────────────────────────

export interface CommentData {
    id: string;
    post_id: string;
    user_id: string;
    username: string;
    avatar_url?: string;
    content: string;
    created_at: string;
}

export async function fetchComments(postId: string): Promise<CommentData[]> {
    const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
    if (error) {
        console.error('Error fetching comments:', error);
        return [];
    }
    return data || [];
}

export async function addComment(postId: string, userId: string, username: string, avatarUrl: string | undefined, content: string): Promise<CommentData | null> {
    const { data, error } = await supabase
        .from('comments')
        .insert({ post_id: postId, user_id: userId, username, avatar_url: avatarUrl, content })
        .select()
        .single();
    if (error) {
        console.error('Error adding comment:', error);
        return null;
    }
    return data;
}

export async function deleteComment(commentId: string) {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) console.error('Error deleting comment:', error);
}

// ── Follows ────────────────────────────────────────────

export interface FollowData {
    follower_id: string;
    following_id: string;
    created_at: string;
}

export async function checkIfFollowing(followerId: string, followingId: string): Promise<boolean> {
    const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();
    return !!data;
}

export async function toggleFollow(followerId: string, followingId: string, currentlyFollowing: boolean) {
    if (currentlyFollowing) {
        const { error } = await supabase.from('follows').delete().eq('follower_id', followerId).eq('following_id', followingId);
        if (error) console.error('Error unfollowing:', error);
    } else {
        const { error } = await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId });
        if (error) console.error('Error following:', error);
    }
}

export async function fetchFollowCounts(userId: string): Promise<{ followers: number, following: number }> {
    const [followersRes, followingRes] = await Promise.all([
        supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId)
    ]);
    return {
        followers: followersRes.count || 0,
        following: followingRes.count || 0
    };
}

export async function fetchFollowers(userId: string): Promise<ProfileData[]> {
    const { data: followsData, error: followsError } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId);
    if (followsError || !followsData) return [];
    
    const followerIds = followsData.map(d => d.follower_id);
    if (followerIds.length === 0) return [];

    const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', followerIds);
    if (profilesError) return [];
    return profilesData || [];
}

export async function fetchFollowing(userId: string): Promise<ProfileData[]> {
    const { data: followsData, error: followsError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);
    if (followsError || !followsData) return [];
    
    const followingIds = followsData.map(d => d.following_id);
    if (followingIds.length === 0) return [];

    const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', followingIds);
    if (profilesError) return [];
    return profilesData || [];
}

// ── User Profile / Points ──────────────────────────────

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

/**
 * Securely increment points via server-side RPC.
 * Users can only ADD points, never set arbitrary values.
 */
export async function incrementPoints(amount: number) {
    const { error } = await supabase.rpc('increment_points', { amount });
    if (error) console.error('Error incrementing points:', error);
}

/**
 * Securely spend points via server-side RPC.
 * Validates sufficient balance server-side. Throws on insufficient points.
 */
export async function spendPoints(amount: number) {
    const { error } = await supabase.rpc('spend_points', { amount });
    if (error) {
        console.error('Error spending points:', error);
        throw error;
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

export interface StoryData {
    id: string;
<<<<<<< HEAD
    user_id: string;
=======
    user_id: string | null;
    username?: string;
>>>>>>> 3b4f6af (feat: Combined Instagram + Snapchat stories redesign with streak system)
    image_url: string;
    caption?: string;
    hashtags?: string;
    filter_name: string;
    is_boosted: boolean;
    created_at: string;
}

export interface UserStoryGroup {
    userId: string;
    username: string;
    avatarUrl: string;
    stories: StoryData[];
}

export async function groupStoriesWithProfiles(storiesData: StoryData[], currentUserId?: string): Promise<UserStoryGroup[]> {
    if (!storiesData || storiesData.length === 0) return [];

    const uniqueUserIds = Array.from(new Set(storiesData.map(s => s.user_id)));

    const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', uniqueUserIds);

    const profileMap: Record<string, { username: string, avatarUrl: string }> = {};
    profilesData?.forEach(p => {
        profileMap[p.id] = { username: p.username, avatarUrl: p.avatar_url };
    });

    const groupsMap: Record<string, UserStoryGroup> = {};
    storiesData.forEach(story => {
        if (!groupsMap[story.user_id]) {
            groupsMap[story.user_id] = {
                userId: story.user_id,
                username: profileMap[story.user_id]?.username || 'Unknown',
                avatarUrl: profileMap[story.user_id]?.avatarUrl || 'https://i.pravatar.cc/150',
                stories: []
            };
        }
        groupsMap[story.user_id].stories.push(story);
    });

    const result = Object.values(groupsMap);
    result.sort((a, b) => {
        if (currentUserId && a.userId === currentUserId) return -1;
        if (currentUserId && b.userId === currentUserId) return 1;
        const aLast = new Date(a.stories[a.stories.length - 1].created_at).getTime();
        const bLast = new Date(b.stories[b.stories.length - 1].created_at).getTime();
        return bLast - aLast; 
    });

    return result;
}

export async function fetchBoostedStories(): Promise<UserStoryGroup[]> {
    const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('is_boosted', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching stories:', error);
        return [];
    }
    return groupStoriesWithProfiles(data || []);
}

<<<<<<< HEAD
export async function createStory(userId: string, imageUrl: string, caption: string, hashtags: string, filterName: string, isBoosted: boolean) {
=======
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
>>>>>>> 3b4f6af (feat: Combined Instagram + Snapchat stories redesign with streak system)
    const { error } = await supabase
        .from('stories')
        .insert({
            user_id: userId,
            image_url: imageUrl,
            caption: caption,
            hashtags: hashtags,
            filter_name: filterName,
            is_boosted: isBoosted,
            username: username || null,
        });

    if (error) console.error('Error creating story:', error);
}

<<<<<<< HEAD
export async function searchStoriesByHashtag(hashtag: string): Promise<UserStoryGroup[]> {
    const { data, error } = await supabase
        .from('stories')
        .select('*')
        .ilike('hashtags', `%${hashtag}%`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error searching stories by hashtag:', error);
        return [];
    }
    return groupStoriesWithProfiles(data || []);
}

export async function fetchFeedStories(currentUserId: string): Promise<UserStoryGroup[]> {
    // 1. Get users the current user follows
    const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);
    
    const userIds = [currentUserId, ...(follows?.map(f => f.following_id) || [])];

    // 2. Get stories from those users from the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: storiesData } = await supabase
        .from('stories')
        .select('*')
        .in('user_id', userIds)
        .gte('created_at', yesterday)
        .order('created_at', { ascending: true }); // Chronological order per user

    return groupStoriesWithProfiles(storiesData || [], currentUserId);
}

export async function deleteStory(storyId: string) {
    const { error } = await supabase.from('stories').delete().eq('id', storyId);
    if (error) console.error('Error deleting story:', error);
=======
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
>>>>>>> 3b4f6af (feat: Combined Instagram + Snapchat stories redesign with streak system)
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
    profile: ProfileData;
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
export async function fetchAllProfiles(excludeUserId: string): Promise<ProfileData[]> {
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
    // 1. Get all likes mapping in one query (N+1 fix)
    const allLikesMap = await fetchAllLikes();
    const myLikeSet = allLikesMap[currentUserId] || new Set();

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
        const candidateLikeSet = allLikesMap[candidate.id] || new Set();

        // Count shared likes (intersection)
        let sharedLikes = 0;
        for (const postId of myLikeSet) {
            if (candidateLikeSet.has(postId)) {
                sharedLikes++;
            }
        }

        // Union size for Jaccard similarity
        const unionSize = new Set([...myLikeSet, ...candidateLikeSet]).size;
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
            totalLikes: candidateLikeSet.size,
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
