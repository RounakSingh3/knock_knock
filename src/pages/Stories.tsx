import React, { useRef, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Zap, X, Image as ImageIcon, Sparkles, Send, Flame, Trophy, TrendingUp, Clock, Eye, HelpCircle, Users, Music } from 'lucide-react';
import { MusicPickerModal, type Track } from '../components/MusicPickerModal';
import { AppContext } from '../context/AppContext';
import {
    fetchBoostedStories,
    fetchUserStories,
    fetchVideoPosts,
    updatePoints,
    updateStreak,
    createStory,
    uploadStoryImage,
    fetchProfile,
    fetchRecentStoriesCount,
    fetchTopStreakUsers,
    type StoryData,
    type UserStoryGroup,
    type PostData,
    type ProfileData,
    uploadMedia
} from '../lib/database';
import StoryViewer from '../components/StoryViewer';
import { isVideoUrl, compressImage } from '../lib/media';

function groupStoriesByUser(stories: StoryData[]): UserStoryGroup[] {
    const groups: Record<string, UserStoryGroup> = {};
    stories.forEach((s) => {
        const uid = s.user_id || 'unknown';
        if (!groups[uid]) {
            groups[uid] = {
                userId: uid,
                username: s.username || 'user',
                avatarUrl: `https://i.pravatar.cc/150?u=${s.username || uid}`,
                stories: [],
            };
        }
        groups[uid].stories.push(s);
    });
    return Object.values(groups);
}

const FILTERS = [
    { name: 'Normal', style: '' },
    { name: 'Vintage', style: 'sepia(0.5) contrast(1.2)' },
    { name: 'B&W', style: 'grayscale(1) contrast(1.1)' },
    { name: 'Neon', style: 'hue-rotate(90deg) saturate(2)' },
    { name: 'Cinematic', style: 'contrast(1.2) saturate(1.1) brightness(0.9) blur(0.5px)' },
    { name: 'Cool', style: 'hue-rotate(-30deg) saturate(1.2)' },
    { name: 'Warm', style: 'sepia(0.3) saturate(1.4)' },
    { name: 'Alien', style: 'invert(0.8) hue-rotate(180deg)' },
];

