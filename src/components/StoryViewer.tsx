import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trash2, Music, Play, Pause, Volume2, VolumeX, SkipForward } from 'lucide-react';
import { type UserStoryGroup, deleteStory } from '../lib/database';
import { audioPlayer } from '../lib/audioPlayer';

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
    const navigate = useNavigate();

    const [audioPlaying, setAudioPlaying] = useState(true);
    const [musicMuted, setMusicMuted] = useState(false);

    // Sync audio element state with React state
    useEffect(() => {
        if (bgAudioRef.current) {
            bgAudioRef.current.muted = musicMuted;
            if (isPaused || !audioPlaying) {
                bgAudioRef.current.pause();
            } else {
                bgAudioRef.current.play().catch(e => console.warn('Audio play blocked:', e));
            }
        }
    }, [isPaused, audioPlaying, musicMuted, currentStory]);

    // Reset audio state when story changes
    useEffect(() => {
        setAudioPlaying(true);
        setIsPaused(false);
    }, [currentStory]);

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

    const currentGroup = storyGroups[groupIndex];
    const currentStory = currentGroup?.stories[storyIndex];

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
            setProgress(0); // Reset current
        }
    }, [currentGroup, groupIndex, storyGroups, storyIndex]);

    useEffect(() => {
        if (isPaused || !currentStory) return;

        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    handleNextStory();
                    return 0;
                }
                return prev + 2; // 50 steps * 2 = 100% -> 5 seconds (100ms per step)
            });
        }, 100); // 50ms * 100 = 5000ms = 5 seconds

        return () => clearInterval(interval);
    }, [currentStory, isPaused, handleNextStory]);

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

    if (!currentGroup || !currentStory) return null;

    const timeSince = (dateString: string) => {
        const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
        if (diff < 60) return `${diff}s`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        return `${Math.floor(diff / 3600)}h`;
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
                    <span className="story-username">{currentGroup.username}</span>
                    <span className="story-time">{timeSince(currentStory.created_at)}</span>
                </div>
                <div className="story-actions">
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
            {/\.(mp4|webm|mov)(\?.*)?$/i.test(currentStory.image_url) || currentStory.image_url.startsWith('data:video') ? (
                <video
                    src={currentStory.image_url}
                    autoPlay
                    loop
                    playsInline
                    className="story-image"
                    onError={() => {
                        deleteStory(currentStory.id);
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
                        deleteStory(currentStory.id);
                        handleNextStory();
                    }}
                    style={{ filter: currentStory.filter_name ? (FILTER_MAP[currentStory.filter_name] || 'none') : 'none' }}
                />
            )}

            {/* Caption */}
            {currentStory.caption && (
                <div className="story-caption-overlay">
                    {currentStory.caption}
                </div>
            )}

            {/* CUSTOM NATIVE AUDIO PLAYER WITH CONTROLS */}
            {currentStory.music_url && (
                <>
                    <audio
                        ref={bgAudioRef}
                        src={currentStory.music_url}
                        autoPlay
                        loop
                        playsInline
                    />
                    <div style={{
                        position: 'absolute', bottom: '130px', left: '0', right: '0',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                        zIndex: 100
                    }}>
                        {/* Song Info Badge */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'rgba(0,0,0,0.75)', padding: '6px 14px', borderRadius: '20px',
                            border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '11px',
                            fontWeight: '600', letterSpacing: '0.2px', textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)'
                        }}>
                            <Music size={11} color="#f5a524" className="music-icon-spin" style={{ animation: audioPlaying && !isPaused ? 'spin 3s linear infinite' : 'none' }} />
                            <span>{currentStory.music_title || 'Music'} - {currentStory.music_artist || 'Unknown'}</span>
                        </div>

                        {/* Custom Controls */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '20px',
                            background: 'rgba(0,0,0,0.85)', padding: '10px 22px', borderRadius: '30px',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.18)',
                            backdropFilter: 'blur(10px)'
                        }}>
                            {/* Play/Pause Button */}
                            <button 
                                onClick={toggleAudioPlay}
                                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', outline: 'none' }}
                                title={audioPlaying ? "Pause Story & Music" : "Play Story & Music"}
                            >
                                {audioPlaying ? <Pause size={18} fill="#fff" /> : <Play size={18} fill="#fff" />}
                            </button>

                            {/* Mute/Unmute Button */}
                            <button 
                                onClick={toggleMute}
                                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', outline: 'none' }}
                                title={musicMuted ? "Unmute Music" : "Mute Music"}
                            >
                                {musicMuted ? <VolumeX size={18} color="#f5a524" /> : <Volume2 size={18} />}
                            </button>

                            {/* Next / Forward Button */}
                            <button 
                                onClick={handleForward}
                                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', outline: 'none' }}
                                title="Next Story"
                            >
                                <SkipForward size={18} fill="#fff" />
                            </button>
                        </div>
                    </div>
                </>
            )}
            
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
