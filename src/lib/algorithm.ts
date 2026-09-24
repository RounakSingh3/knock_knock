/**
 * algorithm.ts — Knock Knock Hyper-Personalized Recommendation Engine
 * 
 * Implements an advanced, multi-surface engagement architecture:
 * 1. Variable Reward Schedule: Intermittent reinforcement engine mimicking slot machines.
 * 2. Implicit Signal Tracking: Real-time dwell time, scroll velocity, watch completion, loops, audio taps.
 * 3. Hyper-Personalization: 4 distinct AI / algorithmic models for Feed, Stories, Explore, and Reels.
 * 4. Infinite Scroll Stream Generator: Endless cyclical permutation without artificial stopping points.
 */

import { isVideoPost } from './media';
import { trackEngagement, isStoryEligibleForViewerScreen, type PostData, type UserStoryGroup, type StoryData } from './database';

// ── Weight Configuration ───────────────────────────────────
export const ENGAGEMENT_WEIGHTS: Record<string, number> = {
    watch_time: 5,   // Watched >75% of video
    replay: 4,       // Video looped
    share: 4,        // Social sharing
    voice_react: 3,  // High emotional engagement
    like: 2,         // Standard explicit like
    save: 2,         // Bookmark / save
    view: 0.8,       // Scrolled past
    dwell: 3,        // Lingered on card >2.5s
    skip: -1.2,      // Fast flick past item <1.5s
    unmute: 3.5,     // Explicit sound activation
};

// ── Content Categories ─────────────────────────────────────
export const CONTENT_CATEGORIES = [
    'General',
    'Nature',
    'Travel',
    'Food',
    'Sports',
    'Dance',
    'Music',
    'Art',
    'Comedy',
    'Animals',
    'Lifestyle',
    'Fashion',
    'Tech',
    'Education',
    'Gaming',
] as const;

export type ContentCategory = typeof CONTENT_CATEGORIES[number];

// ── Hashtags & Topic Extraction ───────────────────────────
/**
 * Extracts and normalizes all hashtags from caption or description text.
 * Strips leading '#', converts to lowercase, removes duplicates.
 */
export function extractHashtags(text?: string): string[] {
    if (!text || typeof text !== 'string') return [];
    const matches = text.match(/#([a-zA-Z0-9_\u0080-\uFFFF]+)/g);
    if (!matches) return [];
    const set = new Set<string>();
    for (const m of matches) {
        const clean = m.replace(/^#+/, '').trim().toLowerCase();
        if (clean.length > 0) {
            set.add(clean);
        }
    }
    return Array.from(set);
}

// ── Interest Profile ───────────────────────────────────────
export interface UserInterestProfile {
    /** Maps category -> total weighted score */
    categoryScores: Record<string, number>;
    /** Maps hashtag -> total weighted score */
    hashtagScores: Record<string, number>;
    /** Sorted array of top categories */
    topCategories: string[];
    /** Sorted array of top hashtags */
    topHashtags: string[];
    /** Categories the user has rarely or never interacted with */
    unexploredCategories: string[];
}

export function buildInterestProfile(
    engagements: { action_type: string; category: string; value: number }[]
): UserInterestProfile {
    const categoryScores: Record<string, number> = {};

    for (const eng of engagements) {
        const weight = ENGAGEMENT_WEIGHTS[eng.action_type] || 1;
        const score = weight * (eng.value || 1);
        categoryScores[eng.category] = (categoryScores[eng.category] || 0) + score;
    }

    const topCategories = Object.entries(categoryScores)
        .sort((a, b) => b[1] - a[1])
        .map(([cat]) => cat);

    const exploredSet = new Set(topCategories);
    const unexploredCategories = CONTENT_CATEGORIES.filter(c => !exploredSet.has(c));

    const hashtagScores = getLocalHashtagScores();
    const topHashtags = Object.entries(hashtagScores)
        .sort((a, b) => b[1] - a[1])
        .map(([tag]) => tag);

    return { categoryScores, hashtagScores, topCategories, topHashtags, unexploredCategories };
}

// ── Implicit Signal Tracking ───────────────────────────────

export interface ImplicitSignal {
    userId?: string;
    targetId: string;
    category: string;
    hashtags?: string[];
    caption?: string;
    type: 'dwell' | 'skip' | 'watch_pct' | 'replay' | 'unmute' | 'comments_open' | 'share_tap' | 'story_complete' | 'story_skip';
    value: number; // duration in ms, watch %, or replay count
    timestamp?: number;
}

const LOCAL_IMPLICIT_STORAGE_KEY = 'knock_implicit_signals_v1';
const LOCAL_HASHTAG_STORAGE_KEY = 'knock_hashtag_affinity_v1';

let _implicitBuffer: ImplicitSignal[] = [];
let _implicitScoresCache: Record<string, number> | null = null;
let _hashtagScoresCache: Record<string, number> | null = null;

/** Retrieve locally cached implicit hashtag affinity scores */
export function getLocalHashtagScores(): Record<string, number> {
    if (_hashtagScoresCache === null) {
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_HASHTAG_STORAGE_KEY) : null;
            _hashtagScoresCache = raw ? JSON.parse(raw) : {};
        } catch {
            _hashtagScoresCache = {};
        }
    }
    return { ..._hashtagScoresCache! };
}

/** Record interest signal for specific hashtags (likes, dwell time, video loop, click) */
export function recordHashtagSignal(hashtags: string[], delta: number): void {
    if (!hashtags || hashtags.length === 0 || delta === 0) return;
    const scores = getLocalHashtagScores();
    let changed = false;
    for (const rawTag of hashtags) {
        const clean = rawTag.replace(/^#+/, '').trim().toLowerCase();
        if (!clean) continue;
        scores[clean] = Math.max(-20, Math.min(300, (scores[clean] || 0) + delta));
        changed = true;
    }
    if (changed) {
        _hashtagScoresCache = scores;
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem(LOCAL_HASHTAG_STORAGE_KEY, JSON.stringify(scores));
            }
        } catch {}
    }
}

