import React, { useState, useEffect, useContext, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { Search, Loader2, Users, Image, BookOpen, UserPlus, UserCheck, Play, Flame, TrendingUp, Eye, Music, X, Hash } from 'lucide-react';
import { searchUsers, searchPostsByCaption, searchStoriesByHashtag, fetchBoostedStories, checkIfFollowing, toggleFollow, fetchDiscoverPosts, fetchUserEngagements, fetchTrendingPosts, trackEngagement, normalizePost, type UserStoryGroup, type StoryData, type ProfileData, type PostData, type MessageData } from '../lib/database';
import { buildInterestProfile, assembleFeed, shuffleFeedForRefresh, rankExploreGrid, getHybridInterestProfile, recordImplicitSignal, generateInfiniteStream, dailyReshuffle, type ScoredPost } from '../lib/algorithm';
import PostMedia from '../components/PostMedia';
import ExploreFeedViewer from '../components/ExploreFeedViewer';
import { AppContext } from '../context/AppContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PullToRefresh from '../components/PullToRefresh';
import { isVideoPost, isVideoUrl } from '../lib/media';
import { GridSkeleton, TrendingSkeleton } from '../components/SkeletonLoader';

import DailyNewsFeed from '../components/DailyNewsFeed';
import type { NewsItem } from '../lib/newsService';

// ⚡ Lazy load heavy modals for instant Explore page rendering
const StoryViewer = lazy(() => import('../components/StoryViewer'));
const CommentsSheet = lazy(() => import('../components/CommentsSheet'));
const ShareModal = lazy(() => import('../components/ShareModal'));
const ChatPanel = lazy(() => import('../components/ChatPanel'));

const isNewsPost = (p: PostData): boolean => {
    return (
        p.username === 'google_news_daily' ||
        p.username === 'google_news' ||
        Boolean(p.caption && p.caption.includes('[NEWS:'))
    );
};

function postToNewsItem(post: PostData): NewsItem {
    const isNewsFormat = Boolean(post.caption && post.caption.includes('[NEWS:'));
    let title = 'Trending Story';
    let source = post.username ? `@${post.username}` : 'Trending News';
    let summary = post.caption || 'Trending story on Knock Knock.';

    if (isNewsFormat) {
        const parts = (post.caption || '').split('\n\n');
        title = parts[0]?.replace(/🔥\s*\[NEWS:[^\]]*\]\s*/, '').trim() || post.caption || 'Trending News';
        source = parts[1]?.replace(/📰\s*Source:\s*/, '').trim() || 'Trending News';
        summary = parts.slice(2).join('\n\n').trim() || parts[0] || '';
    } else if (post.caption) {
        const lines = post.caption.split('\n').filter(Boolean);
        if (lines.length > 1) {
            title = lines[0];
            summary = lines.slice(1).join('\n');
        } else if (post.caption.length > 65) {
            title = post.caption.slice(0, 62) + '...';
            summary = post.caption;
        } else {
            title = post.caption;
            summary = post.caption;
        }
    }

    return {
        id: post.id,
        title: title || 'Trending Story',
        summary: summary || title || 'Check out this trending story on Knock Knock!',
        url: post.attached_link || '#',
        source: source || 'Trending',
        publishedAt: post.created_at || new Date().toISOString(),
        category: (post.category as any) || 'Sports',
        imageUrl: post.image_url || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600',
        likesCount: post.likes_count || 0
    };
}

function groupByUser(stories: StoryData[]): UserStoryGroup[] {
    const groups: Record<string, UserStoryGroup> = {};
    stories.forEach(s => {
        const uid = s.user_id || 'unknown';
        if (!groups[uid]) {
            groups[uid] = { userId: uid, username: s.username || 'user', avatarUrl: `https://i.pravatar.cc/150?u=${s.username || uid}`, stories: [] };
        }
        groups[uid].stories.push(s);
    });
    return Object.values(groups);
}

interface ExploreGridCardProps {
    post: PostData;
    index: number;
    isSurprise?: boolean;
    onPostClick: (post: PostData, index: number) => void;
    trackViewRef?: (node: HTMLDivElement | null) => void;
}

