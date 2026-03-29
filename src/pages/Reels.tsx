import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Share2, Music, Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface ReelData {
    id: number;
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
}

const REELS_DATA: ReelData[] = [
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

function formatCount(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
}

const Reels: React.FC = () => {
    const [likedReels, setLikedReels] = useState<Set<number>>(new Set());
    const [mutedAll, setMutedAll] = useState(true);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
    const [playStates, setPlayStates] = useState<boolean[]>(REELS_DATA.map(() => true));
    const [heartBursts, setHeartBursts] = useState<{ id: number; x: number; y: number }[]>([]);
    const lastTapRef = useRef<number>(0);
    const [progresses, setProgresses] = useState<number[]>(REELS_DATA.map(() => 0));

    // IntersectionObserver to auto-play visible video
    useEffect(() => {
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
    }, []);

    // Progress bar updater
    useEffect(() => {
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
    }, []);

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
                    next.add(REELS_DATA[idx].id);
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
        [togglePlay]
    );

    const toggleLike = useCallback((reelId: number) => {
        setLikedReels((prev) => {
            const next = new Set(prev);
            if (next.has(reelId)) next.delete(reelId);
            else next.add(reelId);
            return next;
        });
    }, []);

    return (
        <div className="reels-page" ref={containerRef}>
            {/* Mute toggle */}
            <button
                className="reels-mute-btn"
                onClick={() => {
                    setMutedAll((m) => !m);
                    videoRefs.current.forEach((v) => {
                        if (v) v.muted = !mutedAll;
                    });
                }}
            >
                {mutedAll ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>

            <div className="reels-header-title">Reels</div>

            {REELS_DATA.map((reel, idx) => {
                const isLiked = likedReels.has(reel.id);
                return (
                    <div className="reel-card" key={reel.id}>
                        {/* Video */}
                        <video
                            ref={(el) => {
                                videoRefs.current[idx] = el;
                            }}
                            className="reel-video"
                            src={reel.videoUrl}
                            poster={reel.posterUrl}
                            loop
                            muted={mutedAll}
                            playsInline
                            preload="metadata"
                            onClick={(e) => handleDoubleTap(idx, e)}
                        />

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
                                <Play size={54} fill="white" stroke="none" />
                            </div>
                        )}

                        {/* Bottom gradient overlay */}
                        <div className="reel-gradient-bottom" />

                        {/* Creator info & caption */}
                        <div className="reel-info">
                            <div className="reel-creator">
                                <img
                                    src={reel.creatorAvatar}
                                    alt={reel.creator}
                                    className="reel-creator-avatar"
                                />
                                <span className="reel-creator-name">@{reel.creator}</span>
                                <button className="reel-follow-btn">Follow</button>
                            </div>
                            <p className="reel-caption">{reel.caption}</p>
                            <div className="reel-song">
                                <Music size={12} />
                                <span className="reel-song-marquee">{reel.song}</span>
                            </div>
                        </div>

                        {/* Side actions */}
                        <div className="reel-actions">
                            <button
                                className={`reel-action-btn ${isLiked ? 'liked' : ''}`}
                                onClick={() => toggleLike(reel.id)}
                            >
                                <Heart
                                    size={28}
                                    fill={isLiked ? '#ff3366' : 'none'}
                                    stroke={isLiked ? '#ff3366' : 'white'}
                                />
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

                        {/* Progress bar */}
                        <div className="reel-progress-bar">
                            <div
                                className="reel-progress-fill"
                                style={{ width: `${progresses[idx]}%` }}
                            />
                        </div>

                        {/* Category badge */}
                        <div className="reel-category-badge">{reel.category}</div>
                    </div>
                );
            })}
        </div>
    );
};

export default Reels;
