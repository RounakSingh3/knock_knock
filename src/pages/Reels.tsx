import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Music, Play, Pause, Volume2, VolumeX, Link as LinkIcon } from 'lucide-react';
import { fetchVideoPosts, trackEngagement, type PostData, type MessageData } from '../lib/database';
import { AppContext } from '../App';
import ChatPanel from '../components/ChatPanel';
import ShareModal from '../components/ShareModal';

export interface ReelData {
    id: string | number;
    videoUrl: string;
    posterUrl: string;
    creator: string;
    creatorAvatar: string;
    caption: string;
    song: string;
    likes: number;
    comments: number;
    shares: number;
    category: string;
    css_filter?: string;
    attachedLink?: string;
}

export const REELS_DATA: ReelData[] = [
    {
        id: 1,
        videoUrl: 'https://videos.pexels.com/video-files/856029/856029-sd_640_360_30fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/856029/free-video-856029.jpg?auto=compress&w=400',
        creator: 'nature_vibes',
        creatorAvatar: 'https://i.pravatar.cc/150?img=1',
        caption: '🌅 Golden hour hits different when you\'re at the coast',
        song: 'Chill Vibes — LofiBeats',
        likes: 14200,
        comments: 387,
        shares: 1204,
        category: 'Nature',
    },
    {
        id: 2,
        videoUrl: 'https://videos.pexels.com/video-files/3015510/3015510-sd_640_360_24fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/3015510/free-video-3015510.jpg?auto=compress&w=400',
        creator: 'city_explorer',
        creatorAvatar: 'https://i.pravatar.cc/150?img=5',
        caption: '🏙️ Neon lights and late-night bites in the city that never sleeps',
        song: 'After Dark — Mr.Kitty',
        likes: 28400,
        comments: 912,
        shares: 3410,
        category: 'Travel',
    },
    {
        id: 3,
        videoUrl: 'https://videos.pexels.com/video-files/1526909/1526909-sd_640_360_25fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/1526909/free-video-1526909.jpg?auto=compress&w=400',
        creator: 'ocean_dreams',
        creatorAvatar: 'https://i.pravatar.cc/150?img=12',
        caption: '🌊 The ocean is calling and I must go 🐠',
        song: 'Ocean Eyes — Billie Eilish',
        likes: 45600,
        comments: 1230,
        shares: 5620,
        category: 'Nature',
    },
    {
        id: 4,
        videoUrl: 'https://videos.pexels.com/video-files/3571264/3571264-sd_640_360_30fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/3571264/free-video-3571264.jpg?auto=compress&w=400',
        creator: 'fitness_freak',
        creatorAvatar: 'https://i.pravatar.cc/150?img=8',
        caption: '💪 No shortcuts. Just grind. Who\'s in? 🔥',
        song: 'Stronger — Kanye West',
        likes: 19800,
        comments: 654,
        shares: 2100,
        category: 'Sports',
    },
    {
        id: 5,
        videoUrl: 'https://videos.pexels.com/video-files/2795173/2795173-sd_640_360_25fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/2795173/free-video-2795173.jpg?auto=compress&w=400',
        creator: 'foodie_fam',
        creatorAvatar: 'https://i.pravatar.cc/150?img=20',
        caption: '🍕 Wait for it… the cheese pull is insane 🤤',
        song: 'THAT\'S WHAT I WANT — Lil Nas X',
        likes: 67300,
        comments: 2100,
        shares: 8900,
        category: 'Food',
    },
    {
        id: 6,
        videoUrl: 'https://videos.pexels.com/video-files/854669/854669-sd_640_360_30fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/854669/free-video-854669.jpg?auto=compress&w=400',
        creator: 'sky_watcher',
        creatorAvatar: 'https://i.pravatar.cc/150?img=33',
        caption: '☁️ Clouds moving in time-lapse is pure therapy',
        song: 'Weightless — Marconi Union',
        likes: 32100,
        comments: 880,
        shares: 4200,
        category: 'Nature',
    },
    {
        id: 7,
        videoUrl: 'https://videos.pexels.com/video-files/4065924/4065924-sd_640_360_25fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/4065924/free-video-4065924.jpg?auto=compress&w=400',
        creator: 'dance_central',
        creatorAvatar: 'https://i.pravatar.cc/150?img=41',
        caption: '💃 Tried this trend and nailed it on the first try 🎯',
        song: 'Levitating — Dua Lipa',
        likes: 89200,
        comments: 4300,
        shares: 12400,
        category: 'Dance',
    },
    {
        id: 8,
        videoUrl: 'https://videos.pexels.com/video-files/1739010/1739010-sd_640_360_24fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/1739010/free-video-1739010.jpg?auto=compress&w=400',
        creator: 'pet_paradise',
        creatorAvatar: 'https://i.pravatar.cc/150?img=48',
        caption: '🐶 When your dog has more personality than you 😂',
        song: 'Happy — Pharrell Williams',
        likes: 112000,
        comments: 8700,
        shares: 24000,
        category: 'Animals',
    },
    {
        id: 9,
        videoUrl: 'https://videos.pexels.com/video-files/3209828/3209828-sd_640_360_25fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/3209828/free-video-3209828.jpg?auto=compress&w=400',
        creator: 'adventure_co',
        creatorAvatar: 'https://i.pravatar.cc/150?img=55',
        caption: '🏔️ Life begins at the end of your comfort zone',
        song: 'Adventure — Matthew Parker',
        likes: 53400,
        comments: 1890,
        shares: 6700,
        category: 'Travel',
    },
    {
        id: 10,
        videoUrl: 'https://videos.pexels.com/video-files/5752729/5752729-sd_640_360_30fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/5752729/free-video-5752729.jpg?auto=compress&w=400',
        creator: 'street_vibes',
        creatorAvatar: 'https://i.pravatar.cc/150?img=60',
        caption: '🎨 Street art is the voice of the city walls',
        song: 'Who Am I — Lemon Jelly',
        likes: 27800,
        comments: 740,
        shares: 3100,
        category: 'Art',
    },
    {
        id: 11,
        videoUrl: 'https://videos.pexels.com/video-files/2519660/2519660-sd_640_360_24fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/2519660/free-video-2519660.jpg?auto=compress&w=400',
        creator: 'astro_lover',
        creatorAvatar: 'https://i.pravatar.cc/150?img=65',
        caption: '🌌 The Milky Way never gets old. Who else is a night owl? 🦉',
        song: 'Starlight — Muse',
        likes: 76500,
        comments: 3200,
        shares: 9100,
        category: 'Nature',
    },
    {
        id: 12,
        videoUrl: 'https://videos.pexels.com/video-files/3571264/3571264-sd_640_360_30fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/3571264/free-video-3571264.jpg?auto=compress&w=400',
        creator: 'morning_routine',
        creatorAvatar: 'https://i.pravatar.cc/150?img=22',
        caption: '☀️ 5AM morning routine that changed my life',
        song: 'Sunrise — Norah Jones',
        likes: 41200,
        comments: 1560,
        shares: 5400,
        category: 'Lifestyle',
    },
];

