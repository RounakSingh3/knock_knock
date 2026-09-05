import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
    Phone, Mic, MicOff, PhoneOff, Settings2, Clock, Video, VideoOff, 
    Heart, Zap, Users, Loader2, SkipForward, MessageSquare, Send, X, 
    Link2, Flame, RefreshCw, CameraOff, ChevronLeft, Lock, Bell
} from 'lucide-react';
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

const COMMUNITY_COMPANIONS: ProfileData[] = [
    { id: '11111111-1111-1111-1111-111111111101', username: 'priya_patel99', name: 'Priya Patel', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300', gender: 'female', points: 450 } as any,
    { id: '11111111-1111-1111-1111-111111111102', username: 'aditya_ps', name: 'Aditya Pratap', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300', gender: 'male', points: 520 } as any,
    { id: '11111111-1111-1111-1111-111111111103', username: 'neha_creates', name: 'Neha Sharma', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300', gender: 'female', points: 380 } as any,
    { id: '11111111-1111-1111-1111-111111111104', username: 'zack_kumar', name: 'Zack', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300', gender: 'male', points: 610 } as any,
    { id: '11111111-1111-1111-1111-111111111105', username: 'sophia_vibe', name: 'Sophia R.', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300', gender: 'female', points: 490 } as any,
    { id: '11111111-1111-1111-1111-111111111106', username: 'alex_music', name: 'Alex Rivera', avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300', gender: 'male', points: 580 } as any,
    { id: '11111111-1111-1111-1111-111111111107', username: 'maya_wanderer', name: 'Maya Sen', avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300', gender: 'female', points: 530 } as any,
];

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
    const [isMockMode, setIsMockMode] = useState(false);

    // Call feature states
    const [requestStatus, setRequestStatus] = useState<'none' | 'sent' | 'accepted'>('none');
    const [videoRequestStatus, setVideoRequestStatus] = useState<'none' | 'sent' | 'accepted'>('none');
    const [connectionState, setConnectionState] = useState<'none' | 'connecting' | 'connected' | 'already'>('none');
    const [showConnectionToast, setShowConnectionToast] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState<{ id: number; text: string; isMine: boolean }[]>([]);

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
    const [showScheduleToast, setShowScheduleToast] = useState(true);

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
    const onlineUsersRef = useRef<any[]>([]);

    const channelRef = useRef<any>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);

    const pendingInviteRef = useRef<string | null>(null);
    const searchTimeoutRef = useRef<number | null>(null);
    const pendingOfferRef = useRef<any>(null);
    const pendingIceCandidatesRef = useRef<any[]>([]);
    const webrtcReadyRef = useRef(false);
    const videoControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // State refs to give signaling callbacks the latest values
    const isSearchingRef = useRef(isSearching);
    const activePrefRef = useRef(activePref);
    const currentMatchRef = useRef(currentMatch);
    const videoRequestStatusRef = useRef(videoRequestStatus);
    const inCallRef = useRef(inCall);
    const isCallerRef = useRef(isCaller);
    const isMockModeRef = useRef(isMockMode);

    useEffect(() => { isSearchingRef.current = isSearching; }, [isSearching]);
    useEffect(() => { activePrefRef.current = activePref; }, [activePref]);
    useEffect(() => { currentMatchRef.current = currentMatch; }, [currentMatch]);
    useEffect(() => { videoRequestStatusRef.current = videoRequestStatus; }, [videoRequestStatus]);
    useEffect(() => { inCallRef.current = inCall; }, [inCall]);
    useEffect(() => { isCallerRef.current = isCaller; }, [isCaller]);
    useEffect(() => { onlineUsersRef.current = onlineUsers; }, [onlineUsers]);
    useEffect(() => { isMockModeRef.current = isMockMode; }, [isMockMode]);

    // Handle Direct Calls Initialization
    useEffect(() => {
        if (!user || !user.id || !isDirectCall || !directPartnerId) return;

        const initializeDirectCall = async () => {
            const profiles = await fetchProfilesByIds([directPartnerId]);
            if (profiles.length === 0) {
                alert("User not found.");
                return;
            }
            const partnerProfile = profiles[0];

            setIsCaller(directRole === 'caller');
            setIsMockMode(false);
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

    // WebRTC connection and cleanup functions
    const closeWebRTC = () => {
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
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
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

        const channel = supabase.channel('room:voice_calls');
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
                if (isSearchingRef.current) {
                    const found = findAndInviteMatch();
                    if (found && searchTimeoutRef.current) {
                        clearTimeout(searchTimeoutRef.current);
                        searchTimeoutRef.current = window.setTimeout(() => {
                            if (isSearchingRef.current) {
                                startCompanionCall();
                            }
                        }, 3500);
                    }
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
                    setIsMockMode(false);
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
                    setIsMockMode(false);
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
            .on('broadcast', { event: 'chat-message' }, ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                setChatMessages(prev => [...prev, { id: payload.id, text: payload.text, isMine: false }]);
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
            .on('broadcast', { event: 'switch-to-voice' }, ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                setVideoRequestStatus('none');
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
                await channel.track({
                    user_id: user.id,
                    username: user.username,
                    name: user.name,
                    avatar_url: user.avatar_url,
                    gender: user.gender,
                    status: isSearchingRef.current ? 'searching' : inCallRef.current ? 'in-call' : 'idle',
                    preference: activePrefRef.current,
                });
            }
        });

        return () => {
            channel.unsubscribe();
        };
    }, [user?.id]);

    // ── WebRTC Connection Management ──
    useEffect(() => {
        const startWebRTC = async () => {
            if (!inCall || !currentMatch) return;
            closeWebRTC();

            if (isMockMode) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                    localStreamRef.current = stream;
                } catch {
                    // mic access denied or not required for companion
                }
                setPeerConnected(true);
                return;
            }
    
            try {
                const isVideo = videoRequestStatus === 'accepted';
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 48000,
                        channelCount: 1,
                    },
                    video: isVideo
                });
                localStreamRef.current = stream;

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

                pc.ontrack = (event) => {
                    const remoteStream = event.streams[0];
                    if (!remoteStream) return;

                    if (event.track.kind === 'audio' && remoteAudioRef.current) {
                        const audioStream = new MediaStream([event.track]);
                        remoteAudioRef.current.srcObject = audioStream;
                        remoteAudioRef.current.volume = 1.0;
                        remoteAudioRef.current.play().then(() => {
                            setAudioBlocked(false);
                        }).catch(err => {
                            console.warn('Audio autoplay blocked, showing tap-to-unmute:', err);
                            setAudioBlocked(true);
                        });
                    }

                    if (event.track.kind === 'video') {
                        const videoStream = new MediaStream();
                        remoteStream.getTracks().forEach(t => videoStream.addTrack(t));
                        remoteStreamRef.current = videoStream;
                        if (remoteVideoRef.current) {
                            remoteVideoRef.current.srcObject = videoStream;
                        }
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
                channelRef.current.send({
                    type: 'broadcast',
                    event: 'peer-arrived',
                    payload: { senderId: user!.id, receiverId: currentMatchRef.current.profile.id }
                });
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
    }, [inCall, isCaller, currentMatch?.profile?.id, isMockMode]);

    // Handle video upgrade separately — add video track to existing connection
    useEffect(() => {
        if (videoRequestStatus !== 'accepted') return;

        if (isMockMode) {
            // In companion/mock mode, capture camera so user sees their own face
            (async () => {
                try {
                    const videoStream = await navigator.mediaDevices.getUserMedia({ 
                        video: { facingMode: isFrontCamera ? 'user' : 'environment' } 
                    });
                    localStreamRef.current = videoStream;
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = videoStream;
                    }
                } catch (e) {
                    console.warn('Camera access denied in mock mode:', e);
                }
            })();
            return;
        }

        if (!peerConnectionRef.current || !localStreamRef.current || !user) return;
        const pc = peerConnectionRef.current;

        const senders = pc.getSenders();
        const hasVideoSender = senders.some(s => s.track?.kind === 'video');
        if (hasVideoSender) return;

        (async () => {
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: isFrontCamera ? 'user' : 'environment' } 
                });
                const videoTrack = videoStream.getVideoTracks()[0];
                if (videoTrack) {
                    pc.addTrack(videoTrack, localStreamRef.current!);
                    localStreamRef.current!.addTrack(videoTrack);

                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = localStreamRef.current;
                    }

                    if (isCallerRef.current && channelRef.current && currentMatchRef.current) {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        channelRef.current.send({
                            type: 'broadcast',
                            event: 'webrtc-offer',
                            payload: {
                                senderId: user.id,
                                receiverId: currentMatchRef.current.profile.id,
                                sdp: offer,
                            }
                        });
                    }
                }
            } catch (e) {
                console.error('Failed to add video track:', e);
            }
        })();
    }, [videoRequestStatus, isMockMode, isFrontCamera]);

    // Ensure video stream remains attached when switching views
    useEffect(() => {
        if (videoRequestStatus === 'accepted') {
            if (localVideoRef.current && localStreamRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
            }
            if (remoteVideoRef.current && remoteStreamRef.current) {
                remoteVideoRef.current.srcObject = remoteStreamRef.current;
            }
        }
    }, [isVideoSwapped, videoRequestStatus]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleTalkMore = () => {
        setRequestStatus('sent');
        if (isMockMode) {
            setTimeout(() => {
                setRequestStatus('accepted');
            }, 1200);
            return;
        }
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
        if (isMockMode) {
            setTimeout(() => {
                setVideoRequestStatus('accepted');
            }, 1400);
            return;
        }
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
        setVideoRequestStatus('none');
        setIsVideoSwapped(false);
        setIsCameraOff(false);

        if (channelRef.current && currentMatchRef.current && !isMockMode) {
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

    const startCompanionCall = async () => {
        if (!isSearchingRef.current || !user) return;
        try {
            let candidates = [...COMMUNITY_COMPANIONS];
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('id, username, name, avatar_url, gender, points')
                    .neq('id', user.id)
                    .limit(10);
                if (data && data.length > 0) {
                    candidates = [...data.map(p => ({
                        id: p.id,
                        username: p.username || 'user',
                        name: p.name || p.username || 'User',
                        avatar_url: p.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
                        gender: p.gender || 'female',
                        points: p.points || 300,
                    })), ...COMMUNITY_COMPANIONS];
                }
            } catch {
                // fallback to static
            }

            if (activePrefRef.current === 'Boy to Girl 👦') {
                const filtered = candidates.filter(c => c.gender === 'female');
                if (filtered.length > 0) candidates = filtered;
            } else if (activePrefRef.current === 'Girl to Boy 👧') {
                const filtered = candidates.filter(c => c.gender === 'male');
                if (filtered.length > 0) candidates = filtered;
            }

            const chosen = candidates[Math.floor(Math.random() * candidates.length)];
            const compat = Math.floor(Math.random() * 18) + 82; // 82 - 99%
            const shared = Math.floor(Math.random() * 3) + 2;   // 2 - 4

            setMatches([{
                profile: chosen as any,
                similarityScore: compat / 100,
                sharedLikes: shared,
                totalLikes: 5,
                compatibilityPercent: compat,
            }]);
            setCurrentMatchIndex(0);
            setIsSearching(false);
            setIsMockMode(true);
            setIsCaller(true);
            setPeerConnected(true);
            setShowMatchCard(false);
            setInCall(true);
            playCallConnectedChime();
            updatePresence('in-call');
        } catch (e) {
            console.error('Error in companion match:', e);
            setNoMatchFound(true);
            setIsSearching(false);
        }
    };

    const startSearch = async () => {
        if (!user) return;
        if (!scheduleInfo.isActive && !isDirectCall) {
            setShowScheduleToast(true);
            return;
        }
        setIsSearching(true);
        setNoMatchFound(false);
        setShowMatchCard(false);
        setIsMockMode(false);
        setIsCaller(false);

        await updatePresence('searching');

        const onlineMatch = findAndInviteMatch();
        if (onlineMatch) {
            searchTimeoutRef.current = window.setTimeout(() => {
                if (isSearchingRef.current) {
                    startCompanionCall();
                }
            }, 3500);
        } else {
            searchTimeoutRef.current = window.setTimeout(() => {
                if (isSearchingRef.current) {
                    startCompanionCall();
                }
            }, 3500);
        }
    };

    const connectToMatch = async () => {
        setShowMatchCard(false);
        setInCall(true);
        playCallConnectedChime();
        await updatePresence('in-call');
    };

    const skipToNext = () => {
        if (currentMatchRef.current && channelRef.current && !isMockMode) {
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
        if (currentMatchRef.current && channelRef.current && !isMockMode) {
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
        setCallDuration(0);
        setRequestStatus('none');
        setVideoRequestStatus('none');
        setConnectionState('none');
        setShowConnectionToast(false);
        setShowChat(false);
        setChatMessages([]);
        setIncomingExtensionRequest(false);
        setIncomingVideoRequest(false);
        setIsMockMode(false);
        setIsCaller(false);
        setAudioBlocked(false);
        setPeerConnected(false);
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

    const sendChatMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const msgId = Date.now();
        const messageText = chatInput;
        setChatMessages(prev => [...prev, { id: msgId, text: messageText, isMine: true }]);
        setChatInput('');

        if (isMockMode) {
            const replies = [
                "Haha hey! Nice to meet you! 😊",
                "Loving this voice vibe ✨",
                "What music or movies do you like? 🎶",
                "That's awesome! Let's connect on Knock Knock 🤝",
                "Haha you seem really cool!",
                "Are you enjoying the app so far? 🚀"
            ];
            setTimeout(() => {
                const randomReply = replies[Math.floor(Math.random() * replies.length)];
                setChatMessages(prev => [...prev, { id: Date.now(), text: randomReply, isMine: false }]);
            }, 1400);
            return;
        }

        if (channelRef.current && currentMatch) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'chat-message',
                payload: {
                    id: msgId,
                    senderId: user!.id,
                    receiverId: currentMatch.profile.id,
                    text: messageText,
                }
            });
        }
    };

    const isRevealed = isDirectCall || requestStatus === 'accepted';
    const displayName = currentMatch ? (isRevealed ? currentMatch.profile.name : "Mystery Match") : "";
    const displayUsername = currentMatch ? (isRevealed ? currentMatch.profile.username : "anonymous") : "";
    const displayAvatar = currentMatch ? (isRevealed ? (currentMatch.profile.avatar_url || `https://i.pravatar.cc/300?u=${currentMatch.profile.username}`) : "https://api.dicebear.com/7.x/avataaars/svg?seed=mystery&backgroundColor=ff3366") : "";

    // ── Active Call Screen ──
    if (inCall && currentMatch) {

        // ════════════════════════════════════════════════════════════
        // ── WHATSAPP-STYLE FULL-SCREEN VIDEO CALL ──
        // ════════════════════════════════════════════════════════════
        if (videoRequestStatus === 'accepted') {
            return (
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
                    {/* ── FULLSCREEN VIDEO / MAIN VIEW ── */}
                    {/* If isVideoSwapped is FALSE: Remote peer's face is full screen */}
                    {/* If isVideoSwapped is TRUE: Your face is full screen */}
                    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0b141a' }}>
                        {isVideoSwapped ? (
                            // OUR FACE FULL SCREEN
                            <>
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
                                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111b21', gap: '16px' }}>
                                        <img src={user?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'} alt="You" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.2)' }} />
                                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <CameraOff size={20} color="#ff3b30" /> Camera is off
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            // THEIR FACE FULL SCREEN
                            <>
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        display: isMockMode ? 'none' : 'block'
                                    }}
                                />
                                {/* Simulated companion video / when peer stream has not loaded yet */}
                                {isMockMode && (
                                    <div style={{
                                        width: '100%',
                                        height: '100%',
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: '#111b21',
                                        overflow: 'hidden'
                                    }}>
                                        {/* Blurred dynamic backdrop image */}
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            backgroundImage: `url(${displayAvatar})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            filter: 'blur(45px) brightness(0.4)',
                                            transform: 'scale(1.15)',
                                            zIndex: 1
                                        }} />
                                        {/* Subtle breathing companion avatar */}
                                        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    inset: -16,
                                                    borderRadius: '50%',
                                                    background: 'radial-gradient(circle, rgba(37,211,102,0.4) 0%, rgba(37,211,102,0) 70%)',
                                                    animation: 'pulse 2.2s infinite ease-in-out'
                                                }} />
                                                <img
                                                    src={displayAvatar}
                                                    alt={displayName}
                                                    style={{
                                                        width: '140px',
                                                        height: '140px',
                                                        borderRadius: '50%',
                                                        objectFit: 'cover',
                                                        border: '4px solid rgba(255,255,255,0.4)',
                                                        boxShadow: '0 12px 40px rgba(0,0,0,0.6)'
                                                    }}
                                                />
                                            </div>
                                            <h3 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 600, marginTop: '20px', marginBottom: '4px', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                                                {displayName}
                                            </h3>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                background: 'rgba(37,211,102,0.2)',
                                                border: '1px solid rgba(37,211,102,0.3)',
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                marginTop: '6px'
                                            }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#25D366', boxShadow: '0 0 8px #25D366' }} />
                                                <span style={{ color: '#25D366', fontSize: '0.8rem', fontWeight: 600 }}>Speaking • Live Audio</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Top & Bottom gradient scrims for contrast */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '140px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)', pointerEvents: 'none', zIndex: 10 }} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '220px', background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)', pointerEvents: 'none', zIndex: 10 }} />
                    </div>

                    {/* ── WHATSAPP FLOATING PiP (Tap to Switch Faces) ── */}
                    {/* If isVideoSwapped is FALSE: PiP displays OUR face */}
                    {/* If isVideoSwapped is TRUE: PiP displays THEIR face */}
                    <div
                        onClick={handleSwapVideos}
                        title="Tap to switch view"
                        style={{
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
                            transition: 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.25s ease'
                        }}
                    >
                        {isVideoSwapped ? (
                            // PiP shows THEIR face
                            <div style={{ width: '100%', height: '100%', position: 'relative', background: '#111b21' }}>
                                <img
                                    src={displayAvatar}
                                    alt={displayName}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    padding: '4px 6px',
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                    color: '#fff',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {displayName}
                                </div>
                            </div>
                        ) : (
                            // PiP shows OUR face
                            <>
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
                                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111b21' }}>
                                        <CameraOff size={24} color="#8696a0" />
                                        <span style={{ color: '#8696a0', fontSize: '0.65rem', marginTop: '4px' }}>Off</span>
                                    </div>
                                )}
                            </>
                        )}

                        {/* WhatsApp Tap-to-Swap Badge */}
                        <div style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            background: 'rgba(0,0,0,0.65)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '12px',
                            padding: '3px 6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            zIndex: 10
                        }}>
                            <RefreshCw size={10} color="#fff" />
                            <span style={{ color: '#fff', fontSize: '0.65rem', fontWeight: 600 }}>Swap</span>
                        </div>
                    </div>

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

                    {/* Audio element for WebRTC audio */}
                    <audio ref={remoteAudioRef} autoPlay playsInline style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />

                    {audioBlocked && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                if (remoteAudioRef.current) {
                                    remoteAudioRef.current.play().then(() => setAudioBlocked(false)).catch(() => {});
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

                    {/* Chat Drawer Overlay */}
                    {showChat && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                position: 'absolute',
                                bottom: '160px',
                                left: '16px',
                                right: '16px',
                                height: '380px',
                                backgroundColor: 'rgba(17, 27, 33, 0.94)',
                                backdropFilter: 'blur(20px)',
                                borderRadius: '20px',
                                border: '1px solid rgba(255,255,255,0.12)',
                                display: 'flex',
                                flexDirection: 'column',
                                zIndex: 100,
                                boxShadow: '0 24px 60px rgba(0,0,0,0.7)'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>Chat with {displayName}</span>
                                <button onClick={() => setShowChat(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '6px', color: '#fff', cursor: 'pointer' }}>
                                    <X size={16} />
                                </button>
                            </div>
                            <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {chatMessages.length === 0 && (
                                    <p style={{ textAlign: 'center', color: '#8696a0', marginTop: 'auto', marginBottom: 'auto', fontSize: '0.85rem' }}>
                                        Say hi! 👋
                                    </p>
                                )}
                                {chatMessages.map(msg => (
                                    <div
                                        key={msg.id}
                                        style={{
                                            alignSelf: msg.isMine ? 'flex-end' : 'flex-start',
                                            background: msg.isMine ? '#005c4b' : '#202c33',
                                            color: '#e9edef',
                                            padding: '8px 14px',
                                            borderRadius: '12px',
                                            maxWidth: '80%',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        {msg.text}
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={sendChatMessage} style={{ display: 'flex', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder="Type a message..."
                                    style={{ flex: 1, background: '#2a3942', border: 'none', padding: '10px 16px', borderRadius: '20px', color: '#fff', marginRight: '8px', fontSize: '0.9rem' }}
                                />
                                <button type="submit" style={{ background: '#00a884', border: 'none', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                    <Send size={18} />
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            );
        }

        // ════════════════════════════════════════════════════════════
        // ── VOICE CALL LAYOUT (Roulette / Voice Space) ──
        // ════════════════════════════════════════════════════════════
        return (
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

                    {/* Audio element with safe styling for mobile iOS/Safari */}
                    <audio
                        ref={remoteAudioRef}
                        autoPlay
                        playsInline
                        style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    />

                    {/* Tap-to-unmute banner when browser blocks autoplay */}
                    {audioBlocked && (
                        <div
                            onClick={() => {
                                if (remoteAudioRef.current) {
                                    remoteAudioRef.current.play().then(() => setAudioBlocked(false)).catch(() => {});
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

                {/* Chat Drawer */}
                {showChat && (
                    <div style={{ position: 'absolute', bottom: '120px', left: '16px', right: '16px', height: '400px', backgroundColor: 'rgba(25, 25, 25, 0.95)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', zIndex: 100, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Chat with {displayName}</span>
                            <button onClick={() => setShowChat(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '6px', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {chatMessages.length === 0 && <p style={{ textAlign: 'center', color: '#8e8e93', marginTop: 'auto', marginBottom: 'auto', fontSize: '0.9rem' }}>Say hi! 👋</p>}
                            {chatMessages.map(msg => (
                                <div key={msg.id} style={{ alignSelf: msg.isMine ? 'flex-end' : 'flex-start', background: msg.isMine ? 'var(--primary-color)' : '#333', padding: '8px 12px', borderRadius: '12px', maxWidth: '80%', fontSize: '0.9rem' }}>
                                    {msg.text}
                                </div>
                            ))}
                        </div>
                        <form onSubmit={sendChatMessage} style={{ display: 'flex', padding: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Type a message..."
                                style={{ flex: 1, background: '#111', border: 'none', padding: '10px 16px', borderRadius: '20px', color: '#fff', marginRight: '8px', fontSize: '0.9rem' }}
                            />
                            <button type="submit" style={{ background: 'var(--primary-color)', border: 'none', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
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
        );
    }

    // ── Match Card Screen ──
    if (showMatchCard && currentMatch) {
        return (
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
        );
    }

    const searchingUserCount = onlineUsers.filter((u: any) => u.status === 'searching' && u.user_id !== user?.id).length;
    const totalOnlineCount = onlineUsers.filter((u: any) => u.user_id !== user?.id).length;

    const currentHour = new Date().getHours();
    const isPeakHour = currentHour >= 20 || currentHour <= 22;

    // ── Main Search Screen ──
    return (
        <div className="call-hub-bg pb-20">
            <div className="text-center mb-8">
                <h2 className="title mb-2">Voice Roulette</h2>
                <p className="text-gray-400">Connect with similar minds securely.</p>
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
                        background: !scheduleInfo.isActive ? 'rgba(250,204,21,0.12)' : undefined,
                        border: !scheduleInfo.isActive ? '2px solid rgba(250,204,21,0.35)' : undefined
                    }}
                >
                    {isSearching ? (
                        <Loader2 size={36} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : !scheduleInfo.isActive ? (
                        <Lock size={32} color="#facc15" />
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
                            😔 Searching for more matches...
                        </p>
                        <p style={{ color: '#8e8e93', fontSize: '0.85rem', marginBottom: '16px', lineHeight: '1.4' }}>
                            Tap below to start matching with community companions!
                        </p>
                        <button
                            className="premium-btn"
                            onClick={() => {
                                setNoMatchFound(false);
                                startSearch();
                            }}
                            style={{ fontSize: '0.9rem', padding: '10px 24px' }}
                        >
                            🔄 Try Again
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

            {/* Start Matching Action Button */}
            <button
                className="premium-btn"
                onClick={startSearch}
                disabled={isSearching}
                style={{
                    opacity: isSearching ? 0.7 : !scheduleInfo.isActive ? 0.75 : 1,
                    width: '100%',
                    maxWidth: '290px',
                    justifyContent: 'center',
                    fontSize: '1.05rem',
                    padding: '14px 24px',
                    marginTop: '1rem',
                    background: !scheduleInfo.isActive ? 'linear-gradient(135deg, #2c2514, #1a150c)' : undefined,
                    border: !scheduleInfo.isActive ? '1px solid rgba(250,204,21,0.4)' : undefined,
                    color: !scheduleInfo.isActive ? '#facc15' : '#fff',
                    animation: !isSearching && scheduleInfo.isActive && totalOnlineCount > 0 ? 'btnPulse 2s ease-in-out infinite' : 'none',
                }}
            >
                {isSearching ? (
                    <>
                        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }} />
                        Finding Matches...
                    </>
                ) : !scheduleInfo.isActive ? (
                    <>
                        <Lock size={18} style={{ marginRight: '8px' }} />
                        Opens at 8:00 PM
                    </>
                ) : (
                    'Start Matching'
                )}
            </button>

            {/* ⏰ Notification / Schedule Reminder Card right below on the fourth page */}
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
                        : 'linear-gradient(135deg, rgba(250,204,21,0.12) 0%, rgba(255,51,102,0.06) 100%)',
                    borderRadius: '20px',
                    padding: '18px 20px',
                    border: scheduleInfo.isActive 
                        ? '1px solid rgba(37,211,102,0.35)' 
                        : '1px solid rgba(250,204,21,0.3)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {scheduleInfo.isActive ? (
                            <span style={{
                                background: '#34C759', width: '10px', height: '10px', borderRadius: '50%',
                                boxShadow: '0 0 10px #34C759', animation: 'pulse 1.8s infinite'
                            }} />
                        ) : (
                            <Bell size={18} color="#facc15" />
                        )}
                        <span style={{
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: scheduleInfo.isActive ? '#34C759' : '#facc15',
                            letterSpacing: '0.3px'
                        }}>
                            {scheduleInfo.isActive ? 'Voice Space is LIVE Now!' : 'Active Only 8:00 PM – 10:00 PM'}
                        </span>
                    </div>

                    <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.82rem', margin: 0, lineHeight: 1.45 }}>
                        {scheduleInfo.isActive ? (
                            <>The evening voice session is currently running! Connect and speak with users before 10:00 PM.</>
                        ) : (
                            <>The voice system only activates from <strong style={{ color: '#fff' }}>8:00 PM to 10:00 PM</strong> in the evening. Come back at 8:00 PM to connect!</>
                        )}
                    </p>

                    {/* Live Countdown Badge */}
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
                        <Clock size={15} color={scheduleInfo.isActive ? '#34C759' : '#facc15'} />
                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                            {scheduleInfo.isActive ? 'Closes in:' : 'Opens in:'}
                        </span>
                        <span style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: scheduleInfo.isActive ? '#34C759' : '#facc15',
                            letterSpacing: '1px'
                        }}>
                            {scheduleInfo.formatted}
                        </span>
                    </div>
                </div>
            </div>

            {/* 🔔 Floating Opening Reminder Toast (Shows when opening the fourth page) */}
            {showScheduleToast && (
                <div style={{
                    position: 'fixed',
                    bottom: '80px',
                    left: '16px',
                    right: '16px',
                    maxWidth: '440px',
                    margin: '0 auto',
                    zIndex: 250,
                    background: scheduleInfo.isActive 
                        ? 'linear-gradient(135deg, rgba(17, 35, 24, 0.96), rgba(11, 24, 16, 0.96))' 
                        : 'linear-gradient(135deg, rgba(38, 28, 12, 0.96), rgba(24, 16, 6, 0.96))',
                    backdropFilter: 'blur(20px)',
                    border: scheduleInfo.isActive ? '1px solid rgba(52,199,89,0.45)' : '1px solid rgba(250,204,21,0.45)',
                    borderRadius: '18px',
                    padding: '14px 18px',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
                    animation: 'slideUp 0.3s ease-out',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                }}>
                    <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: scheduleInfo.isActive ? 'rgba(52,199,89,0.2)' : 'rgba(250,204,21,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        {scheduleInfo.isActive ? <Flame size={20} color="#34C759" /> : <Clock size={20} color="#facc15" />}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {scheduleInfo.isActive ? '🟢 Voice Space is Live Now!' : '⏰ Voice System Reminder'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)', marginTop: '2px', lineHeight: 1.35 }}>
                            {scheduleInfo.isActive 
                                ? `Active now until 10:00 PM! Closes in ${scheduleInfo.formatted}.`
                                : `Voice system only activates 8:00 PM – 10:00 PM. Opens in ${scheduleInfo.formatted}.`}
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowScheduleToast(false)}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            cursor: 'pointer',
                            flexShrink: 0
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

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
    );
};

export default VoiceCall;
