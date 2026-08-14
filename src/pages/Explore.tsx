import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Search, Loader2, Users, Image, BookOpen, UserPlus, UserCheck, Play, Flame, TrendingUp, Eye, Music } from 'lucide-react';
import { searchUsers, searchPostsByCaption, searchStoriesByHashtag, fetchBoostedStories, checkIfFollowing, toggleFollow, fetchDiscoverPosts, fetchUserEngagements, fetchTrendingPosts, trackEngagement, type UserStoryGroup, type StoryData, type ProfileData, type PostData, type MessageData } from '../lib/database';
import { buildInterestProfile, assembleFeed, shuffleFeedForRefresh, type ScoredPost } from '../lib/algorithm';
import StoryViewer from '../components/StoryViewer';
import PostMedia from '../components/PostMedia';
import { AppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import ExploreFeedViewer from '../components/ExploreFeedViewer';
import CommentsSheet from '../components/CommentsSheet';
import ShareModal from '../components/ShareModal';
import ChatPanel from '../components/ChatPanel';
import PullToRefresh from '../components/PullToRefresh';
import { isVideoPost, isVideoUrl } from '../lib/media';
import { GridSkeleton, TrendingSkeleton } from '../components/SkeletonLoader';
import DailyNewsFeed from '../components/DailyNewsFeed';

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

const Explore = () => {
    const { user, blockedIds } = useContext(AppContext);
    const navigate = useNavigate();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'people' | 'posts' | 'stories'>('people');
    
    // Discover (Default) State
    const [discoverPosts, setDiscoverPosts] = useState<PostData[]>([]);
    const [isDiscoverLoading, setIsDiscoverLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Infinite scroll state
    const [feedPage, setFeedPage] = useState(0);
    const [allScoredPosts, setAllScoredPosts] = useState<ScoredPost[]>([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const sentinelRef = useRef<HTMLDivElement>(null);

    // Trending posts (FOMO)
    const [trendingPosts, setTrendingPosts] = useState<PostData[]>([]);
    const [isTrendingLoading, setIsTrendingLoading] = useState(true);

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

    const PAGE_SIZE = 12;

    // Load Trending Posts (FOMO banner)
    useEffect(() => {
        setIsTrendingLoading(true);
        fetchTrendingPosts(6).then(posts => {
            setTrendingPosts(posts.filter(p => (p.likes_count || 0) > 0 && (!p.user_id || !blockedIds.includes(p.user_id))));
            setIsTrendingLoading(false);
        });
    }, [blockedIds]);

    // Load Discover Feed
    const loadDiscoverFeed = async () => {
        setIsDiscoverLoading(true);
        setFeedPage(0);
        setHasMore(true);
        observedPostsRef.current.clear();
        try {
            let rawPosts = await fetchDiscoverPosts(selectedCategory, 150, 0);
            rawPosts = rawPosts.filter(p => !p.user_id || !blockedIds.includes(p.user_id));
            
            // Strictly deduplicate by image_url and id
            const seenUrls = new Set<string>();
            const seenIds = new Set<string>();
            const uniqueRaw = rawPosts.filter(p => {
                if (!p.image_url || seenUrls.has(p.image_url) || seenIds.has(p.id)) return false;
                seenUrls.add(p.image_url);
                seenIds.add(p.id);
                return true;
            });
            rawPostsCacheRef.current = uniqueRaw;

            if (user) {
                const engagements = await fetchUserEngagements(user.id);
                const profile = buildInterestProfile(engagements);
                userProfileRef.current = profile;
                const scored = assembleFeed(uniqueRaw, profile, 0, PAGE_SIZE);
                setAllScoredPosts(scored);
                setDiscoverPosts(scored.map(s => s.post));
                setHasMore(uniqueRaw.length > PAGE_SIZE);
            } else {
                setDiscoverPosts(uniqueRaw.slice(0, PAGE_SIZE));
                setHasMore(uniqueRaw.length > PAGE_SIZE);
            }
        } catch (e) {
            console.error('Error loading discover feed:', e);
        } finally {
            setIsDiscoverLoading(false);
        }
    };

    useEffect(() => {
        if (searchTerm.trim().length > 0) return;
        loadDiscoverFeed();
    }, [selectedCategory, searchTerm, user]);

    // Infinite Scroll — Load More (Guarantees NO duplicate photos)
    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        const nextPage = feedPage + 1;
        
        try {
            const currentIds = new Set(discoverPosts.map(p => p.id));
            const currentUrls = new Set(discoverPosts.map(p => p.image_url));

            if (user && userProfileRef.current) {
                const more = assembleFeed(rawPostsCacheRef.current, userProfileRef.current, nextPage, PAGE_SIZE);
                const freshUnseen = more.filter(s => !currentIds.has(s.post.id) && !currentUrls.has(s.post.image_url));
                
                if (freshUnseen.length > 0) {
                    setAllScoredPosts(prev => [...prev, ...freshUnseen]);
                    setDiscoverPosts(prev => [...prev, ...freshUnseen.map(s => s.post)]);
                    setFeedPage(nextPage);
                } else {
                    // Fetch next page offset from DB
                    const nextBatch = await fetchDiscoverPosts(selectedCategory, 50, rawPostsCacheRef.current.length);
                    const freshDbPosts = nextBatch.filter(p => !currentIds.has(p.id) && !currentUrls.has(p.image_url) && (!p.user_id || !blockedIds.includes(p.user_id)));
                    
                    if (freshDbPosts.length > 0) {
                        rawPostsCacheRef.current = [...rawPostsCacheRef.current, ...freshDbPosts];
                        const freshScored = assembleFeed(freshDbPosts, userProfileRef.current, 0, PAGE_SIZE);
                        setAllScoredPosts(prev => [...prev, ...freshScored]);
                        setDiscoverPosts(prev => [...prev, ...freshScored.map(s => s.post)]);
                        setFeedPage(nextPage);
                    } else {
                        setHasMore(false);
                    }
                }
            } else {
                const start = nextPage * PAGE_SIZE;
                const morePosts = rawPostsCacheRef.current.slice(start, start + PAGE_SIZE);
                const freshUnseen = morePosts.filter(p => !currentIds.has(p.id) && !currentUrls.has(p.image_url));
                
                if (freshUnseen.length > 0) {
                    setDiscoverPosts(prev => [...prev, ...freshUnseen]);
                    setFeedPage(nextPage);
                } else {
                    // Fetch next page offset from DB
                    const nextBatch = await fetchDiscoverPosts(selectedCategory, 50, rawPostsCacheRef.current.length);
                    const freshDbPosts = nextBatch.filter(p => !currentIds.has(p.id) && !currentUrls.has(p.image_url) && (!p.user_id || !blockedIds.includes(p.user_id)));
                    
                    if (freshDbPosts.length > 0) {
                        rawPostsCacheRef.current = [...rawPostsCacheRef.current, ...freshDbPosts];
                        setDiscoverPosts(prev => [...prev, ...freshDbPosts.slice(0, PAGE_SIZE)]);
                        setFeedPage(nextPage);
                    } else {
                        setHasMore(false);
                    }
                }
            }
        } catch (e) {
            console.error('Error loading more posts:', e);
            setHasMore(false);
        } finally {
            setIsLoadingMore(false);
        }
    }, [feedPage, isLoadingMore, hasMore, user, discoverPosts, selectedCategory, blockedIds]);

    // IntersectionObserver for infinite scroll sentinel
    useEffect(() => {
        if (!sentinelRef.current) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isDiscoverLoading && !isLoadingMore && hasMore && searchTerm.trim().length === 0) {
                    loadMore();
                }
            },
            { rootMargin: '200px' }
        );
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [loadMore, isDiscoverLoading, isLoadingMore, hasMore, searchTerm]);

    // IntersectionObserver for viewport engagement tracking
    const trackViewRef = useCallback((node: HTMLDivElement | null) => {
        if (!node || !user) return;
        const postId = node.dataset.postid;
        if (!postId || observedPostsRef.current.has(postId)) return;
        
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const pid = (entry.target as HTMLElement).dataset.postid;
                        if (pid && !observedPostsRef.current.has(pid)) {
                            observedPostsRef.current.add(pid);
                            const post = discoverPosts.find(p => p.id === pid);
                            trackEngagement(user.id, pid, 'view', 1, post?.category || 'General');
                        }
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.5 }
        );
        observer.observe(node);
    }, [user, discoverPosts]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadDiscoverFeed();
        // Reload trending too
        fetchTrendingPosts(6).then(posts => setTrendingPosts(posts.filter(p => (p.likes_count || 0) > 0 && (!p.user_id || !blockedIds.includes(p.user_id)))));
        setIsRefreshing(false);
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
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm, activeTab, blockedIds]);

    const performSearch = async () => {
        setLoadingSearch(true);
        const query = searchTerm.trim();

        if (activeTab === 'people' && query.length >= 2) {
            const results = await searchUsers(query);
            const filteredResults = results.filter(p => !blockedIds.includes(p.id));
            setPeopleResults(filteredResults);
            if (user) {
                const map: Record<string, boolean> = {};
                await Promise.all(filteredResults.map(async (p) => {
                    if (p.id !== user.id) {
                        map[p.id] = await checkIfFollowing(user.id, p.id);
                    }
                }));
                setFollowingMap(map);
            }
        } else if (activeTab === 'posts') {
            const results = await searchPostsByCaption(query || '%');
            setPostResults(results.filter(p => !p.user_id || !blockedIds.includes(p.user_id)));
        } else if (activeTab === 'stories') {
            const term = query.startsWith('#') ? query.substring(1) : query;
            const data = await searchStoriesByHashtag(term);
            setStoryResults(data.filter(g => !blockedIds.includes(g.userId)));
        }
        setLoadingSearch(false);
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

    // Check if a post is a surprise injection
    const isSurprisePost = (postId: string): boolean => {
        return allScoredPosts.some(s => s.post.id === postId && s.isSurprise);
    };

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
                        placeholder="Search people, posts, or tags..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-active)', width: '100%', outline: 'none', fontSize: '15px' }}
                    />
                </div>
            </div>

            {/* Search Tabs (Only shown when searching) */}
            {isSearching && (
                <div style={{ display: 'flex', borderBottom: '1px solid #2c2c2e', marginTop: '8px' }}>
                    <button onClick={() => setActiveTab('people')} style={tabStyle('people')}>
                        <Users size={16} /> People
                    </button>
                    <button onClick={() => setActiveTab('posts')} style={tabStyle('posts')}>
                        <Image size={16} /> Posts
                    </button>
                    <button onClick={() => setActiveTab('stories')} style={tabStyle('stories')}>
                        <BookOpen size={16} /> Stories
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
                            <DailyNewsFeed onShareNews={(news) => {
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
                            }} />

                            {/* 🔥 Trending Now Banner — FOMO */}
                            {!isTrendingLoading && trendingPosts.length > 0 && (
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                        <Flame size={18} color="#f5a524" />
                                        <span style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--text-active)' }}>Trending Now</span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-inactive)', marginLeft: 'auto' }}>Last 24h</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch' }}>
                                        {trendingPosts.slice(0, 4).map((post, idx) => (
                                            <div
                                                key={post.id}
                                                style={{
                                                    flexShrink: 0, width: '140px', height: '180px', borderRadius: '16px',
                                                    overflow: 'hidden', position: 'relative', cursor: 'pointer',
                                                    border: '2px solid rgba(245, 165, 36,0.3)',
                                                }}
                                                onClick={() => setActiveFeedState({ posts: trendingPosts, index: idx })}
                                            >
                                                <PostMedia post={post} className="" muted loop playsInline autoPlay={false}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <div style={{
                                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                                    padding: '24px 8px 8px', display: 'flex', flexDirection: 'column', gap: '2px',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <TrendingUp size={12} color="#f5a524" />
                                                        <span style={{ fontSize: '11px', color: '#f5a524', fontWeight: 'bold' }}>
                                                            {post.likes_count} likes
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>@{post.username}</span>
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

                            {/* Discover Grid */}
                            {isDiscoverLoading ? (
                                <GridSkeleton count={12} />
                            ) : discoverPosts.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-inactive)' }}>
                                    No content found for this category.
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px' }}>
                                        {discoverPosts.map((post, idx) => (
                                        <div 
                                            key={post.id} 
                                            ref={trackViewRef}
                                            data-postid={post.id}
                                            style={{ aspectRatio: '1', position: 'relative', cursor: 'pointer' }} 
                                            onClick={() => setActiveFeedState({ posts: discoverPosts, index: idx })}
                                        >
                                            <PostMedia post={post} className="" muted loop playsInline autoPlay={false}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            {isVideoPost(post) && (
                                                <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                                                    <Play size={16} color="var(--text-active)" fill="var(--text-active)" />
                                                </div>
                                            )}

                                            {post.music_url && (
                                                <div style={{
                                                    position: 'absolute', top: '6px', left: '6px', zIndex: 5,
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                                                    padding: '2px 6px', borderRadius: '10px', color: '#fff',
                                                    fontSize: '9px', fontWeight: '600',
                                                }}>
                                                    <Music size={9} color="#f5a524" />
                                                    <span>{post.music_title || '♪'}</span>
                                                </div>
                                            )}

                                            {/* 😰 FOMO — Engagement badge */}
                                            {(post.likes_count || 0) >= 5 && !isSurprisePost(post.id) && (
                                                <div style={{
                                                    position: 'absolute', bottom: '6px', left: '6px',
                                                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                                                    padding: '2px 6px', borderRadius: '6px',
                                                    fontSize: '9px', color: 'rgba(255,255,255,0.8)',
                                                    display: 'flex', alignItems: 'center', gap: '3px',
                                                }}>
                                                    <Flame size={9} color="#f5a524" /> {post.likes_count}
                                                </div>
                                            )}
                                        </div>
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
                                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-inactive)' }}>
                                        No posts found
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px' }}>
                                        {postResults.map((post, idx) => (
                                            <div key={post.id} style={{ aspectRatio: '1', position: 'relative', cursor: 'pointer' }} onClick={() => setActiveFeedState({ posts: postResults, index: idx })}>
                                                <PostMedia post={post} className="" muted loop playsInline autoPlay={false}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                {isVideoPost(post) && (
                                                    <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                                                        <Play size={16} color="var(--text-active)" fill="var(--text-active)" />
                                                    </div>
                                                )}
                                            </div>
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
                <StoryViewer
                    storyGroups={storyResults}
                    initialGroupIndex={activeStoryGroupIndex}
                    currentUserId={user?.id}
                    onClose={() => setActiveStoryGroupIndex(null)}
                    onGroupsUpdated={setStoryResults}
                />
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
                <CommentsSheet postId={commentsPostId} isOpen={isCommentsOpen} currentUser={user as any} onClose={() => setIsCommentsOpen(false)} />
            )}

            {user && (
                <ChatPanel 
                    isOpen={isChatOpen} 
                    onClose={() => { setIsChatOpen(false); setChatUserId(null); }} 
                    currentUser={{ ...user, username: user.username || 'user' }} 
                    initialOpenUserId={chatUserId}
                    refreshKey={chatRefreshKey}
                    pendingShare={pendingShare}
                />
            )}

            {isShareOpen && postToShare && user && (
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
            )}
        </div>
    );
};

export default Explore;