export function formatCount(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
}

function postToReel(post: PostData): ReelData {
    let filter = post.css_filter;
    try {
        if (!filter || filter === 'none') {
            const url = new URL(post.image_url);
            const f = url.searchParams.get('filter');
            if (f) filter = decodeURIComponent(f);
        }
    } catch(e) {}

    return {
        id: post.id,
        videoUrl: post.image_url,
        posterUrl: post.image_url,
        creator: post.username,
        creatorAvatar: post.avatar_url || `https://i.pravatar.cc/150?u=${post.username}`,
        caption: post.caption || '',
        song: 'Original — Upload',
        likes: post.likes_count || 0,
        comments: 0,
        shares: 0,
        category: 'Uploads',
        css_filter: filter,
        attachedLink: post.attached_link,
    };
}

const Reels: React.FC = () => {
    const { user } = useContext(AppContext);
    const [reelsList, setReelsList] = useState<ReelData[]>(REELS_DATA);
    const [likedReels, setLikedReels] = useState<Set<string | number>>(new Set());
    const [mutedAll, setMutedAll] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [selectedReelIndex, setSelectedReelIndex] = useState<number | null>(null);

    const [playStates, setPlayStates] = useState<boolean[]>(REELS_DATA.map(() => true));
    const [heartBursts, setHeartBursts] = useState<{ id: number; x: number; y: number }[]>([]);
    const [progresses, setProgresses] = useState<number[]>(REELS_DATA.map(() => 0));

    // Chat and share states
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [postToShare, setPostToShare] = useState<PostData | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatUserId, setChatUserId] = useState<string | null>(null);
    const [chatRefreshKey, setChatRefreshKey] = useState(0);
    const [pendingShare, setPendingShare] = useState<{ receiverId: string; message: MessageData } | null>(null);

    // Watch time & replay tracking
    const watchStartRef = useRef<number>(0);
    const replayCountRef = useRef<Record<number, number>>({});

    useEffect(() => {
        fetchVideoPosts().then((videoPosts) => {
            const userReels = videoPosts.map(postToReel);
            const merged = [...userReels, ...REELS_DATA];
            setReelsList(merged);
            setPlayStates(merged.map(() => true));
            setProgresses(merged.map(() => 0));
        });
    }, []);

    const containerRef = useRef<HTMLDivElement>(null);
    const modalScrollRef = useRef<HTMLDivElement>(null);
    const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
    const lastTapRef = useRef<number>(0);
    const navigate = useNavigate();
    const [touchStartX, setTouchStartX] = useState<number | null>(null);

    // Auto-scroll to selected reel index when modal opens
    useEffect(() => {
        if (selectedReelIndex !== null && modalScrollRef.current) {
            const height = modalScrollRef.current.clientHeight;
            modalScrollRef.current.scrollTo(0, height * selectedReelIndex);
            setActiveIndex(selectedReelIndex);
            setTimeout(() => {
                videoRefs.current.forEach((v, idx) => {
                    if (!v) return;
                    v.muted = mutedAll;
                    if (idx === selectedReelIndex) {
                        v.play().catch(() => {});
                    }
                });
                setPlayStates(prev => { const n = [...prev]; n[selectedReelIndex] = true; return n; });
            }, 300);
        }
    }, [selectedReelIndex, mutedAll]);

    // IntersectionObserver to auto-play visible video in modal
    useEffect(() => {
        if (selectedReelIndex === null) return;
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
    }, [selectedReelIndex]);

    // Watch time tracking: when active reel changes, log watch time for the previous one
    useEffect(() => {
        if (!user) return;
        // Log watch time for previously active reel
        if (watchStartRef.current > 0) {
            const watchDuration = (Date.now() - watchStartRef.current) / 1000; // seconds
            const prevReel = reelsList[activeIndex];
            if (prevReel && typeof prevReel.id === 'string') {
                trackEngagement(user.id, prevReel.id, 'watch_time', watchDuration, prevReel.category || 'General');
            }
        }
        watchStartRef.current = Date.now();
    }, [activeIndex]);

    // Replay detection: listen for video 'ended' events
    useEffect(() => {
        if (selectedReelIndex === null || !user) return;
        const handlers: (() => void)[] = [];
        videoRefs.current.forEach((video, idx) => {
            if (!video) return;
            const handler = () => {
                const reel = reelsList[idx];
                if (reel && typeof reel.id === 'string') {
                    replayCountRef.current[idx] = (replayCountRef.current[idx] || 0) + 1;
                    if (replayCountRef.current[idx] >= 2) {
                        trackEngagement(user.id, reel.id, 'replay', replayCountRef.current[idx], reel.category || 'General');
                    }
                }
            };
            video.addEventListener('ended', handler);
            handlers.push(() => video.removeEventListener('ended', handler));
        });
        return () => handlers.forEach(h => h());
    }, [selectedReelIndex, reelsList]);

    // Progress bar updater
    useEffect(() => {
        if (selectedReelIndex === null) return;
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
    }, [selectedReelIndex]);

    const togglePlay = useCallback(
        (idx: number) => {
            const video = videoRefs.current[idx];
            if (!video) return;
            if (video.paused) {
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
        },
        []
    );

    const handleDoubleTap = useCallback(
        (idx: number, e: React.MouseEvent | React.TouchEvent) => {
            const now = Date.now();
            if (now - lastTapRef.current < 300) {
                // Double tap — like
                setLikedReels((prev) => {
                    const next = new Set(prev);
                    next.add(reelsList[idx].id);
                    return next;
                });
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const clientX = 'touches' in e ? e.touches[0]?.clientX ?? rect.width / 2 : (e as React.MouseEvent).clientX;
                const clientY = 'touches' in e ? e.touches[0]?.clientY ?? rect.height / 2 : (e as React.MouseEvent).clientY;
                const burstId = Date.now();
                setHeartBursts((prev) => [...prev, { id: burstId, x: clientX - rect.left, y: clientY - rect.top }]);
                setTimeout(() => setHeartBursts((prev) => prev.filter((h) => h.id !== burstId)), 900);
            } else {
                // Single tap — toggle play
                togglePlay(idx);
            }
            lastTapRef.current = now;
        },
        [togglePlay, reelsList]
    );

    const toggleLike = useCallback((reelId: string | number) => {
        setLikedReels((prev) => {
            const next = new Set(prev);
            if (next.has(reelId)) next.delete(reelId);
            else next.add(reelId);
            return next;
        });
    }, []);

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStartX(e.changedTouches[0].screenX);
    };

    const handleTouchEnd = (reel: ReelData, e: React.TouchEvent) => {
        if (touchStartX === null) return;
        const touchEndX = e.changedTouches[0].screenX;
        const diffX = touchEndX - touchStartX;

        if (Math.abs(diffX) > 60) {
            if (diffX > 0) {
                // Swipe Right -> Profile
                navigate(`/profile/${reel.creator}`);
            } else {
                // Swipe Left -> Link
                if (reel.attachedLink) {
                    window.open(reel.attachedLink, '_blank', 'noopener,noreferrer');
                }
            }
        }
        setTouchStartX(null);
    };

    const closePlayer = () => {
        // Pause all videos when returning to grid
        videoRefs.current.forEach(v => v?.pause());
        setSelectedReelIndex(null);
    };

    return (
        <div className="explore-page pb-20" ref={containerRef} style={{ background: 'var(--bg-color)' }}>
            {/* Header & Create Story Area */}
            <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h1 className="font-bold text-2xl">Reels</h1>
                <button 
                    onClick={() => navigate('/create')}
                    style={{
                        background: 'linear-gradient(45deg, #ff3366, #ff9933)',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '8px 16px',
                        color: 'var(--text-active)',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(255, 51, 102, 0.3)'
                    }}
                >
                    + Create Post
                </button>
            </div>

            {/* Grid View */}
            <div className="explore-grid">
                {reelsList.map((reel, idx) => (
                    <div 
                        key={reel.id} 
                        className="explore-item" 
                        onClick={() => setSelectedReelIndex(idx)}
                        style={{ cursor: 'pointer', position: 'relative' }}
                    >
                        <img src={reel.posterUrl} alt={reel.caption || 'Reel'} loading="lazy" />
                        <div style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            color: 'var(--text-active)',
                            textShadow: '0 1px 3px rgba(0,0,0,0.8)'
                        }}>
                            <Play size={16} fill="var(--text-active)" />
                        </div>
                        <div style={{
                            position: 'absolute',
                            bottom: 8,
                            left: 8,
                            color: 'var(--text-active)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            textShadow: '0 1px 3px rgba(0,0,0,0.8)'
                        }}>
                            <Heart size={12} fill="var(--text-active)" stroke="none" />
                            {formatCount(reel.likes)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Full-Screen Player */}
            {selectedReelIndex !== null && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    background: 'var(--bg-color)'
                }}>
                    {/* Modal Controls */}
                    <div style={{
                        position: 'absolute',
                        top: 40,
                        left: 20,
                        right: 20,
                        zIndex: 10000,
                        display: 'flex',
                        justifyContent: 'space-between',
                        pointerEvents: 'none'
                    }}>
                        <button 
                            onClick={closePlayer}
                            style={{ 
                                background: 'rgba(0,0,0,0.5)', border: 'none', color: 'var(--text-active)', 
                                padding: '10px 16px', borderRadius: '20px', pointerEvents: 'auto',
                                backdropFilter: 'blur(10px)', fontSize: '0.9rem', fontWeight: 600
                            }}
                        >
                            ← Back to grid
                        </button>
                        <button
                            onClick={() => {
                                setMutedAll((m) => !m);
                                videoRefs.current.forEach((v) => {
                                    if (v) v.muted = !mutedAll;
                                });
                            }}
                            style={{ 
                                background: 'rgba(0,0,0,0.5)', border: 'none', color: 'var(--text-active)', 
                                width: '40px', height: '40px', borderRadius: '50%', pointerEvents: 'auto',
                                backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            {mutedAll ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                    </div>

                    {/* Scrollable Player */}
                    <div className="reels-page" ref={modalScrollRef} style={{ height: '100%', overflowY: 'scroll' }}>
                        {reelsList.map((reel, idx) => {
                            const isLiked = likedReels.has(reel.id);
                            const isActiveReel = Math.abs(idx - activeIndex) <= 1; // Only render adjacent reels for performance
                            
                            return (
                                <div 
                                    className="reel-card" 
                                    key={reel.id}
                                    onTouchStart={handleTouchStart}
                                    onTouchEnd={(e) => handleTouchEnd(reel, e)}
                                >
                                    {isActiveReel ? (
                                        <video
                                            ref={(el) => (videoRefs.current[idx] = el)}
                                            src={reel.videoUrl}
                                            loop
                                            playsInline
                                            autoPlay={idx === selectedReelIndex}
                                            muted={mutedAll}
                                            className="reel-video"
                                            style={{ filter: reel.css_filter || 'none' }}
                                            onClick={(e) => handleDoubleTap(idx, e)}
                                        />
                                    ) : (
                                        <div style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundColor: '#000' }}>
                                            <img src={reel.posterUrl} alt="Poster" className="reel-video" style={{ opacity: 0.3, filter: reel.css_filter || 'none' }} />
                                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }} />
                                        </div>
                                    )}

                                    {/* Link Indicator */}
                                    {reel.attachedLink && (
                                        <div style={{ position: 'absolute', top: 100, right: 20, zIndex: 10, background: 'rgba(0,0,0,0.6)', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                                            <LinkIcon size={20} color="var(--text-active)" />
                                        </div>
                                    )}

                                    {/* Heart burst animation */}
                                    {heartBursts.map((h) => (
                                        <div
                                            key={h.id}
                                            className="heart-burst"
                                            style={{ left: h.x, top: h.y }}
                                        >
                                            <Heart size={80} fill="#ff3366" stroke="none" />
                                        </div>
                                    ))}

                                    {/* Pause indicator */}
                                    {!playStates[idx] && (
                                        <div className="reel-pause-indicator">
                                            <Play size={54} fill="var(--text-active)" stroke="none" />
                                        </div>
                                    )}

                                    {/* Bottom gradient overlay */}
                                    <div className="reel-gradient-bottom" />

                                    {/* Creator info & caption */}
                                    <div className="reel-info" style={{ paddingBottom: '30px' }}>
                                        <div className="reel-creator">
                                            <img
                                                src={reel.creatorAvatar}
                                                alt={reel.creator}
                                                className="reel-creator-avatar"
                                            />
                                            <span className="reel-creator-name">@{reel.creator}</span>
                                            <button className="reel-follow-btn">Friend</button>
                                        </div>
                                        <p className="reel-caption">{reel.caption}</p>
                                        <div className="reel-song">
                                            <Music size={12} />
                                            <span className="reel-song-marquee">{reel.song}</span>
                                        </div>
                                    </div>

                                    {/* Side actions */}
                                    <div className="reel-actions" style={{ paddingBottom: '30px' }}>
                                        <button
                                            className={`reel-action-btn ${isLiked ? 'liked' : ''}`}
                                            onClick={() => toggleLike(reel.id)}
                                        >
                                            <Heart
                                                size={28}
                                                fill={isLiked ? '#ff3366' : 'none'}
                                                stroke={isLiked ? '#ff3366' : 'var(--text-active)'}
                                            />
                                            <span>{formatCount(reel.likes + (isLiked ? 1 : 0))}</span>
                                        </button>
                                        <button className="reel-action-btn">
                                            <MessageCircle size={28} />
                                            <span>{formatCount(reel.comments)}</span>
                                        </button>
                                        <button 
                                            className="reel-action-btn"
                                            onClick={() => {
                                                const mappedPost: PostData = {
                                                    id: String(reel.id),
                                                    user_id: '',
                                                    image_url: reel.videoUrl || reel.posterUrl,
                                                    caption: reel.caption,
                                                    media_type: 'video',
                                                    attached_link: reel.attachedLink,
                                                    created_at: new Date().toISOString(),
                                                    likes_count: reel.likes,
                                                    comments_count: reel.comments,
                                                    shares_count: reel.shares,
                                                    username: reel.creator,
                                                    avatar_url: reel.creatorAvatar
                                                };
                                                setPostToShare(mappedPost);
                                                setIsShareOpen(true);
                                            }}
                                        >
                                            <Share2 size={28} />
                                            <span>{formatCount(reel.shares)}</span>
                                        </button>
                                        <div className="reel-disc">
                                            <img src={reel.creatorAvatar} alt="" />
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="reel-progress-bar">
                                        <div
                                            className="reel-progress-fill"
                                            style={{ width: `${progresses[idx]}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
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
        </div>
    );
};

export default Reels;
