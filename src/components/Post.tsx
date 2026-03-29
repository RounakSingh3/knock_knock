import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Send, Bookmark } from 'lucide-react';
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
}

const Post: React.FC<PostProps> = ({ id, username, avatarUrl, imageUrl, likes, caption, timeAgo }) => {
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
            <div className="post-image-container" onDoubleClick={() => { if (!isLiked) handleLikeToggle(); }}>
                <img src={imageUrl} alt="Post content" className="post-image" />
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
