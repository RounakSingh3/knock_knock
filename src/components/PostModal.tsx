import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Heart, MessageCircle, Send, Link as LinkIcon, Trash2, Flame, Music, Volume2, VolumeX, Coins, Rocket, Check, Film, ChevronLeft } from 'lucide-react';
import PostMedia from './PostMedia';
import { AppContext } from '../context/AppContext';
import { deletePost, checkIfLiked, toggleLike, toggleImp, fetchUserImps, givePointsToContent, isKnockVideoLink, parseKnockVideoLink, isPostLikedLocally, getLocalComments, type PostData } from '../lib/database';
import { recordHashtagSignal } from '../lib/algorithm';
import ConnectedVideoModal, { type ConnectedVideoData } from './ConnectedVideoModal';

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
import { isVideoUrl, getFeedMutedPreference, setFeedMutedPreference, getCleanSongUrl } from '../lib/media';
import { resolveLocalMediaUrl } from '../lib/localMedia';

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
    preload?: 'auto' | 'metadata' | 'none';
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
    preload,
}) => {
    const { user, points, setPoints } = useContext(AppContext);
    const navigate = useNavigate();
    const [isLiked, setIsLiked] = useState(() => initialLiked ?? isPostLikedLocally(post.id, user?.id));
    const [likeCount, setLikeCount] = useState(post.likes_count || 0);
    const [isImped, setIsImped] = useState(() => initialImped ?? false);
    const [impCount, setImpCount] = useState(post.imps_count || 0);
    const [localMuted, setLocalMuted] = useState(() => isMutedProp !== undefined ? isMutedProp : getFeedMutedPreference());

    // ⚡ Post Screen Reach Boost States
    const [showBoostModal, setShowBoostModal] = useState(false);
    const [boostPointsAmount, setBoostPointsAmount] = useState(10);
    const [isBoostingPost, setIsBoostingPost] = useState(false);
    const [boostPostToast, setBoostPostToast] = useState<string | null>(null);

    // 🎬 Connected Knock Video Modal & Swipe Left Feature
    const [connectedVideoModal, setConnectedVideoModal] = useState<ConnectedVideoData | null>(null);
    const touchStartPosRef = useRef<{ x: number; y: number; time: number } | null>(null);

    const effectiveAttachedLink = post.attached_link || (post as any).link_url || (() => {
        if (post.image_url && post.image_url.includes('#LINK:')) {
            const m = post.image_url.match(/#LINK:([^#]+)/);
            if (m && m[1]) {
                try { return decodeURIComponent(m[1].split('|')[0]); } catch { return m[1].split('|')[0]; }
            }
        }
        return undefined;
    })();
    const hasAttachedVideo = Boolean(
        (effectiveAttachedLink && isKnockVideoLink(effectiveAttachedLink)) ||
        isVideoUrl(post.image_url)
    );

    const handleOpenConnectedVideo = () => {
        const link = effectiveAttachedLink;
        if (!link) {
            if (isVideoUrl(post.image_url)) {
                setConnectedVideoModal({ videoUrl: post.image_url, caption: post.caption || 'Knock Knock Video', username: post.username });
            }
            return;
        }
        const parsed = parseKnockVideoLink(link);
        if (parsed && (parsed.videoUrl || (parsed.id && parsed.id !== 'undefined' && parsed.id !== 'null'))) {
            setConnectedVideoModal(parsed);
        } else if (isKnockVideoLink(link)) {
            setConnectedVideoModal({ videoUrl: link, caption: post.caption || 'Knock Knock Video' });
        } else if (isVideoUrl(post.image_url)) {
            setConnectedVideoModal({ videoUrl: post.image_url, caption: post.caption || 'Knock Knock Video', username: post.username });
        } else {
            window.open(link, '_blank', 'noopener,noreferrer');
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches[0]) {
            touchStartPosRef.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
                time: Date.now()
            };
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartPosRef.current || !e.changedTouches[0]) return;
        const diffX = e.changedTouches[0].clientX - touchStartPosRef.current.x;
        const diffY = e.changedTouches[0].clientY - touchStartPosRef.current.y;
        touchStartPosRef.current = null;

        // Horizontal swipe (> 30px displacement and more horizontal than vertical)
        if (Math.abs(diffX) > 30 && Math.abs(diffX) > Math.abs(diffY)) {
            if (connectedVideoModal) {
                // If video modal is open, swipe dismisses it and returns to post
                setConnectedVideoModal(null);
            } else if (hasAttachedVideo) {
                // Both right swipe and left swipe open the connected video smoothly!
                handleOpenConnectedVideo();
            }
        }
    };

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
        if (isActive) {
            const pId = String(post.id);
            const uId = user?.id || '';
            if (initialLiked !== undefined) {
                setIsLiked(initialLiked);
            } else {
                setIsLiked(isPostLikedLocally(pId, uId));
                if (uId) {
                    checkIfLiked(uId, pId).then(setIsLiked);
                }
            }
            if (initialImped === undefined && uId) {
                fetchUserImps(uId).then(imps => setIsImped(imps.includes(pId)));
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
        await toggleLike(user.id, post.id, isLiked);
    };

    const handleMuteToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        const nextMuted = !effectiveMuted;
        setLocalMuted(nextMuted);
        setFeedMutedPreference(nextMuted);
        if (onMuteToggle) onMuteToggle(nextMuted);

        if (!nextMuted) {
            const effectiveMusic = resolveLocalMediaUrl(post.music_url);
            const cleanMusic = getCleanSongUrl(post.music_title, effectiveMusic) || effectiveMusic;
            if (cleanMusic) {
                try {
                    audioPlayer.play(cleanMusic);
                } catch (_) {}
            }
        } else {
            try {
                audioPlayer.stop();
            } catch (_) {}
        }
    };

    return (
        <div 
            className="post-modal post-modal--fullscreen" 
            onClick={(e) => e.stopPropagation()} 
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={isEmbedded ? { height: '100%', width: '100%', maxHeight: '100%', borderRadius: 0, margin: 0, position: 'relative', overflow: 'hidden', touchAction: 'manipulation' } : { touchAction: 'manipulation' }}
        >
            <div className="modal-top-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'auto' }}>
                    <button 
                        className="modal-back-btn" 
                        type="button" 
                        onClick={(e) => {
                            e.stopPropagation();
                            if (window.history.state?.modal === 'post' || window.history.state?.modal === 'feed_viewer') {
                                window.history.back();
                            } else {
                                onClose();
                            }
                        }}
                        aria-label="Back"
                    >
                        <ChevronLeft size={24} />
                    </button>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="modal-time">{getTimeAgo(post.created_at)}</span>
                                {post.boost_expires_at && (() => {
                                    const diff = new Date(post.boost_expires_at).getTime() - Date.now();
                                    if (diff <= 0) return null;
                                    const hrs = Math.ceil(diff / (1000 * 60 * 60));
                                    return (
                                        <span style={{
                                            fontSize: '10px',
                                            fontWeight: 800,
                                            background: 'linear-gradient(135deg, rgba(245, 165, 36, 0.25), rgba(255, 107, 53, 0.25))',
                                            border: '1px solid rgba(245, 165, 36, 0.6)',
                                            color: '#f5a524',
                                            padding: '1px 6px',
                                            borderRadius: '10px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                        }}>
                                            ⏳ 24h • {hrs}h left
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
                <button 
                    className="modal-close-btn" 
                    type="button" 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (window.history.state?.modal === 'post' || window.history.state?.modal === 'feed_viewer') {
                            window.history.back();
                        } else {
                            onClose();
                        }
                    }}
                    aria-label="Close"
                >
                    <X size={20} />
                </button>
            </div>
            <div className="modal-media-stage" style={isEmbedded ? { position: 'absolute', inset: 0, zIndex: 1, touchAction: 'pan-y' } : { position: 'relative', touchAction: 'pan-y' }}>
                <PostMedia
                    post={post}
                    className="modal-image"
                    playsInline
                    autoPlay={isActive && !connectedVideoModal}
                    soundOn={isActive && !effectiveMuted && !connectedVideoModal}
                    muted={effectiveMuted || !isActive || Boolean(connectedVideoModal)}
                    loop={true}
                    thumbnail={false}
                    objectFit="contain"
                    preload={preload}
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
                {hasAttachedVideo && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleOpenConnectedVideo();
                        }}
                        style={{
                            position: 'absolute',
                            bottom: (post.music_url || post.music_title) ? '64px' : '16px',
                            right: '16px',
                            zIndex: 15,
                            background: 'linear-gradient(135deg, rgba(245, 165, 36, 0.95), rgba(255, 107, 53, 0.95))',
                            border: '1.5px solid rgba(255, 255, 255, 0.45)',
                            borderRadius: '16px',
                            padding: '6px 12px',
                            color: '#000',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 4px 15px rgba(245, 165, 36, 0.5)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                        }}
                        title="Swipe or tap to watch connected video"
                    >
                        <Film size={14} color="#000" strokeWidth={2.4} />
                        <span>Swipe to Watch 🎥</span>
                    </button>
                )}
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
                    <p className="modal-caption" style={isEmbedded ? { pointerEvents: 'auto' } : undefined}>
                        {post.caption.split(/(\s+)/).map((word, wIdx) => {
                            if (word.startsWith('#') && word.length > 1) {
                                const cleanTag = word.replace(/[^a-zA-Z0-9_\u0080-\uFFFF#]/g, '');
                                return (
                                    <span
                                        key={wIdx}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            recordHashtagSignal([cleanTag.replace('#', '')], 3.0);
                                            onClose();
                                            navigate(`/explore?q=${encodeURIComponent(cleanTag)}&tab=posts`);
                                        }}
                                        style={{
                                            color: '#f5a524',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'inline'
                                        }}
                                    >
                                        {word}
                                    </span>
                                );
                            }
                            return word;
                        })}
                    </p>
                )}
                {hasAttachedVideo ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleOpenConnectedVideo();
                        }}
                        style={{
                            pointerEvents: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            maxWidth: '360px',
                            padding: '10px 16px',
                            marginBottom: '10px',
                            borderRadius: '16px',
                            background: 'linear-gradient(135deg, rgba(245, 165, 36, 0.95) 0%, rgba(255, 107, 53, 0.95) 100%)',
                            color: '#000',
                            fontWeight: 800,
                            fontSize: '12px',
                            border: '1.5px solid rgba(255, 255, 255, 0.45)',
                            boxShadow: '0 4px 18px rgba(245, 165, 36, 0.4)',
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease'
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Film size={16} color="#000" strokeWidth={2.4} />
                            <span>Watch Connected Video</span>
                        </div>
                        <span style={{
                            background: 'rgba(0, 0, 0, 0.25)',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '10px',
                            fontWeight: 900
                        }}>
                            Swipe Left 👈
                        </span>
                    </button>
                ) : post.attached_link ? (
                    <a
                        href={post.attached_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="modal-link"
                        style={isEmbedded ? { pointerEvents: 'auto' } : undefined}
                    >
                        <LinkIcon size={14} /> {post.attached_link}
                    </a>
                ) : null}
            </div>

            {/* Instagram-Style Right-Side Action Column */}
            <div className="post-side-actions" onClick={e => e.stopPropagation()}>
                <button
                    className={`post-side-action-btn ${isLiked ? 'liked' : ''}`}
                    onClick={handleLikeToggle}
                    aria-label="Like"
                >
                    <Heart size={28} fill={isLiked ? '#f5a524' : 'none'} color={isLiked ? '#f5a524' : '#fff'} />
                    <span>{likeCount}</span>
                </button>
                <button
                    className="post-side-action-btn"
                    onClick={() => onCommentClick && onCommentClick(post.id)}
                    aria-label="Comment"
                >
                    <MessageCircle size={28} color="#fff" />
                    <span>{Math.max(post.comments_count || 0, getLocalComments(post.id).length)}</span>
                </button>
                <button
                    className="post-side-action-btn"
                    onClick={() => onShareClick && onShareClick(post)}
                    title="Send / Share"
                    aria-label="Send"
                >
                    <Send size={26} color="#fff" style={{ transform: 'rotate(-20deg)', transformOrigin: 'center' }} />
                    <span>{post.shares_count || 0}</span>
                </button>
                <button
                    className={`post-side-action-btn ${isImped ? 'imped' : ''}`}
                    onClick={handleImpToggle}
                    title="Imp / Boost post"
                    aria-label="Imp"
                >
                    <Flame size={28} fill={isImped ? '#ff4500' : 'none'} color={isImped ? '#ff4500' : '#fff'} />
                    <span>{impCount}</span>
                </button>
                <button
                    className="post-side-action-btn"
                    onClick={() => setShowBoostModal(true)}
                    title="Give Points to Boost Screen Reach"
                    aria-label="Boost Screen Reach"
                >
                    <Coins size={26} color="#10b981" />
                    <span style={{ color: '#10b981' }}>Boost</span>
                </button>
                {user && post.user_id === user.id && onDelete && (
                    <button
                        className="post-side-action-btn"
                        style={{ color: '#ff3b30' }}
                        onClick={async () => {
                            if (confirm('Delete this post?')) {
                                const ok = await deletePost(post.id);
                                if (ok) onDelete(post.id);
                            }
                        }}
                        aria-label="Delete"
                    >
                        <Trash2 size={24} color="#ff3b30" />
                    </button>
                )}
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

            {/* Connected Knock Video Player Overlay */}
            {connectedVideoModal && (
                <ConnectedVideoModal
                    video={connectedVideoModal}
                    onClose={() => setConnectedVideoModal(null)}
                    zIndex={100060}
                />
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
