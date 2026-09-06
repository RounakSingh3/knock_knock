import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Music, Play, Pause, Volume2, VolumeX, Link as LinkIcon, Flame } from 'lucide-react';
import { fetchVideoPosts, trackEngagement, toggleImp, type PostData, type MessageData } from '../lib/database';
import { AppContext } from '../context/AppContext';
import ChatPanel from '../components/ChatPanel';
import ShareModal from '../components/ShareModal';
import { audioPlayer } from '../lib/audioPlayer';

export interface ReelData {
    id: string | number;
    videoUrl: string;
    posterUrl: string;
    creator: string;
    creatorAvatar: string;
    caption: string;
    song: string;
    likes: number;
    imps?: number;
    comments: number;
    shares: number;
    category: string;
    css_filter?: string;
    attachedLink?: string;
    musicUrl?: string;
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
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/09/81/85/0981857c-ef55-7eb1-d631-f7e1068bd2dc/mzaf_17162354108241480327.plus.aac.p.m4a',
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
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/3e/cb/52/3ecb5294-5ea1-e392-7262-1b10cc67a299/mzaf_17548677748266742699.plus.aac.p.m4a',
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
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/d6/59/2b/d6592b0b-1e7e-4743-b2e4-f2af038fd783/mzaf_7697277787797935735.plus.aac.p.m4a',
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
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/9e/cc/69/9ecc6918-a8dc-354f-909f-ccc20a0a7a33/mzaf_7863921970418240507.plus.aac.p.m4a',
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
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ac/57/e0/ac57e012-013a-dbc9-8526-ed12c2dacc66/mzaf_4836012189133996186.plus.aac.p.m4a',
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
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/65/69/07/656907c9-eb54-c59c-72b9-dad8489a0165/mzaf_3316991574698499044.plus.aac.p.m4a',
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
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/59/dc/4d/59dc4dda-93ff-8f1c-c536-f005f6ea6af5/mzaf_3066686759813252385.plus.aac.p.m4a',
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
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ed/a0/19/eda019cf-2794-66d1-208d-2e2e74c26c3d/mzaf_16469762943852039623.plus.aac.p.m4a',
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
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c7/ed/61/c7ed61a0-9bfd-a92b-5406-33687f7d12dc/mzaf_16539405415188574752.plus.aac.p.m4a',
    },
    {
        id: 10,
        videoUrl: 'https://videos.pexels.com/video-files/5752729/5752729-sd_640_360_30fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/5752729/free-video-5752729.jpg?auto=compress&w=400',
        creator: 'street_vibes',
        creatorAvatar: 'https://i.pravatar.cc/150?img=60',
        caption: '🎨 Street art is the voice of the city walls',
        song: 'The Staunton Lick — Lemon Jelly',
        likes: 27800,
        comments: 740,
        shares: 3100,
        category: 'Art',
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/4b/ad/b7/4badb793-5d36-f0f6-a790-04d2ad573fec/mzaf_13864281869793412693.plus.aac.p.m4a',
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
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/00/2c/2a/002c2a41-d59f-92a6-740a-35641b4e1e48/mzaf_9814325723002930170.plus.aac.p.m4a',
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
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/2d/50/49/2d5049cd-24d9-73a9-b0f2-2a69cfec5337/mzaf_10789591133834750192.plus.aac.p.m4a',
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
        song: post.music_title ? `${post.music_title} — ${post.music_artist || post.username}` : 'Original Sound',
        likes: post.likes_count || 0,
        imps: post.imps_count || 0,
        comments: 0,
        shares: 0,
        category: 'Uploads',
        css_filter: filter,
        attachedLink: post.attached_link,
        musicUrl: post.music_url,
    };
}

