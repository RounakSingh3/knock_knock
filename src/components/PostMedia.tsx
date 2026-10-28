import React, { useRef, useEffect, useState, memo, useCallback } from 'react';
import { VolumeX, Play, Pause, Heart } from 'lucide-react';
import { isVideoPost, isVideoUrl, getOptimizedImageUrl, getCleanSongUrl } from '../lib/media';
import { resolveLocalMediaUrl, initLocalMediaRegistry, isLocalMediaReady } from '../lib/localMedia';
import { audioPlayer } from '../lib/audioPlayer';
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
    preload?: 'auto' | 'metadata' | 'none';
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
                if (typeof v === 'string' && !v.includes('photo-1618005182384-a83a8bd57fbe')) {
                    videoPosterCache.set(k, v);
                }
            });
        }
    }
} catch (_) {}

export const INLINE_FALLBACK_SVG = 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22600%22%20viewBox%3D%220%200%20600%20600%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22bg%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%2318181b%22%2F%3E%3Cstop%20offset%3D%2250%25%22%20stop-color%3D%22%2327272a%22%2F%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%2318181b%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%22600%22%20height%3D%22600%22%20fill%3D%22url(%23bg)%22%2F%3E%3Ccircle%20cx%3D%22300%22%20cy%3D%22300%22%20r%3D%2236%22%20fill%3D%22rgba(255%2C255%2C255%2C0.08)%22%2F%3E%3Cpolygon%20points%3D%22292%2C288%20314%2C300%20292%2C312%22%20fill%3D%22%23f5a524%22%2F%3E%3C%2Fsvg%3E';

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

export const isFallbackPoster = (url?: string | null): boolean => {
    if (!url) return true;
    if (url === UNIVERSAL_FALLBACK_IMAGE) return true;
    if (url === INLINE_FALLBACK_SVG) return true;
    if (url.includes('photo-1618005182384-a83a8bd57fbe')) return true;
    if (url.includes('photo-1518770660439-4636190af475')) return true;
    if (url.startsWith('data:image/svg+xml')) return true;
    for (const fb of Object.values(CATEGORY_FALLBACKS)) {
        if (url === fb) return true;
    }
    return false;
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
            const extracted = decodeURIComponent(url.split('#POSTER:')[1]?.split('#')[0] || '');
            if (extracted) return resolveLocalMediaUrl(extracted).split('#')[0];
        } catch (_) {
            const raw = url.split('#POSTER:')[1]?.split('#')[0];
            return raw ? resolveLocalMediaUrl(raw).split('#')[0] : undefined;
        }
    }
    // Local bundled videos poster mapping
    if (url.includes('/videos/sonambajwa.mp4')) {
        return '/videos/sonambajwa_poster.jpg';
    }
    // Pexels video poster mapping
    if (url.includes('pexels.com/video-files/')) {
        const m = url.match(/video-files\/(\d+)\//);
        if (m && m[1]) {
            return `https://images.pexels.com/videos/${m[1]}/free-video-${m[1]}.jpg?auto=compress&w=500`;
        }
    }
    // Supabase posts video poster mapping
    if (url.includes('/posts/') && url.includes('.mp4')) {
        const clean = url.split('?')[0].split('#')[0];
        return clean.replace('/posts/', '/posts/posters/').replace(/\.mp4$/, '.jpg');
    }
    return undefined;
};

// ⚡ Global sequential background poster extractor (max 1 decoder at a time across the entire app)
// Ensures 0 persistent <video> decoders in grid thumbnails while capturing authentic frames.
interface PosterQueueItem {
    videoSrc: string;
    cleanUrl: string;
    callbacks: Array<(posterDataUrl: string) => void>;
}
const posterCaptureQueue: PosterQueueItem[] = [];
const failedPosterCaptureUrls = new Set<string>();
let isCapturingPoster = false;

