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

export async function fetchPosts(): Promise<PostData[]> {
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Error fetching posts:', error);
        return [];
    }
    return (data || []).map(normalizePost);
}

export async function fetchForYouPosts(userId: string): Promise<PostData[]> {
    const connectionIds = await fetchConnectionUserIds(userId);

    let query = supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

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
    return (data || []).map(normalizePost);
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
    return (data || []).map(normalizePost);
}

export async function uploadMedia(
    file: File, 
    path: string,
    onProgress?: (progress: { loaded: number; total: number }) => void
): Promise<string> {
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
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Error fetching video posts:', error);
        return [];
    }
    return (data || []).map(normalizePost).filter((p) => isVideoPost(p));
}

export function normalizePost(post: PostData): PostData {
    if (!post) return post;
    let caption = post.caption || '';
    let music_url = post.music_url;
    let music_title = post.music_title;
    let music_artist = post.music_artist;

    if (caption.includes('[MUSIC:')) {
        const match = caption.match(/\[MUSIC:([^|]+)\|([^|]*)\|([^\]]*)\]/);
        if (match) {
            if (!music_url) {
                music_url = match[1];
                music_title = match[2] || 'Song';
                music_artist = match[3] || '';
            }
        }
        caption = caption.replace(/\[MUSIC:[^\]]+\]/g, '').trim();
    }

    return {
        ...post,
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
        console.error('Error creating post:', error);
        throw new Error(error.message || 'Failed to create post in database.');
    }
    return data;
}

/** Upload a canvas/data-URL story image or video to storage */
export async function uploadStoryImage(dataUrl: string, userId: string): Promise<string> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const isVideo = blob.type.startsWith('video/') || dataUrl.startsWith('data:video/');
    const ext = isVideo ? 'mp4' : 'jpg';
    const mime = isVideo ? (blob.type || 'video/mp4') : 'image/jpeg';
    const file = new File([blob], `story-${Date.now()}.${ext}`, { type: mime });
    const path = `stories/${userId}-${Date.now()}.${ext}`;
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

// Batch check: fetch all liked post IDs in one query instead of N individual queries
export async function checkIfLikedBatch(userId: string, postIds: string[]): Promise<Record<string, boolean>> {
    if (postIds.length === 0) return {};
    const { data } = await supabase
        .from('likes')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', postIds);

    const result: Record<string, boolean> = {};
    postIds.forEach(id => { result[id] = false; });
    (data || []).forEach((row: any) => { result[row.post_id] = true; });
    return result;
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
    music_title?: string;
    music_artist?: string;
    music_url?: string;
}

export function normalizeStory(story: StoryData): StoryData {
    if (!story) return story;
    let image_url = story.image_url || '';
    let music_url = story.music_url;
    let music_title = story.music_title;
    let music_artist = story.music_artist;

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

    return {
        ...story,
        image_url,
        music_url,
        music_title,
        music_artist,
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
    return (data || []).map(normalizeStory);
}

/** Fetch stories from the last 24 hours for the Home story rack */
export async function fetchRecentStories(): Promise<StoryData[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from('stories')
        .select('*')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Error fetching recent stories:', error);
        return [];
    }
    return (data || []).map(normalizeStory);
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
    return (data || []).map(normalizeStory);
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
        imageUrl = `${imageUrl}#MUSIC:${musicUrl}|${musicTitle || ''}|${musicArtist || ''}`;
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
    return (data || []).map(normalizePost);
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

/** Fetch all connection user IDs for a given user (Voice matches) */
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
    return (data || []).map(normalizePost);
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
    return (data || []).map(normalizeStory);
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

/** Mark messages from a specific sender as read */
export async function markMessagesAsRead(senderId: string, receiverId: string): Promise<void> {
    const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', senderId)
        .eq('receiver_id', receiverId)
        .eq('is_read', false);

    if (error) {
        console.error('Error marking messages as read:', error);
    }
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

/** Delete a message */
export async function deleteMessage(messageId: string, userId: string): Promise<{ error: Error | null }> {
    const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', userId); // Ensure only the sender can delete

    if (error) {
        console.error('Error deleting message:', error);
        return { error: new Error(error.message) };
    }
    return { error: null };
}

/** Subscribe to messages for a specific conversation (both sent and received) */
export function subscribeToMessages(user1: string, user2: string, onNewMessage: (msg: MessageData) => void) {
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
        .limit(80);

    if (excludeIds.length > 0) {
        query = query.not('user_id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching posts for scoring:', error);
        return [];
    }
    return (data || []).map(normalizePost);
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
    return (data || []).map(normalizePost);
}

export async function fetchDiscoverPosts(category?: string | null, limit: number = 30): Promise<PostData[]> {
    let query = supabase
        .from('posts')
        .select('*')
        .order('likes_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200); // Fetch extra to ensure enough data after deduplication
        
    if (category && category !== 'All') {
        query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching discover posts:', error);
        return [];
    }
    
    // Deduplicate by media URL to prevent identical placeholder videos from repeating
    const seenUrls = new Set<string>();
    const uniquePosts: PostData[] = [];
    for (const p of (data || [])) {
        if (!seenUrls.has(p.image_url)) {
            seenUrls.add(p.image_url);
            uniquePosts.push(p);
        }
    }
    
    return uniquePosts.slice(0, limit).map(normalizePost);
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

// -------------------------------------------------------------------------
// 🚀 Boost Feature
// -------------------------------------------------------------------------

export async function boostPost(postId: string, currentUserId: string, currentPoints: number, amount: number = 100): Promise<boolean> {
    if (currentPoints < amount) return false;
    
    // Deduct points
    const { error: pointsError } = await supabase
        .from('profiles')
        .update({ points: currentPoints - amount })
        .eq('id', currentUserId);
        
    if (pointsError) {
        console.error('Error deducting points:', pointsError);
        return false;
    }
    
    // Set expiry to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const { error: postError } = await supabase
        .from('posts')
        .update({ 
            boost_expires_at: expiresAt.toISOString(),
            boost_impressions_remaining: amount
        })
        .eq('id', postId);
        
    if (postError) {
        console.error('Error boosting post:', postError);
        return false;
    }
    
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
    
    return (data || []).map(normalizePost);
}

// ── Engagement Psychology Helpers ──────────────────────────

/** Fetch trending posts — most liked in the last 24 hours */
export async function fetchTrendingPosts(limit: number = 6): Promise<PostData[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .gte('created_at', oneDayAgo)
        .order('likes_count', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching trending posts:', error);
        return [];
    }
    return (data || []).map(normalizePost);
}

/** Count stories posted in the last hour (for FOMO indicator) */
export async function fetchRecentStoriesCount(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
        .from('stories')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo);

    if (error) {
        console.error('Error fetching recent stories count:', error);
        return 0;
    }
    return count || 0;
}

/** Fetch top 3 streak users for the leaderboard */
export async function fetchTopStreakUsers(limit: number = 3): Promise<ProfileData[]> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .gt('streak_count', 0)
        .order('streak_count', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching top streak users:', error);
        return [];
    }
    return data || [];
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


