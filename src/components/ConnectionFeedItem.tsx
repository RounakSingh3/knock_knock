import React, { useState } from 'react';
import type { PostData, StoryData } from '../lib/database';
import { isVideoUrl } from '../lib/media';
import PostMedia from './PostMedia';
import { Heart, Users, ChevronRight, ChevronLeft, Send, Flame, Music } from 'lucide-react';

interface UnifiedItem {
    userId: string;
    username: string;
    avatarUrl: string;
    post?: PostData;
    story?: StoryData;
    latestDate: Date;
}

interface ConnectionFeedItemProps {
    item: UnifiedItem;
    isLiked: boolean;
    likeCount: number;
    onLikeToggle: (postId: string) => void;
    onDoubleTap: (postId: string) => void;
    onClickPost: (post: PostData) => void;
    onShare?: (post: PostData) => void;
    isImped?: boolean;
    onImpToggle?: (postId: string) => void;
}

const ConnectionFeedItem: React.FC<ConnectionFeedItemProps> = ({
    item,
    isLiked,
    likeCount,
    onLikeToggle,
    onDoubleTap,
    onClickPost,
    onShare,
    isImped,
    onImpToggle,
}) => {
    // 0 = post, 1 = story
    const [viewIndex, setViewIndex] = useState(0);

    const hasPost = !!item.post;
    const hasStory = !!item.story;

    // If no post, default to showing story
    React.useEffect(() => {
        if (!hasPost && hasStory) setViewIndex(1);
    }, [hasPost, hasStory]);

    const showStory = viewIndex === 1 && hasStory;
    const showPost = viewIndex === 0 && hasPost;

    return (
        <div className="masonry-card masonry-card--tall" style={{ position: 'relative' }}>
            {showPost && item.post && (
                <div 
                    style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
                    onClick={() => onClickPost(item.post!)}
                    onDoubleClick={() => onDoubleTap(item.post!.id)}
                >
                    <PostMedia post={item.post} className="masonry-card-img" muted loop playsInline autoPlay />
                    <div className="masonry-card-overlay" />
                    <div className="masonry-connection-badge">
                        <Users size={10} /> Connected
                    </div>
                    {item.post.music_url && (
                        <div style={{
                            position: 'absolute', top: '12px', left: '12px', zIndex: 5,
                            display: 'flex', alignItems: 'center', gap: '5px',
                            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                            padding: '3px 8px', borderRadius: '12px', color: '#fff',
                            fontSize: '11px', fontWeight: '600', maxWidth: '140px',
                            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                        }}>
                            <Music size={11} color="#f5a524" />
                            <span>{item.post.music_title || 'Music'}</span>
                        </div>
                    )}
                    <button
                        className={`masonry-like-btn ${isLiked ? 'liked' : ''}`}
                        style={{ top: '12px', right: '12px' }}
                        onClick={(e) => { e.stopPropagation(); onLikeToggle(item.post!.id); }}
                    >
                        <Heart size={16} fill={isLiked ? '#f5a524' : 'none'} color={isLiked ? '#f5a524' : 'var(--text-active)'} />
                    </button>
                    {onShare && (
                        <button
                            className="masonry-like-btn"
                            style={{ top: '52px', right: '12px' }}
                            onClick={(e) => { e.stopPropagation(); onShare(item.post!); }}
                        >
                            <Send size={16} color="var(--text-active)" />
                        </button>
                    )}
                    {onImpToggle && (
                        <button
                            className={`masonry-like-btn ${isImped ? 'imped' : ''}`}
                            style={{ top: onShare ? '92px' : '52px', right: '12px' }}
                            onClick={(e) => { e.stopPropagation(); onImpToggle(item.post!.id); }}
                            title="Imp / Boost post"
                        >
                            <Flame size={16} fill={isImped ? '#ff4500' : 'none'} color={isImped ? '#ff4500' : 'var(--text-active)'} />
                        </button>
                    )}
                    <div className="masonry-card-info">
                        <div className="masonry-card-user">
                            <img src={item.avatarUrl || 'https://i.pravatar.cc/150'} alt="" className="masonry-avatar" />
                            <span className="masonry-username">{item.username}</span>
                        </div>
                        <div className="masonry-meta">
                            <span className="masonry-likes">{likeCount} ❤️</span>
                        </div>
                    </div>
                </div>
            )}

            {showStory && item.story && (
                <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, background: 'var(--bg-color)' }}>
                    {isVideoUrl(item.story.image_url) ? (
                        <video src={`${item.story.image_url}#t=0.001`} className="masonry-card-img" style={{ objectFit: 'contain' }} preload="metadata" muted playsInline />
                    ) : (
                        <img src={item.story.image_url} className="masonry-card-img" style={{ objectFit: 'contain' }} alt="Story" />
                    )}
                    <div className="masonry-connection-badge" style={{ background: '#af52de' }}>
                        Story Time
                    </div>
                    <div className="masonry-card-info">
                        <div className="masonry-card-user">
                            <img src={item.avatarUrl || 'https://i.pravatar.cc/150'} alt="" className="masonry-avatar" />
                            <span className="masonry-username">{item.username}</span>
                        </div>
                    </div>
                </div>
            )}

            {hasPost && hasStory && (
                <div style={{ position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)', zIndex: 10 }}>
                    {viewIndex === 0 ? (
                        <button 
                            className="nav-btn-round" 
                            onClick={(e) => { e.stopPropagation(); setViewIndex(1); }}
                            style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--text-active)', padding: '8px', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
                        >
                            <ChevronRight size={20} />
                        </button>
                    ) : (
                        <button 
                            className="nav-btn-round" 
                            onClick={(e) => { e.stopPropagation(); setViewIndex(0); }}
                            style={{ position: 'absolute', right: 'auto', left: '-280px', background: 'rgba(0,0,0,0.6)', color: 'var(--text-active)', padding: '8px', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}
                </div>
            )}
            
            {hasPost && hasStory && viewIndex === 1 && (
                <div style={{ position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)', zIndex: 10 }}>
                    <button 
                        className="nav-btn-round" 
                        onClick={(e) => { e.stopPropagation(); setViewIndex(0); }}
                        style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--text-active)', padding: '8px', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
                    >
                        <ChevronLeft size={20} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default ConnectionFeedItem;
