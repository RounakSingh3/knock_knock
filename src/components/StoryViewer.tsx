import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trash2, Music, Play, Pause, Volume2, VolumeX, SkipForward, Clock, Rocket, Zap, ExternalLink, Check, Film, Loader2, Coins } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { type UserStoryGroup, deleteStory, recordScreenDelivery, convertToPersonalSnap, isKnockVideoLink, parseKnockVideoLink, fetchPostById, givePointsToContent } from '../lib/database';
import { audioPlayer } from '../lib/audioPlayer';
import { getCleanSongUrl, isVideoUrl } from '../lib/media';
import { recordImplicitSignal } from '../lib/algorithm';

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
    
    const groupIndexRef = useRef(groupIndex);
    const storyIndexRef = useRef(storyIndex);
    const progressRef = useRef(progress);
    
    useEffect(() => { groupIndexRef.current = groupIndex; }, [groupIndex]);
    useEffect(() => { storyIndexRef.current = storyIndex; }, [storyIndex]);
    useEffect(() => { progressRef.current = progress; }, [progress]);

    const bgAudioRef = useRef<HTMLAudioElement | null>(null);
    const storyVideoRef = useRef<HTMLVideoElement | null>(null);
    const storyStartRef = useRef<number>(Date.now());
    const navigate = useNavigate();

    const { user: authUser, points, setPoints } = useContext(AppContext);
    const currentGroup = storyGroups[groupIndex];
    const currentStory = currentGroup?.stories[storyIndex];
    const cleanMediaUrl = useMemo(() => (currentStory?.image_url || '').split('#')[0], [currentStory?.image_url]);
    const isVideo = isVideoUrl(cleanMediaUrl);

    const posterUrlFromStory = useMemo(() => {
        if (!currentStory) return null;
        if (currentStory.image_url && currentStory.image_url.includes('#POSTER:')) {
            const parts = currentStory.image_url.split('#POSTER:');
            const posterData = parts[1]?.split('#')[0];
            if (posterData) {
                try { return decodeURIComponent(posterData); } catch (_) { return posterData; }
            }
        }
        return currentStory.poster_url || null;
    }, [currentStory]);

    const [videoHasVisual, setVideoHasVisual] = useState(true);

    const effectiveUserId = currentUserId || authUser?.id;
    const isOwner = Boolean(
        (effectiveUserId && currentStory?.user_id === effectiveUserId) ||
        (effectiveUserId && currentGroup?.userId === effectiveUserId) ||
        (authUser?.username && currentGroup?.username && authUser.username.toLowerCase() === currentGroup.username.toLowerCase()) ||
        (authUser?.username && currentStory?.username && authUser.username.toLowerCase() === currentStory.username.toLowerCase())
    );

    const [audioPlaying, setAudioPlaying] = useState(true);
    const [musicMuted, setMusicMuted] = useState(false);
    const [snapConvertedToast, setSnapConvertedToast] = useState(false);
    const [showBoostModal, setShowBoostModal] = useState(false);
    const [boostPointsAmount, setBoostPointsAmount] = useState(10);
    const [isBoostingStory, setIsBoostingStory] = useState(false);
    const [boostStoryToast, setBoostStoryToast] = useState<string | null>(null);
    const [connectedVideoModal, setConnectedVideoModal] = useState<{
        id?: string;
        videoUrl?: string;
        caption?: string;
        username?: string;
    } | null>(null);

    const touchStartPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const mouseStartPosRef = useRef<{ x: number; y: number; time: number } | null>(null);

    const handleOpenLinkedVideo = useCallback(() => {
        if (!currentStory?.link_url) return;
        setIsPaused(true);

        const parsed = parseKnockVideoLink(currentStory.link_url);
        if (parsed) {
            setConnectedVideoModal(parsed);
        } else if (isKnockVideoLink(currentStory.link_url)) {
            setConnectedVideoModal({ videoUrl: currentStory.link_url, caption: 'Knock Knock Video' });
        } else {
            window.open(currentStory.link_url, '_blank', 'noopener,noreferrer');
        }
    }, [currentStory]);

    // Resolve video URL if only ID was stored in the link
    useEffect(() => {
        if (connectedVideoModal?.id && !connectedVideoModal.videoUrl) {
            fetchPostById(connectedVideoModal.id).then(post => {
                if (post && post.image_url) {
                    setConnectedVideoModal(prev => prev ? {
                        ...prev,
                        videoUrl: post.image_url,
                        caption: prev.caption || post.caption,
                        username: prev.username || post.username
                    } : null);
                }
            });
        }
    }, [connectedVideoModal?.id]);

    // Pause story playback when connected video modal is active
    useEffect(() => {
        if (connectedVideoModal) {
            setIsPaused(true);
            if (bgAudioRef.current) bgAudioRef.current.pause();
            if (storyVideoRef.current) storyVideoRef.current.pause();
        }
    }, [connectedVideoModal]);

    const handleConvertToSnap = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUserId || !currentStory) {
            alert('Please log in to convert this video into your Knockup.');
            return;
        }
        try {
            const { error } = await convertToPersonalSnap(currentUserId, currentStory, currentGroup?.username);
            if (error) throw error;
            setSnapConvertedToast(true);
            setTimeout(() => setSnapConvertedToast(false), 3000);
        } catch (err: any) {
            console.error('Failed to convert to knockup:', err);
            alert('Could not convert video to Knockup. Please try again.');
        }
    };

    const handleBoostStory = async () => {
        if (!currentStory || isBoostingStory || boostPointsAmount <= 0) return;
        setIsBoostingStory(true);
        try {
            const res = await givePointsToContent({
                giverId: effectiveUserId || authUser?.id || '',
                targetType: 'story',
                targetId: currentStory.id,
                authorId: currentStory.user_id,
                amount: boostPointsAmount,
                currentGiverPoints: points,
            });
            if (res.success) {
                setPoints(res.newGiverPoints);
                currentStory.target_screens = (currentStory.target_screens || 24) + res.extraScreens;
                currentStory.is_boosted = true;
                setShowBoostModal(false);
                setBoostStoryToast(`🎉 Boosted! Story will reach ${res.extraScreens} more screens!`);
                setTimeout(() => setBoostStoryToast(null), 3500);
            } else {
                alert(res.error || 'Failed to boost');
            }
        } catch (e) {
            console.error('Boost story failed:', e);
            alert('Could not boost story.');
        } finally {
            setIsBoostingStory(false);
        }
    };

    // Pause story playback when boost modal is open
    useEffect(() => {
        if (showBoostModal) {
            setIsPaused(true);
            if (bgAudioRef.current) bgAudioRef.current.pause();
            if (storyVideoRef.current) storyVideoRef.current.pause();
        }
    }, [showBoostModal]);

    const handleNextStory = useCallback(() => {
        if (!currentGroup || !currentStory) return;
        const dwellTime = Date.now() - storyStartRef.current;
        if (progressRef.current >= 95) {
            recordImplicitSignal({
                type: 'story_complete',
                postId: currentStory.id,
                category: (currentStory as any).category || 'General',
                timestamp: Date.now()
            });
        } else if (dwellTime < 1800) {
            recordImplicitSignal({
                type: 'story_skip',
                postId: currentStory.id,
                category: (currentStory as any).category || 'General',
                timestamp: Date.now()
            });
        }
        storyStartRef.current = Date.now();

        if (storyIndexRef.current < currentGroup.stories.length - 1) {
            setStoryIndex(prev => prev + 1);
            setProgress(0);
        } else if (groupIndexRef.current < storyGroups.length - 1) {
            setGroupIndex(prev => prev + 1);
            setStoryIndex(0);
            setProgress(0);
        } else {
            onClose();
        }
    }, [currentGroup, currentStory, storyGroups.length, onClose]);

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
        storyStartRef.current = Date.now();
        setProgress(0);
        setAudioPlaying(true);
        setIsPaused(false);
        setVideoHasVisual(true);
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
        if (currentStory && (Date.now() - storyStartRef.current < 1800)) {
            recordImplicitSignal({
                type: 'story_skip',
                postId: currentStory.id,
                category: (currentStory as any).category || 'General',
                timestamp: Date.now()
            });
        }
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

        // Visual health check
        if (video.currentTime > 0.3) {
            if (!videoHasVisual) {
                setVideoHasVisual(true);
            }
        }

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

    // Swipe & Gesture Navigation Handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches[0]) {
            touchStartPosRef.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
                time: Date.now()
            };
            setIsPaused(true);
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        setIsPaused(false);
        if (!touchStartPosRef.current || !e.changedTouches[0]) return;
        const diffX = e.changedTouches[0].clientX - touchStartPosRef.current.x;
        const diffY = e.changedTouches[0].clientY - touchStartPosRef.current.y;
        const startX = touchStartPosRef.current.x;
        const elapsed = Date.now() - touchStartPosRef.current.time;
        touchStartPosRef.current = null;

        // Horizontal swipe (> 45px displacement and greater than vertical)
        if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX < 0) {
                // Swipe LEFT 👈 -> Open Connected Video or advance
                if (currentStory?.link_url) {
                    handleOpenLinkedVideo();
                } else {
                    handleNextStory();
                }
            } else {
                // Swipe RIGHT 👉 -> Previous Story
                handlePrevStory();
            }
            return;
        }

        // Tap
        if (Math.abs(diffX) < 18 && Math.abs(diffY) < 18 && elapsed < 450) {
            const width = window.innerWidth;
            if (startX < width * 0.35) {
                handlePrevStory();
            } else {
                handleNextStory();
            }
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button, a, .story-header, .story-caption-overlay, .connected-video-player')) return;
        mouseStartPosRef.current = {
            x: e.clientX,
            y: e.clientY,
            time: Date.now()
        };
        setIsPaused(true);
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        setIsPaused(false);
        if (!mouseStartPosRef.current) return;
        const diffX = e.clientX - mouseStartPosRef.current.x;
        const diffY = e.clientY - mouseStartPosRef.current.y;
        const startX = mouseStartPosRef.current.x;
        const elapsed = Date.now() - mouseStartPosRef.current.time;
        mouseStartPosRef.current = null;

        // Mouse drag left/right
        if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX < 0) {
                if (currentStory?.link_url) {
                    handleOpenLinkedVideo();
                } else {
                    handleNextStory();
                }
            } else {
                handlePrevStory();
            }
            return;
        }

        // Quick click
        if (Math.abs(diffX) < 12 && Math.abs(diffY) < 12 && elapsed < 450) {
            const width = window.innerWidth;
            if (startX < width * 0.35) {
                handlePrevStory();
            } else {
                handleNextStory();
            }
        }
    };

    if (!currentGroup || !currentStory) return null;

    return (
        <div 
            className="story-viewer-overlay"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            style={{ touchAction: 'pan-y' }}
        >
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
                        {isOwner && (
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
                        )}
                    </div>
                </div>
                <div className="story-actions" style={{ display: 'flex', alignItems: 'center' }}>
                    {effectiveUserId && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowBoostModal(true);
                            }}
                            title="Give points to boost this story to reach more screens"
                            style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                border: 'none',
                                borderRadius: '16px',
                                padding: '4px 10px',
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginRight: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)',
                                transition: 'transform 0.1s ease'
                            }}
                            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <Coins size={13} fill="#fff" />
                            <span>Boost (+Screens)</span>
                        </button>
                    )}
                    {!isOwner && effectiveUserId && (
                        <button
                            onClick={handleConvertToSnap}
                            title="Convert video to your own 24h Knockup"
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
                            <span>Convert Knockup</span>
                        </button>
                    )}
                    {isOwner && (
                        <button onClick={handleDelete} className="icon-btn" style={{ marginRight: 15 }}>
                            <Trash2 size={24} color="var(--text-active)" />
                        </button>
                    )}
                    <button onClick={onClose} className="icon-btn">
                        <X size={28} color="var(--text-active)" />
                    </button>
                </div>
            </div>

            {/* Story Image / Video */}
            {isVideo ? (
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <video
                        ref={storyVideoRef}
                        src={cleanMediaUrl}
                        poster={posterUrlFromStory || undefined}
                        autoPlay
                        playsInline
                        muted={Boolean(currentStory.music_url || currentStory.music_title)}
                        className="story-image"
                        onTimeUpdate={handleVideoTimeUpdate}
                        onEnded={handleVideoEnded}
                        onError={() => {
                            console.warn('Video failed to load in StoryViewer:', currentStory.id);
                        }}
                        style={{ 
                            filter: currentStory.filter_name ? (FILTER_MAP[currentStory.filter_name] || 'none') : 'none', 
                            objectFit: 'contain',
                            width: '100%',
                            height: '100%',
                            position: 'relative'
                        }}
                    />

                    {/* Fallback Display if Browser Cannot Decode Video Track (Audio Plays Uninterrupted!) */}
                    {!videoHasVisual && (
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#09090b',
                            overflow: 'hidden',
                            zIndex: 1
                        }}>
                            {/* Ambient Blurred Background from Poster or Avatar */}
                            <img 
                                src={posterUrlFromStory || currentGroup.avatarUrl} 
                                alt="" 
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    filter: 'blur(30px) brightness(0.35)',
                                    transform: 'scale(1.2)'
                                }}
                            />

                            {/* Centered Sharp Poster Image with Audio Badge */}
                            <div style={{
                                position: 'relative',
                                zIndex: 2,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '16px',
                                padding: '20px'
                            }}>
                                <div style={{
                                    position: 'relative',
                                    width: '220px',
                                    height: '220px',
                                    borderRadius: '28px',
                                    overflow: 'hidden',
                                    boxShadow: '0 16px 45px rgba(0,0,0,0.85), 0 0 30px rgba(245, 165, 36, 0.35)',
                                    border: '2px solid rgba(245, 165, 36, 0.65)'
                                }}>
                                    <img 
                                        src={posterUrlFromStory || currentGroup.avatarUrl} 
                                        alt={currentGroup.username}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        background: 'linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.85) 100%)',
                                        display: 'flex',
                                        alignItems: 'flex-end',
                                        justifyContent: 'center',
                                        paddingBottom: '12px'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            color: '#f5a524',
                                            fontSize: '11px',
                                            fontWeight: 800
                                        }}>
                                            <Music size={13} className="music-icon-spin" /> High-Quality Audio
                                        </div>
                                    </div>
                                </div>

                                <div style={{
                                    zIndex: 2,
                                    textAlign: 'center',
                                    background: 'rgba(0,0,0,0.7)',
                                    backdropFilter: 'blur(12px)',
                                    padding: '8px 20px',
                                    borderRadius: '20px',
                                    border: '1px solid rgba(255,255,255,0.12)'
                                }}>
                                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '13px' }}>
                                        {currentGroup.username}
                                    </div>
                                    <div style={{ color: '#f5a524', fontSize: '11px', marginTop: '2px' }}>
                                        🎵 Audio Playing Seamlessly
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <img 
                    src={cleanMediaUrl} 
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
                    <Check size={14} /> Converted to your 24h Knockup!
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

            {/* 📢 Connected Video (Swipe Left Feature) or Instagram-Style Advertisement Bar */}
            {currentStory.link_url && (
                <div style={{
                    position: 'absolute',
                    bottom: (currentStory.music_url || currentStory.music_title) ? '180px' : '95px',
                    left: '16px',
                    right: '16px',
                    zIndex: 110,
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'auto'
                }}>
                    {isKnockVideoLink(currentStory.link_url) ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenLinkedVideo();
                            }}
                            style={{
                                width: '100%',
                                maxWidth: '380px',
                                background: 'linear-gradient(135deg, rgba(245, 165, 36, 0.95) 0%, rgba(255, 107, 53, 0.95) 100%)',
                                backdropFilter: 'blur(16px)',
                                border: '1.5px solid rgba(255, 255, 255, 0.45)',
                                borderRadius: '18px',
                                padding: '11px 18px',
                                color: '#000',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                boxShadow: '0 8px 30px rgba(245, 165, 36, 0.45), 0 0 15px rgba(245, 165, 36, 0.3)',
                                cursor: 'pointer',
                                fontWeight: 800,
                                transition: 'transform 0.15s ease'
                            }}
                            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Film size={18} color="#000" strokeWidth={2.4} />
                                <span style={{ fontSize: '0.92rem', letterSpacing: '0.2px' }}>
                                    {currentStory.link_cta || 'Watch Connected Video'}
                                </span>
                            </div>
                            <span style={{
                                fontSize: '0.72rem',
                                background: 'rgba(0,0,0,0.25)',
                                color: '#000',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontWeight: 800
                            }}>
                                Swipe Left 👈
                            </span>
                        </button>
                    ) : (
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
                    )}
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

            {/* ⚡ Boost Story Screens (+Points) Modal */}
            {showBoostModal && currentStory && (
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
                                    Boost Screen Reach
                                </h3>
                                <span style={{ fontSize: '12px', color: '#6ee7b7' }}>
                                    Send this Knockup to more screens!
                                </span>
                            </div>
                        </div>

                        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
                            Every 1 point awards the creator and guarantees this Knockup is delivered to <strong>1 more friend's screen</strong> automatically!
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
                                {authUser?.username === 'popcorn05' ? 'Unlimited' : `${points} Points`}
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
                            onClick={handleBoostStory}
                            disabled={isBoostingStory || (authUser?.username !== 'popcorn05' && points < boostPointsAmount)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '16px',
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                border: 'none',
                                color: '#fff',
                                fontWeight: '800',
                                fontSize: '15px',
                                cursor: (authUser?.username !== 'popcorn05' && points < boostPointsAmount) ? 'not-allowed' : 'pointer',
                                opacity: (authUser?.username !== 'popcorn05' && points < boostPointsAmount) ? 0.5 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.45)'
                            }}
                        >
                            <Rocket size={18} />
                            <span>{isBoostingStory ? 'Boosting...' : `Boost (+${boostPointsAmount} Screens)`}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Boost Success Toast */}
            {boostStoryToast && (
                <div style={{
                    position: 'absolute',
                    top: '75px',
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
                    <Check size={16} /> {boostStoryToast}
                </div>
            )}
            
            {useMemo(() => (
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
            ), [])}

            {/* In-Story Connected Video Full Overlay Player */}
            {connectedVideoModal && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 250,
                    background: '#000',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    {/* Header */}
                    <div style={{
                        position: 'absolute',
                        top: '16px',
                        left: '16px',
                        right: '16px',
                        zIndex: 260,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '20px',
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.15)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Film size={18} color="#f5a524" />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '10px', color: '#f5a524', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Knock Knock Video
                                </span>
                                {connectedVideoModal.username && (
                                    <span style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>
                                        @{connectedVideoModal.username}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {connectedVideoModal.id && (
                                <button
                                    onClick={() => {
                                        onClose();
                                        navigate(`/reels?id=${connectedVideoModal.id}`);
                                    }}
                                    style={{
                                        background: 'linear-gradient(135deg, #f5a524, #ff6b35)',
                                        border: 'none',
                                        borderRadius: '14px',
                                        padding: '6px 12px',
                                        color: '#000',
                                        fontWeight: 800,
                                        fontSize: '11px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Open in Reels ↗
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setConnectedVideoModal(null);
                                    setIsPaused(false);
                                }}
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Video Player */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                        {connectedVideoModal.videoUrl ? (
                            <video
                                src={connectedVideoModal.videoUrl}
                                autoPlay
                                controls
                                playsInline
                                loop
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#f5a524' }}>
                                <Loader2 size={32} className="animate-spin" />
                                <span style={{ fontSize: '13px' }}>Loading connected video...</span>
                            </div>
                        )}
                    </div>

                    {/* Caption Bar */}
                    {connectedVideoModal.caption && (
                        <div style={{
                            position: 'absolute',
                            bottom: '24px',
                            left: '16px',
                            right: '16px',
                            background: 'rgba(0,0,0,0.7)',
                            backdropFilter: 'blur(10px)',
                            padding: '12px 16px',
                            borderRadius: '16px',
                            color: '#fff',
                            fontSize: '13px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            zIndex: 260
                        }}>
                            {connectedVideoModal.caption}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StoryViewer;
