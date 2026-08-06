import React, { useRef, useEffect, useState } from 'react';
import { isVideoPost, isVideoUrl } from '../lib/media';
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

    const videoSrc = isVideo && post.image_url.includes('#t=') ? post.image_url : (isVideo ? `${post.image_url}#t=0.001` : '');

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {isVideo ? (
                <video
                    ref={videoRef}
                    src={videoSrc}
                    className={className}
                    style={{ ...style, filter: extractedFilter, width: '100%', height: '100%' }}
                    muted={effectiveMuted}
                    controls={controls}
                    autoPlay={autoPlay || soundOn}
                    loop={loop}
                    playsInline={playsInline}
                    preload="metadata"
                    onError={() => setHasError(true)}
                />
            ) : (
                <img
                    src={post.image_url}
                    alt={alt}
                    className={className}
                    style={{ ...style, filter: extractedFilter, width: '100%', height: '100%' }}
                    loading="lazy"
                    decoding="async"
                    onError={() => setHasError(true)}
                />
            )}
            
            {/* FOOLPROOF NATIVE AUDIO PLAYER */}
            {post.music_url && (autoPlay || soundOn || controls) && (
                <div style={{
                    position: 'absolute',
                    bottom: '70px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '80%',
                    maxWidth: '300px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '8px',
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(245, 165, 36, 0.3)'
                }}>
                    <span style={{ fontSize: '11px', color: '#f5a524', fontWeight: 'bold', marginBottom: '4px', textAlign: 'center' }}>
                        {post.music_title || 'Playing Music'} {post.music_artist ? `• ${post.music_artist}` : ''}
                    </span>
                    <audio
                        src={post.music_url}
                        autoPlay={autoPlay || soundOn}
                        loop
                        controls
                        style={{ width: '100%', height: '30px', outline: 'none' }}
                        playsInline
                    />
                </div>
            )}
        </div>
    );
};

export default PostMedia;