const ExploreGridCard = React.memo(function ExploreGridCard({
    post,
    index,
    isSurprise = false,
    onPostClick,
    trackViewRef,
}: ExploreGridCardProps) {
    const isVideo = isVideoPost(post);
    const hasMusic = Boolean(post.music_url || post.music_title);
    const hasLikes = (post.likes_count || 0) >= 5 && !isSurprise;
    const isBig = (index % 12 === 0) || (index % 12 === 8);
    const creatorUsername = post.username || (post as any).user?.username || 'user';
    const creatorAvatar = post.avatar_url || (post as any).user?.avatar_url || `https://i.pravatar.cc/150?u=${creatorUsername}`;

    const handleClick = useCallback(() => {
        onPostClick(post, index);
    }, [onPostClick, post, index]);

    return (
        <div
            ref={trackViewRef}
            data-postid={post.id}
            className={`explore-grid-item ${isBig ? 'explore-grid-item-big' : ''}`}
            style={{
                aspectRatio: '1',
                gridColumn: isBig ? 'span 2' : 'span 1',
                gridRow: isBig ? 'span 2' : 'span 1',
                position: 'relative',
                cursor: 'pointer',
                overflow: 'hidden',
                borderRadius: '4px',
                background: '#18181b',
            }}
            onClick={handleClick}
        >
            <PostMedia
                post={post}
                className=""
                muted
                loop
                playsInline
                autoPlay={false}
                thumbnail={true}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {isVideo && (
                <div style={{
                    position: 'absolute',
                    top: isBig ? '10px' : '6px',
                    right: isBig ? '10px' : '6px',
                    zIndex: 4,
                    pointerEvents: 'none',
                    background: isBig ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.55)',
                    borderRadius: isBig ? '16px' : '6px',
                    padding: isBig ? '4px 8px' : '2px 4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                }}>
                    <Play size={isBig ? 14 : 12} color="#fff" fill="#fff" />
                    {isBig && (
                        <span style={{ fontSize: '10px', fontWeight: '800', color: '#fff', letterSpacing: '0.5px' }}>
                            REEL
                        </span>
                    )}
                </div>
            )}
            {hasMusic && (
                <div style={{
                    position: 'absolute',
                    top: isBig ? '10px' : '6px',
                    left: isBig ? '10px' : '6px',
                    zIndex: 5,
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: 'rgba(0,0,0,0.72)',
                    padding: isBig ? '3px 8px' : '2px 6px',
                    borderRadius: '10px', color: '#fff',
                    fontSize: isBig ? '11px' : '9px', fontWeight: '600', pointerEvents: 'none',
                }}>
                    <Music size={isBig ? 11 : 9} color="#f5a524" />
                    <span>{post.music_title || '♪'}</span>
                </div>
            )}
            {/* Bottom details: for big cards show creator avatar & username & likes; for standard cards show creator avatar, username & likes */}
            {isBig ? (
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 4,
                    background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 100%)',
                    padding: '28px 10px 8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pointerEvents: 'none',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <img
                            src={creatorAvatar}
                            alt=""
                            onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = `https://i.pravatar.cc/150?u=${creatorUsername}`;
                            }}
                            style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(255,255,255,0.4)', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            @{creatorUsername}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {(post.likes_count || 0) > 0 && (
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#f5a524', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Flame size={12} fill="#f5a524" /> {post.likes_count}
                            </span>
                        )}
                    </div>
                </div>
            ) : (
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 4,
                    background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.82) 100%)',
                    padding: '16px 6px 5px 6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pointerEvents: 'none',
                    gap: '4px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                        <img
                            src={creatorAvatar}
                            alt=""
                            onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = `https://i.pravatar.cc/150?u=${creatorUsername}`;
                            }}
                            style={{ width: '15px', height: '15px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: '10px', fontWeight: '600', color: 'rgba(255,255,255,0.92)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            @{creatorUsername}
                        </span>
                    </div>
                    {hasLikes && (
                        <div style={{
                            fontSize: '9px', color: '#f5a524', fontWeight: '700',
                            display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0
                        }}>
                            <Flame size={9} fill="#f5a524" color="#f5a524" /> {post.likes_count}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

function interleaveCategories(posts: PostData[]): PostData[] {
    const buckets: Record<string, PostData[]> = {};
    posts.forEach(p => {
        const cat = p.category || 'General';
        if (!buckets[cat]) buckets[cat] = [];
        buckets[cat].push(p);
    });

    const categoryKeys = Object.keys(buckets);
    const result: PostData[] = [];
    let hasMoreInBuckets = true;
    let idx = 0;

    while (hasMoreInBuckets) {
        hasMoreInBuckets = false;
        for (const cat of categoryKeys) {
            if (idx < buckets[cat].length) {
                result.push(buckets[cat][idx]);
                hasMoreInBuckets = true;
            }
        }
        idx++;
    }

    return result.length > 0 ? result : posts;
}

const Explore = () => {
    const { user, blockedIds } = useContext(AppContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    const initialQuery = searchParams.get('q') || '';
    const initialTab = (searchParams.get('tab') as 'people' | 'posts' | 'stories') || (initialQuery.startsWith('@') ? 'people' : 'posts');

    const [searchTerm, setSearchTerm] = useState(initialQuery);
    const [activeTab, setActiveTab] = useState<'people' | 'posts' | 'stories'>(initialTab);

    // Sync if URL search params change (e.g. user clicks another #hashtag in feed/reels)
    useEffect(() => {
        const q = searchParams.get('q');
        const tab = searchParams.get('tab') as 'people' | 'posts' | 'stories' | null;
        if (q !== null) {
            setSearchTerm(q);
            if (tab) {
                setActiveTab(tab);
            } else if (q.trim().startsWith('@')) {
                setActiveTab('people');
            } else {
                setActiveTab('posts');
            }
        }
    }, [searchParams]);

    const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
    
    // ⚡ Everyday Reshuffle Date Key (YYYY-MM-DD)
    const getTodayKey = (): string => new Date().toISOString().slice(0, 10);

    // Discover (Default) State with instant cache rehydration and everyday cache invalidation
    const [discoverPosts, setDiscoverPosts] = useState<PostData[]>(() => {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const cachedDate = localStorage.getItem('knock_explore_cache_date');
            if (cachedDate === today) {
                const cached = localStorage.getItem('knock_explore_posts_cache_v7');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed.map(normalizePost).filter((p): p is PostData => Boolean(p));
                    }
                }
            } else {
                // New day detected! Clear stale caches to trigger fresh everyday reshuffle
                localStorage.removeItem('knock_explore_posts_cache_v7');
                localStorage.removeItem('knock_explore_trending_cache_v7');
                localStorage.setItem('knock_explore_cache_date', today);
            }
        } catch (e) {}
        return [];
    });
    const [isDiscoverLoading, setIsDiscoverLoading] = useState<boolean>(() => {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const cachedDate = localStorage.getItem('knock_explore_cache_date');
            if (cachedDate !== today) return true;
            const cached = localStorage.getItem('knock_explore_posts_cache_v7');
            return !cached || JSON.parse(cached).length === 0;
        } catch (e) {
            return true;
        }
    });
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Infinite scroll state
    const [feedPage, setFeedPage] = useState(0);
    const feedPageRef = useRef(0);
    useEffect(() => { feedPageRef.current = feedPage; }, [feedPage]);
    const [allScoredPosts, setAllScoredPosts] = useState<ScoredPost[]>([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const sentinelRef = useRef<HTMLDivElement>(null);

    // Trending posts (FOMO) with instant cache rehydration and everyday reshuffle
    const [trendingPosts, setTrendingPosts] = useState<PostData[]>(() => {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const cachedDate = localStorage.getItem('knock_explore_cache_date');
            if (cachedDate === today) {
                const cached = localStorage.getItem('knock_explore_trending_cache_v7');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed.map(normalizePost).filter((p): p is PostData => Boolean(p));
                    }
                }
            }
        } catch (e) {}
        return [];
    });
    const [isTrendingLoading, setIsTrendingLoading] = useState<boolean>(() => {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const cachedDate = localStorage.getItem('knock_explore_cache_date');
            if (cachedDate !== today) return true;
            const cached = localStorage.getItem('knock_explore_trending_cache_v7');
            return !cached || JSON.parse(cached).length === 0;
        } catch (e) {
            return true;
        }
    });

    const normalizedTrendingPosts = useMemo(
        () => trendingPosts.map(normalizePost).filter((p): p is PostData => Boolean(p)),
        [trendingPosts]
    );

    const normalizedDiscoverPosts = useMemo(
        () => discoverPosts.map(normalizePost).filter((p): p is PostData => Boolean(p)),
        [discoverPosts]
    );

    // Viewport tracking for engagement
    const observedPostsRef = useRef<Set<string>>(new Set());

    // Search Results State
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [peopleResults, setPeopleResults] = useState<ProfileData[]>([]);
    const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
    const [postResults, setPostResults] = useState<PostData[]>([]);
    const [storyResults, setStoryResults] = useState<UserStoryGroup[]>([]);
    const [activeStoryGroupIndex, setActiveStoryGroupIndex] = useState<number | null>(null);

    // Post Modal State
    const [activeFeedState, setActiveFeedState] = useState<{ posts: PostData[], index: number } | null>(null);
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [postToShare, setPostToShare] = useState<PostData | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatUserId, setChatUserId] = useState<string | null>(null);
    const [chatRefreshKey, setChatRefreshKey] = useState(0);
    const [pendingShare, setPendingShare] = useState<{ receiverId: string; message: MessageData } | null>(null);

    const [isRefreshing, setIsRefreshing] = useState(false);

    // Raw posts cache for infinite scroll pagination
    const rawPostsCacheRef = useRef<any[]>([]);
    const userProfileRef = useRef<any>(null);

    const PAGE_SIZE = 18;
    const discoverPostsRef = useRef(discoverPosts);
    useEffect(() => {
        discoverPostsRef.current = discoverPosts;
    }, [discoverPosts]);

    // Load Trending Posts (FOMO banner) with Everyday Reshuffle
    useEffect(() => {
        if (trendingPosts.length === 0) setIsTrendingLoading(true);
        fetchTrendingPosts(20).then(posts => {
            const filtered = posts.filter(p => (p.likes_count || 0) > 0 && (!p.user_id || !blockedIds.includes(p.user_id)));
            // ⚡ Everyday reshuffle on trending reels/posts so opening the page each day shows fresh highlights
            const reshuffledTrending = dailyReshuffle(filtered, getTodayKey()).slice(0, 6);
            setTrendingPosts(reshuffledTrending);
            try {
                localStorage.setItem('knock_explore_trending_cache_v7', JSON.stringify(reshuffledTrending));
            } catch (e) {}
            setIsTrendingLoading(false);
        });
    }, [blockedIds]);

    // Load Discover Feed with Dedicated Explore Discovery Model & Everyday Reshuffle
    const loadDiscoverFeed = async (dateKeyOverride?: string) => {
        if (discoverPosts.length === 0) setIsDiscoverLoading(true);
        setFeedPage(0);
        feedPageRef.current = 0;
        setHasMore(true);
        observedPostsRef.current.clear();
        try {
            let rawPosts = await fetchDiscoverPosts(selectedCategory, 200, 0);
            rawPosts = rawPosts.filter(p => !p.user_id || !blockedIds.includes(p.user_id));
            
            // Strictly deduplicate by image_url and id
            const seenUrls = new Set<string>();
            const seenIds = new Set<string>();
            let uniqueRaw = rawPosts.filter(p => {
                if (!p.image_url || seenUrls.has(p.image_url) || seenIds.has(p.id)) return false;
                seenUrls.add(p.image_url);
                seenIds.add(p.id);
                return true;
            });

            rawPostsCacheRef.current = uniqueRaw;

            const engagements = user ? await fetchUserEngagements(user.id) : [];
            const hybridProfile = getHybridInterestProfile(engagements);
            userProfileRef.current = hybridProfile;

            // Apply Model 3: Dedicated Explore Discovery Model with Everyday Reshuffle
            const dateKey = dateKeyOverride || getTodayKey();
            const rankedExplore = rankExploreGrid(uniqueRaw, hybridProfile, selectedCategory, dateKey);
            const fresh = rankedExplore.slice(0, PAGE_SIZE);
            setDiscoverPosts(fresh);
            try {
                localStorage.setItem('knock_explore_posts_cache_v7', JSON.stringify(fresh));
                localStorage.setItem('knock_explore_cache_date', getTodayKey());
            } catch (e) {}
            setHasMore(true);
        } catch (e) {
            console.error('Error loading discover feed:', e);
        } finally {
            setIsDiscoverLoading(false);
        }
    };

    useEffect(() => {
        if (searchTerm.trim().length > 0) return;
        loadDiscoverFeed();
    }, [selectedCategory, searchTerm, user?.id]);

    // Infinite Scroll — Load More (Guarantees NO duplicate photos and continuous infinite stream)
    // ⚡ Uses feedPageRef to keep callback stable and prevent sentinel observer churn
    const loadMore = useCallback(async () => {
        if (isLoadingMore) return;
        setIsLoadingMore(true);
        const nextPage = feedPageRef.current + 1;
        
        try {
            const currentPosts = discoverPostsRef.current;
            const seenIds = new Set(currentPosts.map(p => p.id));
            const seenUrls = new Set(currentPosts.map(p => p.image_url));

            const activeProfile = userProfileRef.current || getHybridInterestProfile([]);
            const currentDay = getTodayKey();
            
            let nextBatch: PostData[] = [];

            if (rawPostsCacheRef.current.length > 0) {
                const streamBatch = generateInfiniteStream(
                    rawPostsCacheRef.current,
                    nextPage,
                    PAGE_SIZE,
                    (batch) => rankExploreGrid(batch, activeProfile, selectedCategory, currentDay)
                );
                nextBatch = streamBatch.filter(p => !seenIds.has(p.id) && !seenUrls.has(p.image_url));
            }

            if (nextBatch.length < 6) {
                // Fetch next page offset from DB
                const nextBatchDb = await fetchDiscoverPosts(selectedCategory, 50, rawPostsCacheRef.current.length);
                const freshDbPosts = nextBatchDb.filter(p => {
                    if (!p.image_url || seenIds.has(p.id) || seenUrls.has(p.image_url) || (p.user_id && blockedIds.includes(p.user_id))) return false;
                    seenIds.add(p.id);
                    seenUrls.add(p.image_url);
                    return true;
                });
                
                if (freshDbPosts.length > 0) {
                    rawPostsCacheRef.current = [...rawPostsCacheRef.current, ...freshDbPosts];
                    const rankedDb = rankExploreGrid(freshDbPosts, activeProfile, selectedCategory, currentDay);
                    nextBatch = [...nextBatch, ...rankedDb.slice(0, PAGE_SIZE - nextBatch.length)];
                }
            }

            // If still empty, cycle infinite stream
            if (nextBatch.length === 0 && rawPostsCacheRef.current.length > 0) {
                nextBatch = generateInfiniteStream(
                    rawPostsCacheRef.current,
                    nextPage,
                    PAGE_SIZE,
                    (batch) => rankExploreGrid(batch, activeProfile, selectedCategory, currentDay)
                );
            }
            
            if (nextBatch.length > 0) {
                setDiscoverPosts(prev => [...(prev || []), ...nextBatch]);
                setFeedPage(nextPage);
                feedPageRef.current = nextPage;
            }
            setHasMore(true);
        } catch (e) {
            console.error('Error loading more posts:', e);
        } finally {
            setIsLoadingMore(false);
        }
    }, [isLoadingMore, selectedCategory, blockedIds]);

    // IntersectionObserver for infinite scroll sentinel
    useEffect(() => {
        if (!sentinelRef.current) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isDiscoverLoading && !isLoadingMore && hasMore && searchTerm.trim().length === 0) {
                    loadMore();
                }
            },
            { rootMargin: '600px' }
        );
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [loadMore, isDiscoverLoading, isLoadingMore, hasMore, searchTerm]);

    // High-performance shared IntersectionObserver for viewport engagement and dwell tracking
    const viewObserverRef = useRef<IntersectionObserver | null>(null);

    // Pillar 2: IntersectionObserver for view delivery and tile dwell telemetry
    // ⚡ Persistent observer — does NOT rebuild every time discoverPosts appends
    useEffect(() => {
        if (!user) return;

        const tileTimers = new Map<string, number>();

        viewObserverRef.current = new IntersectionObserver(
            (entries) => {
                const now = Date.now();
                entries.forEach((entry) => {
                    const el = entry.target as HTMLElement;
                    const postId = el.dataset.postid;
                    if (!postId) return;

                    if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                        if (!tileTimers.has(postId)) {
                            tileTimers.set(postId, now);
                        }
                        if (!observedPostsRef.current.has(postId)) {
                            observedPostsRef.current.add(postId);
                            trackEngagement(user.id, postId, 'view', 1, selectedCategory || 'General').catch(() => {});
                        }
                    } else {
                        const startTime = tileTimers.get(postId);
                        if (startTime) {
                            const dwellMs = now - startTime;
                            tileTimers.delete(postId);
                            if (dwellMs >= 2000) {
                                recordImplicitSignal({
                                    userId: user.id,
                                    targetId: postId,
                                    type: 'dwell',
                                    category: selectedCategory || 'General',
                                    value: dwellMs,
                                    timestamp: now
                                });
                            } else if (dwellMs > 50 && dwellMs < 800) {
                                recordImplicitSignal({
                                    userId: user.id,
                                    targetId: postId,
                                    type: 'skip',
                                    category: selectedCategory || 'General',
                                    value: dwellMs,
                                    timestamp: now
                                });
                            }
                        }
                    }
                });
            },
            { threshold: [0.1, 0.5] }
        );

        return () => {
            viewObserverRef.current?.disconnect();
            viewObserverRef.current = null;
            tileTimers.clear();
        };
    }, [user?.id, selectedCategory]);

    const trackViewRef = useCallback((node: HTMLDivElement | null) => {
        if (!node || !user || !viewObserverRef.current) return;
        const postId = node.dataset.postid;
        if (!postId || observedPostsRef.current.has(postId)) return;
        viewObserverRef.current.observe(node);
    }, [user?.id]);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        // ⚡ On-demand fresh shuffle on pull-to-refresh
        const refreshSeed = `${getTodayKey()}_pull_${Date.now()}`;
        await loadDiscoverFeed(refreshSeed);
        // Reload trending with fresh shuffle too
        fetchTrendingPosts(20).then(posts => {
            const filtered = posts.filter(p => (p.likes_count || 0) > 0 && (!p.user_id || !blockedIds.includes(p.user_id)));
            setTrendingPosts(dailyReshuffle(filtered, refreshSeed).slice(0, 6));
        });
        setIsRefreshing(false);
    }, [selectedCategory, blockedIds]);

    const handleSearchChange = (val: string) => {
        setSearchTerm(val);
        const trimmed = val.trim();
        if (trimmed.startsWith('#')) {
            setActiveTab('posts');
        } else if (trimmed.startsWith('@')) {
            setActiveTab('people');
        }
    };

    // Handle Search Queries
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.trim().length < 2) {
                setPeopleResults([]);
                setPostResults([]);
                if (activeTab === 'stories') {
                    setLoadingSearch(true);
                    fetchBoostedStories().then(data => {
                        setStoryResults(groupByUser(data.filter(s => !blockedIds.includes(s.user_id))));
                        setLoadingSearch(false);
                    });
                }
                return;
            }
            performSearch();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, activeTab, blockedIds]);

    const performSearch = async () => {
        setLoadingSearch(true);
        const query = searchTerm.trim();
        if (!query) {
            setLoadingSearch(false);
            return;
        }

        try {
            const cleanQueryForUsers = query.replace(/^[#@]+/, '').trim();
            // Parallel search across posts, people, and stories (if active)
            const [postsRes, usersRes, storiesRes] = await Promise.all([
                searchPostsByCaption(query),
                cleanQueryForUsers.length >= 2 ? searchUsers(cleanQueryForUsers) : Promise.resolve([]),
                activeTab === 'stories' ? searchStoriesByHashtag(query.replace(/^[#@]+/, '')) : Promise.resolve([])
            ]);

            const validPosts = postsRes.filter(p => !p.user_id || !blockedIds.includes(p.user_id));
            setPostResults(validPosts);

            const filteredUsers = usersRes.filter(p => !blockedIds.includes(p.id));
            setPeopleResults(filteredUsers);

            if (activeTab === 'stories') {
                setStoryResults(storiesRes.filter(g => !blockedIds.includes(g.userId)));
            }

            if (user && filteredUsers.length > 0) {
                const map: Record<string, boolean> = {};
                await Promise.all(filteredUsers.map(async (p) => {
                    if (p.id !== user.id) {
                        map[p.id] = await checkIfFollowing(user.id, p.id);
                    }
                }));
                setFollowingMap(map);
            }
        } catch (e) {
            console.error('Error performing search:', e);
        } finally {
            setLoadingSearch(false);
        }
    };

    const handleToggleFollow = async (profileId: string) => {
        if (!user) return;
        const isFollowing = followingMap[profileId] || false;
        await toggleFollow(user.id, profileId, isFollowing);
        setFollowingMap(prev => ({ ...prev, [profileId]: !isFollowing }));
    };

    const tabStyle = (tab: string) => ({
        flex: 1, padding: '10px', background: 'none', border: 'none',
        color: activeTab === tab ? '#f5a524' : 'var(--text-inactive)',
        borderBottom: activeTab === tab ? '2px solid #f5a524' : '2px solid transparent',
        fontWeight: activeTab === tab ? 'bold' as const : 'normal' as const,
        fontSize: '14px', cursor: 'pointer' as const,
        display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: '6px',
    });

    const isSearching = searchTerm.trim().length > 0;

    // Memoized surprise injection lookup O(1)
    const surprisePostIdSet = useMemo(() => {
        const set = new Set<string>();
        for (const s of allScoredPosts) {
            if (s.isSurprise) {
                set.add(s.post.id);
            }
        }
        return set;
    }, [allScoredPosts]);

    const handleDiscoverPostClick = useCallback((post: PostData, index: number) => {
        if (isNewsPost(post)) {
            setSelectedNews(postToNewsItem(post));
        } else {
            setActiveFeedState({ posts: normalizedDiscoverPosts, index });
        }
    }, [normalizedDiscoverPosts]);

    const normalizedSearchPosts = useMemo(
        () => postResults.map(normalizePost).filter((p): p is PostData => Boolean(p)),
        [postResults]
    );

    const handleSearchPostClick = useCallback((post: PostData, index: number) => {
        if (isNewsPost(post)) {
            setSelectedNews(postToNewsItem(post));
        } else {
            setActiveFeedState({ posts: normalizedSearchPosts, index });
        }
    }, [normalizedSearchPosts]);

    return (
        <div className="explore-page pb-20" style={{ background: 'var(--bg-color)', minHeight: '100vh' }}>
            {/* Search Bar */}
            <div style={{ padding: '16px', paddingBottom: '8px' }}>
                <div style={{
                    background: 'var(--surface-color)', padding: '10px 16px', borderRadius: '14px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                    <Search size={20} color="#8e8e93" />
                    <input
                        type="text"
                        placeholder="Search posts, hashtags (#), or people (@)..."
                        value={searchTerm}
                        onChange={e => handleSearchChange(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-active)', width: '100%', outline: 'none', fontSize: '15px' }}
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                setPostResults([]);
                                setPeopleResults([]);
                                setStoryResults([]);
                            }}
                            style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', padding: '2px', display: 'flex' }}
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Search Tabs (Only shown when searching) */}
            {isSearching && (
                <div style={{ display: 'flex', borderBottom: '1px solid #2c2c2e', marginTop: '8px' }}>
                    <button onClick={() => setActiveTab('posts')} style={tabStyle('posts')}>
                        <Image size={16} /> Posts {postResults.length > 0 && `(${postResults.length})`}
                    </button>
                    <button onClick={() => setActiveTab('people')} style={tabStyle('people')}>
                        <Users size={16} /> People {peopleResults.length > 0 && `(${peopleResults.length})`}
                    </button>
                    <button onClick={() => setActiveTab('stories')} style={tabStyle('stories')}>
                        <BookOpen size={16} /> Stories {storyResults.length > 0 && `(${storyResults.length})`}
                    </button>
                </div>
            )}

            {/* Content Area */}
            <PullToRefresh onRefresh={handleRefresh}>
                <div style={{ padding: '8px 16px' }}>
                    {!isSearching ? (
                        /* Discover Feed (Default View) */
                        <>
                            {/* 📰 Google Daily News & Trends (Cricket, Bollywood, Hollywood, Gaming, Sports) */}
                            <DailyNewsFeed 
                                externalActiveNews={selectedNews}
                                onCloseNews={() => setSelectedNews(null)}
                                onShareNews={(news) => {
                                    const mappedPost: PostData = {
                                        id: news.id,
                                        user_id: '',
                                        image_url: news.imageUrl,
                                        caption: `${news.title}\n\n📰 Source: ${news.source}\n\n${news.summary}`,
                                        attached_link: news.url,
                                        created_at: news.publishedAt,
                                        likes_count: news.likesCount,
                                        category: news.category === 'Cricket & IPL' ? 'Cricket' : news.category,
                                        username: 'google_news',
                                        avatar_url: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=150'
                                    };
                                    setPostToShare(mappedPost);
                                    setIsShareOpen(true);
                                }} 
                            />

                            {/* 🔥 Trending Now Banner — FOMO */}
                            {!isTrendingLoading && trendingPosts.length > 0 && (
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                        <Flame size={18} color="#f5a524" />
                                        <span style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--text-active)' }}>Trending Now</span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-inactive)', marginLeft: 'auto' }}>Last 24h</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch' }}>
                                        {trendingPosts.slice(0, 6).map((post, idx) => (
                                            <div
                                                key={post.id}
                                                style={{
                                                    flexShrink: 0, width: '140px', height: '180px', borderRadius: '16px',
                                                    overflow: 'hidden', position: 'relative', cursor: 'pointer',
                                                    border: '2px solid rgba(245, 165, 36,0.3)',
                                                }}
                                                onClick={() => {
                                                    if (isNewsPost(post)) {
                                                        setSelectedNews(postToNewsItem(post));
                                                    } else {
                                                        setActiveFeedState({ posts: normalizedTrendingPosts, index: idx });
                                                    }
                                                }}
                                            >
                                                <PostMedia post={post} className="" muted loop playsInline autoPlay={false} thumbnail={true}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <div style={{
                                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                                                    padding: '24px 8px 8px', display: 'flex', flexDirection: 'column', gap: '4px',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <TrendingUp size={12} color="#f5a524" />
                                                        <span style={{ fontSize: '11px', color: '#f5a524', fontWeight: 'bold' }}>
                                                            {post.likes_count} likes
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                                                        <img
                                                            src={post.avatar_url || `https://i.pravatar.cc/150?u=${post.username || 'user'}`}
                                                            alt=""
                                                            onError={(e) => {
                                                                (e.currentTarget as HTMLImageElement).src = `https://i.pravatar.cc/150?u=${post.username || 'user'}`;
                                                            }}
                                                            style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0 }}
                                                        />
                                                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.9)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            @{post.username}
                                                        </span>
                                                    </div>
                                                </div>
                                                {isVideoPost(post) && (
                                                    <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                                                        <Play size={14} color="#fff" fill="#fff" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {isTrendingLoading && <TrendingSkeleton />}

                            {/* 🏷️ Instagram-Style Category Filter Pills */}
                            <div style={{
                                display: 'flex', gap: '8px', overflowX: 'auto',
                                padding: '4px 0 14px', scrollbarWidth: 'none',
                                WebkitOverflowScrolling: 'touch'
                            }}>
                                {[
                                    { label: '✨ All', val: null },
                                    { label: '😂 Memes', val: 'Memes' },
                                    { label: '🎬 Bollywood', val: 'Bollywood' },
                                    { label: '💪 Gym & Fitness', val: 'Fitness' },
                                    { label: '🏏 Sports & Cricket', val: 'Sports' },
                                    { label: '🌴 Lifestyle', val: 'Lifestyle' },
                                    { label: '🎮 Gaming', val: 'Gaming' },
                                ].map(cat => {
                                    const isSelected = selectedCategory === cat.val;
                                    return (
                                        <button
                                            key={cat.label}
                                            onClick={() => setSelectedCategory(cat.val)}
                                            style={{
                                                flexShrink: 0,
                                                padding: '6px 14px',
                                                borderRadius: '20px',
                                                fontSize: '12px',
                                                fontWeight: isSelected ? '600' : '500',
                                                background: isSelected ? 'var(--primary-gradient, linear-gradient(135deg, #f5a524, #ff5722))' : 'rgba(255, 255, 255, 0.08)',
                                                color: isSelected ? '#000' : 'var(--text-active)',
                                                border: isSelected ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            {cat.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Discover Grid */}
                            {isDiscoverLoading ? (
                                <GridSkeleton count={12} />
                            ) : discoverPosts.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-inactive)' }}>
                                    No content found for this category.
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoFlow: 'dense', gap: '2px' }}>
                                        {discoverPosts.map((post, idx) => (
                                            <ExploreGridCard
                                                key={post.id}
                                                post={post}
                                                index={idx}
                                                isSurprise={surprisePostIdSet.has(post.id)}
                                                onPostClick={handleDiscoverPostClick}
                                                trackViewRef={trackViewRef}
                                            />
                                        ))}
                                    </div>

                                    {/* 📜 Infinite Scroll Sentinel */}
                                    <div ref={sentinelRef} style={{ height: '1px' }} />
                                    {isLoadingMore && <GridSkeleton count={6} />}
                                </>
                            )}
                        </>
                ) : (
                    /* Search Results View */
                    loadingSearch ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-inactive)' }} />
                        </div>
                    ) : (
                        <>
                            {activeTab === 'people' && (
                                peopleResults.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-inactive)' }}>
                                        No users found for "{searchTerm}"
                                    </div>
                                ) : (
                                    peopleResults.map(person => (
                                        <div key={person.id} style={{
                                            display: 'flex', alignItems: 'center', padding: '14px 0',
                                            borderBottom: '1px solid #1c1c1e',
                                        }}>
                                            <img
                                                src={person.avatar_url || 'https://i.pravatar.cc/150'}
                                                alt="" onClick={() => navigate(`/profile/${person.username}`)}
                                                style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', marginRight: '14px', cursor: 'pointer' }}
                                            />
                                            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/profile/${person.username}`)}>
                                                <h4 style={{ margin: 0, color: 'var(--text-active)', fontSize: '15px', fontWeight: '600' }}>{person.username}</h4>
                                                {person.bio && <p style={{ margin: '2px 0 0', color: 'var(--text-inactive)', fontSize: '13px' }}>{person.bio}</p>}
                                            </div>
                                            {user && person.id !== user.id && (
                                                <button
                                                    onClick={() => handleToggleFollow(person.id)}
                                                    style={{
                                                        background: followingMap[person.id] ? 'transparent' : '#f5a524',
                                                        border: followingMap[person.id] ? '1px solid #3a3a3c' : 'none',
                                                        color: 'var(--text-active)', borderRadius: '20px',
                                                        padding: '8px 18px', fontSize: '13px', fontWeight: 'bold',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                                    }}
                                                >
                                                    {followingMap[person.id] ? <><UserCheck size={14} /> Unfriend</> : <><UserPlus size={14} /> Friend</>}
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )
                            )}

                            {activeTab === 'posts' && (
                                postResults.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-inactive)' }}>
                                        <Hash size={40} style={{ margin: '0 auto 12px', opacity: 0.4, color: '#f5a524' }} />
                                        <h3 style={{ margin: '0 0 6px', color: 'var(--text-active)', fontSize: '16px', fontWeight: '600' }}>
                                            No posts found for "{searchTerm}"
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-inactive)' }}>
                                            Try searching for popular tags like #trending, #viral, or #foryou
                                        </p>
                                    </div>
                                ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoFlow: 'dense', gap: '2px' }}>
                                            {postResults.map((post, idx) => (
                                                <ExploreGridCard
                                                    key={post.id}
                                                    post={post}
                                                    index={idx}
                                                    isSurprise={false}
                                                    onPostClick={handleSearchPostClick}
                                                />
                                            ))}
                                        </div>
                                )
                            )}

                            {activeTab === 'stories' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                                    {storyResults.length > 0 ? (
                                        storyResults.map((group, idx) => {
                                            const storyUrl = group.stories[0]?.image_url || '';
                                            const isVideo = isVideoUrl(storyUrl);
                                            return (
                                                <div key={group.userId} style={{ position: 'relative', aspectRatio: '9/16', cursor: 'pointer' }} onClick={() => setActiveStoryGroupIndex(idx)}>
                                                    {isVideo ? (
                                                        <video src={`${storyUrl}#t=0.001`} preload="metadata" muted playsInline style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <img 
                                                            src={storyUrl} 
                                                            alt="" 
                                                            loading="lazy" 
                                                            onError={(e) => {
                                                                const container = (e.target as HTMLElement).parentElement;
                                                                if (container) container.style.display = 'none';
                                                            }}
                                                            style={{ height: '100%', width: '100%', objectFit: 'cover' }} 
                                                        />
                                                    )}
                                                    <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.5)', padding: '3px 8px', borderRadius: '10px' }}>
                                                        <img src={group.avatarUrl} alt="" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
                                                        <span style={{ color: 'var(--text-active)', fontSize: '10px', fontWeight: 'bold' }}>{group.username}</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--text-inactive)' }}>
                                            No stories found
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )
                )}
                </div>
            </PullToRefresh>

            {activeStoryGroupIndex !== null && (
                <Suspense fallback={null}>
                    <StoryViewer
                        storyGroups={storyResults}
                        initialGroupIndex={activeStoryGroupIndex}
                        currentUserId={user?.id}
                        onClose={() => setActiveStoryGroupIndex(null)}
                        onGroupsUpdated={setStoryResults}
                    />
                </Suspense>
            )}

            {activeFeedState && (
                <ExploreFeedViewer
                    posts={activeFeedState.posts}
                    initialIndex={activeFeedState.index}
                    onClose={() => setActiveFeedState(null)}
                    onCommentClick={(postId) => { setCommentsPostId(postId); setIsCommentsOpen(true); }}
                    onShareClick={(post) => { setPostToShare(post); setIsShareOpen(true); }}
                />
            )}

            {isCommentsOpen && commentsPostId && user && (
                <Suspense fallback={null}>
                    <CommentsSheet postId={commentsPostId} isOpen={isCommentsOpen} currentUser={user as any} onClose={() => setIsCommentsOpen(false)} />
                </Suspense>
            )}

            {isChatOpen && user && (
                <Suspense fallback={null}>
                    <ChatPanel 
                        isOpen={isChatOpen} 
                        onClose={() => { setIsChatOpen(false); setChatUserId(null); }} 
                        currentUser={{ ...user, username: user.username || 'user' }} 
                        initialOpenUserId={chatUserId}
                        refreshKey={chatRefreshKey}
                        pendingShare={pendingShare}
                    />
                </Suspense>
            )}

            {isShareOpen && postToShare && user && (
                <Suspense fallback={null}>
                    <ShareModal 
                        post={postToShare} 
                        isOpen={isShareOpen} 
                        currentUser={user as any} 
                        onClose={() => setIsShareOpen(false)} 
                        onMessageSent={(receiverId, message) => {
                            setPendingShare({ receiverId, message });
                            setChatRefreshKey(k => k + 1);
                        }}
                        onViewChat={(userId) => {
                            setIsShareOpen(false);
                            setPostToShare(null);
                            setChatUserId(userId);
                            setIsChatOpen(true);
                        }}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default Explore;
