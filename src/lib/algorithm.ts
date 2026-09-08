/**
 * algorithm.ts — Knock Knock Recommendation Engine
 * 
 * Implements a weighted scoring and Instagram-style feed blending engine:
 * - User interest profiling based on engagement history
 * - Post scoring based on weighted engagement signals + new creator exploration boost
 * - Author anti-clustering (consecutive creator penalty)
 * - Media format interleaving (videos and photos mixed: "all form")
 * - Category rotation & variable reward surprise content injection
 * - Active user new-upload priority
 */

import { isVideoPost } from './media';

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
    post: { id?: string; user_id?: string; category?: string; created_at: string; likes_count?: number; shares_count?: number; imps_count?: number; comments_count?: number },
    userProfile: UserInterestProfile,
    currentUserId?: string
): number {
    let score = 1.0; // Baseline score so all posts have initial relevance

    // 1. Category affinity: boost if post matches user's tracked top interests
    const postCategory = post.category || 'General';
    const categoryScore = userProfile.categoryScores[postCategory] || 0;
    score += categoryScore * 0.6;

    // 2. Engagement signals: likes, shares, comments
    score += (post.likes_count || 0) * 0.05;
    score += (post.shares_count || 0) * 0.1;
    score += ((post as any).comments_count || 0) * 0.1;

    // 3. Imp Boost: Massive visibility multiplier if users have imped the content
    if (post.imps_count && post.imps_count > 0) {
        score += (post.imps_count * 50);
    }

    // 4. Time decay & Exploration Boost for fresh uploads
    const hoursOld = Math.max(0, (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60));
    const decay = decayFactor(hoursOld);
    score *= decay;

    // 5. Active user's own recent upload priority (< 48 hours)
    if (currentUserId && post.user_id && post.user_id === currentUserId && hoursOld < 48) {
        score += 1000; // Pin/prioritize user's own newly posted content at the top of their feed
    }

    return score;
}

/**
 * Time decay function. Content loses relevance over time, but fresh content
 * gets an Instagram-style "Exploration Boost" for creator discovery.
 * - < 2 hours: 2.5x boost (new upload exploration phase)
 * - 2-12 hours: 1.8x boost
 * - 12-24 hours: 1.4x boost
 * - 1-3 days: 1.0x (neutral)
 * - 3-7 days: 0.6x
 * - > 7 days: 0.3x
 */
export function decayFactor(hoursOld: number): number {
    if (hoursOld < 2) return 2.5;
    if (hoursOld < 12) return 1.8;
    if (hoursOld < 24) return 1.4;
    if (hoursOld < 72) return 1.0;
    if (hoursOld < 168) return 0.6;
    return 0.3;
}

/**
 * Instagram-Style Feed Diversification & Blending
 * 
 * Takes scored candidate posts and applies:
 * 1. Author Anti-Clustering: Prevents bulk uploads from one creator (e.g. 37 Tara videos)
 *    from appearing consecutively. Spreads creator posts across the feed.
 * 2. Media Format Interleaving ("Mixed, all form"): Smoothly interleaves video reels and photo posts.
 * 3. Category Rotation: Rotates across different categories to prevent topic fatigue.
 * 4. Variable Reward Surprise Content: Injects fresh unexplored content periodically (~every 5 posts).
 * 5. Own Post Priority: Pins the logged-in user's own fresh uploads to the top.
 */
