import React, { useRef, useEffect, useState, memo, useCallback } from 'react';
import { VolumeX, Play, Pause, Heart } from 'lucide-react';
import { isVideoPost, isVideoUrl, getOptimizedImageUrl, getCleanSongUrl } from '../lib/media';
import type { PostData } from '../lib/database';

interface PostMediaProps {
    post: Pick<PostData, 'image_url' | 'media_type' | 'css_filter' | 'music_url' | 'music_title' | 'music_artist'>;
    className?: string;
    style?: React.CSSProperties;
    /** Mute video. Defaults: false when controls/soundOn, true for autoplay thumbnails */
    muted?: boolean;
    controls?: boolean;
    autoPlay?: boolean;
    loop?: boolean;
    playsInline?: boolean;
    alt?: string;
    /** After user tap — unmute and play with audio (modal / detail view) */
    soundOn?: boolean;
    /** Override object-fit ('contain' | 'cover' | etc.) */
    objectFit?: React.CSSProperties['objectFit'];
    /** Render in optimized lightweight thumbnail mode (for feeds/grids) */
    thumbnail?: boolean;
    /** Instagram-style gestures */
    onDoubleTapLike?: () => void;
    onTogglePlay?: (isPlaying: boolean) => void;
    onMuteChange?: (muted: boolean) => void;
}

// In-memory cache for resolved iTunes preview URLs to prevent redundant network fetches
const itunesCache = new Map<string, string>();
// In-memory poster frame cache for video thumbnails to eliminate hardware video decoder churn
export const videoPosterCache = new Map<string, string>();

// Restore any persisted video posters from sessionStorage to eliminate cold-start decoder spikes
try {
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem('knock_video_posters') : null;
    if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
            Object.entries(parsed).forEach(([k, v]) => {
                if (typeof v === 'string') videoPosterCache.set(k, v);
            });
        }
    }
} catch (_) {}


const UNIVERSAL_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop';
const CATEGORY_FALLBACKS: Record<string, string> = {
    Lifestyle: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop',
    Music: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop',
    Nature: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop',
    Travel: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop',
    Sports: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop',
    Food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop',
    Dance: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop',
    Tech: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop',
    Entertainment: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&auto=format&fit=crop',
    Comedy: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=800&auto=format&fit=crop',
    Fashion: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&auto=format&fit=crop',
    Animals: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=800&auto=format&fit=crop',
    Gaming: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&auto=format&fit=crop',
    Art: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop',
    Education: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&auto=format&fit=crop',
    Fitness: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop',
    Memes: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=800&auto=format&fit=crop',
    Bollywood: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop',
    General: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop'
};

export const getFallbackPoster = (post?: Partial<PostData>): string => {
    if (!post) return UNIVERSAL_FALLBACK_IMAGE;
    const cat = post.category || (post as any)?.category;
    if (cat && CATEGORY_FALLBACKS[cat]) {
        return CATEGORY_FALLBACKS[cat];
    }
    return UNIVERSAL_FALLBACK_IMAGE;
};

export const extractPosterFromUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (url.includes('#POSTER:')) {
        try {
            return decodeURIComponent(url.split('#POSTER:')[1]?.split('#')[0] || '');
        } catch (_) {
            return url.split('#POSTER:')[1]?.split('#')[0];
        }
    }
    if (url.includes('#FALLBACK:')) {
        try {
            return decodeURIComponent(url.split('#FALLBACK:')[1]?.split('#')[0] || '');
        } catch (_) {
            return url.split('#FALLBACK:')[1]?.split('#')[0];
        }
    }
    // Auto-derive Supabase storage poster URL if video is in knock-knock-eight.versel/posts/
    if (url.includes('/knock-knock-eight.versel/posts/') && (url.includes('.mp4') || url.includes('.webm') || url.includes('.mov'))) {
        try {
            const clean = url.split('#')[0].split('?')[0];
            const parts = clean.split('/posts/');
            if (parts.length === 2 && parts[1] && !parts[1].startsWith('posters/')) {
                const filename = parts[1];
                const posterName = filename.replace(/\.(mp4|webm|mov)$/i, '.jpg');
                return `${parts[0]}/posts/posters/${posterName}`;
            }
        } catch (_) {}
    }
    return undefined;
};