/** Get top ranked hashtag interests for the current user */
export function getUserHashtagInterests(limit: number = 10): { tag: string; score: number }[] {
    const scores = getLocalHashtagScores();
    return Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([tag, score]) => ({ tag: `#${tag}`, score }));
}

function _getSignalDelta(signal: ImplicitSignal): number {
    switch (signal.type) {
        case 'dwell':
            if (signal.value >= 5000) return 4;
            if (signal.value >= 2500) return 2;
            return 0;
        case 'skip':
            return -1.2;
        case 'watch_pct':
            if (signal.value >= 0.9) return 5;
            if (signal.value >= 0.75) return 3;
            if (signal.value < 0.25) return -1;
            return 0;
        case 'replay':
            return Math.min(16, (signal.value || 1) * 4);
        case 'unmute':
            return 3.5;
        case 'comments_open':
            return 2.5;
        case 'share_tap':
            return 4.5;
        case 'story_complete':
            return 3;
        case 'story_skip':
            return -1.5;
        default:
            return 1;
    }
}

function flushImplicitSignals(): void {
    if (_implicitBuffer.length === 0) return;
    if (_implicitScoresCache === null) {
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_IMPLICIT_STORAGE_KEY) : null;
            _implicitScoresCache = raw ? JSON.parse(raw) : {};
        } catch {
            _implicitScoresCache = {};
        }
    }
    const scores = _implicitScoresCache!;
    let changed = false;
    for (const signal of _implicitBuffer) {
        const cat = signal.category || 'General';
        const delta = _getSignalDelta(signal);
        if (delta !== 0) {
            scores[cat] = Math.max(-15, Math.min(250, (scores[cat] || 0) + delta));
            changed = true;

            // Track hashtag affinities from the engaged post
            const tags = signal.hashtags || extractHashtags(signal.caption);
            if (tags.length > 0) {
                recordHashtagSignal(tags, delta * 0.8);
            }

            if (signal.userId && signal.targetId) {
                try {
                    trackEngagement(signal.userId, signal.targetId, `implicit_${signal.type}`, Math.abs(delta), cat).catch(() => {});
                } catch {}
            }
        }
    }
    if (changed) {
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem(LOCAL_IMPLICIT_STORAGE_KEY, JSON.stringify(scores));
            }
        } catch {}
    }
    _implicitBuffer = [];
}

if (typeof window !== 'undefined') {
    const scheduleFlush = () => {
        setTimeout(() => {
            flushImplicitSignals();
            scheduleFlush();
        }, 5000);
    };
    scheduleFlush();
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flushImplicitSignals();
        }
    });
}

/** Retrieve locally cached implicit affinity scores */
export function getLocalImplicitScores(): Record<string, number> {
    if (_implicitScoresCache === null) {
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_IMPLICIT_STORAGE_KEY) : null;
            _implicitScoresCache = raw ? JSON.parse(raw) : {};
        } catch {
            _implicitScoresCache = {};
        }
    }
    if (_implicitBuffer.length === 0) return { ..._implicitScoresCache! };
    
    const merged = { ..._implicitScoresCache! };
    for (const signal of _implicitBuffer) {
        const cat = signal.category || 'General';
        const delta = _getSignalDelta(signal);
        if (delta !== 0) {
            merged[cat] = Math.max(-15, Math.min(250, (merged[cat] || 0) + delta));
        }
    }
    return merged;
}

/**
 * Record a hidden / implicit behavior (dwell time, fast skip, completion %, audio unmuting)
 * Updates real-time localized affinity and asynchronously pushes to database engagement log.
 */
export function recordImplicitSignal(signal: ImplicitSignal): void {
    if (!signal.category && !signal.targetId) return;
    _implicitBuffer.push(signal);
}

/**
 * Merge explicit database engagement profile with fast real-time local implicit signals.
 */
export function getHybridInterestProfile(
    explicitProfile?: UserInterestProfile,
    _userId?: string
): UserInterestProfile {
    const localScores = getLocalImplicitScores();
    const baseScores = explicitProfile?.categoryScores ? { ...explicitProfile.categoryScores } : {};

    for (const [cat, impScore] of Object.entries(localScores)) {
        baseScores[cat] = (baseScores[cat] || 0) + impScore;
    }

    const topCategories = Object.entries(baseScores)
        .sort((a, b) => b[1] - a[1])
        .map(([c]) => c);

    const exploredSet = new Set(topCategories);
    const unexploredCategories = CONTENT_CATEGORIES.filter(c => !exploredSet.has(c));

    const localHashtags = getLocalHashtagScores();
    const baseHashtags = explicitProfile?.hashtagScores ? { ...explicitProfile.hashtagScores } : {};
    for (const [tag, score] of Object.entries(localHashtags)) {
        baseHashtags[tag] = (baseHashtags[tag] || 0) + score;
    }
    const topHashtags = Object.entries(baseHashtags)
        .sort((a, b) => b[1] - a[1])
        .map(([t]) => t);

    return {
        categoryScores: baseScores,
        hashtagScores: baseHashtags,
        topCategories,
        topHashtags,
        unexploredCategories
    };
}

// ── Variable Reward Schedule (Intermittent Reinforcement) ──

