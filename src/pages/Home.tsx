import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { fetchPosts, type PostData } from '../lib/database';
import { checkIfLiked, toggleLike } from '../lib/database';
import { Loader2, Plus, Heart, MessageCircle, Send, Bookmark, X, Link as LinkIcon, LogOut, Sparkles } from 'lucide-react';

const Home = () => {
    const { signOut, user } = useContext(AppContext);
    const navigate = useNavigate();
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
    const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
    const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        fetchPosts()
            .then(data => {
                setPosts(data);
                setLoading(false);
                // Initialize like counts
                const counts: Record<string, number> = {};
                data.forEach(p => { counts[p.id] = p.likes_count; });
                setLikeCounts(counts);
                // Check liked status for each post
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

    return (
        <div className="home-page-v2">
            {/* Redesigned Header */}
            <header className="home-header-v2">
                <div className="header-left-v2">
                    <div className="header-greeting">
                        <Sparkles size={18} className="greeting-icon" />
                        <span className="greeting-text">
                            Hey, <strong>{user?.username || 'there'}</strong>
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
                                {/* Gradient overlay */}
                                <div className="masonry-card-overlay" />
                                {/* Like badge */}
                                <button
                                    className={`masonry-like-btn ${likedPosts[post.id] ? 'liked' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); handleLikeToggle(post.id); }}
                                >
                                    <Heart size={16} fill={likedPosts[post.id] ? '#ff3366' : 'none'} color={likedPosts[post.id] ? '#ff3366' : '#fff'} />
                                </button>
                                {/* Attached link icon */}
                                {post.attached_link && (
                                    <div className="masonry-link-badge">
                                        <LinkIcon size={12} />
                                    </div>
                                )}
                                {/* Bottom info */}
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

            {/* Floating Action Button */}
            <button className="fab-create" onClick={() => navigate('/create')}>
                <Plus size={28} />
            </button>

            {/* Detail Modal */}
            {selectedPost && (
                <div className="post-modal-backdrop" onClick={() => setSelectedPost(null)}>
                    <div className="post-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setSelectedPost(null)}>
                            <X size={22} />
                        </button>
                        {/* Image */}
                        <div className="modal-image-wrap">
                            <img src={selectedPost.image_url} alt="" className="modal-image" />
                        </div>
                        {/* Details */}
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
