import React, { useState, useEffect, useContext } from 'react';
import { Phone, Mic, MicOff, PhoneOff, Settings2, Clock, UserPlus, Video, VideoOff, Heart, Zap, Users, Loader2, SkipForward } from 'lucide-react';
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
    const [isFollowed, setIsFollowed] = useState(false);
    const [isVideoActive, setIsVideoActive] = useState(false);

    const currentMatch = matches[currentMatchIndex] || null;

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

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleTalkMore = () => {
        setRequestStatus('sent');
        setTimeout(() => {
            setRequestStatus('accepted');
        }, 2000);
    };

    const handleFollow = () => {
        setIsFollowed(true);
    };

    const startSearch = async () => {
        if (!user) return;
        setIsSearching(true);
        setNoMatchFound(false);
        setShowMatchCard(false);

        try {
            const results = await computeMatches(
                user.id,
                (user as any).gender || '',
                activePref
            );

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
            setCallDuration(0);
            setRequestStatus('none');
            setIsFollowed(false);
            setIsVideoActive(false);
        } else {
            // No more matches
            endCall();
            setNoMatchFound(true);
        }
    };

    const endCall = () => {
        setInCall(false);
        setShowMatchCard(false);
        setIsSearching(false);
        setCallDuration(0);
        setRequestStatus('none');
        setIsFollowed(false);
        setIsVideoActive(false);
    };

    const goBack = () => {
        endCall();
        setMatches([]);
        setCurrentMatchIndex(0);
        setNoMatchFound(false);
    };

    // ── Active Call Screen ──
    if (inCall && currentMatch) {
        return (
            <div className="call-active-screen">
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
                    <div className="text-4xl font-mono" style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>
                        {formatTime(callDuration)}
                        {requestStatus !== 'accepted' && (
                            <span style={{ display: 'block', fontSize: '0.8rem', color: '#8e8e93', marginTop: '4px' }}>Limit: 3:00</span>
                        )}
                    </div>

                    {/* Time limit extension and follow features */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '2rem', minHeight: '100px' }}>
                        {requestStatus === 'none' && (
                            <button className="premium-btn" style={{ fontSize: '0.9rem', padding: '10px 20px' }} onClick={handleTalkMore}>
                                <Clock size={16} style={{ marginRight: '8px' }} /> Request More Time
                            </button>
                        )}
                        {requestStatus === 'sent' && (
                            <div style={{ color: '#facc15', fontSize: '0.85rem', animation: 'sparkle-pulse 1.5s ease-in-out infinite' }}>
                                Waiting for them to accept...
                            </div>
                        )}
                        {requestStatus === 'accepted' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                                <span style={{ color: '#34C759', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>✅ No Time Limit!</span>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                    <button
                                        className="pill"
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 16px', backgroundColor: isVideoActive ? 'var(--primary-color)' : '' }}
                                        onClick={() => setIsVideoActive(!isVideoActive)}
                                    >
                                        {isVideoActive ? <Video size={16} /> : <VideoOff size={16} />}
                                        {isVideoActive ? 'Video On' : 'Switch to Video'}
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
                </div>

                <div className="call-controls">
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

            {/* How It Works */}
            <div className="match-how-it-works">
                <h4>How Matching Works</h4>
                <div className="match-how-steps">
                    <div className="match-how-step">
                        <div className="match-how-icon" style={{ background: 'rgba(255, 51, 102, 0.15)' }}>
                            <Heart size={18} color="#ff3366" />
                        </div>
                        <span>We analyze posts you both liked</span>
                    </div>
                    <div className="match-how-step">
                        <div className="match-how-icon" style={{ background: 'rgba(250, 204, 21, 0.15)' }}>
                            <Zap size={18} color="#facc15" />
                        </div>
                        <span>Calculate compatibility score</span>
                    </div>
                    <div className="match-how-step">
                        <div className="match-how-icon" style={{ background: 'rgba(96, 165, 250, 0.15)' }}>
                            <Users size={18} color="#60a5fa" />
                        </div>
                        <span>Connect you with best matches</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoiceCall;
