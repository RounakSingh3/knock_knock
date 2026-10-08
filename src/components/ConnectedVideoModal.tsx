import React, { useState, useEffect, useRef } from 'react';
import { Film, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchPostById } from '../lib/database';

export interface ConnectedVideoData {
    id?: string;
    videoUrl?: string;
    caption?: string;
    username?: string;
}

interface ConnectedVideoModalProps {
    video: ConnectedVideoData | null;
    onClose: () => void;
    zIndex?: number;
}

export const ConnectedVideoModal: React.FC<ConnectedVideoModalProps> = ({
    video,
    onClose,
    zIndex = 100060,
}) => {
    const navigate = useNavigate();
    const [resolvedVideo, setResolvedVideo] = useState<ConnectedVideoData | null>(video);
    const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        setResolvedVideo(video);
        if (video?.id && !video.videoUrl) {
            fetchPostById(video.id).then(post => {
                if (post && post.image_url) {
                    setResolvedVideo(prev => prev ? {
                        ...prev,
                        videoUrl: post.image_url,
                        caption: prev.caption || post.caption,
                        username: prev.username || post.username,
                    } : null);
                }
            });
        }
    }, [video]);

    if (!video) return null;

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches[0]) {
            touchStartPosRef.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
            };
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartPosRef.current || !e.changedTouches[0]) return;
        const diffX = e.changedTouches[0].clientX - touchStartPosRef.current.x;
        const diffY = e.changedTouches[0].clientY - touchStartPosRef.current.y;
        touchStartPosRef.current = null;

        // Swipe RIGHT to dismiss and return to the underlying post or story
        if (diffX > 45 && Math.abs(diffX) > Math.abs(diffY)) {
            onClose();
        }
    };

    const activeData = resolvedVideo || video;

    return (
        <div
            className="connected-video-modal-overlay"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={(e) => e.stopPropagation()}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex,
                background: '#000',
                display: 'flex',
                flexDirection: 'column',
                animation: 'connectedVideoSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
        >
            {/* Header bar */}
            <div style={{
                position: 'absolute',
                top: 'max(16px, env(safe-area-inset-top))',
                left: '16px',
                right: '16px',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '20px',
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f5a524, #ff6b35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(245, 165, 36, 0.4)'
                    }}>
                        <Film size={17} color="#000" strokeWidth={2.4} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '10px', color: '#f5a524', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Knock Knock Video
                        </span>
                        {activeData.username && (
                            <span style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>
                                @{activeData.username}
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activeData.id && (
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                navigate(`/reels?id=${activeData.id}`);
                            }}
                            style={{
                                background: 'linear-gradient(135deg, #f5a524, #ff6b35)',
                                border: 'none',
                                borderRadius: '14px',
                                padding: '6px 12px',
                                color: '#000',
                                fontWeight: 800,
                                fontSize: '11px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 2px 10px rgba(245, 165, 36, 0.4)'
                            }}
                        >
                            Open in Reels ↗
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '34px',
                            height: '34px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            cursor: 'pointer'
                        }}
                        title="Close (or swipe right)"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Video Player Stage */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#000',
                position: 'relative'
            }}>
                {activeData.videoUrl ? (
                    <video
                        src={activeData.videoUrl}
                        autoPlay
                        controls
                        playsInline
                        loop
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#f5a524' }}>
                        <Loader2 size={36} className="animate-spin" />
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>Loading connected video...</span>
                    </div>
                )}
            </div>

            {/* Caption bar */}
            {activeData.caption && (
                <div style={{
                    position: 'absolute',
                    bottom: 'max(24px, env(safe-area-inset-bottom))',
                    left: '16px',
                    right: '16px',
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    padding: '12px 16px',
                    borderRadius: '16px',
                    color: '#fff',
                    fontSize: '13px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    zIndex: 20
                }}>
                    {activeData.caption}
                </div>
            )}

            <style>{`
                @keyframes connectedVideoSlideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default ConnectedVideoModal;