/**
 * Intermittent Reinforcement Scheduler
 * 
 * Re-orders candidates so that high-dopamine "Gems" (viral, high-affinity posts)
 * drop at unpredictable intervals (stochastic ratio: ~1 Gem every 2 to 4 items,
 * with occasional back-to-back "Jackpot" hits).
 */
export function scheduleVariableRewards<T>(
    items: T[],
    getViralScore: (item: T) => number
): T[] {
    if (!items || items.length <= 3) return items;

    const scored = items.map(item => ({ item, score: getViralScore(item) }));
    scored.sort((a, b) => b.score - a.score);

    const total = scored.length;
    const tierACount = Math.max(1, Math.floor(total * 0.25)); // Top 25% = Gems
    const tierBCount = Math.max(1, Math.floor(total * 0.55)); // Middle 55% = Solid
    // Remaining 20% = Discovery

    const tierA = scored.slice(0, tierACount).map(s => s.item);
    const tierB = scored.slice(tierACount, tierACount + tierBCount).map(s => s.item);
    const tierC = scored.slice(tierACount + tierBCount).map(s => s.item);

    const result: T[] = [];
    let aIdx = 0;
    let bIdx = 0;
    let cIdx = 0;

    // Stochastic spacing for next Gem
    let nextGemCountdown = Math.random() < 0.25 ? 1 : Math.floor(Math.random() * 3) + 2;

    while (aIdx < tierA.length || bIdx < tierB.length || cIdx < tierC.length) {
        if (nextGemCountdown <= 0 && aIdx < tierA.length) {
            // Drop a Gem!
            result.push(tierA[aIdx++]);
            // Re-arm countdown with stochastic variance (15% chance of consecutive jackpot)
            nextGemCountdown = Math.random() < 0.15 ? 1 : Math.floor(Math.random() * 3) + 2;
            continue;
        }

        // Standard flow: draw from Tier B or Tier C
        if (bIdx < tierB.length && (Math.random() < 0.75 || cIdx >= tierC.length)) {
            result.push(tierB[bIdx++]);
        } else if (cIdx < tierC.length) {
            result.push(tierC[cIdx++]);
        } else if (aIdx < tierA.length) {
            result.push(tierA[aIdx++]);
        } else {
            break;
        }

        nextGemCountdown--;
    }

    return result;
}

// ── Post Scoring & Time Decay ───────────────────────────────

export interface ScoredPost {
    post: any;
    score: number;
    isSurprise: boolean;
}

export function decayFactor(hoursOld: number): number {
    if (hoursOld < 2) return 2.5;
    if (hoursOld < 12) return 1.8;
    if (hoursOld < 24) return 1.4;
    if (hoursOld < 72) return 1.0;
    if (hoursOld < 168) return 0.6;
    return 0.3;
}

export function calculatePostScore(
    post: { id?: string; user_id?: string; category?: string; caption?: string; created_at: string; likes_count?: number; shares_count?: number; imps_count?: number; comments_count?: number },
    userProfile: UserInterestProfile,
    currentUserId?: string
): number {
    let score = 1.0;

    // 1. Category affinity
    const postCategory = post.category || 'General';
    const categoryScore = userProfile.categoryScores[postCategory] || 0;
    score += categoryScore * 0.7;

    // 1b. Hashtag / Topic affinity (Instagram-style compound multi-hashtag boost)
    const postCaption = (post as any).caption || '';
    const postTags = extractHashtags(postCaption);
    if (postTags.length > 0 && userProfile.hashtagScores) {
        let tagAffinity = 0;
        let matchedCount = 0;
        for (const tag of postTags) {
            const tagScore = userProfile.hashtagScores[tag] || 0;
            if (tagScore > 0) {
                tagAffinity += tagScore;
                matchedCount++;
            }
        }
        if (matchedCount > 0) {
            // Matching multiple distinct interests multiplies recommendation relevance
            const compoundMultiplier = 1 + Math.min(1.5, (matchedCount - 1) * 0.35);
            score += (tagAffinity * 0.9) * compoundMultiplier;
        }
    }

    // 2. Engagement signals
    score += (post.likes_count || 0) * 0.08;
    score += (post.shares_count || 0) * 0.15;
    score += ((post as any).comments_count || 0) * 0.12;

    // 3. Imp Boost
    if (post.imps_count && post.imps_count > 0) {
        score += (post.imps_count * 50);
    }

    // 4. Time decay & exploration boost
    const hoursOld = Math.max(0, (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60));
    const decay = decayFactor(hoursOld);
    score *= decay;

    // 5. Active user's own fresh uploads
    if (currentUserId && post.user_id && post.user_id === currentUserId && hoursOld < 48) {
        score += 1000;
    }

    return score;
}

// ── Feed Diversification & Blending ─────────────────────────

