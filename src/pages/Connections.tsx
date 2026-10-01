import React, { useState, useEffect, useContext, Suspense, lazy } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { fetchConnections, removeConnection, updateConnectionStreak, type ConnectionWithProfile } from '../lib/database';
import { getAllKnownProfiles } from '../lib/fallbackData';
import { Loader2, Phone, Flame, AlertTriangle, Skull, UserMinus, ChevronRight, Users, Zap, Heart, Sparkles, MessageSquare } from 'lucide-react';

const ChatPanel = lazy(() => import('../components/ChatPanel'));

const Connections = () => {
    const { user, blockedIds } = useContext(AppContext);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [connections, setConnections] = useState<ConnectionWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatUserId, setChatUserId] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        loadConnections();
    }, [user?.id]);

    const loadConnections = async () => {
        if (!user) return;
        setLoading(true);
        const data = await fetchConnections(user.id);
        const validConnections = data.filter(c => !blockedIds.includes(c.profile.id));
        setConnections(validConnections);
        setLoading(false);
    };

    useEffect(() => {
        const userParam = searchParams.get('user');
        const chatParam = searchParams.get('chat');
        if (chatParam) {
            setChatUserId(chatParam);
            setIsChatOpen(true);
        } else if (userParam) {
            const clean = userParam.replace(/^@+/, '').trim().toLowerCase();
            const match = getAllKnownProfiles().find(p => p.username?.toLowerCase() === clean || p.id === userParam);
            if (match) {
                setChatUserId(match.id);
                setIsChatOpen(true);
            }
        }
    }, [searchParams]);

    const handleRemove = async (connectionId: string) => {
        setRemovingId(connectionId);
        await removeConnection(connectionId);
        setConnections(prev => prev.filter(c => c.id !== connectionId));
        setRemovingId(null);
    };

    const handleBumpStreak = async (connectionId: string) => {
        const { newStreak } = await updateConnectionStreak(connectionId);
        setConnections(prev =>
            prev.map(c =>
                c.id === connectionId
                    ? { ...c, streak_count: newStreak, streakStatus: 'active' as const, last_interaction_at: new Date().toISOString() }
                    : c
            )
        );
    };

    const getStreakIcon = (status: string) => {
        switch (status) {
            case 'active': return <Flame size={16} className="streak-icon-active" />;
            case 'at_risk': return <AlertTriangle size={16} className="streak-icon-risk" />;
            case 'broken': return <Skull size={16} className="streak-icon-broken" />;
            default: return <Flame size={16} />;
        }
    };

    const getStreakLabel = (status: string) => {
        switch (status) {
            case 'active': return 'Active';
            case 'at_risk': return 'At Risk!';
            case 'broken': return 'Broken';
            default: return '';
        }
    };

    const getTimeAgo = (dateStr: string): string => {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHrs = Math.floor(diffMins / 60);
        if (diffHrs < 24) return `${diffHrs}h ago`;
        const diffDays = Math.floor(diffHrs / 24);
        return `${diffDays}d ago`;
    };

    const activeCount = connections.filter(c => c.streakStatus === 'active').length;
    const totalStreakDays = connections.reduce((sum, c) => sum + c.streak_count, 0);

    return (
        <div className="connections-page pb-20">
            {/* Header */}
            <header className="connections-header">
                <div className="connections-header-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h1 className="connections-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                            <Users size={24} />
                            Connections
                        </h1>
                        <span className="connections-count">{connections.length}</span>
                    </div>
                    <button
                        className="connections-chat-btn"
                        onClick={() => {
                            setChatUserId(null);
                            setIsChatOpen(true);
                        }}
                        title="Open Messages"
                        style={{
                            background: 'rgba(245, 165, 36, 0.15)',
                            border: '1px solid rgba(245, 165, 36, 0.3)',
                            color: '#f5a524',
                            borderRadius: '50%',
                            width: '38px',
                            height: '38px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        <MessageSquare size={18} />
                    </button>
                </div>
                <p className="connections-subtitle">People you've matched with via Voice Roulette</p>
            </header>

            {/* Stats Bar */}
            {connections.length > 0 && (
                <div className="connections-stats-bar">
                    <div className="conn-stat-chip">
                        <Flame size={14} className="streak-icon-active" />
                        <span>{activeCount} active</span>
                    </div>
                    <div className="conn-stat-chip">
                        <Zap size={14} style={{ color: '#facc15' }} />
                        <span>{totalStreakDays} streak days</span>
                    </div>
                    <div className="conn-stat-chip">
                        <Heart size={14} style={{ color: '#f5a524' }} />
                        <span>{connections.length} total</span>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="connections-list">
                {loading ? (
                    <div className="connections-empty">
                        <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-inactive)' }} />
                    </div>
                ) : connections.length === 0 ? (
                    <div className="connections-empty">
                        <div className="connections-empty-icon">
                            <Phone size={48} />
                            <div className="connections-empty-rings">
                                <div className="conn-empty-ring" />
                                <div className="conn-empty-ring" />
                                <div className="conn-empty-ring" />
                            </div>
                        </div>
                        <h3 className="connections-empty-title">No connections yet</h3>
                        <p className="connections-empty-text">
                            Match with someone on Voice Roulette and hit "Connect" to start building streaks!
                        </p>
                        <button
                            className="premium-btn"
                            onClick={() => navigate('/call')}
                            style={{ marginTop: '1rem' }}
                        >
                            <Phone size={18} style={{ marginRight: '8px' }} />
                            Go to Voice Roulette
                        </button>
                    </div>
                ) : (
                    connections.map(conn => (
                        <div
                            key={conn.id}
                            className={`connection-card connection-card--${conn.streakStatus}`}
                        >
                            {/* Streak at risk pulse */}
                            {conn.streakStatus === 'at_risk' && (
                                <div className="connection-risk-pulse" />
                            )}

                            <div className="connection-card-main">
                                {/* Avatar */}
                                <div
                                    className={`connection-avatar-wrap connection-avatar--${conn.streakStatus}`}
                                    onClick={() => navigate(`/profile/${conn.profile.username}`)}
                                >
                                    <img
                                        src={conn.profile.avatar_url || `https://i.pravatar.cc/150?u=${conn.profile.username}`}
                                        alt={conn.profile.username}
                                        className="connection-avatar"
                                    />
                                    {conn.streakStatus === 'active' && conn.streak_count >= 3 && (
                                        <div className="connection-fire-badge">🔥</div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="connection-info">
                                    <div className="connection-name-row">
                                        <span
                                            className="connection-name"
                                            onClick={() => navigate(`/profile/${conn.profile.username}`)}
                                        >
                                            {conn.profile.name}
                                        </span>
                                        <div className={`connection-streak-badge streak-badge--${conn.streakStatus}`}>
                                            {getStreakIcon(conn.streakStatus)}
                                            <span className="streak-count">{conn.streak_count}</span>
                                        </div>
                                    </div>
                                    <span className="connection-username">@{conn.profile.username}</span>

                                    <div className="connection-meta-row">
                                        <span className="connection-compat">
                                            <Heart size={11} fill="#f5a524" color="#f5a524" />
                                            {conn.compatibility_percent}%
                                        </span>
                                        <span className="connection-meta-dot">·</span>
                                        <span className="connection-shared">{conn.shared_likes} shared</span>
                                        <span className="connection-meta-dot">·</span>
                                        <span className="connection-time">{getTimeAgo(conn.last_interaction_at)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="connection-actions">
                                {conn.streakStatus === 'at_risk' && (
                                    <button
                                        className="conn-action-btn conn-action-save"
                                        onClick={() => handleBumpStreak(conn.id)}
                                        title="Save streak!"
                                    >
                                        <Sparkles size={14} />
                                        Save
                                    </button>
                                )}
                                <button
                                    className="conn-action-btn conn-action-chat"
                                    onClick={() => {
                                        setChatUserId(conn.profile.id);
                                        setIsChatOpen(true);
                                    }}
                                    title={`Chat with ${conn.profile.name || conn.profile.username}`}
                                    style={{
                                        background: 'rgba(245, 165, 36, 0.15)',
                                        border: '1px solid rgba(245, 165, 36, 0.3)',
                                        color: '#f5a524',
                                    }}
                                >
                                    <MessageSquare size={14} />
                                </button>
                                <button
                                    className="conn-action-btn conn-action-profile"
                                    onClick={() => navigate(`/profile/${conn.profile.username}`)}
                                >
                                    <ChevronRight size={14} />
                                </button>
                                <button
                                    className={`conn-action-btn conn-action-remove ${removingId === conn.id ? 'removing' : ''}`}
                                    onClick={() => handleRemove(conn.id)}
                                    disabled={removingId === conn.id}
                                    title="Remove connection"
                                >
                                    <UserMinus size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* People on Knock Knock (Community & Friends) */}
            <div style={{ marginTop: '2.5rem', padding: '0 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={18} style={{ color: '#f5a524' }} />
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                            People on Knock Knock
                        </h2>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '12px' }}>
                        {getAllKnownProfiles().filter(p => p.id !== user?.id && p.username.toLowerCase() !== user?.username?.toLowerCase() && !blockedIds.includes(p.id)).length} Active
                    </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {getAllKnownProfiles()
                        .filter(p => p.id !== user?.id && p.username.toLowerCase() !== user?.username?.toLowerCase() && !blockedIds.includes(p.id))
                        .map((member) => (
                            <div
                                key={member.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '12px',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.07)',
                                    borderRadius: '14px',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <div
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1, minWidth: 0 }}
                                    onClick={() => navigate(`/profile/${member.username}`)}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <img
                                            src={member.avatar_url || `https://i.pravatar.cc/150?u=${member.username}`}
                                            alt={member.name}
                                            style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }}
                                        />
                                        <span
                                            style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                right: 0,
                                                width: '12px',
                                                height: '12px',
                                                borderRadius: '50%',
                                                backgroundColor: '#22c55e',
                                                border: '2px solid #0f172a',
                                            }}
                                        />
                                    </div>
                                    <div style={{ overflow: 'hidden', flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {member.name}
                                            </span>
                                            {member.points && member.points > 1000 && (
                                                <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff' }}>
                                                    VIP
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>@{member.username}</div>
                                        {member.bio && (
                                            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                                                {member.bio}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '10px' }}>
                                    <button
                                        onClick={() => navigate(`/call?partner=${member.id}`)}
                                        title={`Call ${member.name}`}
                                        style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            background: 'rgba(34, 197, 94, 0.15)',
                                            border: '1px solid rgba(34, 197, 94, 0.3)',
                                            color: '#22c55e',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <Phone size={16} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setChatUserId(member.id);
                                            setIsChatOpen(true);
                                        }}
                                        title={`Message ${member.name}`}
                                        style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            background: 'rgba(245, 165, 36, 0.15)',
                                            border: '1px solid rgba(245, 165, 36, 0.3)',
                                            color: '#f5a524',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <MessageSquare size={16} />
                                    </button>
                                    <button
                                        onClick={() => navigate(`/profile/${member.username}`)}
                                        title="View Profile"
                                        style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            color: '#cbd5e1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                </div>
            </div>

            {/* Direct Chat Panel Modal */}
            {isChatOpen && user && (
                <Suspense fallback={null}>
                    <ChatPanel
                        isOpen={isChatOpen}
                        onClose={() => {
                            setIsChatOpen(false);
                            setChatUserId(null);
                            if (searchParams.get('chat') || searchParams.get('user')) {
                                setSearchParams({}, { replace: true });
                            }
                        }}
                        currentUser={{ ...user, username: user.username || 'user' }}
                        initialOpenUserId={chatUserId}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default Connections;