const Reels: React.FC = () => {
    const { user, blockedIds } = useContext(AppContext);
    const [reelsList, setReelsList] = useState<ReelData[]>(REELS_DATA);
    const [likedReels, setLikedReels] = useState<Set<string | number>>(new Set());
    const [impedReels, setImpedReels] = useState<Set<string | number>>(new Set());
    const [mutedAll, setMutedAll] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [selectedReelIndex, setSelectedReelIndex] = useState<number | null>(null);

    const [playStates, setPlayStates] = useState<boolean[]>(REELS_DATA.map(() => true));
    const [heartBursts, setHeartBursts] = useState<{ id: number; x: number; y: number }[]>([]);
    const [progresses, setProgresses] = useState<number[]>(REELS_DATA.map(() => 0));


    // Audio playback logic moved to native <audio> controls.

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
        fetchVideoPosts().then(async (videoPosts) => {
            const validPosts = videoPosts.filter(p => !p.user_id || !blockedIds.includes(p.user_id));
            const resolvedPosts = await Promise.all(validPosts.map(async (p) => {
                if (p.music_title && !p.music_url) {
                    try {
                        const query = `${p.music_title} ${p.music_artist || ''}`.trim();
                        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`);
                        const data = await res.json();
                        if (data.results?.[0]?.previewUrl) {
                            return { ...p, music_url: data.results[0].previewUrl };
                        }
                    } catch (e) {}
                }
                return p;
            }));
            const userReels = resolvedPosts.map(postToReel);
            const merged = [...userReels, ...REELS_DATA];
            setReelsList(merged);
            setPlayStates(merged.map(() => true));
            setProgresses(merged.map(() => 0));
        });
    }, [blockedIds]);

    const containerRef = useRef<HTMLDivElement>(null);
    const modalScrollRef = useRef<HTMLDivElement>(null);
    const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
    const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);
    const lastTapRef = useRef<number>(0);
    const navigate = useNavigate();

    // Helper to safely play audio with interaction fallback if browser blocks autoplay
    const playReelAudio = useCallback((audio: HTMLAudioElement | null) => {
        if (!audio || mutedAll) return;
        audio.currentTime = 0;
        const p = audio.play();
        if (p !== undefined) {
            p.catch((err) => {
                console.warn('[Reels] Audio play blocked, awaiting user tap:', err);
                const handleTapToPlay = () => {
                    audio.play().catch(() => {});
                    window.removeEventListener('click', handleTapToPlay);
                    window.removeEventListener('touchstart', handleTapToPlay);
                };
                window.addEventListener('click', handleTapToPlay, { once: true, capture: true });
                window.addEventListener('touchstart', handleTapToPlay, { once: true, capture: true });
            });
        }
    }, [mutedAll]);

    // Auto-scroll to selected reel index when modal opens and play media immediately
    useEffect(() => {
        if (selectedReelIndex !== null && modalScrollRef.current) {
            const height = modalScrollRef.current.clientHeight;
            modalScrollRef.current.scrollTo(0, height * selectedReelIndex);
            setActiveIndex(selectedReelIndex);

            const syncReelMedia = () => {
                videoRefs.current.forEach((v, idx) => {
                    if (!v) return;
                    const reel = reelsList[idx];
                    const hasMusic = Boolean(reel?.musicUrl);
                    v.muted = hasMusic ? true : mutedAll;
                    if (idx === selectedReelIndex) {
                        v.play().catch(() => {});
                    } else {
                        v.pause();
                    }
                });
                audioRefs.current.forEach((a, idx) => {
                    if (!a) return;
                    a.muted = mutedAll;
                    if (idx === selectedReelIndex && !mutedAll) {
                        playReelAudio(a);
                    } else {
                        a.pause();
                        a.currentTime = 0;
                    }
                });
                setPlayStates(prev => { const n = [...prev]; n[selectedReelIndex] = true; return n; });
            };

            syncReelMedia();
            const timer = setTimeout(syncReelMedia, 150);
            return () => clearTimeout(timer);
        }
    }, [selectedReelIndex, mutedAll, reelsList, playReelAudio]);

    // IntersectionObserver to auto-play visible video in modal and manage audio strictly
    useEffect(() => {
        if (selectedReelIndex === null) return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const idx = videoRefs.current.findIndex((v) => v === entry.target);
                    if (idx === -1) return;
                    const video = entry.target as HTMLVideoElement;
                    const reel = reelsList[idx];
                    const hasMusic = Boolean(reel?.musicUrl);

                    if (entry.isIntersecting) {
                        setActiveIndex(idx);
                        video.muted = hasMusic ? true : mutedAll;
                        video.play().catch(() => { });
                        // Stop all other audios immediately, and play only this reel's audio
                        audioRefs.current.forEach((a, i) => {
                            if (a) {
                                a.muted = mutedAll;
                                if (i === idx && !mutedAll) {
                                    playReelAudio(a);
                                } else {
                                    a.pause();
                                    a.currentTime = 0;
                                }
                            }
                        });
                        setPlayStates((prev) => {
                            const next = [...prev];
                            next[idx] = true;
                            return next;
                        });
                    } else {
                        video.pause();
                        if (audioRefs.current[idx]) {
                            audioRefs.current[idx]?.pause();
                            audioRefs.current[idx]!.currentTime = 0;
                        }
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
        videoRefs.current.forEach((video) => {
            if (video) observer.observe(video);
        });
        return () => observer.disconnect();
    }, [selectedReelIndex, mutedAll, reelsList, playReelAudio]);

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
        }, 500);
        return () => clearInterval(interval);
    }, [selectedReelIndex]);

    const togglePlay = useCallback(
        (idx: number) => {
            const video = videoRefs.current[idx];
            const audio = audioRefs.current[idx];
            if (!video) return;
            if (video.paused) {
                video.play().catch(() => { });
                if (audio && !mutedAll) audio.play().catch(() => { });
                setPlayStates((prev) => {
                    const next = [...prev];
                    next[idx] = true;
                    return next;
                });
            } else {
                video.pause();
                if (audio) audio.pause();
                setPlayStates((prev) => {
                    const next = [...prev];
                    next[idx] = false;
                    return next;
                });
            }
        },
        [mutedAll]
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

    const toggleImpReel = useCallback(async (reelId: string | number) => {
        setImpedReels((prev) => {
            const next = new Set(prev);
            if (next.has(reelId)) next.delete(reelId);
            else next.add(reelId);
            return next;
        });
        if (user && typeof reelId === 'string') {
            const currentlyImped = impedReels.has(reelId);
            await toggleImp(user.id, reelId, currentlyImped);
        }
    }, [user, impedReels]);

    const [touchStartPos, setTouchStartPos] = useState<{x: number, y: number} | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStartPos({
            x: e.changedTouches[0].screenX,
            y: e.changedTouches[0].screenY
        });
    };

    const handleTouchEnd = (reel: ReelData, e: React.TouchEvent) => {
        if (!touchStartPos) return;
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        
        const diffX = touchEndX - touchStartPos.x;
        const diffY = touchEndY - touchStartPos.y;

        // Only trigger horizontal swipe if X movement is greater than Y movement (to avoid triggering on scroll)
        if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX < 0) {
                // Swipe Left -> Profile (match Instagram/TikTok behavior)
                navigate(`/profile/${reel.creator}`);
            } else {
                // Swipe Right -> Close Player
                closePlayer();
            }
        }
        setTouchStartPos(null);
    };

    const closePlayer = () => {
        // Pause all videos and audios when returning to grid
        videoRefs.current.forEach(v => v?.pause());
        audioRefs.current.forEach(a => {
            if (a) {
                a.pause();
                a.currentTime = 0;
            }
        });
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
                        background: 'linear-gradient(45deg, #f5a524, #ff6b35)',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '8px 16px',
                        color: 'var(--text-active)',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(245, 165, 36, 0.3)'
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
                                width: '40px', height: '40px', borderRadius: '50%', pointerEvents: 'auto',
                                backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.2rem'
                            }}
                        >
                            ←
                        </button>
                        <button
                            onClick={() => {
                                const newMuted = !mutedAll;
                                setMutedAll(newMuted);
                                videoRefs.current.forEach((v, vIdx) => {
                                    if (v) {
                                        const hasMusic = Boolean(reelsList[vIdx]?.musicUrl);
                                        v.muted = hasMusic ? true : newMuted;
                                    }
                                });
                                audioRefs.current.forEach((a, idx) => {
                                    if (!a) return;
                                    a.muted = newMuted;
                                    if (idx === activeIndex) {
                                        if (newMuted) {
                                            a.pause();
                                        } else {
                                            playReelAudio(a);
                                        }
                                    }
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
                    <div className="reels-page" ref={modalScrollRef}>
                        {reelsList.map((reel, idx) => {
                            const isLiked = likedReels.has(reel.id);
                            const isNearby = Math.abs(idx - activeIndex) <= 2;
                            
                            return (
                                <div 
                                    className="reel-card" 
                                    key={reel.id}
                                    onTouchStart={handleTouchStart}
                                    onTouchEnd={(e) => handleTouchEnd(reel, e)}
                                >
                                    <video
                                        ref={(el) => {
                                            videoRefs.current[idx] = el;
                                            if (el && !isNearby) {
                                                el.removeAttribute('src');
                                                el.load();
                                            }
                                        }}
                                        src={isNearby ? reel.videoUrl : undefined}
                                        poster={reel.posterUrl}
                                        loop
                                        playsInline
                                        autoPlay={idx === selectedReelIndex}
                                        muted={Boolean(reel.musicUrl) || mutedAll}
                                        className="reel-video"
                                        style={{ filter: reel.css_filter || 'none' }}
                                        onClick={(e) => handleDoubleTap(idx, e)}
                                    />

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
                                            <Heart size={80} fill="#f5a524" stroke="none" />
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
                                    <div className="reel-info">
                                        <div className="reel-creator">
                                            <img
                                                src={reel.creatorAvatar}
                                                alt={reel.creator}
                                                className="reel-creator-avatar"
                                            />
                                            <span className="reel-creator-name">@{reel.creator}</span>
                                            <button className="reel-follow-btn">Friend</button>
                                        </div>
                                        {reel.musicUrl && (
                                            <audio
                                                ref={(el) => { audioRefs.current[idx] = el; }}
                                                src={reel.musicUrl}
                                                loop
                                                style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                                                playsInline
                                            />
                                        )}
                                        <div className="reel-song">
                                            <Music size={12} />
                                            <span className="reel-song-marquee">{reel.song || 'Original Audio'}</span>
                                        </div>
                                        <p className="reel-caption">{reel.caption}</p>
                                    </div>

                                    {/* Side actions */}
                                    <div className="reel-actions">
                                        <button
                                            className={`reel-action-btn ${isLiked ? 'liked' : ''}`}
                                            onClick={() => toggleLike(reel.id)}
                                        >
                                            <Heart
                                                size={28}
                                                fill={isLiked ? '#f5a524' : 'none'}
                                                stroke={isLiked ? '#f5a524' : 'var(--text-active)'}
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
                                        <button
                                            className={`reel-action-btn ${impedReels.has(reel.id) ? 'imped' : ''}`}
                                            onClick={() => toggleImpReel(reel.id)}
                                        >
                                            <Flame
                                                size={28}
                                                fill={impedReels.has(reel.id) ? '#ff4500' : 'none'}
                                                stroke={impedReels.has(reel.id) ? '#ff4500' : 'var(--text-active)'}
                                            />
                                            <span>{formatCount((reel.imps || 0) + (impedReels.has(reel.id) ? 1 : 0))}</span>
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
