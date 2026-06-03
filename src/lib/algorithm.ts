/**
 * algorithm.ts — Knock Knock Recommendation Engine
 * 
 * Implements a weighted scoring system inspired by Instagram's Two-Tower architecture:
 * - User interest profiling based on engagement history
 * - Post scoring based on weighted engagement signals
 * - Time-decay to favor fresh content
 * - "Surprise" content injection for variable reward scheduling
 */

// ── Weight Configuration ───────────────────────────────────
export const ENGAGEMENT_WEIGHTS: Record<string, number> = {
    watch_time: 5,   // Strongest intent — watched >75% of video
    replay: 4,       // Very high interest
    share: 3,        // Social validation
    voice_react: 3,  // High emotional engagement
    like: 2,         // Standard engagement
    save: 2,         // Intent to revisit
    view: 1,         // Minimal — just scrolled past
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
    /** Categories the user has NEVER interacted with */
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

// ── Post Scoring ───────────────────────────────────────────
export interface ScoredPost {
    post: any;
    score: number;
    isSurprise: boolean;
}

/**
 * Calculate a relevance score for a single post relative to the user's interest profile.
 */
export function calculatePostScore(
    post: { category?: string; created_at: string; likes_count?: number; shares_count?: number },
    userProfile: UserInterestProfile
): number {
    let score = 0;

    // 1. Category affinity: boost if post matches user's top interests
    const postCategory = post.category || 'General';
    const categoryScore = userProfile.categoryScores[postCategory] || 0;
    score += categoryScore * 0.5; // Scale down to avoid overwhelming

    // 2. Popularity signal: posts with more likes/shares get a small boost
    score += (post.likes_count || 0) * 0.01;
    score += (post.shares_count || 0) * 0.05;

    // 3. Time decay: newer content gets a significant boost
    const hoursOld = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
    const decay = decayFactor(hoursOld);
    score *= decay;

    return score;
}

/**
 * Time decay function. Content loses relevance over time.
 * - < 1 hour: 1.5x boost (brand new!)
 * - 1-6 hours: 1.2x boost
 * - 6-24 hours: 1.0x (neutral)
 * - 1-3 days: 0.7x
 * - 3-7 days: 0.4x
 * - > 7 days: 0.2x
 */
export function decayFactor(hoursOld: number): number {
    if (hoursOld < 1) return 1.5;
    if (hoursOld < 6) return 1.2;
    if (hoursOld < 24) return 1.0;
    if (hoursOld < 72) return 0.7;
    if (hoursOld < 168) return 0.4;
    return 0.2;
}

/**
 * Assemble a fully ranked, paginated feed with variable reward injection.
 * 
 * @param posts - Raw posts from the database
 * @param userProfile - The user's interest profile
 * @param page - Pagination page (0-indexed)
 * @param pageSize - Number of posts per page
 */
export function assembleFeed(
    posts: any[],
    userProfile: UserInterestProfile,
    page: number = 0,
    pageSize: number = 10
): ScoredPost[] {
    // Score all posts
    const scored: ScoredPost[] = posts.map(post => ({
        post,
        score: calculatePostScore(post, userProfile),
        isSurprise: false,
    }));

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    // Variable Reward: inject "surprise" content every ~5 posts
    // Pick from unexplored categories to create novelty
    const surprisePosts = scored.filter(
        s => userProfile.unexploredCategories.includes(s.post.category || 'General')
    );

    const finalFeed: ScoredPost[] = [];
    let surpriseIdx = 0;

    for (let i = 0; i < scored.length; i++) {
        // Skip surprise posts from the main ranking (we'll inject them)
        if (userProfile.unexploredCategories.includes(scored[i].post.category || 'General')) {
            continue;
        }
        finalFeed.push(scored[i]);

        // Every 5th post, inject a surprise if available
        if ((finalFeed.length % 5 === 0) && surpriseIdx < surprisePosts.length) {
            const surprise = { ...surprisePosts[surpriseIdx], isSurprise: true };
            finalFeed.push(surprise);
            surpriseIdx++;
        }
    }

    // Add remaining surprises to the end
    while (surpriseIdx < surprisePosts.length) {
        finalFeed.push({ ...surprisePosts[surpriseIdx], isSurprise: true });
        surpriseIdx++;
    }

    // Paginate
    const start = page * pageSize;
    return finalFeed.slice(start, start + pageSize);
}

/**
 * Shuffle feed slightly for pull-to-refresh (variable reward schedule).
 * We don't fully randomize — we shuffle within "tiers" of similar scores
 * to maintain some relevance while creating unpredictability.
 */
export function shuffleFeedForRefresh(feed: ScoredPost[]): ScoredPost[] {
    // Group into tiers of 5
    const shuffled: ScoredPost[] = [];
    for (let i = 0; i < feed.length; i += 5) {
        const tier = feed.slice(i, i + 5);
        // Fisher-Yates shuffle within the tier
        for (let j = tier.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [tier[j], tier[k]] = [tier[k], tier[j]];
        }
        shuffled.push(...tier);
    }
    return shuffled;
}
