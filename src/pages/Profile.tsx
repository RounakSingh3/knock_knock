import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { 
    fetchProfileByUsername, fetchUserPosts, type ProfileData, type PostData,
    fetchFollowers, fetchFollowing, fetchFollowCounts, checkIfFollowing, toggleFollow,
    uploadMedia, updateProfile
} from '../lib/database';
import { Loader2, Settings, Grid, Film, UserPlus, Zap, Clock, TrendingUp, Users, UserCheck, Star, X, Camera } from 'lucide-react';
import { isVideoPost } from '../lib/media';
import PostMedia from '../components/PostMedia';
import EditProfileSheet from '../components/EditProfileSheet';

const Profile = () => {
    const { username } = useParams<{ username: string }>();
    const navigate = useNavigate();
    const { user: currentUser, setUser, points } = useContext(AppContext);

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'posts' | 'followers' | 'following'>('posts');
    const [followersList, setFollowersList] = useState<ProfileData[]>([]);
    const [followingList, setFollowingList] = useState<ProfileData[]>([]);
    const [followStats, setFollowStats] = useState({ followers: 0, following: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [updatingAvatar, setUpdatingAvatar] = useState(false);

    const handleAvatarDirectChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!currentUser || !profile) return;
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setUpdatingAvatar(true);
            try {
                const ext = file.name.split('.').pop();
                const path = `avatars/${currentUser.id}-${Date.now()}.${ext}`;
                const publicUrl = await uploadMedia(file, path);
                
                const success = await updateProfile(currentUser.id, { avatar_url: publicUrl });
                if (success) {
                    setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
                    
                    if (setUser) {
                        setUser(prev => {
                            if (!prev) return null;
                            const newProfile = { ...prev, avatar_url: publicUrl };
                            localStorage.setItem('knock_user_session', JSON.stringify(newProfile));
                            return newProfile;
                        });
                    }
                }
            } catch (err) {
                console.error('Error uploading avatar:', err);
                alert('Failed to upload profile picture. Please try again.');
            } finally {
                setUpdatingAvatar(false);
            }
        }
    };

    useEffect(() => {
        if (!username && currentUser) {
            if (currentUser.username) {
                navigate(`/profile/${currentUser.username}`, { replace: true });
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
                
                const [userPosts, stats] = await Promise.all([
                    fetchUserPosts(username),
                    fetchFollowCounts(profileData.id)
                ]);
                setPosts(userPosts);
                setFollowStats(stats);
                
                if (currentUser && currentUser.id !== profileData.id) {
                    const following = await checkIfFollowing(currentUser.id, profileData.id);
                    setIsFollowing(following);
                }
            } catch (err) {
                console.error('Error loading profile:', err);
                setError('Failed to load profile');
            } finally {
                setLoading(false);
            }
        };
        loadProfile();
    }, [username, currentUser, navigate]);

    useEffect(() => {
        if (!profile) return;
        if (activeTab === 'followers') {
            fetchFollowers(profile.id).then(setFollowersList);
        } else if (activeTab === 'following') {
            fetchFollowing(profile.id).then(setFollowingList);
        }
    }, [activeTab, profile]);

    const handleFollowToggle = async () => {
        if (!currentUser || !profile) return;
        const newIsFollowing = !isFollowing;
        setIsFollowing(newIsFollowing);
        setFollowStats(prev => ({
            ...prev,
            followers: prev.followers + (newIsFollowing ? 1 : -1)
        }));
        await toggleFollow(currentUser.id, profile.id, isFollowing);
    };

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
    const isOwnProfile = currentUser && currentUser.username === username;

    // Derived stats
    const videoPosts = posts.filter((p) => isVideoPost(p));
    const photoPosts = posts.filter((p) => !isVideoPost(p));

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
                        <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
                            onClick={() => navigate('/settings')}
                            aria-label="Settings"
                        >
                            <Settings size={24} />
                        </button>
                    )}
                </div>
            </header>

            {/* Profile Info */}
            <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                        {isOwnProfile ? (
                            <label className="avatar-upload-label" style={{ position: 'relative', cursor: 'pointer', display: 'block' }}>
                                <img
                                    src={profile.avatar_url || `https://i.pravatar.cc/150?u=${displayUsername}`}
                                    alt={profile.name}
                                    style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #ff3366', transition: 'opacity 0.2s' }}
                                />
                                {updatingAvatar ? (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: 'rgba(0,0,0,0.6)', borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: '3px solid #ff3366',
                                    }}>
                                        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#fff' }} />
                                    </div>
                                ) : (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: 'rgba(0,0,0,0.4)', borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        opacity: 0, transition: 'opacity 0.2s',
                                        border: '3px solid #ff3366',
                                    }}
                                    className="avatar-hover-overlay"
                                    >
                                        <Camera size={20} color="#fff" />
                                    </div>
                                )}
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleAvatarDirectChange} 
                                    disabled={updatingAvatar}
                                    style={{ display: 'none' }} 
                                />
                            </label>
                        ) : (
                            <img
                                src={profile.avatar_url || `https://i.pravatar.cc/150?u=${displayUsername}`}
                                alt={profile.name}
                                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #ff3366' }}
                            />
                        )}
                        <style>{`
                            .avatar-upload-label:hover .avatar-hover-overlay {
                                opacity: 1 !important;
                            }
                        `}</style>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', textAlign: 'center', flex: 1, justifyContent: 'center' }}>
                        <button className="stat-btn" onClick={() => setActiveTab('posts')}>
                            <div className="font-bold text-lg">{posts.length}</div>
                            <div style={{ fontSize: '13px', color: activeTab === 'posts' ? '#ff3366' : '#8e8e93' }}>Posts</div>
                        </button>
                        <button className="stat-btn" onClick={() => setActiveTab('followers')}>
                            <div className="font-bold text-lg">{followStats.followers}</div>
                            <div style={{ fontSize: '13px', color: activeTab === 'followers' ? '#ff3366' : '#8e8e93' }}>Followers</div>
                        </button>
                        <button className="stat-btn" onClick={() => setActiveTab('following')}>
                            <div className="font-bold text-lg">{followStats.following}</div>
                            <div style={{ fontSize: '13px', color: activeTab === 'following' ? '#ff3366' : '#8e8e93' }}>Following</div>
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                    <div className="font-bold text-md">{profile.name}</div>
                    {profile.bio && (
                        <p style={{ fontSize: '14px', color: '#e0e0e0', margin: '6px 0', lineHeight: '1.4' }}>{profile.bio}</p>
                    )}
                    <div style={{ fontSize: '14px', marginTop: '4px', color: '#8e8e93' }}>
                        {profile.gender === 'male' ? '♂️' : profile.gender === 'female' ? '♀️' : '🌈'} • Joined Knock Knock
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                    {isOwnProfile ? (
                        <>
                            <button className="profile-action-btn" onClick={() => setIsEditOpen(true)}>Edit Profile</button>
                            <button 
                                className="profile-action-btn" 
                                style={{ background: '#ff3366', color: '#fff', border: 'none' }}
                                onClick={() => navigate('/create')}
                            >
                                + Create Post
                            </button>
                        </>
                    ) : (
                        <button 
                            className="profile-action-btn" 
                            style={{ background: isFollowing ? '#2c2c2e' : '#ff3366', color: '#fff' }}
                            onClick={handleFollowToggle}
                        >
                            {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />} 
                            {isFollowing ? ' Unfriend' : ' Friend'}
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
                                <div
                                    key={post.id}
                                    style={{
                                        position: 'relative',
                                        aspectRatio: '1/1',
                                        background: '#2c2c2e',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => setSelectedPost(post)}
                                >
                                    <PostMedia
                                        post={post}
                                        alt="Post"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        muted
                                        loop
                                        playsInline
                                        autoPlay={isVideoPost(post)}
                                    />
                                    {isVideoPost(post) && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                bottom: 6,
                                                right: 6,
                                                background: 'rgba(0,0,0,0.6)',
                                                borderRadius: 4,
                                                padding: '2px 6px',
                                                fontSize: 10,
                                                color: '#fff',
                                                pointerEvents: 'none',
                                            }}
                                        >
                                            ▶ Tap for sound
                                        </div>
                                    )}
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
                        {followersList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#8e8e93' }}>No followers yet</div>
                        ) : (
                            followersList.map(f => (
                                <div key={f.id} className="user-list-item" onClick={() => navigate(`/profile/${f.username}`)}>
                                    <img src={f.avatar_url} alt={f.name} className="user-list-avatar" />
                                    <div style={{ flex: 1 }}>
                                        <div className="font-bold" style={{ fontSize: '14px' }}>{f.username}</div>
                                        <div style={{ fontSize: '13px', color: '#8e8e93' }}>{f.name}</div>
                                    </div>
                                    {isOwnProfile && (
                                        <button className="profile-action-btn" style={{ flex: 'none', padding: '6px 16px', fontSize: '13px' }}>
                                            Remove
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Following Tab */}
                {activeTab === 'following' && (
                    <div style={{ padding: '8px 0' }}>
                        {followingList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#8e8e93' }}>Not following anyone yet</div>
                        ) : (
                            followingList.map(f => (
                                <div key={f.id} className="user-list-item" onClick={() => navigate(`/profile/${f.username}`)}>
                                    <img src={f.avatar_url} alt={f.name} className="user-list-avatar" />
                                    <div style={{ flex: 1 }}>
                                        <div className="font-bold" style={{ fontSize: '14px' }}>{f.username}</div>
                                        <div style={{ fontSize: '13px', color: '#8e8e93' }}>{f.name}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {selectedPost && (
                <div className="post-modal-backdrop post-modal-backdrop--fullscreen" onClick={() => setSelectedPost(null)}>
                    <div className="post-modal post-modal--fullscreen" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-top-bar">
                            <span className="modal-username">{displayUsername}</span>
                            <button className="modal-close-btn" type="button" onClick={() => setSelectedPost(null)}>
                                <X size={22} />
                            </button>
                        </div>
                        <div className="modal-media-stage">
                            <PostMedia
                                post={selectedPost}
                                className="modal-image"
                                controls
                                playsInline
                                soundOn
                                loop={false}
                            />
                        </div>
                        {selectedPost.caption && (
                            <div className="modal-details modal-details--sheet">
                                <p className="modal-caption">{selectedPost.caption}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Edit Profile Sheet */}
            {isOwnProfile && currentUser && profile && (
                <EditProfileSheet
                    isOpen={isEditOpen}
                    onClose={() => setIsEditOpen(false)}
                    currentUser={{ id: currentUser.id, username: currentUser.username || '', avatar_url: currentUser.avatar_url, bio: (profile as any).bio }}
                    onUpdated={() => {
                        // Reload profile
                        if (username) {
                            fetchProfileByUsername(username).then(p => { if (p) setProfile(p); });
                        }
                    }}
                />
            )}
        </div>
    );
};

export default Profile;
