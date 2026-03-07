import React, { useRef, useState, useEffect, useContext } from 'react';
import { Camera, Zap, X, Image as ImageIcon, Sparkles, Send } from 'lucide-react';
import { AppContext } from '../App';
import { fetchBoostedStories, updatePoints, type StoryData } from '../lib/database';

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
                setHasCaptured(true);
                const stream = video.srcObject as MediaStream;
                if (stream) stream.getTracks().forEach(track => track.stop());
            }
        }
    };

    const handleBoost = () => {
        if (points < 10) {
            alert(`You need 10 Boost Points to boost a story! You currently have ${points} points. \nStay active in the app for 1 hour to earn 10 points.`);
            return;
        }

        setIsBoosting(true);
        setTimeout(() => {
            const newPoints = points - 10;
            setPoints(newPoints);

            // Persist points to database
            if (user) {
                updatePoints(user.id, newPoints);
            }

            alert("Story Boosted Successfully! It is now being shown to 5,000+ new users. -10 Points.");
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
                <div className="font-bold text-yellow-400 mb-6 flex align-center justify-center gap-2">
                    <Sparkles size={18} /> {points} Boost Points
                </div>
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
            </div>
        </div>
    );
};

export default Stories;