function processPosterQueue(): void {
    if (isCapturingPoster || posterCaptureQueue.length === 0 || typeof document === 'undefined') return;
    const next = posterCaptureQueue.shift()!;
    const existing = videoPosterCache.get(next.cleanUrl);
    if (existing && !isFallbackPoster(existing)) {
        next.callbacks.forEach(cb => cb(existing));
        processPosterQueue();
        return;
    }
    if (failedPosterCaptureUrls.has(next.cleanUrl)) {
        processPosterQueue();
        return;
    }

    isCapturingPoster = true;
    const vid = document.createElement('video');
    vid.muted = true;
    vid.playsInline = true;
    vid.preload = 'metadata';
    if (!next.videoSrc.startsWith('blob:') && !next.videoSrc.startsWith('data:')) {
        vid.crossOrigin = 'anonymous';
    }

    let finished = false;
    const cleanup = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        try {
            vid.onloadeddata = null;
            vid.onseeked = null;
            vid.onerror = null;
            vid.pause();
            vid.removeAttribute('src');
            vid.load();
        } catch (_) {}
        isCapturingPoster = false;
        setTimeout(processPosterQueue, 16);
    };

    const timeoutId = setTimeout(() => {
        failedPosterCaptureUrls.add(next.cleanUrl);
        cleanup();
    }, 3500);

    const captureFrame = () => {
        if (finished) return;
        try {
            const vw = vid.videoWidth || 240;
            const vh = vid.videoHeight || 320;
            const maxDim = 280;
            const scale = Math.min(1, maxDim / Math.max(vw, vh));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(vw * scale));
            canvas.height = Math.max(1, Math.round(vh * scale));
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
                if (dataUrl && dataUrl.length > 200) {
                    videoPosterCache.set(next.cleanUrl, dataUrl);
                    next.callbacks.forEach(cb => cb(dataUrl));
                }
            }
        } catch (_) {
            failedPosterCaptureUrls.add(next.cleanUrl);
        } finally {
            cleanup();
        }
    };

    vid.onloadeddata = () => {
        try {
            vid.currentTime = 0.05;
        } catch (_) {
            captureFrame();
        }
    };
    vid.onseeked = captureFrame;
    vid.onerror = () => {
        failedPosterCaptureUrls.add(next.cleanUrl);
        cleanup();
    };
    vid.src = next.videoSrc;
}

function enqueueBackgroundPosterCapture(videoSrc: string, cleanUrl: string, onCaptured: (posterDataUrl: string) => void): void {
    if (!videoSrc || !cleanUrl || failedPosterCaptureUrls.has(cleanUrl)) return;
    const cached = videoPosterCache.get(cleanUrl);
    if (cached && !isFallbackPoster(cached)) {
        onCaptured(cached);
        return;
    }
    const existingItem = posterCaptureQueue.find(item => item.cleanUrl === cleanUrl);
    if (existingItem) {
        existingItem.callbacks.push(onCaptured);
        return;
    }
    posterCaptureQueue.push({ videoSrc, cleanUrl, callbacks: [onCaptured] });
    processPosterQueue();
}