export function blendFeed(
    scoredPosts: ScoredPost[],
    userProfile: UserInterestProfile,
    currentUserId?: string
): ScoredPost[] {
    if (scoredPosts.length <= 1) return scoredPosts;

    const ownFreshPosts: ScoredPost[] = [];
    const regularPosts: ScoredPost[] = [];

    for (const item of scoredPosts) {
        const hoursOld = Math.max(0, (Date.now() - new Date(item.post.created_at).getTime()) / (1000 * 60 * 60));
        if (currentUserId && item.post.user_id === currentUserId && hoursOld < 48) {
            ownFreshPosts.push(item);
        } else {
            regularPosts.push(item);
        }
    }

    // Sort regular candidates by score descending
    regularPosts.sort((a, b) => b.score - a.score);

    const surprisePool: ScoredPost[] = [];
    const mainPool: ScoredPost[] = [];

    for (const item of regularPosts) {
        const cat = item.post.category || 'General';
        if (userProfile.unexploredCategories.includes(cat)) {
            surprisePool.push(item);
        } else {
            mainPool.push(item);
        }
    }

    if (mainPool.length === 0) {
        mainPool.push(...surprisePool);
        surprisePool.length = 0;
    }

    const blended: ScoredPost[] = [];
    for (const own of ownFreshPosts) {
        blended.push(own);
    }

    const usedIds = new Set<string>();
    for (const b of blended) {
        if (b.post.id) usedIds.add(b.post.id);
    }

    let surpriseIdx = 0;
    const recentAuthors: string[] = blended.map(s => s.post.username || s.post.user_id || 'anon').slice(-2);
    const recentFormats: ('video' | 'image')[] = blended.map(s => isVideoPost(s.post) ? 'video' : 'image').slice(-2);
    const recentCategories: string[] = blended.map(s => s.post.category || 'General').slice(-2);

    let remainingCount = mainPool.length;
    let candidatePointer = 0;

    while (remainingCount > 0 && candidatePointer < mainPool.length) {
        const nextIndex = blended.length;

        // Inject surprise post (every 5th item)
        if (nextIndex % 5 === 0 && surpriseIdx < surprisePool.length) {
            const surprise = { ...surprisePool[surpriseIdx], isSurprise: true };
            const author = surprise.post.username || surprise.post.user_id || 'anon';
            if (recentAuthors.length === 0 || recentAuthors[recentAuthors.length - 1] !== author) {
                blended.push(surprise);
                if (surprise.post.id) usedIds.add(surprise.post.id);
                recentAuthors.push(author);
                if (recentAuthors.length > 3) recentAuthors.shift();
                recentFormats.push(isVideoPost(surprise.post) ? 'video' : 'image');
                if (recentFormats.length > 3) recentFormats.shift();
                recentCategories.push(surprise.post.category || 'General');
                if (recentCategories.length > 3) recentCategories.shift();
                surpriseIdx++;
                continue;
            }
        }

        const wantImage = recentFormats.length >= 2 && recentFormats.slice(-2).every(f => f === 'video');
        const wantVideo = recentFormats.length >= 2 && recentFormats.slice(-2).every(f => f === 'image');
        const lastAuthor = recentAuthors.length > 0 ? recentAuthors[recentAuthors.length - 1] : '';
        const lastCategory = recentCategories.length > 0 ? recentCategories[recentCategories.length - 1] : '';

        // Windowed lookahead (top 15 available candidates) for lightning-fast O(N) selection
        let bestCandidateIdx = -1;
        let bestCandidateScore = -Infinity;
        let checked = 0;

        for (let i = candidatePointer; i < mainPool.length && checked < 15; i++) {
            const c = mainPool[i];
            if (usedIds.has(c.post.id)) continue;
            checked++;

            const author = c.post.username || c.post.user_id || 'anon';
            const isVid = isVideoPost(c.post);
            const format = isVid ? 'video' : 'image';
            const cat = c.post.category || 'General';

            if (lastAuthor && author === lastAuthor) continue;

            let candidateBonus = c.score;
            if (wantImage && format === 'image') candidateBonus += 50;
            if (wantVideo && format === 'video') candidateBonus += 50;
            if (lastCategory && cat !== lastCategory) candidateBonus += 20;

            if (recentAuthors.length >= 2 && recentAuthors[recentAuthors.length - 2] === author) {
                candidateBonus -= 15;
            }

            if (candidateBonus > bestCandidateScore) {
                bestCandidateScore = candidateBonus;
                bestCandidateIdx = i;
            }
        }

        if (bestCandidateIdx === -1) {
            // Pick first unused candidate
            for (let i = candidatePointer; i < mainPool.length; i++) {
                if (!usedIds.has(mainPool[i].post.id)) {
                    bestCandidateIdx = i;
                    break;
                }
            }
        }

        if (bestCandidateIdx === -1) {
            break;
        }

        const chosen = mainPool[bestCandidateIdx];
        usedIds.add(chosen.post.id);
        blended.push(chosen);
        remainingCount--;

        // Advance candidatePointer past used items
        while (candidatePointer < mainPool.length && usedIds.has(mainPool[candidatePointer].post.id)) {
            candidatePointer++;
        }

        const author = chosen.post.username || chosen.post.user_id || 'anon';
        recentAuthors.push(author);
        if (recentAuthors.length > 3) recentAuthors.shift();

        recentFormats.push(isVideoPost(chosen.post) ? 'video' : 'image');
        if (recentFormats.length > 3) recentFormats.shift();

        recentCategories.push(chosen.post.category || 'General');
        if (recentCategories.length > 3) recentCategories.shift();
    }

    while (surpriseIdx < surprisePool.length) {
        blended.push({ ...surprisePool[surpriseIdx], isSurprise: true });
        surpriseIdx++;
    }

    return blended;
}

export function assembleFeed(
    posts: any[],
    userProfile: UserInterestProfile,
    page: number = 0,
    pageSize: number = 10,
    currentUserId?: string
): ScoredPost[] {
    const scored: ScoredPost[] = posts.map(post => ({
        post,
        score: calculatePostScore(post, userProfile, currentUserId),
        isSurprise: false,
    }));

    const blended = blendFeed(scored, userProfile, currentUserId);
    const start = page * pageSize;
    return blended.slice(start, start + pageSize);
}

export function shuffleFeedForRefresh(
    posts: any[],
    _userProfile?: UserInterestProfile,
    _currentUserId?: string
): any[] {
    if (!posts || posts.length <= 1) return posts;

    const rawList = posts.map(p => (p && p.post ? p.post : p));
    const shuffled: any[] = [];
    for (let i = 0; i < rawList.length; i += 5) {
        const tier = rawList.slice(i, i + 5);
        for (let j = tier.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [tier[j], tier[k]] = [tier[k], tier[j]];
        }
        shuffled.push(...tier);
    }
    return shuffled;
}

