import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trash2, Music, Play, Pause, Volume2, VolumeX, SkipForward, Clock, Rocket, Zap, ExternalLink, Check } from 'lucide-react';
import { type UserStoryGroup, deleteStory, recordScreenDelivery, convertToPersonalSnap } from '../lib/database';
import { audioPlayer } from '../lib/audioPlayer';
import { getCleanSongUrl, isVideoUrl } from '../lib/media';

// Map filter names stored in DB to actual CSS filter values
const FILTER_MAP: Record<string, string> = {
    'Normal': '',
    'Vintage': 'sepia(0.5) contrast(1.2)',
    'B&W': 'grayscale(1) contrast(1.1)',
    'Neon': 'hue-rotate(90deg) saturate(2)',
    'Cinematic': 'contrast(1.2) saturate(1.1) brightness(0.9) blur(0.5px)',
    'Cool': 'hue-rotate(-30deg) saturate(1.2)',
    'Warm': 'sepia(0.3) saturate(1.4)',
    'Alien': 'invert(0.8) hue-rotate(180deg)',
};

interface StoryViewerProps {
    storyGroups: UserStoryGroup[];
    initialGroupIndex: number;
    currentUserId?: string;
    onClose: () => void;
    onGroupsUpdated: (groups: UserStoryGroup[]) => void;
}

