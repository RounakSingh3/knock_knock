import React, { useRef, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Zap, X, Image as ImageIcon, Sparkles, Send, Flame, Trophy, TrendingUp, Clock, Eye, HelpCircle, Users } from 'lucide-react';
import { AppContext } from '../App';
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
} from '../lib/database';
import StoryViewer from '../components/StoryViewer';

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
        }
        setIsCameraActive(false);
        setHasCaptured(false);
        setCapturedImageUrl(null);
    };

    const captureImage = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.filter = FILTERS[activeFilterIndex].style || 'none';
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
            const imageUrl = await uploadStoryImage(capturedImageUrl, user.id);
            const { error } = await createStory(
                user.id,
                imageUrl,
                FILTERS[activeFilterIndex].name,
                boost,
                user.username || user.name
            );

            if (error) {
                alert(`Could not post story: ${error.message}`);
                return;
            }

            let pointsForStreak = points;
            if (boost) {
                const newPts = points - 10;
                pointsForStreak = newPts;
                setPoints(newPts);
                await updatePoints(user.id, newPts);
            }

            const streakResult = await updateStreak(
                user.id,
                streakCount,
                lastStoryAt,
                pointsForStreak
            );
            setStreakCount(streakResult.newStreak);
            setLastStoryAt(new Date().toISOString());
            setPoints((prev) => prev + streakResult.pointsAwarded);
            setStreakPointsEarned(streakResult.pointsAwarded);

            const [updatedBoosted, updatedMy, updatedClips] = await Promise.all([
                fetchBoostedStories(),
                fetchUserStories(user.id),
                fetchVideoPosts(),
            ]);
            setBoostedStories(updatedBoosted);
            setMyStories(updatedMy);
            setVideoClips(updatedClips);

            stopCamera();
            setTimeout(() => setStreakPointsEarned(null), 4000);
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
                    <canvas
                        ref={canvasRef}
                        className="camera-video"
                        style={{ display: hasCaptured ? 'block' : 'none' }}
                    />
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
                            <button className="icon-btn"><ImageIcon size={32} /></button>
                            <button className="shutter-btn" onClick={captureImage}></button>
                            <button className="icon-btn opacity-0"><ImageIcon size={32} /></button>
                        </>
                    ) : (
                        <div className="capture-actions">
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

                {/* Streak reward preview in camera */}
                {hasCaptured && (
                    <div className="camera-streak-hint">
                        <Flame size={14} />
                        <span>Post → earn <strong>+{nextStreakReward()} pts</strong> streak reward!</span>
                    </div>
                )}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,51,102,0.15)', padding: '4px 10px', borderRadius: '12px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff3366', animation: 'pulse 2s ease-in-out infinite' }} />
                        <span style={{ fontSize: '12px', color: '#ff3366', fontWeight: 'bold' }}>{recentStoriesCount} in last hour</span>
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

            {/* ── Camera CTA ── */}
            <div className="snap-cta-card" onClick={startCamera}>
                <div className="snap-cta-icon">
                    <Camera size={28} />
                </div>
                <div className="snap-cta-text">
                    <h3>Create a Snap</h3>
                    <p>Apply filters & earn <strong>+{nextStreakReward()} pts</strong></p>
                </div>
                <button className="snap-cta-btn">
                    <Sparkles size={16} /> Open
                </button>
            </div>

            {/* ── My Stories ── */}
            {myStories.length > 0 && (
                <div className="section-block">
                    <h3 className="section-title">My Stories</h3>
                    <div className="my-stories-row">
                        {myStories.slice(0, 10).map(story => (
                            <div key={story.id} className="my-story-card">
                                <img src={story.image_url} alt="" />
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
                            cursor: 'pointer', border: '2px solid rgba(255,153,51,0.4)',
                        }}
                        onClick={() => {
                            if (!isMysteryRevealed) {
                                setIsMysteryRevealed(true);
                            } else {
                                openStoryViewer(mysteryStory);
                            }
                        }}
                    >
                        <img
                            src={mysteryStory.image_url} alt="Mystery"
                            style={{
                                width: '100%', height: '100%', objectFit: 'cover',
                                filter: isMysteryRevealed ? 'none' : 'blur(20px) brightness(0.5)',
                                transition: 'filter 0.6s ease-out',
                            }}
                        />
                        {!isMysteryRevealed && (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center', gap: '8px',
                            }}>
                                <HelpCircle size={48} color="#ff9933" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
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
                                <img src={story.image_url} alt="Story" loading="lazy" />
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
        </div>
    );
};

export default Stories;
