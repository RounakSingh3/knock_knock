import React, { useRef, useState, useEffect, useContext } from 'react';
import { Camera, Zap, X, Image as ImageIcon, Sparkles, Send, Flame, Trophy, TrendingUp, Clock } from 'lucide-react';
import { AppContext } from '../App';
import {
    fetchBoostedStories,
    fetchUserStories,
    updatePoints,
    updateStreak,
    createStory,
    fetchProfile,
    type StoryData,
} from '../lib/database';

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

    // Streak states
    const [streakCount, setStreakCount] = useState(0);
    const [lastStoryAt, setLastStoryAt] = useState<string | null>(null);
    const [streakPointsEarned, setStreakPointsEarned] = useState<number | null>(null);

    const { points, setPoints, user } = useContext(AppContext);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Fetch data on mount
    useEffect(() => {
        fetchBoostedStories().then(stories => setBoostedStories(stories));
        if (user) {
            fetchUserStories(user.id).then(stories => setMyStories(stories));
            // Fetch fresh profile for streak data
            fetchProfile(user.id).then(profile => {
                if (profile) {
                    setStreakCount((profile as any).streak_count || 0);
                    setLastStoryAt((profile as any).last_story_at || null);
                }
            });
        }
    }, [user]);

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

    const postStory = async (boost: boolean) => {
        if (!user || !capturedImageUrl) return;

        if (boost) {
            if (points < 10) {
                alert(`You need 10 Boost Points to boost a story.\nYou currently have ${points} points.\nStay active or post stories to earn more!`);
                return;
            }
            setIsBoosting(true);
        } else {
            setIsPosting(true);
        }

        // Simulate a brief delay
        await new Promise(r => setTimeout(r, 1200));

        // Deduct boost points if boosting
        if (boost) {
            const newPts = points - 10;
            setPoints(newPts);
            await updatePoints(user.id, newPts);
        }

        // Create story
        await createStory(
            user.id,
            capturedImageUrl,
            FILTERS[activeFilterIndex].name,
            boost,
            (user as any).username || user.name
        );

        // Update streak
        const streakResult = await updateStreak(user.id, streakCount, lastStoryAt, boost ? points - 10 : points);
        setStreakCount(streakResult.newStreak);
        setLastStoryAt(new Date().toISOString());
        setPoints(prev => prev + streakResult.pointsAwarded);
        setStreakPointsEarned(streakResult.pointsAwarded);

        // Refresh data
        const updatedStories = await fetchBoostedStories();
        setBoostedStories(updatedStories);
        const updatedMyStories = await fetchUserStories(user.id);
        setMyStories(updatedMyStories);

        setIsBoosting(false);
        setIsPosting(false);
        stopCamera();

        // Show streak reward briefly
        setTimeout(() => setStreakPointsEarned(null), 4000);
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

            {/* ── Trending Boosted Stories ── */}
            <div className="section-block">
                <h3 className="section-title">Trending Boosted 🔥</h3>
                <div className="boosted-grid">
                    {boostedStories.length > 0 ? (
                        boostedStories.map(story => (
                            <div key={story.id} className="boosted-story">
                                <img src={story.image_url} alt="Story" loading="lazy" />
                                {story.username && (
                                    <div className="boosted-story-user">@{story.username}</div>
                                )}
                            </div>
                        ))
                    ) : (
                        [1, 2, 3, 4].map(i => (
                            <div key={i} className="boosted-story">
                                <img
                                    src={`https://images.unsplash.com/photo-${1500000000000 + i * 100000}?w=400&q=80`}
                                    alt="Story"
                                    loading="lazy"
                                />
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ── Trending Clips (kept from original) ── */}
            <div className="section-block">
                <h3 className="section-title">Trending Clips 🎬</h3>
                <div className="clips-grid">
                    {[
                        { src: 'https://videos.pexels.com/video-files/856029/856029-sd_640_360_30fps.mp4', poster: 'https://images.pexels.com/videos/856029/free-video-856029.jpg?auto=compress&w=300', creator: 'nature_vibes', views: '14.2K' },
                        { src: 'https://videos.pexels.com/video-files/3015510/3015510-sd_640_360_24fps.mp4', poster: 'https://images.pexels.com/videos/3015510/free-video-3015510.jpg?auto=compress&w=300', creator: 'city_explorer', views: '28.4K' },
                        { src: 'https://videos.pexels.com/video-files/1526909/1526909-sd_640_360_25fps.mp4', poster: 'https://images.pexels.com/videos/1526909/free-video-1526909.jpg?auto=compress&w=300', creator: 'ocean_dreams', views: '45.6K' },
                        { src: 'https://videos.pexels.com/video-files/4065924/4065924-sd_640_360_25fps.mp4', poster: 'https://images.pexels.com/videos/4065924/free-video-4065924.jpg?auto=compress&w=300', creator: 'dance_central', views: '89.2K' },
                        { src: 'https://videos.pexels.com/video-files/854669/854669-sd_640_360_30fps.mp4', poster: 'https://images.pexels.com/videos/854669/free-video-854669.jpg?auto=compress&w=300', creator: 'sky_watcher', views: '32.1K' },
                        { src: 'https://videos.pexels.com/video-files/2795173/2795173-sd_640_360_25fps.mp4', poster: 'https://images.pexels.com/videos/2795173/free-video-2795173.jpg?auto=compress&w=300', creator: 'foodie_fam', views: '67.3K' },
                    ].map((clip, i) => (
                        <div key={i} className="clip-card" onClick={() => window.location.href = '/reels'}>
                            <video
                                src={clip.src}
                                poster={clip.poster}
                                muted
                                loop
                                playsInline
                                preload="metadata"
                                onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => { })}
                                onMouseLeave={(e) => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0; }}
                            />
                            <div className="clip-overlay">
                                <span className="clip-views">▶ {clip.views}</span>
                                <span className="clip-creator">@{clip.creator}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Stories;
