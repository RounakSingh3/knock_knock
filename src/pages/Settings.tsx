import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import {
    User,
    Zap,
    LogOut,
    ChevronRight,
    Star,
    PlusSquare,
} from 'lucide-react';

const Settings = () => {
    const { user, points, signOut } = useContext(AppContext);
    const navigate = useNavigate();

    if (!user) return null;

    const username = user.username || 'user';

    const rows: { icon: React.ReactNode; label: string; sub?: string; onClick: () => void }[] = [
        {
            icon: <User size={22} />,
            label: 'My Profile',
            sub: `@${username}`,
            onClick: () => navigate(`/profile/${username}`),
        },
        {
            icon: <Zap size={22} />,
            label: 'Boost & Stories',
            sub: 'Snaps, streaks, and boost points',
            onClick: () => navigate('/stories'),
        },
        {
            icon: <PlusSquare size={22} />,
            label: 'Create Post',
            sub: 'Share photos or videos',
            onClick: () => navigate('/create'),
        },
    ];

    return (
        <div className="profile-page pb-20">
            <header className="home-header">
                <h1 className="font-bold text-xl">Settings</h1>
            </header>

            <div style={{ padding: '1rem' }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '16px',
                        background: '#1c1c1e',
                        borderRadius: '16px',
                        marginBottom: '20px',
                    }}
                >
                    <img
                        src={user.avatar_url || `https://i.pravatar.cc/150?u=${username}`}
                        alt=""
                        style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                        <div className="font-bold">{user.name || username}</div>
                        <div style={{ color: '#8e8e93', fontSize: '14px' }}>@{username}</div>
                        <div
                            style={{
                                marginTop: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                color: '#ff3366',
                                fontSize: '13px',
                                fontWeight: 700,
                            }}
                        >
                            <Star size={14} fill="#ff3366" /> {points} Boost Points
                        </div>
                    </div>
                </div>

                <div style={{ background: '#1c1c1e', borderRadius: '16px', overflow: 'hidden' }}>
                    {rows.map((row, i) => (
                        <button
                            key={row.label}
                            type="button"
                            onClick={row.onClick}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '14px',
                                padding: '16px',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: i < rows.length - 1 ? '1px solid #2c2c2e' : 'none',
                                color: '#fff',
                                cursor: 'pointer',
                                textAlign: 'left',
                            }}
                        >
                            <span style={{ color: '#ff3366' }}>{row.icon}</span>
                            <span style={{ flex: 1 }}>
                                <div className="font-bold" style={{ fontSize: '15px' }}>
                                    {row.label}
                                </div>
                                {row.sub && (
                                    <div style={{ color: '#8e8e93', fontSize: '12px', marginTop: '2px' }}>
                                        {row.sub}
                                    </div>
                                )}
                            </span>
                            <ChevronRight size={20} color="#8e8e93" />
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={signOut}
                    style={{
                        width: '100%',
                        marginTop: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        padding: '16px',
                        background: 'rgba(255, 59, 48, 0.15)',
                        border: '1px solid rgba(255, 59, 48, 0.3)',
                        borderRadius: '16px',
                        color: '#ff3b30',
                        fontWeight: 700,
                        fontSize: '16px',
                        cursor: 'pointer',
                    }}
                >
                    <LogOut size={20} />
                    Log Out
                </button>
            </div>
        </div>
    );
};

export default Settings;