export const extractFallbackFromUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (url.includes('#FALLBACK:')) {
        try {
            return decodeURIComponent(url.split('#FALLBACK:')[1]?.split('#')[0] || '');
        } catch (_) {
            return url.split('#FALLBACK:')[1]?.split('#')[0];
        }
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
    preload,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isPlayingMode = autoPlay || soundOn || controls;
    const [isLoaded, setIsLoaded] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    const [, setLocalMediaReadyTick] = useState(0);

    // Re-resolve local IndexedDB media URLs if mounted before IndexedDB finishes initializing on cold refresh
    useEffect(() => {
        const hasLocalTag = Boolean(
            post.image_url && (post.image_url.includes('#LOCAL_ID:') || post.image_url.startsWith('local-media://') || post.image_url.includes('local-media-'))
        );
        if (hasLocalTag && !isLocalMediaReady()) {
            let active = true;
            initLocalMediaRegistry().then(() => {
                if (active) setLocalMediaReadyTick(t => t + 1);
            });
            return () => { active = false; };
        }
    }, [post.image_url]);

    const effectiveImageUrl = resolveLocalMediaUrl(post.image_url);
    const isVideo = isVideoPost(post) || isVideoUrl(effectiveImageUrl);

    // ⚡ On mobile devices, request 380px for feed thumbnails to cut GPU texture memory, and 1080px for full-screen viewer
    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth <= 640;
    const targetWidth = isMobileScreen && thumbnail ? 380 : (thumbnail ? 600 : 1080);

    const [currentImgSrc, setCurrentImgSrc] = useState<string>(() => {
        return isVideo ? '' : getOptimizedImageUrl(effectiveImageUrl, targetWidth);
    });

    const cleanUrl = effectiveImageUrl ? effectiveImageUrl.split('#')[0].split('?')[0] : '';

    // Clean video URL: strip ALL hash fragments (#POSTER:, #FALLBACK:, #BOOST:, etc.) and filter query
    let cleanVideoUrl = '';
    if (effectiveImageUrl) {
        const rawNoHash = effectiveImageUrl.split('#')[0];
        if (rawNoHash.startsWith('blob:') || rawNoHash.startsWith('data:')) {
            cleanVideoUrl = rawNoHash;
        } else {
            try {
                const parsed = new URL(rawNoHash, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
                if (parsed.searchParams.has('filter')) {
                    parsed.searchParams.delete('filter');
                }
                cleanVideoUrl = rawNoHash.startsWith('http') ? parsed.toString() : (parsed.pathname + parsed.search);
            } catch (_) {
                cleanVideoUrl = rawNoHash;
            }
        }
    }

    const [fallbackVideoSrc, setFallbackVideoSrc] = useState<string | null>(null);

    // Pure clean URL for seamless progressive streaming without pipeline resets
    const videoSrc = isVideo ? (fallbackVideoSrc || cleanVideoUrl) : '';
    const resolvedPosterFromUrl = extractPosterFromUrl(effectiveImageUrl);
    const categoryFallbackPoster = getFallbackPoster(post as any);
    const [capturedPoster, setCapturedPoster] = useState<string>(() => {
        if (isVideo && cleanUrl) {
            const cached = videoPosterCache.get(cleanUrl);
            if (cached && !isFallbackPoster(cached)) return cached;
            if (resolvedPosterFromUrl && !isFallbackPoster(resolvedPosterFromUrl)) return resolvedPosterFromUrl;
            return '';
        }
        return resolvedPosterFromUrl || (isVideo ? '' : categoryFallbackPoster);
    });
    const [posterImageFailed, setPosterImageFailed] = useState<boolean>(false);
    const [videoCrossOrigin, setVideoCrossOrigin] = useState<"anonymous" | undefined>(() => thumbnail ? "anonymous" : undefined);

    const hasRealPoster = !posterImageFailed && Boolean(
        (capturedPoster && !isFallbackPoster(capturedPoster)) ||
        (resolvedPosterFromUrl && !isFallbackPoster(resolvedPosterFromUrl))
    );
    const effectiveRealPoster = !posterImageFailed ? (
        (capturedPoster && !isFallbackPoster(capturedPoster))
            ? capturedPoster
            : (resolvedPosterFromUrl && !isFallbackPoster(resolvedPosterFromUrl))
                ? resolvedPosterFromUrl
                : ''
    ) : '';

    // ⚡ Viewport-aware video lazy mounting: do NOT mount native video decoders if thumbnail is off-screen
    const [isInView, setIsInView] = useState(() => !thumbnail || isPlayingMode || hasRealPoster);

    useEffect(() => {
        if (!thumbnail || isPlayingMode || hasRealPoster) {
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
    }, [thumbnail, isPlayingMode, hasRealPoster]);

    // ⚡ If a thumbnail video lacks a poster and enters the viewport, queue sequential 1-at-a-time frame capture
    useEffect(() => {
        if (!isVideo || !thumbnail || isPlayingMode || hasRealPoster || !isInView || !videoSrc || !cleanUrl) {
            return;
        }
        let active = true;
        enqueueBackgroundPosterCapture(videoSrc, cleanUrl, (posterDataUrl) => {
            if (active && posterDataUrl) {
                setPosterImageFailed(false);
                setCapturedPoster(posterDataUrl);
            }
        });
        return () => { active = false; };
    }, [isVideo, thumbnail, isPlayingMode, hasRealPoster, isInView, videoSrc, cleanUrl]);

    useEffect(() => {
        setHasError(false);
        setIsAudioBlocked(false);
        setIsLoaded(false);
        setPosterImageFailed(false);
        retryCountRef.current = 0;
        fallbackUsedRef.current = false;
        setCurrentImgSrc(isVideo ? '' : getOptimizedImageUrl(effectiveImageUrl, targetWidth));
        const posterFromUrl = extractPosterFromUrl(effectiveImageUrl);
        const fb = getFallbackPoster(post as any);
        if (cleanUrl) {
            const cached = videoPosterCache.get(cleanUrl);
            const validCached = cached && !isFallbackPoster(cached) ? cached : undefined;
            const validUrlPoster = posterFromUrl && !isFallbackPoster(posterFromUrl) ? posterFromUrl : undefined;
            const bestPoster = validUrlPoster || validCached || (isVideo ? '' : fb);
            if (bestPoster && !isFallbackPoster(bestPoster)) {
                videoPosterCache.set(cleanUrl, bestPoster);
            }
            setCapturedPoster(bestPoster);
        } else {
            const validUrlPoster = posterFromUrl && !isFallbackPoster(posterFromUrl) ? posterFromUrl : undefined;
            setCapturedPoster(validUrlPoster || (isVideo ? '' : fb));
        }
    }, [effectiveImageUrl, isVideo, cleanUrl, targetWidth]);


    const effectiveMusicUrl = resolveLocalMediaUrl(post.music_url);
    const staticCleanUrl = getCleanSongUrl(post.music_title, effectiveMusicUrl);
    const isDirectCleanUrl = effectiveMusicUrl && !effectiveMusicUrl.includes('soundhelix');
    const queryKey = post.music_title ? `${post.music_title} ${post.music_artist || ''}`.trim().toLowerCase() : '';
    
    const [asyncMusicUrl, setAsyncMusicUrl] = useState<string | undefined>(() => {
        if (staticCleanUrl) return staticCleanUrl;
        if (isDirectCleanUrl) return effectiveMusicUrl!;
        if (queryKey && itunesCache.has(queryKey)) return itunesCache.get(queryKey);
        return undefined;
    });

    const resolvedMusicUrl = staticCleanUrl || (isDirectCleanUrl ? effectiveMusicUrl : asyncMusicUrl);
    const hasMusic = Boolean(resolvedMusicUrl);

    // Track whether user explicitly requested audio (unmuted or soundOn)
    const userWantsAudio = soundOn || muted === false;

    // Reset autoplay fallback flags whenever audio is explicitly requested
    useEffect(() => {
        if (userWantsAudio) {
            setIsAutoplayFallbackMuted(false);
            setIsAudioBlocked(false);
        }
    }, [userWantsAudio]);

    // Always allow original video audio (voice) to play when unmuted / soundOn, even if background music is also attached!
    const effectiveMuted = muted !== undefined ? muted : (soundOn ? false : true);

    // Fallback-aware DOM muted state:
    // When user explicitly wants sound, bypass isAutoplayFallbackMuted entirely!
    const domMuted = userWantsAudio ? false : (isAutoplayFallbackMuted || effectiveMuted);
    const isAudioActive = userWantsAudio || (autoPlay && !domMuted);

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
            video.muted = false;
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
        if (audio && hasMusic && resolvedMusicUrl) {
            audio.muted = false;
            audio.volume = isVideo ? 0.35 : 1;
            if (audio.paused) {
                audio.play().catch(() => {
                    try {
                        audioPlayer.play(resolvedMusicUrl);
                    } catch (_) {}
                });
            }
        } else if (hasMusic && resolvedMusicUrl) {
            try {
                audioPlayer.play(resolvedMusicUrl);
            } catch (_) {}
        }
    }, [hasMusic, isVideo, resolvedMusicUrl, onMuteChange]);

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
            if (video.paused && (autoPlay || soundOn)) {
                video.play().catch(() => {});
            }
        }
    }, [isVideo, domMuted, autoPlay, soundOn]);

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

        // Ensure video element src attribute is present
        if (videoSrc && (!video.getAttribute('src') || video.getAttribute('src') === '')) {
            video.src = videoSrc;
        }

        if (autoPlay || soundOn) {
            video.muted = domMutedRef.current;
            // Guard against overlapping play requests on the same media element
            if (playPromiseRef.current) return;
            // ⚡ Zero-interruption: If already actively playing, don't restart play cycle
            if (!video.paused) {
                setIsPlaying(true);
                return;
            }

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
    }, [isVideo, autoPlay, soundOn, videoSrc, safePause]);

    // Handle video play/pause based on props (does not pause during ongoing playback)
    useEffect(() => {
        if (!isVideo) return;
        if (autoPlay || soundOn) {
            startPlayback();
        } else {
            safePause();
        }
    }, [isVideo, autoPlay, soundOn, startPlayback, safePause]);

    // Pause cleanly when component unmounts
    useEffect(() => {
        return () => {
            safePause();
            if (bufferingTimeoutRef.current) {
                clearTimeout(bufferingTimeoutRef.current);
                bufferingTimeoutRef.current = null;
            }
        };
    }, [safePause]);

    // Debounced buffer & playback event handlers to prevent spinner flashing on micro-stalls
    const handleWaiting = useCallback(() => {
        if (!isPlayingMode) return;
        if (!bufferingTimeoutRef.current) {
            bufferingTimeoutRef.current = setTimeout(() => {
                setIsBuffering(true);
            }, 250);
        }
    }, [isPlayingMode]);

    const handlePlaying = useCallback(() => {
        if (bufferingTimeoutRef.current) {
            clearTimeout(bufferingTimeoutRef.current);
            bufferingTimeoutRef.current = null;
        }
        setIsBuffering(false);
        setIsLoaded(true);
    }, []);

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

        // Single tap — if audio was blocked or video is currently muted, unmute on tap so user immediately hears voice
        if (isAudioBlocked || domMuted || (videoRef.current && videoRef.current.muted)) {
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
            audio.volume = isVideo ? 0.35 : 1;
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
                        try {
                            audioPlayer.play(resolvedMusicUrl);
                        } catch (_) {}
                        const onUserTap = () => {
                            if (isCancelled) return;
                            audio.muted = false;
                            audio.volume = 1;
                            audio.play().then(() => setIsAudioBlocked(false)).catch(() => {
                                try {
                                    audioPlayer.play(resolvedMusicUrl);
                                } catch (_) {}
                            });
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
            try {
                if (audioPlayer.isPlaying()) {
                    audioPlayer.stop();
                }
            } catch (_) {}
        }

        return () => {
            isCancelled = true;
            if (cleanupTap) cleanupTap();
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (_) {}
            try {
                audioPlayer.stop();
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
        if (isVideo && !fallbackUsedRef.current) {
            fallbackUsedRef.current = true;
            const fallbackUrl = extractFallbackFromUrl(post.image_url);
            if (fallbackUrl && fallbackUrl !== videoSrc) {
                setFallbackVideoSrc(fallbackUrl);
                setHasError(false);
                return;
            }
            if ((cleanUrl.includes('1790250320016') || post.caption?.includes('sonambajwa')) && !videoSrc.includes('sonambajwa.mp4')) {
                setFallbackVideoSrc('/videos/sonambajwa.mp4');
                setHasError(false);
                return;
            }
            if (!isPlayingMode) {
                const poster = extractPosterFromUrl(post.image_url);
                if (poster) {
                    setCapturedPoster(poster);
                    setPosterImageFailed(false);
                    setHasError(false);
                    return;
                }
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
        const poster = hasRealPoster ? effectiveRealPoster : (thumbnail ? (categoryFallbackPoster || getFallbackPoster(post)) : undefined);
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
                        onError={(e) => {
                            const target = e.currentTarget;
                            if (target.src !== INLINE_FALLBACK_SVG) {
                                target.src = INLINE_FALLBACK_SVG;
                            }
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
                                src={(hasRealPoster && effectiveRealPoster) ? effectiveRealPoster : (capturedPoster || categoryFallbackPoster || UNIVERSAL_FALLBACK_IMAGE)}
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
                                    if (hasRealPoster && !posterImageFailed) {
                                        setPosterImageFailed(true);
                                    } else {
                                        const target = e.currentTarget;
                                        if (target.src !== INLINE_FALLBACK_SVG) {
                                            target.src = INLINE_FALLBACK_SVG;
                                        }
                                    }
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
                                poster={hasRealPoster ? effectiveRealPoster : undefined}
                                className={className}
                                style={{
                                    ...style,
                                    filter: extractedFilter,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: resolvedObjectFit,
                                    display: 'block',
                                    transform: 'translateZ(0)',
                                    WebkitTransform: 'translateZ(0)',
                                    backfaceVisibility: 'hidden',
                                    WebkitBackfaceVisibility: 'hidden',
                                    willChange: 'transform',
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
                                preload={preload || (autoPlay || soundOn ? 'auto' : 'metadata')}
                                onError={() => {
                                    setIsBuffering(false);
                                    handleMediaError();
                                }}
                                onWaiting={handleWaiting}
                                onPlaying={handlePlaying}
                                onCanPlay={() => {
                                    handlePlaying();
                                    if (isPlayingMode && (autoPlay || soundOn)) {
                                        startPlayback();
                                    }
                                }}
                                onLoadedData={() => {
                                    handlePlaying();
                                    if (isPlayingMode && (autoPlay || soundOn)) {
                                        startPlayback();
                                    }
                                }}
                                onEnded={(e) => {
                                    if (loop) {
                                        const v = e.currentTarget;
                                        v.currentTime = 0;
                                        const p = v.play();
                                        if (p !== undefined) p.catch(() => {});
                                    }
                                }}
                                onLoadedMetadata={() => {
                                    if (isPlayingMode && (autoPlay || soundOn)) {
                                        startPlayback();
                                    }
                                }}
                                onTimeUpdate={(e) => {
                                    const v = e.currentTarget;
                                    if (isPlayingMode && v.duration && progressBarRef.current) {
                                        const scale = Math.min(1, Math.max(0, v.currentTime / v.duration));
                                        progressBarRef.current.style.transform = `scaleX(${scale})`;
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
                                    width: '100%',
                                    backgroundColor: '#f5a524',
                                    transform: 'scaleX(0)',
                                    transformOrigin: 'left',
                                    willChange: 'transform',
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

            
            {resolvedMusicUrl && (
                <audio
                    ref={audioRef}
                    src={resolvedMusicUrl}
                    loop
                    preload="auto"
                    style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    playsInline
                    onError={() => {
                        // If external audio preview stream fails, unmute original video so user still hears original video sound
                        if (videoRef.current && userWantsAudio) {
                            videoRef.current.muted = false;
                            videoRef.current.volume = 1;
                        }
                    }}
                />
            )}
        </div>
    );
};

export const PostMedia = memo(PostMediaComponent);
export default PostMedia;
