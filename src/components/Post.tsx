import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Send, Bookmark, Link as LinkIcon } from 'lucide-react';
import { AppContext } from '../App';
import { checkIfLiked, toggleLike } from '../lib/database';

interface PostProps {
    id: string;
    username: string;
    avatarUrl: string;
    imageUrl: string;
    likes: number;
    caption: string;
    timeAgo: string;
    attachedLink?: string;
}

const Post: React.FC<PostProps> = ({ id, username, avatarUrl, imageUrl, likes, caption, timeAgo, attachedLink }) => {
    const { user } = useContext(AppContext);
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(likes);

    // Check if user has already liked this post
    useEffect(() => {
        if (user) {
            checkIfLiked(user.id, id).then(liked => setIsLiked(liked));
        }
    }, [user, id]);

    const handleLikeToggle = async () => {
        if (!user) return;

        const newLiked = !isLiked;
        setIsLiked(newLiked);
        setLikeCount(prev => newLiked ? prev + 1 : prev - 1);

        await toggleLike(user.id, id, !newLiked);
    };

    const navigate = useNavigate();
    const [touchStartX, setTouchStartX] = useState<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStartX(e.changedTouches[0].screenX);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX === null) return;
        const touchEndX = e.changedTouches[0].screenX;
        const diffX = touchEndX - touchStartX;

        // Threshold for swipe
        if (Math.abs(diffX) > 60) {
            if (diffX > 0) {
                // Swiped Right -> Go to profile
                navigate(`/profile/${username}`);
            } else {
                // Swiped Left -> Open link if available
                if (attachedLink) {
                    window.open(attachedLink, '_blank', 'noopener,noreferrer');
                } else {
                    // Optional: could show a toast saying "No link attached"
                }
            }
        }
        setTouchStartX(null);
    };

    return (
        <div className="post-container">
            {/* Header */}
            <div className="post-header">
                <Link to={`/profile/${username}`} className="post-user-info" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <img src={avatarUrl} alt={username} className="avatar" />
                    <span className="font-bold username">{username}</span>
                </Link>
                <button className="more-options">•••</button>
            </div>

            {/* Image */}
            <div 
                className="post-image-container" 
                onDoubleClick={() => { if (!isLiked) handleLikeToggle(); }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <img src={imageUrl} alt="Post content" className="post-image" />
                {attachedLink && (
                    <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', padding: '6px', borderRadius: '50%', display: 'flex' }}>
                        <LinkIcon size={16} color="#fff" />
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="post-actions">
                <div className="action-buttons-left">
                    <button onClick={handleLikeToggle} className={`action-btn ${isLiked ? 'liked' : ''}`}>
                        <Heart size={26} fill={isLiked ? '#ff3366' : 'none'} color={isLiked ? '#ff3366' : 'currentColor'} />
                    </button>
                    <button className="action-btn"><MessageCircle size={26} /></button>
                    <button className="action-btn"><Send size={26} /></button>
                </div>
                <button className="action-btn"><Bookmark size={26} /></button>
            </div>

            {/* Footer */}
            <div className="post-footer">
                <div className="likes-count font-bold">{likeCount} likes</div>
                <div className="post-caption">
                    <span className="font-bold username mr-2">{username}</span>
                    {caption}
                </div>
                <div className="post-time">{timeAgo}</div>
            </div>
        </div>
    );
};

export default Post;
