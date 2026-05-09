import React, { useState, useEffect, useRef, useContext } from 'react';
import { Phone, Mic, MicOff, PhoneOff, Settings2, Clock, UserPlus, Video, VideoOff, Heart, Zap, Users, Loader2, SkipForward, MessageSquare, Send, X } from 'lucide-react';
import { AppContext } from '../App';
import { computeMatches, type MatchResult } from '../lib/database';

const MATCH_PREFERENCES = [
    "Similar Likes ❤️",
    "Boy to Girl 👫",
    "Girl to Boy 👭",
    "Same Country 🌍",
    "Random 🎲"
];

const VoiceCall = () => {
    const { user } = useContext(AppContext);
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
    const [isFollowed, setIsFollowed] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState<{ id: number; text: string; isMine: boolean }[]>([]);

    const currentMatch = matches[currentMatchIndex] || null;
    const localVideoRef = useRef<HTMLVideoElement>(null);

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

    // Setup local webcam when video is accepted
    useEffect(() => {
        if (videoRequestStatus === 'accepted' && localVideoRef.current) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = stream;
                    }
                })
                .catch(err => console.error("Error accessing webcam:", err));
        } else if (videoRequestStatus !== 'accepted') {
            if (localVideoRef.current && localVideoRef.current.srcObject) {
                const tracks = (localVideoRef.current.srcObject as MediaStream).getTracks();
                tracks.forEach(track => track.stop());
            }
        }
    }, [videoRequestStatus]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleTalkMore = () => {
        setRequestStatus('sent');
        setTimeout(() => setRequestStatus('accepted'), 2000);
    };

    const handleRequestVideo = () => {
        setVideoRequestStatus('sent');
        setTimeout(() => setVideoRequestStatus('accepted'), 2000);
    };

    const handleFollow = () => setIsFollowed(true);

    const startSearch = async () => {
        if (!user) return;
        setIsSearching(true);
        setNoMatchFound(false);
        setShowMatchCard(false);

        try {
            const results = await computeMatches(user.id, user.gender || '', activePref);
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

    const connectToMatch = () => {
        setShowMatchCard(false);
        setInCall(true);
    };

    const skipToNext = () => {
        if (currentMatchIndex < matches.length - 1) {
            setCurrentMatchIndex(prev => prev + 1);
            setInCall(false);
            setShowMatchCard(true);
            resetCallStates();
        } else {
            endCall();
            setNoMatchFound(true);
        }
    };

    const endCall = () => {
        setInCall(false);
        setShowMatchCard(false);
        setIsSearching(false);
        resetCallStates();
    };

    const resetCallStates = () => {
        setCallDuration(0);
        setRequestStatus('none');
        setVideoRequestStatus('none');
        setIsFollowed(false);
        setShowChat(false);
        setChatMessages([]);
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
        const newMsg = { id: Date.now(), text: chatInput, isMine: true };
        setChatMessages(prev => [...prev, newMsg]);
        setChatInput('');
        
        // Mock remote reply
        setTimeout(() => {
            setChatMessages(prev => [...prev, { id: Date.now(), text: 'Haha yeah! 😄', isMine: false }]);
        }, 1500);
    };

    // ── Active Call Screen ──
    if (inCall && currentMatch) {
        return (
            <div className="call-active-screen" style={{ position: 'relative', overflow: 'hidden' }}>
                {videoRequestStatus === 'accepted' ? (
                    // Video Call Layout
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                        {/* Remote Video (Mocked with avatar) */}
                        <div style={{ flex: 1, backgroundColor: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
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
                            <span className="match-compat-dot">•</span>
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
                            {videoRequestStatus !== 'accepted' && <span style={{ color: '#34C759', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>✅ Voice Call Extended (No Time Limit!)</span>}
                            
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
                                    className="pill"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 16px', backgroundColor: isFollowed ? '#34C759' : '' }}
                                    onClick={handleFollow}
                                    disabled={isFollowed}
                                >
                                    <UserPlus size={16} /> {isFollowed ? 'Friends' : 'Follow'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="call-controls" style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, zIndex: 10 }}>
                    <button className="call-btn btn-mute" onClick={() => setIsMuted(!isMuted)}>
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
            </div>
        );
    }

    // ── Match Card Screen ──
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

    // ── Main Search Screen ──
    return (
        <div className="call-hub-bg pb-20">
            <div className="text-center mb-8">
                <h2 className="title mb-2">Voice Roulette</h2>
                <p className="text-gray-400">Connect with similar minds securely.</p>
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
                        No matches found with this preference 😔
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


        </div>
    );
};

export default VoiceCall;
