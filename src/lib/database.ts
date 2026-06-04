import { supabase } from './supabase';
import { isVideoPost, type MediaType } from './media';

const STORAGE_BUCKET =
    import.meta.env.VITE_STORAGE_BUCKET || 'knock-knock-eight.versel';

// ── Posts ──────────────────────────────────────────────

export interface PostData {
    id: string;
    user_id?: string;
    username: string;
    avatar_url: string;
    image_url: string;
    caption: string;
    likes_count: number;
    comments_count?: number;
    shares_count?: number;
    created_at: string;
    attached_link?: string;
    media_type?: MediaType | string;
    category?: string;
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

export async function fetchForYouPosts(userId: string): Promise<PostData[]> {
    const connectionIds = await fetchConnectionUserIds(userId);
    
    let query = supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

    // Exclude posts from connected users, and also exclude own posts
    const excludeIds = [...connectionIds, userId];
    
    // Supabase JS doesn't have a simple 'not in' array method directly easily without string joining if array is empty, 
    // but .not('user_id', 'in', `(${excludeIds.join(',')})`) works.
    if (excludeIds.length > 0) {
        query = query.not('user_id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching For You posts:', error);
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

export async function uploadMedia(file: File, path: string): Promise<string> {
    const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || undefined,
        });

    if (error) {
        console.error('Error uploading media:', error);
        throw new Error(error.message || 'Failed to upload file to storage.');
    }

    const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return publicUrlData.publicUrl;
}

export async function fetchVideoPosts(): Promise<PostData[]> {
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching video posts:', error);
        return [];
    }
    return (data || []).filter((p) => isVideoPost(p));
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
}) {
    const row: Record<string, unknown> = {
        username: post.username,
        avatar_url: post.avatar_url,
        image_url: post.image_url,
        caption: post.caption,
        likes_count: 0,
        media_type: post.media_type || 'image',
        category: post.category || 'General',
    };
    if (post.user_id) row.user_id = post.user_id;
    if (post.attached_link) row.attached_link = post.attached_link;

    const { data, error } = await supabase.from('posts').insert(row);

    if (error) {
        console.error('Error creating post:', error);
        throw new Error(error.message || 'Failed to create post in database.');
    }
    return data;
}

/** Upload a canvas/data-URL story image to storage */
export async function uploadStoryImage(dataUrl: string, userId: string): Promise<string> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], `story-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const path = `stories/${userId}-${Date.now()}.jpg`;
    return uploadMedia(file, path);
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
    bio?: string;
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

export async function createStory(
    userId: string,
    imageUrl: string,
    filterName: string,
    isBoosted: boolean,
    username?: string
): Promise<{ error: Error | null }> {
    const { error } = await supabase.from('stories').insert({
        user_id: userId,
        image_url: imageUrl,
        filter_name: filterName,
        is_boosted: isBoosted,
        username: username || null,
    });

    if (error) {
        console.error('Error creating story:', error);
        return { error: new Error(error.message) };
    }
    return { error: null };
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
    // Fetch connections where user is either user_a or user_b
    const { data: connectionsA, error: errA } = await supabase
        .from('connections')
        .select('*')
        .eq('user_a', userId);

    const { data: connectionsB, error: errB } = await supabase
        .from('connections')
        .select('*')
        .eq('user_b', userId);

    if (errA) console.error('Error fetching connections (A):', errA);
    if (errB) console.error('Error fetching connections (B):', errB);

    const allConnections: ConnectionData[] = [
        ...(connectionsA || []),
        ...(connectionsB || []),
    ];

    if (allConnections.length === 0) return [];

    // For each connection, fetch the OTHER user's profile
    const results: ConnectionWithProfile[] = [];

    for (const conn of allConnections) {
        const otherUserId = conn.user_a === userId ? conn.user_b : conn.user_a;
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', otherUserId)
            .maybeSingle();

        if (profile) {
            results.push({
                ...conn,
                profile: profile as ProfileData & { username: string },
                streakStatus: computeStreakStatus(conn.last_interaction_at),
            });
        }
    }

    // Sort: active streaks first, then by streak count descending
    results.sort((a, b) => {
        const statusOrder = { active: 0, at_risk: 1, broken: 2 };
        const statusDiff = statusOrder[a.streakStatus] - statusOrder[b.streakStatus];
        if (statusDiff !== 0) return statusDiff;
        return b.streak_count - a.streak_count;
    });

    return results;
}

/** Update a connection's streak (call when users interact) */
export async function updateConnectionStreak(connectionId: string): Promise<{ newStreak: number }> {
    // Get current connection
    const { data: conn } = await supabase
        .from('connections')
        .select('*')
        .eq('id', connectionId)
        .single();

    if (!conn) return { newStreak: 0 };

    const status = computeStreakStatus(conn.last_interaction_at);
    let newStreak = 1;

    if (status === 'active' || status === 'at_risk') {
        // Check if it's a new day (avoid double-counting same-day interactions)
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

    if (error) console.error('Error updating connection streak:', error);
    return { newStreak };
}

/** Remove a connection */
export async function removeConnection(connectionId: string): Promise<void> {
    const { error } = await supabase
        .from('connections')
        .delete()
        .eq('id', connectionId);

    if (error) console.error('Error removing connection:', error);
}

/** Fetch all connection user IDs for a given user */
export async function fetchConnectionUserIds(userId: string): Promise<string[]> {
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
    ];

    return ids;
}

/** Fetch posts only from connected users */
export async function fetchConnectionPosts(userId: string): Promise<PostData[]> {
    const connectionIds = await fetchConnectionUserIds(userId);
    if (connectionIds.length === 0) return [];

    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .in('user_id', connectionIds)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching connection posts:', error);
        return [];
    }
    return data || [];
}

/** Fetch stories only from connected users (last 24h) */
export async function fetchConnectionStories(userId: string): Promise<StoryData[]> {
    const connectionIds = await fetchConnectionUserIds(userId);
    if (connectionIds.length === 0) return [];

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from('stories')
        .select('*')
        .in('user_id', connectionIds)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching connection stories:', error);
        return [];
    }
    return data || [];
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

/** Fetch messages between two users */
export async function fetchMessages(user1: string, user2: string): Promise<MessageData[]> {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user1},receiver_id.eq.${user2}),and(sender_id.eq.${user2},receiver_id.eq.${user1})`)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching messages:', error);
        return [];
    }
    return data || [];
}

