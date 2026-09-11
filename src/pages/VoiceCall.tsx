import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
    Phone, Mic, MicOff, PhoneOff, Settings2, Clock, Video, VideoOff, 
    Heart, Zap, Users, Loader2, SkipForward, MessageSquare, Send, X, 
    Link2, Flame, RefreshCw, CameraOff, ChevronLeft, Lock, Bell,
    Headphones, Globe, ArrowLeftRight, Languages, Trash2
} from 'lucide-react';
import { 
    SUPPORTED_LANGUAGES, 
    getUserLanguage, 
    setUserLanguage, 
    translateText, 
    getLanguage 
} from '../lib/translation';
import { AppContext } from '../context/AppContext';
import { useSearchParams } from 'react-router-dom';
import { createConnection, checkConnection, fetchProfilesByIds, type MatchResult, type ConnectionData, type ProfileData } from '../lib/database';
import { supabase } from '../lib/supabase';

const MATCH_PREFERENCES = [
    "Similar Likes 💖",
    "Boy to Girl 👦",
    "Girl to Boy 👧",
    "Same Country 🌍",
    "Random 🎲"
];

// Web Audio API sound effects for realistic voice call experience
const playTone = (freqs: number[], durations: number[], type: OscillatorType = 'sine', volume = 0.12) => {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        let startTime = ctx.currentTime;
        freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(volume, startTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durations[i]);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + durations[i]);
            startTime += durations[i];
        });
        setTimeout(() => ctx.close().catch(() => {}), (startTime - ctx.currentTime + 0.5) * 1000);
    } catch {
        // audio context failed or blocked
    }
};

const playCallConnectedChime = () => {
    playTone([523.25, 659.25, 783.99], [0.12, 0.12, 0.25], 'sine', 0.12);
};

const playCallEndChime = () => {
    playTone([440, 349.23, 261.63], [0.1, 0.1, 0.2], 'sine', 0.1);
};

