import React, { useRef, useEffect, useState, memo } from 'react';
import { isVideoPost, isVideoUrl, getOptimizedImageUrl } from '../lib/media';
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
    const [resolvedMusicUrl, setResolvedMusicUrl] = useState<string | undefined>(post.music_url);
    const isVideo = isVideoPost(post) || isVideoUrl(post.image_url);

    // Resolve missing music_url from music_title via iTunes
    useEffect(() => {
        if (post.music_url) {
            setResolvedMusicUrl(post.music_url);
            return;
        }
        if (post.music_title) {
            let active = true;
            const query = `${post.music_title} ${post.music_artist || ''}`.trim();
            fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`)
                .then(res => res.json())
                .then(data => {
                    if (active && data.results?.[0]?.previewUrl) {
                        setResolvedMusicUrl(data.results[0].previewUrl);
                    }
                })
                .catch(() => {});
            return () => { active = false; };
        } else {
            setResolvedMusicUrl(undefined);
        }
    }, [post.music_url, post.music_title, post.music_artist]);

    const hasMusic = Boolean(resolvedMusicUrl);

    // If post has a music track, the video element should be muted so only the song plays!
    // If post does not have music, the video's own sound plays when soundOn / unmuted.
    const effectiveMuted = hasMusic 
        ? true 
        : (muted !== undefined ? muted : soundOn ? false : true);

    useEffect(() => {
        setHasError(false);
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

        let cleanupTap: (() => void) | null = null;
        const shouldPlayAudio = (autoPlay || soundOn) && (muted === false || (muted === undefined && soundOn));

        if (shouldPlayAudio) {
            audio.muted = false;
            audio.volume = 1;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch((e) => {
                    console.warn('[PostMedia] Audio autoplay deferred until tap:', e);
                    const onUserTap = () => {
                        audio.play().catch(() => {});
                        window.removeEventListener('click', onUserTap);
                        window.removeEventListener('touchstart', onUserTap);
                    };
                    window.addEventListener('click', onUserTap, { once: true, capture: true });
                    window.addEventListener('touchstart', onUserTap, { once: true, capture: true });
                    cleanupTap = () => {
                        window.removeEventListener('click', onUserTap);
                        window.removeEventListener('touchstart', onUserTap);
                    };
                });
            }
        } else {
            audio.pause();
            if (!autoPlay && !soundOn) {
                audio.currentTime = 0;
            }
        }

        return () => {
            if (cleanupTap) cleanupTap();
            audio.pause();
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

    if (hasError || !post.image_url) {
        return (
            <div 
                className={className}
                style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, #1c1c1e, #2c2c2e)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-inactive)',
                    fontSize: '14px',
                    ...style
                }}
            >
                📷
            </div>
        );
    }

    const videoSrc = isVideo && post.image_url.includes('#t=') ? post.image_url : (isVideo ? `${post.image_url}#t=0.001` : '');
    const optimizedImageSrc = isVideo ? '' : getOptimizedImageUrl(post.image_url, 650);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {isVideo ? (
                <video
                    ref={videoRef}
                    src={videoSrc}
                    className={className}
                    style={{ ...style, filter: extractedFilter, width: '100%', height: '100%', willChange: 'transform' }}
                    muted={effectiveMuted}
                    controls={controls}
                    autoPlay={autoPlay || soundOn}
                    loop={loop}
                    playsInline={playsInline}
                    preload={autoPlay || soundOn || controls ? "metadata" : "none"}
                    onError={() => setHasError(true)}
                />
            ) : (
                <img
                    src={optimizedImageSrc}
                    alt={alt}
                    className={className}
                    style={{ ...style, filter: extractedFilter, width: '100%', height: '100%', willChange: 'transform' }}
                    loading="lazy"
                    decoding="async"
                    onError={() => setHasError(true)}
                />
            )}
            
            {resolvedMusicUrl && (
                <audio
                    ref={audioRef}
                    src={resolvedMusicUrl}
                    loop
                    style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    playsInline
                />
            )}
        </div>
    );
};

export const PostMedia = memo(PostMediaComponent);
export default PostMedia;
