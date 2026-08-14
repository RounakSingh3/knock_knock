import React, { useState, useEffect, useRef, useContext } from 'react';
import { Phone, Mic, MicOff, PhoneOff, Settings2, Clock, UserPlus, Video, VideoOff, Heart, Zap, Users, Loader2, SkipForward, MessageSquare, Send, X, Link2, Flame } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { useSearchParams } from 'react-router-dom';
import { createConnection, checkConnection, fetchProfilesByIds, type MatchResult, type ConnectionData } from '../lib/database';
import { supabase } from '../lib/supabase';

const MATCH_PREFERENCES = [
    "Similar Likes 💖",
    "Boy to Girl 👦",
    "Girl to Boy 👧",
    "Same Country 🌍",
    "Random 🎲"
];

const enhanceAudioSDP = (sdp: string | undefined): string | undefined => {
    if (!sdp) return sdp;
    // Find Opus payload type
    const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/);
    if (!opusMatch) return sdp;
    
    const pt = opusMatch[1];
    const regex = new RegExp(`a=fmtp:${pt} (.*)`);
    
    if (regex.test(sdp)) {
        return sdp.replace(regex, (match, params) => {
            if (params.includes('maxaveragebitrate')) return match;
            return `a=fmtp:${pt} ${params};stereo=1;sprop-stereo=1;maxaveragebitrate=256000;cbr=1`;
        });
    }
    return sdp;
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
    const [chatMessages, setChatMessages] = useState<{ id: number; text: string; isMine: boolean }[]>([]);

    const currentMatch = matches[currentMatchIndex] || null;
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Real-time voice call addition states
    const [isMockMode, setIsMockMode] = useState(false);
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
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    const pendingInviteRef = useRef<string | null>(null);
    const searchTimeoutRef = useRef<number | null>(null);
    const pendingOfferRef = useRef<any>(null);
    const pendingIceCandidatesRef = useRef<any[]>([]);
    const webrtcReadyRef = useRef(false);

    // State refs to give signaling callbacks the latest values
    const isSearchingRef = useRef(isSearching);
    const activePrefRef = useRef(activePref);
    const currentMatchRef = useRef(currentMatch);
    const videoRequestStatusRef = useRef(videoRequestStatus);
    const inCallRef = useRef(inCall);
    const isMockModeRef = useRef(isMockMode);
    const isCallerRef = useRef(isCaller);

    useEffect(() => { isSearchingRef.current = isSearching; }, [isSearching]);
    useEffect(() => { activePrefRef.current = activePref; }, [activePref]);
    useEffect(() => { currentMatchRef.current = currentMatch; }, [currentMatch]);
    useEffect(() => { videoRequestStatusRef.current = videoRequestStatus; }, [videoRequestStatus]);
    useEffect(() => { inCallRef.current = inCall; }, [inCall]);
    useEffect(() => { isMockModeRef.current = isMockMode; }, [isMockMode]);
    useEffect(() => { isCallerRef.current = isCaller; }, [isCaller]);
    useEffect(() => { onlineUsersRef.current = onlineUsers; }, [onlineUsers]);

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

    // Check call duration limit
    useEffect(() => {
        if (inCall && callDuration >= 180 && requestStatus !== 'accepted') {
            // Time's up — end the call (endCall handles the call-end signal)
            endCall();
        }
    }, [callDuration, inCall, requestStatus]);

    // Auto-end call if WebRTC doesn't connect within 15 seconds
    useEffect(() => {
        if (!inCall || peerConnected) return;
        const timeout = setTimeout(() => {
            if (!peerConnected && inCallRef.current) {
                console.log('[VoiceCall] No peer connection after 15s, ending call');
                endCall();
                setNoMatchFound(true);
            }
        }, 15000);
        return () => clearTimeout(timeout);
    }, [inCall, peerConnected]);

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

    // ÔöÇÔöÇ Supabase Realtime channel subscription ÔöÇÔöÇ
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
                    // Verify the caller is still actually searching (check presence)
                    const callerPresence = onlineUsersRef.current.find(
                        (u: any) => u.user_id === payload.callerId
                    );
                    if (!callerPresence || callerPresence.status !== 'searching') {
                        // Caller is no longer searching — ignore stale invite
                        console.log('[VoiceCall] Ignoring stale call-invite, caller no longer searching');
                        return;
                    }

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
                    // Auto-connect: go straight into the call (no manual click needed)
                    setShowMatchCard(false);
                    setInCall(true);
                    setPeerConnected(false);
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
                // Accept from anyone we invited (not just the last one) — as long as we're still searching
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
                    // Auto-connect: go straight into the call
                    setShowMatchCard(false);
                    setInCall(true);
                    setPeerConnected(false);
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
            .on('broadcast', { event: 'peer-arrived' }, async ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                if (isCallerRef.current) {
                    // Caller sends offer now that receiver is ready
                    const pc = peerConnectionRef.current;
                    if (pc && pc.signalingState === 'stable') {
                        try {
                            const offer = await pc.createOffer();
                            offer.sdp = enhanceAudioSDP(offer.sdp);
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
                    // Receiver tells caller they are also ready
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
                            offer.sdp = enhanceAudioSDP(offer.sdp);
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
                        // Handle offer collision: if we already have a local description,
                        // we need to rollback first (polite peer pattern)
                        if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
                            console.warn('[WebRTC] Unexpected signaling state for offer:', pc.signalingState);
                        }
                        if (pc.signalingState === 'have-local-offer') {
                            // We're the impolite peer if caller, polite if receiver
                            if (!isCallerRef.current) {
                                await pc.setLocalDescription({ type: 'rollback' });
                            } else {
                                // As caller, ignore incoming offer (we take priority)
                                return;
                            }
                        }
                        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                        const answer = await pc.createAnswer();
                        answer.sdp = enhanceAudioSDP(answer.sdp);
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
                        // Drain any queued ICE candidates now that remote description is set
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
                    // PC not ready yet — queue the offer for when startWebRTC runs
                    pendingOfferRef.current = payload.sdp;
                }
            })
            .on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                if (peerConnectionRef.current) {
                    try {
                        if (peerConnectionRef.current.signalingState === 'stable') {
                            console.warn('[WebRTC] Ignoring answer — already stable');
                            return;
                        }
                        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                        // Drain any ICE candidates that arrived before remote description was set
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
                    // Queue candidate — will be drained when remote description is set
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
            if (!inCall || isMockMode || !currentMatch) return;
            closeWebRTC();
    
            try {
                const isVideo = videoRequestStatus === 'accepted';
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,   // Keep ON for clear audio (filters background noise)
                        autoGainControl: true,     // Keep ON to normalize volume levels
                        sampleRate: 48000,
                        channelCount: 1,           // Mono is better for voice calls (less bandwidth, clearer)
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
                    // Free TURN servers for NAT traversal
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

                    // Attach audio to a dedicated audio-only stream for reliable playback
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

                    // Attach video track when in video mode
                    if (event.track.kind === 'video' && remoteVideoRef.current) {
                        const videoStream = new MediaStream();
                        // Add all tracks from the remote stream to keep audio+video in sync
                        remoteStream.getTracks().forEach(t => videoStream.addTrack(t));
                        remoteVideoRef.current.srcObject = videoStream;
                    }
                };

                // Monitor connection state and attempt ICE restart on failure
                pc.onconnectionstatechange = () => {
                    console.log('[WebRTC] Connection state:', pc.connectionState);
                    if (pc.connectionState === 'connected') {
                        setPeerConnected(true);
                    } else if (pc.connectionState === 'failed') {
                        console.log('[WebRTC] Connection failed, attempting ICE restart...');
                        if (isCallerRef.current && channelRef.current && currentMatchRef.current) {
                            pc.restartIce();
                            pc.createOffer({ iceRestart: true }).then(offer => {
                                offer.sdp = enhanceAudioSDP(offer.sdp);
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
                pc.oniceconnectionstatechange = () => {
                    console.log('[WebRTC] ICE state:', pc.iceConnectionState);
                    if (pc.iceConnectionState === 'disconnected') {
                        // Give it a few seconds to recover before declaring failure
                        setTimeout(() => {
                            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                                console.log('[WebRTC] ICE still disconnected/failed after timeout');
                            }
                        }, 5000);
                    }
                };

                // Mark WebRTC as ready so signaling callbacks know the PC exists
                webrtcReadyRef.current = true;

                // Process any pending offer that arrived before PC was created
                if (!isCaller && pendingOfferRef.current) {
                    try {
                        await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
                        const answer = await pc.createAnswer();
                        answer.sdp = enhanceAudioSDP(answer.sdp);
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
    }, [inCall, isMockMode, isCaller, currentMatch?.profile?.id]);

    // Handle video upgrade separately — add video track to existing connection
    useEffect(() => {
        if (videoRequestStatus !== 'accepted' || !peerConnectionRef.current || !localStreamRef.current || !user) return;
        const pc = peerConnectionRef.current;

        // Check if we already have a video track
        const senders = pc.getSenders();
        const hasVideoSender = senders.some(s => s.track?.kind === 'video');
        if (hasVideoSender) return;

        (async () => {
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const videoTrack = videoStream.getVideoTracks()[0];
                if (videoTrack) {
                    // Add video track to existing peer connection
                    pc.addTrack(videoTrack, localStreamRef.current!);
                    localStreamRef.current!.addTrack(videoTrack);

                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = localStreamRef.current;
                    }

                    // Renegotiate with the peer
                    if (isCallerRef.current && channelRef.current && currentMatchRef.current) {
                        const offer = await pc.createOffer();
                        offer.sdp = enhanceAudioSDP(offer.sdp);
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
    }, [videoRequestStatus]);

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
            }, 1500);
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

    const handleConnect = async () => {
        if (!user || !currentMatch || connectionState === 'connecting' || connectionState === 'connected') return;
        setConnectionState('connecting');
        
        // Check if already connected
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

    const startCompanionCall = async () => {
        if (!user || !isSearchingRef.current) return;
        try {
            const { data: dbProfiles } = await supabase
                .from('profiles')
                .select('*')
                .neq('id', user.id)
                .limit(40);

            let candidates = (dbProfiles || []).filter(p => !blockedIds.includes(p.id));

            if (activePrefRef.current === 'Boy to Girl 👦') {
                const females = candidates.filter(p => p.gender === 'female');
                if (females.length > 0) candidates = females;
            } else if (activePrefRef.current === 'Girl to Boy 👧') {
                const males = candidates.filter(p => p.gender === 'male');
                if (males.length > 0) candidates = males;
            }

            if (candidates.length === 0) {
                candidates = [
                    { id: '11111111-1111-1111-1111-111111111101', username: 'priya_patel99', name: 'Priya Patel', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300', gender: 'female', points: 450 },
                    { id: '11111111-1111-1111-1111-111111111102', username: 'aditya_ps', name: 'Aditya Pratap', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300', gender: 'male', points: 520 },
                    { id: '11111111-1111-1111-1111-111111111103', username: 'neha_creates', name: 'Neha Sharma', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300', gender: 'female', points: 380 },
                    { id: '11111111-1111-1111-1111-111111111104', username: 'zack_kumar', name: 'Zack', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300', gender: 'male', points: 610 },
                ];
            }

            const chosen = candidates[Math.floor(Math.random() * candidates.length)];
            const compat = Math.floor(Math.random() * 18) + 82; // 82 - 99%
            const shared = Math.floor(Math.random() * 3) + 2;   // 2 - 4

            setMatches([{
                profile: chosen,
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
            updatePresence('in-call');
        } catch (e) {
            console.error('Error in companion match:', e);
            setNoMatchFound(true);
            setIsSearching(false);
        }
    };

    const startSearch = async () => {
        if (!user) return;
        setIsSearching(true);
        setNoMatchFound(false);
        setShowMatchCard(false);
        setIsMockMode(false);
        setIsCaller(false);

        await updatePresence('searching');

        // Check if there is already an online user matching our preference
        const searchForOnlineMatch = () => {
            const match = onlineUsers.find(u => {
                if (u.user_id === user.id) return false;
                if (blockedIds.includes(u.user_id)) return false;
                if (u.status !== 'searching') return false;
                
                // Match gender based on active preference
                if (activePref === 'Boy to Girl 👦') {
                    if (u.gender !== 'female') return false;
                } else if (activePref === 'Girl to Boy 👧') {
                    if (u.gender !== 'male') return false;
                }
                
                // Also check if we match their preference
                if (u.preference === 'Boy to Girl 👦') {
                    if (user.gender !== 'female') return false;
                } else if (u.preference === 'Girl to Boy 👧') {
                    if (user.gender !== 'male') return false;
                }
                
                return true;
            });
            return match;
        };

        const onlineMatch = searchForOnlineMatch();
        if (onlineMatch) {
            pendingInviteRef.current = onlineMatch.user_id;
            
            const compat = Math.floor(Math.random() * 20) + 80; // 80 - 99%
            const shared = Math.floor(Math.random() * 4) + 1; // 1 - 4
            
            channelRef.current.send({
                type: 'broadcast',
                event: 'call-invite',
                payload: {
                    callerId: user.id,
                    receiverId: onlineMatch.user_id,
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

            searchTimeoutRef.current = window.setTimeout(() => {
                if (isSearchingRef.current) {
                    startCompanionCall();
                }
            }, 3500);
        } else {
            // Wait 3.5s for real peers; if none searching, connect with community companion seamlessly
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
        await updatePresence('in-call');
    };

    const skipToNext = () => {
        // Send call-end to the current partner
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
        pendingInviteRef.current = null;
        pendingOfferRef.current = null;
        pendingIceCandidatesRef.current = [];
        webrtcReadyRef.current = false;
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
            searchTimeoutRef.current = null;
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

    // ÔöÇÔöÇ Active Call Screen ÔöÇÔöÇ
    if (inCall && currentMatch) {
        return (
            <div className="call-active-screen" style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100dvh' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                    {videoRequestStatus === 'accepted' ? (
                        // Video Call Layout
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                            {/* Remote Video */}
                            <div style={{ flex: 1, backgroundColor: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            </div>

                            {/* Local Video */}
                            <div style={{ position: 'absolute', top: '16px', right: '16px', width: '100px', height: '140px', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)' }}>
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            </div>
                        </div>
                    ) : (
                        // Voice Call Layout
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, width: '100%', minHeight: 'min-content', padding: '24px 0' }}>
                            <img
                                src={displayAvatar}
                                alt={displayUsername}
                                className="call-avatar"
                                style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(255,51,102,0.3)' }}
                            />
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
                    )}
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
                    {requestStatus === 'accepted' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', background: videoRequestStatus === 'accepted' ? 'transparent' : 'rgba(0,0,0,0.5)', padding: '16px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                            {videoRequestStatus !== 'accepted' && <span style={{ color: '#34C759', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Ô£à Voice Call Extended (No Time Limit!)</span>}
                            
                            {videoRequestStatus === 'none' && (
                                <button
                                    className="pill"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 16px' }}
                                    onClick={handleRequestVideo}
                                >
                                    <Video size={16} /> Request Video Call
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
                                        <><Link2 size={16} /> Connected ­ƒñØ</>
                                    ) : connectionState === 'already' ? (
                                        <><Link2 size={16} /> Already Connected</>
                                    ) : (
                                        <><Link2 size={16} /> Connect ­ƒñØ</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Connection Success Toast */}
                {showConnectionToast && (
                    <div className="connection-toast">
                        <div className="connection-toast-inner">
                            <Flame size={20} className="streak-icon-active" />
                            <div>
                                <strong>Connected with {displayName}!</strong>
                                <span>­ƒöÑ Streak started ÔÇö Day 1!</span>
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

                {/* Audio elements */}
                <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

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

                {/* Call Controls Grouped into the bottom wrapper above */}
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
                            {chatMessages.length === 0 && <p style={{ textAlign: 'center', color: '#8e8e93', marginTop: 'auto', marginBottom: 'auto', fontSize: '0.9rem' }}>Say hi! ­ƒæï</p>}
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
            </div>
        );
    }

    // ÔöÇÔöÇ Match Card Screen ÔöÇÔöÇ
    if (showMatchCard && currentMatch) {
        return (
            <div className="call-hub-bg pb-20">
                <div className="match-card-wrapper">
                    <div className="match-card">
                        {/* Avatar */}
                        <div className="match-card-avatar-ring">
                            <img
                                src={displayAvatar}
                                alt={displayUsername}
                                className="match-card-avatar"
                            />
                        </div>

                        {/* Compatibility Circle */}
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

                        {/* User Info */}
                        <h2 className="match-card-name">{displayName}</h2>
                        <p className="match-card-username">@{displayUsername}</p>

                        {/* Stats */}
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

                        {/* Actions */}
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

    // Count online users (for FOMO)
    const searchingUserCount = onlineUsers.filter((u: any) => u.status === 'searching' && u.user_id !== user?.id).length;
    const totalOnlineCount = onlineUsers.filter((u: any) => u.user_id !== user?.id).length;

    // Peak hours insight
    const currentHour = new Date().getHours();
    const isPeakHour = currentHour >= 20 || currentHour <= 22; // 8-10 PM

    // ── Main Search Screen ──
    return (
        <div className="call-hub-bg pb-20">
            <div className="text-center mb-8">
                <h2 className="title mb-2">Voice Roulette</h2>
                <p className="text-gray-400">Connect with similar minds securely.</p>
            </div>

            {/* 🟢 FOMO — Live Online Counter */}
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

            <div className="match-radar">
                {isSearching && (
                    <>
                        <div className="radar-ring"></div>
                        <div className="radar-ring"></div>
                        <div className="radar-ring"></div>
                    </>
                )}
                <div className="radar-center">
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
                            😔 No one is available right now
                        </p>
                        <p style={{ color: '#8e8e93', fontSize: '0.85rem', marginBottom: '16px', lineHeight: '1.4' }}>
                            We only match you with real people who are online and searching. No fake calls!
                        </p>
                        <button
                            className="premium-btn"
                            onClick={() => {
                                setNoMatchFound(false);
                                retrySearchCountRef.current = 0;
                                startSearch();
                            }}
                            style={{ fontSize: '0.9rem', padding: '10px 24px' }}
                        >
                            🔄 Try Again
                        </button>
                        <p style={{ color: '#6e6e73', fontSize: '0.75rem', marginTop: '12px' }}>
                            💡 Peak hours: 8 PM - 10 PM • More users online then!
                        </p>
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

            {/* 🎰 Pulsing Search Button — urgency animation when users are online */}
            <button
                className="premium-btn"
                onClick={startSearch}
                disabled={isSearching}
                style={{
                    opacity: isSearching ? 0.7 : 1,
                    width: '100%',
                    maxWidth: '280px',
                    justifyContent: 'center',
                    fontSize: '1.1rem',
                    padding: '14px 24px',
                    marginTop: '1rem',
                    animation: !isSearching && totalOnlineCount > 0 ? 'btnPulse 2s ease-in-out infinite' : 'none',
                }}
            >
                {isSearching ? (
                    <>
                        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }} />
                        Finding Matches...
                    </>
                ) : (
                    'Start Matching'
                )}
            </button>

            {/* 💡 Peak Hours Insight — drives return visits */}
            <div style={{
                textAlign: 'center', marginTop: '1.5rem', padding: '0 32px',
            }}>
                {isPeakHour ? (
                    <p style={{ color: '#34C759', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Flame size={12} /> Peak hour! Most users are active now
                    </p>
                ) : (
                    <p style={{ color: '#6e6e73', fontSize: '0.8rem' }}>
                        💡 Peak hours: 8 PM - 10 PM • Come back for more matches!
                    </p>
                )}
            </div>

            {/* Pulsing button animation */}
            <style>{`
                @keyframes btnPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(255,51,102,0.4); }
                    50% { box-shadow: 0 0 0 12px rgba(255,51,102,0); }
                }
            `}</style>

        </div>
    );
};

export default VoiceCall;