// ── Surface 1: Feed Model (rankFeedPosts) ───────────────────

/**
 * Model 1: Dedicated Feed Model
 * Blends social affinity (friends/following), category interest, photo/video interleaving,
 * and passes candidates through the Variable Reward Scheduler.
 */
export function rankFeedPosts(
    posts: PostData[],
    profile: UserInterestProfile,
    currentUserId?: string,
    followingIds: string[] = []
): PostData[] {
    if (!posts || posts.length === 0) return [];

    const followingSet = new Set(followingIds);

    // Screen budget filter: if a post was boosted for extra screens and remaining quota is exhausted, exclude from other viewers' screens
    const eligiblePosts = posts.filter(post => {
        if (currentUserId && post.user_id === currentUserId) return true;
        if (post.boost_expires_at) {
            const isExpired = new Date(post.boost_expires_at).getTime() < Date.now();
            if (isExpired) return false;
        }
        if (post.boost_impressions_remaining !== undefined && post.boost_impressions_remaining !== null) {
            if (post.boost_impressions_remaining <= 0 && post.boost_expires_at) {
                return false;
            }
        }
        return true;
    });

    // Score posts
    const scored: ScoredPost[] = eligiblePosts.map(post => {
        let base = calculatePostScore(post, profile, currentUserId);
        // Social Graph bonus: following
        if (post.user_id && followingSet.has(post.user_id)) {
            base += 45;
        }
        return { post, score: base, isSurprise: false };
    });

    // Blend for author diversity and format mixing
    const blended = blendFeed(scored, profile, currentUserId);
    const rawPosts = blended.map(b => b.post);

    // Apply Variable Reward slot-machine scheduling
    return scheduleVariableRewards(rawPosts, (p: PostData) => {
        const likes = p.likes_count || 0;
        const imps = (p.imps_count || 0) * 10;
        const comments = ((p as any).comments_count || 0) * 5;
        const catScore = profile.categoryScores[p.category || 'General'] || 0;
        return likes + imps + comments + catScore;
    });
}

// ── Everyday Reshuffle Engine ──────────────────────────────

/**
 * Generates a deterministic integer seed from a date string (YYYY-MM-DD).
 */
export function getDailySeed(dateStr?: string): number {
    const key = dateStr || new Date().toISOString().slice(0, 10);
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) - hash) + key.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

/**
 * Deterministic daily reshuffle using a pseudo-random generator seeded by date.
 * Guarantees a completely fresh permutation every calendar day, while staying
 * consistent and stable throughout the same day.
 */
export function dailyReshuffle<T>(items: T[], dateStr?: string): T[] {
    if (!items || items.length <= 1) return items;
    const seed = getDailySeed(dateStr);
    let s = seed;
    const rng = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };

    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// ── Surface 2: Reels Model (rankReels) ──────────────────────

/**
 * Model 2: Dedicated Reels Model
 * Fast-dopamine short-form video optimization:
 * Prioritizes high completion probability, popular sound sync, category affinity,
 * daily permutation so everyday brings new reels, and stochastically paces viral hits.
 */
export function rankReels<T extends { id: any; category?: string; music_url?: string; music_title?: string; likes?: number; shares?: number; creator?: string }>(
    reels: T[],
    profile: UserInterestProfile,
    currentUserId?: string,
    dateStr?: string
): T[] {
    if (!reels || reels.length === 0) return [];

    // ⚡ Everyday Reshuffle: Apply daily seed shuffle so new video content is served each day
    const dailyReels = dailyReshuffle(reels, dateStr);

    // Calculate watch-retention score for each reel
    const scoredReels = dailyReels.map(reel => {
        let score = 5.0;
        const cat = reel.category || 'General';
        score += (profile.categoryScores[cat] || 0) * 0.8;

        // Hashtag / Topic affinity (Instagram-style compound multi-interest boost)
        const reelTags = extractHashtags((reel as any).caption);
        if (reelTags.length > 0 && profile.hashtagScores) {
            let matched = 0;
            let tagScoreTotal = 0;
            for (const t of reelTags) {
                const tagScore = profile.hashtagScores[t] || 0;
                if (tagScore > 0) {
                    tagScoreTotal += tagScore;
                    matched++;
                }
            }
            if (matched > 0) {
                const compoundMult = 1 + Math.min(1.5, (matched - 1) * 0.35);
                score += (tagScoreTotal * 0.9) * compoundMult;
            }
        }

        // Music / sound affinity
        if (reel.music_url && !reel.music_url.includes('soundhelix')) {
            score += 15;
        }
        if (reel.likes) score += reel.likes * 0.05;
        if (reel.shares) score += reel.shares * 0.1;

        // Boost active user's own reels
        if (currentUserId && (reel as any).creator_id === currentUserId) {
            score += 500;
        }

        return { reel, score };
    });

    // Author anti-clustering for reels (spread same creator)
    const authorGrouped: Record<string, typeof scoredReels> = {};
    for (const item of scoredReels) {
        const creator = item.reel.creator || 'unknown';
        if (!authorGrouped[creator]) authorGrouped[creator] = [];
        authorGrouped[creator].push(item);
    }

    const dispersed: T[] = [];
    const activeKeys = Object.keys(authorGrouped);

    while (activeKeys.length > 0) {
        for (let i = activeKeys.length - 1; i >= 0; i--) {
            const key = activeKeys[i];
            const nextItem = authorGrouped[key].shift();
            if (nextItem) {
                dispersed.push(nextItem.reel);
            }
            if (authorGrouped[key].length === 0) {
                activeKeys.splice(i, 1);
            }
        }
    }

    // Apply Variable Reward slot-machine scheduling
    return scheduleVariableRewards(dispersed, (r: T) => {
        const catScore = profile.categoryScores[r.category || 'General'] || 0;
        let tagScore = 0;
        const tags = extractHashtags(r.caption);
        if (tags.length > 0 && profile.hashtagScores) {
            for (const t of tags) tagScore += profile.hashtagScores[t] || 0;
        }
        return (r.likes || 0) + (r.shares || 0) * 2 + catScore + tagScore;
    });
}