const StoryViewer: React.FC<StoryViewerProps> = ({ 
    storyGroups, 
    initialGroupIndex, 
    currentUserId,
    onClose,
    onGroupsUpdated
}) => {
    const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
    const [storyIndex, setStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const bgAudioRef = useRef<HTMLAudioElement | null>(null);
    const storyVideoRef = useRef<HTMLVideoElement | null>(null);
    const navigate = useNavigate();

    const currentGroup = storyGroups[groupIndex];
    const currentStory = currentGroup?.stories[storyIndex];
    const isVideo = isVideoUrl(currentStory?.image_url);

    const [audioPlaying, setAudioPlaying] = useState(true);
    const [musicMuted, setMusicMuted] = useState(false);
    const [snapConvertedToast, setSnapConvertedToast] = useState(false);

    const handleConvertToSnap = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUserId || !currentStory) {
            alert('Please log in to convert this video into your Snap.');
            return;
        }
        try {
            const { error } = await convertToPersonalSnap(currentUserId, currentStory, currentGroup?.username);
            if (error) throw error;
            setSnapConvertedToast(true);
            setTimeout(() => setSnapConvertedToast(false), 3000);
        } catch (err: any) {
            console.error('Failed to convert to snap:', err);
            alert('Could not convert video to snap. Please try again.');
        }
    };

    const handleNextStory = useCallback(() => {
        if (!currentGroup) return;
        if (storyIndex < currentGroup.stories.length - 1) {
            setStoryIndex(prev => prev + 1);
            setProgress(0);
        } else if (groupIndex < storyGroups.length - 1) {
            setGroupIndex(prev => prev + 1);
            setStoryIndex(0);
            setProgress(0);
        } else {
            onClose();
        }
    }, [currentGroup, groupIndex, storyGroups.length, storyIndex, onClose]);

    const handlePrevStory = useCallback(() => {
        if (!currentGroup) return;
        if (storyIndex > 0) {
            setStoryIndex(prev => prev - 1);
            setProgress(0);
        } else if (groupIndex > 0) {
            const prevGroup = storyGroups[groupIndex - 1];
            setGroupIndex(prev => prev - 1);
            setStoryIndex(prevGroup.stories.length - 1);
            setProgress(0);
        } else {
            setProgress(0);
        }
    }, [currentGroup, groupIndex, storyGroups, storyIndex]);

    // Sync audio element state with React state
    useEffect(() => {
        if (bgAudioRef.current) {
            bgAudioRef.current.muted = musicMuted;
            if (isPaused || !audioPlaying) {
                bgAudioRef.current.pause();
            } else {
                bgAudioRef.current.play().catch(e => {
                    console.warn('[StoryViewer] Audio play blocked, waiting for tap:', e);
                    const onStoryTap = () => {
                        bgAudioRef.current?.play().catch(() => {});
                        window.removeEventListener('click', onStoryTap);
                        window.removeEventListener('touchstart', onStoryTap);
                    };
                    window.addEventListener('click', onStoryTap, { once: true, capture: true });
                    window.addEventListener('touchstart', onStoryTap, { once: true, capture: true });
                });
            }
        }
    }, [isPaused, audioPlaying, musicMuted, currentStory]);

    // Reset state when story changes
    useEffect(() => {
        setProgress(0);
        setAudioPlaying(true);
        setIsPaused(false);
        if (storyVideoRef.current) {
            storyVideoRef.current.currentTime = 0;
            storyVideoRef.current.play().catch(() => {});
        }
    }, [currentStory]);

    // Sync pause state with video element
    useEffect(() => {
        if (storyVideoRef.current) {
            if (isPaused) {
                storyVideoRef.current.pause();
            } else {
                storyVideoRef.current.play().catch(() => {});
            }
        }
    }, [isPaused]);

    const toggleAudioPlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        setAudioPlaying(prev => !prev);
        setIsPaused(prev => !prev);
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMusicMuted(prev => !prev);
    };

    const handleForward = (e: React.MouseEvent) => {
        e.stopPropagation();
        handleNextStory();
    };

    // Trap hardware back button
    useEffect(() => {
        window.history.pushState({ modal: 'story' }, '');
        const handlePopState = () => onClose();
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [onClose]);

    // Auto-advance story timer for photos (5 seconds)
    useEffect(() => {
        if (isPaused || !currentStory || isVideo) return;

        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    return 100;
                }
                return prev + 2; // 50 * 100ms = 5s
            });
        }, 100);

        return () => clearInterval(interval);
    }, [currentStory, isPaused, isVideo]);

    // Video playback progress handler (capped at 30 seconds max)
    const handleVideoTimeUpdate = () => {
        if (!storyVideoRef.current || isPaused) return;
        const video = storyVideoRef.current;
        // Enforce 30-second cap on video stories
        const effectiveDuration = Math.min(video.duration && !isNaN(video.duration) && video.duration > 0 ? video.duration : 30, 30);
        const currentTime = Math.min(video.currentTime || 0, effectiveDuration);
        const pct = (currentTime / effectiveDuration) * 100;
        setProgress(pct);
        if (currentTime >= effectiveDuration) {
            handleNextStory();
        }
    };

    const handleVideoEnded = () => {
        handleNextStory();
    };

    // Watchdog timer for videos: ensures transitions if video stalls (max 30.5s)
    useEffect(() => {
        if (!isVideo || isPaused || !currentStory) return;
        const watchdog = setTimeout(() => {
            handleNextStory();
        }, 30500);
        return () => clearTimeout(watchdog);
    }, [currentStory, isVideo, isPaused, handleNextStory]);

    useEffect(() => {
        if (progress >= 100) {
            handleNextStory();
        }
    }, [progress, handleNextStory]);

    // Removed audioPlayer.play() since we use a physical native <audio> tag now.

    const handleDelete = async () => {
        if (!currentStory || !window.confirm('Are you sure you want to delete this story?')) return;
        
        // Pause timer while deleting
        setIsPaused(true);
        await deleteStory(currentStory.id);
        
        // Update local state — deep copy to avoid mutating props
        const newGroups = storyGroups.map((g, i) => 
            i === groupIndex 
                ? { ...g, stories: g.stories.filter((_, si) => si !== storyIndex) }
                : g
        );
        
        if (newGroups[groupIndex].stories.length === 0) {
            newGroups.splice(groupIndex, 1);
            if (newGroups.length === 0) {
                onClose();
            } else if (groupIndex >= newGroups.length) {
                setGroupIndex(newGroups.length - 1);
                setStoryIndex(0);
            } else {
                setStoryIndex(0);
            }
        } else if (storyIndex >= newGroups[groupIndex].stories.length) {
            setStoryIndex(newGroups[groupIndex].stories.length - 1);
        }
        
        onGroupsUpdated(newGroups);
        setProgress(0);
        setIsPaused(false);
    };

    // Record unique screen delivery
    useEffect(() => {
        if (currentStory?.id && currentUserId) {
            recordScreenDelivery(currentStory.id, currentUserId);
        }
    }, [currentStory?.id, currentUserId]);

    if (!currentGroup || !currentStory) return null;

    const timeSince = (dateString: string) => {
        const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
        if (diff < 60) return `${diff}s`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        return `${Math.floor(diff / 3600)}h`;
    };

    const getTimeLeft24h = (createdStr?: string) => {
        if (!createdStr) return null;
        const expiryTime = new Date(createdStr).getTime() + 24 * 60 * 60 * 1000;
        const msLeft = expiryTime - Date.now();
        if (msLeft <= 0) return 'Expired';
        const hours = Math.floor(msLeft / (1000 * 60 * 60));
        const mins = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) return `${hours}h ${mins}m left`;
        return `${mins}m left`;
    };

    return (
        <div className="story-viewer-overlay">
            {/* Progress Bars */}
            <div className="story-progress-container">
                {currentGroup.stories.map((_, idx) => (
                    <div key={idx} className="story-progress-segment">
                        <div 
                            className="story-progress-fill" 
                            style={{ 
                                width: idx < storyIndex ? '100%' : idx === storyIndex ? `${progress}%` : '0%',
                                transition: idx === storyIndex && progress > 0 ? 'width 0.05s linear' : 'none'
                            }} 
                        />
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="story-header" style={{ zIndex: 100 }}>
                <div 
                    className="story-user-info" 
                    onClick={() => {
                        onClose();
                        navigate(`/profile/${currentGroup.username}`);
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <img src={currentGroup.avatarUrl} alt={currentGroup.username} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="story-username">{currentGroup.username}</span>
                            <span className="story-time">{timeSince(currentStory.created_at)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                            <span style={{
                                fontSize: '10px',
                                padding: '1px 6px',
                                borderRadius: '10px',
                                background: 'rgba(0,0,0,0.6)',
                                color: '#60a5fa',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                border: '1px solid rgba(96,165,250,0.3)',
                                backdropFilter: 'blur(4px)'
                            }}>
                                <Clock size={10} /> {getTimeLeft24h(currentStory.created_at) || '24h'}
                            </span>
                            {currentStory.is_boosted && (
                                <span style={{
                                    fontSize: '10px',
                                    padding: '1px 6px',
                                    borderRadius: '10px',
                                    background: 'rgba(245,165,36,0.3)',
                                    color: '#f5a524',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontWeight: 'bold',
                                    border: '1px solid rgba(245,165,36,0.5)',
                                    backdropFilter: 'blur(4px)'
                                }}>
                                    <Rocket size={10} /> {currentStory.screens_delivered || 0}/{currentStory.target_screens || 24} Screens
                                </span>
                            )}
                            {isVideo && (
                                <span style={{
                                    fontSize: '10px',
                                    padding: '1px 6px',
                                    borderRadius: '10px',
                                    background: 'rgba(239, 68, 68, 0.25)',
                                    color: '#f87171',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontWeight: 'bold',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    backdropFilter: 'blur(4px)'
                                }}>
                                    <Play size={9} fill="#f87171" /> 30s Video
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="story-actions" style={{ display: 'flex', alignItems: 'center' }}>
                    {currentUserId && currentStory.user_id !== currentUserId && (
                        <button
                            onClick={handleConvertToSnap}
                            title="Convert video to your own 24h Snap"
                            style={{
                                background: 'linear-gradient(135deg, #f5a524, #ff6b35)',
                                border: 'none',
                                borderRadius: '16px',
                                padding: '4px 10px',
                                color: '#000',
                                fontWeight: 800,
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginRight: '10px',
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(245,165,36,0.4)',
                                transition: 'transform 0.1s ease'
                            }}
                            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <Zap size={13} fill="#000" />
                            <span>Convert Snap</span>
                        </button>
                    )}
                    {currentStory.user_id === currentUserId && (
                        <button onClick={handleDelete} className="icon-btn" style={{ marginRight: 15 }}>
                            <Trash2 size={24} color="var(--text-active)" />
                        </button>
                    )}
                    <button onClick={onClose} className="icon-btn">
                        <X size={28} color="var(--text-active)" />
                    </button>
                </div>
            </div>

            {/* Touch Areas */}
            <div 
                className="story-touch-area left" 
                onClick={handlePrevStory}
                onMouseDown={() => setIsPaused(true)}
                onMouseUp={() => setIsPaused(false)}
                onTouchStart={() => setIsPaused(true)}
                onTouchEnd={() => setIsPaused(false)}
            />
            <div 
                className="story-touch-area right" 
                onClick={handleNextStory}
                onMouseDown={() => setIsPaused(true)}
                onMouseUp={() => setIsPaused(false)}
                onTouchStart={() => setIsPaused(true)}
                onTouchEnd={() => setIsPaused(false)}
            />

            {/* Story Image / Video */}
            {isVideoUrl(currentStory.image_url) ? (
                <video
                    ref={storyVideoRef}
                    src={currentStory.image_url}
                    autoPlay
                    playsInline
                    muted={Boolean(currentStory.music_url || currentStory.music_title)}
                    className="story-image"
                    onTimeUpdate={handleVideoTimeUpdate}
                    onEnded={handleVideoEnded}
                    onError={() => {
                        console.warn('Video failed to load in StoryViewer:', currentStory.id);
                        handleNextStory();
                    }}
                    style={{ filter: currentStory.filter_name ? (FILTER_MAP[currentStory.filter_name] || 'none') : 'none', objectFit: 'contain' }}
                />
            ) : (
                <img 
                    src={currentStory.image_url} 
                    alt="Story" 
                    className="story-image"
                    onError={() => {
                        console.warn('Image failed to load in StoryViewer:', currentStory.id);
                        handleNextStory();
                    }}
                    style={{ filter: currentStory.filter_name ? (FILTER_MAP[currentStory.filter_name] || 'none') : 'none' }}
                />
            )}

            {/* Toast when converted to Snap */}
            {snapConvertedToast && (
                <div style={{
                    position: 'absolute',
                    top: '75px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(34, 197, 94, 0.95)',
                    backdropFilter: 'blur(10px)',
                    color: '#fff',
                    padding: '8px 18px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    zIndex: 200,
                    boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <Check size={14} /> Converted to your 24h Snap!
                </div>
            )}

            {/* Caption with Highlighted #Hashtags */}
            {currentStory.caption && (
                <div className="story-caption-overlay" style={{
                    maxHeight: '120px',
                    overflowY: 'auto',
                    lineHeight: 1.45,
                    fontSize: '13px'
                }}>
                    {currentStory.caption.split(' ').map((word: string, wIdx: number) => {
                        if (word.startsWith('#') && word.length > 1) {
                            return (
                                <span key={wIdx} style={{ color: '#f5a524', fontWeight: 700, marginRight: '4px' }}>
                                    {word}{' '}
                                </span>
                            );
                        }
                        return word + ' ';
                    })}
                </div>
            )}

            {/* 📢 Instagram-Style Advertisement Call-to-Action Bar */}
            {currentStory.link_url && (
                <div style={{
                    position: 'absolute',
                    bottom: (currentStory.music_url || currentStory.music_title) ? '180px' : '95px',
                    left: '16px',
                    right: '16px',
                    zIndex: 110,
                    display: 'flex',
                    justifyContent: 'center'
                }}>
                    <a
                        href={currentStory.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '380px',
                            background: 'linear-gradient(135deg, rgba(255, 51, 102, 0.95) 0%, rgba(245, 165, 36, 0.95) 100%)',
                            backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(255, 255, 255, 0.35)',
                            borderRadius: '16px',
                            padding: '11px 18px',
                            color: '#fff',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: '0 8px 30px rgba(255, 51, 102, 0.45)',
                            cursor: 'pointer',
                            fontWeight: 700,
                            transition: 'transform 0.15s ease'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ExternalLink size={16} color="#fff" />
                            <span style={{ fontSize: '0.92rem', letterSpacing: '0.2px' }}>
                                {currentStory.link_cta || 'Learn More'}
                            </span>
                            {currentStory.is_sponsored && (
                                <span style={{
                                    fontSize: '0.65rem',
                                    background: 'rgba(0,0,0,0.35)',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    Sponsored Ad
                                </span>
                            )}
                        </div>
                        <span style={{ fontSize: '0.82rem', opacity: 0.9 }}>Visit ↗</span>
                    </a>
                </div>
            )}

            {/* CUSTOM NATIVE AUDIO PLAYER WITH CONTROLS */}
            {(currentStory.music_url || currentStory.music_title) && (() => {
                const storySongUrl = getCleanSongUrl(currentStory.music_title, currentStory.music_url) || currentStory.music_url;
                if (!storySongUrl || storySongUrl.includes('soundhelix')) return null;
                return (
                    <>
                        <audio
                            ref={bgAudioRef}
                            src={storySongUrl}
                            autoPlay
                            loop
                            playsInline
                            style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                        />
                    <div style={{
                        position: 'absolute', bottom: '130px', left: '0', right: '0',
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        zIndex: 100
                    }}>
                        {/* Song Info Badge */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'rgba(0,0,0,0.65)', padding: '8px 16px', borderRadius: '24px',
                            border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '12px',
                            fontWeight: '600', textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)'
                        }}>
                            <Music size={12} color="#f5a524" className="music-icon-spin" style={{ animation: audioPlaying && !isPaused ? 'spin 3s linear infinite' : 'none' }} />
                            <span>{currentStory.music_title || 'Music'} • {currentStory.music_artist || 'Unknown'}</span>
                        </div>
                    </div>
                </>
                );
            })()}
            
            <style>{`
                .story-viewer-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: var(--bg-color);
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                }
                .story-progress-container {
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    right: 10px;
                    display: flex;
                    gap: 4px;
                    z-index: 10;
                }
                .story-progress-segment {
                    flex: 1;
                    height: 2px;
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 2px;
                    overflow: hidden;
                }
                .story-progress-fill {
                    height: 100%;
                    background: #fff;
                    width: 0%;
                }
                .story-header {
                    position: absolute;
                    top: 20px;
                    left: 10px;
                    right: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    z-index: 10;
                    padding-top: 10px;
                }
                .story-user-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .story-user-info img {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    object-fit: cover;
                }
                .story-username {
                    color: var(--text-active);
                    font-weight: 600;
                    font-size: 14px;
                    text-shadow: 0 1px 3px rgba(0,0,0,0.8);
                }
                .story-time {
                    color: rgba(255,255,255,0.7);
                    font-size: 14px;
                    text-shadow: 0 1px 3px rgba(0,0,0,0.8);
                }
                .story-touch-area {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    z-index: 5;
                }
                .story-touch-area.left {
                    left: 0;
                    width: 30%;
                }
                .story-touch-area.right {
                    right: 0;
                    width: 70%;
                }
                .story-image {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
                .story-caption-overlay {
                    position: absolute;
                    bottom: 40px;
                    left: 20px;
                    right: 20px;
                    background: rgba(0,0,0,0.6);
                    color: var(--text-active);
                    padding: 12px 16px;
                    border-radius: 12px;
                    backdrop-filter: blur(5px);
                    font-size: 16px;
                    font-weight: bold;
                    z-index: 10;
                    text-align: center;
                }
            `}</style>
        </div>
    );
};

export default StoryViewer;
