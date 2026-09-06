import React, { useRef, useEffect, useState, memo } from 'react';
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
}

// In-memory cache for resolved iTunes preview URLs to prevent redundant network fetches
const itunesCache = new Map<string, string>();

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
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [hasError, setHasError] = useState(false);
    const retryCountRef = useRef(0);
    const fallbackUsedRef = useRef(false);
    const isVideo = isVideoPost(post) || isVideoUrl(post.image_url);

    const [currentImgSrc, setCurrentImgSrc] = useState<string>(() => {
        return isVideo ? '' : getOptimizedImageUrl(post.image_url, 650);
    });

    useEffect(() => {
        setHasError(false);
        retryCountRef.current = 0;
        fallbackUsedRef.current = false;
        setCurrentImgSrc(isVideo ? '' : getOptimizedImageUrl(post.image_url, 650));
    }, [post.image_url, isVideo]);

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
        : (muted !== undefined ? muted : soundOn ? false : true);

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

    useEffect(() => {
        setHasError(false);
        retryCountRef.current = 0;
    }, [post.image_url]);

    // Handle video play/pause & sound
    useEffect(() => {
        if (!isVideo) return;
        const video = videoRef.current;
        if (!video) return;

        // If post has music attached, force video element to remain muted
        if (hasMusic) {
            video.muted = true;
        } else if (soundOn && (muted === false || muted === undefined)) {
            video.muted = false;
            video.volume = 1;
        } else {
            video.muted = true;
        }

        if (autoPlay || soundOn) {
            video.play().catch(() => {});
        } else {
            video.pause();
        }
    }, [soundOn, isVideo, autoPlay, post.image_url, hasMusic, muted]);

    // Handle background audio playback
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
                playPromise.catch((e) => {
                    // Interrupted by pause() or unmount — do NOT attach tap retry
                    if (e.name === 'AbortError' || isCancelled) return;
                    console.warn('[PostMedia] Audio autoplay deferred until tap:', e);
                    const onUserTap = () => {
                        if (isCancelled) return;
                        audio.muted = false;
                        audio.volume = 1;
                        audio.play().catch(() => {});
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
                    minHeight: '160px',
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

    // Strip filter query params from video URLs to avoid CDN/range-request issues
    let cleanImageUrl = post.image_url;
    try {
        const parsed = new URL(post.image_url);
        if (parsed.searchParams.has('filter')) {
            parsed.searchParams.delete('filter');
            cleanImageUrl = parsed.toString();
        }
    } catch (_) {}

    const videoSrc = isVideo && cleanImageUrl.includes('#t=') ? cleanImageUrl : (isVideo ? `${cleanImageUrl}#t=0.001` : '');

    return (
        <div style={{ position: 'relative', width: '100%', height: style?.height || '100%', minHeight: '160px' }}>
            {isVideo ? (
                <video
                    ref={videoRef}
                    src={videoSrc}
                    className={className}
                    style={{ ...style, filter: extractedFilter, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    muted={effectiveMuted}
                    controls={controls}
                    autoPlay={autoPlay || soundOn}
                    loop={loop}
                    playsInline={playsInline}
                    preload="metadata"
                    onError={handleMediaError}
                />
            ) : (
                <img
                    src={currentImgSrc}
                    alt={alt}
                    className={className}
                    style={{ ...style, filter: extractedFilter, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
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
