import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Heart, MessageCircle, Send, Link as LinkIcon, Trash2, Flame } from 'lucide-react';
import PostMedia from './PostMedia';
import { AppContext } from '../App';
import { deletePost, checkIfLiked, toggleLike, toggleImp, fetchUserImps, type PostData } from '../lib/database';

// Helper to format time
function getTimeAgo(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);

    if (days > 7) return date.toLocaleDateString();
    if (days > 0) return `${days}d ago`;
    if (hrs > 0) return `${hrs}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return 'Just now';
}

export interface PostModalContentProps {
    post: PostData;
    onClose: () => void;
    onDelete?: (postId: string) => void;
    onCommentClick?: (postId: string) => void;
    onShareClick?: (post: PostData) => void;
    isEmbedded?: boolean;
    isActive?: boolean;
}

export const PostModalContent: React.FC<PostModalContentProps> = ({ post, onClose, onDelete, onCommentClick, onShareClick, isEmbedded, isActive = true }) => {
    const { user } = useContext(AppContext);
    const navigate = useNavigate();
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(post.likes_count || 0);
    const [isImped, setIsImped] = useState(false);
    const [impCount, setImpCount] = useState(post.imps_count || 0);

    useEffect(() => {
        if (user) {
            checkIfLiked(user.id, post.id).then(setIsLiked);
            fetchUserImps(user.id).then(imps => setIsImped(imps.includes(post.id)));
        }
    }, [user, post.id]);

    const handleImpToggle = async () => {
        if (!user) return;
        const newImped = !isImped;
        setIsImped(newImped);
        setImpCount(prev => prev + (newImped ? 1 : -1));
        await toggleImp(user.id, post.id, isImped);
    };

    const handleLikeToggle = async () => {
        if (!user) return;
        const newStatus = !isLiked;
        setIsLiked(newStatus);
        setLikeCount(prev => newStatus ? prev + 1 : Math.max(0, prev - 1));
        await toggleLike(user.id, post.id, newStatus);
    };

    return (
        <div className="post-modal post-modal--fullscreen" onClick={(e) => e.stopPropagation()} style={isEmbedded ? { height: '100%', width: '100%', borderRadius: 0, margin: 0, position: 'relative' } : undefined}>
            <div className="modal-top-bar">
                <div className="modal-user-row">
                    <img
                        src={post.avatar_url || 'https://i.pravatar.cc/150'}
                        alt=""
                        className="modal-avatar"
                        onClick={() => { onClose(); navigate(`/profile/${post.username}`); }}
                    />
                    <div>
                        <span
                            className="modal-username"
                            onClick={() => { onClose(); navigate(`/profile/${post.username}`); }}
                        >
                            {post.username}
                        </span>
                        <span className="modal-time">{getTimeAgo(post.created_at)}</span>
                    </div>
                </div>
                <button className="modal-close-btn" type="button" onClick={onClose}>
                    <X size={22} />
                </button>
            </div>
            <div className="modal-media-stage">
                <PostMedia
                    post={post}
                    className="modal-image"
                    controls
                    playsInline
                    autoPlay={isActive}
                />
            </div>
            <div className="modal-details modal-details--sheet">
                {post.caption && (
                    <p className="modal-caption">{post.caption}</p>
                )}
                {post.attached_link && (
                    <a
                        href={post.attached_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="modal-link"
                    >
                        <LinkIcon size={14} /> {post.attached_link}
                    </a>
                )}
                <div className="modal-actions">
                    <button
                        className={`modal-action-btn ${isLiked ? 'liked' : ''}`}
                        onClick={handleLikeToggle}
                    >
                        <Heart size={22} fill={isLiked ? '#f5a524' : 'none'} color={isLiked ? '#f5a524' : 'var(--text-active)'} />
                        <span>{likeCount}</span>
                    </button>
                    <button className="modal-action-btn" onClick={() => onCommentClick && onCommentClick(post.id)}>
                        <MessageCircle size={22} />
                        <span>{post.comments_count || 0}</span>
                    </button>
                    <button className="modal-action-btn" onClick={() => onShareClick && onShareClick(post)}>
                        <Send size={22} />
                    </button>
                    <button
                        className={`modal-action-btn ${isImped ? 'imped' : ''}`}
                        onClick={handleImpToggle}
                        title="Imp / Boost post"
                    >
                        <Flame size={22} fill={isImped ? '#ff4500' : 'none'} color={isImped ? '#ff4500' : 'var(--text-active)'} />
                        <span>{impCount}</span>
                    </button>
                    {user && post.user_id === user.id && onDelete && (
                        <button
                            className="modal-action-btn"
                            style={{ color: '#ff3b30' }}
                            onClick={async () => {
                                if (confirm('Delete this post?')) {
                                    const ok = await deletePost(post.id);
                                    if (ok) onDelete(post.id);
                                }
                            }}
                        >
                            <Trash2 size={22} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const PostModal: React.FC<PostModalContentProps> = (props) => {
    useEffect(() => {
        window.history.pushState({ modal: 'post' }, '');
        const handlePopState = () => props.onClose();
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [props.onClose]);

    return (
        <div className="post-modal-backdrop post-modal-backdrop--fullscreen" onClick={props.onClose} style={{ zIndex: 9999 }}>
            <PostModalContent {...props} />
        </div>
    );
};

export default PostModal;
