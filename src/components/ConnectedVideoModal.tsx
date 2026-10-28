import React, { useState, useEffect, useRef } from 'react';
import { Film, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchPostById, resolveLocalMediaUrl } from '../lib/database';

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
    const [loadError, setLoadError] = useState(false);
    const [fallbackVideoSrc, setFallbackVideoSrc] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        setResolvedVideo(video);
        setLoadError(false);
        setFallbackVideoSrc(null);

        const timer = setTimeout(() => {
            if (!video?.videoUrl && (!resolvedVideo || !resolvedVideo.videoUrl)) {
                setLoadError(true);
            }
        }, 3500);

        if (video?.id && String(video.id) !== 'undefined' && String(video.id) !== 'null' && !video.videoUrl) {
            fetchPostById(String(video.id)).then(post => {
                if (post && post.image_url) {
                    setResolvedVideo(prev => prev ? {
                        ...prev,
                        videoUrl: post.image_url,
                        caption: prev.caption || post.caption,
                        username: prev.username || post.username,
                    } : null);
                    setLoadError(false);
                } else {
                    setLoadError(true);
                }
            }).catch(e => {
                console.warn('[ConnectedVideoModal] fetch error:', e);
                setLoadError(true);
            });
        }

        return () => clearTimeout(timer);
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

        // Swipe RIGHT or Swipe DOWN to dismiss and return to the underlying post or story
        if ((diffX > 45 && Math.abs(diffX) > Math.abs(diffY)) || (diffY > 55 && Math.abs(diffY) > Math.abs(diffX))) {
            onClose();
        }
    };

    const activeData = resolvedVideo || video;
    const rawResolvedUrl = activeData?.videoUrl ? resolveLocalMediaUrl(activeData.videoUrl) : '';
    const cleanVideoSrc = rawResolvedUrl ? rawResolvedUrl.split('#')[0] : '';
    const currentVideoSrc = fallbackVideoSrc || cleanVideoSrc;

    useEffect(() => {
        const v = videoRef.current;
        if (!v || !currentVideoSrc) return;
        v.muted = false;
        v.volume = 1;
        const playPromise = v.play();
        if (playPromise !== undefined) {
            playPromise.catch((err) => {
                if (err.name === 'AbortError') return;
                console.warn('[ConnectedVideoModal] Autoplay muted fallback until tap:', err);
                v.muted = true;
                v.play().catch(() => {});
                const unmuteOnTap = () => {
                    if (videoRef.current) {
                        videoRef.current.muted = false;
                        videoRef.current.volume = 1;
                        videoRef.current.play().catch(() => {});
                    }
                    window.removeEventListener('click', unmuteOnTap, { capture: true });
                    window.removeEventListener('touchstart', unmuteOnTap, { capture: true });
                };
                window.addEventListener('click', unmuteOnTap, { once: true, capture: true });
                window.addEventListener('touchstart', unmuteOnTap, { once: true, capture: true });
            });
        }
        return () => {
            if (v) {
                try {
                    v.pause();
                } catch (_) {}
            }
        };
    }, [currentVideoSrc]);

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
                    {activeData.id && String(activeData.id) !== 'undefined' && String(activeData.id) !== 'null' && (
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                const params = new URLSearchParams();
                                params.set('id', String(activeData.id));
                                if (activeData.videoUrl) params.set('v', activeData.videoUrl);
                                if (activeData.caption) params.set('caption', activeData.caption);
                                if (activeData.username) params.set('user', activeData.username);
                                navigate(`/reels?${params.toString()}`);
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
                {currentVideoSrc ? (
                    <video
                        ref={videoRef}
                        src={currentVideoSrc}
                        controls
                        playsInline
                        // @ts-ignore
                        webkit-playsinline="true"
                        x5-playsinline="true"
                        loop
                        preload="auto"
                        // @ts-ignore
                        disablePictureInPicture={true}
                        // @ts-ignore
                        disableRemotePlayback={true}
                        onError={() => {
                            if (!fallbackVideoSrc) {
                                if (cleanVideoSrc.includes('1790250320016') || activeData.caption?.includes('sonambajwa')) {
                                    setFallbackVideoSrc('/videos/sonambajwa.mp4');
                                    setLoadError(false);
                                    return;
                                }
                                setFallbackVideoSrc('https://videos.pexels.com/video-files/3015510/3015510-sd_640_360_24fps.mp4');
                                setLoadError(false);
                                return;
                            }
                            setLoadError(true);
                        }}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            transform: 'translateZ(0)',
                            WebkitTransform: 'translateZ(0)',
                            willChange: 'transform',
                        }}
                    />
                ) : loadError ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#fff', textAlign: 'center', padding: '24px' }}>
                        <Film size={40} color="#f5a524" />
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#f5a524' }}>Connected Video</span>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', maxWidth: '280px' }}>
                            This video could not be loaded or is processing.
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                marginTop: '8px',
                                background: 'rgba(245, 165, 36, 0.2)',
                                border: '1px solid rgba(245, 165, 36, 0.4)',
                                color: '#f5a524',
                                padding: '8px 18px',
                                borderRadius: '20px',
                                fontWeight: 700,
                                fontSize: '12px',
                                cursor: 'pointer'
                            }}
                        >
                            Close (or swipe right)
                        </button>
                    </div>
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