const Stories = () => {
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [activeFilterIndex, setActiveFilterIndex] = useState(0);
    const [hasCaptured, setHasCaptured] = useState(false);
    const [isBoosting, setIsBoosting] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [boostedStories, setBoostedStories] = useState<StoryData[]>([]);
    const [myStories, setMyStories] = useState<StoryData[]>([]);
    const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
    const [galleryFile, setGalleryFile] = useState<File | null>(null);
    const [isGalleryVideo, setIsGalleryVideo] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
    const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [storyCaption, setStoryCaption] = useState('');
    const [videoClips, setVideoClips] = useState<PostData[]>([]);
    const [activeStoryGroupIndex, setActiveStoryGroupIndex] = useState<number | null>(null);
    const [viewerStoryGroups, setViewerStoryGroups] = useState<UserStoryGroup[]>([]);

    // FOMO states
    const [recentStoriesCount, setRecentStoriesCount] = useState(0);
    const [topStreakUsers, setTopStreakUsers] = useState<ProfileData[]>([]);
    const [mysteryStory, setMysteryStory] = useState<StoryData | null>(null);
    const [isMysteryRevealed, setIsMysteryRevealed] = useState(false);

    // Infinite scroll for boosted stories
    const [visibleBoostedCount, setVisibleBoostedCount] = useState(6);
    const boostedSentinelRef = useRef<HTMLDivElement>(null);

    const navigate = useNavigate();

    // Streak states
    const [streakCount, setStreakCount] = useState(0);
    const [lastStoryAt, setLastStoryAt] = useState<string | null>(null);
    const [streakPointsEarned, setStreakPointsEarned] = useState<number | null>(null);

    const { points, setPoints, user, blockedIds } = useContext(AppContext);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Fetch data on mount
    useEffect(() => {
        fetchBoostedStories().then((stories) => {
            const validStories = stories.filter(s => !s.user_id || !blockedIds.includes(s.user_id));
            setBoostedStories(validStories);
            // Pick a random mystery story
            if (validStories.length > 2) {
                const randomIdx = Math.floor(Math.random() * validStories.length);
                setMysteryStory(validStories[randomIdx]);
            }
        });
        fetchVideoPosts().then((posts) => setVideoClips(posts));
        fetchRecentStoriesCount().then(setRecentStoriesCount);
        fetchTopStreakUsers(3).then(setTopStreakUsers);
        if (user) {
            fetchUserStories(user.id).then((stories) => setMyStories(stories));
            fetchProfile(user.id).then((profile) => {
                if (profile) {
                    setStreakCount(profile.streak_count || 0);
                    setLastStoryAt(profile.last_story_at || null);
                }
            });
        }
    }, [user, blockedIds]);

    // Infinite scroll observer for boosted stories
    useEffect(() => {
        if (!boostedSentinelRef.current) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleBoostedCount < boostedStories.length) {
                    setVisibleBoostedCount(prev => Math.min(prev + 6, boostedStories.length));
                }
            },
            { rootMargin: '200px' }
        );
        observer.observe(boostedSentinelRef.current);
        return () => observer.disconnect();
    }, [visibleBoostedCount, boostedStories.length]);

    // How long streak is alive
    const isStreakAlive = () => {
        if (!lastStoryAt) return false;
        const hoursSince = (Date.now() - new Date(lastStoryAt).getTime()) / (1000 * 60 * 60);
        return hoursSince <= 24;
    };

    const streakTimeLeft = () => {
        if (!lastStoryAt) return null;
        const msLeft = new Date(lastStoryAt).getTime() + 24 * 60 * 60 * 1000 - Date.now();
        if (msLeft <= 0) return null;
        const hours = Math.floor(msLeft / (1000 * 60 * 60));
        const mins = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${mins}m`;
    };

    const nextStreakReward = () => {
        const nextStreak = isStreakAlive() ? (streakCount + 1) : 1;
        return nextStreak * 5;
    };

    // Camera functions
    const startCamera = async () => {
        setIsCameraActive(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing camera: ", err);
            alert("Could not access camera for AR filters.");
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
        setHasCaptured(false);
        setCapturedImageUrl(null);
        setGalleryFile(null);
        setIsGalleryVideo(false);
        setSelectedTrack(null);
        setStoryCaption('');
    };

    const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const isVideo = file.type.startsWith('video/');
            setIsGalleryVideo(isVideo);
            setGalleryFile(file);
            setCapturedImageUrl(URL.createObjectURL(file));
            setHasCaptured(true);
        }
    };

    const captureImage = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setCapturedImageUrl(dataUrl);
                setHasCaptured(true);
                const stream = video.srcObject as MediaStream;
                if (stream) stream.getTracks().forEach(track => track.stop());
            }
        }
    };

    const openStoryViewer = (story: StoryData) => {
        const groups = groupStoriesByUser(boostedStories);
        const groupIdx = groups.findIndex((g) => g.stories.some((s) => s.id === story.id));
        if (groupIdx >= 0) {
            setViewerStoryGroups(groups);
            setActiveStoryGroupIndex(groupIdx);
        }
    };

    const postStory = async (boost: boolean) => {
        if (!user || !capturedImageUrl) return;

        if (boost && points < 10) {
            alert(`You need 10 Boost Points to boost a story.\nYou currently have ${points} points.\nStay active or post stories to earn more!`);
            return;
        }

        if (boost) setIsBoosting(true);
        else setIsPosting(true);

        try {
            // Step 1: Upload media (the slow part)
            let imageUrl = '';
            if (galleryFile) {
                let fileToUpload = galleryFile;
                if (galleryFile.type.startsWith('image/')) {
                    try {
                        fileToUpload = await compressImage(galleryFile, 1200, 1200, 0.75);
                    } catch (e) {
                        console.error('Compression failed, using original', e);
                    }
                }
                const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
                const path = `stories/${user.id}-${Date.now()}.${fileExt}`;
                imageUrl = await uploadMedia(fileToUpload, path);
            } else {
                imageUrl = await uploadStoryImage(capturedImageUrl, user.id);
            }

            // Step 2: Insert story record
            const { error } = await createStory(
                user.id,
                imageUrl,
                FILTERS[activeFilterIndex].name,
                boost,
                user.username || user.name,
                storyCaption.trim() || undefined,
                selectedTrack?.title,
                selectedTrack?.artist,
                selectedTrack?.url
            );

            if (error) {
                alert(`Could not post story: ${error.message}`);
                return;
            }

            // Step 3: Close camera immediately — user sees success right away
            stopCamera();

            // Step 4: Handle points/streak in the background (non-blocking)
            let pointsForStreak = points;
            if (boost) {
                const newPts = points - 10;
                pointsForStreak = newPts;
                setPoints(newPts);
                updatePoints(user.id, newPts).catch(() => {});
            }

            updateStreak(user.id, streakCount, lastStoryAt, pointsForStreak)
                .then(streakResult => {
                    setStreakCount(streakResult.newStreak);
                    setLastStoryAt(new Date().toISOString());
                    setPoints(prev => prev + streakResult.pointsAwarded);
                    setStreakPointsEarned(streakResult.pointsAwarded);
                    setTimeout(() => setStreakPointsEarned(null), 4000);
                })
                .catch(() => {});

            // Step 5: Refresh stories in background (only 2 fetches, not 3)
            Promise.all([
                fetchBoostedStories(),
                fetchUserStories(user.id),
            ]).then(([updatedBoosted, updatedMy]) => {
                setBoostedStories(updatedBoosted);
                setMyStories(updatedMy);
            }).catch(() => {});

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to post story.';
            alert(message);
        } finally {
            setIsBoosting(false);
            setIsPosting(false);
        }
    };

    useEffect(() => {
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Helper to format time ago
    const timeAgo = (dateStr: string) => {
        const diffMs = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        return `${Math.floor(hrs / 24)}d`;
    };

    // ── Camera View ──
    if (isCameraActive) {
        return (
            <div className="camera-view">
                <div className="camera-header">
                    <button onClick={stopCamera} className="icon-btn"><X size={28} /></button>
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMusicModalOpen(true); }}
                        className={`icon-btn ${selectedTrack ? 'text-yellow-400' : 'text-white'}`}
                        style={{
                            minWidth: '44px',
                            minHeight: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            touchAction: 'manipulation',
                            zIndex: 1000
                        }}
                        title="Add background music"
                    >
                        <Music size={26} />
                    </button>
                    {!hasCaptured && (
                        <button className="icon-btn text-yellow-400"><Sparkles size={24} /></button>
                    )}
                </div>

                <div className="video-container">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="camera-video feed"
                        style={{
                            display: hasCaptured ? 'none' : 'block',
                            filter: FILTERS[activeFilterIndex].style
                        }}
                    />
                    {hasCaptured && isGalleryVideo ? (
                        <video
                            src={capturedImageUrl || ''}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="camera-video"
                            style={{
                                display: 'block',
                                filter: FILTERS[activeFilterIndex].style
                            }}
                        />
                    ) : galleryFile ? (
                        <img
                            src={capturedImageUrl || ''}
                            alt="Preview"
                            className="camera-video"
                            style={{
                                display: hasCaptured ? 'block' : 'none',
                                filter: FILTERS[activeFilterIndex].style,
                                objectFit: 'contain'
                            }}
                        />
                    ) : (
                        <canvas
                            ref={canvasRef}
                            className="camera-video"
                            style={{ display: hasCaptured ? 'block' : 'none' }}
                        />
                    )}

                    {/* Selected Music Sticker Badge */}
                    {selectedTrack && (
                        <div style={{
                            position: 'absolute', top: '70px', left: '50%', transform: 'translateX(-50%)',
                            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(245,165,36,0.6)', borderRadius: '20px',
                            padding: '6px 14px', color: '#fff', fontSize: '13px', fontWeight: 'bold',
                            display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10,
                            boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
                        }}>
                            <Music size={14} color="#f5a524" />
                            <span>{selectedTrack.title} • {selectedTrack.artist}</span>
                            <button
                                onClick={() => setSelectedTrack(null)}
                                style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', marginLeft: '4px', display: 'flex' }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {!hasCaptured && (
                    <div className="filters-carousel">
                        {FILTERS.map((f, i) => (
                            <button
                                key={i}
                                className={`filter-btn ${activeFilterIndex === i ? 'active' : ''}`}
                                onClick={() => setActiveFilterIndex(i)}
                            >
                                <div className="filter-preview" style={{ filter: f.style }}></div>
                                <span>{f.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="camera-footer">
                    {!hasCaptured ? (
                        <>
                            <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="Upload photos/videos from gallery">
                                <ImageIcon size={32} />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,video/*"
                                onChange={handleGallerySelect}
                                style={{ display: 'none' }}
                            />
                            <button className="shutter-btn" onClick={captureImage}></button>
                            <button className="icon-btn opacity-0"><ImageIcon size={32} /></button>
                        </>
                    ) : (
                        <div className="capture-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMusicModalOpen(true); }}
                                style={{
                                    background: selectedTrack ? 'rgba(245, 165, 36, 0.25)' : 'rgba(255,255,255,0.15)',
                                    border: selectedTrack ? '1px solid #f5a524' : '1px solid rgba(255,255,255,0.3)',
                                    borderRadius: '30px',
                                    padding: '10px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    color: selectedTrack ? '#f5a524' : '#fff',
                                    fontWeight: 'bold',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    touchAction: 'manipulation'
                                }}
                            >
                                <Music size={18} color={selectedTrack ? "#f5a524" : "#fff"} />
                                <span>{selectedTrack ? selectedTrack.title : 'Add Music'}</span>
                            </button>
                            <button
                                className="boost-btn"
                                onClick={() => postStory(true)}
                                disabled={isBoosting || isPosting}
                            >
                                <Zap size={20} fill={isBoosting ? "currentColor" : "none"} />
                                {isBoosting ? "Boosting..." : `Boost (10 pts)`}
                            </button>
                            <button
                                className="send-btn"
                                onClick={() => postStory(false)}
                                disabled={isBoosting || isPosting}
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Caption Input (after capture) */}
                {hasCaptured && (
                    <div style={{ padding: '0 20px', marginBottom: '8px' }}>
                        <input
                            type="text"
                            value={storyCaption}
                            onChange={e => setStoryCaption(e.target.value)}
                            placeholder="Add a caption... #hashtag"
                            maxLength={100}
                            style={{
                                width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '24px', padding: '10px 16px', color: '#fff',
                                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                backdropFilter: 'blur(8px)',
                            }}
                        />
                    </div>
                )}

                {/* Streak reward preview in camera */}
                {hasCaptured && (
                    <div className="camera-streak-hint">
                        <Flame size={14} />
                        <span>Post → earn <strong>+{nextStreakReward()} pts</strong> streak reward!</span>
                    </div>
                )}

                {/* Music Picker Modal — MUST be inside camera view to render */}
                <MusicPickerModal
                    isOpen={isMusicModalOpen}
                    onClose={() => setIsMusicModalOpen(false)}
                    onSelectTrack={(track) => setSelectedTrack(track)}
                    selectedTrackId={selectedTrack?.id}
                />
            </div>
        );
    }

    // ── Main Stories Hub ──
    return (
        <div className="stories-hub pb-20">
            <header style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h1 className="font-bold text-2xl">Boost & Stories</h1>
                {/* 😰 FOMO — Recent stories counter */}
                {recentStoriesCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 165, 36,0.15)', padding: '4px 10px', borderRadius: '12px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f5a524', animation: 'pulse 2s ease-in-out infinite' }} />
                        <span style={{ fontSize: '12px', color: '#f5a524', fontWeight: 'bold' }}>{recentStoriesCount} in last hour</span>
                    </div>
                )}
            </header>

            {/* Streak Points Earned Toast */}
            {streakPointsEarned !== null && (
                <div className="streak-toast">
                    <Flame size={20} />
                    <span>+{streakPointsEarned} streak points earned! 🎉</span>
                </div>
            )}

            {/* ── Streak Dashboard ── */}
            <div className="streak-dashboard">
                <div className="streak-dashboard-bg"></div>
                <div className="streak-content">
                    <div className="streak-fire-wrapper">
                        <span className="streak-fire-emoji">🔥</span>
                        <span className="streak-counter">{streakCount}</span>
                    </div>
                    <h2 className="streak-title">
                        {streakCount > 0 && isStreakAlive()
                            ? `${streakCount} Day Streak!`
                            : 'Start Your Streak!'}
                    </h2>
                    <p className="streak-subtitle">
                        {streakCount > 0 && isStreakAlive()
                            ? `Post daily to keep it alive • Next reward: +${nextStreakReward()} pts`
                            : 'Post a snap daily to earn escalating points 🚀'}
                    </p>

                    {/* Streak Stats Row */}
                    <div className="streak-stats-row">
                        <div className="streak-stat">
                            <Trophy size={16} color="#facc15" />
                            <div>
                                <span className="streak-stat-value">{points}</span>
                                <span className="streak-stat-label">Points</span>
                            </div>
                        </div>
                        <div className="streak-stat-divider" />
                        <div className="streak-stat">
                            <TrendingUp size={16} color="#34C759" />
                            <div>
                                <span className="streak-stat-value">{nextStreakReward()}</span>
                                <span className="streak-stat-label">Next Reward</span>
                            </div>
                        </div>
                        <div className="streak-stat-divider" />
                        <div className="streak-stat">
                            <Clock size={16} color="#60a5fa" />
                            <div>
                                <span className="streak-stat-value">{isStreakAlive() ? streakTimeLeft() || '—' : '—'}</span>
                                <span className="streak-stat-label">Time Left</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Camera & Music CTAs ── */}
            <div style={{ display: 'flex', gap: '12px', padding: '0 16px', marginBottom: '16px' }}>
                <div className="snap-cta-card" style={{ flex: 1, margin: 0, padding: '14px' }} onClick={startCamera}>
                    <div className="snap-cta-icon" style={{ width: '40px', height: '40px' }}>
                        <Camera size={22} />
                    </div>
                    <div className="snap-cta-text">
                        <h3 style={{ fontSize: '15px' }}>Camera</h3>
                        <p style={{ fontSize: '11px' }}>Take a snap</p>
                    </div>
                </div>

                <div 
                    className="snap-cta-card" 
                    style={{ 
                        flex: 1, 
                        margin: 0, 
                        padding: '14px',
                        background: 'linear-gradient(135deg, rgba(245, 165, 36, 0.25), rgba(255, 107, 53, 0.25))', 
                        border: '1px solid rgba(245, 165, 36, 0.5)',
                        cursor: 'pointer'
                    }} 
                    onClick={() => {
                        startCamera();
                        setIsMusicModalOpen(true);
                    }}
                >
                    <div className="snap-cta-icon" style={{ width: '40px', height: '40px', background: '#f5a524', color: '#000' }}>
                        <Music size={22} color="#000" />
                    </div>
                    <div className="snap-cta-text">
                        <h3 style={{ fontSize: '15px', color: '#f5a524' }}>Add Music</h3>
                        <p style={{ fontSize: '11px' }}>Pick a song 🎵</p>
                    </div>
                </div>
            </div>

            {/* ── My Stories ── */}
            {myStories.length > 0 && (
                <div className="section-block">
                    <h3 className="section-title">My Stories</h3>
                    <div className="my-stories-row">
                        {myStories.slice(0, 10).map((story, idx) => (
                            <div 
                                key={story.id} 
                                className="my-story-card"
                                style={{ cursor: 'pointer' }}
                                onClick={() => openStoryViewer(story)}
                            >
                                {isVideoUrl(story.image_url) ? (
                                    <video src={`${story.image_url}#t=0.001`} preload="metadata" muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <img src={story.image_url} alt="" />
                                )}
                                <div className="my-story-overlay">
                                    {story.is_boosted && (
                                        <span className="my-story-boost-badge">
                                            <Zap size={10} /> Boosted
                                        </span>
                                    )}
                                    <span className="my-story-time">{timeAgo(story.created_at)}</span>
                                </div>
                                <span className="my-story-filter">{story.filter_name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 🏆 Streak Leaderboard — FOMO/Competition */}
            {topStreakUsers.length > 0 && (
                <div className="section-block">
                    <h3 className="section-title">🏆 Streak Leaders</h3>
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                        {topStreakUsers.map((u, i) => (
                            <div key={u.id} style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: 'var(--surface-color)', padding: '10px 14px', borderRadius: '14px',
                                flexShrink: 0, minWidth: '160px',
                                border: i === 0 ? '1px solid rgba(250,204,21,0.4)' : '1px solid var(--border-color)',
                            }}>
                                <span style={{ fontSize: '18px' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                                <img src={u.avatar_url || 'https://i.pravatar.cc/150'} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-active)' }}>{u.username || u.name}</div>
                                    <div style={{ fontSize: '11px', color: '#facc15', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <Flame size={10} /> {u.streak_count || 0} day streak
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 🎰 Mystery Story — Variable Reward */}
            {mysteryStory && (
                <div className="section-block">
                    <h3 className="section-title">🎰 Mystery Story</h3>
                    <div
                        style={{
                            position: 'relative', height: '200px', borderRadius: '16px', overflow: 'hidden',
                            cursor: 'pointer', border: '2px solid rgba(255, 107, 53,0.4)',
                        }}
                        onClick={() => {
                            if (!isMysteryRevealed) {
                                setIsMysteryRevealed(true);
                            } else {
                                openStoryViewer(mysteryStory);
                            }
                        }}
                    >
                        {isVideoUrl(mysteryStory.image_url) ? (
                            <video
                                src={`${mysteryStory.image_url}#t=0.001`}
                                preload="metadata" muted playsInline
                                style={{
                                    width: '100%', height: '100%', objectFit: 'cover',
                                    filter: isMysteryRevealed ? 'none' : 'blur(20px) brightness(0.5)',
                                    transition: 'filter 0.6s ease-out',
                                }}
                            />
                        ) : (
                            <img
                                src={mysteryStory.image_url} alt="Mystery"
                                style={{
                                    width: '100%', height: '100%', objectFit: 'cover',
                                    filter: isMysteryRevealed ? 'none' : 'blur(20px) brightness(0.5)',
                                    transition: 'filter 0.6s ease-out',
                                }}
                            />
                        )}
                        {!isMysteryRevealed && (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center', gap: '8px',
                            }}>
                                <HelpCircle size={48} color="#ff6b35" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                                <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px' }}>Tap to Reveal</span>
                                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>A surprise story picked for you</span>
                            </div>
                        )}
                        {isMysteryRevealed && mysteryStory.username && (
                            <div style={{
                                position: 'absolute', bottom: '12px', left: '12px',
                                background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '8px',
                                fontSize: '13px', color: '#fff', fontWeight: 'bold',
                            }}>
                                @{mysteryStory.username}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Trending Boosted Stories ── */}
            <div className="section-block">
                <h3 className="section-title">Trending Boosted 🔥</h3>
                <div className="boosted-grid">
                    {boostedStories.length > 0 ? (
                        boostedStories.slice(0, visibleBoostedCount).map((story) => (
                            <div
                                key={story.id}
                                className="boosted-story"
                                style={{ cursor: 'pointer' }}
                                onClick={() => openStoryViewer(story)}
                            >
                                {isVideoUrl(story.image_url) ? (
                                    <video src={`${story.image_url}#t=0.001`} preload="metadata" muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <img src={story.image_url} alt="Story" loading="lazy" />
                                )}
                                {story.username && (
                                    <div className="boosted-story-user">@{story.username}</div>
                                )}
                            </div>
                        ))
                    ) : (
                        <p style={{ color: 'var(--text-inactive)', gridColumn: '1 / -1', padding: '1rem 0', fontSize: '14px' }}>
                            No boosted stories yet — capture a snap above and tap Boost (10 pts).
                        </p>
                    )}
                </div>
                {/* Infinite scroll sentinel for boosted stories */}
                {visibleBoostedCount < boostedStories.length && (
                    <div ref={boostedSentinelRef} style={{ height: '1px' }} />
                )}
            </div>

            {videoClips.length > 0 && (
                <div className="section-block">
                    <h3 className="section-title">Community Videos 🎬</h3>
                    <div className="clips-grid">
                        {videoClips.slice(0, 6).map((clip) => (
                            <div
                                key={clip.id}
                                className="clip-card"
                                onClick={() => navigate('/reels')}
                                style={{ cursor: 'pointer' }}
                            >
                                <video
                                    src={clip.image_url}
                                    muted
                                    loop
                                    playsInline
                                    preload="metadata"
                                    onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                                    onMouseLeave={(e) => {
                                        const v = e.target as HTMLVideoElement;
                                        v.pause();
                                        v.currentTime = 0;
                                    }}
                                />
                                <div className="clip-overlay">
                                    <span className="clip-views">▶ {clip.likes_count || 0}</span>
                                    <span className="clip-creator">@{clip.username}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeStoryGroupIndex !== null && (
                <StoryViewer
                    storyGroups={viewerStoryGroups}
                    initialGroupIndex={activeStoryGroupIndex}
                    currentUserId={user?.id}
                    onClose={() => setActiveStoryGroupIndex(null)}
                    onGroupsUpdated={(groups) => {
                        setViewerStoryGroups(groups);
                        setBoostedStories(groups.flatMap((g) => g.stories).filter((s) => s.is_boosted));
                    }}
                />
            )}
            {/* Music Picker Modal */}
            <MusicPickerModal
                isOpen={isMusicModalOpen}
                onClose={() => setIsMusicModalOpen(false)}
                onSelectTrack={(track) => setSelectedTrack(track)}
                selectedTrackId={selectedTrack?.id}
            />
        </div>
    );
};

export default Stories;
