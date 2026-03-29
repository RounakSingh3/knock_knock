import React, { useRef, useState, useEffect, useContext } from 'react';
import { Camera, Zap, X, Image as ImageIcon, Sparkles, Send } from 'lucide-react';
import { AppContext } from '../App';
import { fetchBoostedStories, updatePoints, createStory, type StoryData } from '../lib/database';

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
    const [boostedStories, setBoostedStories] = useState<StoryData[]>([]);
    const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);

    // Global context
    const { points, setPoints, user } = useContext(AppContext);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Fetch boosted stories from Supabase
    useEffect(() => {
        fetchBoostedStories().then(stories => setBoostedStories(stories));
    }, []);

    // Initialize camera
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

    const handleBoost = () => {
        if (!user) {
            alert('You need to be logged in to boost a story.');
            return;
        }

        if (!capturedImageUrl) {
            alert('Please capture a photo first before boosting.');
            return;
        }

        if (points < 10) {
            alert(`You need 10 Boost Points to boost a story.\nYou currently have ${points} points.\nStay active in the app for 1 hour to earn 10 points.`);
            return;
        }

        setIsBoosting(true);
        setTimeout(async () => {
            const newPoints = points - 10;
            setPoints(newPoints);

            // Persist points to database
            await updatePoints(user.id, newPoints);

            // Create boosted story owned by current user
            await createStory(
                user.id,
                capturedImageUrl,
                FILTERS[activeFilterIndex].name,
                true
            );

            // Refresh boosted stories feed (your story will be shown to more people)
            const updatedStories = await fetchBoostedStories();
            setBoostedStories(updatedStories);

            alert("Story Boosted Successfully!\nWe will silently show it to extra people using your 10 Boost Points.");
            setIsBoosting(false);
            stopCamera();
        }, 1500);
    };

    useEffect(() => {
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    if (isCameraActive) {
        return (
            <div className="camera-view">
                {/* Header Actions */}
                <div className="camera-header">
                    <button onClick={stopCamera} className="icon-btn"><X size={28} /></button>
                    {!hasCaptured && (
                        <button className="icon-btn text-yellow-400"><Sparkles size={24} /></button>
                    )}
                </div>

                {/* Video / Canvas Element */}
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

                {/* Filters Carousel */}
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

                {/* Bottom Actions */}
                <div className="camera-footer">
                    {!hasCaptured ? (
                        <>
                            <button className="icon-btn"><ImageIcon size={32} /></button>
                            <button className="shutter-btn" onClick={captureImage}></button>
                            <button className="icon-btn flex items-center justify-center opacity-0"><ImageIcon size={32} /></button>
                        </>
                    ) : (
                        <div className="capture-actions">
                            <button
                                className="boost-btn"
                                onClick={handleBoost}
                                disabled={isBoosting}
                            >
                                <Zap size={20} fill={isBoosting ? "currentColor" : "none"} />
                                {isBoosting ? "Boosting..." : "Boost Story"}
                            </button>
                            <button className="send-btn" onClick={() => { alert('Story posted!'); stopCamera(); }}>
                                <Send size={20} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="stories-page pb-20">
            <div className="p-4 text-center mt-6">
                <h2 className="title mb-2">Stories</h2>
                <div className="font-bold text-yellow-400 mb-1 flex align-center justify-center gap-2">
                    <Sparkles size={18} /> {points} Boost Points
                </div>
                <p className="text-xs text-gray-400 mb-5">
                    Every hour you use Knock Knock, you earn 10 Boost Points. Spend 10 points to quietly show your story to extra people.
                </p>
                <div className="create-story-card" onClick={startCamera}>
                    <div className="camera-icon-wrapper">
                        <Camera size={40} />
                    </div>
                    <h3>Create a premium story</h3>
                    <p>Add AR filters and boost to a larger audience</p>
                    <button className="premium-btn mt-4">Open Camera <Sparkles size={16} className="ml-2" /></button>
                </div>

                <div className="trending-stories mt-8">
                    <h3 className="text-left mb-4">Trending Boosted Stories 🔥</h3>
                    <div className="boosted-grid">
                        {boostedStories.length > 0 ? (
                            boostedStories.map(story => (
                                <div key={story.id} className="boosted-story">
                                    <img src={story.image_url} alt="Story" loading="lazy" />
                                </div>
                            ))
                        ) : (
                            // Fallback placeholder stories
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

                {/* Trending Short Clips */}
                <div className="trending-stories mt-8">
                    <h3 className="text-left mb-4">Trending Clips 🎬</h3>
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
        </div>
    );
};

export default Stories;