/** Send a message */
export async function sendMessage(senderId: string, receiverId: string, content: string): Promise<{ data: MessageData | null; error: Error | null }> {
    const { data, error } = await supabase
        .from('messages')
        .insert({
            sender_id: senderId,
            receiver_id: receiverId,
            content,
        })
        .select()
        .single();

    if (error) {
        console.error('Error sending message:', error);
        return { data: null, error: new Error(error.message) };
    }
    return { data, error: null };
}

/** Subscribe to incoming messages for a specific conversation */
export function subscribeToMessages(user1: string, user2: string, onNewMessage: (msg: MessageData) => void) {
    return supabase
        .channel(`messages-${user1}-${user2}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `sender_id=eq.${user2}`, // Listen for messages sent BY the other user
            },
            (payload) => {
                if (payload.new.receiver_id === user1) {
                    onNewMessage(payload.new as MessageData);
                }
            }
        )
        .subscribe();
}

/** Fetch multiple profiles by their IDs */
export async function fetchProfilesByIds(userIds: string[]): Promise<ProfileData[]> {
    if (userIds.length === 0) return [];
    
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);
        
    if (error) {
        console.error('Error fetching profiles by ids:', error);
        return [];
    }
    return data || [];
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

/** Track a user engagement event */
export async function trackEngagement(
    userId: string,
    postId: string,
    actionType: string,
    value: number = 1,
    category: string = 'General'
): Promise<void> {
    const { error } = await supabase
        .from('engagements')
        .insert({
            user_id: userId,
            post_id: postId,
            action_type: actionType,
            value,
            category,
        });

    if (error) {
        console.error('Error tracking engagement:', error);
    }
}

/** Fetch all engagements for a user (for building interest profile) */
export async function fetchUserEngagements(userId: string): Promise<EngagementData[]> {
    const { data, error } = await supabase
        .from('engagements')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(500); // Last 500 interactions for recency

    if (error) {
        console.error('Error fetching user engagements:', error);
        return [];
    }
    return data || [];
}

/** Fetch all posts (unpaginated) for scoring — used by algorithm.ts */
export async function fetchAllPostsForScoring(excludeUserId: string): Promise<PostData[]> {
    const connectionIds = await fetchConnectionUserIds(excludeUserId);
    const excludeIds = [...connectionIds, excludeUserId];

    let query = supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

    if (excludeIds.length > 0) {
        query = query.not('user_id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching posts for scoring:', error);
        return [];
    }
    return data || [];
}

// ── Voice Reactions ────────────────────────────────────────

/** Upload a voice reaction audio blob to Supabase storage */
export async function uploadVoiceReaction(audioBlob: Blob, userId: string): Promise<string> {
    const fileName = `voice_${userId}_${Date.now()}.webm`;
    const filePath = `voice-reactions/${fileName}`;

    const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, audioBlob, {
            contentType: 'audio/webm',
            upsert: false,
        });

    if (error) {
        console.error('Error uploading voice reaction:', error);
        throw new Error(error.message || 'Failed to upload voice reaction.');
    }

    const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

    return urlData.publicUrl;
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
    const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching comments:', error);
        return [];
    }
    return data || [];
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

    if (!error) {
        // Increment comment count on the post
        await supabase.rpc('increment_field', { row_id: postId, field_name: 'comments_count', table_name: 'posts' }).catch(() => {
            // Fallback: manual increment if RPC doesn't exist
            supabase.from('posts').select('comments_count').eq('id', postId).single().then(({ data: post }) => {
                if (post) {
                    supabase.from('posts').update({ comments_count: (post.comments_count || 0) + 1 }).eq('id', postId);
                }
            });
        });
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

/** Search users by username */
export async function searchUsers(query: string): Promise<ProfileData[]> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${query}%`)
        .limit(20);

    if (error) {
        console.error('Error searching users:', error);
        return [];
    }
    return data || [];
}

/** Search posts by caption */
export async function searchPostsByCaption(query: string): Promise<PostData[]> {
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .ilike('caption', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) {
        console.error('Error searching posts:', error);
        return [];
    }
    return data || [];
}

// ── Delete Post ────────────────────────────────────────────

/** Delete a post (only your own) */
export async function deletePost(postId: string): Promise<boolean> {
    const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

    if (error) {
        console.error('Error deleting post:', error);
        return false;
    }
    return true;
}

// ── Profile Update ─────────────────────────────────────────

/** Update profile fields */
export async function updateProfile(
    userId: string,
    updates: { username?: string; bio?: string; avatar_url?: string }
): Promise<boolean> {
    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

    if (error) {
        console.error('Error updating profile:', error);
        return false;
    }
    return true;
}
