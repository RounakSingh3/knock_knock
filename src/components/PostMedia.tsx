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
const videoPosterCache = new Map<string, string>();

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

let isGlobalFrameCaptureRunning = false;

const UNIVERSAL_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop';
const CATEGORY_FALLBACKS: Record<string, string> = {
    'Memes': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop',
    'Bollywood': 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop',
    'Fitness': 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop',
    'Sports': 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&auto=format&fit=crop',
    'Lifestyle': 'https://images.unsplash.com/photo-1511988617509-a57c8a288659?w=600&auto=format&fit=crop',
    'Gaming': 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop',
    'Nature': 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&auto=format&fit=crop',
    'Food': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop',
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
    const clean = url.split('#')[0].split('?')[0];
    if (clean.includes('/stories/') && clean.endsWith('.mp4')) {
        return clean.replace('/stories/', '/stories/posters/').replace(/\.mp4$/i, '.jpg');
    }
    if (clean.includes('/posts/') && clean.endsWith('.mp4')) {
        return clean.replace('/posts/', '/posts/posters/').replace(/\.mp4$/i, '.jpg');
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
    const isVideo = isVideoPost(post) || isVideoUrl(post.image_url);

    // ⚡ On mobile devices, request 380px for feed thumbnails to cut GPU texture memory & decoding cost by 50%+
    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth <= 640;
    const targetWidth = isMobileScreen && thumbnail ? 380 : 600;

    const [currentImgSrc, setCurrentImgSrc] = useState<string>(() => {
        return isVideo ? '' : getOptimizedImageUrl(post.image_url, targetWidth);
    });

    const cleanUrl = post.image_url ? post.image_url.split('#')[0].split('?')[0] : '';
    const resolvedPosterFromUrl = extractPosterFromUrl(post.image_url);
    const [capturedPoster, setCapturedPoster] = useState<string | undefined>(() => {
        if (isVideo && cleanUrl) {
            return videoPosterCache.get(cleanUrl) || resolvedPosterFromUrl;
        }
        return resolvedPosterFromUrl;
    });
    const [videoHasVisual, setVideoHasVisual] = useState<boolean>(true);
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
        }, { rootMargin: '250px' });

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
        setVideoHasVisual(true);
        retryCountRef.current = 0;
        fallbackUsedRef.current = false;
        setCurrentImgSrc(isVideo ? '' : getOptimizedImageUrl(post.image_url, targetWidth));
        const posterFromUrl = extractPosterFromUrl(post.image_url);
        if (posterFromUrl && cleanUrl) {
            videoPosterCache.set(cleanUrl, posterFromUrl);
            setCapturedPoster(posterFromUrl);
        } else if (isVideo && cleanUrl) {
            const cached = videoPosterCache.get(cleanUrl);
            if (cached) setCapturedPoster(cached);
        }
    }, [post.image_url, isVideo, cleanUrl, targetWidth]);

    const captureFrame = useCallback(() => {
        if (isPlayingMode || isGlobalFrameCaptureRunning) return;
        const video = videoRef.current;
        if (!video || !video.videoWidth || !video.videoHeight || video.readyState < 2) return;

        // ⚡ Defer frame capture to idle callback to avoid interrupting active touch scrolling
        const deferFn = typeof (window as any).requestIdleCallback === 'function'
            ? (window as any).requestIdleCallback
            : (cb: () => void) => setTimeout(cb, 80);

        deferFn(() => {
            if (isGlobalFrameCaptureRunning) return;
            const v = videoRef.current;
            if (!v || !v.videoWidth || !v.videoHeight || v.readyState < 2) return;
            isGlobalFrameCaptureRunning = true;
            try {
                const canvas = document.createElement('canvas');
                const scale = Math.min(1, 320 / v.videoWidth);
                canvas.width = Math.round(v.videoWidth * scale);
                canvas.height = Math.round(v.videoHeight * scale);
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
                    if (dataUrl && dataUrl.length > 200) {
                        videoPosterCache.set(cleanUrl, dataUrl);
                        setCapturedPoster(dataUrl);

                        // Persist up to 25 recent poster frames to sessionStorage
                        try {
                            const cacheObj: Record<string, string> = {};
                            let count = 0;
                            for (const [k, val] of videoPosterCache.entries()) {
                                if (count++ > 25) break;
                                cacheObj[k] = val;
                            }
                            sessionStorage.setItem('knock_video_posters', JSON.stringify(cacheObj));
                        } catch (_) {}
                    }
                }
            } catch (_) {
                // Keep video element as fallback
            } finally {
                isGlobalFrameCaptureRunning = false;
            }
        });
    }, [isPlayingMode, cleanUrl]);

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
            if (video.paused) {
                video.play().then(() => setIsPlaying(true)).catch(() => {});
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

    // Handle video play/pause & sound with resilient dual-stage autoplay
    useEffect(() => {
        if (!isVideo) return;
        const video = videoRef.current;
        if (!video) return;

        let isCancelled = false;

        if (autoPlay || soundOn) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        if (!isCancelled) {
                            setIsPlaying(true);
                            if (!video.muted) {
                                setIsAudioBlocked(false);
                            }
                        }
                    })
                    .catch((err) => {
                        if (isCancelled) return;
                        // If unmuted autoplay failed due to browser policy, fallback to muted autoplay so video never freezes!
                        if (!hasMusic && !video.muted) {
                            setIsAutoplayFallbackMuted(true);
                            setIsAudioBlocked(true);
                            video.muted = true;
                            video.play().then(() => {
                                if (!isCancelled) setIsPlaying(true);
                            }).catch(() => {});
                        }
                    });
            }
        } else {
            video.pause();
            setIsPlaying(false);
        }

        return () => {
            isCancelled = true;
            try {
                video.pause();
                if (isPlayingMode || thumbnail) {
                    video.removeAttribute('src');
                    video.load();
                }
            } catch (_) {}
        };
    }, [soundOn, isVideo, autoPlay, post.image_url, hasMusic, isPlayingMode]);

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
                video.play().then(() => {
                    setIsPlaying(true);
                    setShowPlayPauseIcon('play');
                    if (onTogglePlay) onTogglePlay(true);
                }).catch(() => {});
                if (audioRef.current && hasMusic && !domMuted) {
                    audioRef.current.play().catch(() => {});
                }
            } else {
                video.pause();
                setIsPlaying(false);
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
    }, [isPlayingMode, isAudioBlocked, handleUnmute, isVideo, onDoubleTapLike, onTogglePlay, hasMusic, domMuted]);

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
                audio.removeAttribute('src');
                audio.load();
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

    // Retry handler: automatically switches to high-quality fallback image on failure
    const handleMediaError = () => {
        if (!isVideo && !fallbackUsedRef.current) {
            fallbackUsedRef.current = true;
            const category = (post as any)?.category;
            const fallback = (category && CATEGORY_FALLBACKS[category]) || UNIVERSAL_FALLBACK_IMAGE;
            setCurrentImgSrc(fallback);
            setHasError(false);
            return;
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

    if (hasError || !post.image_url) {
        return (
            <div 
                className={className}
                style={{
                    width: '100%',
                    height: style?.height || '100%',
                    minHeight: style?.minHeight || '0px',
                    background: 'linear-gradient(135deg, #1c1c1e, #2c2c2e)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-inactive)',
                    fontSize: '18px',
                    ...style
                }}
            >
                {isVideo ? '🎬' : '📷'}
            </div>
        );
    }

    // Clean video URLs and ensure fresh cache-busted playback for Supabase storage
    let cleanImageUrl = post.image_url;
    try {
        if (post.image_url) {
            const parsed = new URL(post.image_url);
            if (parsed.searchParams.has('filter')) {
                parsed.searchParams.delete('filter');
            }
            if (isVideo && parsed.hostname.includes('supabase.co') && !parsed.searchParams.has('v')) {
                parsed.searchParams.set('v', 'h264_v2');
            }
            cleanImageUrl = parsed.toString();
        }
    } catch (_) {}

    // When playing mode is active, do NOT append #t=... as it disrupts progressive streaming, byte seeking, and looping
    // For thumbnails, use #t=0.1 so the video renders a visible frame instead of a black box
    const videoSrc = isVideo
        ? (isPlayingMode
            ? cleanImageUrl.replace(/#t=[\d.]+/, '')
            : (cleanImageUrl.includes('#t=') ? cleanImageUrl : `${cleanImageUrl}#t=0.1`))
        : '';

    const resolvedObjectFit = objectFit || style?.objectFit || (controls || soundOn ? 'contain' : 'cover');

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
                    {thumbnail && !isPlayingMode && (capturedPoster || resolvedPosterFromUrl) ? (
                        /* ⚡ Captured static poster image — unmounts video element and frees hardware decoder! */
                        <img
                            src={capturedPoster || resolvedPosterFromUrl}
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
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onError={() => {
                                setCapturedPoster(undefined);
                                videoPosterCache.delete(cleanUrl);
                            }}
                        />
                    ) : !isInView && thumbnail && !isPlayingMode ? (
                        /* ⚡ Off-screen thumbnail placeholder: 0 decoders, 0 network bandwidth until scrolled into view! */
                        <div
                            className={className}
                            style={{
                                ...style,
                                width: '100%',
                                height: '100%',
                                minHeight: style?.minHeight || '160px',
                                background: 'linear-gradient(135deg, #18181b 0%, #1f1f23 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'rgba(0,0,0,0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <Play size={16} fill="rgba(255,255,255,0.4)" color="transparent" style={{ marginLeft: '2px' }} />
                            </div>
                        </div>
                    ) : (
                        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                            <video
                                ref={videoRef}
                                src={videoSrc}
                                poster={capturedPoster || resolvedPosterFromUrl}
                                crossOrigin={videoCrossOrigin}
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
                                preload={isPlayingMode ? "auto" : "metadata"}
                                onError={() => {
                                    setVideoHasVisual(false);
                                    handleMediaError();
                                }}
                                onLoadedMetadata={(e) => {
                                    const v = e.currentTarget;
                                    if (!isPlayingMode && v.currentTime === 0) {
                                        try {
                                            v.currentTime = 0.1;
                                        } catch (_) {}
                                    }
                                }}
                                onLoadedData={() => {
                                    setIsLoaded(true);
                                    captureFrame();
                                }}
                                onSeeked={captureFrame}
                                onTimeUpdate={(e) => {
                                    const v = e.currentTarget;
                                    if (isPlayingMode && v.duration && progressBarRef.current) {
                                        const pct = (v.currentTime / v.duration) * 100;
                                        progressBarRef.current.style.width = `${pct}%`;
                                    }
                                    if (v.currentTime > 0.4) {
                                        const quality = typeof (v as any).getVideoPlaybackQuality === 'function' ? (v as any).getVideoPlaybackQuality() : null;
                                        const decoded = quality?.totalVideoFrames ?? (v as any).webkitDecodedFrameCount;
                                        if (decoded !== undefined && decoded === 0) {
                                            if (videoHasVisual) setVideoHasVisual(false);
                                        } else if (decoded && decoded > 0) {
                                            if (!videoHasVisual) setVideoHasVisual(true);
                                        }
                                    }
                                }}
                                onMouseEnter={() => {
                                    if (!isPlayingMode && videoRef.current && window.matchMedia?.('(hover: hover)').matches) {
                                        videoRef.current.muted = true;
                                        videoRef.current.play().catch(() => {});
                                    }
                                }}
                                onMouseLeave={() => {
                                    if (!isPlayingMode && videoRef.current && window.matchMedia?.('(hover: hover)').matches) {
                                        videoRef.current.pause();
                                    }
                                }}
                            />

                            {/* Fallback Display if Browser Cannot Decode Video Track (Audio Plays Uninterrupted with Sharp Picture!) */}
                            {!videoHasVisual && (capturedPoster || resolvedPosterFromUrl) && (
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#09090b',
                                    overflow: 'hidden',
                                    zIndex: 10,
                                    pointerEvents: 'none'
                                }}>
                                    <img 
                                        src={capturedPoster || resolvedPosterFromUrl} 
                                        alt={alt || "Video preview"}
                                        style={{ 
                                            width: '100%', 
                                            height: '100%', 
                                            objectFit: resolvedObjectFit,
                                            filter: extractedFilter
                                        }} 
                                    />
                                </div>
                            )}
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
                    loading="lazy"
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
