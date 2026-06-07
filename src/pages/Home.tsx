import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { fetchAllPostsForScoring, fetchRecentStories, fetchConnectionPosts, fetchConnectionStories, fetchConnectionUserIds, fetchUserEngagements, trackEngagement, deletePost, type PostData, type StoryData, type MessageData } from '../lib/database';
import { checkIfLiked, toggleLike } from '../lib/database';
import { supabase } from '../lib/supabase';
import { Loader2, Plus, Heart, MessageCircle, Send, Bookmark, X, Link as LinkIcon, LogOut, Sparkles, ChevronLeft, ChevronRight, Flame, Users, RefreshCw, Mic, Trash2 } from 'lucide-react';
import PostMedia from '../components/PostMedia';
import ConnectionFeedItem from '../components/ConnectionFeedItem';
import ChatPanel from '../components/ChatPanel';
import ShareModal from '../components/ShareModal';
import PullToRefresh from '../components/PullToRefresh';
import VoiceReaction from '../components/VoiceReaction';
import CommentsSheet from '../components/CommentsSheet';
import { isVideoPost } from '../lib/media';
import { buildInterestProfile, assembleFeed, shuffleFeedForRefresh, type ScoredPost } from '../lib/algorithm';

export interface UnifiedItem {
    userId: string;
    username: string;
    avatarUrl: string;
    post?: PostData;
    story?: StoryData;
    latestDate: Date;
}

// Group stories by user_id for the story rack
interface StoryGroup {
    userId: string;
    username: string;
    avatarUrl: string;
    stories: StoryData[];
}

