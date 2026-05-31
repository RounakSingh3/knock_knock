import React from 'react';
import { isVideoPost } from '../lib/media';
import type { PostData } from '../lib/database';

interface PostMediaProps {
    post: Pick<PostData, 'image_url' | 'media_type'>;
    className?: string;
    style?: React.CSSProperties;
    muted?: boolean;
    controls?: boolean;
    autoPlay?: boolean;
    loop?: boolean;
    playsInline?: boolean;
    alt?: string;
}

const PostMedia: React.FC<PostMediaProps> = ({
    post,
    className,
    style,
    muted = true,
    controls = false,
    autoPlay = false,
    loop = true,
    playsInline = true,
    alt = '',
}) => {
    if (isVideoPost(post)) {
        return (
            <video
                src={post.image_url}
                className={className}
                style={style}
                muted={muted}
                controls={controls}
                autoPlay={autoPlay}
                loop={loop}
                playsInline={playsInline}
                preload="metadata"
            />
        );
    }
    return (
        <img
            src={post.image_url}
            alt={alt}
            className={className}
            style={style}
            loading="lazy"
        />
    );
};

export default PostMedia;
