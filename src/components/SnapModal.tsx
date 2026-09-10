import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    X, Camera, RefreshCw, Send, Mic, Square, Trash2, 
    Play, Pause, Image as ImageIcon, Search, Loader2, Sparkles 
} from 'lucide-react';
import { uploadMedia, type ProfileData } from '../lib/database';
import { compressImage, isVideoFile } from '../lib/media';

export interface SnapPayload {
    media_url: string;
    media_type: 'image' | 'video';
    audio_url?: string;
    audio_duration?: number;
    caption?: string;
}

interface SnapModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: ProfileData & { id: string; username: string };
    targetContact?: ProfileData | null;
    targetGroupId?: string | null;
    targetGroupName?: string | null;
    allContacts?: ProfileData[];
    onSendSnap: (snap: SnapPayload, targetId?: string, isGroup?: boolean) => Promise<void>;
}

export const SnapModal: React.FC<SnapModalProps> = ({
    isOpen,
    onClose,
    currentUser,
    targetContact,
    targetGroupId,
    targetGroupName,
    allContacts = [],
    onSendSnap,
}) => {
    // ── Media Capture / Pick States ──
    const [capturedMediaUrl, setCapturedMediaUrl] = useState<string | null>(null);
    const [capturedFile, setCapturedFile] = useState<File | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);

    // ── 30-Second Voice Attachment States ──
    const [isRecordingAudio, setIsRecordingAudio] = useState(false);
    const [audioDuration, setAudioDuration] = useState(0);
    const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
    const [isPlayingAudioPreview, setIsPlayingAudioPreview] = useState(false);

    // ── Details & Recipient States ──
    const [caption, setCaption] = useState('');
    const [selectedRecipientId, setSelectedRecipientId] = useState<string>(targetContact?.id || '');
    const [recipientSearch, setRecipientSearch] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // ── Refs ──
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioTimerRef = useRef<any>(null);
    const audioHardStopTimerRef = useRef<any>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    // Stop and clear camera
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
    }, []);

    // Start Camera Stream
    const startCamera = useCallback(async (mode: 'user' | 'environment') => {
        stopCamera();
        setCameraError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(() => {});
            }
            setIsCameraActive(true);
        } catch (err: any) {
            console.warn('Camera access issue:', err);
            setCameraError('Camera access unavailable. You can pick photos/videos from your files.');
            setIsCameraActive(false);
        }
    }, [stopCamera]);

    // Flip Camera (front / back)
    const toggleCameraFacing = () => {
        const next = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(next);
        startCamera(next);
    };

    // Shutter Click (Capture Photo)
    const takePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 1280;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw video frame to canvas
        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (!blob) return;
            const file = new File([blob], `snap-${Date.now()}.jpg`, { type: 'image/jpeg' });
            setCapturedFile(file);
            setCapturedMediaUrl(URL.createObjectURL(blob));
            setMediaType('image');
            stopCamera();
        }, 'image/jpeg', 0.85);
    };

    // Gallery File Selection
    const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        const isVideo = isVideoFile(file);
        setCapturedFile(file);
        setCapturedMediaUrl(URL.createObjectURL(file));
        setMediaType(isVideo ? 'video' : 'image');
        stopCamera();
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── 30-SECOND VOICE RECORDING ENGINE ──
    const startVoiceRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            let mimeType = 'audio/webm';
            if (typeof MediaRecorder !== 'undefined') {
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    mimeType = 'audio/webm;codecs=opus';
                } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                    mimeType = 'audio/webm';
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    mimeType = 'audio/mp4';
                } else if (MediaRecorder.isTypeSupported('audio/aac')) {
                    mimeType = 'audio/aac';
                }
            }

            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];
            setAudioDuration(0);

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            const startTime = Date.now();

            recorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                if (audioTimerRef.current) clearInterval(audioTimerRef.current);
                if (audioHardStopTimerRef.current) clearTimeout(audioHardStopTimerRef.current);

                const recordedBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
                const actualSecs = Math.max(1, Math.min(30, Math.round((Date.now() - startTime) / 1000)));
                setRecordedAudioBlob(recordedBlob);
                setAudioDuration(actualSecs);
                setAudioPreviewUrl(URL.createObjectURL(recordedBlob));
                setIsRecordingAudio(false);
            };

            recorder.start(100);
            setIsRecordingAudio(true);

            // Live interval counter (caps at 30)
            audioTimerRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                setAudioDuration(Math.min(30, elapsed));
                if (elapsed >= 30) {
                    stopVoiceRecording();
                }
            }, 500);

            // Hard stop guarantee at 30 seconds
            audioHardStopTimerRef.current = setTimeout(() => {
                stopVoiceRecording();
            }, 30000);

        } catch (err) {
            console.error('Mic access failed:', err);
            alert('Microphone access is needed to record a voice note.');
        }
    };

    const stopVoiceRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (audioTimerRef.current) clearInterval(audioTimerRef.current);
        if (audioHardStopTimerRef.current) clearTimeout(audioHardStopTimerRef.current);
    };

    const discardVoiceRecording = () => {
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current = null;
        }
        setIsPlayingAudioPreview(false);
        setRecordedAudioBlob(null);
        setAudioPreviewUrl(null);
        setAudioDuration(0);
    };

    const togglePlayAudioPreview = () => {
        if (!audioPreviewUrl) return;
        if (isPlayingAudioPreview && audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            setIsPlayingAudioPreview(false);
        } else {
            const audio = new Audio(audioPreviewUrl);
            audioPlayerRef.current = audio;
            audio.onended = () => setIsPlayingAudioPreview(false);
            audio.play().then(() => setIsPlayingAudioPreview(true)).catch(() => setIsPlayingAudioPreview(false));
        }
    };

    // Handle initial open
    useEffect(() => {
        if (isOpen) {
            setSelectedRecipientId(targetContact?.id || '');
            setCaption('');
            setCapturedFile(null);
            setCapturedMediaUrl(null);
            setRecordedAudioBlob(null);
            setAudioPreviewUrl(null);
            setAudioDuration(0);
            setIsRecordingAudio(false);
            setIsUploading(false);
            setUploadProgress(0);
            startCamera(facingMode);
        } else {
            stopCamera();
            if (audioTimerRef.current) clearInterval(audioTimerRef.current);
            if (audioHardStopTimerRef.current) clearTimeout(audioHardStopTimerRef.current);
            if (audioPlayerRef.current) audioPlayerRef.current.pause();
        }

        return () => {
            stopCamera();
            if (audioTimerRef.current) clearInterval(audioTimerRef.current);
            if (audioHardStopTimerRef.current) clearTimeout(audioHardStopTimerRef.current);
        };
    }, [isOpen, targetContact, startCamera, stopCamera]);

    // Handle Upload & Send Snap
    const handleSend = async () => {
        if (!capturedFile && !capturedMediaUrl) {
            alert('Please take a photo or select a video first.');
            return;
        }

        const recipientId = targetGroupId ? targetGroupId : (selectedRecipientId || targetContact?.id);
        if (!recipientId) {
            alert('Please select a friend to send this snap to.');
            return;
        }

        setIsUploading(true);
        setUploadProgress(10);

        try {
            // 1. Upload Media File
            let fileToUpload = capturedFile;
            if (fileToUpload && mediaType === 'image' && fileToUpload.type.startsWith('image/')) {
                try {
                    fileToUpload = await compressImage(fileToUpload, 1200, 1200, 0.8);
                } catch (e) {
                    console.warn('Snap image compression skipped', e);
                }
            }

            const rawExt = fileToUpload?.name?.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'jpg');
            const cleanExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || (mediaType === 'video' ? 'mp4' : 'jpg');
            const mediaPath = `chat_snaps/${currentUser.id}_${Date.now()}.${cleanExt}`;

            setUploadProgress(30);
            const mediaPublicUrl = await uploadMedia(fileToUpload!, mediaPath, (p) => {
                if (p.total > 0) {
                    setUploadProgress(Math.min(80, 30 + Math.round((p.loaded / p.total) * 45)));
                }
            });

            // 2. Upload Attached Audio (if recorded)
            let audioPublicUrl: string | undefined = undefined;
            if (recordedAudioBlob && recordedAudioBlob.size > 0) {
                setUploadProgress(85);
                const audioExt = recordedAudioBlob.type.includes('mp4') ? 'm4a' : 'webm';
                const audioPath = `chat_snaps/audio_${currentUser.id}_${Date.now()}.${audioExt}`;
                const audioFile = new File([recordedAudioBlob], `voice_${Date.now()}.${audioExt}`, { type: recordedAudioBlob.type });
                audioPublicUrl = await uploadMedia(audioFile, audioPath);
            }

            setUploadProgress(95);

            // 3. Construct Snap Payload
            const snapPayload: SnapPayload = {
                media_url: mediaPublicUrl,
                media_type: mediaType,
                audio_url: audioPublicUrl,
                audio_duration: audioDuration > 0 ? audioDuration : undefined,
                caption: caption.trim() || undefined,
            };

            await onSendSnap(snapPayload, recipientId, Boolean(targetGroupId));
            setUploadProgress(100);
            onClose();
        } catch (err: any) {
            console.error('Failed to send snap:', err);
            alert('Failed to upload and send snap. Please check your connection and try again.');
        } finally {
            setIsUploading(false);
        }
    };

    if (!isOpen) return null;

    const filteredContacts = allContacts.filter(c =>
        c.id !== currentUser.id &&
        ((c.username || '').toLowerCase().includes(recipientSearch.toLowerCase()) ||
        (c.name || '').toLowerCase().includes(recipientSearch.toLowerCase()))
    );

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 11000,
            backgroundColor: '#000',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.2s ease-out'
        }}>
            {/* Top Navigation Bar */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 30,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, transparent 100%)'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        background: 'rgba(255,255,255,0.18)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        cursor: 'pointer',
                        backdropFilter: 'blur(8px)'
                    }}
                >
                    <X size={22} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f5a524', fontWeight: '800', fontSize: '15px' }}>
                    <Sparkles size={18} />
                    <span>Knock Snap Studio</span>
                </div>

                {isCameraActive && !capturedMediaUrl ? (
                    <button
                        onClick={toggleCameraFacing}
                        title="Flip Camera"
                        style={{
                            background: 'rgba(255,255,255,0.18)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            cursor: 'pointer',
                            backdropFilter: 'blur(8px)'
                        }}
                    >
                        <RefreshCw size={20} />
                    </button>
                ) : (
                    <div style={{ width: '40px' }} />
                )}
            </div>

            {/* Main Center Stage (Viewfinder / Preview) */}
            <div style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                backgroundColor: '#0a0a0a'
            }}>
                {/* 1. Camera Viewfinder */}
                {isCameraActive && !capturedMediaUrl && (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
                        }}
                    />
                )}

                {/* 2. Media Preview */}
                {capturedMediaUrl && (
                    mediaType === 'video' ? (
                        <video
                            src={capturedMediaUrl}
                            autoPlay
                            loop
                            playsInline
                            controls={false}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    ) : (
                        <img
                            src={capturedMediaUrl}
                            alt="Snap Preview"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    )
                )}

                {/* Retake button when media is captured */}
                {capturedMediaUrl && !isUploading && (
                    <button
                        onClick={() => {
                            setCapturedMediaUrl(null);
                            setCapturedFile(null);
                            discardVoiceRecording();
                            startCamera(facingMode);
                        }}
                        style={{
                            position: 'absolute',
                            top: '80px',
                            left: '20px',
                            background: 'rgba(0,0,0,0.65)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '20px',
                            padding: '6px 14px',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            zIndex: 25,
                            backdropFilter: 'blur(10px)'
                        }}
                    >
                        <RefreshCw size={14} />
                        <span>Retake</span>
                    </button>
                )}

                {/* Camera Fallback / Error view */}
                {!isCameraActive && !capturedMediaUrl && (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#fff' }}>
                        <Camera size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
                        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', margin: '0 0 16px' }}>
                            {cameraError || 'Camera inactive. Choose a photo/video or open camera.'}
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                onClick={() => startCamera(facingMode)}
                                style={{
                                    background: '#f5a524',
                                    color: '#000',
                                    border: 'none',
                                    padding: '10px 18px',
                                    borderRadius: '16px',
                                    fontWeight: '700',
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                Start Camera
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    background: 'rgba(255,255,255,0.15)',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '10px 18px',
                                    borderRadius: '16px',
                                    fontWeight: '700',
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                Pick from Files
                            </button>
                        </div>
                    </div>
                )}

                {/* Hidden Elements */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    style={{ display: 'none' }}
                    onChange={handleGallerySelect}
                />
            </div>

            {/* Bottom Controls / 30s Audio Bar / Send Tray */}
            <div style={{
                background: 'linear-gradient(0deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 70%, transparent 100%)',
                padding: '20px 20px env(safe-area-inset-bottom, 24px) 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                zIndex: 30
            }}>
                {/* ── BEFORE CAPTURE: Shutter & Gallery Buttons ── */}
                {isCameraActive && !capturedMediaUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', paddingBottom: '10px' }}>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                background: 'rgba(255,255,255,0.15)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '50px',
                                height: '50px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                cursor: 'pointer'
                            }}
                            title="Gallery"
                        >
                            <ImageIcon size={24} />
                        </button>

                        <button
                            onClick={takePhoto}
                            style={{
                                width: '74px',
                                height: '74px',
                                borderRadius: '50%',
                                background: '#fff',
                                border: '5px solid #f5a524',
                                cursor: 'pointer',
                                boxShadow: '0 0 20px rgba(245, 165, 36, 0.6)',
                                transition: 'transform 0.1s ease',
                            }}
                            title="Snap Photo"
                        />

                        <div style={{ width: '50px' }} />
                    </div>
                )}

                {/* ── AFTER CAPTURE: 30-Second Audio Recorder + Caption + Send ── */}
                {capturedMediaUrl && (
                    <>
                        {/* 🎙️ 30-Second Voice Attachment Section */}
                        <div style={{
                            background: 'rgba(255,255,255,0.07)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '18px',
                            padding: '12px 16px',
                            backdropFilter: 'blur(12px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px'
                        }}>
                            {isRecordingAudio ? (
                                /* Live Recording Indicator (Max 30s) */
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{
                                            width: '12px',
                                            height: '12px',
                                            borderRadius: '50%',
                                            backgroundColor: '#ff3b30',
                                            animation: 'pulse 1s infinite'
                                        }} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ color: '#ff3b30', fontWeight: '800', fontSize: '13px' }}>
                                                Recording Voice Note...
                                            </span>
                                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
                                                0:{String(audioDuration).padStart(2, '0')} / 0:30 (Max 30s)
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={stopVoiceRecording}
                                        style={{
                                            background: '#ff3b30',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '20px',
                                            padding: '8px 16px',
                                            fontWeight: '800',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <Square size={14} fill="#fff" />
                                        <span>Stop & Attach</span>
                                    </button>
                                </div>
                            ) : recordedAudioBlob ? (
                                /* Recorded Audio Preview (Attached) */
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <button
                                            onClick={togglePlayAudioPreview}
                                            style={{
                                                background: '#f5a524',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '36px',
                                                height: '36px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#000',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {isPlayingAudioPreview ? <Pause size={16} fill="#000" /> : <Play size={16} fill="#000" style={{ marginLeft: '2px' }} />}
                                        </button>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ color: '#f5a524', fontWeight: '700', fontSize: '13px' }}>
                                                🎙️ Attached Voice Note ({audioDuration}s)
                                            </span>
                                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
                                                Plays automatically when opened
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={discardVoiceRecording}
                                        title="Remove Voice Note"
                                        style={{
                                            background: 'rgba(255,255,255,0.1)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '32px',
                                            height: '32px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#ff453a',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ) : (
                                /* Start Recording 30s Audio Prompt */
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                                        <Mic size={18} color="#f5a524" />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '700' }}>Attach Audio Note</span>
                                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Record voice up to 30 seconds</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={startVoiceRecording}
                                        style={{
                                            background: 'linear-gradient(135deg, #f5a524, #ff6b35)',
                                            color: '#000',
                                            border: 'none',
                                            borderRadius: '20px',
                                            padding: '8px 16px',
                                            fontWeight: '800',
                                            fontSize: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Mic size={14} />
                                        <span>Record (30s)</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Caption Field */}
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="Add a caption to this snap... (optional)"
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                maxLength={140}
                                style={{
                                    width: '100%',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '16px',
                                    padding: '12px 16px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        {/* Recipient Picker (if opened without a target contact) */}
                        {!targetContact && !targetGroupId && (
                            <div style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '16px',
                                padding: '12px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <Search size={14} color="rgba(255,255,255,0.5)" />
                                    <input
                                        type="text"
                                        placeholder="Send to friend..."
                                        value={recipientSearch}
                                        onChange={(e) => setRecipientSearch(e.target.value)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#fff',
                                            fontSize: '12px',
                                            outline: 'none',
                                            width: '100%'
                                        }}
                                    />
                                </div>
                                <div style={{
                                    display: 'flex',
                                    gap: '8px',
                                    overflowX: 'auto',
                                    paddingBottom: '4px',
                                    scrollbarWidth: 'none'
                                }}>
                                    {filteredContacts.slice(0, 8).map(c => {
                                        const isSelected = selectedRecipientId === c.id;
                                        return (
                                            <div
                                                key={c.id}
                                                onClick={() => setSelectedRecipientId(c.id)}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    cursor: 'pointer',
                                                    padding: '4px 8px',
                                                    borderRadius: '12px',
                                                    background: isSelected ? 'rgba(245,165,36,0.2)' : 'transparent',
                                                    border: isSelected ? '1px solid #f5a524' : '1px solid transparent',
                                                    flexShrink: 0,
                                                    width: '56px'
                                                }}
                                            >
                                                <img
                                                    src={c.avatar_url || 'https://i.pravatar.cc/150'}
                                                    alt=""
                                                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                                                />
                                                <span style={{
                                                    fontSize: '10px',
                                                    color: isSelected ? '#f5a524' : '#fff',
                                                    fontWeight: isSelected ? '800' : '500',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    width: '100%',
                                                    textAlign: 'center'
                                                }}>
                                                    {c.name || c.username}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Send Button */}
                        <button
                            onClick={handleSend}
                            disabled={isUploading || isRecordingAudio}
                            style={{
                                background: 'linear-gradient(135deg, #f5a524, #ff6b35)',
                                color: '#000',
                                border: 'none',
                                borderRadius: '18px',
                                padding: '14px',
                                fontWeight: '900',
                                fontSize: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                cursor: isUploading ? 'not-allowed' : 'pointer',
                                boxShadow: '0 8px 24px rgba(245, 165, 36, 0.45)',
                                opacity: isUploading ? 0.7 : 1,
                                transition: 'all 0.15s ease'
                            }}
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Sending Snap... {uploadProgress > 0 ? `${uploadProgress}%` : ''}</span>
                                </>
                            ) : (
                                <>
                                    <Send size={18} />
                                    <span>
                                        Send Snap {targetGroupId ? `to ${targetGroupName || 'Group'}` : targetContact ? `to @${targetContact.username}` : ''} 🚀
                                    </span>
                                </>
                            )}
                        </button>
                    </>
                )}
            </div>

            <style>{`
                @keyframes pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(0.9); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};
