import React, { useState, useEffect, useRef, useContext, useCallback, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { fetchAllPostsForScoring, fetchConnectionPosts, fetchConnectionUserIds, fetchUserEngagements, trackEngagement, deletePost, fetchProfilesByIds, fetchDiscoverPosts, normalizePost, type PostData, type MessageData } from '../lib/database';
import { checkIfLiked, checkIfLikedBatch, toggleLike, fetchUserImps, toggleImp } from '../lib/database';
import { supabase } from '../lib/supabase';
import { Loader2, Plus, Heart, MessageCircle, Send, Bookmark, X, Link as LinkIcon, Sparkles, ChevronLeft, ChevronRight, Flame, Users, RefreshCw, Mic, Trash2, Music, Bell, Volume2, VolumeX } from 'lucide-react';
import PostMedia from '../components/PostMedia';
import ConnectionFeedItem from '../components/ConnectionFeedItem';
import PullToRefresh from '../components/PullToRefresh';
import VoiceReaction from '../components/VoiceReaction';
import ExploreFeedViewer from '../components/ExploreFeedViewer';
import { isVideoPost, isVideoUrl, getOptimizedImageUrl, getCleanSongUrl, getFeedMutedPreference, setFeedMutedPreference } from '../lib/media';
import { buildInterestProfile, assembleFeed, shuffleFeedForRefresh, rankFeedPosts, getHybridInterestProfile, recordImplicitSignal, generateInfiniteStream, type ScoredPost } from '../lib/algorithm';

// ⚡ Lazy-load heavy modals so the Home feed renders in 0ms!
const ChatPanel = lazy(() => import('../components/ChatPanel'));
const ShareModal = lazy(() => import('../components/ShareModal'));
const CommentsSheet = lazy(() => import('../components/CommentsSheet'));

export interface UnifiedItem {
    userId: string;
    username: string;
    avatarUrl: string;
    post?: PostData;
    latestDate: Date;
}

interface MasonryPostCardProps {
    post: PostData;
    index: number;
    isLiked: boolean;
    isImped: boolean;
    likeCount: number;
    currentUserId?: string;
    onSelect: (post: PostData) => void;
    onDoubleTap: (post: PostData) => void;
    onLikeToggle: (postId: string) => void;
    onImpToggle: (postId: string) => void;
    onOpenChat: (userId: string) => void;
    onShare: (post: PostData) => void;
    onOpenComments: (postId: string) => void;
    onObserveCard?: (node: HTMLDivElement | null, postId: string, category: string) => void;
}

const MasonryPostCard = React.memo<MasonryPostCardProps>(({
    post,
    index,
    isLiked,
    isImped,
    likeCount,
    currentUserId,
    onSelect,
    onDoubleTap,
    onLikeToggle,
    onImpToggle,
    onOpenChat,
    onShare,
    onOpenComments,
    onObserveCard,
}) => {
    return (
        <div
            ref={(node) => onObserveCard?.(node, post.id, post.category || 'General')}
            className={`masonry-card ${index % 5 === 0 ? 'masonry-card--tall' : ''}`}
            data-post-id={post.id}
            data-post-cat={post.category || 'General'}
            onClick={() => onSelect(post)}
            onDoubleClick={() => onDoubleTap(post)}
        >
            <PostMedia post={post} className="masonry-card-img" muted loop playsInline autoPlay={false} thumbnail={true} />
            {(post.music_url || post.music_title) && (
                <div style={{
                    position: 'absolute', top: '12px', left: '12px', zIndex: 5,
                    display: 'flex', alignItems: 'center', gap: '5px',
                    background: 'rgba(0,0,0,0.72)',
                    padding: '4px 10px', borderRadius: '14px', color: '#fff',
                    fontSize: '11px', fontWeight: 'bold', maxWidth: '140px',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                }}>
                    <Music size={12} color="#f5a524" />
                    <span>{post.music_title || 'Music'}</span>
                </div>
            )}
            {isVideoPost(post) && (
                <span className="masonry-video-sound-hint">🔊 Tap for sound</span>
            )}
            <div className="masonry-card-overlay" />
            <button
                className={`masonry-like-btn ${isLiked ? 'liked' : ''}`}
                style={{ top: '12px', right: '12px' }}
                onClick={(e) => { e.stopPropagation(); onLikeToggle(post.id); }}
            >
                <Heart size={16} fill={isLiked ? '#f5a524' : 'none'} color={isLiked ? '#f5a524' : 'var(--text-active)'} />
            </button>
            <button
                className="masonry-like-btn"
                style={{ top: '52px', right: '12px' }}
                onClick={(e) => { e.stopPropagation(); onOpenChat(post.user_id); }}
            >
                <MessageCircle size={16} color="var(--text-active)" />
            </button>
            <button
                className="masonry-like-btn"
                style={{ top: '92px', right: '12px' }}
                onClick={(e) => { e.stopPropagation(); onShare(post); }}
            >
                <Send size={16} color="var(--text-active)" />
            </button>
            <button
                className={`masonry-like-btn ${isImped ? 'imped' : ''}`}
                style={{ top: '132px', right: '12px' }}
                onClick={(e) => { e.stopPropagation(); onImpToggle(post.id); }}
                title="Imp / Boost post"
            >
                <Flame size={16} fill={isImped ? '#ff4500' : 'none'} color={isImped ? '#ff4500' : 'var(--text-active)'} />
            </button>
            {currentUserId && post.user_id && post.user_id !== currentUserId && (
                <div style={{ position: 'absolute', bottom: '144px', right: '8px', zIndex: 5 }}>
                    <VoiceReaction
                        postId={post.id}
                        postCategory={post.category}
                        currentUserId={currentUserId}
                        postOwnerId={post.user_id}
                    />
                </div>
            )}
            {post.attached_link && (
                <div className="masonry-link-badge">
                    <LinkIcon size={12} />
                </div>
            )}
            <div className="masonry-card-info">
                <div className="masonry-card-user">
                    <img
                        src={getOptimizedImageUrl(post.avatar_url || 'https://i.pravatar.cc/150', 80)}
                        alt=""
                        className="masonry-avatar"
                        loading="lazy"
                        decoding="async"
                    />
                    <span className="masonry-username">{post.username}</span>
                </div>
                <div className="masonry-meta">
                    <span className="masonry-likes">{likeCount || 0} ❤️</span>
                    <span className="masonry-time">{getTimeAgo(post.created_at)}</span>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenComments(post.id); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                    <MessageCircle size={12} /> {post.comments_count || 0}
                </button>
            </div>
        </div>
    );
}, (prev, next) => {
    return (
        prev.post.id === next.post.id &&
        prev.post.comments_count === next.post.comments_count &&
        prev.isLiked === next.isLiked &&
        prev.isImped === next.isImped &&
        prev.likeCount === next.likeCount &&
        prev.index === next.index
    );
});

const Home = () => {
    const { user, blockedIds } = useContext(AppContext);
    const userId = user?.id;
    const navigate = useNavigate();

    // ⚡ Instant Cache Rehydration: Show cached posts instantly on frame 1
    const [posts, setPosts] = useState<PostData[]>(() => {
        try {
            const cached = localStorage.getItem('knock_home_posts_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                return (parsed || []).map(normalizePost).filter(Boolean);
            }
        } catch (e) {}
        return [];
    });
    const [loading, setLoading] = useState<boolean>(() => {
        try {
            const cached = localStorage.getItem('knock_home_posts_cache');
            return !cached || JSON.parse(cached).length === 0;
        } catch (e) {
            return true;
        }
    });
    const [error, setError] = useState('');
    const [activeFeedState, setActiveFeedState] = useState<{ posts: PostData[]; index: number } | null>(null);
    const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
    const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
    const [impedPosts, setImpedPosts] = useState<Record<string, boolean>>({});
    const [impCounts, setImpCounts] = useState<Record<string, number>>({});



    // Feed mode toggle
    const [feedMode, setFeedMode] = useState<'foryou' | 'connections'>('foryou');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatUserId, setChatUserId] = useState<string | null>(null);
    const [chatRefreshKey, setChatRefreshKey] = useState(0);
    const [pendingShare, setPendingShare] = useState<{ receiverId: string; message: MessageData } | null>(null);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [postToShare, setPostToShare] = useState<PostData | null>(null);
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [commentsPostId, setCommentsPostId] = useState<string>('');
    const [unifiedConnectionItems, setUnifiedConnectionItems] = useState<UnifiedItem[]>([]);
    const [connectionUserIds, setConnectionUserIds] = useState<Set<string>>(new Set());
    const [loadingConnPosts, setLoadingConnPosts] = useState(false);
    
    // Algorithmic feed state
    const [allRawPosts, setAllRawPosts] = useState<PostData[]>([]);
    // ⚡ Removed unused scoredFeed/setScoredFeed state (dead since algorithm refactor)
    const [feedPage, setFeedPage] = useState(0);
    const [hasMorePosts, setHasMorePosts] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);

    // ⚡ Refs mirror state to break useCallback dependency chains
    const postsRef = useRef<PostData[]>(posts);
    const allRawPostsRef = useRef<PostData[]>([]);
    const feedPageRef = useRef(0);
    const likedPostsRef = useRef<Record<string, boolean>>(likedPosts);
    const impedPostsRef = useRef<Record<string, boolean>>(impedPosts);
    const engagementCacheRef = useRef<{ data: any[]; fetchedAt: number }>({ data: [], fetchedAt: 0 });
    
    // Connection List (like Page 3)
    const [connectionsList, setConnectionsList] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // Real-time unread chat message badge tracking
    useEffect(() => {
        if (!userId) return;

        const updateUnreadCount = async () => {
            try {
                const { count, error } = await supabase
                    .from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('receiver_id', userId)
                    .eq('is_read', false);
                
                if (!error && count !== null) {
                    setUnreadCount(count);
                }
            } catch (err) {
                console.error('Error fetching unread count:', err);
            }
        };

        updateUnreadCount();

        // Subscribe to incoming messages
        const channel = supabase
            .channel(`unread-messages-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `receiver_id=eq.${userId}`
                },
                () => {
                    updateUnreadCount();
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [userId]);

    // ⚡ Keep refs synced with state for stable callbacks
    useEffect(() => { postsRef.current = posts; }, [posts]);
    useEffect(() => { allRawPostsRef.current = allRawPosts; }, [allRawPosts]);
    useEffect(() => { feedPageRef.current = feedPage; }, [feedPage]);
    useEffect(() => { likedPostsRef.current = likedPosts; }, [likedPosts]);
    useEffect(() => { impedPostsRef.current = impedPosts; }, [impedPosts]);

    // ⚡ Cached engagement fetcher — avoids network call on every scroll
    const getCachedEngagements = useCallback(async () => {
        const CACHE_TTL = 60_000; // 60 seconds
        const now = Date.now();
        if (engagementCacheRef.current.fetchedAt > 0 && now - engagementCacheRef.current.fetchedAt < CACHE_TTL) {
            return engagementCacheRef.current.data;
        }
        if (!userId) return [];
        const engagements = await fetchUserEngagements(userId);
        engagementCacheRef.current = { data: engagements, fetchedAt: now };
        return engagements;
    }, [userId]);

    const loadForYouFeed = useCallback(() => {
        if (!userId) return;
        if (postsRef.current.length === 0) {
            setLoading(true);
        }
        setError('');
        // Fetch all raw posts and user engagements, then build scored feed using Hyper-Personalized algorithm
        Promise.all([
            fetchAllPostsForScoring(userId),
            getCachedEngagements()
        ]).then(([rawPosts, engagements]) => {
            const validPosts = rawPosts.filter(p => !p.user_id || !blockedIds.includes(p.user_id));
            const seenUrls = new Set<string>();
            const seenIds = new Set<string>();
            const uniquePosts = validPosts.filter(p => {
                if (!p.image_url || seenUrls.has(p.image_url) || seenIds.has(p.id)) return false;
                seenUrls.add(p.image_url);
                seenIds.add(p.id);
                return true;
            });
            setAllRawPosts(uniquePosts);
            allRawPostsRef.current = uniquePosts;
            const hybridProfile = getHybridInterestProfile(engagements);
            const connIds = Array.from(connectionUserIds);
            const rankedPosts = rankFeedPosts(uniquePosts, hybridProfile, userId, connIds);
            const firstBatch = rankedPosts.slice(0, 10);
            
            setPosts(firstBatch);
            postsRef.current = firstBatch;
            try {
                localStorage.setItem('knock_home_posts_cache', JSON.stringify(firstBatch));
            } catch (e) {}
            setLoading(false);
            
            const counts: Record<string, number> = {};
            const iCounts: Record<string, number> = {};
            firstBatch.forEach(p => { 
                counts[p.id] = p.likes_count; 
                iCounts[p.id] = p.imps_count || 0;
            });
            setLikeCounts(counts);
            setImpCounts(iCounts);
            
            // Batch check all likes in one query instead of N individual queries
            const postIds = firstBatch.map(p => p.id);
            checkIfLikedBatch(userId, postIds).then(likedMap => {
                setLikedPosts(prev => ({ ...prev, ...likedMap }));
            });
            fetchUserImps(userId).then(imps => {
                const impMap: Record<string, boolean> = {};
                imps.forEach(id => { impMap[id] = true; });
                setImpedPosts(prev => ({ ...prev, ...impMap }));
            });
            
            // Track view engagements
            firstBatch.forEach(p => {
                trackEngagement(userId, p.id, 'view', 1, p.category || 'General');
            });
            
            setHasMorePosts(true);
        }).catch(err => {
            console.error('Failed to fetch posts:', err);
            setError('Failed to load posts. Please check your connection and try again.');
            setLoading(false);
        });
    }, [userId, blockedIds, connectionUserIds, getCachedEngagements]);

    useEffect(() => {
        loadForYouFeed();
    }, [loadForYouFeed, feedMode]);

    // Pull-to-refresh handler (For You Feed) — ⚡ consolidated (was duplicate handleRefresh)
    const handleRefreshForYou = useCallback(async () => {
        if (!userId || isRefreshing) return;
        setIsRefreshing(true);
        try {
            const engagements = await getCachedEngagements();
            const hybridProfile = getHybridInterestProfile(engagements);
            const connIds = Array.from(connectionUserIds);
            const shuffled = shuffleFeedForRefresh(allRawPostsRef.current);
            const freshBatch = rankFeedPosts(shuffled, hybridProfile, userId, connIds).slice(0, 10);
            setPosts(freshBatch);
            postsRef.current = freshBatch;
            setFeedPage(0);
            feedPageRef.current = 0;
            setHasMorePosts(true);
        } catch (err) {
            console.error('Refresh failed:', err);
        }
        setIsRefreshing(false);
    }, [userId, isRefreshing, connectionUserIds, getCachedEngagements]);

    // Infinite scroll — load more posts automatically (Infinite non-terminating stream with variable rewards)
    // ⚡ Reads from refs instead of state to avoid callback recreation on every scroll
    const loadMorePosts = useCallback(async () => {
        if (!userId || isLoadingMore || loading) return;
        setIsLoadingMore(true);
        try {
            const nextPage = feedPageRef.current + 1;
            const engagements = await getCachedEngagements();
            const hybridProfile = getHybridInterestProfile(engagements);
            const connIds = Array.from(connectionUserIds);
            
            const currentPosts = postsRef.current;
            const currentIds = new Set(currentPosts.map(p => p.id));
            const currentUrls = new Set(currentPosts.map(p => p.image_url));
            const rawPosts = allRawPostsRef.current;

            // Generate next stream batch via infinite stream synthesizer
            let streamBatch: PostData[] = [];
            if (rawPosts.length > 0) {
                streamBatch = generateInfiniteStream(
                    rawPosts,
                    nextPage,
                    10,
                    (batch) => rankFeedPosts(batch, hybridProfile, userId, connIds)
                );
            }

            // Exclude already loaded posts to keep feed fresh
            let freshBatch = streamBatch.filter(p => !currentIds.has(p.id) && !currentUrls.has(p.image_url));

            if (freshBatch.length < 5) {
                // Fetch more discover posts if pool is running low
                const moreDbPosts = await fetchDiscoverPosts(null, 50, rawPosts.length);
                const uniqueMoreDb = moreDbPosts.filter(p => {
                    if (!p.image_url || currentIds.has(p.id) || currentUrls.has(p.image_url) || (p.user_id && blockedIds.includes(p.user_id))) return false;
                    currentIds.add(p.id);
                    currentUrls.add(p.image_url);
                    return true;
                });

                if (uniqueMoreDb.length > 0) {
                    setAllRawPosts(prev => [...(prev || []), ...uniqueMoreDb]);
                    const rankedMore = rankFeedPosts(uniqueMoreDb, hybridProfile, userId, connIds);
                    freshBatch = [...freshBatch, ...rankedMore.slice(0, 10 - freshBatch.length)];
                }
            }

            // If still empty (small dataset), allow cyclical stream
            if (freshBatch.length === 0 && rawPosts.length > 0) {
                freshBatch = generateInfiniteStream(
                    rawPosts,
                    nextPage,
                    10,
                    (batch) => rankFeedPosts(batch, hybridProfile, userId, connIds)
                );
            }

            if (freshBatch.length > 0) {
                setPosts(prev => [...(prev || []), ...freshBatch]);
                setFeedPage(nextPage);
                feedPageRef.current = nextPage;
                // Batch check likes for new posts
                const newPostIds = freshBatch.map(p => p.id);
                checkIfLikedBatch(userId, newPostIds).then(likedMap => {
                    setLikedPosts(prev => ({ ...prev, ...likedMap }));
                });
                const newCounts: Record<string, number> = {};
                freshBatch.forEach(p => {
                    trackEngagement(userId, p.id, 'view', 1, p.category || 'General');
                    newCounts[p.id] = p.likes_count;
                });
                setLikeCounts(prev => ({ ...prev, ...newCounts }));
            }
            setHasMorePosts(true);
        } catch (err) {
            console.error('Error loading more posts on home:', err);
        } finally {
            setIsLoadingMore(false);
        }
    }, [userId, isLoadingMore, loading, blockedIds, connectionUserIds, getCachedEngagements]);

    // IntersectionObserver for automatic infinite scrolling as user scrolls
    useEffect(() => {
        if (!sentinelRef.current) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !loading && !isLoadingMore && hasMorePosts && feedMode === 'foryou') {
                    loadMorePosts();
                }
            },
            { rootMargin: '500px' }
        );
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [loadMorePosts, loading, isLoadingMore, hasMorePosts, feedMode]);

    // Load connections
    useEffect(() => {
        if (userId) {
            fetchConnectionUserIds(userId).then(ids => {
                setConnectionUserIds(new Set(ids));
            });
        }
    }, [userId]);

    const handleLikeToggle = useCallback(async (postId: string) => {
        if (!userId) return;
        const currentlyLiked = likedPostsRef.current[postId] || false;
        const newLiked = !currentlyLiked;
        setLikedPosts(prev => ({ ...prev, [postId]: newLiked }));
        setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + (newLiked ? 1 : -1) }));
        await toggleLike(userId, postId, currentlyLiked);
        // Track like engagement
        if (newLiked) {
            const post = postsRef.current.find(p => p.id === postId);
            trackEngagement(userId, postId, 'like', 1, post?.category || 'General');
        }
    }, [userId]);

    const handleImpToggle = useCallback(async (postId: string) => {
        if (!userId) return;
        const currentlyImped = impedPostsRef.current[postId] || false;
        const newImped = !currentlyImped;
        setImpedPosts(prev => ({ ...prev, [postId]: newImped }));
        setImpCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + (newImped ? 1 : -1) }));
        await toggleImp(userId, postId, currentlyImped);
    }, [userId]);

    // Pull-to-refresh handler (points to consolidated handleRefreshForYou)
    const handleRefresh = handleRefreshForYou;

    const handleDoubleTap = useCallback((post: PostData) => {
        if (!likedPostsRef.current[post.id]) {
            handleLikeToggle(post.id);
        }
    }, [handleLikeToggle]);

    const connectionPosts = useMemo(() => {
        return unifiedConnectionItems
            .map(item => item.post)
            .filter((p): p is PostData => Boolean(p));
    }, [unifiedConnectionItems]);

    // ⚡ Stable callback closures for MasonryPostCard props to avoid allocating per-card closures on each render
    const handleSelectPost = useCallback((p: PostData) => {
        const norm = normalizePost(p) || p;
        const idx = posts.findIndex(item => item.id === norm.id);
        setActiveFeedState({
            posts,
            index: idx !== -1 ? idx : 0,
        });
        if (userId) {
            trackEngagement(userId, norm.id, 'click', 1, norm.category || 'General').catch(() => {});
        }
    }, [posts, userId]);
    const handleOpenChat = useCallback((uid: string) => { setChatUserId(uid); setIsChatOpen(true); }, []);
    const handleSharePost = useCallback((p: PostData) => { setPostToShare(p); setIsShareOpen(true); }, []);
    const handleOpenComments = useCallback((pid: string) => { setCommentsPostId(pid); setIsCommentsOpen(true); }, []);

    // Pillar 2: Implicit Signal Tracking for Home Feed Cards (dwell time & fast skips)
    // ⚡ Direct callback ref observation with zero document.querySelectorAll churn
    const dwellObserverRef = useRef<IntersectionObserver | null>(null);
    const observedCardIdsRef = useRef<Set<string>>(new Set());
    const cardTimersRef = useRef<Map<string, number>>(new Map());

    const initDwellObserver = useCallback(() => {
        if (!dwellObserverRef.current) {
            dwellObserverRef.current = new IntersectionObserver((entries) => {
                const now = Date.now();
                entries.forEach(entry => {
                    const el = entry.target as HTMLElement;
                    const postId = el.getAttribute('data-post-id');
                    const category = el.getAttribute('data-post-cat') || 'General';
                    if (!postId) return;

                    if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                        if (!cardTimersRef.current.has(postId)) {
                            cardTimersRef.current.set(postId, now);
                        }
                    } else {
                        const startTime = cardTimersRef.current.get(postId);
                        if (startTime) {
                            const dwellMs = now - startTime;
                            cardTimersRef.current.delete(postId);
                            if (dwellMs >= 2500) {
                                recordImplicitSignal({
                                    userId,
                                    targetId: postId,
                                    type: 'dwell',
                                    category,
                                    value: dwellMs,
                                    timestamp: now,
                                });
                            } else if (dwellMs > 100 && dwellMs < 1200) {
                                recordImplicitSignal({
                                    userId,
                                    targetId: postId,
                                    type: 'skip',
                                    category,
                                    value: dwellMs,
                                    timestamp: now,
                                });
                            }
                        }
                    }
                });
            }, { threshold: [0.1, 0.5] });
        }
    }, [userId]);

    const observeCard = useCallback((node: HTMLDivElement | null, postId: string) => {
        if (!node || feedMode !== 'foryou') return;
        initDwellObserver();
        if (!observedCardIdsRef.current.has(postId)) {
            observedCardIdsRef.current.add(postId);
            dwellObserverRef.current?.observe(node);
        }
    }, [feedMode, initDwellObserver]);

    useEffect(() => {
        if (feedMode !== 'foryou') {
            dwellObserverRef.current?.disconnect();
            dwellObserverRef.current = null;
            observedCardIdsRef.current.clear();
            cardTimersRef.current.clear();
        }
    }, [feedMode]);

    useEffect(() => {
        return () => {
            dwellObserverRef.current?.disconnect();
            dwellObserverRef.current = null;
            cardTimersRef.current.clear();
            observedCardIdsRef.current.clear();
        };
    }, []);

    // Load connection posts when mode switches
    useEffect(() => {
        if (feedMode === 'connections' && userId && unifiedConnectionItems.length === 0) {
            setLoadingConnPosts(true);
            fetchConnectionPosts(userId).then((posts) => {
                const validPosts = posts.filter(p => !p.user_id || !blockedIds.includes(p.user_id));
                const userMap = new Map<string, UnifiedItem>();
                
                validPosts.forEach(p => {
                    const uid = p.user_id || 'unknown';
                    if (!userMap.has(uid)) {
                        userMap.set(uid, { userId: uid, username: p.username, avatarUrl: p.avatar_url, latestDate: new Date(p.created_at) });
                    }
                    const u = userMap.get(uid)!;
                    if (!u.post || new Date(p.created_at) > new Date(u.post.created_at)) {
                        u.post = p;
                        if (new Date(p.created_at) > u.latestDate) u.latestDate = new Date(p.created_at);
                    }
                });

                const items = Array.from(userMap.values()).sort((a, b) => b.latestDate.getTime() - a.latestDate.getTime());
                setUnifiedConnectionItems(items);
                setLoadingConnPosts(false);

                // Check likes for connection posts
                const connPostIds = posts.map(p => p.id);
                checkIfLikedBatch(userId, connPostIds).then(likedMap => {
                    setLikedPosts(prev => ({ ...prev, ...likedMap }));
                });
                const counts: Record<string, number> = {};
                posts.forEach(p => { counts[p.id] = p.likes_count; });
                setLikeCounts(prev => ({ ...prev, ...counts }));
            });
        }
    }, [feedMode, userId, unifiedConnectionItems.length, blockedIds]);

    return (
        <div className="home-page-v2">
            {/* Header */}
            <header className="home-header-v2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 className="home-brand-title">Knock Knock</h1>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                        onClick={() => navigate('/notifications')}
                        title="Notifications"
                        style={{ background: 'none', border: 'none', color: 'var(--text-active)', cursor: 'pointer', padding: '8px', position: 'relative' }}
                    >
                        <Bell size={24} />
                        <span style={{
                            position: 'absolute', top: '4px', right: '4px',
                            background: 'var(--primary-gradient)', width: '8px', height: '8px',
                            borderRadius: '50%', boxShadow: '0 0 6px var(--primary-color)'
                        }} />
                    </button>
                    <button 
                        onClick={() => { setChatUserId(null); setIsChatOpen(true); }} 
                        className="header-icon-btn-v2" 
                        title="Messages" 
                        style={{ background: 'none', border: 'none', color: 'var(--text-active)', cursor: 'pointer', padding: '8px', position: 'relative' }}
                    >
                        <MessageCircle size={24} />
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute', top: '2px', right: '2px',
                                background: '#f5a524', color: 'var(--text-active)', fontSize: '9px',
                                fontWeight: 'bold', borderRadius: '50%', minWidth: '15px',
                                height: '15px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', padding: '0 3px',
                                border: '2px solid #000', boxSizing: 'content-box'
                            }}>
                                {unreadCount}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            {/* Feed Mode Toggle */}
            <div className="feed-toggle-bar">
                <button
                    className={`feed-toggle-pill ${feedMode === 'foryou' ? 'active' : ''}`}
                    onClick={() => setFeedMode('foryou')}
                >
                    <Sparkles size={17} />
                    For You
                </button>
                <button
                    className={`feed-toggle-pill ${feedMode === 'connections' ? 'active' : ''}`}
                    onClick={() => setFeedMode('connections')}
                >
                    <Users size={17} />
                    Connections
                </button>
            </div>

            {/* Content */}
            <div className="masonry-feed-wrapper">
                {feedMode === 'connections' ? (
                    // Connections Feed
                    loadingConnPosts ? (
                        <div className="feed-state-msg">
                            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-inactive)' }} />
                        </div>
                    ) : unifiedConnectionItems.length === 0 ? (
                        <div className="feed-state-msg">
                            <Users size={32} style={{ color: 'var(--text-inactive)', marginBottom: '8px' }} />
                            <p style={{ color: 'var(--text-inactive)' }}>No posts from connections yet.</p>
                            <p style={{ color: '#6e6e73', fontSize: '0.8rem', marginTop: '4px' }}>Match via Voice Roulette & Connect to see their updates here!</p>
                        </div>
                    ) : (
                        <>
                            <div className="connections-horizontal-list" style={{ display: 'flex', overflowX: 'auto', gap: '16px', padding: '0 16px 16px', borderBottom: '1px solid #2c2c2e', marginBottom: '16px' }}>
                                {unifiedConnectionItems.map(item => (
                                    <div key={'av-'+item.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                                        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(45deg, #f5a524, #ff6b35)', padding: 2 }}>
                                            <img src={item.avatarUrl || 'https://i.pravatar.cc/150'} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #000' }} />
                                        </div>
                                        <span style={{ fontSize: '11px', marginTop: 4, color: 'var(--text-active)' }}>{item.username.substring(0, 8)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="masonry-grid">
                                {unifiedConnectionItems.map((item, index) => (
                                    <ConnectionFeedItem 
                                        key={`${item.userId}-${item.post?.id || index}`}
                                        item={item}
                                        isLiked={item.post ? !!likedPosts[item.post.id] : false}
                                        likeCount={item.post ? (likeCounts[item.post.id] || 0) : 0}
                                        onLikeToggle={(postId) => handleLikeToggle(postId)}
                                        onDoubleTap={(postId) => { if(!likedPosts[postId]) handleLikeToggle(postId); }}
                                        onClickPost={(post) => {
                                            const norm = normalizePost(post) || post;
                                            const idx = connectionPosts.findIndex(p => p.id === norm.id);
                                            setActiveFeedState({
                                                posts: connectionPosts,
                                                index: idx !== -1 ? idx : 0,
                                            });
                                        }}
                                        onShare={(post) => { setPostToShare(post); setIsShareOpen(true); }}
                                        isImped={item.post ? !!impedPosts[item.post.id] : false}
                                        onImpToggle={(postId) => handleImpToggle(postId)}
                                    />
                                ))}
                            </div>
                        </>
                    )
                ) : (
                    // For You Feed (original)
                    error ? (
                        <div className="feed-state-msg">
                            <p style={{ color: '#ff3b30' }}>{error}</p>
                            <button
                                className="retry-btn-v2"
                                onClick={() => {
                                    setError(''); setLoading(true);
                                    loadForYouFeed();
                                }}
                            >
                                Retry
                            </button>
                        </div>
                    ) : loading ? (
                        <div className="feed-state-msg">
                            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-inactive)' }} />
                        </div>
                    ) : posts.length === 0 ? (
                        <div className="feed-state-msg">
                            <p style={{ color: 'var(--text-inactive)' }}>No posts yet. Be the first to post!</p>
                        </div>
                    ) : (
                        <PullToRefresh onRefresh={handleRefresh}>
                        <div className="masonry-grid">
                            {posts.map((post, index) => (
                                <MasonryPostCard
                                    key={post.id + '-' + index}
                                    post={post}
                                    index={index}
                                    isLiked={!!likedPosts[post.id]}
                                    isImped={!!impedPosts[post.id]}
                                    likeCount={likeCounts[post.id] ?? post.likes_count ?? 0}
                                    currentUserId={user?.id}
                                    onSelect={handleSelectPost}
                                    onDoubleTap={handleDoubleTap}
                                    onLikeToggle={handleLikeToggle}
                                    onImpToggle={handleImpToggle}
                                    onOpenChat={handleOpenChat}
                                    onShare={handleSharePost}
                                    onOpenComments={handleOpenComments}
                                    onObserveCard={observeCard}
                                />
                            ))}
                        </div>
                        {/* Seamless Automatic Infinite Scroll Sentinel */}
                        <div ref={sentinelRef} style={{ height: '30px', width: '100%' }} />
                        {isLoadingMore && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px', gap: '8px', color: 'var(--text-inactive)', fontSize: '13px' }}>
                                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: '#f5a524' }} />
                                <span>Loading more posts...</span>
                            </div>
                        )}
                        </PullToRefresh>
                    )
                )}
            </div>

            {/* FAB */}
            <button className="fab-create" onClick={() => navigate('/create')}>
                <Plus size={28} />
            </button>

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

            {isShareOpen && user && (
                <Suspense fallback={null}>
                    <ShareModal 
                        isOpen={isShareOpen} 
                        onClose={() => { setIsShareOpen(false); setPostToShare(null); }} 
                        post={postToShare}
                        currentUser={{ ...user, username: user.username || 'user' }} 
                        onMessageSent={(receiverId, message) => {
                            setPendingShare({ receiverId, message });
                            setChatRefreshKey(k => k + 1);
                        }}
                        onViewChat={(userId) => {
                            setIsShareOpen(false);
                            setPostToShare(null);
                            setActiveFeedState(null);
                            setChatUserId(userId);
                            setIsChatOpen(true);
                        }}
                    />
                </Suspense>
            )}

            {/* Fullscreen Video & Photo Feed Viewer (Unified with 3rd Page Explore Viewer) */}
            {activeFeedState && (
                <ExploreFeedViewer
                    posts={activeFeedState.posts}
                    initialIndex={activeFeedState.index}
                    onClose={() => setActiveFeedState(null)}
                    onCommentClick={(postId) => {
                        setCommentsPostId(postId);
                        setIsCommentsOpen(true);
                    }}
                    onShareClick={(post) => {
                        setPostToShare(post);
                        setIsShareOpen(true);
                    }}
                    onLikeToggle={(postId, liked) => {
                        setLikedPosts(prev => ({ ...prev, [postId]: liked }));
                        setLikeCounts(prev => ({ ...prev, [postId]: Math.max(0, (prev[postId] || 0) + (liked ? 1 : -1)) }));
                    }}
                    onImpToggle={(postId, imped) => {
                        setImpedPosts(prev => ({ ...prev, [postId]: imped }));
                        setImpCounts(prev => ({ ...prev, [postId]: Math.max(0, (prev[postId] || 0) + (imped ? 1 : -1)) }));
                    }}
                    onDelete={(postId) => {
                        setPosts(prev => prev.filter(p => p.id !== postId));
                        setActiveFeedState(null);
                    }}
                    likedPosts={likedPosts}
                    impedPosts={impedPosts}
                />
            )}

            {/* Comments Sheet */}
            {isCommentsOpen && user && (
                <Suspense fallback={null}>
                    <CommentsSheet
                        isOpen={isCommentsOpen}
                        onClose={() => setIsCommentsOpen(false)}
                        postId={commentsPostId}
                        currentUser={{ id: user.id, username: user.username || 'user', avatar_url: user.avatar_url }}
                    />
                </Suspense>
            )}
        </div>
    );
};

function getTimeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
}

export default Home;