// ── Surface 3: Explore Model (rankExploreGrid) ──────────────

/**
 * Model 3: Dedicated Explore Discovery Model
 * Focuses on category discovery, visual micro-niches, everyday content reshuffle,
 * and guaranteed balanced rotation of both reels and photo posts.
 */
export function rankExploreGrid(
    posts: PostData[],
    profile: UserInterestProfile,
    activeCategory?: string | null,
    dateStr?: string
): PostData[] {
    if (!posts || posts.length === 0) return [];

    let filtered = posts;
    if (activeCategory && activeCategory !== 'All') {
        filtered = posts.filter(p => p.category === activeCategory);
    }

    // ⚡ Everyday Reshuffle: Permute candidate pool by date seed so users get new content every day
    filtered = dailyReshuffle(filtered, dateStr);

    // Balance reels (video posts) and photo posts so everyday rotation guarantees fresh reels and posts
    const videoPosts: PostData[] = [];
    const photoPosts: PostData[] = [];
    for (const p of filtered) {
        if (isVideoPost(p)) {
            videoPosts.push(p);
        } else {
            photoPosts.push(p);
        }
    }

    // Interleave reels and posts with high presence (1 video reel every 2 photo posts)
    if (videoPosts.length > 0 && photoPosts.length > 0) {
        const interleavedMedia: PostData[] = [];
        let v = 0;
        let p = 0;
        while (v < videoPosts.length || p < photoPosts.length) {
            if (p < photoPosts.length) interleavedMedia.push(photoPosts[p++]);
            if (p < photoPosts.length) interleavedMedia.push(photoPosts[p++]);
            if (v < videoPosts.length) interleavedMedia.push(videoPosts[v++]);
        }
        filtered = interleavedMedia;
    }

    // Interleave categories if "All" is active
    if (!activeCategory || activeCategory === 'All') {
        const catMap = new Map<string, PostData[]>();
        for (const p of filtered) {
            const cat = p.category || 'General';
            if (!catMap.has(cat)) catMap.set(cat, []);
            catMap.get(cat)!.push(p);
        }

        const interleaved: PostData[] = [];
        const cats = Array.from(catMap.keys());
        // Sort categories so top interest categories appear with higher density
        cats.sort((a, b) => (profile.categoryScores[b] || 0) - (profile.categoryScores[a] || 0));

        let hasMore = true;
        let round = 0;
        while (hasMore) {
            hasMore = false;
            for (const cat of cats) {
                const list = catMap.get(cat)!;
                if (round < list.length) {
                    interleaved.push(list[round]);
                    hasMore = true;
                }
            }
            round++;
        }
        filtered = interleaved;
    }

    // Author anti-clustering: disperse posts from the same creator so no single creator monopolizes the grid
    const authorGrouped: Record<string, PostData[]> = {};
    for (const p of filtered) {
        const author = p.username || 'unknown';
        if (!authorGrouped[author]) authorGrouped[author] = [];
        authorGrouped[author].push(p);
    }
    const authorKeys = Object.keys(authorGrouped);
    const dispersedByAuthor: PostData[] = [];
    let authorRound = 0;
    let hasMoreAuthors = true;
    while (hasMoreAuthors) {
        hasMoreAuthors = false;
        for (const k of authorKeys) {
            if (authorRound < authorGrouped[k].length) {
                dispersedByAuthor.push(authorGrouped[k][authorRound]);
                hasMoreAuthors = true;
            }
        }
        authorRound++;
    }
    if (dispersedByAuthor.length > 0) {
        filtered = dispersedByAuthor;
    }

    // Apply Variable Reward slot-machine scheduling with recency boost for fresh real uploads
    return scheduleVariableRewards(filtered, (p: PostData) => {
        const likes = p.likes_count || 0;
        const imps = (p.imps_count || 0) * 8;
        const cat = profile.categoryScores[p.category || 'General'] || 0;
        
        let tagScore = 0;
        const tags = extractHashtags(p.caption);
        if (tags.length > 0 && profile.hashtagScores) {
            let matched = 0;
            let sum = 0;
            for (const t of tags) {
                const s = profile.hashtagScores[t] || 0;
                if (s > 0) {
                    sum += s;
                    matched++;
                }
            }
            if (matched > 0) {
                const compound = 1 + Math.min(1.5, (matched - 1) * 0.35);
                tagScore = (sum * 0.8) * compound;
            }
        }

        // Recency discovery bonus (within last 30 days) to guarantee real creators appear prominently
        let recencyBonus = 0;
        if (p.created_at) {
            const ageHours = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60);
            if (ageHours < 720) { // Within 30 days
                recencyBonus = Math.max(15, Math.floor(120 - (ageHours / 720) * 90));
            }
        }

        return likes + imps + cat + tagScore + recencyBonus;
    });
}

// ── Surface 4: Stories Model (rankStoryGroups) ──────────────

/**
 * Model 4: Dedicated Stories Model
 * Ranks story circles based on intimacy and closeness:
 * - Unwatched stories prioritized before already-watched stories
 * - Close social connections (frequent DM / chat history) prioritized
 * - High category alignment creators prioritized
 */
