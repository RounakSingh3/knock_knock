import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trash2 } from 'lucide-react';
import { type UserStoryGroup, deleteStory } from '../lib/database';

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
    const navigate = useNavigate();

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
                return prev + 1; // 100 steps -> 5 seconds (50ms per step)
            });
        }, 50); // 50ms * 100 = 5000ms = 5 seconds

        return () => clearInterval(interval);
    }, [currentStory, isPaused, handleNextStory]);

    const handleDelete = async () => {
        if (!currentStory || !window.confirm('Are you sure you want to delete this story?')) return;
        
        // Pause timer while deleting
        setIsPaused(true);
        await deleteStory(currentStory.id);
        
        // Update local state
        const newGroups = [...storyGroups];
        newGroups[groupIndex].stories.splice(storyIndex, 1);
        
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
                            <Trash2 size={24} color="white" />
                        </button>
                    )}
                    <button onClick={onClose} className="icon-btn">
                        <X size={28} color="white" />
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

            {/* Story Image */}
            <img 
                src={currentStory.image_url} 
                alt="Story" 
                className="story-image"
                style={{ filter: currentStory.filter_name ? currentStory.filter_name : 'none' }}
            />

            {/* Caption */}
            {currentStory.caption && (
                <div className="story-caption-overlay">
                    {currentStory.caption}
                </div>
            )}
            
            <style>{`
                .story-viewer-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: #000;
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
                    color: white;
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
                    color: white;
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