const PostMediaComponent: React.FC<PostMediaProps> = ({
    post,
    className,
    style,
    muted,
    controls = false,
    autoPlay = false,
    loop = true,
    playsInline = true,
    alt = '',
    soundOn = false,
    objectFit,
    thumbnail,
    onDoubleTapLike,
    onTogglePlay,
    onMuteChange,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isPlayingMode = autoPlay || soundOn || controls;
    const [isLoaded, setIsLoaded] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isAudioBlocked, setIsAudioBlocked] = useState(false);
    const [isAutoplayFallbackMuted, setIsAutoplayFallbackMuted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(autoPlay || soundOn);
    const [showPlayPauseIcon, setShowPlayPauseIcon] = useState<'play' | 'pause' | null>(null);
    const [heartBursts, setHeartBursts] = useState<{ id: number; x: number; y: number }[]>([]);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const lastTapTimeRef = useRef(0);
    const playPauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryCountRef = useRef(0);
    const fallbackUsedRef = useRef(false);
    const playPromiseRef = useRef<Promise<void> | null>(null);
    const isVideo = isVideoPost(post) || isVideoUrl(post.image_url);

    // ⚡ On mobile devices, request 380px for feed thumbnails to cut GPU texture memory, and 1080px for full-screen viewer
    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth <= 640;
    const targetWidth = isMobileScreen && thumbnail ? 380 : (thumbnail ? 600 : 1080);

    const [currentImgSrc, setCurrentImgSrc] = useState<string>(() => {
        return isVideo ? '' : getOptimizedImageUrl(post.image_url, targetWidth);
    });

    const cleanUrl = post.image_url ? post.image_url.split('#')[0].split('?')[0] : '';

    // Clean video URL: strip ALL hash fragments (#POSTER:, #FALLBACK:, #BOOST:, etc.) and filter query
    let cleanVideoUrl = '';
    if (post.image_url) {
        const rawNoHash = post.image_url.split('#')[0];
        try {
            const parsed = new URL(rawNoHash);
            if (parsed.searchParams.has('filter')) {
                parsed.searchParams.delete('filter');
            }
            cleanVideoUrl = parsed.toString();
        } catch (_) {
            cleanVideoUrl = rawNoHash;
        }
    }

    // Pure clean URL for seamless progressive streaming without pipeline resets
    const videoSrc = isVideo ? cleanVideoUrl : '';
    const resolvedPosterFromUrl = extractPosterFromUrl(post.image_url);
    const categoryFallbackPoster = getFallbackPoster(post as any);
    const [capturedPoster, setCapturedPoster] = useState<string>(() => {
        if (isVideo && cleanUrl) {
            return videoPosterCache.get(cleanUrl) || resolvedPosterFromUrl || categoryFallbackPoster;
        }
        return resolvedPosterFromUrl || categoryFallbackPoster;
    });
    const [posterFailed, setPosterFailed] = useState<boolean>(false);
    const [videoCrossOrigin, setVideoCrossOrigin] = useState<"anonymous" | undefined>(() => thumbnail ? "anonymous" : undefined);

    // ⚡ Viewport-aware video lazy mounting: do NOT mount native video decoders if thumbnail is off-screen
    const [isInView, setIsInView] = useState(() => !thumbnail || isPlayingMode || Boolean(videoPosterCache.get(cleanUrl)) || Boolean(resolvedPosterFromUrl));

    useEffect(() => {
        if (!thumbnail || isPlayingMode || capturedPoster) {
            setIsInView(true);
            return;
        }
        const container = containerRef.current;
        if (!container) return;

        let observer: IntersectionObserver | null = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setIsInView(true);
            } else {
                setIsInView(false);
            }
        }, { rootMargin: '350px' });

        observer.observe(container);
        return () => {
            observer?.disconnect();
            observer = null;
        };
    }, [thumbnail, isPlayingMode, capturedPoster]);

    useEffect(() => {
        setHasError(false);
        setIsAudioBlocked(false);
        setIsLoaded(false);
        setPosterFailed(false);
        retryCountRef.current = 0;
        fallbackUsedRef.current = false;
        setCurrentImgSrc(isVideo ? '' : getOptimizedImageUrl(post.image_url, targetWidth));
        const posterFromUrl = extractPosterFromUrl(post.image_url);
        const fb = getFallbackPoster(post as any);
        if (cleanUrl) {
            const bestPoster = posterFromUrl || videoPosterCache.get(cleanUrl) || fb;
            videoPosterCache.set(cleanUrl, bestPoster);
            setCapturedPoster(bestPoster);
        } else {
            setCapturedPoster(posterFromUrl || fb);
        }
    }, [post.image_url, isVideo, cleanUrl, targetWidth]);


    const staticCleanUrl = getCleanSongUrl(post.music_title, post.music_url);
    const isDirectCleanUrl = post.music_url && !post.music_url.includes('soundhelix');
    const queryKey = post.music_title ? `${post.music_title} ${post.music_artist || ''}`.trim().toLowerCase() : '';
    
    const [asyncMusicUrl, setAsyncMusicUrl] = useState<string | undefined>(() => {
        if (staticCleanUrl) return staticCleanUrl;
        if (isDirectCleanUrl) return post.music_url!;
        if (queryKey && itunesCache.has(queryKey)) return itunesCache.get(queryKey);
        return undefined;
    });

    const resolvedMusicUrl = staticCleanUrl || (isDirectCleanUrl ? post.music_url : asyncMusicUrl);
    const hasMusic = Boolean(resolvedMusicUrl);

    // If post has a music track, the video element should be muted so only the song plays!
    // If post does not have music, the video's own sound plays when soundOn / unmuted.
    const effectiveMuted = hasMusic 
        ? true 
        : (muted !== undefined ? muted : (soundOn ? false : true));

    // Fallback-aware DOM muted state:
    const domMuted = hasMusic ? true : (isAutoplayFallbackMuted || effectiveMuted);
    const isAudioActive = soundOn || (autoPlay && !domMuted);

    // Resolve missing or unknown music_url from music_title via iTunes API only if active and needed
    useEffect(() => {
        if (staticCleanUrl || isDirectCleanUrl) {
            return;
        }
        if (!queryKey) {
            setAsyncMusicUrl(undefined);
            return;
        }
        if (itunesCache.has(queryKey)) {
            setAsyncMusicUrl(itunesCache.get(queryKey));
            return;
        }
        // Only trigger network lookup when audio will actually be heard (not for offscreen or muted grid tiles)
        if (!isAudioActive) {
            return;
        }

        let active = true;
        fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(queryKey)}&media=music&entity=song&limit=1`)
            .then(res => res.json())
            .then(data => {
                if (active && data.results?.[0]?.previewUrl) {
                    const url = data.results[0].previewUrl;
                    itunesCache.set(queryKey, url);
                    setAsyncMusicUrl(url);
                }
            })
            .catch(() => {});
        return () => { active = false; };
    }, [isAudioActive, queryKey, staticCleanUrl, isDirectCleanUrl]);

    // Unmute action: unmutes video and/or music track and plays if paused
    const handleUnmute = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
        if (e) {
            e.stopPropagation();
        }
        setIsAutoplayFallbackMuted(false);
        setIsAudioBlocked(false);
        if (onMuteChange) onMuteChange(false);

        const video = videoRef.current;
        if (video) {
            video.muted = hasMusic ? true : false;
            video.volume = 1;
            if (video.paused && !playPromiseRef.current) {
                const p = video.play();
                if (p !== undefined) {
                    playPromiseRef.current = p;
                    p.then(() => {
                        playPromiseRef.current = null;
                        setIsPlaying(true);
                    }).catch(() => {
                        playPromiseRef.current = null;
                    });
                }
            }
        }
        const audio = audioRef.current;
        if (audio && hasMusic) {
            audio.muted = false;
            audio.volume = 1;
            if (audio.paused) {
                audio.play().catch(() => {});
            }
        }
    }, [hasMusic, onMuteChange]);

    // When audio is blocked by browser autoplay policy, listen for any user tap anywhere to seamlessly unmute
    useEffect(() => {
        if (!isAudioBlocked) return;
        const onUserGesture = () => {
            handleUnmute();
        };
        window.addEventListener('click', onUserGesture, { once: true, capture: true });
        window.addEventListener('touchstart', onUserGesture, { once: true, capture: true });
        return () => {
            window.removeEventListener('click', onUserGesture, { capture: true });
            window.removeEventListener('touchstart', onUserGesture, { capture: true });
        };
    }, [isAudioBlocked, handleUnmute]);

    // Synchronize DOM muted state directly without restarting play cycle
    useEffect(() => {
        if (!isVideo) return;
        const video = videoRef.current;
        if (!video) return;
        video.muted = domMuted;
        if (!domMuted) {
            video.volume = 1;
        }
    }, [isVideo, domMuted]);

    // Resilient dual-stage playback logic
    const domMutedRef = useRef(domMuted);
    useEffect(() => {
        domMutedRef.current = domMuted;
    }, [domMuted]);

    const safePause = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (playPromiseRef.current) {
            playPromiseRef.current
                .then(() => {
                    video.pause();
                    setIsPlaying(false);
                })
                .catch(() => {
                    setIsPlaying(false);
                });
        } else {
            try {
                video.pause();
            } catch (_) {}
            setIsPlaying(false);
        }
    }, []);

    const startPlayback = useCallback(() => {
        if (!isVideo) return;
        const video = videoRef.current;
        if (!video) return;

        if (autoPlay || soundOn) {
            video.muted = domMutedRef.current;
            // Guard against overlapping play requests on the same media element
            if (playPromiseRef.current) return;

            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromiseRef.current = playPromise;
                playPromise
                    .then(() => {
                        playPromiseRef.current = null;
                        setIsPlaying(true);
                        if (!video.muted) {
                            setIsAudioBlocked(false);
                        }
                    })
                    .catch((err) => {
                        playPromiseRef.current = null;
                        if (err.name === 'AbortError') return; // Interrupted cleanly, ignore
                        console.warn('[PostMedia] Autoplay unmuted failed, falling back to muted:', err);
                        // Silent recovery: ensure muted autoplay succeeds so video never freezes on mobile
                        setIsAutoplayFallbackMuted(true);
                        setIsAudioBlocked(true);
                        video.muted = true;
                        const fallbackPromise = video.play();
                        if (fallbackPromise !== undefined) {
                            playPromiseRef.current = fallbackPromise;
                            fallbackPromise
                                .then(() => {
                                    playPromiseRef.current = null;
                                    setIsPlaying(true);
                                })
                                .catch(() => {
                                    playPromiseRef.current = null;
                                });
                        }
                    });
            }
        } else {
            safePause();
        }
    }, [isVideo, autoPlay, soundOn, safePause]);

    // Handle video play/pause & sound with resilient dual-stage autoplay
    useEffect(() => {
        if (!isVideo) return;
        if (autoPlay || soundOn) {
            startPlayback();
        } else {
            safePause();
        }

        return () => {
            safePause();
        };
    }, [isVideo, autoPlay, soundOn, videoSrc, startPlayback, safePause]);

    const handleMediaClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!isPlayingMode) return;

        const now = Date.now();
        const timeSinceLast = now - lastTapTimeRef.current;
        lastTapTimeRef.current = now;

        if (timeSinceLast < 300) {
            // Double tap — like with heart burst!
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const burstId = Date.now();
            setHeartBursts(prev => [...prev, { id: burstId, x, y }]);
            setTimeout(() => setHeartBursts(prev => prev.filter(h => h.id !== burstId)), 900);
            if (onDoubleTapLike) onDoubleTapLike();
            return;
        }

        // Single tap — if audio was blocked, unmute on tap
        if (isAudioBlocked) {
            handleUnmute(e);
            return;
        }

        // Single tap — toggle play/pause
        const video = videoRef.current;
        if (video && isVideo) {
            if (video.paused) {
                if (!playPromiseRef.current) {
                    video.muted = domMuted;
                    const p = video.play();
                    if (p !== undefined) {
                        playPromiseRef.current = p;
                        p.then(() => {
                            playPromiseRef.current = null;
                            setIsPlaying(true);
                            setShowPlayPauseIcon('play');
                            if (onTogglePlay) onTogglePlay(true);
                        }).catch(() => {
                            playPromiseRef.current = null;
                        });
                    }
                }
                if (audioRef.current && hasMusic && !domMuted) {
                    audioRef.current.play().catch(() => {});
                }
            } else {
                safePause();
                setShowPlayPauseIcon('pause');
                if (onTogglePlay) onTogglePlay(false);
                if (audioRef.current) {
                    audioRef.current.pause();
                }
            }
            if (playPauseTimeoutRef.current) clearTimeout(playPauseTimeoutRef.current);
            playPauseTimeoutRef.current = setTimeout(() => {
                setShowPlayPauseIcon(null);
            }, 600);
        }
    }, [isPlayingMode, isAudioBlocked, handleUnmute, isVideo, onDoubleTapLike, onTogglePlay, hasMusic, domMuted, safePause]);

    // Handle background audio playback for posts with music
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !resolvedMusicUrl) return;

        let isCancelled = false;
        let cleanupTap: (() => void) | null = null;
        const shouldPlayAudio = (autoPlay || soundOn) && (muted === false || (muted === undefined && soundOn));

        if (shouldPlayAudio) {
            audio.muted = false;
            audio.volume = 1;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        if (!isCancelled) setIsAudioBlocked(false);
                    })
                    .catch((e) => {
                        if (e.name === 'AbortError' || isCancelled) return;
                        console.warn('[PostMedia] Audio autoplay deferred until tap:', e);
                        setIsAudioBlocked(true);
                        const onUserTap = () => {
                            if (isCancelled) return;
                            audio.muted = false;
                            audio.volume = 1;
                            audio.play().then(() => setIsAudioBlocked(false)).catch(() => {});
                        };
                        window.addEventListener('click', onUserTap, { once: true, capture: true });
                        window.addEventListener('touchstart', onUserTap, { once: true, capture: true });
                        cleanupTap = () => {
                            window.removeEventListener('click', onUserTap, { capture: true });
                            window.removeEventListener('touchstart', onUserTap, { capture: true });
                        };
                    });
            }
        } else {
            audio.pause();
            audio.currentTime = 0;
        }

        return () => {
            isCancelled = true;
            if (cleanupTap) cleanupTap();
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (_) {}
        };
    }, [autoPlay, soundOn, muted, resolvedMusicUrl]);

    // Sync audio restart when video loops
    useEffect(() => {
        const video = videoRef.current;
        const audio = audioRef.current;
        if (!video || !audio) return;

        const handleEnded = () => {
            audio.currentTime = 0;
            if (!audio.paused) {
                audio.play().catch(() => {});
            }
        };
        video.addEventListener('ended', handleEnded);
        return () => video.removeEventListener('ended', handleEnded);
    }, []);

    let extractedFilter = post.css_filter || 'none';
    try {
        if (!post.css_filter || post.css_filter === 'none') {
            if (post.image_url) {
                const url = new URL(post.image_url);
                const f = url.searchParams.get('filter');
                if (f) extractedFilter = decodeURIComponent(f);
            }
        }
    } catch(e) {}

    // ⚡ Fix distorted colors: Strip extreme hue shifts or inversions
    if (extractedFilter.includes('hue-rotate') || extractedFilter.includes('invert')) {
        extractedFilter = extractedFilter
            .replace(/hue-rotate\([^)]+\)/g, '')
            .replace(/invert\([^)]+\)/g, '')
            .trim();
        if (!extractedFilter || extractedFilter === 'none') extractedFilter = 'none';
    }

    // Retry handler: automatically switches to high-quality fallback image or poster on failure
    const handleMediaError = () => {
        if (!isVideo && !fallbackUsedRef.current) {
            fallbackUsedRef.current = true;
            const fallbackPoster = extractPosterFromUrl(post.image_url);
            const category = (post as any)?.category;
            const fallback = fallbackPoster || (category && CATEGORY_FALLBACKS[category]) || UNIVERSAL_FALLBACK_IMAGE;
            setCurrentImgSrc(fallback);
            setHasError(false);
            return;
        }
        if (isVideo && !isPlayingMode && !fallbackUsedRef.current) {
            fallbackUsedRef.current = true;
            const poster = extractPosterFromUrl(post.image_url);
            if (poster) {
                setCapturedPoster(poster);
                setPosterFailed(false);
                setHasError(false);
                return;
            }
        }
        if (isVideo && videoCrossOrigin === 'anonymous') {
            // Retry without crossOrigin restriction in case CORS was rejected
            setVideoCrossOrigin(undefined);
            setHasError(false);
            return;
        }
        if (retryCountRef.current < 2) {
            retryCountRef.current += 1;
            setTimeout(() => setHasError(false), 1500 * retryCountRef.current);
            return;
        }
        setHasError(true);
    };

    const resolvedObjectFit = objectFit || style?.objectFit || (controls || soundOn ? 'contain' : 'cover');

    if (hasError || !post.image_url) {
        const poster = extractPosterFromUrl(post.image_url) || (thumbnail ? getFallbackPoster(post) : undefined);
        return (
            <div 
                className={className}
                style={{
                    width: '100%',
                    height: style?.height || '100%',
                    minHeight: style?.minHeight || '0px',
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#121214',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...style
                }}
            >
                {poster ? (
                    <img
                        src={poster}
                        alt={alt}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: resolvedObjectFit,
                            display: 'block'
                        }}
                    />
                ) : (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        color: 'rgba(255,255,255,0.7)',
                    }}>
                        <div style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Play size={24} color="#f5a524" />
                        </div>
                        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>
                            {isVideo ? 'Video unavailable' : 'Media unavailable'}
                        </span>
                    </div>
                )}
                {isVideo && poster && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.25)'
                    }}>
                        <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Play size={20} fill="#fff" color="#fff" style={{ marginLeft: '2px' }} />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div 
            ref={containerRef} 
            onClick={handleMediaClick}
            style={{ 
                position: 'relative', 
                width: '100%', 
                height: style?.height || '100%', 
                minHeight: style?.minHeight || '0px',
                backgroundColor: '#18181b',
                overflow: 'hidden',
                cursor: isPlayingMode ? 'pointer' : 'default',
                userSelect: 'none',
                WebkitUserSelect: 'none',
            }}
        >
            {isVideo ? (
                <>
                    {thumbnail && !isPlayingMode ? (
                        /* ⚡ Ultra-lightweight instant poster for all grid/masonry cards: displays real video picture without opening */
                        <div
                            className={className}
                            style={{
                                ...style,
                                width: '100%',
                                height: '100%',
                                minHeight: style?.minHeight || '160px',
                                position: 'relative',
                                overflow: 'hidden',
                                background: '#18181b',
                            }}
                        >
                            <img
                                src={capturedPoster || resolvedPosterFromUrl || categoryFallbackPoster}
                                alt={alt}
                                style={{
                                    ...style,
                                    filter: extractedFilter,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: resolvedObjectFit,
                                    display: 'block',
                                    transform: 'translateZ(0)',
                                    backfaceVisibility: 'hidden',
                                }}
                                loading="lazy"
                                decoding="async"
                                onError={(e) => {
                                    setPosterFailed(true);
                                    const fb = getFallbackPoster(post as any);
                                    if (e.currentTarget.src !== fb) {
                                        e.currentTarget.src = fb;
                                    }
                                    setCapturedPoster(fb);
                                    if (cleanUrl) videoPosterCache.set(cleanUrl, fb);
                                }}
                            />
                            <div style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: 'rgba(0,0,0,0.55)',
                                backdropFilter: 'blur(4px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'none',
                            }}>
                                <Play size={12} fill="#fff" color="#fff" style={{ marginLeft: '1px' }} />
                            </div>
                        </div>
                    ) : (
                        <div style={{ width: '100%', height: '100%', position: 'relative', background: '#18181b', overflow: 'hidden' }}>
                            <video
                                ref={videoRef}
                                src={videoSrc}
                                poster={capturedPoster || (!posterFailed ? resolvedPosterFromUrl : undefined) || categoryFallbackPoster}
                                className={className}
                                style={{
                                    ...style,
                                    filter: extractedFilter,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: resolvedObjectFit,
                                    display: 'block',
                                    transform: 'translateZ(0)',
                                    backfaceVisibility: 'hidden',
                                    position: 'relative',
                                    zIndex: 1,
                                }}
                                muted={domMuted}
                                controls={controls}
                                autoPlay={autoPlay || soundOn}
                                loop={loop}
                                playsInline={playsInline}
                                // @ts-ignore
                                webkit-playsinline="true"
                                x5-playsinline="true"
                                // @ts-ignore
                                disablePictureInPicture={true}
                                // @ts-ignore
                                disableRemotePlayback={true}
                                preload="auto"
                                onError={() => {
                                    setIsBuffering(false);
                                    handleMediaError();
                                }}
                                onWaiting={() => {
                                    if (isPlayingMode) setIsBuffering(true);
                                }}
                                onPlaying={() => {
                                    setIsBuffering(false);
                                    setIsLoaded(true);
                                }}
                                onLoadedMetadata={() => {
                                    if (isPlayingMode && (autoPlay || soundOn)) {
                                        startPlayback();
                                    }
                                }}
                                onLoadedData={() => {
                                    setIsBuffering(false);
                                    setIsLoaded(true);
                                    if (isPlayingMode && (autoPlay || soundOn) && videoRef.current?.paused) {
                                        startPlayback();
                                    }
                                }}
                                onCanPlay={() => {
                                    setIsBuffering(false);
                                    setIsLoaded(true);
                                    if (isPlayingMode && (autoPlay || soundOn) && videoRef.current?.paused) {
                                        startPlayback();
                                    }
                                }}
                                onTimeUpdate={(e) => {
                                    const v = e.currentTarget;
                                    if (isPlayingMode && v.duration && progressBarRef.current) {
                                        const pct = (v.currentTime / v.duration) * 100;
                                        progressBarRef.current.style.width = `${pct}%`;
                                    }
                                }}
                                onMouseEnter={() => {
                                    if (!isPlayingMode && videoRef.current && window.matchMedia?.('(hover: hover)').matches) {
                                        videoRef.current.muted = true;
                                        if (!playPromiseRef.current) {
                                            const p = videoRef.current.play();
                                            if (p !== undefined) {
                                                playPromiseRef.current = p;
                                                p.then(() => { playPromiseRef.current = null; }).catch(() => { playPromiseRef.current = null; });
                                            }
                                        }
                                    }
                                }}
                                onMouseLeave={() => {
                                    if (!isPlayingMode && videoRef.current && window.matchMedia?.('(hover: hover)').matches) {
                                        safePause();
                                        if (videoRef.current) videoRef.current.currentTime = 0.001;
                                    }
                                }}
                            />
                        </div>
                    )}

                    {/* Floating 'Tap for sound' pill when unmuted playback was blocked by browser policy */}
                    {isAudioBlocked && isPlayingMode && (
                        <button
                            type="button"
                            onClick={handleUnmute}
                            className="post-media-unmute-pill"
                            style={{
                                position: 'absolute',
                                bottom: controls ? '60px' : '24px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 35,
                                background: 'rgba(0, 0, 0, 0.88)',
                                border: '1px solid rgba(245, 165, 36, 0.6)',
                                color: '#fff',
                                padding: '8px 18px',
                                borderRadius: '24px',
                                fontSize: '13px',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
                                pointerEvents: 'auto',
                            }}
                        >
                            <VolumeX size={16} color="#f5a524" />
                            <span>Tap for sound</span>
                        </button>
                    )}

                    {/* Central Play/Pause Flash Indicator */}
                    {showPlayPauseIcon && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                zIndex: 30,
                                width: '72px',
                                height: '72px',
                                borderRadius: '50%',
                                background: 'rgba(0, 0, 0, 0.65)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'none',
                                animation: 'reelIconPop 0.4s ease-out forwards',
                            }}
                        >
                            {showPlayPauseIcon === 'play' ? (
                                <Play size={36} fill="#fff" color="#fff" style={{ marginLeft: '4px' }} />
                            ) : (
                                <Pause size={36} fill="#fff" color="#fff" />
                            )}
                        </div>
                    )}

                    {/* Buffering spinner overlay in active playback mode */}
                    {isBuffering && isPlayingMode && (
                        <div className="reel-buffering-indicator">
                            <div className="reel-spinner" />
                        </div>
                    )}

                    {/* Subtle video progress indicator in active playback mode */}
                    {isPlayingMode && (
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '2px',
                            backgroundColor: 'rgba(255, 255, 255, 0.15)',
                            zIndex: 20,
                            pointerEvents: 'none',
                        }}>
                            <div
                                ref={progressBarRef}
                                style={{
                                    height: '100%',
                                    width: '0%',
                                    backgroundColor: '#f5a524',
                                }}
                            />
                        </div>
                    )}
                </>
            ) : (
                <img
                    src={currentImgSrc}
                    alt={alt}
                    className={className}
                    style={{
                        ...style,
                        filter: extractedFilter,
                        width: '100%',
                        height: '100%',
                        objectFit: resolvedObjectFit,
                        display: 'block',
                        transform: 'translateZ(0)',
                        backfaceVisibility: 'hidden',
                    }}
                    loading={isPlayingMode || !thumbnail ? "eager" : "lazy"}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={handleMediaError}
                />
            )}

            {/* Heart Bursts on Double Tap */}
            {heartBursts.map(h => (
                <div
                    key={h.id}
                    className="heart-burst"
                    style={{
                        position: 'absolute',
                        left: h.x,
                        top: h.y,
                        zIndex: 40,
                    }}
                >
                    <Heart size={80} fill="#f5a524" color="#f5a524" />
                </div>
            ))}

            
            {resolvedMusicUrl && isAudioActive && (
                <audio
                    ref={audioRef}
                    src={resolvedMusicUrl}
                    loop
                    preload="auto"
                    style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    playsInline
                />
            )}
        </div>
    );
};

export const PostMedia = memo(PostMediaComponent);
export default PostMedia;