export function rankStoryGroups(
    groups: UserStoryGroup[],
    profile: UserInterestProfile,
    currentUserId?: string,
    dmCounts: Record<string, number> = {}
): UserStoryGroup[] {
    if (!groups || groups.length === 0) return [];

    const scored = groups.map(group => {
        let score = 10.0;

        // Prioritize logged-in user's own story at position 0
        if (currentUserId && group.userId === currentUserId) {
            return { group, score: 99999 };
        }

        // Intimacy bonus from direct messaging history
        const dms = dmCounts[group.userId] || 0;
        score += dms * 12;

        // Check if group contains unwatched stories
        const hasUnseen = group.stories.some(s => !s.viewed_by_user);
        if (hasUnseen) {
            score += 50;
        }

        // Category affinity of recent stories
        for (const s of group.stories) {
            const cat = (s as any).category || 'General';
            score += (profile.categoryScores[cat] || 0) * 0.4;
        }

        // Recency: stories uploaded in last 4 hours get priority
        const newestStory = group.stories.reduce((latest, s) => {
            const t = new Date(s.created_at).getTime();
            return t > latest ? t : latest;
        }, 0);
        if (newestStory > 0) {
            const hoursOld = (Date.now() - newestStory) / (1000 * 60 * 60);
            if (hoursOld < 4) score += 25;
            else if (hoursOld < 12) score += 10;
        }

        return { group, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.group);
}

// ── Infinite Stream Generator ───────────────────────────────

/**
 * Generates an endless stream of personalized items without any stopping points.
 * When base content is consumed, creates fresh permutations and re-ranks them.
 */
export function generateInfiniteStream<T>(
    basePool: T[],
    page: number,
    pageSize: number,
    ranker?: (items: T[]) => T[]
): T[] {
    if (!basePool || basePool.length === 0) return [];
    const poolSize = basePool.length;
    const startIndex = page * pageSize;

    if (startIndex + pageSize <= poolSize) {
        const slice = basePool.slice(startIndex, startIndex + pageSize);
        return ranker ? ranker(slice) : slice;
    }

    const cycle = Math.floor(startIndex / poolSize);
    const offsetInCycle = startIndex % poolSize;

    const permuted = [...basePool];
    for (let i = permuted.length - 1; i > 0; i--) {
        const hash = ((i + 1) * 31 + cycle * 17) % (i + 1);
        [permuted[i], permuted[hash]] = [permuted[hash], permuted[i]];
    }

    let items: T[] = [];
    if (offsetInCycle + pageSize <= poolSize) {
        items = permuted.slice(offsetInCycle, offsetInCycle + pageSize);
    } else {
        const head = permuted.slice(offsetInCycle);
        const nextCyclePermuted = [...basePool];
        const nextCycle = cycle + 1;
        for (let i = nextCyclePermuted.length - 1; i > 0; i--) {
            const hash = ((i + 1) * 31 + nextCycle * 17) % (i + 1);
            [nextCyclePermuted[i], nextCyclePermuted[hash]] = [nextCyclePermuted[hash], nextCyclePermuted[i]];
        }
        items = [...head, ...nextCyclePermuted.slice(0, pageSize - head.length)];
    }

    return ranker ? ranker(items) : items;
}

// ── Conversation Starters (VoiceCall) ───────────────────────

const CONVERSATION_PROMPTS: Record<string, string[]> = {
    Travel: ["What's your dream travel destination?", "Best trip you've ever been on?", "Mountains or beaches?"],
    Food: ["What's your favorite cuisine?", "Can you cook? What's your signature dish?", "Best restaurant you've been to?"],
    Music: ["What are you listening to lately?", "Ever been to a live concert?", "What genre gets you hyped?"],
    Sports: ["Do you play any sports?", "Which team do you support?", "What's the best game you've ever watched?"],
    Gaming: ["What games are you playing right now?", "PC or console?", "What's your all-time favorite game?"],
    Comedy: ["Who's your favorite comedian?", "Tell me a joke!", "What's the funniest thing that happened to you?"],
    Art: ["Do you create any art?", "What's your favorite art style?", "Been to any cool museums lately?"],
    Tech: ["What's the coolest tech you've seen recently?", "Are you a coder?", "AI — exciting or scary?"],
    Fashion: ["How would you describe your style?", "What's your favorite brand?", "Sneakers or boots?"],
    Nature: ["Favorite place in nature?", "Do you like hiking?", "Have you seen the Northern Lights?"],
    Dance: ["Do you dance?", "What's your favorite dance style?", "Best dance video you've seen?"],
    Animals: ["Do you have any pets?", "What's your favorite animal?", "Dogs or cats?"],
    Education: ["What are you studying or passionate about learning?", "Best book you've read recently?", "Any skills you want to learn?"],
    Lifestyle: ["Morning person or night owl?", "What does your perfect weekend look like?", "What's your daily routine?"],
    General: ["What's the most interesting thing about you?", "If you could have dinner with anyone, who would it be?", "What's on your bucket list?"],
};

export function getConversationStarters(sharedCategories: string[]): string[] {
    const starters: string[] = [];
    const cats = sharedCategories.length > 0 ? sharedCategories : ['General'];
    
    for (const cat of cats.slice(0, 2)) {
        const prompts = CONVERSATION_PROMPTS[cat] || CONVERSATION_PROMPTS['General'];
        const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
        starters.push(randomPrompt);
    }
    
    if (starters.length < 3) {
        const generalPrompts = CONVERSATION_PROMPTS['General'];
        starters.push(generalPrompts[Math.floor(Math.random() * generalPrompts.length)]);
    }
    
    return starters;
}

// ── 24-Hour Boost Addictive Loop Algorithm ───────────────────

export interface BoostInterestState {
    hashtags: Record<string, number>;
    creators: Record<string, number>;
    lastActive: number;
}

const BOOST_INTEREST_KEY = 'knock_boost_loop_interests_v1';

export function getBoostInterestState(): BoostInterestState {
    try {
        const stored = localStorage.getItem(BOOST_INTEREST_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed === 'object') {
                return {
                    hashtags: parsed.hashtags || {},
                    creators: parsed.creators || {},
                    lastActive: parsed.lastActive || Date.now(),
                };
            }
        }
    } catch (_) {}
    return { hashtags: {}, creators: {}, lastActive: Date.now() };
}

export function recordBoostSignal(signal: {
    storyId?: string;
    hashtags?: string[];
    creatorId?: string;
    type: 'view' | 'dwell' | 'loop' | 'hashtag_click' | 'convert_snap' | 'boost';
}): void {
    try {
        const state = getBoostInterestState();
        const weight = signal.type === 'convert_snap' ? 5.0
            : signal.type === 'boost' ? 4.0
            : signal.type === 'hashtag_click' ? 3.5
            : signal.type === 'loop' ? 3.0
            : signal.type === 'dwell' ? 2.0
            : 1.0;

        if (signal.hashtags && Array.isArray(signal.hashtags)) {
            signal.hashtags.forEach(tag => {
                const clean = tag.replace(/^#+/, '').toLowerCase().trim();
                if (clean) {
                    state.hashtags[clean] = (state.hashtags[clean] || 0) + weight;
                }
            });
        }

        if (signal.creatorId) {
            state.creators[signal.creatorId] = (state.creators[signal.creatorId] || 0) + weight;
        }

        state.lastActive = Date.now();
        localStorage.setItem(BOOST_INTEREST_KEY, JSON.stringify(state));
    } catch (_) {}
}

/**
 * Adaptive 24-Hour Boost Discovery Loop:
 * - Surfaces newly uploaded videos frequently (recency boost).
 * - Real-time chasing of what content the viewer wants to see (hashtag & creator affinities).
 * - Fulfills delivery guarantee duty for boosted content with remaining screen deficits.
 * - Anti-fatigue slot-machine interleaving with infinite circular replay loop.
 */
export function rankBoostLoopStories(
    stories: StoryData[],
    currentUserId?: string,
    userFriends: string[] = []
): StoryData[] {
    if (!stories || stories.length === 0) return [];

    const interestState = getBoostInterestState();
    const now = Date.now();

    // Screen Reach Quota & Active User Delivery Enforcement:
    // If a boosted story reached its target screens, or viewer is not in the active audience, exclude it!
    const eligibleStories = stories.filter(story => {
        return isStoryEligibleForViewerScreen(story, currentUserId, userFriends);
    });

    const scored = eligibleStories.map(story => {
        let score = 0;

        // 1. Freshness & Upload Frequency (Huge boost for videos uploaded in last 1-6 hours)
        const ageHours = (now - new Date(story.created_at).getTime()) / (1000 * 60 * 60);
        if (ageHours <= 1) score += 60;
        else if (ageHours <= 3) score += 45;
        else if (ageHours <= 6) score += 30;
        else if (ageHours <= 12) score += 15;

        // 2. Real-Time Affinity Chaser: Match hashtags the user engages with
        const tags = extractHashtags(story.caption);
        let tagAffinity = 0;
        tags.forEach(t => {
            if (interestState.hashtags[t]) {
                tagAffinity += interestState.hashtags[t];
            }
        });
        score += Math.min(60, tagAffinity * 12);

        // 3. Creator Affinity: Boost creators the user watches frequently
        if (story.user_id && interestState.creators[story.user_id]) {
            score += Math.min(45, interestState.creators[story.user_id] * 10);
        }

        // 4. Delivery Guarantee Duty: Boosted stories with screen deficits & extra points
        if (story.is_boosted) {
            const target = (story.boost_meta?.targetScreens || story.target_screens || 24);
            const delivered = (story.boost_meta?.screensDelivered || story.screens_delivered || 0);
            const deficit = target - delivered;
            const pointsSpent = story.boost_meta?.pointsSpent || story.points_spent || 0;

            if (deficit > 0) {
                // Base 5 points motivation boost
                score += Math.min(50, deficit * 2.5);

                // If extra points (beyond 5 points) were spent:
                // Leverage the algorithm to match active users with matching hashtags and creator taste
                if (pointsSpent > 5) {
                    const extraPoints = pointsSpent - 5;
                    score += Math.min(75, extraPoints * 3 + (tagAffinity > 0 ? tagAffinity * 15 : 10));
                }
            }
        }

        // 5. Friends connection boost
        if (story.user_id && userFriends.includes(story.user_id)) {
            score += 35;
        }

        // 6. User's own story at top
        if (currentUserId && story.user_id === currentUserId) {
            score += 1000;
        }

        // Subtle stochastic jitter for dopamine unpredictability
        const jitter = Math.sin(story.id.charCodeAt(0) + (now % 1000)) * 4;
        score += jitter;

        return { story, score };
    });

    // Sort by adaptive score DESC
    scored.sort((a, b) => b.score - a.score);

    // Slot-machine dopamine interleaving:
    // Avoid showing 5 items from the same user back-to-back
    const result: StoryData[] = [];
    const pool = [...scored];
    let lastUserId: string | null = null;

    while (pool.length > 0) {
        let pickedIdx = pool.findIndex(item => item.story.user_id !== lastUserId);
        if (pickedIdx === -1) pickedIdx = 0;
        const [picked] = pool.splice(pickedIdx, 1);
        result.push(picked.story);
        lastUserId = picked.story.user_id || null;
    }

    return result;
}