const Home = () => {
    const { signOut, user } = useContext(AppContext);
    const navigate = useNavigate();
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
    const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
    const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

    // Story rack state
    const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
    const [viewingGroup, setViewingGroup] = useState<StoryGroup | null>(null);
    const [viewingIndex, setViewingIndex] = useState(0);
    const [storyProgress, setStoryProgress] = useState(0);

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
    const [scoredFeed, setScoredFeed] = useState<ScoredPost[]>([]);
    const [feedPage, setFeedPage] = useState(0);
    const [hasMorePosts, setHasMorePosts] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Connection List (like Page 3)
    const [connectionsList, setConnectionsList] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // Real-time unread chat message badge tracking
    useEffect(() => {
        if (!user) return;

        const updateUnreadCount = async () => {
            try {
                const { count, error } = await supabase
                    .from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('receiver_id', user.id)
                    .eq('is_read', false);
                
                if (!error) {
                    setUnreadCount(count || 0);
                }
            } catch (err) {
                console.error('Failed to update unread count:', err);
            }
        };

        updateUnreadCount();

        const channel = supabase
            .channel(`unread-count-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages'
                },
                () => {
                    updateUnreadCount();
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [user?.id]);

    const loadForYouFeed = () => {
        if (!user) return;
        setLoading(true);
        setError('');
        // Fetch all raw posts and user engagements, then build scored feed
        Promise.all([
            fetchAllPostsForScoring(user.id),
            fetchUserEngagements(user.id)
        ]).then(([rawPosts, engagements]) => {
            setAllRawPosts(rawPosts);
            const profile = buildInterestProfile(engagements);
            const firstPage = assembleFeed(rawPosts, profile, 0, 10);
            setScoredFeed(firstPage);
            setPosts(firstPage.map(s => s.post));
            setLoading(false);
            
            const counts: Record<string, number> = {};
            firstPage.forEach(s => { counts[s.post.id] = s.post.likes_count; });
            setLikeCounts(counts);
            
            firstPage.forEach(s => {
                checkIfLiked(user.id, s.post.id).then(liked => {
                    setLikedPosts(prev => ({ ...prev, [s.post.id]: liked }));
                });
                // Track view engagement silently
                trackEngagement(user.id, s.post.id, 'view', 1, s.post.category || 'General');
            });
            
            setHasMorePosts(firstPage.length >= 10);
        }).catch(err => {
            console.error('Failed to fetch posts:', err);
            setError('Failed to load posts. Please check your connection and try again.');
            setLoading(false);
        });
    };

    useEffect(() => {
        loadForYouFeed();

        // Fetch recent stories for the rack
        fetchRecentStories().then(stories => {
            const groups: Record<string, StoryGroup> = {};
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
            setStoryGroups(Object.values(groups));
        });

        // Fetch connection user IDs for ring highlights
        if (user) {
            fetchConnectionUserIds(user.id).then(ids => {
                setConnectionUserIds(new Set(ids));
            });
        }
    }, []);

    const handleLikeToggle = async (postId: string) => {
        if (!user) return;
        const currentlyLiked = likedPosts[postId] || false;
        const newLiked = !currentlyLiked;
        setLikedPosts(prev => ({ ...prev, [postId]: newLiked }));
        setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + (newLiked ? 1 : -1) }));
        await toggleLike(user.id, postId, currentlyLiked);
        // Track like engagement
        if (newLiked) {
            const post = posts.find(p => p.id === postId);
            trackEngagement(user.id, postId, 'like', 1, post?.category || 'General');
        }
    };

    // Pull-to-refresh handler
    const handleRefresh = async () => {
        if (!user || isRefreshing) return;
        setIsRefreshing(true);
        try {
            const engagements = await fetchUserEngagements(user.id);
            const profile = buildInterestProfile(engagements);
            const newFeed = assembleFeed(allRawPosts, profile, 0, 10);
            const shuffled = shuffleFeedForRefresh(newFeed);
            setScoredFeed(shuffled);
            setPosts(shuffled.map(s => s.post));
            setFeedPage(0);
            setHasMorePosts(true);
        } catch (err) {
            console.error('Refresh failed:', err);
        }
        setIsRefreshing(false);
    };

    // Infinite scroll — load more posts
    const loadMorePosts = async () => {
        if (!user || !hasMorePosts) return;
        const nextPage = feedPage + 1;
        const engagements = await fetchUserEngagements(user.id);
        const profile = buildInterestProfile(engagements);
        const nextBatch = assembleFeed(allRawPosts, profile, nextPage, 10);
        if (nextBatch.length < 10) setHasMorePosts(false);
        if (nextBatch.length > 0) {
            setScoredFeed(prev => [...prev, ...nextBatch]);
            setPosts(prev => [...prev, ...nextBatch.map(s => s.post)]);
            setFeedPage(nextPage);
            // Track views on new batch
            nextBatch.forEach(s => {
                trackEngagement(user.id, s.post.id, 'view', 1, s.post.category || 'General');
                checkIfLiked(user.id, s.post.id).then(liked => {
                    setLikedPosts(prev => ({ ...prev, [s.post.id]: liked }));
                });
                setLikeCounts(prev => ({ ...prev, [s.post.id]: s.post.likes_count }));
            });
        }
    };

    const handleDoubleTap = (post: PostData) => {
        if (!likedPosts[post.id]) {
            handleLikeToggle(post.id);
        }
    };

    // Load connection posts when mode switches
    useEffect(() => {
        if (feedMode === 'connections' && user && unifiedConnectionItems.length === 0) {
            setLoadingConnPosts(true);
            Promise.all([
                fetchConnectionPosts(user.id),
                fetchConnectionStories(user.id),
            ]).then(([posts, stories]) => {
                const userMap = new Map<string, UnifiedItem>();
                
                posts.forEach(p => {
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

                stories.forEach(s => {
                    const uid = s.user_id || 'unknown';
                    if (!userMap.has(uid)) {
                        userMap.set(uid, { userId: uid, username: s.username || 'user', avatarUrl: s.image_url, latestDate: new Date(s.created_at) });
                    }
                    const u = userMap.get(uid)!;
                    if (!u.story || new Date(s.created_at) > new Date(u.story.created_at)) {
                        u.story = s;
                        if (new Date(s.created_at) > u.latestDate) u.latestDate = new Date(s.created_at);
                    }
                });

                const items = Array.from(userMap.values()).sort((a, b) => b.latestDate.getTime() - a.latestDate.getTime());
                setUnifiedConnectionItems(items);
                setLoadingConnPosts(false);

                // Check likes for connection posts
                posts.forEach(p => {
                    checkIfLiked(user.id, p.id).then(liked => {
                        setLikedPosts(prev => ({ ...prev, [p.id]: liked }));
                    });
                });
                const counts: Record<string, number> = {};
                posts.forEach(p => { counts[p.id] = p.likes_count; });
                setLikeCounts(prev => ({ ...prev, ...counts }));
            });
            
            // Also fetch connection profiles list (to show matching people)
            // For simplicity, we just extract it from unified items for now if we don't import fetchConnections
        }
    }, [feedMode]);

    // ── Story Viewer Logic ──
    const openStoryViewer = (group: StoryGroup) => {
        setViewingGroup(group);
        setViewingIndex(0);
        setStoryProgress(0);
    };

    const closeStoryViewer = () => {
        setViewingGroup(null);
        setViewingIndex(0);
        setStoryProgress(0);
    };

    const nextStory = () => {
        if (!viewingGroup) return;
        if (viewingIndex < viewingGroup.stories.length - 1) {
            setViewingIndex(prev => prev + 1);
            setStoryProgress(0);
        } else {
            // Move to next group
            const currentGroupIdx = storyGroups.findIndex(g => g.userId === viewingGroup.userId);
            if (currentGroupIdx < storyGroups.length - 1) {
                const nextGroup = storyGroups[currentGroupIdx + 1];
                setViewingGroup(nextGroup);
                setViewingIndex(0);
                setStoryProgress(0);
            } else {
                closeStoryViewer();
            }
        }
    };

    const prevStory = () => {
        if (!viewingGroup) return;
        if (viewingIndex > 0) {
            setViewingIndex(prev => prev - 1);
            setStoryProgress(0);
        }
    };

    // Auto-advance story progress
    useEffect(() => {
        if (!viewingGroup) return;
        const duration = 5000; // 5 seconds per story
        const interval = 50;
        const step = (interval / duration) * 100;

        const timer = setInterval(() => {
            setStoryProgress(prev => {
                if (prev >= 100) {
                    nextStory();
                    return 0;
                }
                return prev + step;
            });
        }, interval);

        return () => clearInterval(timer);
    }, [viewingGroup, viewingIndex]);

    // ── Story Viewer Overlay ──
    if (viewingGroup) {
        const currentStory = viewingGroup.stories[viewingIndex];
        return (
            <div className="story-viewer-overlay">
                {/* Progress Bars */}
                <div className="story-progress-bar-container">
                    {viewingGroup.stories.map((_, i) => (
                        <div key={i} className="story-progress-track">
                            <div
                                className="story-progress-fill"
                                style={{
                                    width: i < viewingIndex ? '100%' :
                                        i === viewingIndex ? `${storyProgress}%` : '0%'
                                }}
                            />
                        </div>
                    ))}
                </div>

                {/* Header */}
                <div className="story-viewer-header">
                    <div className="story-viewer-user">
                        <img
                            src={viewingGroup.avatarUrl}
                            alt=""
                            className="story-viewer-avatar"
                        />
                        <div>
                            <span className="story-viewer-username">@{viewingGroup.username}</span>
                            <span className="story-viewer-time">
                                {currentStory ? getTimeAgo(currentStory.created_at) : ''}
                            </span>
                        </div>
                    </div>
                    <button className="story-viewer-close" onClick={closeStoryViewer}>
                        <X size={24} />
                    </button>
                </div>

                {/* Story Image */}
                {currentStory && (
                    <img
                        src={currentStory.image_url}
                        alt=""
                        className="story-viewer-image"
                    />
                )}

                {/* Tap Zones */}
                <div className="story-tap-left" onClick={prevStory} />
                <div className="story-tap-right" onClick={nextStory} />

                {/* Filter Badge */}
                {currentStory && currentStory.filter_name !== 'Normal' && (
                    <div className="story-filter-badge">
                        <Sparkles size={12} /> {currentStory.filter_name}
                    </div>
                )}

                {/* Boosted Badge */}
                {currentStory && currentStory.is_boosted && (
                    <div className="story-boosted-badge">
                        <Flame size={12} /> Boosted
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="home-page-v2">
            {/* Header + Stories */}
            <header className="home-header-v2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 className="home-brand-title">Knock Knock</h1>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <button 
                        onClick={() => { setChatUserId(null); setIsChatOpen(true); }} 
                        className="signout-btn-v2" 
                        title="Messages" 
                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '8px', position: 'relative' }}
                    >
                        <MessageCircle size={24} />
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute', top: '2px', right: '2px',
                                background: '#ff3366', color: '#fff', fontSize: '9px',
                                fontWeight: 'bold', borderRadius: '50%', minWidth: '15px',
                                height: '15px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', padding: '0 3px',
                                border: '2px solid #000', boxSizing: 'content-box'
                            }}>
                                {unreadCount}
                            </span>
                        )}
                    </button>
                    <button onClick={signOut} className="signout-btn-v2" title="Sign Out" type="button" style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', padding: '8px' }}>
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            {/* Feed Mode Toggle */}
            <div className="feed-toggle-bar">
                <button
                    className={`feed-toggle-pill ${feedMode === 'foryou' ? 'active' : ''}`}
                    onClick={() => setFeedMode('foryou')}
                >
                    <Sparkles size={14} />
                    For You
                </button>
                <button
                    className={`feed-toggle-pill ${feedMode === 'connections' ? 'active' : ''}`}
                    onClick={() => setFeedMode('connections')}
                >
                    <Users size={14} />
                    Connections
                </button>
            </div>

            {(storyGroups.length > 0 || user) && (
                <div className="story-rack-v2 story-rack-top">
                    <div className="story-rack-item" onClick={() => navigate('/stories')}>
                        <div className="story-tile-rect story-tile-add">
                            <img
                                src={user?.avatar_url || 'https://i.pravatar.cc/150'}
                                alt=""
                            />
                            <div className="story-add-icon-rect">
                                <Plus size={14} />
                            </div>
                        </div>
                        <span className="story-rack-name">Your Story</span>
                    </div>

                    {storyGroups
                        .filter(g => g.userId !== user?.id)
                        .map(group => {
                            const isConnection = connectionUserIds.has(group.userId);
                            return (
                                <div
                                    key={group.userId}
                                    className="story-rack-item"
                                    onClick={() => openStoryViewer(group)}
                                >
                                    <div className={`story-tile-rect ${isConnection ? 'story-tile-connection' : ''}`}>
                                        <img
                                            src={group.stories[0]?.image_url || group.avatarUrl}
                                            alt={group.username}
                                        />
                                    </div>
                                    <span className="story-rack-name">
                                        {isConnection && '🔥 '}{group.username}
                                    </span>
                                </div>
                            );
                        })}
                </div>
            )}

            {/* Content */}
            <div className="masonry-feed-wrapper">
                {feedMode === 'connections' ? (
                    // Connections Feed
                    loadingConnPosts ? (
                        <div className="feed-state-msg">
                            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#8e8e93' }} />
                        </div>
                    ) : unifiedConnectionItems.length === 0 ? (
                        <div className="feed-state-msg">
                            <Users size={32} style={{ color: '#8e8e93', marginBottom: '8px' }} />
                            <p style={{ color: '#8e8e93' }}>No posts or stories from connections yet.</p>
                            <p style={{ color: '#6e6e73', fontSize: '0.8rem', marginTop: '4px' }}>Match via Voice Roulette & Connect to see their updates here!</p>
                        </div>
                    ) : (
                        <>
                            <div className="connections-horizontal-list" style={{ display: 'flex', overflowX: 'auto', gap: '16px', padding: '0 16px 16px', borderBottom: '1px solid #2c2c2e', marginBottom: '16px' }}>
                                {unifiedConnectionItems.map(item => (
                                    <div key={'av-'+item.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                                        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(45deg, #ff3366, #ff9933)', padding: 2 }}>
                                            <img src={item.avatarUrl || 'https://i.pravatar.cc/150'} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #000' }} />
                                        </div>
                                        <span style={{ fontSize: '11px', marginTop: 4, color: '#fff' }}>{item.username.substring(0, 8)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="masonry-grid">
                                {unifiedConnectionItems.map((item, index) => (
                                    <ConnectionFeedItem 
                                        key={item.userId}
                                        item={item}
                                        isLiked={item.post ? !!likedPosts[item.post.id] : false}
                                        likeCount={item.post ? (likeCounts[item.post.id] || 0) : 0}
                                        onLikeToggle={(postId) => handleLikeToggle(postId)}
                                        onDoubleTap={(postId) => { if(!likedPosts[postId]) handleLikeToggle(postId); }}
                                        onClickPost={(post) => setSelectedPost(post)}
                                        onShare={(post) => { setPostToShare(post); setIsShareOpen(true); }}
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
                            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#8e8e93' }} />
                        </div>
                    ) : posts.length === 0 ? (
                        <div className="feed-state-msg">
                            <p style={{ color: '#8e8e93' }}>No posts yet. Be the first to post!</p>
                        </div>
                    ) : (
                        <PullToRefresh onRefresh={handleRefresh}>
                        <div className="masonry-grid">
                            {posts.map((post, index) => (
                                <div
                                    key={post.id}
                                    className={`masonry-card ${index % 5 === 0 ? 'masonry-card--tall' : ''}`}
                                    onClick={() => setSelectedPost(post)}
                                    onDoubleClick={() => handleDoubleTap(post)}
                                >
                                    <PostMedia post={post} className="masonry-card-img" muted loop playsInline autoPlay={isVideoPost(post)} />
                                    {isVideoPost(post) && (
                                        <span className="masonry-video-sound-hint">🔊 Tap for sound</span>
                                    )}
                                    <div className="masonry-card-overlay" />
                                    <button
                                        className={`masonry-like-btn ${likedPosts[post.id] ? 'liked' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); handleLikeToggle(post.id); }}
                                    >
                                        <Heart size={16} fill={likedPosts[post.id] ? '#ff3366' : 'none'} color={likedPosts[post.id] ? '#ff3366' : '#fff'} />
                                    </button>
                                    <button
                                        className="masonry-like-btn"
                                        style={{ bottom: '48px' }}
                                        onClick={(e) => { e.stopPropagation(); setChatUserId(post.user_id); setIsChatOpen(true); }}
                                    >
                                        <MessageCircle size={16} color="#fff" />
                                    </button>
                                    <button
                                        className="masonry-like-btn"
                                        style={{ bottom: '80px' }}
                                        onClick={(e) => { e.stopPropagation(); setPostToShare(post); setIsShareOpen(true); }}
                                    >
                                        <Send size={16} color="#fff" />
                                    </button>
                                    {user && post.user_id && post.user_id !== user.id && (
                                        <div style={{ position: 'absolute', bottom: '112px', right: '8px', zIndex: 5 }}>
                                            <VoiceReaction
                                                postId={post.id}
                                                postCategory={post.category}
                                                currentUserId={user.id}
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
                                                src={post.avatar_url || 'https://i.pravatar.cc/150'}
                                                alt=""
                                                className="masonry-avatar"
                                            />
                                            <span className="masonry-username">{post.username}</span>
                                        </div>
                                        <div className="masonry-meta">
                                            <span className="masonry-likes">{likeCounts[post.id] || 0} ❤️</span>
                                            <span className="masonry-time">{getTimeAgo(post.created_at)}</span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setCommentsPostId(post.id); setIsCommentsOpen(true); }}
                                            style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            <MessageCircle size={12} /> {post.comments_count || 0}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Infinite Scroll: Load More */}
                        {hasMorePosts && (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                                <button
                                    onClick={loadMorePosts}
                                    style={{
                                        background: 'linear-gradient(45deg, #ff3366, #ff9933)',
                                        border: 'none', borderRadius: '24px',
                                        padding: '12px 32px', color: '#fff', fontWeight: 'bold',
                                        fontSize: '14px', cursor: 'pointer'
                                    }}
                                >
                                    Load More
                                </button>
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

            {user && (
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
                        setChatUserId(userId);
                        setIsChatOpen(true);
                    }}
                />
            )}

            {/* Post Detail Modal */}
            {selectedPost && (
                <div className="post-modal-backdrop post-modal-backdrop--fullscreen" onClick={() => setSelectedPost(null)}>
                    <div className="post-modal post-modal--fullscreen" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-top-bar">
                            <div className="modal-user-row">
                                <img
                                    src={selectedPost.avatar_url || 'https://i.pravatar.cc/150'}
                                    alt=""
                                    className="modal-avatar"
                                    onClick={() => { setSelectedPost(null); navigate(`/profile/${selectedPost.username}`); }}
                                />
                                <div>
                                    <span
                                        className="modal-username"
                                        onClick={() => { setSelectedPost(null); navigate(`/profile/${selectedPost.username}`); }}
                                    >
                                        {selectedPost.username}
                                    </span>
                                    <span className="modal-time">{getTimeAgo(selectedPost.created_at)}</span>
                                </div>
                            </div>
                            <button className="modal-close-btn" type="button" onClick={() => setSelectedPost(null)}>
                                <X size={22} />
                            </button>
                        </div>
                        <div className="modal-media-stage">
                            <PostMedia
                                post={selectedPost}
                                className="modal-image"
                                controls
                                playsInline
                                soundOn
                                loop={false}
                            />
                        </div>
                        <div className="modal-details modal-details--sheet">
                            {selectedPost.caption && (
                                <p className="modal-caption">{selectedPost.caption}</p>
                            )}
                            {selectedPost.attached_link && (
                                <a
                                    href={selectedPost.attached_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="modal-link"
                                >
                                    <LinkIcon size={14} /> {selectedPost.attached_link}
                                </a>
                            )}
                            <div className="modal-actions">
                                <button
                                    className={`modal-action-btn ${likedPosts[selectedPost.id] ? 'liked' : ''}`}
                                    onClick={() => handleLikeToggle(selectedPost.id)}
                                >
                                    <Heart size={22} fill={likedPosts[selectedPost.id] ? '#ff3366' : 'none'} color={likedPosts[selectedPost.id] ? '#ff3366' : '#fff'} />
                                    <span>{likeCounts[selectedPost.id] || 0}</span>
                                </button>
                                <button className="modal-action-btn" onClick={() => { setCommentsPostId(selectedPost.id); setIsCommentsOpen(true); }}>
                                    <MessageCircle size={22} />
                                    <span>{selectedPost.comments_count || 0}</span>
                                </button>
                                <button className="modal-action-btn" onClick={() => { setPostToShare(selectedPost); setIsShareOpen(true); }}>
                                    <Send size={22} />
                                </button>
                                {user && selectedPost.user_id === user.id && (
                                    <button
                                        className="modal-action-btn"
                                        style={{ color: '#ff3b30' }}
                                        onClick={async () => {
                                            if (confirm('Delete this post?')) {
                                                const ok = await deletePost(selectedPost.id);
                                                if (ok) {
                                                    setPosts(prev => prev.filter(p => p.id !== selectedPost.id));
                                                    setSelectedPost(null);
                                                }
                                            }
                                        }}
                                    >
                                        <Trash2 size={22} />
                                    </button>
                                )}
                                <button className="modal-action-btn modal-action-right">
                                    <Bookmark size={22} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Comments Sheet */}
            {user && (
                <CommentsSheet
                    isOpen={isCommentsOpen}
                    onClose={() => setIsCommentsOpen(false)}
                    postId={commentsPostId}
                    currentUser={{ id: user.id, username: user.username || 'user', avatar_url: user.avatar_url }}
                />
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
