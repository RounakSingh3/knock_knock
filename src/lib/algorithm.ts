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
import { trackEngagement, type PostData, type UserStoryGroup } from './database';

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

// ── Interest Profile ───────────────────────────────────────
export interface UserInterestProfile {
    /** Maps category -> total weighted score */
    categoryScores: Record<string, number>;
    /** Sorted array of top categories */
    topCategories: string[];
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

    return { categoryScores, topCategories, unexploredCategories };
}

// ── Implicit Signal Tracking ───────────────────────────────

export interface ImplicitSignal {
    userId?: string;
    targetId: string;
    category: string;
    type: 'dwell' | 'skip' | 'watch_pct' | 'replay' | 'unmute' | 'comments_open' | 'share_tap' | 'story_complete' | 'story_skip';
    value: number; // duration in ms, watch %, or replay count
    timestamp?: number;
}

const LOCAL_IMPLICIT_STORAGE_KEY = 'knock_implicit_signals_v1';

let _implicitBuffer: ImplicitSignal[] = [];
let _implicitScoresCache: Record<string, number> | null = null;

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

    return {
        categoryScores: baseScores,
        topCategories,
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
    post: { id?: string; user_id?: string; category?: string; created_at: string; likes_count?: number; shares_count?: number; imps_count?: number; comments_count?: number },
    userProfile: UserInterestProfile,
    currentUserId?: string
): number {
    let score = 1.0;

    // 1. Category affinity
    const postCategory = post.category || 'General';
    const categoryScore = userProfile.categoryScores[postCategory] || 0;
    score += categoryScore * 0.7;

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

    const candidates = [...mainPool];
    let surpriseIdx = 0;

    const recentAuthors: string[] = blended.map(s => s.post.username || s.post.user_id || 'anon').slice(-2);
    const recentFormats: ('video' | 'image')[] = blended.map(s => isVideoPost(s.post) ? 'video' : 'image').slice(-2);
    const recentCategories: string[] = blended.map(s => s.post.category || 'General').slice(-2);

    while (candidates.length > 0) {
        const nextIndex = blended.length;

        // Inject surprise post (every 5th item)
        if (nextIndex % 5 === 0 && surpriseIdx < surprisePool.length) {
            const surprise = { ...surprisePool[surpriseIdx], isSurprise: true };
            const author = surprise.post.username || surprise.post.user_id || 'anon';
            if (recentAuthors.length === 0 || recentAuthors[recentAuthors.length - 1] !== author) {
                blended.push(surprise);
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

        let bestCandidateIdx = -1;
        let bestCandidateScore = -Infinity;

        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
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
            for (let i = 0; i < candidates.length; i++) {
                const c = candidates[i];
                const author = c.post.username || c.post.user_id || 'anon';
                if (!lastAuthor || author !== lastAuthor) {
                    if (c.score > bestCandidateScore) {
                        bestCandidateScore = c.score;
                        bestCandidateIdx = i;
                    }
                }
            }
        }

        if (bestCandidateIdx === -1) {
            bestCandidateIdx = 0;
        }

        const [chosen] = candidates.splice(bestCandidateIdx, 1);
        blended.push(chosen);

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

    // Score posts
    const scored: ScoredPost[] = posts.map(post => {
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

// ── Surface 2: Reels Model (rankReels) ──────────────────────

/**
 * Model 2: Dedicated Reels Model
 * Fast-dopamine short-form video optimization:
 * Prioritizes high completion probability, popular sound sync, category affinity,
 * and stochastically paces viral hits with discovery reels.
 */
export function rankReels<T extends { id: any; category?: string; music_url?: string; music_title?: string; likes?: number; shares?: number; creator?: string }>(
    reels: T[],
    profile: UserInterestProfile,
    currentUserId?: string
): T[] {
    if (!reels || reels.length === 0) return [];

    // Calculate watch-retention score for each reel
    const scoredReels = reels.map(reel => {
        let score = 5.0;
        const cat = reel.category || 'General';
        score += (profile.categoryScores[cat] || 0) * 0.8;

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
        return (r.likes || 0) + (r.shares || 0) * 2 + catScore;
    });
}

// ── Surface 3: Explore Model (rankExploreGrid) ──────────────

/**
 * Model 3: Dedicated Explore Discovery Model
 * Focuses on category discovery, visual micro-niches, and injecting
 * serendipitous content based on implicit linger signals.
 */
export function rankExploreGrid(
    posts: PostData[],
    profile: UserInterestProfile,
    activeCategory?: string | null
): PostData[] {
    if (!posts || posts.length === 0) return [];

    let filtered = posts;
    if (activeCategory && activeCategory !== 'All') {
        filtered = posts.filter(p => p.category === activeCategory);
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

    // Apply Variable Reward slot-machine scheduling
    return scheduleVariableRewards(filtered, (p: PostData) => {
        const likes = p.likes_count || 0;
        const imps = (p.imps_count || 0) * 8;
        const cat = profile.categoryScores[p.category || 'General'] || 0;
        return likes + imps + cat;
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
