import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Heart, MessageCircle, Send, Link as LinkIcon, Trash2, Flame, Music, Volume2, VolumeX, Coins, Rocket, Check } from 'lucide-react';
import PostMedia from './PostMedia';
import { AppContext } from '../context/AppContext';
import { deletePost, checkIfLiked, toggleLike, toggleImp, fetchUserImps, givePointsToContent, type PostData } from '../lib/database';

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

import { audioPlayer } from '../lib/audioPlayer';
import { getFeedMutedPreference, setFeedMutedPreference } from '../lib/media';

export interface PostModalContentProps {
    post: PostData;
    onClose: () => void;
    onDelete?: (postId: string) => void;
    onCommentClick?: (postId: string) => void;
    onShareClick?: (post: PostData) => void;
    onLikeToggle?: (postId: string, liked: boolean) => void;
    onImpToggle?: (postId: string, imped: boolean) => void;
    isEmbedded?: boolean;
    isActive?: boolean;
    isMuted?: boolean;
    onMuteToggle?: (muted: boolean) => void;
    initialLiked?: boolean;
    initialImped?: boolean;
}

export const PostModalContent: React.FC<PostModalContentProps> = ({
    post,
    onClose,
    onDelete,
    onCommentClick,
    onShareClick,
    onLikeToggle: onLikeToggleProp,
    onImpToggle: onImpToggleProp,
    isEmbedded,
    isActive = true,
    isMuted: isMutedProp,
    onMuteToggle,
    initialLiked,
    initialImped,
}) => {
    const { user, points, setPoints } = useContext(AppContext);
    const navigate = useNavigate();
    const [isLiked, setIsLiked] = useState(() => initialLiked ?? false);
    const [likeCount, setLikeCount] = useState(post.likes_count || 0);
    const [isImped, setIsImped] = useState(() => initialImped ?? false);
    const [impCount, setImpCount] = useState(post.imps_count || 0);
    const [localMuted, setLocalMuted] = useState(() => isMutedProp !== undefined ? isMutedProp : getFeedMutedPreference());

    // ⚡ Post Screen Reach Boost States
    const [showBoostModal, setShowBoostModal] = useState(false);
    const [boostPointsAmount, setBoostPointsAmount] = useState(10);
    const [isBoostingPost, setIsBoostingPost] = useState(false);
    const [boostPostToast, setBoostPostToast] = useState<string | null>(null);

    const handleBoostPost = async () => {
        if (!user || !post || isBoostingPost || boostPointsAmount <= 0) return;
        setIsBoostingPost(true);
        try {
            const res = await givePointsToContent({
                giverId: user.id,
                targetType: 'post',
                targetId: post.id,
                authorId: post.user_id,
                amount: boostPointsAmount,
                currentGiverPoints: points,
            });
            if (res.success) {
                setPoints(res.newGiverPoints);
                setShowBoostModal(false);
                setBoostPostToast(`🎉 Boosted! Post will reach ${res.extraScreens} more screens!`);
                setTimeout(() => setBoostPostToast(null), 3500);
            } else {
                alert(res.error || 'Failed to boost post');
            }
        } catch (e) {
            console.error('Boost post failed:', e);
            alert('Could not boost post.');
        } finally {
            setIsBoostingPost(false);
        }
    };

    const effectiveMuted = isMutedProp !== undefined ? isMutedProp : localMuted;

    useEffect(() => {
        if (isMutedProp !== undefined) {
            setLocalMuted(isMutedProp);
        }
    }, [isMutedProp]);

    useEffect(() => {
        if (user && isActive) {
            if (initialLiked === undefined) {
                checkIfLiked(user.id, post.id).then(setIsLiked);
            }
            if (initialImped === undefined) {
                fetchUserImps(user.id).then(imps => setIsImped(imps.includes(post.id)));
            }
        }
    }, [user?.id, post.id, isActive, initialLiked, initialImped]);

    const handleImpToggle = async () => {
        if (!user) return;
        const newImped = !isImped;
        setIsImped(newImped);
        setImpCount(prev => prev + (newImped ? 1 : -1));
        if (onImpToggleProp) onImpToggleProp(post.id, newImped);
        await toggleImp(user.id, post.id, isImped);
    };

    const handleLikeToggle = async () => {
        if (!user) return;
        const newStatus = !isLiked;
        setIsLiked(newStatus);
        setLikeCount(prev => newStatus ? prev + 1 : Math.max(0, prev - 1));
        if (onLikeToggleProp) onLikeToggleProp(post.id, newStatus);
        await toggleLike(user.id, post.id, newStatus);
    };

    const handleMuteToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        const nextMuted = !effectiveMuted;
        setLocalMuted(nextMuted);
        setFeedMutedPreference(nextMuted);
        if (onMuteToggle) onMuteToggle(nextMuted);
    };

    return (
        <div className="post-modal post-modal--fullscreen" onClick={(e) => e.stopPropagation()} style={isEmbedded ? { height: '100%', width: '100%', maxHeight: '100%', borderRadius: 0, margin: 0, position: 'relative', overflow: 'hidden' } : undefined}>
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
            <div className="modal-media-stage" style={isEmbedded ? { position: 'absolute', inset: 0, zIndex: 1 } : { position: 'relative' }}>
                <PostMedia
                    post={post}
                    className="modal-image"
                    playsInline
                    autoPlay={isActive}
                    soundOn={isActive && !effectiveMuted}
                    muted={effectiveMuted || !isActive}
                    loop={true}
                    thumbnail={!isActive}
                    objectFit="contain"
                    onDoubleTapLike={handleLikeToggle}
                    onMuteChange={(muted) => {
                        setLocalMuted(muted);
                        setFeedMutedPreference(muted);
                        if (onMuteToggle) onMuteToggle(muted);
                    }}
                />
                <button
                    className="modal-mute-btn"
                    type="button"
                    onClick={handleMuteToggle}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        zIndex: 15,
                        background: 'rgba(0,0,0,0.6)',
                        border: 'none',
                        color: '#fff',
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        backdropFilter: 'blur(8px)'
                    }}
                >
                    {effectiveMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                {(post.music_url || post.music_title) && (
                    <div style={{
                        position: 'absolute', bottom: '16px', left: '16px', zIndex: 10,
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)',
                        padding: '6px 14px', borderRadius: '20px',
                        border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
                        fontSize: '13px', fontWeight: 'bold'
                    }}>
                        <Music size={14} color="#f5a524" />
                        <span>{post.music_title || 'Music'} {post.music_artist ? `• ${post.music_artist}` : ''}</span>
                    </div>
                )}
            </div>
            <div 
                className="modal-details modal-details--sheet"
                style={isEmbedded ? { pointerEvents: 'none', touchAction: 'pan-y' } : undefined}
            >
                {post.caption && (
                    <p className="modal-caption" style={isEmbedded ? { pointerEvents: 'auto' } : undefined}>{post.caption}</p>
                )}
                {post.attached_link && (
                    <a
                        href={post.attached_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="modal-link"
                        style={isEmbedded ? { pointerEvents: 'auto' } : undefined}
                    >
                        <LinkIcon size={14} /> {post.attached_link}
                    </a>
                )}
                <div className="modal-actions" style={isEmbedded ? { pointerEvents: 'auto' } : undefined}>
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
                    <button
                        className="modal-action-btn"
                        onClick={() => setShowBoostModal(true)}
                        title="Give Points to Boost Screen Reach"
                        style={{ color: '#10b981' }}
                    >
                        <Coins size={22} color="#10b981" />
                        <span>Boost</span>
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

            {/* ⚡ Boost Post Screen Reach (+Points) Modal */}
            {showBoostModal && (
                <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10005,
                        background: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}
                >
                    <div style={{
                        background: 'var(--surface-color)',
                        border: '1.5px solid rgba(16, 185, 129, 0.4)',
                        borderRadius: '24px',
                        width: '100%',
                        maxWidth: '360px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
                        position: 'relative'
                    }}>
                        <button
                            onClick={() => setShowBoostModal(false)}
                            style={{
                                position: 'absolute', top: '16px', right: '16px',
                                background: 'rgba(255,255,255,0.08)', border: 'none',
                                borderRadius: '50%', width: '30px', height: '30px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-inactive)', cursor: 'pointer'
                            }}
                        >
                            <X size={18} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '44px', height: '44px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                            }}>
                                <Coins size={24} color="#fff" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-active)' }}>
                                    Boost Post Reach
                                </h3>
                                <span style={{ fontSize: '12px', color: '#6ee7b7' }}>
                                    Award points to boost to more screens!
                                </span>
                            </div>
                        </div>

                        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
                            Every 1 point awards @{post.username} and guarantees this post reaches <strong>1 more screen</strong> automatically!
                        </p>

                        {/* Balance display */}
                        <div style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '14px',
                            padding: '10px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-inactive)' }}>Your Balance:</span>
                            <span style={{ fontSize: '14px', fontWeight: '800', color: '#10b981' }}>
                                {user?.username === 'popcorn05' ? 'Unlimited' : `${points} Points`}
                            </span>
                        </div>

                        {/* Preset options */}
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-inactive)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                                Boost Amount
                            </label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {[5, 10, 25, 50].map(amt => (
                                    <button
                                        key={amt}
                                        type="button"
                                        onClick={() => setBoostPointsAmount(amt)}
                                        style={{
                                            flex: '1 0 20%',
                                            padding: '10px 0',
                                            borderRadius: '12px',
                                            border: boostPointsAmount === amt ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                                            background: boostPointsAmount === amt ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                                            color: boostPointsAmount === amt ? '#10b981' : 'var(--text-active)',
                                            fontWeight: '800',
                                            fontSize: '13px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        +{amt} Screens
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Boost Button */}
                        <button
                            type="button"
                            onClick={handleBoostPost}
                            disabled={isBoostingPost || (user?.username !== 'popcorn05' && points < boostPointsAmount)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '16px',
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                border: 'none',
                                color: '#fff',
                                fontWeight: '800',
                                fontSize: '15px',
                                cursor: (user?.username !== 'popcorn05' && points < boostPointsAmount) ? 'not-allowed' : 'pointer',
                                opacity: (user?.username !== 'popcorn05' && points < boostPointsAmount) ? 0.5 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.45)'
                            }}
                        >
                            <Rocket size={18} />
                            <span>{isBoostingPost ? 'Boosting...' : `Boost (+${boostPointsAmount} Screens)`}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Boost Toast */}
            {boostPostToast && (
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(16, 185, 129, 0.95)',
                    backdropFilter: 'blur(10px)',
                    color: '#fff',
                    padding: '8px 20px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: 700,
                    zIndex: 10006,
                    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <Check size={16} /> {boostPostToast}
                </div>
            )}
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
