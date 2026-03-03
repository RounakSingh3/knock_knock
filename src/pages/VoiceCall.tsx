import React, { useState, useEffect } from 'react';
import { Phone, Mic, MicOff, PhoneOff, Settings2, Clock, UserPlus, Video, VideoOff } from 'lucide-react';

const MATCH_PREFERENCES = [
    "Similar Likes ❤️",
    "Boy to Girl 👫",
    "Girl to Boy 👭",
    "Same Country 🌍",
    "Random 🎲"
];

const VoiceCall = () => {
    const [isSearching, setIsSearching] = useState(false);
    const [inCall, setInCall] = useState(false);
    const [activePref, setActivePref] = useState(MATCH_PREFERENCES[0]);
    const [isMuted, setIsMuted] = useState(false);
    const [callDuration, setCallDuration] = useState(0);

    // New Feature States
    const [requestStatus, setRequestStatus] = useState<'none' | 'sent' | 'accepted'>('none');
    const [isFollowed, setIsFollowed] = useState(false);
    const [isVideoActive, setIsVideoActive] = useState(false);

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
            // Automatically skip to the next person
            startSearch();
        }
    }, [callDuration, inCall, requestStatus]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleTalkMore = () => {
        setRequestStatus('sent');
        // Simulate other person accepting after 2 seconds
        setTimeout(() => {
            setRequestStatus('accepted');
            alert("They accepted your request! The 3-minute limit has been removed.");
        }, 2000);
    };

    const handleFollow = () => {
        setIsFollowed(true);
        alert("Follow request accepted! You are now friends.");
    };

    const startSearch = () => {
        setIsSearching(true);
        // Simulate finding a match after 3 seconds
        setTimeout(() => {
            setIsSearching(false);
            setInCall(true);
        }, 3000);
    };

    const endCall = () => {
        setInCall(false);
        setIsSearching(false);
        setCallDuration(0);
        setRequestStatus('none');
        setIsFollowed(false);
        setIsVideoActive(false);
    };

    if (inCall) {
        return (
            <div className="call-active-screen">
                <div className="text-center mt-8">
                    <img src="https://i.pravatar.cc/300?u=match" alt="Caller" className="call-avatar" />
                    <h2 className="text-2xl font-bold mb-2">Connected ✨</h2>
                    <p className="text-gray-400">Match based on {activePref}</p>
                    <div className="text-4xl font-mono mt-8 mb-2">
                        {formatTime(callDuration)}
                        {requestStatus !== 'accepted' && (
                            <span className="text-sm text-gray-400 block mt-2 ml-2">Limit: 3:00</span>
                        )}
                    </div>

                    {/* Time limit extension and follow features */}
                    <div className="flex flex-col items-center gap-4 mt-8" style={{ minHeight: '120px' }}>
                        {requestStatus === 'none' && (
                            <button
                                className="premium-btn text-sm px-6 py-2"
                                onClick={handleTalkMore}
                            >
                                <Clock size={16} className="mr-2" /> Request More Time
                            </button>
                        )}
                        {requestStatus === 'sent' && (
                            <div className="text-yellow-400 text-sm animate-pulse">Waiting for them to accept...</div>
                        )}
                        {requestStatus === 'accepted' && (
                            <div className="flex flex-col gap-3">
                                <span className="text-green-400 text-sm font-bold block mb-2">No Time Limit!</span>
                                <div className="flex gap-4 justify-center">
                                    <button
                                        className="pill flex items-center gap-2 bg-rgba-white-10 text-xs px-4"
                                        style={{ backgroundColor: isVideoActive ? 'var(--primary-color)' : '' }}
                                        onClick={() => setIsVideoActive(!isVideoActive)}
                                    >
                                        {isVideoActive ? <Video size={16} /> : <VideoOff size={16} />}
                                        {isVideoActive ? 'Video On' : 'Switch to Video'}
                                    </button>
                                    <button
                                        className="pill flex items-center gap-2 text-xs px-4"
                                        style={{ backgroundColor: isFollowed ? '#34C759' : '' }}
                                        onClick={handleFollow}
                                        disabled={isFollowed}
                                    >
                                        <UserPlus size={16} /> {isFollowed ? 'Friends' : 'Follow Request'}
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
                </div>
            </div>
        );
    }

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
                    <Phone size={36} />
                </div>
            </div>

            <h3 className="mb-4 font-bold flex align-center justify-center gap-2">
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
                className="premium-btn w-full max-w-xs justify-center text-lg mt-4"
                onClick={startSearch}
                disabled={isSearching}
                style={{ opacity: isSearching ? 0.7 : 1 }}
            >
                {isSearching ? 'Finding Match...' : 'Start Matching'}
            </button>
        </div>
    );
};

export default VoiceCall;
