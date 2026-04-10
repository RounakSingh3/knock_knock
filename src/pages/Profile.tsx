import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { fetchProfileByUsername, fetchUserPosts, type ProfileData, type PostData } from '../lib/database';
import { Loader2, Settings, Grid, Film, UserPlus, Zap, Clock, TrendingUp, Users, UserCheck, Star } from 'lucide-react';

const Profile = () => {
    const { username } = useParams<{ username: string }>();
    const navigate = useNavigate();
    const { user: currentUser, points } = useContext(AppContext);

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'posts' | 'followers' | 'following'>('posts');

    useEffect(() => {
        if (!username && currentUser) {
            const currentUserWithUsername = currentUser as ProfileData & { username?: string };
            if (currentUserWithUsername.username) {
                navigate(`/profile/${currentUserWithUsername.username}`, { replace: true });
                return;
            }
        }

        const loadProfile = async () => {
            if (!username) return;
            setLoading(true);
            setError('');
            try {
                const profileData = await fetchProfileByUsername(username);
                if (!profileData) {
                    setError('User not found');
                    setLoading(false);
                    return;
                }
                setProfile(profileData);
                const userPosts = await fetchUserPosts(username);
                setPosts(userPosts);
            } catch (err) {
                console.error('Error loading profile:', err);
                setError('Failed to load profile');
            } finally {
                setLoading(false);
            }
        };
        loadProfile();
    }, [username, currentUser, navigate]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', paddingBottom: '60px' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#8e8e93' }} />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#8e8e93' }}>
                <p>{error || 'User not found'}</p>
            </div>
        );
    }

    const displayUsername = username;
    const isOwnProfile = currentUser && (currentUser as any).username === username;

    // Derived stats
    const followersCount = (profile.points * 3) % 1000;
    const followingCount = (profile.points * 2) % 500;
    const videoPosts = posts.filter(p => p.image_url?.includes('video'));
    const photoPosts = posts.filter(p => !p.image_url?.includes('video'));
    const boostPoints = Math.floor(profile.points * 0.4);
    const screenTimePoints = Math.floor(profile.points * 0.6);

    // Mock followers / following lists
    const mockFollowers = Array.from({ length: Math.min(followersCount, 10) }).map((_, i) => ({
        id: `follower-${i}`,
        name: `User ${i + 1}`,
        username: `user_${i + 1}`,
        avatar: `https://i.pravatar.cc/150?u=follower${i}${displayUsername}`,
    }));

    const mockFollowing = Array.from({ length: Math.min(followingCount, 10) }).map((_, i) => ({
        id: `following-${i}`,
        name: `Friend ${i + 1}`,
        username: `friend_${i + 1}`,
        avatar: `https://i.pravatar.cc/150?u=following${i}${displayUsername}`,
    }));

    return (
        <div className="profile-page pb-20">
            {/* Header */}
            <header className="home-header" style={{ justifyContent: 'space-between' }}>
                <h1 className="font-bold text-xl">{displayUsername}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'rgba(255, 51, 102, 0.15)', color: '#ff3366', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Star size={16} fill="#ff3366" /> {isOwnProfile ? points : profile.points} Pts
                    </div>
                    {isOwnProfile && (
                        <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                            <Settings size={24} />
                        </button>
                    )}
                </div>
            </header>

            {/* Profile Info */}
            <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                        <img
                            src={profile.avatar_url || `https://i.pravatar.cc/150?u=${displayUsername}`}
                            alt={profile.name}
                            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #ff3366' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', textAlign: 'center', flex: 1, justifyContent: 'center' }}>
                        <button className="stat-btn" onClick={() => setActiveTab('posts')}>
                            <div className="font-bold text-lg">{posts.length}</div>
                            <div style={{ fontSize: '13px', color: activeTab === 'posts' ? '#ff3366' : '#8e8e93' }}>Posts</div>
                        </button>
                        <button className="stat-btn" onClick={() => setActiveTab('followers')}>
                            <div className="font-bold text-lg">{followersCount}</div>
                            <div style={{ fontSize: '13px', color: activeTab === 'followers' ? '#ff3366' : '#8e8e93' }}>Followers</div>
                        </button>
                        <button className="stat-btn" onClick={() => setActiveTab('following')}>
                            <div className="font-bold text-lg">{followingCount}</div>
                            <div style={{ fontSize: '13px', color: activeTab === 'following' ? '#ff3366' : '#8e8e93' }}>Following</div>
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                    <div className="font-bold text-md">{profile.name}</div>
                    <div style={{ fontSize: '14px', marginTop: '4px', color: '#8e8e93' }}>
                        {profile.gender === 'male' ? '♂️' : profile.gender === 'female' ? '♀️' : '🌈'} • Joined Knock Knock
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                    {isOwnProfile ? (
                        <>
                            <button className="profile-action-btn">Edit Profile</button>
                            <button 
                                className="profile-action-btn" 
                                style={{ background: '#ff3366', color: '#fff', border: 'none' }}
                                onClick={() => navigate('/create')}
                            >
                                + Create Post
                            </button>
                        </>
                    ) : (
                        <button className="profile-action-btn" style={{ background: '#ff3366' }}>
                            <UserPlus size={16} /> Follow
                        </button>
                    )}
                    <button className="profile-action-btn">Share Profile</button>
                </div>
            </div>

            {/* ── Content Upload Summary ── */}
            <div style={{ padding: '0 1rem 0.5rem' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="upload-summary-card">
                        <Grid size={20} color="#ff3366" />
                        <span className="font-bold">{photoPosts.length}</span>
                        <span style={{ color: '#8e8e93', fontSize: '12px' }}>Photos</span>
                    </div>
                    <div className="upload-summary-card">
                        <Film size={20} color="#af52de" />
                        <span className="font-bold">{videoPosts.length}</span>
                        <span style={{ color: '#8e8e93', fontSize: '12px' }}>Videos</span>
                    </div>
                    <div className="upload-summary-card">
                        <TrendingUp size={20} color="#facc15" />
                        <span className="font-bold">{posts.length}</span>
                        <span style={{ color: '#8e8e93', fontSize: '12px' }}>Total</span>
                    </div>
                </div>
            </div>

            {/* ── Tab Content Area ── */}
            <div style={{ borderTop: '1px solid #2c2c2e', marginTop: '0.5rem' }}>
                {/* Tab Switcher */}
                <div style={{ display: 'flex' }}>
                    <button
                        className={`profile-tab ${activeTab === 'posts' ? 'active' : ''}`}
                        onClick={() => setActiveTab('posts')}
                    >
                        <Grid size={20} /> Posts
                    </button>
                    <button
                        className={`profile-tab ${activeTab === 'followers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('followers')}
                    >
                        <Users size={20} /> Followers
                    </button>
                    <button
                        className={`profile-tab ${activeTab === 'following' ? 'active' : ''}`}
                        onClick={() => setActiveTab('following')}
                    >
                        <UserCheck size={20} /> Following
                    </button>
                </div>

                {/* Posts Tab */}
                {activeTab === 'posts' && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                            {posts.map(post => (
                                <div key={post.id} style={{ aspectRatio: '1/1', background: '#2c2c2e' }}>
                                    <img
                                        src={post.image_url}
                                        alt="Post"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x300?text=No+Image';
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                        {posts.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '3rem 2rem', color: '#8e8e93' }}>
                                <Grid size={40} color="#2c2c2e" style={{ margin: '0 auto 1rem' }} />
                                <div className="font-bold" style={{ color: '#fff', marginBottom: '4px' }}>No Posts Yet</div>
                                <p>When {isOwnProfile ? 'you share' : `${displayUsername} shares`} photos and videos, they will appear here.</p>
                            </div>
                        )}
                    </>
                )}

                {/* Followers Tab */}
                {activeTab === 'followers' && (
                    <div style={{ padding: '8px 0' }}>
                        {mockFollowers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#8e8e93' }}>No followers yet</div>
                        ) : (
                            mockFollowers.map(f => (
                                <div key={f.id} className="user-list-item">
                                    <img src={f.avatar} alt={f.name} className="user-list-avatar" />
                                    <div style={{ flex: 1 }}>
                                        <div className="font-bold" style={{ fontSize: '14px' }}>{f.username}</div>
                                        <div style={{ fontSize: '13px', color: '#8e8e93' }}>{f.name}</div>
                                    </div>
                                    <button className="profile-action-btn" style={{ flex: 'none', padding: '6px 16px', fontSize: '13px' }}>
                                        Remove
                                    </button>
                                </div>
                            ))
                        )}
                        {followersCount > 10 && (
                            <div style={{ textAlign: 'center', padding: '1rem', color: '#8e8e93', fontSize: '13px' }}>
                                + {followersCount - 10} more followers
                            </div>
                        )}
                    </div>
                )}

                {/* Following Tab */}
                {activeTab === 'following' && (
                    <div style={{ padding: '8px 0' }}>
                        {mockFollowing.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#8e8e93' }}>Not following anyone yet</div>
                        ) : (
                            mockFollowing.map(f => (
                                <div key={f.id} className="user-list-item">
                                    <img src={f.avatar} alt={f.name} className="user-list-avatar" />
                                    <div style={{ flex: 1 }}>
                                        <div className="font-bold" style={{ fontSize: '14px' }}>{f.username}</div>
                                        <div style={{ fontSize: '13px', color: '#8e8e93' }}>{f.name}</div>
                                    </div>
                                    <button className="profile-action-btn" style={{ flex: 'none', padding: '6px 16px', fontSize: '13px', background: '#ff3366' }}>
                                        Following
                                    </button>
                                </div>
                            ))
                        )}
                        {followingCount > 10 && (
                            <div style={{ textAlign: 'center', padding: '1rem', color: '#8e8e93', fontSize: '13px' }}>
                                + {followingCount - 10} more following
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile;
