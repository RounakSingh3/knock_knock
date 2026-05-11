import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { fetchPosts, fetchRecentStories, type PostData, type StoryData } from '../lib/database';
import { checkIfLiked, toggleLike } from '../lib/database';
import { Loader2, Plus, Heart, MessageCircle, Send, Bookmark, X, Link as LinkIcon, LogOut, Sparkles, ChevronLeft, ChevronRight, Flame } from 'lucide-react';

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

    useEffect(() => {
        fetchPosts()
            .then(data => {
                setPosts(data);
                setLoading(false);
                const counts: Record<string, number> = {};
                data.forEach(p => { counts[p.id] = p.likes_count; });
                setLikeCounts(counts);
                if (user) {
                    data.forEach(p => {
                        checkIfLiked(user.id, p.id).then(liked => {
                            setLikedPosts(prev => ({ ...prev, [p.id]: liked }));
                        });
                    });
                }
            })
            .catch(err => {
                console.error('Failed to fetch posts:', err);
                setError('Failed to load posts. Please check your connection and try again.');
                setLoading(false);
            });

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
    }, []);

    const handleLikeToggle = async (postId: string) => {
        if (!user) return;
        const currentlyLiked = likedPosts[postId] || false;
        const newLiked = !currentlyLiked;
        setLikedPosts(prev => ({ ...prev, [postId]: newLiked }));
        setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + (newLiked ? 1 : -1) }));
        await toggleLike(user.id, postId, currentlyLiked);
    };

    const handleDoubleTap = (post: PostData) => {
        if (!likedPosts[post.id]) {
            handleLikeToggle(post.id);
        }
    };

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
            {/* Header */}
            <header className="home-header-v2">
                <div className="header-left-v2">
                    <div className="header-greeting">
                        <Sparkles size={18} className="greeting-icon" />
                        <span className="greeting-text">
                            Hey, <strong>{user?.username || (user as any)?.name || 'there'}</strong>
                        </span>
                    </div>
                    <p className="header-subtitle">Discover what's new ✨</p>
                </div>
                <div className="header-right-v2">
                    <button onClick={signOut} className="signout-btn-v2" title="Sign Out">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* ── Story Rack ── */}
            {(storyGroups.length > 0 || user) && (
                <div className="story-rack-v2">
                    {/* Your Story CTA */}
                    <div className="story-rack-item" onClick={() => navigate('/stories')}>
                        <div className="story-ring-v2 story-ring-add">
                            <img
                                src={user?.avatar_url || 'https://i.pravatar.cc/150'}
                                alt=""
                            />
                            <div className="story-add-icon">
                                <Plus size={14} />
                            </div>
                        </div>
                        <span className="story-rack-name">Your Story</span>
                    </div>

                    {/* Other users' stories */}
                    {storyGroups
                        .filter(g => g.userId !== user?.id)
                        .map(group => (
                            <div
                                key={group.userId}
                                className="story-rack-item"
                                onClick={() => openStoryViewer(group)}
                            >
                                <div className="story-ring-v2">
                                    <img
                                        src={group.avatarUrl}
                                        alt={group.username}
                                    />
                                </div>
                                <span className="story-rack-name">{group.username}</span>
                            </div>
                        ))}
                </div>
            )}

            {/* Content */}
            <div className="masonry-feed-wrapper">
                {error ? (
                    <div className="feed-state-msg">
                        <p style={{ color: '#ff3b30' }}>{error}</p>
                        <button
                            className="retry-btn-v2"
                            onClick={() => {
                                setError(''); setLoading(true);
                                fetchPosts().then(data => { setPosts(data); setLoading(false); }).catch(() => { setError('Failed to load posts.'); setLoading(false); });
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
                    <div className="masonry-grid">
                        {posts.map((post, index) => (
                            <div
                                key={post.id}
                                className={`masonry-card ${index % 5 === 0 ? 'masonry-card--tall' : ''}`}
                                onClick={() => setSelectedPost(post)}
                                onDoubleClick={() => handleDoubleTap(post)}
                            >
                                <img src={post.image_url} alt="" className="masonry-card-img" />
                                <div className="masonry-card-overlay" />
                                <button
                                    className={`masonry-like-btn ${likedPosts[post.id] ? 'liked' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); handleLikeToggle(post.id); }}
                                >
                                    <Heart size={16} fill={likedPosts[post.id] ? '#ff3366' : 'none'} color={likedPosts[post.id] ? '#ff3366' : '#fff'} />
                                </button>
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
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* FAB */}
            <button className="fab-create" onClick={() => navigate('/create')}>
                <Plus size={28} />
            </button>

            {/* Post Detail Modal */}
            {selectedPost && (
                <div className="post-modal-backdrop" onClick={() => setSelectedPost(null)}>
                    <div className="post-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setSelectedPost(null)}>
                            <X size={22} />
                        </button>
                        <div className="modal-image-wrap">
                            <img src={selectedPost.image_url} alt="" className="modal-image" />
                        </div>
                        <div className="modal-details">
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
                                <button className="modal-action-btn">
                                    <MessageCircle size={22} />
                                </button>
                                <button className="modal-action-btn">
                                    <Send size={22} />
                                </button>
                                <button className="modal-action-btn modal-action-right">
                                    <Bookmark size={22} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
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
