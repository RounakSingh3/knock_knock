import React, { useState, useEffect, useRef, useContext } from 'react';
import { Phone, Mic, MicOff, PhoneOff, Settings2, Clock, UserPlus, Video, VideoOff, Heart, Zap, Users, Loader2, SkipForward, MessageSquare, Send, X, Link2, Flame } from 'lucide-react';
import { AppContext } from '../App';
import { useSearchParams } from 'react-router-dom';
import { computeMatches, createConnection, checkConnection, fetchProfilesByIds, type MatchResult, type ConnectionData } from '../lib/database';
import { supabase } from '../lib/supabase';

const MATCH_PREFERENCES = [
    "Similar Likes 💖",
    "Boy to Girl 👦",
    "Girl to Boy 👧",
    "Same Country 🌍",
    "Random 🎲"
];

const VoiceCall = () => {
    const { user } = useContext(AppContext);
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

    const channelRef = useRef<any>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    const pendingInviteRef = useRef<string | null>(null);
    const searchTimeoutRef = useRef<number | null>(null);

    // State refs to give signaling callbacks the latest values
    const isSearchingRef = useRef(isSearching);
    const activePrefRef = useRef(activePref);
    const currentMatchRef = useRef(currentMatch);
    const videoRequestStatusRef = useRef(videoRequestStatus);
    const inCallRef = useRef(inCall);
    const isMockModeRef = useRef(isMockMode);

    useEffect(() => { isSearchingRef.current = isSearching; }, [isSearching]);
    useEffect(() => { activePrefRef.current = activePref; }, [activePref]);
    useEffect(() => { currentMatchRef.current = currentMatch; }, [currentMatch]);
    useEffect(() => { videoRequestStatusRef.current = videoRequestStatus; }, [videoRequestStatus]);
    useEffect(() => { inCallRef.current = inCall; }, [inCall]);
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
                profile: partnerProfile,
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
            endCall();
            skipToNext();
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
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
        }
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
                    setShowMatchCard(true);

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
                if (payload.receiverId !== user.id) return;
                if (isSearchingRef.current && pendingInviteRef.current === payload.receiverId) {
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
                    setShowMatchCard(true);
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
            .on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                if (peerConnectionRef.current) {
                    try {
                        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                        const answer = await peerConnectionRef.current.createAnswer();
                        await peerConnectionRef.current.setLocalDescription(answer);
                        channel.send({
                            type: 'broadcast',
                            event: 'webrtc-answer',
                            payload: {
                                senderId: user.id,
                                receiverId: payload.senderId,
                                sdp: answer,
                            }
                        });
                    } catch (e) {
                        console.error('Error handling WebRTC offer:', e);
                    }
                }
            })
            .on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                if (peerConnectionRef.current) {
                    try {
                        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                    } catch (e) {
                        console.error('Error handling WebRTC answer:', e);
                    }
                }
            })
            .on('broadcast', { event: 'webrtc-ice' }, async ({ payload }) => {
                if (payload.receiverId !== user.id) return;
                if (peerConnectionRef.current) {
                    try {
                        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    } catch (e) {
                        console.error('Error handling ICE candidate:', e);
                    }
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

    // ÔöÇÔöÇ WebRTC Connection Management ÔöÇÔöÇ
    useEffect(() => {
        const startWebRTC = async () => {
            if (!inCall || isMockMode || !currentMatch) return;
            closeWebRTC();

            try {
                const isVideo = videoRequestStatus === 'accepted';
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: isVideo
                });
                localStreamRef.current = stream;

                if (isVideo && localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
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
                    if (isVideo) {
                        if (remoteVideoRef.current) {
                            remoteVideoRef.current.srcObject = remoteStream;
                        }
                    } else {
                        if (remoteAudioRef.current) {
                            remoteAudioRef.current.srcObject = remoteStream;
                        }
                    }
                };

                if (isCaller) {
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
                }
            } catch (e) {
                console.error('Failed to capture stream or create RTCPeerConnection:', e);
            }
        };

        startWebRTC();

        return () => {
            closeWebRTC();
        };
    }, [inCall, isMockMode, videoRequestStatus, isCaller, currentMatch?.profile?.id]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleTalkMore = () => {
        if (isMockMode) {
            setRequestStatus('sent');
            setTimeout(() => setRequestStatus('accepted'), 2000);
        } else {
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
        }
    };

    const handleRequestVideo = () => {
        if (isMockMode) {
            setVideoRequestStatus('sent');
            setTimeout(() => setVideoRequestStatus('accepted'), 2000);
        } else {
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
                startMockMatching();
            }, 3500);
        } else {
            searchTimeoutRef.current = window.setTimeout(() => {
                startMockMatching();
            }, 3500);
        }
    };

    const startMockMatching = async () => {
        setIsMockMode(true);
        setIsSearching(true);
        setNoMatchFound(false);
        setShowMatchCard(false);

        try {
            const results = await computeMatches(user!.id, user!.gender || '', activePref);
            if (results.length === 0) {
                setNoMatchFound(true);
                setIsSearching(false);
                return;
            }
            setMatches(results);
            setCurrentMatchIndex(0);
            setIsSearching(false);
            setShowMatchCard(true);
        } catch (err) {
            console.error('Matching error:', err);
            setIsSearching(false);
            setNoMatchFound(true);
        }
    };

    const connectToMatch = async () => {
        setShowMatchCard(false);
        setInCall(true);
        await updatePresence('in-call');
    };

    const skipToNext = () => {
        if (!isMockModeRef.current && currentMatchRef.current && channelRef.current) {
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

        if (currentMatchIndex < matches.length - 1) {
            setCurrentMatchIndex(prev => prev + 1);
            setInCall(false);
            setShowMatchCard(true);
            resetCallStates();
            updatePresence('in-call');
        } else {
            endCall();
            setNoMatchFound(true);
        }
    };

    const endCall = () => {
        if (!isMockModeRef.current && currentMatchRef.current && channelRef.current) {
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
        pendingInviteRef.current = null;
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

        if (isMockMode) {
            const newMsg = { id: Date.now(), text: chatInput, isMine: true };
            setChatMessages(prev => [...prev, newMsg]);
            setChatInput('');
            
            setTimeout(() => {
                setChatMessages(prev => [...prev, { id: Date.now(), text: 'Haha yeah! ­ƒÿä', isMine: false }]);
            }, 1500);
        } else {
            const msgId = Date.now();
            setChatMessages(prev => [...prev, { id: msgId, text: chatInput, isMine: true }]);
            const messageText = chatInput;
            setChatInput('');
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
        }
    };

    // ÔöÇÔöÇ Active Call Screen ÔöÇÔöÇ
    if (inCall && currentMatch) {
        return (
            <div className="call-active-screen" style={{ position: 'relative', overflow: 'hidden' }}>
                {videoRequestStatus === 'accepted' ? (
                    // Video Call Layout
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                        {/* Remote Video */}
                        <div style={{ flex: 1, backgroundColor: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            {!isMockMode ? (
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <>
                                    <img
                                        src={currentMatch.profile.avatar_url || `https://i.pravatar.cc/300?u=${currentMatch.profile.username}`}
                                        alt={currentMatch.profile.username}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5, filter: 'blur(20px)' }}
                                    />
                                    <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <img
                                            src={currentMatch.profile.avatar_url || `https://i.pravatar.cc/300?u=${currentMatch.profile.username}`}
                                            alt=""
                                            style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }}
                                        />
                                        <span style={{ marginTop: '8px', fontWeight: 'bold' }}>{currentMatch.profile.name} (Camera Off)</span>
                                    </div>
                                </>
                            )}
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
                    <div className="text-center mt-8">
                        <img
                            src={currentMatch.profile.avatar_url || `https://i.pravatar.cc/300?u=${currentMatch.profile.username}`}
                            alt={currentMatch.profile.username}
                            className="call-avatar"
                        />
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '4px' }}>
                            {currentMatch.profile.name}
                        </h2>
                        <p className="text-gray-400" style={{ fontSize: '0.9rem' }}>
                            @{currentMatch.profile.username}
                        </p>
                        <div className="match-compat-inline">
                            <Heart size={14} fill="#ff3366" color="#ff3366" />
                            <span>{currentMatch.compatibilityPercent}% Compatible</span>
                            <span className="match-compat-dot">ÔÇó</span>
                            <span>{currentMatch.sharedLikes} shared likes</span>
                        </div>
                    </div>
                )}

                <div className="text-center" style={{ position: 'absolute', top: '240px', left: 0, right: 0, zIndex: 10 }}>
                    <div className="text-4xl font-mono" style={{ display: videoRequestStatus === 'accepted' ? 'none' : 'block' }}>
                        {formatTime(callDuration)}
                        {requestStatus !== 'accepted' && (
                            <span style={{ display: 'block', fontSize: '0.8rem', color: '#8e8e93', marginTop: '4px' }}>Voice Limit: 3:00</span>
                        )}
                    </div>
                </div>

                {/* Status and Action Buttons */}
                <div style={{ position: 'absolute', bottom: '100px', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', zIndex: 10 }}>
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
                                <strong>Connected with {currentMatch.profile.name}!</strong>
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
                                <span><strong>{currentMatch.profile.name} wants more time!</strong></span>
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
                                <span><strong>{currentMatch.profile.name} wants to switch to Video!</strong></span>
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
                <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

                <div className="call-controls" style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, zIndex: 10 }}>
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

                {/* Chat Drawer */}
                {showChat && (
                    <div style={{ position: 'absolute', bottom: '90px', left: '16px', right: '16px', height: '300px', backgroundColor: 'rgba(25, 25, 25, 0.95)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', zIndex: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <span style={{ fontWeight: 'bold' }}>Chat with {currentMatch.profile.name}</span>
                            <button onClick={() => setShowChat(false)}><X size={18} /></button>
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
                                src={currentMatch.profile.avatar_url || `https://i.pravatar.cc/300?u=${currentMatch.profile.username}`}
                                alt={currentMatch.profile.username}
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
                        <h2 className="match-card-name">{currentMatch.profile.name}</h2>
                        <p className="match-card-username">@{currentMatch.profile.username}</p>

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
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <p style={{ color: '#ff9933', fontSize: '0.9rem', marginBottom: '8px' }}>
                        No matches found with this preference 😖
                    </p>
                    <p style={{ color: '#6e6e73', fontSize: '0.8rem' }}>
                        Try a different preference or check back later!
                    </p>
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
