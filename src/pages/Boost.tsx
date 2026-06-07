import React, { useState, useEffect, useContext, useRef } from 'react';
import { Loader2, Rocket, PlusCircle } from 'lucide-react';
import { AppContext } from '../App';
import { fetchActiveBoostedPosts, fetchUserEngagements, boostPost, type PostData, fetchUserPosts, trackEngagement, type MessageData } from '../lib/database';
import { buildInterestProfile, assembleFeed } from '../lib/algorithm';
import { PostModalContent } from '../components/PostModal';
import CommentsSheet from '../components/CommentsSheet';
import ShareModal from '../components/ShareModal';
import ChatPanel from '../components/ChatPanel';

const Boost: React.FC = () => {
    const { user, points, setPoints } = useContext(AppContext);
    const [mode, setMode] = useState<'feed' | 'select'>('feed');
    
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
    const watchTimers = useRef<Record<string, number>>({});
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        if (!user) return;
        
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
    }, [user]);

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
        
        if (points < 100) {
            alert('You need 100 points to boost a post.');
            return;
        }
        
        if (confirm(`Spend 100 points to boost this post for 24 hours?`)) {
            const success = await boostPost(post.id, user.id as string, points);
            if (success) {
                setPoints(prev => prev - 100);
                alert('Post boosted successfully!');
                setMode('feed');
            } else {
                alert('Failed to boost post. Please try again.');
            }
        }
    };

    return (
        <div style={{ background: '#000', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#1c1c1e', zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                    <Rocket size={24} color="#ff3366" />
                    <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Spotlight</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: '#ffcc00', fontWeight: 'bold' }}>{points || 0} pts</span>
                    {mode === 'feed' ? (
                        <button 
                            onClick={handleSwitchToSelect}
                            style={{ background: 'linear-gradient(45deg, #ff3366, #ff9933)', border: 'none', borderRadius: '20px', padding: '6px 12px', color: '#fff', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <PlusCircle size={14} /> Boost
                        </button>
                    ) : (
                        <button 
                            onClick={() => setMode('feed')}
                            style={{ background: '#2c2c2e', border: 'none', borderRadius: '20px', padding: '6px 12px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
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
                            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#8e8e93' }} />
                        </div>
                    ) : boostedPosts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: '#8e8e93' }}>
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
                                />
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div style={{ padding: '16px', paddingBottom: '80px', flex: 1, overflowY: 'auto' }}>
                    <h2 style={{ color: '#fff', fontSize: '18px', marginBottom: '16px' }}>Select a post to boost</h2>
                    <p style={{ color: '#8e8e93', fontSize: '14px', marginBottom: '24px' }}>
                        Boosting a post costs 100 points. It will appear in the Spotlight feed for 24 hours, guaranteeing 100 targeted views to users interested in its category!
                    </p>
                    
                    {isLoadingPosts ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#8e8e93' }} />
                        </div>
                    ) : userPosts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: '#8e8e93' }}>
                            <p>You haven't posted anything yet.</p>
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
                                    style={{ aspectRatio: '1', position: 'relative', cursor: 'pointer', background: '#2c2c2e' }}
                                >
                                    {post.image_url.endsWith('.mp4') ? (
                                        <video src={post.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover', filter }} muted playsInline />
                                    ) : (
                                        <img src={post.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover', filter }} alt="" />
                                    )}
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                                        <span style={{ color: '#fff', fontWeight: 'bold', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>Boost</span>
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