const VoiceCall = () => {
    const { user, blockedIds } = useContext(AppContext);
    const [searchParams] = useSearchParams();
    
    // Direct call params
    const isDirectCall = searchParams.get('direct') === 'true';
    const directPartnerId = searchParams.get('partnerId');
    const directRole = searchParams.get('role'); // 'caller' | 'answerer'
    const directRoom = searchParams.get('room');

    const [isSearching, setIsSearching] = useState(false);
    const [inCall, setInCall] = useState(false);
    const [activePref, setActivePref] = useState(MATCH_PREFERENCES[0]);
    const [isMuted, setIsMuted] = useState(false);
    const [callDuration, setCallDuration] = useState(0);

    // Matching states
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const [showMatchCard, setShowMatchCard] = useState(false);
    const [noMatchFound, setNoMatchFound] = useState(false);

    // Call feature states
    const [requestStatus, setRequestStatus] = useState<'none' | 'sent' | 'accepted'>('none');
    const [videoRequestStatus, setVideoRequestStatus] = useState<'none' | 'sent' | 'accepted'>('none');
    const [connectionState, setConnectionState] = useState<'none' | 'connecting' | 'connected' | 'already'>('none');
    const [showConnectionToast, setShowConnectionToast] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [chatInput, setChatInput] = useState('');

    interface CallChatMessage {
        id: number;
        text: string;
        isMine: boolean;
        originalText?: string;
        translatedText?: string;
        senderLang?: string;
        targetLang?: string;
        isTranslated?: boolean;
    }

    const [chatMessages, setChatMessages] = useState<CallChatMessage[]>([]);
    const [myChatLanguage, setMyChatLanguage] = useState<string>(() => getUserLanguage());
    const [targetChatLanguage, setTargetChatLanguage] = useState<string>('en');
    const [autoTranslateChat, setAutoTranslateChat] = useState<boolean>(true);
    const [liveTranslationPreview, setLiveTranslationPreview] = useState<string>('');
    const [showOriginalMap, setShowOriginalMap] = useState<Record<number, boolean>>({});
    const [translatingMsgIds, setTranslatingMsgIds] = useState<Record<number, boolean>>({});
    const [floatingSubtitle, setFloatingSubtitle] = useState<{
        text: string;
        original: string;
        senderName: string;
        senderLang?: string;
        targetLang?: string;
        isTranslated?: boolean;
        time: number;
    } | null>(null);

    // WhatsApp-Style Video Call States
    const [isVideoSwapped, setIsVideoSwapped] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isFrontCamera, setIsFrontCamera] = useState(true);
    const [showVideoControls, setShowVideoControls] = useState(true);

    // 8:00 PM to 10:00 PM Voice Schedule System
    const getTimeUntilNextWindow = () => {
        const now = new Date();
        const hour = now.getHours();
        
        if (hour >= 20 && hour < 22) {
            const end = new Date(now);
            end.setHours(22, 0, 0, 0);
            const diff = Math.max(0, end.getTime() - now.getTime());
            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            return {
                isActive: true,
                hours: h,
                minutes: m,
                seconds: s,
                formatted: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
            };
        } else {
            const nextStart = new Date(now);
            if (hour >= 22) {
                nextStart.setDate(nextStart.getDate() + 1);
            }
            nextStart.setHours(20, 0, 0, 0);
            const diff = Math.max(0, nextStart.getTime() - now.getTime());
            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            return {
                isActive: false,
                hours: h,
                minutes: m,
                seconds: s,
                formatted: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
            };
        }
    };

    const [scheduleInfo, setScheduleInfo] = useState(getTimeUntilNextWindow());

    useEffect(() => {
        const interval = setInterval(() => {
            setScheduleInfo(getTimeUntilNextWindow());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const currentMatch = matches[currentMatchIndex] || null;
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);

    // Real-time voice call states
    const [isCaller, setIsCaller] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
    const [incomingExtensionRequest, setIncomingExtensionRequest] = useState(false);
    const [incomingVideoRequest, setIncomingVideoRequest] = useState(false);
    const [audioBlocked, setAudioBlocked] = useState(false);
    const [peerConnected, setPeerConnected] = useState(false);
    const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
    const onlineUsersRef = useRef<any[]>([]);

    const channelRef = useRef<any>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const remoteAudioStreamRef = useRef<MediaStream | null>(null);

    // Mic & Audio Test states for first page
    const [isMicTesting, setIsMicTesting] = useState(false);
    const [micTestVolume, setMicTestVolume] = useState(0);
    const [micLoopback, setMicLoopback] = useState(false);
    const micTestStreamRef = useRef<MediaStream | null>(null);
    const micTestAudioCtxRef = useRef<AudioContext | null>(null);
    const micTestGainNodeRef = useRef<GainNode | null>(null);
    const micTestAnimFrameRef = useRef<number | null>(null);

    const pendingInviteRef = useRef<string | null>(null);
    const searchTimeoutRef = useRef<number | null>(null);
    const pendingOfferRef = useRef<any>(null);
    const pendingIceCandidatesRef = useRef<any[]>([]);
    const webrtcReadyRef = useRef(false);
    const videoControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const channelSubscribedRef = useRef(false);
    const localVideoReadyRef = useRef(false);
    const remoteVideoReadyRef = useRef(false);
    const renegotiationPendingRef = useRef(false);
    const triggerRenegotiationRef = useRef<() => void>(() => {});

    // State refs to give signaling callbacks the latest values
    const isSearchingRef = useRef(isSearching);
    const activePrefRef = useRef(activePref);
    const currentMatchRef = useRef(currentMatch);
    const videoRequestStatusRef = useRef(videoRequestStatus);
    const inCallRef = useRef(inCall);
    const isCallerRef = useRef(isCaller);

    useEffect(() => { isSearchingRef.current = isSearching; }, [isSearching]);
    useEffect(() => { activePrefRef.current = activePref; }, [activePref]);
    useEffect(() => { currentMatchRef.current = currentMatch; }, [currentMatch]);
    useEffect(() => { videoRequestStatusRef.current = videoRequestStatus; }, [videoRequestStatus]);
    useEffect(() => { inCallRef.current = inCall; }, [inCall]);
    useEffect(() => { isCallerRef.current = isCaller; }, [isCaller]);
    useEffect(() => { onlineUsersRef.current = onlineUsers; }, [onlineUsers]);

    // Handle Direct Calls Initialization
    useEffect(() => {
        if (!user || !user.id || !isDirectCall || !directPartnerId) return;

        const initializeDirectCall = async () => {
            stopMicTest();
            const profiles = await fetchProfilesByIds([directPartnerId]);
            if (profiles.length === 0) {
                alert("User not found.");
                return;
            }
            const partnerProfile = profiles[0];

            setIsCaller(directRole === 'caller');
            setMatches([{
                profile: { ...partnerProfile, username: partnerProfile.username || partnerProfile.name } as any,
                similarityScore: 1.0,
                sharedLikes: 0,
                totalLikes: 0,
                compatibilityPercent: 100,
            }]);
            setCurrentMatchIndex(0);
            setIsSearching(false);
            setShowMatchCard(false);

            if (directRoom) {
                pendingInviteRef.current = directRoom;
            } else {
                pendingInviteRef.current = `direct-${directRole === 'caller' ? user.id : directPartnerId}-${directRole === 'caller' ? directPartnerId : user.id}`;
            }

            if (searchParams.get('type') === 'video') {
                setVideoRequestStatus('accepted');
            }

            setInCall(true);
            playCallConnectedChime();
            await updatePresence('in-call');
        };

        initializeDirectCall();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDirectCall, directPartnerId, directRole, directRoom, user?.id]);

    // Timer for active call
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (inCall) {
            interval = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } else {
            setCallDuration(0);
        }
        return () => clearInterval(interval);
    }, [inCall]);

    // Check call duration limit (3 minutes default unless extended)
    useEffect(() => {
        if (inCall && callDuration >= 180 && requestStatus !== 'accepted') {
            endCall();
        }
    }, [callDuration, inCall, requestStatus]);

    // Mic test helper functions
    const stopMicTest = () => {
        if (micTestAnimFrameRef.current) {
            cancelAnimationFrame(micTestAnimFrameRef.current);
            micTestAnimFrameRef.current = null;
        }
        if (micTestStreamRef.current) {
            micTestStreamRef.current.getTracks().forEach(t => t.stop());
            micTestStreamRef.current = null;
        }
        if (micTestAudioCtxRef.current) {
            micTestAudioCtxRef.current.close().catch(() => {});
            micTestAudioCtxRef.current = null;
        }
        micTestGainNodeRef.current = null;
        setIsMicTesting(false);
        setMicTestVolume(0);
    };

    const startMicTest = async () => {
        if (isMicTesting) {
            stopMicTest();
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });
            micTestStreamRef.current = stream;

            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            micTestAudioCtxRef.current = ctx;
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 128;
            analyser.smoothingTimeConstant = 0.5;
            source.connect(analyser);

            const gain = ctx.createGain();
            gain.gain.value = micLoopback ? 0.9 : 0.0;
            micTestGainNodeRef.current = gain;
            source.connect(gain);
            gain.connect(ctx.destination);

            setIsMicTesting(true);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const updateVolume = () => {
                if (!micTestStreamRef.current) return;
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                const level = Math.min(100, Math.round((avg / 100) * 100));
                setMicTestVolume(level);
                micTestAnimFrameRef.current = requestAnimationFrame(updateVolume);
            };
            updateVolume();
        } catch (err) {
            console.error('[MicTest] Access failed:', err);
            alert('Microphone access was denied or not found. Please ensure microphone permissions are granted in your browser settings.');
            stopMicTest();
        }
    };

    const toggleMicLoopback = () => {
        const next = !micLoopback;
        setMicLoopback(next);
        if (micTestGainNodeRef.current) {
            micTestGainNodeRef.current.gain.value = next ? 0.9 : 0.0;
        }
    };

    // Cleanup mic test on unmount
    useEffect(() => {
        return () => {
            stopMicTest();
        };
    }, []);

    // WebRTC connection and cleanup functions
    const closeWebRTC = () => {
        stopMicTest();
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (remoteStreamRef.current) {
            remoteStreamRef.current.getTracks().forEach(track => track.stop());
            remoteStreamRef.current = null;
        }
        if (remoteAudioStreamRef.current) {
            remoteAudioStreamRef.current.getTracks().forEach(track => track.stop());
            remoteAudioStreamRef.current = null;
        }
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
        }
        const callAudioEl = document.getElementById('knock-call-audio') as HTMLAudioElement;
        if (callAudioEl) {
            callAudioEl.srcObject = null;
        }
        pendingOfferRef.current = null;
        pendingIceCandidatesRef.current = [];
    };

    const updatePresence = async (status: 'idle' | 'searching' | 'in-call') => {
        if (channelRef.current && user?.id) {
            try {
                await channelRef.current.track({
                    user_id: user.id,
                    username: user.username,
                    name: user.name,
                    avatar_url: user.avatar_url,
                    gender: user.gender,
                    status: status,
                    preference: activePrefRef.current,
                });
            } catch (e) {
                console.error("Error tracking presence:", e);
            }
        }
    };

    // ── Supabase Realtime channel subscription ──
    useEffect(() => {
        if (!user || !user.id) return;

        const channelRoom = isDirectCall && directRoom ? `room:${directRoom}` : 'room:voice_calls';
        const channel = supabase.channel(channelRoom);
        channelRef.current = channel;

        channel
            .on('presence', { event: 'sync' }, () => {
                const presenceState = channel.presenceState();
                const list: any[] = [];
                Object.keys(presenceState).forEach((key) => {
                    presenceState[key].forEach((presence: any) => {
                        list.push(presence);
                    });
                });
                setOnlineUsers(list);
                onlineUsersRef.current = list;

                // If currently searching, try matching with any newly synced searching peer
                if (isSearchingRef.current && !inCallRef.current) {
                    findAndInviteMatch();
                }
            })
            .on('broadcast', { event: 'call-invite' }, ({ payload }) => {
                if (payload.receiverId !== user.id) return;

                const callerProfile = payload.callerProfile;
                const genderMatch = () => {
                    if (activePrefRef.current === 'Boy to Girl 👦') {
                        return callerProfile.gender === 'female';
                    }
                    if (activePrefRef.current === 'Girl to Boy 👧') {
                        return callerProfile.gender === 'male';
                    }
                    return true;
                };

                if (isSearchingRef.current && genderMatch()) {
                    if (searchTimeoutRef.current) {
                        clearTimeout(searchTimeoutRef.current);
                        searchTimeoutRef.current = null;
                    }

                    setIsCaller(false);
                            setMatches([{
                        profile: callerProfile,
                        similarityScore: payload.compatibilityPercent / 100,
                        sharedLikes: payload.sharedLikes,
                        totalLikes: payload.totalLikes,
                        compatibilityPercent: payload.compatibilityPercent,
                    }]);
                    setCurrentMatchIndex(0);
                    setIsSearching(false);
                    setShowMatchCard(false);
                    setInCall(true);
                    setPeerConnected(false);
                    playCallConnectedChime();
                    updatePresence('in-call');

                    channel.send({
                        type: 'broadcast',
                        event: 'call-accept',
                        payload: {
                            callerId: payload.callerId,
                            receiverId: user.id,
                            receiverProfile: {
                                id: user.id,
                                username: user.username,
                                name: user.name,
                                avatar_url: user.avatar_url,
                                gender: user.gender,
                                points: user.points,
                            }
                        }
                    });
                }
            })
            .on('broadcast', { event: 'call-accept' }, ({ payload }) => {
                if (payload.callerId !== user.id) return;
                if (isSearchingRef.current) {
                    if (searchTimeoutRef.current) {
                        clearTimeout(searchTimeoutRef.current);
                        searchTimeoutRef.current = null;
                    }

                    setIsCaller(true);
                            setMatches([{
                        profile: payload.receiverProfile,
                        similarityScore: 0.85,
                        sharedLikes: 3,
                        totalLikes: 6,
                        compatibilityPercent: 88,
                    }]);
                    setCurrentMatchIndex(0);
                    setIsSearching(false);
                    setShowMatchCard(false);
                    setInCall(true);
                    setPeerConnected(false);
                    playCallConnectedChime();
                    updatePresence('in-call');
                    pendingInviteRef.current = null;
                }
            })
            .on('broadcast', { event: 'call-end' }, ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                endCall();
            })
            .on('broadcast', { event: 'chat-message' }, async ({ payload }) => {
                if (payload.receiverId !== user.id) return;

                let displayText = payload.text;
                let translated = payload.translatedText;
                let isTranslated = false;

                // 1. If sender already translated to my language
                if (payload.targetLang === myChatLanguage && payload.translatedText) {
                    displayText = payload.translatedText;
                    translated = payload.translatedText;
                    isTranslated = true;
                } else if (autoTranslateChat && payload.senderLang !== myChatLanguage) {
                    // 2. Auto-translate into my language if not already translated for me
                    try {
                        const res = await translateText(payload.text, myChatLanguage, payload.senderLang || 'auto');
                        if (res.translatedText && res.translatedText.toLowerCase() !== payload.text.toLowerCase()) {
                            displayText = res.translatedText;
                            translated = res.translatedText;
                            isTranslated = true;
                        }
                    } catch (e) {
                        console.warn('Auto translation failed on receive:', e);
                    }
                }

                setChatMessages(prev => [...prev, {
                    id: payload.id,
                    text: displayText,
                    originalText: payload.originalText || payload.text,
                    translatedText: translated || undefined,
                    senderLang: payload.senderLang || 'auto',
                    targetLang: myChatLanguage,
                    isTranslated: isTranslated,
                    isMine: false,
                }]);

                // Trigger floating subtitle on screen
                setFloatingSubtitle({
                    text: displayText,
                    original: payload.originalText || payload.text,
                    senderName: currentMatchRef.current?.profile?.name || 'Match',
                    senderLang: payload.senderLang,
                    targetLang: myChatLanguage,
                    isTranslated: isTranslated,
                    time: Date.now(),
                });
            })
            .on('broadcast', { event: 'chat-delete' }, ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                setChatMessages(prev => prev.filter(m => m.id !== payload.messageId));
                setFloatingSubtitle(null);
            })
            .on('broadcast', { event: 'extend-request' }, ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                setIncomingExtensionRequest(true);
            })
            .on('broadcast', { event: 'extend-response' }, ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                if (payload.accepted) {
                    setRequestStatus('accepted');
                } else {
                    setRequestStatus('none');
                }
            })
            .on('broadcast', { event: 'video-request' }, ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                setIncomingVideoRequest(true);
            })
            .on('broadcast', { event: 'video-response' }, ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                if (payload.accepted) {
                    setVideoRequestStatus('accepted');
                } else {
                    setVideoRequestStatus('none');
                }
            })
            .on('broadcast', { event: 'video-ready' }, async ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                console.log('[WebRTC] Received video-ready from peer', payload);
                remoteVideoReadyRef.current = true;
                if (isCallerRef.current) {
                    triggerRenegotiationRef.current();
                } else {
                    // If answerer, ensure caller knows we are ready after small delay if needed
                    setTimeout(() => {
                        if (!remoteStreamRef.current?.getVideoTracks().length && channelRef.current && currentMatchRef.current) {
                            channelRef.current.send({
                                type: 'broadcast',
                                event: 'video-ready',
                                payload: {
                                    senderId: user.id,
                                    receiverId: currentMatchRef.current.profile.id,
                                    isCaller: false
                                }
                            });
                        }
                    }, 2000);
                }
            })
            .on('broadcast', { event: 'switch-to-voice' }, ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                setVideoRequestStatus('none');
                setHasRemoteVideo(false);
                localVideoReadyRef.current = false;
                remoteVideoReadyRef.current = false;
                renegotiationPendingRef.current = false;
                setIsVideoSwapped(false);
                setIsCameraOff(false);
                if (localStreamRef.current) {
                    localStreamRef.current.getVideoTracks().forEach(track => {
                        track.stop();
                        localStreamRef.current?.removeTrack(track);
                    });
                }
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = null;
                }
                if (remoteStreamRef.current) {
                    remoteStreamRef.current.getVideoTracks().forEach(track => {
                        track.stop();
                        remoteStreamRef.current?.removeTrack(track);
                    });
                    remoteStreamRef.current = null;
                }
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = null;
                }
            })
            .on('broadcast', { event: 'peer-arrived' }, async ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                if (isCallerRef.current) {
                    const pc = peerConnectionRef.current;
                    if (pc && pc.signalingState === 'stable') {
                        try {
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);
                            channel.send({
                                type: 'broadcast',
                                event: 'webrtc-offer',
                                payload: { senderId: user.id, receiverId: payload.senderId, sdp: offer }
                            });
                        } catch (e) {
                            console.error('Error creating offer on peer-arrived', e);
                        }
                    }
                } else {
                    channel.send({
                        type: 'broadcast',
                        event: 'peer-ready',
                        payload: { senderId: user.id, receiverId: payload.senderId }
                    });
                }
            })
            .on('broadcast', { event: 'peer-ready' }, async ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                if (isCallerRef.current) {
                    const pc = peerConnectionRef.current;
                    if (pc && pc.signalingState === 'stable') {
                        try {
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);
                            channel.send({
                                type: 'broadcast',
                                event: 'webrtc-offer',
                                payload: { senderId: user.id, receiverId: payload.senderId, sdp: offer }
                            });
                        } catch (e) {
                            console.error('Error creating offer on peer-ready', e);
                        }
                    }
                }
            })
            .on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                
                const processOffer = async (pc: RTCPeerConnection, sdp: any) => {
                    try {
                        if (pc.signalingState === 'have-local-offer') {
                            if (!isCallerRef.current) {
                                await pc.setLocalDescription({ type: 'rollback' });
                            } else {
                                return;
                            }
                        }
                        if (pc.signalingState === 'have-remote-offer') {
                            await pc.setLocalDescription({ type: 'rollback' });
                        }
                        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        channel.send({
                            type: 'broadcast',
                            event: 'webrtc-answer',
                            payload: {
                                senderId: user.id,
                                receiverId: payload.senderId,
                                sdp: answer,
                            }
                        });
                        for (const candidate of pendingIceCandidatesRef.current) {
                            try {
                                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                            } catch (e) {
                                console.error('Error adding queued ICE candidate after offer:', e);
                            }
                        }
                        pendingIceCandidatesRef.current = [];
                    } catch (e) {
                        console.error('Error handling WebRTC offer:', e);
                    }
                };

                if (peerConnectionRef.current && webrtcReadyRef.current) {
                    await processOffer(peerConnectionRef.current, payload.sdp);
                } else {
                    pendingOfferRef.current = payload.sdp;
                }
            })
            .on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                if (peerConnectionRef.current) {
                    try {
                        if (peerConnectionRef.current.signalingState === 'stable') {
                            return;
                        }
                        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                        for (const candidate of pendingIceCandidatesRef.current) {
                            try {
                                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                            } catch (e) {
                                console.error('Error adding queued ICE candidate:', e);
                            }
                        }
                        pendingIceCandidatesRef.current = [];

                        // If renegotiation was queued while awaiting answer, fire it now that state is stable
                        if (renegotiationPendingRef.current) {
                            triggerRenegotiationRef.current();
                        }
                    } catch (e) {
                        console.error('Error handling WebRTC answer:', e);
                    }
                }
            })
            .on('broadcast', { event: 'webrtc-ice' }, async ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
                    try {
                        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    } catch (e) {
                        console.error('Error handling ICE candidate:', e);
                    }
                } else {
                    pendingIceCandidatesRef.current.push(payload.candidate);
                }
            });

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                channelSubscribedRef.current = true;
                await channel.track({
                    user_id: user.id,
                    username: user.username,
                    name: user.name,
                    avatar_url: user.avatar_url,
                    gender: user.gender,
                    status: isSearchingRef.current ? 'searching' : inCallRef.current ? 'in-call' : 'idle',
                    preference: activePrefRef.current,
                });
                // If already in a call (e.g. direct call set inCall before channel was ready),
                // re-send peer-arrived so the WebRTC handshake can begin
                if (inCallRef.current && currentMatchRef.current && peerConnectionRef.current) {
                    channel.send({
                        type: 'broadcast',
                        event: 'peer-arrived',
                        payload: { senderId: user.id, receiverId: currentMatchRef.current.profile.id }
                    });
                }
            }
        });

        return () => {
            channelSubscribedRef.current = false;
            channel.unsubscribe();
        };
    }, [user?.id, isDirectCall, directRoom]);

    // ── WebRTC Connection Management ──
    useEffect(() => {
        const startWebRTC = async () => {
            if (!inCall || !currentMatch) return;
            closeWebRTC();


    
            try {
                const isVideo = videoRequestStatus === 'accepted';
                let stream: MediaStream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: isVideo
                    });
                } catch (audioConstraintErr) {
                    console.warn('[WebRTC] Complex audio constraints failed, trying basic audio:', audioConstraintErr);
                    stream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: isVideo
                    });
                }
                localStreamRef.current = stream;

                // Ensure local audio tracks are active
                stream.getAudioTracks().forEach(track => {
                    track.enabled = !isMuted;
                });

                if (isVideo && localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                const iceServers: RTCIceServer[] = [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    {
                        urls: 'turn:a.relay.metered.ca:80',
                        username: 'e8dd65b92f6dfe65e3b3c6c4',
                        credential: 'uWdWNmkhvyqTEswO',
                    },
                    {
                        urls: 'turn:a.relay.metered.ca:80?transport=tcp',
                        username: 'e8dd65b92f6dfe65e3b3c6c4',
                        credential: 'uWdWNmkhvyqTEswO',
                    },
                    {
                        urls: 'turn:a.relay.metered.ca:443',
                        username: 'e8dd65b92f6dfe65e3b3c6c4',
                        credential: 'uWdWNmkhvyqTEswO',
                    },
                    {
                        urls: 'turns:a.relay.metered.ca:443?transport=tcp',
                        username: 'e8dd65b92f6dfe65e3b3c6c4',
                        credential: 'uWdWNmkhvyqTEswO',
                    },
                ];

                const pc = new RTCPeerConnection({
                    iceServers,
                    iceCandidatePoolSize: 10,
                });
                peerConnectionRef.current = pc;

                stream.getTracks().forEach(track => {
                    pc.addTrack(track, stream);
                });

                pc.onicecandidate = (event) => {
                    if (event.candidate && channelRef.current && currentMatchRef.current) {
                        channelRef.current.send({
                            type: 'broadcast',
                            event: 'webrtc-ice',
                            payload: {
                                senderId: user!.id,
                                receiverId: currentMatchRef.current.profile.id,
                                candidate: event.candidate,
                            }
                        });
                    }
                };

                pc.onsignalingstatechange = () => {
                    console.log('[WebRTC] Signaling state:', pc.signalingState);
                    if (pc.signalingState === 'stable' && renegotiationPendingRef.current) {
                        triggerRenegotiationRef.current();
                    }
                };

                pc.ontrack = (event) => {
                    console.log('[WebRTC ontrack]', event.track.kind, event.track.id);

                    if (event.track.kind === 'audio') {
                        setPeerConnected(true);
                        console.log('[WebRTC ontrack] Remote audio track received:', event.track.id, 'readyState:', event.track.readyState);

                        const stream = (event.streams && event.streams[0]) 
                            ? event.streams[0] 
                            : new MediaStream([event.track]);

                        remoteAudioStreamRef.current = stream;

                        const audioEl = remoteAudioRef.current || (document.getElementById('knock-call-audio') as HTMLAudioElement);
                        if (audioEl) {
                            audioEl.srcObject = stream;
                            audioEl.volume = 1.0;
                            audioEl.muted = false;
                            audioEl.play().then(() => {
                                setAudioBlocked(false);
                            }).catch(err => {
                                console.warn('Audio autoplay blocked, showing tap-to-unmute:', err);
                                setAudioBlocked(true);
                            });
                        }
                    }

                    if (event.track.kind === 'video') {
                        setPeerConnected(true);
                        console.log('[WebRTC ontrack] Incoming remote video track received:', event.track.id);

                        let videoStream = remoteStreamRef.current;
                        if (!videoStream || !(videoStream instanceof MediaStream)) {
                            videoStream = new MediaStream();
                            remoteStreamRef.current = videoStream;
                        }

                        // Remove ended or duplicate tracks
                        videoStream.getVideoTracks().forEach(t => {
                            if (t.id !== event.track.id) {
                                videoStream!.removeTrack(t);
                            }
                        });

                        if (!videoStream.getVideoTracks().some(t => t.id === event.track.id)) {
                            videoStream.addTrack(event.track);
                        }

                        setHasRemoteVideo(true);

                        if (remoteVideoRef.current) {
                            if (remoteVideoRef.current.srcObject !== videoStream) {
                                remoteVideoRef.current.srcObject = videoStream;
                            }
                            remoteVideoRef.current.muted = true;
                            remoteVideoRef.current.play().catch(e => console.warn('Remote video play failed:', e));
                        }

                        event.track.onended = () => {
                            console.log('[WebRTC] Remote video track ended');
                            setHasRemoteVideo(false);
                        };
                        event.track.onmute = () => {
                            console.log('[WebRTC] Remote video track muted');
                        };
                        event.track.onunmute = () => {
                            console.log('[WebRTC] Remote video track unmuted');
                            setHasRemoteVideo(true);
                            if (remoteVideoRef.current) {
                                remoteVideoRef.current.play().catch(() => {});
                            }
                        };
                    }
                };

                pc.oniceconnectionstatechange = () => {
                    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                        setPeerConnected(true);
                    }
                };

                pc.onconnectionstatechange = () => {
                    if (pc.connectionState === 'connected') {
                        setPeerConnected(true);
                    } else if (pc.connectionState === 'failed') {
                        if (isCallerRef.current && channelRef.current && currentMatchRef.current) {
                            pc.restartIce();
                            pc.createOffer({ iceRestart: true }).then(offer => {
                                return pc.setLocalDescription(offer);
                            }).then(() => {
                                channelRef.current.send({
                                    type: 'broadcast',
                                    event: 'webrtc-offer',
                                    payload: {
                                        senderId: user!.id,
                                        receiverId: currentMatchRef.current!.profile.id,
                                        sdp: pc.localDescription,
                                    }
                                });
                            }).catch(e => console.error('ICE restart failed:', e));
                        }
                    }
                };

                webrtcReadyRef.current = true;

                if (!isCaller && pendingOfferRef.current) {
                    try {
                        await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        channelRef.current.send({
                            type: 'broadcast',
                            event: 'webrtc-answer',
                            payload: {
                                senderId: user!.id,
                                receiverId: currentMatchRef.current.profile.id,
                                sdp: answer,
                            }
                        });
                        pendingOfferRef.current = null;

                        for (const candidate of pendingIceCandidatesRef.current) {
                            try {
                                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                            } catch (e) {
                                console.error('Error adding queued ICE candidate after pending offer:', e);
                            }
                        }
                        pendingIceCandidatesRef.current = [];
                    } catch (e) {
                        console.error('Error processing pending offer:', e);
                    }
                }

                // Announce arrival to start WebRTC handshake
                if (channelSubscribedRef.current && channelRef.current && currentMatchRef.current) {
                    if (isCaller) {
                        console.log('[WebRTC] Caller announcing peer-arrived...');
                        channelRef.current.send({
                            type: 'broadcast',
                            event: 'peer-arrived',
                            payload: { senderId: user!.id, receiverId: currentMatchRef.current.profile.id }
                        });
                    } else {
                        console.log('[WebRTC] Answerer announcing peer-ready...');
                        channelRef.current.send({
                            type: 'broadcast',
                            event: 'peer-ready',
                            payload: { senderId: user!.id, receiverId: currentMatchRef.current.profile.id }
                        });
                    }
                }

                // Retry handshake up to 6 times if connection has not yet transitioned to connected
                let handshakeTries = 0;
                const handshakeInterval = setInterval(() => {
                    if (
                        peerConnectionRef.current?.iceConnectionState === 'connected' ||
                        peerConnectionRef.current?.connectionState === 'connected' ||
                        handshakeTries >= 6
                    ) {
                        clearInterval(handshakeInterval);
                        return;
                    }
                    handshakeTries++;
                    if (isCallerRef.current && channelRef.current && currentMatchRef.current) {
                        console.log('[WebRTC] Retrying peer-arrived handshake announcement...');
                        channelRef.current.send({
                            type: 'broadcast',
                            event: 'peer-arrived',
                            payload: { senderId: user!.id, receiverId: currentMatchRef.current.profile.id }
                        });
                    }
                }, 1500);

                return () => {
                    clearInterval(handshakeInterval);
                };
            } catch (e) {
                console.error('Failed to capture stream or create RTCPeerConnection:', e);
                alert('Could not access your microphone. Please allow microphone permission and try again.');
            }
        };

        startWebRTC();

        return () => {
            webrtcReadyRef.current = false;
            closeWebRTC();
        };
    }, [inCall, isCaller, currentMatch?.profile?.id]);

    const triggerRenegotiation = async () => {
        const pc = peerConnectionRef.current;
        if (!pc || !channelRef.current || !currentMatchRef.current) return;
        if (!isCallerRef.current) return;

        if (pc.signalingState !== 'stable') {
            console.log('[WebRTC] Signaling state is ' + pc.signalingState + ', queueing renegotiation...');
            renegotiationPendingRef.current = true;
            return;
        }

        renegotiationPendingRef.current = false;
        try {
            console.log('[WebRTC] Initiating renegotiation offer...');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channelRef.current.send({
                type: 'broadcast',
                event: 'webrtc-offer',
                payload: {
                    senderId: user!.id,
                    receiverId: currentMatchRef.current.profile.id,
                    sdp: offer,
                }
            });
        } catch (err) {
            console.error('[WebRTC] Renegotiation offer creation failed:', err);
        }
    };
    triggerRenegotiationRef.current = triggerRenegotiation;

    // Handle video upgrade separately — add video track to existing connection
    useEffect(() => {
        if (videoRequestStatus !== 'accepted') return;
        if (!peerConnectionRef.current || !localStreamRef.current || !user || !currentMatchRef.current) return;
        const pc = peerConnectionRef.current;

        (async () => {
            try {
                let videoTrack = localStreamRef.current?.getVideoTracks().find(t => t.readyState === 'live');
                if (!videoTrack) {
                    console.log('[WebRTC] Acquiring local camera track...');
                    const videoStream = await navigator.mediaDevices.getUserMedia({ 
                        video: { 
                            facingMode: isFrontCamera ? 'user' : 'environment',
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        },
                        audio: false,
                    });
                    videoTrack = videoStream.getVideoTracks()[0];
                    if (videoTrack) {
                        localStreamRef.current?.addTrack(videoTrack);
                    }
                }

                if (videoTrack) {
                    if (localVideoRef.current && localStreamRef.current) {
                        localVideoRef.current.srcObject = localStreamRef.current;
                        localVideoRef.current.muted = true;
                        localVideoRef.current.play().catch(() => {});
                    }

                    const senders = pc.getSenders();
                    const existingVideoSender = senders.find(s => s.track?.kind === 'video');
                    if (existingVideoSender) {
                        await existingVideoSender.replaceTrack(videoTrack);
                    } else {
                        pc.addTrack(videoTrack, localStreamRef.current!);
                    }

                    localVideoReadyRef.current = true;
                    console.log('[WebRTC] Local video track attached, broadcasting video-ready...');

                    channelRef.current?.send({
                        type: 'broadcast',
                        event: 'video-ready',
                        payload: {
                            senderId: user.id,
                            receiverId: currentMatchRef.current.profile.id,
                            isCaller: isCallerRef.current,
                        }
                    });

                    if (isCallerRef.current) {
                        setTimeout(() => {
                            triggerRenegotiationRef.current();
                        }, 300);
                        setTimeout(() => {
                            triggerRenegotiationRef.current();
                        }, 1500);
                    }
                }
            } catch (e) {
                console.error('Failed to add video track:', e);
            }
        })();
    }, [videoRequestStatus, isFrontCamera]);

    // ── Dedicated Continuous Audio Watchdog (Voice & Video) ──
    useEffect(() => {
        if (!inCall) return;

        const syncAudio = () => {
            const pc = peerConnectionRef.current;
            const audioEl = remoteAudioRef.current || (document.getElementById('knock-call-audio') as HTMLAudioElement);
            if (!audioEl) return;

            // 1. Recover remote audio track from remoteAudioStreamRef or pc.getReceivers()
            let aStream = remoteAudioStreamRef.current;
            const hasLiveAudioTrack = aStream && aStream.getAudioTracks().some(t => t.readyState === 'live');

            if (!hasLiveAudioTrack && pc) {
                const receivers = pc.getReceivers();
                const audioReceiver = receivers.find(r => r.track && r.track.kind === 'audio' && r.track.readyState === 'live');
                if (audioReceiver?.track) {
                    aStream = new MediaStream([audioReceiver.track]);
                    remoteAudioStreamRef.current = aStream;
                    console.log('[AudioWatchdog] Re-attached live audio track from receiver:', audioReceiver.track.id);
                }
            }

            // 2. Attach stream if not attached
            if (aStream && audioEl.srcObject !== aStream) {
                console.log('[AudioWatchdog] Attaching audio stream to element');
                audioEl.srcObject = aStream;
            }

            // 3. Ensure volume is 100% and unmuted
            if (audioEl.srcObject) {
                audioEl.volume = 1.0;
                audioEl.muted = false;
                if (audioEl.paused) {
                    audioEl.play().then(() => {
                        setAudioBlocked(false);
                    }).catch(err => {
                        console.warn('[AudioWatchdog] Autoplay blocked, tap required:', err);
                        setAudioBlocked(true);
                    });
                }
            }
        };

        syncAudio();
        const interval = setInterval(syncAudio, 500);
        return () => clearInterval(interval);
    }, [inCall]);

    // ── Global User Gesture Listener to Unmute Autoplay on Touch/Click ──
    useEffect(() => {
        if (!inCall) return;

        const handleUserGesture = () => {
            const audioEl = remoteAudioRef.current || (document.getElementById('knock-call-audio') as HTMLAudioElement);
            if (audioEl && audioEl.srcObject && audioEl.paused) {
                audioEl.volume = 1.0;
                audioEl.muted = false;
                audioEl.play().then(() => {
                    setAudioBlocked(false);
                }).catch(() => {});
            }
        };

        window.addEventListener('click', handleUserGesture, { passive: true });
        window.addEventListener('touchstart', handleUserGesture, { passive: true });
        window.addEventListener('keydown', handleUserGesture, { passive: true });

        return () => {
            window.removeEventListener('click', handleUserGesture);
            window.removeEventListener('touchstart', handleUserGesture);
            window.removeEventListener('keydown', handleUserGesture);
        };
    }, [inCall]);

    // Continuous Watchdog & Stream Attachment for video
    useEffect(() => {
        if (videoRequestStatus !== 'accepted') return;

        const syncStreams = () => {
            const pc = peerConnectionRef.current;

            // 1. Recover any live remote video track directly from pc.getReceivers()
            if (pc) {
                const receivers = pc.getReceivers();
                const remoteVideoTrack = receivers
                    .map(r => r.track)
                    .find(t => t && t.kind === 'video' && t.readyState === 'live');

                if (remoteVideoTrack) {
                    let rStream = remoteStreamRef.current;
                    if (!rStream || !(rStream instanceof MediaStream)) {
                        rStream = new MediaStream();
                        remoteStreamRef.current = rStream;
                    }
                    if (!rStream.getVideoTracks().some(t => t.id === remoteVideoTrack.id)) {
                        rStream.addTrack(remoteVideoTrack);
                    }
                    setHasRemoteVideo(true);
                }
            }

            // 2. Ensure remote video element has the remote video stream attached and playing
            if (remoteVideoRef.current && remoteStreamRef.current && remoteStreamRef.current.getVideoTracks().length > 0) {
                if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
                    remoteVideoRef.current.srcObject = remoteStreamRef.current;
                }
                remoteVideoRef.current.muted = true;
                remoteVideoRef.current.play().catch(() => {});
            }

            // 3. Ensure local video element has local video stream attached and playing
            if (localVideoRef.current && localStreamRef.current && localStreamRef.current.getVideoTracks().length > 0) {
                if (localVideoRef.current.srcObject !== localStreamRef.current) {
                    localVideoRef.current.srcObject = localStreamRef.current;
                }
                localVideoRef.current.muted = true;
                localVideoRef.current.play().catch(() => {});
            }
        };

        syncStreams();
        const interval = setInterval(syncStreams, 800);
        return () => clearInterval(interval);
    }, [videoRequestStatus, hasRemoteVideo, isVideoSwapped]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleTalkMore = () => {
        setRequestStatus('sent');
        if (channelRef.current && currentMatch) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'extend-request',
                payload: {
                    senderId: user!.id,
                    receiverId: currentMatch.profile.id
                }
            });
        }
    };

    const handleRequestVideo = () => {
        setVideoRequestStatus('sent');
        if (channelRef.current && currentMatch) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'video-request',
                payload: {
                    senderId: user!.id,
                    receiverId: currentMatch.profile.id
                }
            });
        }
    };

    // Seamlessly switch from video call back to voice calling
    const switchToVoiceCall = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(track => {
                track.stop();
                localStreamRef.current?.removeTrack(track);
            });
        }
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (remoteStreamRef.current) {
            remoteStreamRef.current.getVideoTracks().forEach(track => {
                track.stop();
                remoteStreamRef.current?.removeTrack(track);
            });
            remoteStreamRef.current = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        setVideoRequestStatus('none');
        setHasRemoteVideo(false);
        localVideoReadyRef.current = false;
        remoteVideoReadyRef.current = false;
        renegotiationPendingRef.current = false;
        setIsVideoSwapped(false);
        setIsCameraOff(false);

        if (channelRef.current && currentMatchRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'switch-to-voice',
                payload: {
                    senderId: user!.id,
                    receiverId: currentMatchRef.current.profile.id
                }
            });
        }
    };

    // Swap the main full screen and PiP corner video (switch their face <-> our face)
    const handleSwapVideos = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setIsVideoSwapped(prev => !prev);
    };

    // Toggle camera on/off
    const handleToggleCamera = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (localStreamRef.current) {
            const videoTracks = localStreamRef.current.getVideoTracks();
            if (videoTracks.length > 0) {
                const newOff = !isCameraOff;
                videoTracks.forEach(track => { track.enabled = !newOff; });
                setIsCameraOff(newOff);
            }
        } else {
            setIsCameraOff(prev => !prev);
        }
    };

    // Flip camera (front <-> back)
    const handleFlipCamera = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const nextFacing = isFrontCamera ? 'environment' : 'user';
        setIsFrontCamera(!isFrontCamera);

        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: nextFacing } },
                audio: false
            });
            const newTrack = newStream.getVideoTracks()[0];
            if (newTrack) {
                if (peerConnectionRef.current) {
                    const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        await sender.replaceTrack(newTrack);
                    }
                }
                if (localStreamRef.current) {
                    const oldTrack = localStreamRef.current.getVideoTracks()[0];
                    if (oldTrack) {
                        oldTrack.stop();
                        localStreamRef.current.removeTrack(oldTrack);
                    }
                    localStreamRef.current.addTrack(newTrack);
                }
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = localStreamRef.current;
                }
            }
        } catch (err) {
            console.error('Failed to flip camera:', err);
        }
    };

    // Toggle auto-hiding controls on tap
    const handleVideoAreaTap = () => {
        setShowVideoControls(prev => {
            const nextState = !prev;
            if (nextState) {
                if (videoControlsTimeoutRef.current) clearTimeout(videoControlsTimeoutRef.current);
                videoControlsTimeoutRef.current = setTimeout(() => setShowVideoControls(false), 5000);
            }
            return nextState;
        });
    };

    const handleConnect = async () => {
        if (!user || !currentMatch || connectionState === 'connecting' || connectionState === 'connected') return;
        setConnectionState('connecting');
        
        const existing = await checkConnection(user.id, currentMatch.profile.id);
        if (existing) {
            setConnectionState('already');
            return;
        }

        const { error } = await createConnection(
            user.id,
            currentMatch.profile.id,
            currentMatch.compatibilityPercent,
            currentMatch.sharedLikes,
            'voice_call'
        );

        if (!error) {
            setConnectionState('connected');
            setShowConnectionToast(true);
            setTimeout(() => setShowConnectionToast(false), 4000);
        } else {
            setConnectionState('none');
        }
    };

    const findAndInviteMatch = () => {
        if (!isSearchingRef.current || !user) return false;

        const match = onlineUsersRef.current.find(u => {
            if (u.user_id === user.id) return false;
            if (blockedIds.includes(u.user_id)) return false;
            if (u.status !== 'searching') return false;

            if (activePrefRef.current === 'Boy to Girl 👦') {
                if (u.gender !== 'female') return false;
            } else if (activePrefRef.current === 'Girl to Boy 👧') {
                if (u.gender !== 'male') return false;
            }

            if (u.preference === 'Boy to Girl 👦') {
                if (user.gender !== 'female') return false;
            } else if (u.preference === 'Girl to Boy 👧') {
                if (user.gender !== 'male') return false;
            }

            return true;
        });

        if (match) {
            pendingInviteRef.current = match.user_id;
            const compat = Math.floor(Math.random() * 20) + 80;
            const shared = Math.floor(Math.random() * 4) + 1;

            channelRef.current?.send({
                type: 'broadcast',
                event: 'call-invite',
                payload: {
                    callerId: user.id,
                    receiverId: match.user_id,
                    callerProfile: {
                        id: user.id,
                        username: user.username,
                        name: user.name,
                        avatar_url: user.avatar_url,
                        gender: user.gender,
                        points: user.points,
                    },
                    compatibilityPercent: compat,
                    sharedLikes: shared,
                    totalLikes: 5
                }
            });
            return true;
        }
        return false;
    };

    const cancelSearch = async () => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
            searchTimeoutRef.current = null;
        }
        setIsSearching(false);
        setNoMatchFound(false);
        await updatePresence('idle');
    };

    const startSearch = async () => {
        if (!user) return;
        stopMicTest();
        setIsSearching(true);
        setNoMatchFound(false);
        setShowMatchCard(false);
        setIsCaller(false);

        await updatePresence('searching');

        const onlineMatch = findAndInviteMatch();
        if (!onlineMatch) {
            // Keep searching for real online users — set a 60-second status reminder
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
            searchTimeoutRef.current = window.setTimeout(() => {
                if (isSearchingRef.current) {
                    setIsSearching(false);
                    setNoMatchFound(true);
                    updatePresence('idle');
                }
            }, 60000);
        }
    };

    // Periodically re-check for searching peers while radar is active
    useEffect(() => {
        if (!isSearching) return;
        const interval = setInterval(() => {
            if (isSearchingRef.current && !inCallRef.current) {
                findAndInviteMatch();
            }
        }, 2500);
        return () => clearInterval(interval);
    }, [isSearching]);

    const connectToMatch = async () => {
        stopMicTest();
        setShowMatchCard(false);
        setInCall(true);
        playCallConnectedChime();
        await updatePresence('in-call');
    };

    const skipToNext = () => {
        if (currentMatchRef.current && channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'call-end',
                payload: {
                    senderId: user!.id,
                    receiverId: currentMatchRef.current.profile.id
                }
            });
        }
        closeWebRTC();
        resetCallStates();
        startSearch();
    };

    const endCall = () => {
        playCallEndChime();
        if (currentMatchRef.current && channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'call-end',
                payload: {
                    senderId: user!.id,
                    receiverId: currentMatchRef.current.profile.id
                }
            });
        }
        closeWebRTC();
        setInCall(false);
        setShowMatchCard(false);
        setIsSearching(false);
        resetCallStates();
        updatePresence('idle');
    };

    const resetCallStates = () => {
        setIsMuted(false);
        setCallDuration(0);
        setRequestStatus('none');
        setVideoRequestStatus('none');
        setConnectionState('none');
        setShowConnectionToast(false);
        setShowChat(false);
        setChatMessages([]);
        setIncomingExtensionRequest(false);
        setIncomingVideoRequest(false);
        setIsCaller(false);
        setAudioBlocked(false);
        setPeerConnected(false);
        setHasRemoteVideo(false);
        localVideoReadyRef.current = false;
        remoteVideoReadyRef.current = false;
        renegotiationPendingRef.current = false;
        setIsVideoSwapped(false);
        setIsCameraOff(false);
        setIsFrontCamera(true);
        setShowVideoControls(true);
        pendingInviteRef.current = null;
        pendingOfferRef.current = null;
        pendingIceCandidatesRef.current = [];
        webrtcReadyRef.current = false;
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
            searchTimeoutRef.current = null;
        }
        if (videoControlsTimeoutRef.current) {
            clearTimeout(videoControlsTimeoutRef.current);
            videoControlsTimeoutRef.current = null;
        }
    };

    const goBack = () => {
        endCall();
        setMatches([]);
        setCurrentMatchIndex(0);
        setNoMatchFound(false);
    };

    // Automatically adapt target language to partner or default pair (en <-> es)
    useEffect(() => {
        const partnerLang = (currentMatch?.profile as any)?.preferred_language;
        if (partnerLang && partnerLang !== myChatLanguage) {
            setTargetChatLanguage(partnerLang);
        } else if (myChatLanguage === 'en') {
            setTargetChatLanguage('es');
        } else {
            setTargetChatLanguage('en');
        }
    }, [currentMatch?.profile, myChatLanguage]);

    // Debounced live translation preview as user types
    useEffect(() => {
        if (!chatInput.trim() || !autoTranslateChat || myChatLanguage === targetChatLanguage) {
            setLiveTranslationPreview('');
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await translateText(chatInput, targetChatLanguage, myChatLanguage);
                if (res.translatedText && res.translatedText.toLowerCase() !== chatInput.toLowerCase()) {
                    setLiveTranslationPreview(res.translatedText);
                } else {
                    setLiveTranslationPreview('');
                }
            } catch {
                setLiveTranslationPreview('');
            }
        }, 350);

        return () => clearTimeout(timer);
    }, [chatInput, autoTranslateChat, myChatLanguage, targetChatLanguage]);

    const sendChatMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!chatInput.trim()) return;

        const msgId = Date.now();
        const rawText = chatInput.trim();
        setChatInput('');
        setLiveTranslationPreview('');

        let translated = '';
        let isTranslated = false;

        if (autoTranslateChat && myChatLanguage !== targetChatLanguage) {
            try {
                const res = await translateText(rawText, targetChatLanguage, myChatLanguage);
                if (res.translatedText && res.translatedText.toLowerCase() !== rawText.toLowerCase()) {
                    translated = res.translatedText;
                    isTranslated = true;
                }
            } catch (err) {
                console.warn('[Translate] Send-time translation failed:', err);
            }
        }

        const newMsg: CallChatMessage = {
            id: msgId,
            text: rawText,
            isMine: true,
            originalText: rawText,
            translatedText: translated || undefined,
            senderLang: myChatLanguage,
            targetLang: targetChatLanguage,
            isTranslated: isTranslated,
        };

        setChatMessages(prev => [...prev, newMsg]);

        if (channelRef.current && currentMatch) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'chat-message',
                payload: {
                    id: msgId,
                    senderId: user!.id,
                    receiverId: currentMatch.profile.id,
                    text: rawText,
                    originalText: rawText,
                    translatedText: translated,
                    senderLang: myChatLanguage,
                    targetLang: targetChatLanguage,
                    isTranslated: isTranslated,
                }
            });
        }
    };

    const handleTranslateMessage = async (msgId: number, textToTranslate: string) => {
        setTranslatingMsgIds(prev => ({ ...prev, [msgId]: true }));
        try {
            const res = await translateText(textToTranslate, myChatLanguage, 'auto');
            setChatMessages(prev => prev.map(m => {
                if (m.id === msgId) {
                    return {
                        ...m,
                        translatedText: res.translatedText,
                        isTranslated: true,
                        text: res.translatedText,
                    };
                }
                return m;
            }));
        } catch (e) {
            console.error('On-demand message translation failed:', e);
        } finally {
            setTranslatingMsgIds(prev => ({ ...prev, [msgId]: false }));
        }
    };

    const toggleShowOriginal = (msgId: number) => {
        setShowOriginalMap(prev => ({ ...prev, [msgId]: !prev[msgId] }));
    };

    const handleSwapLanguages = () => {
        const temp = myChatLanguage;
        setMyChatLanguage(targetChatLanguage);
        setTargetChatLanguage(temp);
        setUserLanguage(targetChatLanguage);
    };

    const handleDeleteChatMessage = (messageId: number) => {
        setChatMessages(prev => prev.filter(m => m.id !== messageId));

        if (channelRef.current && currentMatchRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'chat-delete',
                payload: {
                    messageId,
                    senderId: user!.id,
                    receiverId: currentMatchRef.current.profile.id,
                }
            });
        }

        setFloatingSubtitle(prev => (prev && Date.now() - prev.time < 5500 ? null : prev));
    };

    const isRevealed = isDirectCall || requestStatus === 'accepted';
    const displayName = currentMatch ? (isRevealed ? currentMatch.profile.name : "Mystery Match") : "";
    const displayUsername = currentMatch ? (isRevealed ? currentMatch.profile.username : "anonymous") : "";
    const displayAvatar = currentMatch ? (isRevealed ? (currentMatch.profile.avatar_url || `https://i.pravatar.cc/300?u=${currentMatch.profile.username}`) : "https://api.dicebear.com/7.x/avataaars/svg?seed=mystery&backgroundColor=ff3366") : "";

    // ── Active Call Screen ──
    if (inCall && currentMatch) {
        return (
            <>
                {/* Persistent audio element for WebRTC audio - never unmounts between voice and video */}
                <audio
                    id="knock-call-audio"
                    ref={remoteAudioRef}
                    autoPlay
                    playsInline
                    style={{ position: 'fixed', bottom: 0, left: 0, width: 1, height: 1, opacity: 0.01, pointerEvents: 'none', zIndex: -1 }}
                />

                {videoRequestStatus === 'accepted' ? (
                    // ════════════════════════════════════════════════════════════
                    // ── WHATSAPP-STYLE FULL-SCREEN VIDEO CALL ──
                    // ════════════════════════════════════════════════════════════
                    <div
                        className="whatsapp-video-screen"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        background: '#0b141a',
                        width: '100vw',
                        height: '100dvh',
                        overflow: 'hidden',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                    }}
                    onClick={handleVideoAreaTap}
                >
                    {/* ── WHATSAPP PERSISTENT DUAL-STAGE VIDEO ── */}
                    {/* Remote Video Container: Fullscreen when !isVideoSwapped, PiP when isVideoSwapped */}
                    <div
                        style={
                            !isVideoSwapped
                                ? { position: 'absolute', inset: 0, overflow: 'hidden', background: '#0b141a', zIndex: 1 }
                                : {
                                      position: 'absolute',
                                      top: 'max(env(safe-area-inset-top, 16px), 24px)',
                                      right: '16px',
                                      width: '115px',
                                      height: '165px',
                                      borderRadius: '16px',
                                      overflow: 'hidden',
                                      border: '2.5px solid rgba(255,255,255,0.35)',
                                      boxShadow: '0 12px 36px rgba(0,0,0,0.75)',
                                      zIndex: 60,
                                      cursor: 'pointer',
                                      background: '#111b21',
                                      transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                  }
                        }
                        onClick={isVideoSwapped ? handleSwapVideos : undefined}
                    >
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block'
                            }}
                        />
                        {!hasRemoteVideo && (
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#111b21',
                                gap: isVideoSwapped ? '8px' : '16px',
                                zIndex: 2,
                            }}>
                                <div style={{ position: 'relative' }}>
                                    <div style={{
                                        position: 'absolute',
                                        inset: -6,
                                        borderRadius: '50%',
                                        background: 'rgba(37,211,102,0.3)',
                                        animation: 'pulse 1.8s infinite',
                                    }} />
                                    <img
                                        src={displayAvatar}
                                        alt={displayName}
                                        style={{
                                            width: isVideoSwapped ? '48px' : '96px',
                                            height: isVideoSwapped ? '48px' : '96px',
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                            border: '2px solid rgba(255,255,255,0.3)',
                                            position: 'relative',
                                            zIndex: 2
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.85)', fontSize: isVideoSwapped ? '0.65rem' : '0.9rem', textAlign: 'center', padding: '0 8px' }}>
                                    <Loader2 size={isVideoSwapped ? 12 : 16} style={{ animation: 'spin 1.2s linear infinite' }} />
                                    <span>Connecting {displayName}...</span>
                                </div>
                            </div>
                        )}
                        {isVideoSwapped && (
                            <>
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                    padding: '4px 6px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                    color: '#fff', fontSize: '0.7rem', fontWeight: 600, textAlign: 'center',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                }}>
                                    {displayName}
                                </div>
                                <div style={{
                                    position: 'absolute', bottom: '8px', right: '8px',
                                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px',
                                    padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '3px', zIndex: 10
                                }}>
                                    <RefreshCw size={10} color="#fff" />
                                    <span style={{ color: '#fff', fontSize: '0.65rem', fontWeight: 600 }}>Swap</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Local Video Container: PiP when !isVideoSwapped, Fullscreen when isVideoSwapped */}
                    <div
                        style={
                            isVideoSwapped
                                ? { position: 'absolute', inset: 0, overflow: 'hidden', background: '#0b141a', zIndex: 1 }
                                : {
                                      position: 'absolute',
                                      top: 'max(env(safe-area-inset-top, 16px), 24px)',
                                      right: '16px',
                                      width: '115px',
                                      height: '165px',
                                      borderRadius: '16px',
                                      overflow: 'hidden',
                                      border: '2.5px solid rgba(255,255,255,0.35)',
                                      boxShadow: '0 12px 36px rgba(0,0,0,0.75)',
                                      zIndex: 60,
                                      cursor: 'pointer',
                                      background: '#111b21',
                                      transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                  }
                        }
                        onClick={!isVideoSwapped ? handleSwapVideos : undefined}
                    >
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: isCameraOff ? 'none' : 'block',
                                transform: isFrontCamera ? 'scaleX(-1)' : 'none'
                            }}
                        />
                        {isCameraOff && (
                            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111b21', gap: isVideoSwapped ? '16px' : '4px' }}>
                                <img src={user?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'} alt="You" style={{ width: isVideoSwapped ? '120px' : '48px', height: isVideoSwapped ? '120px' : '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }} />
                                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: isVideoSwapped ? '1rem' : '0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CameraOff size={isVideoSwapped ? 20 : 14} color="#ff3b30" /> Camera is off
                                </div>
                            </div>
                        )}
                        {!isVideoSwapped && (
                            <div style={{
                                position: 'absolute', bottom: '8px', right: '8px',
                                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px',
                                padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '3px', zIndex: 10
                            }}>
                                <RefreshCw size={10} color="#fff" />
                                <span style={{ color: '#fff', fontSize: '0.65rem', fontWeight: 600 }}>Swap</span>
                            </div>
                        )}
                    </div>

                    {/* Top & Bottom gradient scrims for contrast */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '140px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)', pointerEvents: 'none', zIndex: 10 }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '220px', background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)', pointerEvents: 'none', zIndex: 10 }} />

                    {/* ── TOP HEADER BAR (WhatsApp Style) ── */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        padding: 'max(env(safe-area-inset-top, 16px), 20px) 16px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        opacity: showVideoControls ? 1 : 0,
                        transform: showVideoControls ? 'translateY(0)' : 'translateY(-15px)',
                        transition: 'opacity 0.3s ease, transform 0.3s ease',
                        pointerEvents: showVideoControls ? 'auto' : 'none',
                    }}>
                        {/* Left: Back / Minimize to Voice Button */}
                        <button
                            onClick={switchToVoiceCall}
                            title="Switch to Voice Calling"
                            style={{
                                background: 'rgba(255,255,255,0.12)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#fff',
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                            }}
                        >
                            <ChevronLeft size={22} />
                        </button>

                        {/* Center: Contact Info & Duration */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: '0 12px' }}>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem', textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
                                {displayName}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.5px' }}>
                                    {formatTime(callDuration)}
                                </span>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>•</span>
                                <span style={{ color: '#25D366', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    🔒 Encrypted
                                </span>
                            </div>
                        </div>

                        {/* Right: Quick Voice Switch Pill */}
                        <button
                            onClick={switchToVoiceCall}
                            style={{
                                background: 'rgba(255, 51, 102, 0.25)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255, 51, 102, 0.4)',
                                color: '#fff',
                                padding: '6px 12px',
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 600
                            }}
                        >
                            <Mic size={14} color="#ff3366" />
                            <span>Voice Call</span>
                        </button>
                    </div>

                    {/* ── INCOMING / SYSTEM NOTIFICATIONS ── */}
                    {showConnectionToast && (
                        <div style={{ position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 200 }}>
                            <div className="connection-toast-inner">
                                <Flame size={20} className="streak-icon-active" />
                                <div>
                                    <strong>Connected with {displayName}!</strong>
                                    <span>🔥 Streak started — Day 1!</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {incomingExtensionRequest && (
                        <div style={{
                            position: 'absolute',
                            top: '85px',
                            left: '16px',
                            right: '16px',
                            zIndex: 200,
                            background: 'rgba(24, 34, 41, 0.95)',
                            backdropFilter: 'blur(16px)',
                            borderRadius: '16px',
                            padding: '16px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            boxShadow: '0 12px 30px rgba(0,0,0,0.6)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <Clock size={20} color="#facc15" />
                                <span style={{ color: '#fff', fontWeight: 700 }}>{displayName} requested more time!</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className="pill active"
                                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setRequestStatus('accepted');
                                        setIncomingExtensionRequest(false);
                                        if (channelRef.current) {
                                            channelRef.current.send({
                                                type: 'broadcast',
                                                event: 'extend-response',
                                                payload: { senderId: user!.id, receiverId: currentMatch.profile.id, accepted: true }
                                            });
                                        }
                                    }}
                                >
                                    Accept
                                </button>
                                <button
                                    className="pill"
                                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem', backgroundColor: '#333' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIncomingExtensionRequest(false);
                                        if (channelRef.current) {
                                            channelRef.current.send({
                                                type: 'broadcast',
                                                event: 'extend-response',
                                                payload: { senderId: user!.id, receiverId: currentMatch.profile.id, accepted: false }
                                            });
                                        }
                                    }}
                                >
                                    Decline
                                </button>
                            </div>
                        </div>
                    )}


                    {audioBlocked && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                const audioEl = remoteAudioRef.current || (document.getElementById('knock-call-audio') as HTMLAudioElement);
                                if (audioEl) {
                                    audioEl.volume = 1.0;
                                    audioEl.muted = false;
                                    audioEl.play().then(() => setAudioBlocked(false)).catch(() => {});
                                }
                            }}
                            style={{
                                position: 'absolute',
                                top: '80px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'rgba(255,59,48,0.92)',
                                color: '#fff',
                                padding: '10px 20px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                zIndex: 200,
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                textAlign: 'center',
                                boxShadow: '0 4px 16px rgba(255,59,48,0.4)',
                                animation: 'sparkle-pulse 1.5s ease-in-out infinite'
                            }}
                        >
                            🔇 Tap here to unmute audio
                        </div>
                    )}

                    {/* ── WHATSAPP BOTTOM CONTROLS ── */}
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        padding: '16px 20px max(env(safe-area-inset-bottom, 24px), 30px)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '16px',
                        opacity: showVideoControls ? 1 : 0,
                        transform: showVideoControls ? 'translateY(0)' : 'translateY(20px)',
                        transition: 'opacity 0.3s ease, transform 0.3s ease',
                        pointerEvents: showVideoControls ? 'auto' : 'none',
                    }}>
                        {/* Top action row: Chat & Connect */}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowChat(!showChat); }}
                                style={{
                                    background: showChat ? 'var(--primary-color)' : 'rgba(255,255,255,0.18)',
                                    backdropFilter: 'blur(16px)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    color: '#fff',
                                    borderRadius: '24px',
                                    padding: '8px 16px',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                <MessageSquare size={16} /> Chat
                            </button>

                            <button
                                onClick={(e) => { e.stopPropagation(); handleConnect(); }}
                                disabled={connectionState === 'connecting' || connectionState === 'connected' || connectionState === 'already'}
                                style={{
                                    background: connectionState === 'connected' || connectionState === 'already' ? 'rgba(37,211,102,0.35)' : 'rgba(255,255,255,0.18)',
                                    backdropFilter: 'blur(16px)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    color: '#fff',
                                    borderRadius: '24px',
                                    padding: '8px 16px',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: 'pointer',
                                    opacity: (connectionState === 'connecting' || connectionState === 'connected' || connectionState === 'already') ? 0.8 : 1,
                                }}
                            >
                                <Link2 size={16} />
                                {connectionState === 'connected' ? 'Connected 🤝' : connectionState === 'already' ? 'Already Connected' : connectionState === 'connecting' ? 'Connecting...' : 'Connect 🤝'}
                            </button>

                            {requestStatus === 'none' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleTalkMore(); }}
                                    style={{
                                        background: 'rgba(250,204,21,0.25)',
                                        backdropFilter: 'blur(16px)',
                                        border: '1px solid rgba(250,204,21,0.4)',
                                        color: '#facc15',
                                        borderRadius: '24px',
                                        padding: '8px 16px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Clock size={16} /> +Time
                                </button>
                            )}
                        </div>

                        {/* WhatsApp Pill Toolbar */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '16px',
                            background: 'rgba(17, 27, 33, 0.82)',
                            backdropFilter: 'blur(25px)',
                            padding: '12px 24px',
                            borderRadius: '40px',
                            border: '1px solid rgba(255,255,255,0.12)',
                            boxShadow: '0 16px 40px rgba(0,0,0,0.65)'
                        }}>
                            {/* 1. Switch to Voice Calling (Voice Roulette Mode) */}
                            <button
                                onClick={switchToVoiceCall}
                                title="Switch to Voice Call"
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.16)',
                                    border: 'none',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#fff',
                                    transition: 'transform 0.15s ease'
                                }}
                            >
                                <Phone size={20} color="#34C759" />
                            </button>

                            {/* 2. Flip Camera (Front <-> Back) */}
                            <button
                                onClick={handleFlipCamera}
                                title="Flip Camera"
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.16)',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#fff',
                                    transition: 'transform 0.15s ease'
                                }}
                            >
                                <RefreshCw size={20} />
                            </button>

                            {/* 3. Camera On / Off */}
                            <button
                                onClick={handleToggleCamera}
                                title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    background: isCameraOff ? '#ff3b30' : 'rgba(255,255,255,0.16)',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#fff',
                                    transition: 'background 0.2s ease'
                                }}
                            >
                                {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                            </button>

                            {/* 4. Mic Mute / Unmute */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newMuted = !isMuted;
                                    setIsMuted(newMuted);
                                    if (localStreamRef.current) {
                                        localStreamRef.current.getAudioTracks().forEach(track => {
                                            track.enabled = !newMuted;
                                        });
                                    }
                                }}
                                title={isMuted ? 'Unmute' : 'Mute'}
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    background: isMuted ? '#ff3b30' : 'rgba(255,255,255,0.16)',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#fff',
                                    transition: 'background 0.2s ease'
                                }}
                            >
                                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                            </button>

                            {/* 5. WhatsApp Prominent Red End Call Button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); endCall(); }}
                                title="End Call"
                                style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    background: '#ea0038',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#fff',
                                    boxShadow: '0 6px 20px rgba(234, 0, 56, 0.45)',
                                    transform: 'scale(1.05)',
                                    transition: 'transform 0.15s ease'
                                }}
                            >
                                <PhoneOff size={24} />
                            </button>

                            {/* 6. Skip to Next Match */}
                            <button
                                onClick={(e) => { e.stopPropagation(); skipToNext(); }}
                                title="Skip to next"
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.16)',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#fff'
                                }}
                            >
                                <SkipForward size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Floating In-Call Subtitle Toast (Translated incoming messages) */}
                    {floatingSubtitle && (Date.now() - floatingSubtitle.time < 5500) && (
                        <div
                            onClick={() => setShowChat(true)}
                            style={{
                                position: 'absolute',
                                top: '80px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'rgba(20, 20, 28, 0.94)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(255, 255, 255, 0.22)',
                                padding: '10px 18px',
                                borderRadius: '24px',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                zIndex: 350,
                                boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
                                maxWidth: '90%',
                                cursor: 'pointer',
                                animation: 'slideDown 0.3s ease',
                            }}
                        >
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #007aff, #34C759)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                fontSize: '1rem'
                            }}>
                                💬
                            </div>
                            <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: 600, color: '#fff' }}>{floatingSubtitle.senderName}</span>
                                    {floatingSubtitle.isTranslated && (
                                        <span style={{ color: '#34C759', fontWeight: 600 }}>
                                            • 🌐 {getLanguage(floatingSubtitle.senderLang || 'auto').flag} → {getLanguage(floatingSubtitle.targetLang || 'en').flag}
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    "{floatingSubtitle.text}"
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Chat Drawer Overlay */}
                    {showChat && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                position: 'absolute',
                                bottom: '160px',
                                left: '16px',
                                right: '16px',
                                height: '420px',
                                backgroundColor: 'rgba(17, 27, 33, 0.96)',
                                backdropFilter: 'blur(20px)',
                                borderRadius: '20px',
                                border: '1px solid rgba(255,255,255,0.14)',
                                display: 'flex',
                                flexDirection: 'column',
                                zIndex: 100,
                                boxShadow: '0 24px 60px rgba(0,0,0,0.7)'
                            }}
                        >
                            {/* Chat Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>Chat with {displayName}</span>
                                <button onClick={() => setShowChat(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '6px', color: '#fff', cursor: 'pointer' }}>
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Language Translation Toolbar */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                background: 'rgba(255, 255, 255, 0.04)',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                fontSize: '0.78rem',
                                flexWrap: 'wrap',
                                gap: '6px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: '14px', padding: '3px 8px' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.6)', marginRight: '4px' }}>Me:</span>
                                        <select
                                            value={myChatLanguage}
                                            onChange={(e) => {
                                                setMyChatLanguage(e.target.value);
                                                setUserLanguage(e.target.value);
                                            }}
                                            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.78rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                                        >
                                            {SUPPORTED_LANGUAGES.map(l => (
                                                <option key={l.code} value={l.code} style={{ background: '#1c1c1e', color: '#fff' }}>
                                                    {l.flag} {l.nativeName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleSwapLanguages}
                                        title="Swap Languages"
                                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
                                    >
                                        <ArrowLeftRight size={12} />
                                    </button>

                                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: '14px', padding: '3px 8px' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.6)', marginRight: '4px' }}>To:</span>
                                        <select
                                            value={targetChatLanguage}
                                            onChange={(e) => setTargetChatLanguage(e.target.value)}
                                            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.78rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                                        >
                                            {SUPPORTED_LANGUAGES.map(l => (
                                                <option key={l.code} value={l.code} style={{ background: '#1c1c1e', color: '#fff' }}>
                                                    {l.flag} {l.nativeName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setAutoTranslateChat(!autoTranslateChat)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 10px',
                                        borderRadius: '14px',
                                        border: autoTranslateChat ? '1px solid #34C759' : '1px solid rgba(255,255,255,0.2)',
                                        background: autoTranslateChat ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255,255,255,0.06)',
                                        color: autoTranslateChat ? '#34C759' : 'rgba(255,255,255,0.6)',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Globe size={13} />
                                    <span>{autoTranslateChat ? 'Auto-Translate ON' : 'Translate OFF'}</span>
                                </button>
                            </div>

                            {/* Message List */}
                            <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {chatMessages.length === 0 && (
                                    <p style={{ textAlign: 'center', color: '#8696a0', marginTop: 'auto', marginBottom: 'auto', fontSize: '0.85rem' }}>
                                        Say hi! 👋 Messages are translated in real-time.
                                    </p>
                                )}
                                {chatMessages.map(msg => {
                                    const showOriginal = Boolean(showOriginalMap[msg.id]);
                                    const isTranslating = Boolean(translatingMsgIds[msg.id]);
                                    const textToDisplay = (msg.isTranslated && showOriginal)
                                        ? (msg.originalText || msg.text)
                                        : (msg.translatedText || msg.text);

                                    return (
                                        <div
                                            key={msg.id}
                                            style={{
                                                alignSelf: msg.isMine ? 'flex-end' : 'flex-start',
                                                background: msg.isMine ? '#005c4b' : '#202c33',
                                                color: '#e9edef',
                                                padding: '8px 14px',
                                                borderRadius: '14px',
                                                maxWidth: '82%',
                                                fontSize: '0.9rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '4px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                                <div style={{ wordBreak: 'break-word', lineHeight: 1.4, flex: 1 }}>
                                                    {textToDisplay}
                                                </div>
                                                {msg.isMine && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteChatMessage(msg.id);
                                                        }}
                                                        title="Delete sent text"
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: 'rgba(255,255,255,0.5)',
                                                            cursor: 'pointer',
                                                            padding: '2px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'color 0.15s ease',
                                                            flexShrink: 0,
                                                            marginTop: '2px',
                                                        }}
                                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ff3b30')}
                                                        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </div>

                                            {msg.isTranslated ? (
                                                <div
                                                    onClick={() => toggleShowOriginal(msg.id)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '0.68rem',
                                                        color: '#8696a0',
                                                        cursor: 'pointer',
                                                        marginTop: '2px',
                                                        userSelect: 'none',
                                                    }}
                                                >
                                                    <span>🌐</span>
                                                    <span>{showOriginal ? 'Showing original (Tap for translation)' : `Translated (Tap for original ${msg.senderLang?.toUpperCase() || ''})`}</span>
                                                </div>
                                            ) : !msg.isMine && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleTranslateMessage(msg.id, msg.text)}
                                                    disabled={isTranslating}
                                                    style={{
                                                        alignSelf: 'flex-start',
                                                        background: 'rgba(255,255,255,0.12)',
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        padding: '2px 8px',
                                                        color: '#fff',
                                                        fontSize: '0.68rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        marginTop: '2px'
                                                    }}
                                                >
                                                    <Globe size={10} />
                                                    {isTranslating ? 'Translating...' : `Translate to ${getLanguage(myChatLanguage).name}`}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Live Translation Preview */}
                            {liveTranslationPreview && (
                                <div style={{
                                    padding: '6px 14px',
                                    background: 'rgba(52, 199, 89, 0.15)',
                                    borderTop: '1px solid rgba(52, 199, 89, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '0.78rem',
                                    color: '#34C759',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        <span>🌐 {getLanguage(targetChatLanguage).flag}:</span>
                                        <span style={{ fontStyle: 'italic', color: '#e8f5e9' }}>"{liveTranslationPreview}"</span>
                                    </div>
                                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Auto-Translating</span>
                                </div>
                            )}

                            {/* Input Form */}
                            <form onSubmit={sendChatMessage} style={{ display: 'flex', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', gap: '8px' }}>
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder={autoTranslateChat ? `Type in ${getLanguage(myChatLanguage).nativeName}...` : "Type a message..."}
                                    style={{ flex: 1, background: '#2a3942', border: 'none', padding: '10px 16px', borderRadius: '20px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                                />
                                <button
                                    type="submit"
                                    style={{
                                        background: autoTranslateChat ? 'linear-gradient(135deg, #00a884, #007aff)' : '#00a884',
                                        border: 'none',
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        flexShrink: 0
                                    }}
                                    title={autoTranslateChat ? "Translate & Send" : "Send"}
                                >
                                    <Send size={18} />
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            ) : (
                // ════════════════════════════════════════════════════════════
                // ── VOICE CALL LAYOUT (Roulette / Voice Space) ──
                // ════════════════════════════════════════════════════════════
                <div className="call-active-screen" style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100dvh' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, width: '100%', minHeight: 'min-content', padding: '24px 0' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <div style={{
                                position: 'absolute',
                                inset: -12,
                                borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(255, 51, 102, 0.3) 0%, rgba(245, 165, 36, 0.05) 70%, transparent 100%)',
                                animation: 'voiceAuraPulse 2s ease-in-out infinite',
                                pointerEvents: 'none'
                            }} />
                            <img
                                src={displayAvatar}
                                alt={displayUsername}
                                className="call-avatar"
                                style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(255,51,102,0.5)', position: 'relative', zIndex: 2 }}
                            />
                        </div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '4px', marginTop: '16px' }}>
                            {displayName}
                        </h2>
                        <p className="text-gray-400" style={{ fontSize: '1rem', marginBottom: '12px' }}>
                            @{displayUsername}
                        </p>
                        <div className="match-compat-inline" style={{ background: 'rgba(255, 51, 102, 0.1)', padding: '6px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Heart size={14} fill="#ff3366" color="#ff3366" />
                            <span style={{ fontWeight: 600, color: '#ff3366' }}>{currentMatch.compatibilityPercent}% Compatible</span>
                            <span className="match-compat-dot" style={{ color: '#ff3366' }}>•</span>
                            <span style={{ color: '#ff3366' }}>{currentMatch.sharedLikes} shared likes</span>
                        </div>

                        {/* Connection Status Indicator */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '6px 14px', borderRadius: '20px', marginTop: '8px',
                            background: peerConnected ? 'rgba(52,199,89,0.15)' : 'rgba(250,204,21,0.15)',
                        }}>
                            <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: peerConnected ? '#34C759' : '#facc15',
                                boxShadow: peerConnected ? '0 0 8px #34C759' : '0 0 8px #facc15',
                                animation: peerConnected ? 'none' : 'pulse 1.5s ease-in-out infinite',
                            }} />
                            <span style={{
                                fontSize: '0.8rem', fontWeight: 600,
                                color: peerConnected ? '#34C759' : '#facc15',
                            }}>
                                {peerConnected ? '🎙️ Voice Connected' : '⏳ Connecting voice...'}
                            </span>
                        </div>

                        <div className="mt-8" style={{ textAlign: 'center' }}>
                            <div className={`text-6xl font-mono tracking-wider ${requestStatus !== 'accepted' && callDuration >= 150 ? 'text-red-500 animate-pulse' : 'text-white'}`} style={{ textShadow: '0 4px 12px rgba(0,0,0,0.5)', fontWeight: 'bold' }}>
                                {requestStatus === 'accepted' ? formatTime(callDuration) : formatTime(Math.max(0, 180 - callDuration))}
                            </div>
                            {requestStatus !== 'accepted' ? (
                                <span style={{ display: 'block', fontSize: '1rem', color: '#facc15', marginTop: '12px', fontWeight: 600 }}>
                                    Time Remaining
                                </span>
                            ) : (
                                <span style={{ display: 'block', fontSize: '1rem', color: '#34d399', marginTop: '12px', fontWeight: 600 }}>
                                    Unlimited Time
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Status and Action Buttons & Call Controls Stacked */}
                <div style={{ paddingBottom: '24px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 10, width: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
                        {requestStatus === 'none' && (
                            <button className="premium-btn" style={{ fontSize: '0.9rem', padding: '10px 20px' }} onClick={handleTalkMore}>
                                <Clock size={16} style={{ marginRight: '8px' }} /> Request More Time
                            </button>
                        )}
                        {requestStatus === 'sent' && (
                            <div style={{ color: '#facc15', fontSize: '0.85rem', animation: 'sparkle-pulse 1.5s ease-in-out infinite' }}>
                                Waiting for them to accept more time...
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', background: 'rgba(0,0,0,0.5)', padding: '16px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                            {requestStatus === 'accepted' && (
                                <span style={{ color: '#34C759', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>✨ Voice Call Extended (No Time Limit!)</span>
                            )}
                            
                            {/* Switch to Video Call Button */}
                            {videoRequestStatus === 'none' && (
                                <button
                                    className="pill active"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 18px', background: 'linear-gradient(135deg, #ff3366, #ff9933)' }}
                                    onClick={handleRequestVideo}
                                >
                                    <Video size={16} /> Switch to Video Call 📹
                                </button>
                            )}
                            {videoRequestStatus === 'sent' && (
                                <span style={{ color: '#facc15', fontSize: '0.85rem', animation: 'sparkle-pulse 1.5s ease-in-out infinite' }}>
                                    Waiting for them to accept video...
                                </span>
                            )}

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                <button
                                    className="pill"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 16px', backgroundColor: showChat ? 'var(--primary-color)' : '' }}
                                    onClick={() => setShowChat(!showChat)}
                                >
                                    <MessageSquare size={16} /> Chat
                                </button>
                                <button
                                    className={`pill connect-btn-call ${connectionState === 'connected' || connectionState === 'already' ? 'connected' : ''}`}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 16px' }}
                                    onClick={handleConnect}
                                    disabled={connectionState === 'connecting' || connectionState === 'connected' || connectionState === 'already'}
                                >
                                    {connectionState === 'connecting' ? (
                                        <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Connecting...</>
                                    ) : connectionState === 'connected' ? (
                                        <><Link2 size={16} /> Connected 🤝</>
                                    ) : connectionState === 'already' ? (
                                        <><Link2 size={16} /> Already Connected</>
                                    ) : (
                                        <><Link2 size={16} /> Connect 🤝</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Connection Success Toast */}
                    {showConnectionToast && (
                        <div className="connection-toast">
                            <div className="connection-toast-inner">
                                <Flame size={20} className="streak-icon-active" />
                                <div>
                                    <strong>Connected with {displayName}!</strong>
                                    <span>🔥 Streak started — Day 1!</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Incoming Extension Request */}
                    {incomingExtensionRequest && (
                        <div className="connection-toast" style={{ top: '80px', bottom: 'auto' }}>
                            <div className="connection-toast-inner" style={{ flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={20} color="#facc15" />
                                    <span><strong>{displayName} wants more time!</strong></span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                    <button
                                        className="pill active"
                                        style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem' }}
                                        onClick={() => {
                                            setRequestStatus('accepted');
                                            setIncomingExtensionRequest(false);
                                            if (channelRef.current) {
                                                channelRef.current.send({
                                                    type: 'broadcast',
                                                    event: 'extend-response',
                                                    payload: { senderId: user!.id, receiverId: currentMatch.profile.id, accepted: true }
                                                });
                                            }
                                        }}
                                    >
                                        Accept
                                    </button>
                                    <button
                                        className="pill"
                                        style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#333' }}
                                        onClick={() => {
                                            setIncomingExtensionRequest(false);
                                            if (channelRef.current) {
                                                channelRef.current.send({
                                                    type: 'broadcast',
                                                    event: 'extend-response',
                                                    payload: { senderId: user!.id, receiverId: currentMatch.profile.id, accepted: false }
                                                });
                                            }
                                        }}
                                    >
                                        Decline
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Incoming Video Request */}
                    {incomingVideoRequest && (
                        <div className="connection-toast" style={{ top: '80px', bottom: 'auto' }}>
                            <div className="connection-toast-inner" style={{ flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Video size={20} color="#60a5fa" />
                                    <span><strong>{displayName} wants to switch to Video!</strong></span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                    <button
                                        className="pill active"
                                        style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem' }}
                                        onClick={() => {
                                            setVideoRequestStatus('accepted');
                                            setIncomingVideoRequest(false);
                                            if (channelRef.current) {
                                                channelRef.current.send({
                                                    type: 'broadcast',
                                                    event: 'video-response',
                                                    payload: { senderId: user!.id, receiverId: currentMatch.profile.id, accepted: true }
                                                });
                                            }
                                        }}
                                    >
                                        Accept
                                    </button>
                                    <button
                                        className="pill"
                                        style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#333' }}
                                        onClick={() => {
                                            setIncomingVideoRequest(false);
                                            if (channelRef.current) {
                                                channelRef.current.send({
                                                    type: 'broadcast',
                                                    event: 'video-response',
                                                    payload: { senderId: user!.id, receiverId: currentMatch.profile.id, accepted: false }
                                                });
                                            }
                                        }}
                                    >
                                        Decline
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}



                    {/* Tap-to-unmute banner when browser blocks autoplay */}
                    {audioBlocked && (
                        <div
                            onClick={() => {
                                const audioEl = remoteAudioRef.current || (document.getElementById('knock-call-audio') as HTMLAudioElement);
                                if (audioEl) {
                                    audioEl.volume = 1.0;
                                    audioEl.muted = false;
                                    audioEl.play().then(() => setAudioBlocked(false)).catch(() => {});
                                }
                            }}
                            style={{
                                position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
                                background: 'rgba(255,59,48,0.9)', color: '#fff', padding: '10px 20px',
                                borderRadius: '12px', cursor: 'pointer', zIndex: 200,
                                fontSize: '0.9rem', fontWeight: 600, textAlign: 'center',
                                boxShadow: '0 4px 16px rgba(255,59,48,0.4)',
                                animation: 'sparkle-pulse 1.5s ease-in-out infinite',
                            }}
                        >
                            🔇 Tap here to unmute audio
                        </div>
                    )}

                    {/* Call Controls */}
                    <div className="call-controls" style={{ display: 'flex', justifyContent: 'center', gap: '24px', zIndex: 10 }}>
                        <button className="call-btn btn-mute" onClick={() => {
                            const newMuted = !isMuted;
                            setIsMuted(newMuted);
                            if (localStreamRef.current) {
                                localStreamRef.current.getAudioTracks().forEach(track => {
                                    track.enabled = !newMuted;
                                });
                            }
                        }}>
                            {isMuted ? <MicOff size={28} color="#ff3b30" /> : <Mic size={28} />}
                        </button>
                        <button className="call-btn btn-end" onClick={endCall}>
                            <PhoneOff size={28} />
                        </button>
                        <button className="call-btn btn-mute" onClick={skipToNext} title="Skip to next">
                            <SkipForward size={28} />
                        </button>
                    </div>
                </div>

                {/* Floating In-Call Subtitle Toast (Translated incoming messages) */}
                {floatingSubtitle && (Date.now() - floatingSubtitle.time < 5500) && (
                    <div
                        onClick={() => setShowChat(true)}
                        style={{
                            position: 'absolute',
                            top: '80px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(20, 20, 28, 0.94)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.22)',
                            padding: '10px 18px',
                            borderRadius: '24px',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            zIndex: 350,
                            boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
                            maxWidth: '90%',
                            cursor: 'pointer',
                            animation: 'slideDown 0.3s ease',
                        }}
                    >
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #ff3366, #ff9933)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: '1rem'
                        }}>
                            💬
                        </div>
                        <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 600, color: '#fff' }}>{floatingSubtitle.senderName}</span>
                                {floatingSubtitle.isTranslated && (
                                    <span style={{ color: '#34C759', fontWeight: 600 }}>
                                        • 🌐 {getLanguage(floatingSubtitle.senderLang || 'auto').flag} → {getLanguage(floatingSubtitle.targetLang || 'en').flag}
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                "{floatingSubtitle.text}"
                            </div>
                        </div>
                    </div>
                )}

                {/* Chat Drawer */}
                {showChat && (
                    <div style={{ position: 'absolute', bottom: '120px', left: '16px', right: '16px', height: '420px', backgroundColor: 'rgba(22, 22, 26, 0.96)', backdropFilter: 'blur(20px)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.14)', display: 'flex', flexDirection: 'column', zIndex: 100, boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>Chat with {displayName}</span>
                            <button onClick={() => setShowChat(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '6px', color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
                        </div>

                        {/* Language Translation Toolbar */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                            fontSize: '0.78rem',
                            flexWrap: 'wrap',
                            gap: '6px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: '14px', padding: '3px 8px' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.6)', marginRight: '4px' }}>Me:</span>
                                    <select
                                        value={myChatLanguage}
                                        onChange={(e) => {
                                            setMyChatLanguage(e.target.value);
                                            setUserLanguage(e.target.value);
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.78rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                                    >
                                        {SUPPORTED_LANGUAGES.map(l => (
                                            <option key={l.code} value={l.code} style={{ background: '#1c1c1e', color: '#fff' }}>
                                                {l.flag} {l.nativeName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleSwapLanguages}
                                    title="Swap Languages"
                                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
                                >
                                    <ArrowLeftRight size={12} />
                                </button>

                                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: '14px', padding: '3px 8px' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.6)', marginRight: '4px' }}>To:</span>
                                    <select
                                        value={targetChatLanguage}
                                        onChange={(e) => setTargetChatLanguage(e.target.value)}
                                        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.78rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                                    >
                                        {SUPPORTED_LANGUAGES.map(l => (
                                            <option key={l.code} value={l.code} style={{ background: '#1c1c1e', color: '#fff' }}>
                                                {l.flag} {l.nativeName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setAutoTranslateChat(!autoTranslateChat)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    borderRadius: '14px',
                                    border: autoTranslateChat ? '1px solid #34C759' : '1px solid rgba(255,255,255,0.2)',
                                    background: autoTranslateChat ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255,255,255,0.06)',
                                    color: autoTranslateChat ? '#34C759' : 'rgba(255,255,255,0.6)',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                <Globe size={13} />
                                <span>{autoTranslateChat ? 'Auto-Translate ON' : 'Translate OFF'}</span>
                            </button>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {chatMessages.length === 0 && (
                                <p style={{ textAlign: 'center', color: '#8e8e93', marginTop: 'auto', marginBottom: 'auto', fontSize: '0.85rem' }}>
                                    Say hi! 👋 Messages are translated in real-time.
                                </p>
                            )}
                            {chatMessages.map(msg => {
                                const showOriginal = Boolean(showOriginalMap[msg.id]);
                                const isTranslating = Boolean(translatingMsgIds[msg.id]);
                                const textToDisplay = (msg.isTranslated && showOriginal)
                                    ? (msg.originalText || msg.text)
                                    : (msg.translatedText || msg.text);

                                return (
                                    <div
                                        key={msg.id}
                                        style={{
                                            alignSelf: msg.isMine ? 'flex-end' : 'flex-start',
                                            background: msg.isMine ? 'linear-gradient(135deg, #ff3366, #ff5577)' : '#333',
                                            color: '#fff',
                                            padding: '8px 14px',
                                            borderRadius: '14px',
                                            maxWidth: '82%',
                                            fontSize: '0.9rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                            <div style={{ wordBreak: 'break-word', lineHeight: 1.4, flex: 1 }}>
                                                {textToDisplay}
                                            </div>
                                            {msg.isMine && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteChatMessage(msg.id);
                                                    }}
                                                    title="Delete sent text"
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: 'rgba(255,255,255,0.6)',
                                                        cursor: 'pointer',
                                                        padding: '2px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'color 0.15s ease',
                                                        flexShrink: 0,
                                                        marginTop: '2px',
                                                    }}
                                                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ff3b30')}
                                                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>

                                        {msg.isTranslated ? (
                                            <div
                                                onClick={() => toggleShowOriginal(msg.id)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    fontSize: '0.68rem',
                                                    color: 'rgba(255,255,255,0.7)',
                                                    cursor: 'pointer',
                                                    marginTop: '2px',
                                                    userSelect: 'none',
                                                }}
                                            >
                                                <span>🌐</span>
                                                <span>{showOriginal ? 'Showing original (Tap for translation)' : `Translated (Tap for original ${msg.senderLang?.toUpperCase() || ''})`}</span>
                                            </div>
                                        ) : !msg.isMine && (
                                            <button
                                                type="button"
                                                onClick={() => handleTranslateMessage(msg.id, msg.text)}
                                                disabled={isTranslating}
                                                style={{
                                                    alignSelf: 'flex-start',
                                                    background: 'rgba(255,255,255,0.12)',
                                                    border: 'none',
                                                    borderRadius: '10px',
                                                    padding: '2px 8px',
                                                    color: '#fff',
                                                    fontSize: '0.68rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    marginTop: '2px'
                                                }}
                                            >
                                                <Globe size={10} />
                                                {isTranslating ? 'Translating...' : `Translate to ${getLanguage(myChatLanguage).name}`}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Live Translation Preview */}
                        {liveTranslationPreview && (
                            <div style={{
                                padding: '6px 14px',
                                background: 'rgba(52, 199, 89, 0.15)',
                                borderTop: '1px solid rgba(52, 199, 89, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.78rem',
                                color: '#34C759',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    <span>🌐 {getLanguage(targetChatLanguage).flag}:</span>
                                    <span style={{ fontStyle: 'italic', color: '#e8f5e9' }}>"{liveTranslationPreview}"</span>
                                </div>
                                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Auto-Translating</span>
                            </div>
                        )}

                        <form onSubmit={sendChatMessage} style={{ display: 'flex', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.1)', gap: '8px' }}>
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder={autoTranslateChat ? `Type in ${getLanguage(myChatLanguage).nativeName}...` : "Type a message..."}
                                style={{ flex: 1, background: '#111', border: 'none', padding: '10px 16px', borderRadius: '20px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                            />
                            <button
                                type="submit"
                                style={{
                                    background: autoTranslateChat ? 'linear-gradient(135deg, #ff3366, #34C759)' : 'var(--primary-color)',
                                    border: 'none',
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    flexShrink: 0
                                }}
                                title={autoTranslateChat ? "Translate & Send" : "Send"}
                            >
                                <Send size={18} />
                            </button>
                        </form>
                    </div>
                )}

                <style>{`
                    @keyframes voiceAuraPulse {
                        0%, 100% { transform: scale(1); opacity: 0.4; }
                        50% { transform: scale(1.18); opacity: 0.85; }
                    }
                `}</style>
                </div>
            )}
        </>
    );
}

    // ── Match Card Screen ──
    if (showMatchCard && currentMatch) {
        return (
            <>
                <audio
                    id="knock-call-audio"
                    ref={remoteAudioRef}
                    autoPlay
                    playsInline
                    style={{ position: 'fixed', bottom: 0, left: 0, width: 1, height: 1, opacity: 0.01, pointerEvents: 'none', zIndex: -1 }}
                />
                <div className="call-hub-bg pb-20">
                <div className="match-card-wrapper">
                    <div className="match-card">
                        <div className="match-card-avatar-ring">
                            <img
                                src={displayAvatar}
                                alt={displayUsername}
                                className="match-card-avatar"
                            />
                        </div>

                        <div className="match-compat-circle">
                            <svg viewBox="0 0 80 80" className="compat-ring-svg">
                                <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                                <circle
                                    cx="40" cy="40" r="36" fill="none"
                                    stroke="url(#compat-gradient)"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray={`${currentMatch.compatibilityPercent * 2.26} 226`}
                                    transform="rotate(-90 40 40)"
                                    className="compat-ring-progress"
                                />
                                <defs>
                                    <linearGradient id="compat-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#ff3366" />
                                        <stop offset="100%" stopColor="#ff9933" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <span className="compat-ring-text">{currentMatch.compatibilityPercent}%</span>
                        </div>

                        <h2 className="match-card-name">{displayName}</h2>
                        <p className="match-card-username">@{displayUsername}</p>

                        <div className="match-card-stats">
                            <div className="match-stat">
                                <Heart size={16} color="#ff3366" />
                                <span className="match-stat-value">{currentMatch.sharedLikes}</span>
                                <span className="match-stat-label">Shared Likes</span>
                            </div>
                            <div className="match-stat-divider" />
                            <div className="match-stat">
                                <Zap size={16} color="#facc15" />
                                <span className="match-stat-value">{currentMatch.totalLikes}</span>
                                <span className="match-stat-label">Their Likes</span>
                            </div>
                            <div className="match-stat-divider" />
                            <div className="match-stat">
                                <Users size={16} color="#60a5fa" />
                                <span className="match-stat-value">{currentMatch.profile.points || 0}</span>
                                <span className="match-stat-label">Points</span>
                            </div>
                        </div>

                        <div className="match-card-actions">
                            <button className="match-skip-btn" onClick={skipToNext}>
                                <SkipForward size={20} /> Skip
                            </button>
                            <button className="match-connect-btn" onClick={connectToMatch}>
                                <Phone size={20} /> Connect
                            </button>
                        </div>

                        <p className="match-card-hint">
                            {currentMatchIndex + 1} of {matches.length} matches found
                        </p>
                    </div>
                </div>
            </div>
            </>
        );
    }

    const searchingUserCount = onlineUsers.filter((u: any) => u.status === 'searching' && u.user_id !== user?.id).length;
    const totalOnlineCount = onlineUsers.filter((u: any) => u.user_id !== user?.id).length;

    const currentHour = new Date().getHours();
    const isPeakHour = currentHour >= 20 || currentHour <= 22;

    // ── Main Search Screen ──
    return (
        <>
            <audio
                id="knock-call-audio"
                ref={remoteAudioRef}
                autoPlay
                playsInline
                style={{ position: 'fixed', bottom: 0, left: 0, width: 1, height: 1, opacity: 0.01, pointerEvents: 'none', zIndex: -1 }}
            />
            <div className="call-hub-bg pb-20">
            <div className="text-center mb-8">
                <h2 className="title mb-2">Voice Roulette</h2>
                <p className="text-gray-400">Connect with similar minds securely.</p>
            </div>

            {/* Language Selector Pill on Main Voice Screen */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', padding: '0 16px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                }}>
                    <Globe size={15} color="#34C759" />
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                        My Language:
                    </span>
                    <select
                        value={myChatLanguage}
                        onChange={(e) => {
                            const val = e.target.value;
                            setMyChatLanguage(val);
                            setUserLanguage(val);
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#fff',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            outline: 'none',
                        }}
                    >
                        {SUPPORTED_LANGUAGES.map(lang => (
                            <option key={lang.code} value={lang.code} style={{ background: '#1c1c1e', color: '#fff' }}>
                                {lang.flag} {lang.nativeName}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Live Online Counter */}
            <div style={{
                display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '1.5rem',
                flexWrap: 'wrap', padding: '0 16px',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'rgba(52,199,89,0.15)', padding: '6px 14px', borderRadius: '20px',
                }}>
                    <span style={{
                        width: '8px', height: '8px', borderRadius: '50%', background: '#34C759',
                        boxShadow: '0 0 8px #34C759',
                        animation: 'pulse 2s ease-in-out infinite',
                    }} />
                    <span style={{ color: '#34C759', fontSize: '13px', fontWeight: 'bold' }}>
                        {totalOnlineCount} online
                    </span>
                </div>
                {searchingUserCount > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'rgba(255,51,102,0.15)', padding: '6px 14px', borderRadius: '20px',
                    }}>
                        <Phone size={12} color="#ff3366" />
                        <span style={{ color: '#ff3366', fontSize: '13px', fontWeight: 'bold' }}>
                            {searchingUserCount} searching now
                        </span>
                    </div>
                )}
            </div>

            {/* Matching Radar */}
            <div className="match-radar">
                {isSearching && (
                    <>
                        <div className="radar-ring"></div>
                        <div className="radar-ring"></div>
                        <div className="radar-ring"></div>
                    </>
                )}
                <div 
                    className="radar-center"
                    style={{
                        
                    }}
                >
                    {isSearching ? (
                        <Loader2 size={36} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                        <Phone size={36} />
                    )}
                </div>
            </div>

            {noMatchFound && (
                <div style={{ textAlign: 'center', marginBottom: '1.5rem', padding: '0 24px' }}>
                    <div style={{
                        background: 'rgba(255,153,51,0.1)', borderRadius: '16px',
                        padding: '20px', border: '1px solid rgba(255,153,51,0.2)',
                    }}>
                        <p style={{ color: '#ff9933', fontSize: '1rem', fontWeight: 600, marginBottom: '8px' }}>
                            🔍 No other users are searching right now
                        </p>
                        <p style={{ color: '#8e8e93', fontSize: '0.85rem', marginBottom: '16px', lineHeight: '1.4' }}>
                            We only connect you with real people who are actively online. Tap below to search again or wait a moment!
                        </p>
                        <button
                            className="premium-btn"
                            onClick={() => {
                                setNoMatchFound(false);
                                startSearch();
                            }}
                            style={{ fontSize: '0.9rem', padding: '10px 24px' }}
                        >
                            🔄 Search Again
                        </button>
                    </div>
                </div>
            )}

            <h3 className="mb-4 font-bold" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Settings2 size={20} /> Matching Preferences
            </h3>
            <div className="filter-pills">
                {MATCH_PREFERENCES.map(pref => (
                    <button
                        key={pref}
                        className={`pill ${activePref === pref ? 'active' : ''}`}
                        onClick={() => setActivePref(pref)}
                        disabled={isSearching}
                    >
                        {pref}
                    </button>
                ))}
            </div>

            {/* Start / Cancel Matching Action Button */}
            {isSearching ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%', maxWidth: '290px', margin: '1rem auto 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff3366', fontWeight: 600, fontSize: '0.95rem' }}>
                        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                        Searching for online users...
                    </div>
                    <button
                        className="premium-btn"
                        onClick={cancelSearch}
                        style={{
                            width: '100%',
                            justifyContent: 'center',
                            fontSize: '0.95rem',
                            padding: '12px 24px',
                            background: 'rgba(255,59,48,0.15)',
                            border: '1px solid rgba(255,59,48,0.4)',
                            color: '#ff3b30'
                        }}
                    >
                        <X size={18} style={{ marginRight: '6px' }} />
                        Stop Searching
                    </button>
                </div>
            ) : (
                <button
                    className="premium-btn"
                    onClick={startSearch}
                    style={{
                        width: '100%',
                        maxWidth: '290px',
                        justifyContent: 'center',
                        fontSize: '1.05rem',
                        padding: '14px 24px',
                        marginTop: '1rem',
                        animation: totalOnlineCount > 0 ? 'btnPulse 2s ease-in-out infinite' : 'none',
                    }}
                >
                    <Phone size={18} style={{ marginRight: '8px' }} />
                    Start Matching
                </button>
            )}

            {/* 🎙️ Interactive Microphone & Audio Tester */}
            <div style={{
                margin: '1.2rem auto 0',
                padding: '0 20px',
                maxWidth: '380px',
                width: '100%',
                boxSizing: 'border-box'
            }}>
                <div style={{
                    background: isMicTesting 
                        ? 'linear-gradient(135deg, rgba(0, 122, 255, 0.18) 0%, rgba(52, 199, 89, 0.12) 100%)' 
                        : 'rgba(255, 255, 255, 0.04)',
                    borderRadius: '20px',
                    padding: '16px 20px',
                    border: isMicTesting ? '1px solid rgba(0, 122, 255, 0.45)' : '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: isMicTesting ? '0 8px 30px rgba(0, 122, 255, 0.25)' : '0 4px 20px rgba(0, 0, 0, 0.2)',
                    textAlign: 'center',
                    transition: 'all 0.3s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMicTesting ? '14px' : '0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '34px', height: '34px', borderRadius: '50%',
                                background: isMicTesting ? 'rgba(52, 199, 89, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: isMicTesting ? '#34C759' : '#fff'
                            }}>
                                <Mic size={18} />
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>
                                    {isMicTesting ? 'Testing Microphone...' : 'Mic & Audio Test'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                                    {isMicTesting ? (micTestVolume > 8 ? '🎙️ Voice detected clearly!' : 'Speak into mic to test volume') : 'Check your voice before calling'}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={startMicTest}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '16px',
                                border: 'none',
                                background: isMicTesting ? 'rgba(255, 59, 48, 0.88)' : 'linear-gradient(135deg, #007aff, #00c6ff)',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s ease',
                                boxShadow: isMicTesting ? '0 2px 10px rgba(255,59,48,0.3)' : '0 2px 10px rgba(0,122,255,0.3)'
                            }}
                        >
                            {isMicTesting ? (
                                <>
                                    <X size={14} /> Stop
                                </>
                            ) : (
                                <>
                                    <Mic size={14} /> Test Mic
                                </>
                            )}
                        </button>
                    </div>

                    {isMicTesting && (
                        <div style={{ marginTop: '12px' }}>
                            {/* Live Audio Level Meter */}
                            <div style={{ marginBottom: '10px' }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '0.75rem',
                                    color: 'rgba(255,255,255,0.7)',
                                    marginBottom: '6px'
                                }}>
                                    <span>Input Level: <strong>{micTestVolume}%</strong></span>
                                    <span style={{ color: micTestVolume > 15 ? '#34C759' : '#ff9500', fontWeight: 600 }}>
                                        {micTestVolume > 15 ? '🟢 Voice Detected' : '🟡 Quiet / Speak Up'}
                                    </span>
                                </div>
                                <div style={{
                                    height: '8px',
                                    background: 'rgba(255,255,255,0.1)',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    position: 'relative'
                                }}>
                                    <div style={{
                                        width: `${micTestVolume}%`,
                                        height: '100%',
                                        background: micTestVolume > 60 
                                            ? 'linear-gradient(90deg, #34C759, #ffcc00, #ff3b30)' 
                                            : 'linear-gradient(90deg, #007aff, #34C759)',
                                        borderRadius: '4px',
                                        transition: 'width 0.08s ease-out'
                                    }} />
                                </div>
                            </div>

                            {/* Equalizer Visualizer Bars */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'flex-end',
                                gap: '5px',
                                height: '34px',
                                margin: '8px 0 14px'
                            }}>
                                {[0.5, 0.8, 1.2, 0.7, 1.4, 1.0, 1.5, 0.9, 1.3, 0.6].map((factor, idx) => {
                                    const barHeight = Math.max(4, Math.min(34, Math.round((micTestVolume * factor * 0.34))));
                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                width: '5px',
                                                height: `${barHeight}px`,
                                                borderRadius: '3px',
                                                background: micTestVolume > 8 ? '#34C759' : 'rgba(255,255,255,0.2)',
                                                transition: 'height 0.06s ease, background 0.15s ease',
                                                boxShadow: micTestVolume > 15 ? '0 0 6px rgba(52,199,89,0.6)' : 'none'
                                            }}
                                        />
                                    );
                                })}
                            </div>

                            {/* Hear Myself Loopback Toggle */}
                            <button
                                onClick={toggleMicLoopback}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    background: micLoopback ? 'rgba(52, 199, 89, 0.25)' : 'rgba(255,255,255,0.06)',
                                    color: micLoopback ? '#34C759' : 'rgba(255,255,255,0.85)',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <Headphones size={15} />
                                {micLoopback ? '🔊 Loopback ON (You can hear your voice)' : '🔈 Test Sound (Hear Myself)'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ⏰ Evening Peak Hours Card (Voice Space is 24/7) */}
            <div style={{
                margin: '1.8rem auto 1.5rem',
                padding: '0 20px',
                maxWidth: '380px',
                width: '100%',
                boxSizing: 'border-box'
            }}>
                <div style={{
                    background: scheduleInfo.isActive 
                        ? 'linear-gradient(135deg, rgba(37,211,102,0.12) 0%, rgba(37,211,102,0.04) 100%)' 
                        : 'linear-gradient(135deg, rgba(245,165,36,0.12) 0%, rgba(255,51,102,0.06) 100%)',
                    borderRadius: '20px',
                    padding: '18px 20px',
                    border: scheduleInfo.isActive 
                        ? '1px solid rgba(37,211,102,0.35)' 
                        : '1px solid rgba(245,165,36,0.3)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                            background: '#34C759', width: '10px', height: '10px', borderRadius: '50%',
                            boxShadow: '0 0 10px #34C759', animation: 'pulse 1.8s infinite'
                        }} />
                        <span style={{
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: '#34C759',
                            letterSpacing: '0.3px'
                        }}>
                            Voice Space is LIVE 24/7
                        </span>
                    </div>

                    <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.82rem', margin: 0, lineHeight: 1.45 }}>
                        Connect and speak with real online users anytime! Peak hours are <strong style={{ color: '#f5a524' }}>8:00 PM – 10:00 PM</strong> when the most users are online.
                    </p>

                    {/* Peak Hours Status Badge */}
                    <div style={{
                        marginTop: '4px',
                        background: 'rgba(0,0,0,0.45)',
                        padding: '7px 18px',
                        borderRadius: '20px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <Flame size={15} color="#f5a524" />
                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                            {scheduleInfo.isActive ? '🔥 Peak Session Running!' : 'Next Peak Hour:'}
                        </span>
                        <span style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: '#f5a524',
                            letterSpacing: '1px'
                        }}>
                            {scheduleInfo.formatted}
                        </span>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes btnPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(255,51,102,0.4); }
                    50% { box-shadow: 0 0 0 12px rgba(255,51,102,0); }
                }
                @keyframes slideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    </>
    );
};

export default VoiceCall;
