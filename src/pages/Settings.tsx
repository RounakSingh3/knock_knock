import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { fetchConnections, fetchFollowCounts, fetchUserPosts, deletePost, type PostData } from '../lib/database';
import { isVideoPost } from '../lib/media';
import PostMedia from '../components/PostMedia';
import {
    User,
    Zap,
    LogOut,
    ChevronRight,
    Star,
    PlusSquare,
    Flame,
    Users,
    HelpCircle,
    Image,
    UserPlus,
    UserCheck,
    Grid,
    Heart,
    MessageCircle,
    Send
} from 'lucide-react';

const Settings = () => {
    const { user, points, signOut } = useContext(AppContext);
    const navigate = useNavigate();
    
    const [connectionsCount, setConnectionsCount] = useState<number>(0);
    const [followersCount, setFollowersCount] = useState<number>(0);
    const [followingCount, setFollowingCount] = useState<number>(0);
    const [photosCount, setPhotosCount] = useState<number>(0);
    const [userPosts, setUserPosts] = useState<PostData[]>([]);
    const [loadingStats, setLoadingStats] = useState(true);

    useEffect(() => {
        if (user && user.id && user.username) {
            setLoadingStats(true);
            Promise.all([
                fetchConnections(user.id),
                fetchFollowCounts(user.id),
                fetchUserPosts(user.username)
            ])
                .then(([conns, followData, posts]) => {
                    setConnectionsCount(conns.length);
                    setFollowersCount(followData.followers);
                    setFollowingCount(followData.following);
                    
                    // Filter posts to only count photos (non-videos)
                    const photos = posts.filter(p => !isVideoPost(p));
                    setPhotosCount(photos.length);
                    setUserPosts(posts);
                    
                    setLoadingStats(false);
                })
                .catch(err => {
                    console.error('Error fetching settings stats:', err);
                    setLoadingStats(false);
                });
        }
    }, [user]);

    if (!user) return null;

    const username = user.username || 'user';
    const streakCount = user.streak_count || 0;

    // Helper to get rank name based on points
    const getRankName = (pts: number) => {
        if (pts < 100) return 'Bronze Matcher 🥉';
        if (pts < 500) return 'Silver Matcher 🥈';
        if (pts < 2000) return 'Gold Matcher 🥇';
        return 'Cyber Matcher 👑';
    };

    const accountRows = [
        {
            icon: <User size={20} />,
            label: 'My Profile',
            sub: `@${username}`,
            iconColor: '#06b6d4',
            bgLight: 'rgba(6, 182, 212, 0.1)',
            onClick: () => navigate(`/profile/${username}`),
        },
        {
            icon: <Users size={20} />,
            label: 'My Connections',
            sub: loadingStats ? 'Loading connections...' : `${connectionsCount} matched connections`,
            iconColor: '#8b5cf6',
            bgLight: 'rgba(139, 92, 246, 0.1)',
            onClick: () => navigate('/connections'),
        },
    ];

    const featureRows = [
        {
            icon: <Zap size={20} />,
            label: 'Boost & Stories',
            sub: 'Snaps, streaks, and match boosts',
            iconColor: '#f59e0b',
            bgLight: 'rgba(245, 158, 11, 0.1)',
            onClick: () => navigate('/stories'),
        },
        {
            icon: <PlusSquare size={20} />,
            label: 'Create Post',
            sub: 'Share photos or video reels',
            iconColor: '#ec4899',
            bgLight: 'rgba(236, 72, 153, 0.1)',
            onClick: () => navigate('/create'),
        },
    ];

    return (
        <div className="profile-page pb-20">
            {/* Header */}
            <header className="home-header">
                <h1 className="font-bold text-xl" style={{ fontFamily: "'Sora', sans-serif" }}>Settings</h1>
            </header>

            <div className="settings-container">
                {/* Premium User Card */}
                <div className="profile-card-premium">
                    <div className="profile-card-header">
                        <div className="avatar-container-premium">
                            <img
                                src={user.avatar_url || `https://i.pravatar.cc/150?u=${username}`}
                                alt={user.name || username}
                                className="avatar-image-premium"
                            />
                            <div className="gender-badge-premium">
                                {user.gender === 'male' ? '♂️' : user.gender === 'female' ? '♀️' : '🌈'}
                            </div>
                        </div>

                        <div className="user-meta-premium">
                            <div className="user-name-premium">{user.name || username}</div>
                            <div className="user-username-premium">@{username}</div>
                            <div className="user-level-badge">{getRankName(points)}</div>
                        </div>
                    </div>

                    {/* Stats Bar (3x2 Grid) */}
                    <div className="stats-grid-premium">
                        <div className="stat-box-premium">
                            <div className="stat-value-premium" style={{ color: '#fbbf24' }}>
                                <Star size={16} fill="#fbbf24" style={{ filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.5))' }} />
                                <span>{points}</span>
                            </div>
                            <div className="stat-label-premium">Points</div>
                        </div>

                        <div className="stat-box-premium">
                            <div className="stat-value-premium" style={{ color: '#f97316' }}>
                                <Flame size={16} fill="#f97316" style={{ filter: 'drop-shadow(0 0 4px rgba(249,115,22,0.5))' }} />
                                <span>{streakCount}</span>
                            </div>
                            <div className="stat-label-premium">Streaks</div>
                        </div>

                        <div className="stat-box-premium">
                            <div className="stat-value-premium" style={{ color: '#8b5cf6' }}>
                                <Users size={16} style={{ filter: 'drop-shadow(0 0 4px rgba(139,92,246,0.5))' }} />
                                <span>{connectionsCount}</span>
                            </div>
                            <div className="stat-label-premium">Matches</div>
                        </div>

                        <div className="stat-box-premium">
                            <div className="stat-value-premium" style={{ color: '#06b6d4' }}>
                                <Image size={16} style={{ filter: 'drop-shadow(0 0 4px rgba(6,182,212,0.5))' }} />
                                <span>{photosCount}</span>
                            </div>
                            <div className="stat-label-premium">Photos</div>
                        </div>

                        <div className="stat-box-premium">
                            <div className="stat-value-premium" style={{ color: '#10b981' }}>
                                <UserPlus size={16} style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.5))' }} />
                                <span>{followersCount}</span>
                            </div>
                            <div className="stat-label-premium">Followers</div>
                        </div>

                        <div className="stat-box-premium">
                            <div className="stat-value-premium" style={{ color: '#ec4899' }}>
                                <UserCheck size={16} style={{ filter: 'drop-shadow(0 0 4px rgba(236,72,153,0.5))' }} />
                                <span>{followingCount}</span>
                            </div>
                            <div className="stat-label-premium">Following</div>
                        </div>
                    </div>
                </div>

                {/* Group 1: Account Settings */}
                <div className="settings-group-premium">
                    <div className="settings-group-title">Account & Connections</div>
                    {accountRows.map(row => (
                        <button
                            key={row.label}
                            type="button"
                            onClick={row.onClick}
                            className="settings-item-premium"
                        >
                            <div
                                className="settings-icon-wrap"
                                style={{ backgroundColor: row.bgLight, color: row.iconColor }}
                            >
                                {row.icon}
                            </div>
                            <div className="settings-text">
                                <div className="settings-label">{row.label}</div>
                                <div className="settings-sub">{row.sub}</div>
                            </div>
                            <ChevronRight size={18} color="var(--text-inactive)" />
                        </button>
                    ))}
                </div>

                {/* Group 2: Features & Experience */}
                <div className="settings-group-premium">
                    <div className="settings-group-title">Features & Experience</div>
                    {featureRows.map(row => (
                        <button
                            key={row.label}
                            type="button"
                            onClick={row.onClick}
                            className="settings-item-premium"
                        >
                            <div
                                className="settings-icon-wrap"
                                style={{ backgroundColor: row.bgLight, color: row.iconColor }}
                            >
                                {row.icon}
                            </div>
                            <div className="settings-text">
                                <div className="settings-label">{row.label}</div>
                                <div className="settings-sub">{row.sub}</div>
                            </div>
                            <ChevronRight size={18} color="var(--text-inactive)" />
                        </button>
                    ))}
                </div>

                {/* Tips & Guides Banner */}
                <div className="help-banner-premium">
                    <HelpCircle className="help-banner-icon" size={20} />
                    <div className="help-banner-text">
                        <h5>How to earn points & ranks?</h5>
                        <p>
                            Participate in Voice Roulette calls. Each hour spent on calls awards 10 points. Building streaks with connections awards massive bonus multipliers!
                        </p>
                    </div>
                </div>

                {/* My Posts Grid */}
                <div className="settings-group-premium" style={{ marginTop: '1.5rem', background: 'transparent', padding: 0 }}>
                    <div className="settings-group-title" style={{ paddingLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Grid size={18} color="#fff" /> My Posts
                    </div>
                    {userPosts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#8e8e93', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
                            <p>You haven't uploaded any photos or videos yet.</p>
                            <button className="retry-btn-v2" style={{ marginTop: '1rem' }} onClick={() => navigate('/create')}>Create Post</button>
                        </div>
                    ) : (
                        <div className="settings-post-grid">
                            {userPosts.map(post => (
                                <div key={post.id} className="settings-post-item" onClick={() => navigate(`/profile/${username}`)}>
                                    <PostMedia
                                        post={post}
                                        className="settings-post-img"
                                        muted
                                        loop
                                        playsInline
                                        autoPlay={isVideoPost(post)}
                                    />
                                    {isVideoPost(post) && (
                                        <div className="settings-video-badge">▶</div>
                                    )}
                                    <div className="settings-post-overlay">
                                        <div className="settings-engagement-stats">
                                            <span><Heart size={14} fill="#fff" /> {post.likes_count || 0}</span>
                                            <span><MessageCircle size={14} fill="#fff" /> {post.comments_count || 0}</span>
                                            <span><Send size={14} fill="#fff" /> {post.shares_count || 0}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (confirm('Delete this post permanently?')) {
                                                const ok = await deletePost(post.id);
                                                if (ok) setUserPosts(prev => prev.filter(p => p.id !== post.id));
                                            }
                                        }}
                                        style={{
                                            position: 'absolute', top: '6px', right: '6px',
                                            background: 'rgba(0,0,0,0.6)', border: 'none',
                                            borderRadius: '50%', width: '28px', height: '28px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', zIndex: 5,
                                        }}
                                    >
                                        <span style={{ color: '#ff3b30', fontSize: '14px' }}>×</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Logout Button */}
                <button
                    type="button"
                    onClick={signOut}
                    className="logout-btn-premium"
                >
                    <LogOut size={18} />
                    Log Out
                </button>
            </div>
        </div>
    );
};

export default Settings;
