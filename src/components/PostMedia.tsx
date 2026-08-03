import React, { useRef, useEffect, useState } from 'react';
import { isVideoPost, isVideoUrl } from '../lib/media';
import type { PostData } from '../lib/database';

interface PostMediaProps {
    post: Pick<PostData, 'image_url' | 'media_type' | 'css_filter'>;
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

const PostMedia: React.FC<PostMediaProps> = ({
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
    const [hasError, setHasError] = useState(false);
    const isVideo = isVideoPost(post) || isVideoUrl(post.image_url);

    const effectiveMuted =
        muted !== undefined ? muted : soundOn || controls ? false : true;

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

    if (isVideo) {
        const videoSrc = post.image_url.includes('#t=') ? post.image_url : `${post.image_url}#t=0.001`;
        return (
            <video
                ref={videoRef}
                src={videoSrc}
                className={className}
                style={{ ...style, filter: extractedFilter }}
                muted={effectiveMuted}
                controls={controls}
                autoPlay={autoPlay || soundOn}
                loop={loop}
                playsInline={playsInline}
                preload="metadata"
                onError={() => setHasError(true)}
            />
        );
    }
    return (
        <img
            src={post.image_url}
            alt={alt}
            className={className}
            style={{ ...style, filter: extractedFilter }}
            loading="lazy"
            decoding="async"
            onError={() => setHasError(true)}
        />
    );
};

export default PostMedia;
