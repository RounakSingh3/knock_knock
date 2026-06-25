import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { fetchConnections, removeConnection, updateConnectionStreak, type ConnectionWithProfile } from '../lib/database';
import { Loader2, Phone, Flame, AlertTriangle, Skull, UserMinus, ChevronRight, Users, Zap, Heart, Sparkles } from 'lucide-react';

const Connections = () => {
    const { user, blockedIds } = useContext(AppContext);
    const navigate = useNavigate();
    const [connections, setConnections] = useState<ConnectionWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [removingId, setRemovingId] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        loadConnections();
    }, [user]);

    const loadConnections = async () => {
        if (!user) return;
        setLoading(true);
        const data = await fetchConnections(user.id);
        const validConnections = data.filter(c => !blockedIds.includes(c.partner.id));
        setConnections(validConnections);
        setLoading(false);
    };

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
                <div className="connections-header-top">
                    <h1 className="connections-title">
                        <Users size={24} />
                        Connections
                    </h1>
                    <span className="connections-count">{connections.length}</span>
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
        </div>
    );
};

export default Connections;
