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
    const isVideo = isVideoPost(post) || isVideoUrl(post.image_url);

    const effectiveMuted =
        muted !== undefined ? muted : soundOn ? false : true;

    useEffect(() => {
        setHasError(false);
    }, [post.image_url]);

    useEffect(() => {
        if (!isVideo) return;
        const video = videoRef.current;
        if (!video) return;

        // Auto-play / pause based on active state
        if (autoPlay || soundOn) {
            video.play().catch(() => {});
        } else {
            video.pause();
        }
        
        // Handle soundOn logic
        if (!soundOn) return;

        const playWithSound = () => {
            video.muted = false;
            video.volume = 1;
            video.play().catch(() => {});
        };

        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            playWithSound();
        } else {
            video.addEventListener('loadeddata', playWithSound, { once: true });
            return () => video.removeEventListener('loadeddata', playWithSound);
        }
    }, [soundOn, isVideo, autoPlay, post.image_url]);

    // Handle background audio playback strictly: only play when autoPlay OR soundOn is true
    // When autoPlay and soundOn become false (scrolled away), IMMEDIATELY pause and reset!
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (autoPlay || soundOn) {
            audio.muted = muted !== undefined ? muted : false;
            audio.currentTime = 0;
            audio.play().catch((e) => console.warn('Audio play blocked/failed:', e));
        } else {
            audio.pause();
            audio.currentTime = 0;
        }

        return () => {
            audio.pause();
            audio.currentTime = 0;
        };
    }, [autoPlay, soundOn, muted, post.music_url]);

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
            
            {post.music_url && (
                <audio
                    ref={audioRef}
                    src={post.music_url}
                    loop
                    style={{ display: 'none' }}
                    playsInline
                />
            )}
        </div>
    );
};

export const PostMedia = memo(PostMediaComponent);
export default PostMedia;
