import React, { useRef, useEffect, useState, memo, useCallback } from 'react';
import { VolumeX } from 'lucide-react';
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
}

// In-memory cache for resolved iTunes preview URLs to prevent redundant network fetches
const itunesCache = new Map<string, string>();

// High-performance shared IntersectionObserver singleton to prevent allocating dozens of observers
type ViewportCallback = (isIntersecting: boolean) => void;
const viewportCallbacks = new Map<Element, ViewportCallback>();
let sharedViewportObserver: IntersectionObserver | null = null;

function getSharedViewportObserver(): IntersectionObserver | null {
    if (typeof IntersectionObserver === 'undefined') return null;
    if (!sharedViewportObserver) {
        sharedViewportObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const cb = viewportCallbacks.get(entry.target);
                if (cb) {
                    cb(entry.isIntersecting);
                }
            });
        }, { rootMargin: '350px' });
    }
    return sharedViewportObserver;
}

function observeViewport(el: Element, cb: ViewportCallback) {
    const obs = getSharedViewportObserver();
    if (!obs) {
        cb(true);
        return () => {};
    }
    viewportCallbacks.set(el, cb);
    obs.observe(el);
    return () => {
        viewportCallbacks.delete(el);
        obs.unobserve(el);
    };
}

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
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isPlayingMode = autoPlay || soundOn || controls;
    const [isInViewport, setIsInViewport] = useState(isPlayingMode);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isAudioBlocked, setIsAudioBlocked] = useState(false);
    const retryCountRef = useRef(0);
    const fallbackUsedRef = useRef(false);
    const isVideo = isVideoPost(post) || isVideoUrl(post.image_url);

    useEffect(() => {
        if (isPlayingMode) {
            setIsInViewport(true);
            return;
        }
        const el = containerRef.current;
        if (!el) {
            setIsInViewport(true);
            return;
        }

        const unobserve = observeViewport(el, (isIntersecting) => {
            setIsInViewport(isIntersecting);
        });

        return unobserve;
    }, [isPlayingMode]);

    const targetWidth = thumbnail ? 350 : (isPlayingMode ? 650 : 350);

    const [currentImgSrc, setCurrentImgSrc] = useState<string>(() => {
        return isVideo ? '' : getOptimizedImageUrl(post.image_url, targetWidth);
    });

    useEffect(() => {
        setHasError(false);
        setIsAudioBlocked(false);
        setIsLoaded(false);
        retryCountRef.current = 0;
        fallbackUsedRef.current = false;
        setCurrentImgSrc(isVideo ? '' : getOptimizedImageUrl(post.image_url, targetWidth));
    }, [post.image_url, isVideo, targetWidth]);

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

    const isAudioActive = soundOn || (autoPlay && !effectiveMuted);

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
        const video = videoRef.current;
        if (video) {
            video.muted = false;
            video.volume = 1;
            if (video.paused) {
                video.play().catch(() => {});
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
        setIsAudioBlocked(false);
    }, [hasMusic]);

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

    // Handle video play/pause & sound with resilient dual-stage autoplay
    useEffect(() => {
        if (!isVideo) return;
        const video = videoRef.current;
        if (!video) return;

        let isCancelled = false;

        // If post has music attached, force video element to remain muted
        if (hasMusic) {
            video.muted = true;
        } else {
            video.muted = effectiveMuted;
            if (!effectiveMuted) {
                video.volume = 1;
            }
        }

        if (autoPlay || soundOn) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        if (!isCancelled && !video.muted) {
                            setIsAudioBlocked(false);
                        }
                    })
                    .catch((err) => {
                        if (isCancelled) return;
                        console.warn('[PostMedia] Video autoplay rejected by browser policy:', err);
                        // If unmuted autoplay failed due to browser policy, fallback to muted autoplay so video never freezes!
                        if (!video.muted && !hasMusic) {
                            video.muted = true;
                            setIsAudioBlocked(true);
                            video.play().catch(() => {});
                        }
                    });
            }
        } else {
            video.pause();
        }

        return () => {
            isCancelled = true;
        };
    }, [soundOn, isVideo, autoPlay, post.image_url, hasMusic, effectiveMuted]);

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
            audio.pause();
            audio.currentTime = 0;
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
            style={{ 
                position: 'relative', 
                width: '100%', 
                height: style?.height || '100%', 
                minHeight: style?.minHeight || '0px',
                backgroundColor: '#18181b',
                overflow: 'hidden'
            }}
        >
            {isVideo ? (
                <>
                    <video
                        ref={videoRef}
                        src={isInViewport || isPlayingMode ? videoSrc : undefined}
                        className={className}
                        style={{
                            ...style,
                            filter: extractedFilter,
                            width: '100%',
                            height: '100%',
                            objectFit: resolvedObjectFit,
                            display: 'block',
                            opacity: isLoaded || isPlayingMode ? 1 : 0,
                            transition: 'opacity 0.25s ease-out'
                        }}
                        muted={effectiveMuted}
                        controls={controls}
                        autoPlay={autoPlay || soundOn}
                        loop={loop}
                        playsInline={playsInline}
                        // @ts-ignore
                        webkit-playsinline="true"
                        x5-playsinline="true"
                        preload={isPlayingMode ? "auto" : (isInViewport ? "metadata" : "none")}
                        onError={handleMediaError}
                        onLoadedData={() => setIsLoaded(true)}
                        onLoadedMetadata={(e) => {
                            setIsLoaded(true);
                            const v = e.currentTarget;
                            if (!isPlayingMode) {
                                try {
                                    if (v.currentTime < 0.1) {
                                        v.currentTime = 0.1;
                                    }
                                } catch (_) {}
                            }
                        }}
                        onMouseEnter={() => {
                            if (!isPlayingMode && videoRef.current) {
                                videoRef.current.muted = true;
                                videoRef.current.play().catch(() => {});
                            }
                        }}
                        onMouseLeave={() => {
                            if (!isPlayingMode && videoRef.current) {
                                videoRef.current.pause();
                                try {
                                    videoRef.current.currentTime = 0.1;
                                } catch (_) {}
                            }
                        }}
                        onClick={(e) => {
                            if (isAudioBlocked) {
                                handleUnmute(e);
                            }
                        }}
                    />

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
                                background: 'rgba(0, 0, 0, 0.82)',
                                backdropFilter: 'blur(12px)',
                                WebkitBackdropFilter: 'blur(12px)',
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
                        opacity: isLoaded ? 1 : 0,
                        transition: 'opacity 0.25s ease-out'
                    }}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onLoad={() => setIsLoaded(true)}
                    onError={handleMediaError}
                />
            )}
            
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
