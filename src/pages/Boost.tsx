import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Rocket, 
    PlusCircle, 
    Flame, 
    Clock, 
    Sparkles, 
    Camera, 
    Image as ImageIcon, 
    Music, 
    X, 
    Users, 
    Play, 
    Loader2, 
    AlertCircle, 
    ShieldCheck, 
    TrendingUp,
    RefreshCw,
    Video
} from 'lucide-react';
import PullToRefresh from '../components/PullToRefresh';
import { AppContext } from '../context/AppContext';
import { 
    fetch24HourBoostStories, 
    createBoostedStory, 
    recordScreenDelivery, 
    fetchConnectionUserIds, 
    updatePoints, 
    updateStreak, 
    uploadMedia, 
    uploadStoryImage, 
    type StoryData, 
    type UserStoryGroup 
} from '../lib/database';
import { isVideoUrl, isVideoFile, compressImage } from '../lib/media';
import StoryViewer from '../components/StoryViewer';
import { MusicPickerModal, type Track } from '../components/MusicPickerModal';

const FILTERS = [
    { name: 'Normal', style: '' },
    { name: 'Vintage', style: 'sepia(0.5) contrast(1.2)' },
    { name: 'B&W', style: 'grayscale(1) contrast(1.1)' },
    { name: 'Neon', style: 'hue-rotate(90deg) saturate(2)' },
    { name: 'Cinematic', style: 'contrast(1.2) saturate(1.1) brightness(0.9) blur(0.5px)' },
    { name: 'Cool', style: 'hue-rotate(-30deg) saturate(1.2)' },
    { name: 'Warm', style: 'sepia(0.3) saturate(1.4)' },
    { name: 'Alien', style: 'hue-rotate(180deg) invert(0.2)' },
];

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

function getTimeRemaining(createdAt: string): { text: string; hoursLeft: number; percentElapsed: number } {
    const created = new Date(createdAt).getTime();
    const expires = created + 24 * 60 * 60 * 1000;
    const now = Date.now();
    const msLeft = expires - now;
    
    if (msLeft <= 0) {
        return { text: 'Expired', hoursLeft: 0, percentElapsed: 100 };
    }
    
    const hours = Math.floor(msLeft / (1000 * 60 * 60));
    const mins = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
    const percentElapsed = Math.min(100, Math.max(0, ((24 * 60 * 60 * 1000 - msLeft) / (24 * 60 * 60 * 1000)) * 100));

    if (hours > 0) {
        return { text: `${hours}h ${mins}m left`, hoursLeft: hours, percentElapsed };
    }
    return { text: `${mins}m left`, hoursLeft: 0, percentElapsed };
}

