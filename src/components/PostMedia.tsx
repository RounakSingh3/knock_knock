import React, { useRef, useEffect } from 'react';
import { isVideoPost } from '../lib/media';
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
    const isVideo = isVideoPost(post);

    const effectiveMuted =
        muted !== undefined ? muted : soundOn || controls ? false : true;

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
            const url = new URL(post.image_url);
            const f = url.searchParams.get('filter');
            if (f) extractedFilter = decodeURIComponent(f);
        }
    } catch(e) {}

    if (isVideo) {
        return (
            <video
                ref={videoRef}
                src={post.image_url}
                className={className}
                style={{ ...style, filter: extractedFilter }}
                muted={effectiveMuted}
                controls={controls}
                autoPlay={autoPlay || soundOn}
                loop={loop}
                playsInline={playsInline}
                preload={autoPlay || soundOn ? "metadata" : "none"}
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
        />
    );
};

export default PostMedia;