export function blendFeed(
    scoredPosts: ScoredPost[],
    userProfile: UserInterestProfile,
    currentUserId?: string
): ScoredPost[] {
    if (scoredPosts.length <= 1) return scoredPosts;

    // Separate user's own fresh posts to pin at the very top (positions 0-1)
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

    // Identify surprise candidates from unexplored categories
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

    // If mainPool is empty, move surprisePool items to mainPool
    if (mainPool.length === 0) {
        mainPool.push(...surprisePool);
        surprisePool.length = 0;
    }

    const blended: ScoredPost[] = [];
    // Start with user's own fresh posts at the top
    for (const own of ownFreshPosts) {
        blended.push(own);
    }

    // Working copy of candidate items
    const candidates = [...mainPool];
    let surpriseIdx = 0;

    const recentAuthors: string[] = blended.map(s => s.post.username || s.post.user_id || 'anon').slice(-2);
    const recentFormats: ('video' | 'image')[] = blended.map(s => isVideoPost(s.post) ? 'video' : 'image').slice(-2);
    const recentCategories: string[] = blended.map(s => s.post.category || 'General').slice(-2);

    while (candidates.length > 0) {
        const nextIndex = blended.length;

        // Check if we should inject a surprise post (every 5th item)
        if (nextIndex % 5 === 0 && surpriseIdx < surprisePool.length) {
            const surprise = { ...surprisePool[surpriseIdx], isSurprise: true };
            const author = surprise.post.username || surprise.post.user_id || 'anon';
            // Only inject if surprise author does not match immediate previous author
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

        // Determine ideal target format: if last 2 were videos, prefer image; if last 2 were images, prefer video
        const wantImage = recentFormats.length >= 2 && recentFormats.slice(-2).every(f => f === 'video');
        const wantVideo = recentFormats.length >= 2 && recentFormats.slice(-2).every(f => f === 'image');

        const lastAuthor = recentAuthors.length > 0 ? recentAuthors[recentAuthors.length - 1] : '';
        const lastCategory = recentCategories.length > 0 ? recentCategories[recentCategories.length - 1] : '';

        // Search for the best candidate that satisfies:
        // Priority 1: Different author from lastAuthor AND format match AND different category
        // Priority 2: Different author from lastAuthor AND format match
        // Priority 3: Different author from lastAuthor
        // Priority 4: Fallback (only 1 author remains)
        let bestCandidateIdx = -1;
        let bestCandidateScore = -Infinity;

        // Pass 1: Strict author diversity + format & category preference
        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            const author = c.post.username || c.post.user_id || 'anon';
            const isVid = isVideoPost(c.post);
            const format = isVid ? 'video' : 'image';
            const cat = c.post.category || 'General';

            if (lastAuthor && author === lastAuthor) continue; // No consecutive author!

            let candidateBonus = c.score;

            // Format interleaving bonus ("mixed, all form")
            if (wantImage && format === 'image') candidateBonus += 50;
            if (wantVideo && format === 'video') candidateBonus += 50;

            // Category rotation bonus
            if (lastCategory && cat !== lastCategory) candidateBonus += 20;

            // Second-previous author penalty to avoid A-B-A-B oscillation if more authors exist
            if (recentAuthors.length >= 2 && recentAuthors[recentAuthors.length - 2] === author) {
                candidateBonus -= 15;
            }

            if (candidateBonus > bestCandidateScore) {
                bestCandidateScore = candidateBonus;
                bestCandidateIdx = i;
            }
        }

        // Pass 2: If no candidate passed (e.g. all available have same format or category), relax to just author difference
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

        // Pass 3: Fallback (only 1 author remains, e.g. remaining videos after all other creators placed)
        if (bestCandidateIdx === -1) {
            bestCandidateIdx = 0;
        }

        // Pick the chosen candidate
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

    // Append any leftover surprises at the end
    while (surpriseIdx < surprisePool.length) {
        blended.push({ ...surprisePool[surpriseIdx], isSurprise: true });
        surpriseIdx++;
    }

    return blended;
}

/**
 * Assemble a fully ranked, blended feed with Instagram-style diversity:
 * - Author anti-clustering (consecutive creator penalty)
 * - Media format interleaving (videos and photos mixed: "all form")
 * - Category rotation & variable reward surprise content injection
 * - Active user new-upload priority
 * 
 * @param posts - Raw posts from the database
 * @param userProfile - The user's interest profile
 * @param page - Pagination page (0-indexed)
 * @param pageSize - Number of posts per page
 * @param currentUserId - Optional logged-in user ID to prioritize own uploads
 */
export function assembleFeed(
    posts: any[],
    userProfile: UserInterestProfile,
    page: number = 0,
    pageSize: number = 10,
    currentUserId?: string
): ScoredPost[] {
    // Score all posts
    const scored: ScoredPost[] = posts.map(post => ({
        post,
        score: calculatePostScore(post, userProfile, currentUserId),
        isSurprise: false,
    }));

    // Apply Instagram-style feed blending (author anti-clustering, format mixing, category rotation)
    const blended = blendFeed(scored, userProfile, currentUserId);

    // Paginate
    const start = page * pageSize;
    return blended.slice(start, start + pageSize);
}

/**
 * Shuffle feed slightly for pull-to-refresh (variable reward schedule).
 * We maintain author diversity and format mixing while creating fresh novelty.
 */
export function shuffleFeedForRefresh(
    posts: any[],
    userProfile?: UserInterestProfile,
    currentUserId?: string
): any[] {
    if (!posts || posts.length <= 1) return posts;

    // Extract raw post objects if ScoredPost[] was passed
    const rawList = posts.map(p => (p && p.post ? p.post : p));

    // Fisher-Yates shuffle within tiers of 5
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

// ── Conversation Starters (VoiceCall) ──────────────────────

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

/**
 * Get random conversation starters based on shared interest categories.
 * Returns 2-3 prompts relevant to the users' common interests.
 */
export function getConversationStarters(sharedCategories: string[]): string[] {
    const starters: string[] = [];
    const cats = sharedCategories.length > 0 ? sharedCategories : ['General'];
    
    for (const cat of cats.slice(0, 2)) {
        const prompts = CONVERSATION_PROMPTS[cat] || CONVERSATION_PROMPTS['General'];
        const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
        starters.push(randomPrompt);
    }
    
    // Always add one wildcard from General
    if (starters.length < 3) {
        const generalPrompts = CONVERSATION_PROMPTS['General'];
        starters.push(generalPrompts[Math.floor(Math.random() * generalPrompts.length)]);
    }
    
    return starters;
}