const Boost: React.FC = () => {
    const { user, points, setPoints, blockedIds } = useContext(AppContext);
    const navigate = useNavigate();

    // Explore Feed State with Instant Cache Rehydration
    const [stories, setStories] = useState<StoryData[]>(() => {
        try {
            const cached = localStorage.getItem('knock_boost_stories_cache_v2');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {}
        return [];
    });
    const [isLoading, setIsLoading] = useState<boolean>(() => {
        try {
            const cached = localStorage.getItem('knock_boost_stories_cache_v2');
            return !cached || JSON.parse(cached).length === 0;
        } catch (e) {
            return true;
        }
    });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [filterTab, setFilterTab] = useState<'all' | 'boosted' | 'friends' | 'videos'>('all');
    const [userFriends, setUserFriends] = useState<string[]>([]);

    // Story Viewer State
    const [activeViewerGroupIndex, setActiveViewerGroupIndex] = useState<number | null>(null);
    const [viewerStoryGroups, setViewerStoryGroups] = useState<UserStoryGroup[]>([]);

    // Upload / Knock Creator Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [capturedMediaUrl, setCapturedMediaUrl] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isVideo, setIsVideo] = useState(false);
    const [activeFilterIndex, setActiveFilterIndex] = useState(0);
    const [caption, setCaption] = useState('');
    const [pointsToSpend, setPointsToSpend] = useState<number>(0); // 100% free by default (0 points needed to post)
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
    const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // 30-second camera video recording state
    const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');
    const [isRecordingVideo, setIsRecordingVideo] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const videoChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<any>(null);
    const recordingHardStopRef = useRef<any>(null);
    const cardRefs = useRef<Record<string, HTMLElement | null>>({});
    const trackedImpressionsRef = useRef<Set<string>>(new Set());

    // Load user's connections (friends)
    useEffect(() => {
        if (!user?.id) return;
        fetchConnectionUserIds(user.id).then(ids => {
            setUserFriends(ids);
        }).catch(() => {});
    }, [user?.id]);

    // Load 24-hour Boost Explore Feed
    const loadFeed = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) setIsRefreshing(true);
        else if (stories.length === 0) setIsLoading(true);

        try {
            const data = await fetch24HourBoostStories(user?.id);
            // Filter out blocked users
            const valid = data.filter(s => !s.user_id || !blockedIds.includes(s.user_id));
            setStories(valid);
            try {
                localStorage.setItem('knock_boost_stories_cache_v2', JSON.stringify(valid));
            } catch (_) {}
        } catch (e) {
            console.error('Error loading boost feed:', e);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [user?.id, blockedIds, stories.length]);

    useEffect(() => {
        loadFeed();
    }, [user?.id]);

    // Cleanup camera stream on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    // Screen impression delivery tracker (Deduplicated IntersectionObserver)
    useEffect(() => {
        if (!user || stories.length === 0) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const storyId = entry.target.getAttribute('data-story-id');
                    if (storyId && !trackedImpressionsRef.current.has(storyId)) {
                        trackedImpressionsRef.current.add(storyId);
                        recordScreenDelivery(storyId, user.id);
                    }
                }
            });
        }, { threshold: 0.25 });

        Object.values(cardRefs.current).forEach(el => {
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [user?.id, stories]);

    // Derived lists (memoized for optimal 60fps performance)
    const myActiveKnocks = useMemo(
        () => stories.filter(s => user && s.user_id === user.id),
        [stories, user?.id]
    );
    
    const filteredStories = useMemo(() => {
        return stories.filter(s => {
            if (filterTab === 'boosted') return s.is_boosted;
            if (filterTab === 'friends') return s.user_id && userFriends.includes(s.user_id);
            if (filterTab === 'videos') return isVideoUrl(s.image_url);
            return true;
        });
    }, [stories, filterTab, userFriends]);

    // Open Story Viewer (bulletproof fallback resolution)
    const handleOpenStory = (story: StoryData) => {
        if (user && story.id) {
            recordScreenDelivery(story.id, user.id);
        }

        let groups = groupStoriesByUser(filteredStories);
        let groupIdx = groups.findIndex(g => g.stories.some(s => s.id === story.id));
        if (groupIdx === -1) {
            groups = groupStoriesByUser(stories);
            groupIdx = groups.findIndex(g => g.stories.some(s => s.id === story.id));
        }
        if (groupIdx === -1) {
            const singleGroup: UserStoryGroup = {
                userId: story.user_id || 'unknown',
                username: story.username || 'You',
                avatarUrl: `https://i.pravatar.cc/150?u=${story.username || story.user_id}`,
                stories: [story],
            };
            groups = [singleGroup];
            groupIdx = 0;
        }

        setViewerStoryGroups(groups);
        setActiveViewerGroupIndex(groupIdx);
    };

    // Camera Controls & 30-Second Video Recording
    const startCamera = async (mode: 'photo' | 'video' = cameraMode) => {
        setIsCameraActive(true);
        setCapturedMediaUrl(null);
        setSelectedFile(null);
        setIsVideo(false);
        setIsRecordingVideo(false);
        setRecordingSeconds(0);
        try {
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'user' },
                    audio: mode === 'video'
                });
            } catch (mediaErr) {
                // Fallback to video only if microphone access is blocked
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'user' },
                    audio: false 
                });
            }
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Could not access camera. Please allow camera permissions or upload a file from your device.');
            setIsCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        if (recordingHardStopRef.current) clearTimeout(recordingHardStopRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            try { mediaRecorderRef.current.stop(); } catch (_) {}
        }
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
        setIsRecordingVideo(false);
        setRecordingSeconds(0);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth || 720;
            canvas.height = video.videoHeight || 1280;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                setCapturedMediaUrl(dataUrl);
                setIsVideo(false);
                stopCamera();
            }
        }
    };

    const startVideoRecording = () => {
        if (!videoRef.current || !videoRef.current.srcObject) return;
        const stream = videoRef.current.srcObject as MediaStream;

        let mimeType = 'video/webm';
        if (typeof MediaRecorder !== 'undefined') {
            if (MediaRecorder.isTypeSupported('video/mp4')) {
                mimeType = 'video/mp4';
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
                mimeType = 'video/webm;codecs=vp9,opus';
            } else if (MediaRecorder.isTypeSupported('video/webm')) {
                mimeType = 'video/webm';
            }
        }

        try {
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            mediaRecorderRef.current = recorder;
            videoChunksRef.current = [];
            setRecordingSeconds(0);

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    videoChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
                if (recordingHardStopRef.current) clearTimeout(recordingHardStopRef.current);
                const recordedBlob = new Blob(videoChunksRef.current, { type: mimeType });
                const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
                const file = new File([recordedBlob], `knock-boost-video-${Date.now()}.${ext}`, { type: mimeType });
                setSelectedFile(file);
                setIsVideo(true);
                setCapturedMediaUrl(URL.createObjectURL(recordedBlob));
                stopCamera();
            };

            recorder.start(100);
            setIsRecordingVideo(true);

            // Real-time counter up to 30 seconds
            const start = Date.now();
            recordingIntervalRef.current = setInterval(() => {
                const secs = Math.floor((Date.now() - start) / 1000);
                setRecordingSeconds(Math.min(30, secs));
                if (secs >= 30) {
                    stopVideoRecording();
                }
            }, 250);

            // Hard stop at 30 seconds
            recordingHardStopRef.current = setTimeout(() => {
                stopVideoRecording();
            }, 30000);

        } catch (err) {
            console.error('Failed to start video recording:', err);
            alert('Failed to start video recording. Your browser might not support recording.');
        }
    };

    const stopVideoRecording = () => {
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        if (recordingHardStopRef.current) clearTimeout(recordingHardStopRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsRecordingVideo(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const isVid = isVideoFile(file);

            if (isVid) {
                // Validate video duration: maximum 30 seconds
                const tempVideo = document.createElement('video');
                tempVideo.preload = 'metadata';
                const objectUrl = URL.createObjectURL(file);
                tempVideo.src = objectUrl;

                tempVideo.onloadedmetadata = () => {
                    URL.revokeObjectURL(objectUrl);
                    if (tempVideo.duration > 30.5) {
                        alert(`Video duration is ${Math.round(tempVideo.duration)}s. Videos on KnockUp screen must be 30 seconds or less. Please select or trim a shorter video.`);
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }
                        return;
                    }
                    setSelectedFile(file);
                    setIsVideo(true);
                    setCapturedMediaUrl(URL.createObjectURL(file));
                    stopCamera();
                };

                tempVideo.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    // If metadata fails to load, allow file
                    setSelectedFile(file);
                    setIsVideo(true);
                    setCapturedMediaUrl(URL.createObjectURL(file));
                    stopCamera();
                };
                return;
            }

            setSelectedFile(file);
            setIsVideo(false);
            setCapturedMediaUrl(URL.createObjectURL(file));
            stopCamera();
        }
    };

    const closeCreateModal = () => {
        stopCamera();
        setIsCreateModalOpen(false);
        if (capturedMediaUrl && capturedMediaUrl.startsWith('blob:')) {
            try { URL.revokeObjectURL(capturedMediaUrl); } catch (_) {}
        }
        setCapturedMediaUrl(null);
        setSelectedFile(null);
        setIsVideo(false);
        setCameraMode('photo');
        setIsRecordingVideo(false);
        setRecordingSeconds(0);
        setCaption('');
        setSelectedTrack(null);
        setUploadError(null);
        setActiveFilterIndex(0);
        setUploadProgress(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Guaranteed Reach Calculations (Safe for 0 points balance)
    const userPoints = typeof points === 'number' && !isNaN(points) ? Math.max(0, points) : 0;
    const baseFriendsCount = Math.max(userFriends.length, 1);
    const extraGuaranteedScreens = Math.max(pointsToSpend || 0, 0);
    const totalGuaranteedReach = baseFriendsCount + extraGuaranteedScreens;

    // Handle Knock Upload & Point Deduction
    const handleLaunchBoostKnock = async () => {
        if (!user) {
            alert('Please log in to post a 24h boosted knock.');
            return;
        }
        if (!capturedMediaUrl && !selectedFile) {
            setUploadError('Please take a photo or select media to upload.');
            return;
        }

        const safePointsToSpend = Math.max(0, Math.min(pointsToSpend || 0, userPoints));

        setIsSubmitting(true);
        setUploadError(null);
        setUploadProgress(0);

        try {
            // Step 1: Upload media
            let uploadedUrl = '';
            if (selectedFile) {
                let fileToUpload = selectedFile;
                const isVid = isVideoFile(selectedFile);

                if (!isVid && (selectedFile.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(selectedFile.name))) {
                    try {
                        fileToUpload = await compressImage(selectedFile, 1280, 1280, 0.8);
                    } catch (e) {
                        console.warn('Compression skipped:', e);
                    }
                } else if (isVid) {
                    if (selectedFile.size > 50 * 1024 * 1024) {
                        throw new Error('Video size exceeds 50MB limit. Please select a shorter video clip.');
                    }
                }

                const rawExt = fileToUpload.name.split('.').pop() || (isVid ? 'mp4' : 'jpg');
                const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || (isVid ? 'mp4' : 'jpg');
                const path = `stories/${user.id}-${Date.now()}.${ext}`;
                uploadedUrl = await uploadMedia(fileToUpload, path, (progress) => {
                    if (progress.total > 0) {
                        const pct = Math.round((progress.loaded / progress.total) * 100);
                        setUploadProgress(pct);
                    }
                });
            } else if (capturedMediaUrl) {
                uploadedUrl = await uploadStoryImage(capturedMediaUrl, user.id);
            }

            if (!uploadedUrl) {
                throw new Error('Failed to upload media. Please try again.');
            }

            // Step 2: Create 24-hour boosted story with reach guarantee metadata
            const filterName = FILTERS[activeFilterIndex].name;
            const { error: storyError } = await createBoostedStory(
                user.id,
                uploadedUrl,
                filterName,
                safePointsToSpend,
                baseFriendsCount,
                user.username || user.name,
                caption.trim() || undefined,
                selectedTrack?.title,
                selectedTrack?.artist,
                selectedTrack?.url
            );

            if (storyError) {
                throw storyError;
            }

            // Step 3: Deduct boost points if user used any
            if (safePointsToSpend > 0) {
                const newPoints = Math.max(0, userPoints - safePointsToSpend);
                setPoints(newPoints);
                updatePoints(user.id, newPoints).catch(() => {});
            }

            // Step 4: Award streak points for posting a 24h knock
            updateStreak(user.id, 1, null, userPoints - safePointsToSpend).catch(() => {});

            // Close modal and reload 24h feed
            closeCreateModal();
            await loadFeed();
        } catch (err: any) {
            console.error('Failed to post 24h boost knock:', err);
            setUploadError(err.message || 'Failed to post knock. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{ background: 'var(--bg-color)', minHeight: '100vh', paddingBottom: '90px', color: 'var(--text-active)' }}>
            
            {/* ── Top Header ── */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 30,
                background: 'rgba(18, 18, 18, 0.85)',
                backdropFilter: 'blur(16px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                padding: '14px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, #f5a524, #ff6b35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(245, 165, 36, 0.35)'
                    }}>
                        <Rocket size={20} color="#000" />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', letterSpacing: '-0.3px' }}>KnockUp Screen</h1>
                            <span style={{
                                fontSize: '10px', fontWeight: '800', color: '#ff6b35',
                                background: 'rgba(255,107,53,0.15)', padding: '2px 6px',
                                borderRadius: '6px', border: '1px solid rgba(255,107,53,0.3)',
                                textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}>
                                24H
                            </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-inactive)' }}>
                            Guaranteed Screen Reach • 24h Ephemeral
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Points Pill */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        background: 'rgba(245,165,36,0.12)', border: '1px solid rgba(245,165,36,0.35)',
                        padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', color: '#f5a524'
                    }}>
                        <Flame size={14} color="#f5a524" />
                        <span>{points} pts</span>
                    </div>

                    {/* Post Knock Action */}
                    <button
                        onClick={() => {
                            setPointsToSpend(0);
                            setIsCreateModalOpen(true);
                        }}
                        style={{
                            background: 'linear-gradient(135deg, #f5a524, #ff6b35)',
                            border: 'none', borderRadius: '20px', padding: '8px 14px',
                            color: '#000', fontSize: '12px', fontWeight: '800',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            cursor: 'pointer', boxShadow: '0 4px 14px rgba(245, 165, 36, 0.4)',
                            transition: 'transform 0.15s ease'
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <PlusCircle size={15} color="#000" />
                        <span>Post Knock</span>
                    </button>
                </div>
            </div>

            {/* ── Main Content Area with Native Pull-To-Refresh ── */}
            <PullToRefresh onRefresh={() => loadFeed(true)}>
                {/* ── Creator's Active 24h Knocks & Reach Guarantee Dashboard ── */}
                {myActiveKnocks.length > 0 && (
                    <div style={{ padding: '16px', background: 'linear-gradient(180deg, rgba(245, 165, 36, 0.08) 0%, transparent 100%)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <TrendingUp size={16} color="#f5a524" />
                                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    My Active Knocks & Delivery Guarantee
                                </h2>
                            </div>
                            <button 
                                onClick={() => loadFeed(true)} 
                                style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                            >
                                <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                                Refresh
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '6px', WebkitOverflowScrolling: 'touch' }}>
                            {myActiveKnocks.map((knock) => {
                                const timeInfo = getTimeRemaining(knock.created_at);
                                const target = knock.target_screens || 24;
                                const delivered = knock.screens_delivered || 0;
                                const pct = Math.min(100, Math.round((delivered / target) * 100));
                                const friends = knock.boost_meta?.friendsCount || baseFriendsCount;
                                const boosted = knock.boost_meta?.pointsSpent || 0;

                                return (
                                    <div
                                        key={knock.id}
                                        onClick={() => handleOpenStory(knock)}
                                        style={{
                                            minWidth: '260px', maxWidth: '280px',
                                            background: 'var(--surface-color)',
                                            border: '1px solid rgba(245, 165, 36, 0.35)',
                                            borderRadius: '16px',
                                            padding: '12px',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                                            flexShrink: 0,
                                            display: 'flex',
                                            gap: '12px',
                                            position: 'relative',
                                            transition: 'transform 0.15s ease'
                                        }}
                                    >
                                        {/* Thumbnail */}
                                        <div style={{ width: '64px', height: '90px', borderRadius: '10px', overflow: 'hidden', background: '#121212', position: 'relative', flexShrink: 0 }}>
                                            {isVideoUrl(knock.image_url) ? (
                                                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                                    <video 
                                                        src={`${knock.image_url.split('#')[0]}#t=0.001`}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        muted playsInline preload="metadata"
                                                    />
                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                                        <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Play size={11} fill="#fff" color="#fff" style={{ marginLeft: '1px' }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <img 
                                                    src={knock.image_url.split('#')[0]} 
                                                    alt="" 
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            )}
                                            <div style={{
                                                position: 'absolute', bottom: '4px', left: '4px',
                                                background: 'rgba(0,0,0,0.7)', borderRadius: '4px',
                                                padding: '1px 4px', fontSize: '9px', color: '#fff', fontWeight: 'bold'
                                            }}>
                                                24h
                                            </div>
                                            {isVideoUrl(knock.image_url) && (
                                                <div style={{
                                                    position: 'absolute', bottom: '4px', right: '4px',
                                                    background: 'rgba(239, 68, 68, 0.8)', borderRadius: '4px',
                                                    padding: '1px 4px', fontSize: '8px', color: '#fff', fontWeight: 'bold',
                                                    display: 'flex', alignItems: 'center', gap: '2px'
                                                }}>
                                                    30s
                                                </div>
                                            )}
                                        </div>

                                        {/* Reach Guarantee Details */}
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '11px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '600' }}>
                                                        <Clock size={11} /> {timeInfo.text}
                                                    </span>
                                                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#f5a524' }}>
                                                        {pct}%
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-active)', marginBottom: '4px' }}>
                                                    Delivered to {delivered} / {target} Screens
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div>
                                                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
                                                    <div style={{
                                                        width: `${pct}%`, height: '100%',
                                                        background: 'linear-gradient(90deg, #f5a524, #ff6b35)',
                                                        borderRadius: '4px',
                                                        transition: 'width 0.4s ease'
                                                    }} />
                                                </div>
                                                <div style={{ fontSize: '10px', color: 'var(--text-inactive)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span>👥 {friends} Friends</span>
                                                    <span>⚡ +{boosted} Boosted</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Exploration Filter Tabs ── */}
                <div style={{
                    display: 'flex', gap: '8px', padding: '12px 16px',
                    overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    WebkitOverflowScrolling: 'touch'
                }}>
                    {[
                        { id: 'all', label: 'All Knocks', icon: Sparkles },
                        { id: 'boosted', label: 'Boosted 🔥', icon: Flame },
                        { id: 'friends', label: 'Friends 👥', icon: Users },
                        { id: 'videos', label: 'Videos 🎬', icon: Play },
                    ].map(tab => {
                        const active = filterTab === tab.id;
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setFilterTab(tab.id as any)}
                                style={{
                                    background: active ? 'linear-gradient(135deg, rgba(245,165,36,0.2), rgba(255,107,53,0.2))' : 'var(--surface-color)',
                                    border: active ? '1px solid #f5a524' : '1px solid rgba(255,255,255,0.08)',
                                    color: active ? '#f5a524' : 'var(--text-inactive)',
                                    padding: '6px 14px', borderRadius: '20px',
                                    fontSize: '12px', fontWeight: active ? '700' : '500',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    cursor: 'pointer', whiteSpace: 'nowrap',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <Icon size={13} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* ── 24-Hour Ephemeral Discovery Feed (Grid) ── */}
                <div style={{ padding: '16px' }}>
                    {isLoading && stories.length === 0 ? (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                            gap: '12px'
                        }}>
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div
                                    key={i}
                                    style={{
                                        aspectRatio: '9 / 16',
                                        borderRadius: '16px',
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        opacity: 0.7
                                    }}
                                >
                                    <Rocket size={24} color="rgba(245, 165, 36, 0.4)" />
                                </div>
                            ))}
                        </div>
                    ) : filteredStories.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: '64px 20px',
                            background: 'var(--surface-color)', borderRadius: '20px',
                            border: '1px dashed rgba(255,255,255,0.15)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px'
                        }}>
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '50%',
                                background: 'rgba(245,165,36,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Rocket size={28} color="#f5a524" />
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700' }}>No active 24h knocks in this filter</h3>
                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-inactive)', maxWidth: '280px' }}>
                                    Be the first to post a 24-hour knock! Spend boost points to guarantee screen reach across the app.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setPointsToSpend(0);
                                    setIsCreateModalOpen(true);
                                }}
                                style={{
                                    background: 'linear-gradient(135deg, #f5a524, #ff6b35)',
                                    border: 'none', borderRadius: '24px', padding: '10px 20px',
                                    color: '#000', fontSize: '13px', fontWeight: '800',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                <PlusCircle size={16} /> Post 24h Boost Knock
                            </button>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                            gap: '12px'
                        }}>
                            {filteredStories.map((story) => {
                                const timeInfo = getTimeRemaining(story.created_at);
                                const isUserOwn = user && story.user_id === user.id;
                                const targetScreens = story.target_screens || 24;
                                const deliveredScreens = story.screens_delivered || 0;
                                const isBoosted = story.is_boosted;

                                return (
                                    <div
                                        key={story.id}
                                        ref={el => { cardRefs.current[story.id] = el; }}
                                        data-story-id={story.id}
                                        onClick={() => handleOpenStory(story)}
                                        style={{
                                            aspectRatio: '9 / 16',
                                            borderRadius: '16px',
                                            overflow: 'hidden',
                                            position: 'relative',
                                            background: '#181818',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                                            border: isBoosted ? '1.5px solid rgba(245, 165, 36, 0.45)' : '1px solid rgba(255,255,255,0.06)',
                                            transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.transform = 'translateY(-3px)';
                                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(245, 165, 36, 0.25)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.35)';
                                        }}
                                    >
                                        {/* Media */}
                                        {isVideoUrl(story.image_url) ? (
                                            <div style={{ width: '100%', height: '100%', position: 'relative', background: '#111' }}>
                                                <video
                                                    src={`${story.image_url.split('#')[0]}#t=0.001`}
                                                    muted
                                                    playsInline
                                                    preload="metadata"
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                                <div style={{
                                                    position: 'absolute', inset: 0,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    pointerEvents: 'none'
                                                }}>
                                                    <div style={{
                                                        background: 'rgba(0,0,0,0.45)',
                                                        backdropFilter: 'blur(4px)',
                                                        borderRadius: '50%',
                                                        width: '32px', height: '32px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                                                    }}>
                                                        <Play size={15} fill="#fff" color="#fff" style={{ marginLeft: '2px' }} />
                                                    </div>
                                                </div>
                                                <div style={{
                                                    position: 'absolute', bottom: '8px', right: '8px',
                                                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                                                    padding: '2px 6px', borderRadius: '6px',
                                                    fontSize: '9px', fontWeight: 'bold', color: '#fff',
                                                    display: 'flex', alignItems: 'center', gap: '3px'
                                                }}>
                                                    <Play size={8} fill="#fff" /> 30s
                                                </div>
                                            </div>
                                        ) : (
                                            <img
                                                src={story.image_url.split('#')[0]}
                                                alt=""
                                                loading="lazy"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        )}

                                        {/* Top Overlay Badges */}
                                        <div style={{
                                            position: 'absolute', top: '8px', left: '8px', right: '8px',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            zIndex: 5
                                        }}>
                                            {/* 24h Countdown Badge */}
                                            <div style={{
                                                background: 'rgba(0,0,0,0.7)',
                                                backdropFilter: 'blur(8px)',
                                                borderRadius: '12px',
                                                padding: '3px 8px',
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                fontSize: '10px', fontWeight: '700',
                                                color: '#60a5fa',
                                                border: '1px solid rgba(96,165,250,0.3)'
                                            }}>
                                                <Clock size={10} />
                                                <span>{timeInfo.text}</span>
                                            </div>

                                            {/* Boost Screen Guarantee Badge */}
                                            {isBoosted && (
                                                <div style={{
                                                    background: 'linear-gradient(135deg, rgba(245,165,36,0.9), rgba(255,107,53,0.9))',
                                                    borderRadius: '12px',
                                                    padding: '3px 7px',
                                                    display: 'flex', alignItems: 'center', gap: '3px',
                                                    fontSize: '10px', fontWeight: '800',
                                                    color: '#000',
                                                    boxShadow: '0 2px 8px rgba(245, 165, 36, 0.4)'
                                                }}>
                                                    <Flame size={10} />
                                                    <span>+{story.points_spent || 10}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Bottom Gradient Overlay & Details */}
                                        <div style={{
                                            position: 'absolute', bottom: 0, left: 0, right: 0,
                                            background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.95) 100%)',
                                            padding: '24px 10px 10px 10px',
                                            zIndex: 5,
                                            display: 'flex', flexDirection: 'column', gap: '6px'
                                        }}>
                                            {/* Creator info */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <img
                                                    src={`https://i.pravatar.cc/150?u=${story.username || story.user_id}`}
                                                    alt=""
                                                    style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #fff' }}
                                                />
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {isUserOwn ? 'You' : `@${story.username || 'user'}`}
                                                </span>
                                            </div>

                                            {/* Caption snippet */}
                                            {story.caption && (
                                                <p style={{
                                                    margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.85)',
                                                    display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden', textOverflow: 'ellipsis'
                                                }}>
                                                    {story.caption}
                                                </p>
                                            )}

                                            {/* Music Badge */}
                                            {story.music_title && (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    fontSize: '10px', color: '#f5a524',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                }}>
                                                    <Music size={10} />
                                                    <span>{story.music_title}</span>
                                                </div>
                                            )}

                                            {/* Reach Delivery Indicator */}
                                            {isBoosted && (
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#ffcc00', fontWeight: '700', marginBottom: '2px' }}>
                                                        <span>{deliveredScreens} / {targetScreens} screens</span>
                                                        <span>{Math.round((deliveredScreens / targetScreens) * 100)}%</span>
                                                    </div>
                                                    <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: `${Math.min(100, Math.round((deliveredScreens / targetScreens) * 100))}%`,
                                                            height: '100%',
                                                            background: 'linear-gradient(90deg, #f5a524, #ff6b35)'
                                                        }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </PullToRefresh>

            {/* ── Direct 24h Knock Creator Modal ── */}
            {isCreateModalOpen && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '16px'
                }}>
                    <div style={{
                        background: 'var(--surface-color)',
                        width: '100%', maxWidth: '440px', maxHeight: '92vh',
                        borderRadius: '24px', overflowY: 'auto',
                        border: '1px solid rgba(255,255,255,0.12)',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                        display: 'flex', flexDirection: 'column'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            borderBottom: '1px solid rgba(255,255,255,0.08)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Rocket size={20} color="#f5a524" />
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>KnockUp a 24h Screen</h3>
                                    <span style={{ fontSize: '11px', color: 'var(--text-inactive)' }}>Disappears in 24 hours</span>
                                </div>
                            </div>
                            <button onClick={closeCreateModal} style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', cursor: 'pointer' }}>
                                <X size={22} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                            {/* Viewfinder / Media Preview */}
                            <div style={{
                                width: '100%', aspectRatio: '9 / 12', borderRadius: '16px',
                                overflow: 'hidden', background: '#0a0a0a', position: 'relative',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                {isCameraActive ? (
                                    <>
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            style={{
                                                width: '100%', height: '100%', objectFit: 'cover',
                                                filter: FILTERS[activeFilterIndex].style
                                            }}
                                        />

                                        {/* Camera Close Button */}
                                        <button
                                            type="button"
                                            onClick={stopCamera}
                                            style={{
                                                position: 'absolute', top: '10px', right: '10px',
                                                background: 'rgba(0,0,0,0.65)', border: 'none',
                                                borderRadius: '50%', width: '32px', height: '32px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: '#fff', cursor: 'pointer', zIndex: 14
                                            }}
                                        >
                                            <X size={18} />
                                        </button>

                                        {/* Camera Mode Switcher: Photo vs Video (30s) */}
                                        <div style={{
                                            position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
                                            display: 'flex', background: 'rgba(0,0,0,0.7)', borderRadius: '20px', padding: '3px',
                                            backdropFilter: 'blur(8px)', zIndex: 14, border: '1px solid rgba(255,255,255,0.15)'
                                        }}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (isRecordingVideo) return;
                                                    setCameraMode('photo');
                                                    startCamera('photo');
                                                }}
                                                style={{
                                                    padding: '4px 12px', borderRadius: '16px', border: 'none',
                                                    background: cameraMode === 'photo' ? '#f5a524' : 'transparent',
                                                    color: cameraMode === 'photo' ? '#000' : 'rgba(255,255,255,0.7)',
                                                    fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s ease'
                                                }}
                                            >
                                                Photo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (isRecordingVideo) return;
                                                    setCameraMode('video');
                                                    startCamera('video');
                                                }}
                                                style={{
                                                    padding: '4px 12px', borderRadius: '16px', border: 'none',
                                                    background: cameraMode === 'video' ? '#ef4444' : 'transparent',
                                                    color: '#fff',
                                                    fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s ease'
                                                }}
                                            >
                                                Video (30s)
                                            </button>
                                        </div>

                                        {/* 30s Recording Timer Badge */}
                                        {cameraMode === 'video' && (
                                            <div style={{
                                                position: 'absolute', top: '48px', left: '50%', transform: 'translateX(-50%)',
                                                background: isRecordingVideo ? 'rgba(239, 68, 68, 0.95)' : 'rgba(0,0,0,0.75)',
                                                borderRadius: '12px', padding: '3px 12px', display: 'flex', alignItems: 'center',
                                                gap: '6px', fontSize: '11px', fontWeight: 'bold', color: '#fff',
                                                zIndex: 14, backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)',
                                                boxShadow: isRecordingVideo ? '0 0 12px rgba(239, 68, 68, 0.6)' : 'none'
                                            }}>
                                                {isRecordingVideo && (
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />
                                                )}
                                                <span>{`0:${recordingSeconds.toString().padStart(2, '0')} / 0:30`}</span>
                                            </div>
                                        )}

                                        {/* Shutter / Record Button */}
                                        {cameraMode === 'photo' ? (
                                            <button
                                                type="button"
                                                onClick={capturePhoto}
                                                style={{
                                                    position: 'absolute', bottom: '16px',
                                                    width: '64px', height: '64px', borderRadius: '50%',
                                                    background: '#fff', border: '4px solid #f5a524',
                                                    cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                                                    zIndex: 14
                                                }}
                                            />
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={isRecordingVideo ? stopVideoRecording : startVideoRecording}
                                                style={{
                                                    position: 'absolute', bottom: '16px',
                                                    width: '66px', height: '66px', borderRadius: '50%',
                                                    background: 'rgba(239, 68, 68, 0.2)',
                                                    border: '4px solid #ef4444',
                                                    cursor: 'pointer', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.5)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    zIndex: 14
                                                }}
                                            >
                                                {isRecordingVideo ? (
                                                    <div style={{ width: '22px', height: '22px', background: '#ef4444', borderRadius: '4px' }} />
                                                ) : (
                                                    <div style={{ width: '46px', height: '46px', background: '#ef4444', borderRadius: '50%' }} />
                                                )}
                                            </button>
                                        )}
                                    </>
                                ) : capturedMediaUrl ? (
                                    <>
                                        {isVideo ? (
                                            <>
                                                <video
                                                    src={capturedMediaUrl}
                                                    autoPlay
                                                    loop
                                                    muted
                                                    playsInline
                                                    style={{
                                                        width: '100%', height: '100%', objectFit: 'cover',
                                                        filter: FILTERS[activeFilterIndex].style
                                                    }}
                                                />
                                                <div style={{
                                                    position: 'absolute', top: '10px', left: '10px',
                                                    background: 'rgba(239, 68, 68, 0.85)', backdropFilter: 'blur(6px)',
                                                    borderRadius: '12px', padding: '3px 8px', fontSize: '11px',
                                                    fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px',
                                                    zIndex: 10
                                                }}>
                                                    <Play size={10} fill="#fff" /> 30s Video
                                                </div>
                                            </>
                                        ) : (
                                            <img
                                                src={capturedMediaUrl}
                                                alt="Preview"
                                                style={{
                                                    width: '100%', height: '100%', objectFit: 'cover',
                                                    filter: FILTERS[activeFilterIndex].style
                                                }}
                                            />
                                        )}
                                        <button
                                            onClick={() => {
                                                setCapturedMediaUrl(null);
                                                setSelectedFile(null);
                                                setIsVideo(false);
                                            }}
                                            style={{
                                                position: 'absolute', top: '10px', right: '10px',
                                                background: 'rgba(0,0,0,0.65)', border: 'none',
                                                borderRadius: '50%', width: '32px', height: '32px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: '#fff', cursor: 'pointer'
                                            }}
                                        >
                                            <X size={18} />
                                        </button>
                                    </>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button
                                                onClick={() => startCamera('photo')}
                                                style={{
                                                    background: 'rgba(245,165,36,0.15)', border: '1px solid #f5a524',
                                                    borderRadius: '16px', padding: '14px 18px', color: '#f5a524',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                                    cursor: 'pointer', fontWeight: '700', fontSize: '12px'
                                                }}
                                            >
                                                <Camera size={26} />
                                                <span>Open Camera</span>
                                            </button>

                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                style={{
                                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                                                    borderRadius: '16px', padding: '14px 18px', color: 'var(--text-active)',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                                    cursor: 'pointer', fontWeight: '700', fontSize: '12px'
                                                }}
                                            >
                                                <ImageIcon size={26} />
                                                <span>Upload File</span>
                                            </button>
                                        </div>
                                        <span style={{ fontSize: '11px', color: 'var(--text-inactive)' }}>Supports photos and videos (up to 30s)</span>
                                    </div>
                                )}
                                <canvas ref={canvasRef} style={{ display: 'none' }} />
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,video/*"
                                    style={{ display: 'none' }}
                                    onChange={handleFileSelect}
                                />
                            </div>

                            {/* AR Filter Selection */}
                            {(capturedMediaUrl || isCameraActive) && (
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-inactive)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                                        Filters
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                                        {FILTERS.map((f, idx) => (
                                            <button
                                                key={f.name}
                                                onClick={() => setActiveFilterIndex(idx)}
                                                style={{
                                                    padding: '5px 12px', borderRadius: '16px',
                                                    background: activeFilterIndex === idx ? '#f5a524' : 'rgba(255,255,255,0.06)',
                                                    color: activeFilterIndex === idx ? '#000' : 'var(--text-inactive)',
                                                    border: 'none', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {f.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Soundtrack Button */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Music size={16} color="#f5a524" />
                                    <span style={{ fontSize: '12px', fontWeight: '600' }}>
                                        {selectedTrack ? `${selectedTrack.title} • ${selectedTrack.artist}` : 'Add Soundtrack'}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setIsMusicModalOpen(true)}
                                    style={{
                                        background: selectedTrack ? 'rgba(245,165,36,0.2)' : 'var(--border-color)',
                                        border: 'none', borderRadius: '14px', padding: '4px 10px',
                                        color: selectedTrack ? '#f5a524' : 'var(--text-active)',
                                        fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                                    }}
                                >
                                    {selectedTrack ? 'Change' : 'Choose 🎵'}
                                </button>
                            </div>

                            {/* Caption Input */}
                            <input
                                type="text"
                                value={caption}
                                onChange={e => setCaption(e.target.value)}
                                placeholder="Add a caption or story note..."
                                style={{
                                    width: '100%', background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px', padding: '12px 14px',
                                    color: 'var(--text-active)', fontSize: '13px', outline: 'none'
                                }}
                            />

                            {/* ── Screen Delivery Reach Engine (The Core Feature) ── */}
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(245,165,36,0.1), rgba(255,107,53,0.1))',
                                border: '1px solid rgba(245,165,36,0.3)',
                                borderRadius: '16px', padding: '16px',
                                display: 'flex', flexDirection: 'column', gap: '12px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <ShieldCheck size={16} color="#f5a524" />
                                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#f5a524' }}>
                                            Screen Delivery Guarantee
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-inactive)' }}>
                                        Balance: <strong style={{ color: '#fff' }}>{points} pts</strong>
                                    </span>
                                </div>

                                {/* Math Breakdown */}
                                <div style={{
                                    background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '10px 14px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
                                    textAlign: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-inactive)' }}>Friends Reach</div>
                                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>{baseFriendsCount}</div>
                                        <div style={{ fontSize: '9px', color: '#60a5fa' }}>screens</div>
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f5a524' }}>+</div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-inactive)' }}>Boost Points</div>
                                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#f5a524' }}>{extraGuaranteedScreens}</div>
                                        <div style={{ fontSize: '9px', color: '#f5a524' }}>extra screens</div>
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff6b35' }}>=</div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-inactive)' }}>Total Guaranteed</div>
                                        <div style={{ fontSize: '18px', fontWeight: '900', color: '#ff6b35' }}>{totalGuaranteedReach}</div>
                                        <div style={{ fontSize: '9px', color: '#ff6b35', fontWeight: 'bold' }}>SCREENS 🔥</div>
                                    </div>
                                </div>

                                {/* Point Stepper / Selector */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-inactive)' }}>
                                            Points to allocate (1 pt = 1 extra user screen):
                                        </span>
                                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#f5a524' }}>
                                            {pointsToSpend} pts
                                        </span>
                                    </div>

                                     <div style={{ display: 'flex', gap: '8px' }}>
                                        {[0, 5, 10, 25, 50].map(amt => (
                                            <button
                                                key={amt}
                                                type="button"
                                                onClick={() => setPointsToSpend(Math.min(amt, userPoints))}
                                                style={{
                                                    flex: 1, padding: '7px 0', borderRadius: '10px',
                                                    background: pointsToSpend === amt ? '#f5a524' : 'rgba(255,255,255,0.06)',
                                                    color: pointsToSpend === amt ? '#000' : 'var(--text-active)',
                                                    border: 'none', fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                                                }}
                                            >
                                                +{amt}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.4' }}>
                                    💡 <em>Our delivery engine guarantees your knock reaches all {baseFriendsCount} of your friends, plus {extraGuaranteedScreens} additional user screens across the app within 24 hours.</em>
                                </p>
                            </div>

                            {/* Error display */}
                            {uploadError && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                                    borderRadius: '10px', padding: '10px', color: '#ef4444', fontSize: '12px'
                                }}>
                                    <AlertCircle size={16} />
                                    <span>{uploadError}</span>
                                </div>
                            )}

                            {/* Launch Action */}
                            <button
                                onClick={handleLaunchBoostKnock}
                                disabled={isSubmitting || (!capturedMediaUrl && !selectedFile)}
                                style={{
                                    background: 'linear-gradient(135deg, #f5a524, #ff6b35)',
                                    border: 'none', borderRadius: '14px', padding: '14px',
                                    color: '#000', fontSize: '14px', fontWeight: '800',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                    opacity: isSubmitting || (!capturedMediaUrl && !selectedFile) ? 0.6 : 1,
                                    boxShadow: '0 6px 20px rgba(245, 165, 36, 0.45)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        <span>{uploadProgress > 0 ? `Uploading... ${uploadProgress}%` : 'Publishing 24h Knock...'}</span>
                                    </>
                                ) : (
                                    <>
                                        <Rocket size={18} />
                                        <span>KnockUp Screen ({totalGuaranteedReach} Screens)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Fullscreen Story Viewer ── */}
            {activeViewerGroupIndex !== null && (
                <StoryViewer
                    storyGroups={viewerStoryGroups}
                    initialGroupIndex={activeViewerGroupIndex}
                    currentUserId={user?.id}
                    onClose={() => setActiveViewerGroupIndex(null)}
                    onGroupsUpdated={(newGroups) => {
                        setViewerStoryGroups(newGroups);
                        const updatedFlat = newGroups.flatMap(g => g.stories);
                        setStories(updatedFlat);
                    }}
                />
            )}

            {/* ── Music Picker Modal ── */}
            <MusicPickerModal
                isOpen={isMusicModalOpen}
                onClose={() => setIsMusicModalOpen(false)}
                onSelectTrack={(track) => setSelectedTrack(track)}
                selectedTrackId={selectedTrack?.id}
            />
        </div>
    );
};

export default Boost;
