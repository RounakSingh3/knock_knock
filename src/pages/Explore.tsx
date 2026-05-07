import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Film, Grid3X3, Star, Heart, MessageCircle, Share2, Music, Play, Volume2, VolumeX, Link as LinkIcon } from 'lucide-react';
import { fetchExplorePosts, type PostData } from '../lib/database';
import { REELS_DATA, formatCount, type ReelData } from './Reels';

const Explore = () => {
    const navigate = useNavigate();
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'foryou' | 'videos'>('foryou');

    // ── Swiper States (for videos tab) ──
    const [likedReels, setLikedReels] = useState<Set<number>>(new Set());
    const [mutedAll, setMutedAll] = useState(true);
    const [activeIndex, setActiveIndex] = useState(0);
    const [playStates, setPlayStates] = useState<boolean[]>(REELS_DATA.map(() => true));
    const [heartBursts, setHeartBursts] = useState<{ id: number; x: number; y: number }[]>([]);
    const [progresses, setProgresses] = useState<number[]>(REELS_DATA.map(() => 0));
    const [touchStartX, setTouchStartX] = useState<number | null>(null);

    const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
    const lastTapRef = useRef<number>(0);

    useEffect(() => {
        fetchExplorePosts().then(data => {
            setPosts(data);
            setLoading(false);
        });
    }, []);

    // IntersectionObserver to auto-play visible video in Swiper
    useEffect(() => {
        if (activeTab !== 'videos') return;
        const observers: IntersectionObserver[] = [];
        videoRefs.current.forEach((video, idx) => {
            if (!video) return;
            const obs = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            setActiveIndex(idx);
                            video.play().catch(() => { });
                            setPlayStates((prev) => {
                                const next = [...prev];
                                next[idx] = true;
                                return next;
                            });
                        } else {
                            video.pause();
                            setPlayStates((prev) => {
                                const next = [...prev];
                                next[idx] = false;
                                return next;
                            });
                        }
                    });
                },
                { threshold: 0.6 }
            );
            obs.observe(video);
            observers.push(obs);
        });
        return () => observers.forEach((o) => o.disconnect());
    }, [activeTab]);

    // Progress bar updater
    useEffect(() => {
        if (activeTab !== 'videos') return;
        const interval = setInterval(() => {
            videoRefs.current.forEach((video, idx) => {
                if (video && video.duration) {
                    setProgresses((prev) => {
                        const next = [...prev];
                        next[idx] = (video.currentTime / video.duration) * 100;
                        return next;
                    });
                }
            });
        }, 200);
        return () => clearInterval(interval);
    }, [activeTab]);

    const togglePlay = useCallback((idx: number) => {
        const video = videoRefs.current[idx];
        if (!video) return;
        if (video.paused) {
            video.play().catch(() => { });
            setPlayStates((prev) => { const next = [...prev]; next[idx] = true; return next; });
        } else {
            video.pause();
            setPlayStates((prev) => { const next = [...prev]; next[idx] = false; return next; });
        }
    }, []);

    const handleDoubleTap = useCallback((idx: number, e: React.MouseEvent | React.TouchEvent) => {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
            // Like on double tap
            setLikedReels((prev) => { const next = new Set(prev); next.add(REELS_DATA[idx].id); return next; });
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const clientX = 'touches' in e ? e.touches[0]?.clientX ?? rect.width / 2 : (e as React.MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0]?.clientY ?? rect.height / 2 : (e as React.MouseEvent).clientY;
            const burstId = Date.now();
            setHeartBursts((prev) => [...prev, { id: burstId, x: clientX - rect.left, y: clientY - rect.top }]);
            setTimeout(() => setHeartBursts((prev) => prev.filter((h) => h.id !== burstId)), 900);
        } else {
            togglePlay(idx);
        }
        lastTapRef.current = now;
    }, [togglePlay]);

    const toggleLike = useCallback((reelId: number) => {
        setLikedReels((prev) => {
            const next = new Set(prev);
            if (next.has(reelId)) next.delete(reelId);
            else next.add(reelId);
            return next;
        });
    }, []);

    const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.changedTouches[0].screenX);
    const handleTouchEnd = (reel: ReelData, e: React.TouchEvent) => {
        if (touchStartX === null) return;
        const diffX = e.changedTouches[0].screenX - touchStartX;
        if (Math.abs(diffX) > 60) {
            if (diffX > 0) navigate(`/profile/${reel.creator}`);
            else if (reel.attachedLink) window.open(reel.attachedLink, '_blank', 'noopener,noreferrer');
        }
        setTouchStartX(null);
    };

    const handleTabChange = (tab: 'foryou' | 'videos') => {
        if (tab === 'foryou') {
            // Pause all videos when exiting videos tab
            videoRefs.current.forEach(v => v?.pause());
        }
        setActiveTab(tab);
    };

    // Filter by search (For You grid)
    const searchFiltered = searchTerm
        ? posts.filter(p =>
            p.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.caption && p.caption.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        : posts;

    const fallbackImages = Array.from({ length: 18 }).map((_, i) =>
        `https://images.unsplash.com/photo-${1600000000000 + i * 50000}?w=400&q=80`
    );

    // If 'videos' tab is active, we render a completely different full screen layout (like old reels)
    if (activeTab === 'videos') {
        return (
            <div className="reels-page">
                {/* Fixed Overlay Buttons */}
                <div style={{ position: 'absolute', top: 20, width: '100%', zIndex: 50, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div className="explore-tabs" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'auto' }}>
                        <button className="explore-tab" onClick={() => handleTabChange('foryou')}>
                            <Grid3X3 size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />For You
                        </button>
                        <button className="explore-tab active">
                            <Film size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Videos
                        </button>
                    </div>
                </div>

                <button
                    className="reels-mute-btn"
                    onClick={() => {
                        setMutedAll((m) => !m);
                        videoRefs.current.forEach((v) => { if (v) v.muted = !mutedAll; });
                    }}
                    style={{ zIndex: 60 }}
                >
                    {mutedAll ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>

                {REELS_DATA.map((reel, idx) => {
                    const isLiked = likedReels.has(reel.id);
                    return (
                        <div 
                            className="reel-card" 
                            key={reel.id}
                            onTouchStart={handleTouchStart}
                            onTouchEnd={(e) => handleTouchEnd(reel, e)}
                        >
                            <video
                                ref={(el) => { videoRefs.current[idx] = el; }}
                                className="reel-video"
                                src={reel.videoUrl}
                                poster={reel.posterUrl}
                                loop
                                muted={mutedAll}
                                playsInline
                                preload="metadata"
                                onClick={(e) => handleDoubleTap(idx, e)}
                            />

                            {reel.attachedLink && (
                                <div style={{ position: 'absolute', top: 90, right: 20, zIndex: 10, background: 'rgba(0,0,0,0.6)', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                                    <LinkIcon size={20} color="#fff" />
                                </div>
                            )}

                            {heartBursts.map((h) => (
                                <div key={h.id} className="heart-burst" style={{ left: h.x, top: h.y }}>
                                    <Heart size={80} fill="#ff3366" stroke="none" />
                                </div>
                            ))}

                            {!playStates[idx] && (
                                <div className="reel-pause-indicator">
                                    <Play size={54} fill="white" stroke="none" />
                                </div>
                            )}

                            <div className="reel-gradient-bottom" />

                            <div className="reel-info">
                                <div className="reel-creator">
                                    <img src={reel.creatorAvatar} alt={reel.creator} className="reel-creator-avatar" />
                                    <span className="reel-creator-name">@{reel.creator}</span>
                                    <button className="reel-follow-btn">Follow</button>
                                </div>
                                <p className="reel-caption">{reel.caption}</p>
                                <div className="reel-song">
                                    <Music size={12} />
                                    <span className="reel-song-marquee">{reel.song}</span>
                                </div>
                            </div>

                            <div className="reel-actions">
                                <button className={`reel-action-btn ${isLiked ? 'liked' : ''}`} onClick={() => toggleLike(reel.id)}>
                                    <Heart size={28} fill={isLiked ? '#ff3366' : 'none'} stroke={isLiked ? '#ff3366' : 'white'} />
                                    <span>{formatCount(reel.likes + (isLiked ? 1 : 0))}</span>
                                </button>
                                <button className="reel-action-btn">
                                    <MessageCircle size={28} />
                                    <span>{formatCount(reel.comments)}</span>
                                </button>
                                <button className="reel-action-btn">
                                    <Share2 size={28} />
                                    <span>{formatCount(reel.shares)}</span>
                                </button>
                                <div className="reel-disc">
                                    <img src={reel.creatorAvatar} alt="" />
                                </div>
                            </div>

                            <div className="reel-progress-bar">
                                <div className="reel-progress-fill" style={{ width: `${progresses[idx]}%` }} />
                            </div>

                            <div className="reel-category-badge">{reel.category}</div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // ── Grid View (For You Tab) ──
    return (
        <div className="explore-page pb-20">
            <div style={{ display: 'flex', gap: '8px', padding: '0 12px 16px', alignItems: 'center' }}>
                <div className="search-bar" style={{ flex: 1, margin: 0 }}>
                    <Search size={20} color="#8e8e93" />
                    <input
                        type="text"
                        placeholder="Search for people or posts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button style={{ 
                    background: 'var(--surface-color)', 
                    border: 'none', 
                    borderRadius: '12px', 
                    padding: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    cursor: 'pointer'
                }}>
                    <Star size={24} color="#facc15" />
                </button>
            </div>

            {/* Tabs */}
            <div className="explore-tabs">
                <button 
                    className="explore-tab active"
                    onClick={() => handleTabChange('foryou')}
                >
                    <Grid3X3 size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    For You
                </button>
                <button 
                    className="explore-tab" 
                    onClick={() => handleTabChange('videos')}
                >
                    <Film size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    Videos
                </button>
            </div>

            <div className="explore-grid">
                {loading ? (
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#8e8e93' }} />
                    </div>
                ) : searchFiltered.length > 0 ? (
                    searchFiltered.map((post) => (
                        <div key={post.id} className="explore-item" style={{ position: 'relative' }}>
                            <img src={post.image_url} alt={post.caption || 'Explore'} loading="lazy" />
                        </div>
                    ))
                ) : (
                    // Fallback to generated images
                    fallbackImages.map((img, i) => (
                        <div key={i} className="explore-item" style={{ position: 'relative' }}>
                            <img src={img} alt={`Explore ${i}`} loading="lazy" />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Explore;
