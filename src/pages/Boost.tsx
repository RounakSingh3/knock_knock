import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Rocket, PlusCircle, Music } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { fetchActiveBoostedPosts, fetchUserEngagements, boostPost, type PostData, fetchUserPosts, trackEngagement, type MessageData } from '../lib/database';
import { buildInterestProfile, assembleFeed } from '../lib/algorithm';
import { isVideoPost } from '../lib/media';
import { PostModalContent } from '../components/PostModal';
import CommentsSheet from '../components/CommentsSheet';
import ShareModal from '../components/ShareModal';
import ChatPanel from '../components/ChatPanel';


const Boost: React.FC = () => {
    const { user, points, setPoints } = useContext(AppContext);
    const navigate = useNavigate();
    const location = useLocation();
    
    const params = new URLSearchParams(location.search);
    const initialMode = params.get('mode') === 'select' ? 'select' : 'feed';
    const [mode, setMode] = useState<'feed' | 'select'>(initialMode);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const m = queryParams.get('mode');
        if (m === 'select' || m === 'feed') {
            setMode(m);
        }
    }, [location.search]);
    
    // Feed Mode State
    const [boostedPosts, setBoostedPosts] = useState<PostData[]>([]);
    const [isLoadingFeed, setIsLoadingFeed] = useState(true);
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [postToShare, setPostToShare] = useState<PostData | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatUserId, setChatUserId] = useState<string | null>(null);
    const [chatRefreshKey, setChatRefreshKey] = useState(0);
    const [pendingShare, setPendingShare] = useState<{ receiverId: string; message: MessageData } | null>(null);
    
    // Select Mode State
    const [userPosts, setUserPosts] = useState<PostData[]>([]);
    const [isLoadingPosts, setIsLoadingPosts] = useState(false);
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeBoostPostId, setActiveBoostPostId] = useState<string | null>(boostedPosts[0]?.id || null);
    const watchTimers = useRef<Record<string, number>>({});
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        if (!user || mode !== 'feed') return;
        
        const loadFeed = async () => {
            setIsLoadingFeed(true);
            const activePosts = await fetchActiveBoostedPosts();
            const engagements = await fetchUserEngagements(user.id);
            const interestProfile = buildInterestProfile(engagements);
            
            // Score and sort active boosted posts
            const scored = assembleFeed(activePosts, interestProfile, 0, 100);
            setBoostedPosts(scored.map(s => s.post));
            setIsLoadingFeed(false);
        };
        
        loadFeed();
    }, [user, mode]);

    // Tracking observer for the feed
    useEffect(() => {
        if (!user || !scrollRef.current || mode !== 'feed' || boostedPosts.length === 0) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const postId = entry.target.getAttribute('data-postid');
                const category = entry.target.getAttribute('data-category') || 'General';
                if (!postId) return;

                if (entry.isIntersecting) {
                    watchTimers.current[postId] = Date.now();
                    trackEngagement(user.id, postId, 'view', 1, category).catch(() => {});
                    setActiveBoostPostId(postId);
                    // Note: Here we'd also decrement boost_impressions_remaining in a production setting
                } else {
                    const startTime = watchTimers.current[postId];
                    if (startTime) {
                        const durationSeconds = (Date.now() - startTime) / 1000;
                        if (durationSeconds > 0.5) {
                            trackEngagement(user.id, postId, 'watch_time', durationSeconds, category).catch(() => {});
                        }
                        delete watchTimers.current[postId];
                    }
                }
            });
        }, {
            root: scrollRef.current,
            threshold: 0.6
        });

        Object.values(itemRefs.current).forEach(el => {
            if (el) observer.observe(el);
        });

        return () => {
            observer.disconnect();
        };
    }, [user, mode, boostedPosts]);

    const handleSwitchToSelect = async () => {
        setMode('select');
        if (user && userPosts.length === 0) {
            setIsLoadingPosts(true);
            const posts = await fetchUserPosts(user.username);
            setUserPosts(posts);
            setIsLoadingPosts(false);
        }
    };

    const handleBoostPost = async (post: PostData) => {
        if (!user) return;
        
        const amountStr = prompt(`You have ${points} points. How many points do you want to spend? (1 point = 1 view)`, '100');
        if (!amountStr) return;
        
        const amount = parseInt(amountStr, 10);
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount.');
            return;
        }
        
        if (points < amount) {
            alert(`You don't have enough points. You only have ${points} points.`);
            return;
        }
        
        if (confirm(`Spend ${amount} points to boost this post for 24 hours?`)) {
            const success = await boostPost(post.id, user.id as string, points, amount);
            if (success) {
                setPoints(prev => prev - amount);
                alert('Post boosted successfully!');
                setMode('feed');
            } else {
                alert('Failed to boost post. Please try again.');
            }
        }
    };

    return (
        <div style={{ background: 'var(--bg-color)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--surface-color)', zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-active)' }}>
                    <Rocket size={24} color="#f5a524" />
                    <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Boost</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: '#ffcc00', fontWeight: 'bold' }}>{points || 0} pts</span>
                    {mode === 'feed' ? (
                        <button 
                            onClick={handleSwitchToSelect}
                            style={{ background: 'linear-gradient(45deg, #f5a524, #ff6b35)', border: 'none', borderRadius: '20px', padding: '6px 12px', color: 'var(--text-active)', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <PlusCircle size={14} /> Boost
                        </button>
                    ) : (
                        <button 
                            onClick={() => setMode('feed')}
                            style={{ background: 'var(--border-color)', border: 'none', borderRadius: '20px', padding: '6px 12px', color: 'var(--text-active)', fontSize: '12px', fontWeight: 'bold' }}
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            {mode === 'feed' ? (
                <div 
                    ref={scrollRef}
                    style={{ flex: 1, overflowY: 'auto', scrollSnapType: 'y mandatory', scrollBehavior: 'auto' }}
                >
                    {isLoadingFeed ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-inactive)' }} />
                        </div>
                    ) : boostedPosts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-inactive)' }}>
                            <Rocket size={48} style={{ margin: '0 auto', marginBottom: '16px', opacity: 0.5 }} />
                            <p>No active boosted posts right now.</p>
                            <p style={{ fontSize: '13px', marginTop: '8px' }}>Be the first to boost a post!</p>
                        </div>
                    ) : (
                        boostedPosts.map((post) => (
                            <div 
                                key={post.id} 
                                ref={el => { itemRefs.current[post.id] = el; }} 
                                data-postid={post.id}
                                data-category={post.category || 'General'}
                                style={{ height: 'calc(100vh - 120px)', scrollSnapAlign: 'start', width: '100%', position: 'relative' }}
                            >
                                <PostModalContent 
                                    post={post} 
                                    onClose={() => {}} 
                                    onCommentClick={(postId) => { setCommentsPostId(postId); setIsCommentsOpen(true); }} 
                                    onShareClick={(post) => { setPostToShare(post); setIsShareOpen(true); }} 
                                    isEmbedded={true}
                                    isActive={post.id === activeBoostPostId}
                                />
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div style={{ padding: '16px', paddingBottom: '80px', flex: 1, overflowY: 'auto' }}>
                    <h2 style={{ color: 'var(--text-active)', fontSize: '18px', marginBottom: '16px' }}>Select a post to boost</h2>
                    <p style={{ color: 'var(--text-inactive)', fontSize: '14px', marginBottom: '24px' }}>
                        Boosting a post puts it in the Boost feed for 24 hours. You can choose how many points to spend to guarantee targeted views!
                    </p>
                    
                    <button 
                        onClick={() => navigate('/create?redirect=boost')}
                        style={{ 
                            width: '100%', 
                            background: 'rgba(245, 165, 36, 0.1)', 
                            border: '1.5px dashed #f5a524', 
                            borderRadius: '12px', 
                            padding: '14px', 
                            color: '#f5a524', 
                            fontSize: '14px', 
                            fontWeight: 'bold', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '8px', 
                            cursor: 'pointer',
                            marginBottom: '20px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <PlusCircle size={18} /> Upload New Photo or Video
                    </button>
                    
                    {isLoadingPosts ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-inactive)' }} />
                        </div>
                    ) : userPosts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-inactive)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                            <p style={{ margin: 0 }}>You haven't posted anything yet.</p>
                            <button 
                                onClick={() => navigate('/create?redirect=boost')}
                                style={{ 
                                    background: 'linear-gradient(45deg, #f5a524, #ff6b35)', 
                                    border: 'none', 
                                    borderRadius: '24px', 
                                    padding: '10px 24px', 
                                    color: '#fff', 
                                    fontSize: '14px', 
                                    fontWeight: 'bold', 
                                    cursor: 'pointer' 
                                }}
                            >
                                Upload Photo / Video
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {userPosts.map(post => {
                                let filter = post.css_filter || 'none';
                                try {
                                    if (filter === 'none') {
                                        const url = new URL(post.image_url);
                                        const f = url.searchParams.get('filter');
                                        if (f) filter = decodeURIComponent(f);
                                    }
                                } catch(e) {}
                                return (
                                <div 
                                    key={post.id} 
                                    onClick={() => handleBoostPost(post)}
                                    style={{ aspectRatio: '1', position: 'relative', cursor: 'pointer', background: 'var(--border-color)' }}
                                >
                                    {isVideoPost(post) ? (
                                        <video src={post.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover', filter }} muted playsInline preload="metadata" />
                                    ) : (
                                        <img 
                                            src={post.image_url} 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', filter }} 
                                            alt="" 
                                            referrerPolicy="no-referrer"
                                            onError={(e) => {
                                                e.currentTarget.onerror = null;
                                                e.currentTarget.src = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80';
                                            }}
                                        />
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
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                                        <span style={{ color: 'var(--text-active)', fontWeight: 'bold', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>Boost</span>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>
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

export default Boost;
