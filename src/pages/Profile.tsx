import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { 
    fetchProfileByUsername, fetchUserPosts, type ProfileData, type PostData,
    fetchFollowers, fetchFollowing, fetchFollowCounts, checkIfFollowing, toggleFollow,
    uploadMedia, updateProfile, blockUser, unblockUser,
    getCallRequestStatus, sendCallRequest, updateCallRequestStatus, fetchUserOnlineStatus, checkConnection, type CallRequestData
} from '../lib/database';
import { Loader2, Settings, Grid, Film, UserPlus, Zap, Clock, TrendingUp, Users, UserCheck, Star, X, Camera, Phone, ShieldAlert, Lock, RefreshCw, Bell, Music, ChevronLeft, ChevronRight } from 'lucide-react';
import { isVideoPost, compressImage } from '../lib/media';
import PostMedia from '../components/PostMedia';
import EditProfileSheet from '../components/EditProfileSheet';
import { supabase } from '../lib/supabase';
import { audioPlayer } from '../lib/audioPlayer';

const Profile = () => {
    const { username } = useParams<{ username: string }>();
    const navigate = useNavigate();
    const { user: currentUser, setUser, points, blockedIds, setBlockedIds } = useContext(AppContext);

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'posts' | 'followers' | 'following'>('posts');
    const [followersList, setFollowersList] = useState<ProfileData[]>([]);
    const [followingList, setFollowingList] = useState<ProfileData[]>([]);
    const [followStats, setFollowStats] = useState({ followers: 0, following: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    
    // Swipe states
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [selectedPost, setSelectedPost] = useState<PostData | null>(null);

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [callingStatus, setCallingStatus] = useState<'none' | 'calling'>('none');
    const [updatingAvatar, setUpdatingAvatar] = useState(false);
    const [isBlocking, setIsBlocking] = useState(false);
    
    // Call Requests & Online Status States
    const [callRequest, setCallRequest] = useState<CallRequestData | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [loadingCallAction, setLoadingCallAction] = useState(false);

    const isBlocked = profile ? blockedIds.includes(profile.id) : false;

    const handleBlockToggle = async () => {
        if (!currentUser || !profile) return;
        setIsBlocking(true);
        if (isBlocked) {
            const ok = await unblockUser(currentUser.id, profile.id);
            if (ok) {
                setBlockedIds(prev => prev.filter(id => id !== profile.id));
            }
        } else {
            if (window.confirm(`Are you sure you want to block ${profile.username}? You won't see their posts or connect with them.`)) {
                const ok = await blockUser(currentUser.id, profile.id);
                if (ok) {
                    setBlockedIds(prev => [...prev, profile.id]);
                }
            }
        }
        setIsBlocking(false);
    };

    const handleAvatarDirectChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!currentUser || !profile) return;
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setUpdatingAvatar(true);
            try {
                const ext = file.name.split('.').pop();
                const path = `avatars/${currentUser.id}-${Date.now()}.${ext}`;
                let fileToUpload = file;
                try {
                    fileToUpload = await compressImage(file, 400, 400, 0.85);
                } catch (compErr) {
                    console.error('Avatar compression failed, using original file:', compErr);
                }
                const publicUrl = await uploadMedia(fileToUpload, path);
                
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

        // Reset call status states when switching profiles to prevent state leaking
        setCallRequest(null);
        setIsConnected(false);
        setIsOnline(false);
        setLoadingCallAction(false);

        const loadProfile = async () => {
            if (!username) return;
            const cleanUser = username.replace(/^@+/, '').trim();
            setLoading(true);
            setError('');
            try {
                const profileData = await fetchProfileByUsername(cleanUser);
                if (!profileData) {
                    setError('User not found');
                    setLoading(false);
                    return;
                }
                setProfile(profileData);
                
                const [userPosts, stats] = await Promise.all([
                    fetchUserPosts(profileData.username || cleanUser, profileData.id),
                    fetchFollowCounts(profileData.id).catch(() => ({ followers: 0, following: 0 }))
                ]);
                setPosts(userPosts);
                setFollowStats(stats);
                
                if (currentUser && currentUser.id !== profileData.id) {
                    const following = await checkIfFollowing(currentUser.id, profileData.id);
                    setIsFollowing(following);

                    // Fetch call request & connection status — wrapped in its own try/catch
                    // so if call_requests table or is_online column don't exist yet,
                    // the profile still loads fine
                    try {
                        const [req, conn, online] = await Promise.all([
                            getCallRequestStatus(currentUser.id, profileData.id).catch(() => null),
                            checkConnection(currentUser.id, profileData.id).catch(() => null),
                            fetchUserOnlineStatus(profileData.id).catch(() => false)
                        ]);
                        setCallRequest(req);
                        setIsConnected(!!conn);
                        setIsOnline(online);
                    } catch (callErr) {
                        // Silently ignore — call features just won't show
                        console.warn('Call request features unavailable:', callErr);
                    }
                }
            } catch (err) {
                console.error('Error loading profile:', err);
                setError('Failed to load profile');
            } finally {
                setLoading(false);
            }
        };
        loadProfile();
    }, [username, currentUser?.id, navigate]);

    // Real-time updates subscription for online status and call requests
    useEffect(() => {
        if (!profile || !currentUser || isOwnProfile) return;

        // 1. Subscribe to online status updates of the target user
        const onlineChannel = supabase
            .channel(`profile-online-${profile.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${profile.id}`
            }, (payload) => {
                if (payload.new && 'is_online' in payload.new) {
                    setIsOnline(!!payload.new.is_online);
                }
            })
            .subscribe();

        // 2. Listen to realtime call request broadcast events (accepted/declined/requested)
        const broadcastChannel = supabase.channel('direct-calls');
        
        broadcastChannel.on('broadcast', { event: 'call-request-accepted' }, (payload) => {
            const { senderId, receiverId } = payload.payload;
            if ((senderId === currentUser.id && receiverId === profile.id) || 
                (senderId === profile.id && receiverId === currentUser.id)) {
                getCallRequestStatus(currentUser.id, profile.id).then(setCallRequest);
            }
        });

        broadcastChannel.on('broadcast', { event: 'call-request-declined' }, (payload) => {
            const { senderId, receiverId } = payload.payload;
            if ((senderId === currentUser.id && receiverId === profile.id) || 
                (senderId === profile.id && receiverId === currentUser.id)) {
                getCallRequestStatus(currentUser.id, profile.id).then(setCallRequest);
            }
        });

        broadcastChannel.on('broadcast', { event: 'call-request' }, (payload) => {
            const { senderId, receiverId } = payload.payload;
            if ((senderId === currentUser.id && receiverId === profile.id) || 
                (senderId === profile.id && receiverId === currentUser.id)) {
                getCallRequestStatus(currentUser.id, profile.id).then(setCallRequest);
            }
        });

        broadcastChannel.subscribe();

        // 3. Listen to local custom events from GlobalCallListener
        const handleLocalUpdate = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (callRequest && detail.requestId === callRequest.id) {
                setCallRequest(prev => prev ? { ...prev, status: detail.status } : null);
            } else {
                getCallRequestStatus(currentUser.id, profile.id).then(setCallRequest);
            }
        };

        window.addEventListener('call-request-updated', handleLocalUpdate);

        return () => {
            supabase.removeChannel(onlineChannel);
            supabase.removeChannel(broadcastChannel);
            window.removeEventListener('call-request-updated', handleLocalUpdate);
        };
    }, [profile?.id, currentUser?.id, callRequest?.id]);

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
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-inactive)' }} />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-active)' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <button 
                        onClick={() => navigate(-1)} 
                        style={{ background: 'none', border: 'none', color: 'var(--text-active)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '16px' }}
                    >
                        <ChevronLeft size={24} /> Back
                    </button>
                    <span style={{ marginLeft: '12px', fontWeight: 'bold' }}>@{username}</span>
                </div>
                <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-inactive)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-active)', marginBottom: '8px' }}>User not found</h2>
                    <p style={{ maxWidth: '320px', margin: '0 auto 24px', fontSize: '14px', lineHeight: '1.5' }}>
                        The account @{username} doesn't exist or may have been renamed.
                    </p>
                    <button
                        onClick={() => navigate('/home')}
                        style={{
                            background: 'linear-gradient(45deg, #f5a524, #ff6b35)',
                            border: 'none',
                            borderRadius: '20px',
                            padding: '10px 24px',
                            color: '#fff',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        Go to Home Feed
                    </button>
                </div>
            </div>
        );
    }

    const displayUsername = username;
    const isOwnProfile = currentUser && currentUser.username === username;

    const sendDirectCallsBroadcast = (event: string, payload: any) => {
        const channel = supabase.channel('direct-calls');
        const sendMsg = () => {
            channel.send({
                type: 'broadcast',
                event,
                payload
            });
        };
        if (channel.state === 'joined' || (channel as any).subState === 'joined') {
            sendMsg();
        } else {
            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    sendMsg();
                }
            });
        }
    };

    const handleSendRequest = async () => {
        if (!currentUser || !profile) return;
        setLoadingCallAction(true);
        const req = await sendCallRequest(currentUser.id, profile.id);
        if (req) {
            setCallRequest(req);
            // Send broadcast to notify target in real-time
            sendDirectCallsBroadcast('call-request', {
                requestId: req.id,
                senderId: currentUser.id,
                receiverId: profile.id
            });
        }
        setLoadingCallAction(false);
    };

    const handleAcceptCallRequest = async () => {
        if (!callRequest || !currentUser || !profile) return;
        setLoadingCallAction(true);
        const ok = await updateCallRequestStatus(callRequest.id, 'accepted');
        if (ok) {
            setCallRequest({ ...callRequest, status: 'accepted' });
            // Broadcast accept status
            sendDirectCallsBroadcast('call-request-accepted', {
                requestId: callRequest.id,
                senderId: callRequest.sender_id,
                receiverId: currentUser.id
            });
        }
        setLoadingCallAction(false);
    };

    const handleDeclineCallRequest = async () => {
        if (!callRequest || !currentUser || !profile) return;
        setLoadingCallAction(true);
        const ok = await updateCallRequestStatus(callRequest.id, 'declined');
        if (ok) {
            setCallRequest({ ...callRequest, status: 'declined' });
            // Broadcast decline status
            sendDirectCallsBroadcast('call-request-declined', {
                requestId: callRequest.id,
                senderId: callRequest.sender_id,
                receiverId: currentUser.id
            });
        }
        setLoadingCallAction(false);
    };

    const handleDirectCall = () => {
        if (!currentUser || !profile) return;
        
        const room = `direct-${currentUser.id}-${profile.id}-${Date.now()}`;
        setCallingStatus('calling');

        const channel = supabase.channel('direct-calls');

        const sendInvite = () => {
            channel.send({
                type: 'broadcast',
                event: 'call-invite',
                payload: {
                    callerId: currentUser.id,
                    receiverId: profile.id,
                    type: 'audio',
                    room
                }
            });
        };

        // Wait for accept
        channel.on('broadcast', { event: 'call-accept' }, (payload) => {
            if (payload.payload.callerId === currentUser.id && payload.payload.receiverId === profile.id) {
                setCallingStatus('none');
                navigate(`/call?direct=true&partnerId=${profile.id}&role=caller&room=${payload.payload.room}`);
            }
        });

        channel.on('broadcast', { event: 'call-decline' }, (payload) => {
            if (payload.payload.callerId === currentUser.id && payload.payload.receiverId === profile.id) {
                setCallingStatus('none');
                alert(`${profile.username} declined your call.`);
            }
        });

        if (channel.state === 'joined' || (channel as any).subState === 'joined') {
            sendInvite();
        } else {
            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    sendInvite();
                }
            });
        }

        // Timeout after 30s
        setTimeout(() => {
            setCallingStatus('none');
        }, 30000);
    };

    // Derived stats
    const videoPosts = posts.filter((p) => isVideoPost(p));
    const photoPosts = posts.filter((p) => !isVideoPost(p));

    return (
        <div className="profile-page pb-20">
            {/* Header */}
            <header className="home-header" style={{ justifyContent: 'space-between' }}>
                <h1 className="font-bold text-xl" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {displayUsername}
                    {!isOwnProfile && (isConnected || (callRequest && callRequest.status === 'accepted')) && (
                        <span 
                            style={{
                                display: 'inline-block',
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: isOnline ? '#34C759' : '#8e8e93',
                                boxShadow: isOnline ? '0 0 10px #34C759' : 'none',
                                transition: 'all 0.3s ease'
                            }} 
                            title={isOnline ? 'Online' : 'Offline'} 
                        />
                    )}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'rgba(255, 51, 102, 0.15)', color: '#ff3366', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Star size={16} fill="#ff3366" /> {isOwnProfile ? points : profile.points} Pts
                    </div>
                    {isOwnProfile && (
                        <>
                            <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: 'var(--text-active)', cursor: 'pointer', position: 'relative' }}
                                onClick={() => navigate('/notifications')}
                                aria-label="Notifications"
                            >
                                <Bell size={24} />
                                <span style={{
                                    position: 'absolute', top: '0', right: '0',
                                    background: 'var(--primary-gradient)', width: '8px', height: '8px',
                                    borderRadius: '50%', boxShadow: '0 0 6px var(--primary-color)'
                                }} />
                            </button>
                            <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: 'var(--text-active)', cursor: 'pointer' }}
                                onClick={() => navigate('/settings')}
                                aria-label="Settings"
                            >
                                <Settings size={24} />
                            </button>
                        </>
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
                                        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-active)' }} />
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
                                        <Camera size={20} color="var(--text-active)" />
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
                            <div style={{ fontSize: '13px', color: activeTab === 'posts' ? '#ff3366' : 'var(--text-inactive)' }}>Posts</div>
                        </button>
                        <button className="stat-btn" onClick={() => setActiveTab('followers')}>
                            <div className="font-bold text-lg">{followStats.followers}</div>
                            <div style={{ fontSize: '13px', color: activeTab === 'followers' ? '#ff3366' : 'var(--text-inactive)' }}>Followers</div>
                        </button>
                        <button className="stat-btn" onClick={() => setActiveTab('following')}>
                            <div className="font-bold text-lg">{followStats.following}</div>
                            <div style={{ fontSize: '13px', color: activeTab === 'following' ? '#ff3366' : 'var(--text-inactive)' }}>Following</div>
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                    <div className="font-bold text-md">{profile.name}</div>
                    {profile.bio && (
                        <p style={{ fontSize: '14px', color: '#e0e0e0', margin: '6px 0', lineHeight: '1.4' }}>{profile.bio}</p>
                    )}
                    <div style={{ fontSize: '14px', marginTop: '4px', color: 'var(--text-inactive)' }}>
                        {profile.gender === 'male' ? '♂️' : profile.gender === 'female' ? '♀️' : '🌈'} • Joined Knock Knock
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                    {isOwnProfile ? (
                        <>
                            <button className="profile-action-btn" onClick={() => setIsEditOpen(true)}>Edit Profile</button>
                            <button 
                                className="profile-action-btn" 
                                style={{ background: '#ff3366', color: 'var(--text-active)', border: 'none' }}
                                onClick={() => navigate('/create')}
                            >
                                + Create Post
                            </button>
                        </>
                    ) : (
                        <>
                            {isBlocked ? (
                                <button 
                                    className="profile-action-btn" 
                                    style={{ background: 'var(--border-color)', color: 'var(--text-active)', flex: 1 }}
                                    onClick={handleBlockToggle}
                                    disabled={isBlocking}
                                >
                                    {isBlocking ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                                    Unblock
                                </button>
                            ) : (
                                <>
                                    <button 
                                        className="profile-action-btn" 
                                        style={{ background: isFollowing ? 'var(--border-color)' : '#ff3366', color: 'var(--text-active)' }}
                                        onClick={handleFollowToggle}
                                    >
                                        {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />} 
                                        {isFollowing ? ' Unfriend' : ' Friend'}
                                    </button>
                                    {/* Call / Request Call Permission Buttons */}
                                    {isConnected || (callRequest && callRequest.status === 'accepted') ? (
                                        <button 
                                            className="profile-action-btn" 
                                            style={{ background: '#34C759', color: 'var(--text-active)', opacity: callingStatus === 'calling' ? 0.7 : 1 }}
                                            onClick={handleDirectCall}
                                            disabled={callingStatus === 'calling'}
                                        >
                                            {callingStatus === 'calling' ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />} 
                                            {callingStatus === 'calling' ? ' Calling...' : ' Call'}
                                        </button>
                                    ) : callRequest && callRequest.status === 'pending' ? (
                                        callRequest.sender_id === currentUser.id ? (
                                            <button 
                                                className="profile-action-btn" 
                                                style={{ background: 'var(--border-color)', color: 'var(--text-inactive)', cursor: 'not-allowed' }}
                                                disabled
                                            >
                                                <Clock size={16} /> Pending...
                                            </button>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                                                <button 
                                                    className="profile-action-btn" 
                                                    style={{ background: '#34C759', color: '#fff', padding: '0 8px', fontSize: '12px' }}
                                                    onClick={handleAcceptCallRequest}
                                                    disabled={loadingCallAction}
                                                >
                                                    {loadingCallAction ? <Loader2 size={12} className="animate-spin" /> : 'Accept'}
                                                </button>
                                                <button 
                                                    className="profile-action-btn" 
                                                    style={{ background: 'rgba(255,59,48,0.15)', color: '#FF3B30', padding: '0 8px', fontSize: '12px' }}
                                                    onClick={handleDeclineCallRequest}
                                                    disabled={loadingCallAction}
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        )
                                    ) : (
                                        <button 
                                            className="profile-action-btn" 
                                            style={{ background: 'var(--border-color)', color: 'var(--text-active)' }}
                                            onClick={handleSendRequest}
                                            disabled={loadingCallAction}
                                        >
                                            {loadingCallAction ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} 
                                            {' Request Call'}
                                        </button>
                                    )}

                                    <button 
                                        className="profile-action-btn" 
                                        style={{ background: 'var(--border-color)', color: '#ff3b30', flex: '0 0 auto', padding: '0 12px' }}
                                        onClick={handleBlockToggle}
                                        disabled={isBlocking}
                                        title="Block User"
                                    >
                                        {isBlocking ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                                    </button>
                                </>
                            )}
                        </>
                    )}
                    {!isBlocked && <button className="profile-action-btn" style={{ flex: isOwnProfile ? 1 : '0 0 auto', padding: isOwnProfile ? undefined : '0 12px' }}>Share</button>}
                </div>
            </div>

            {/* ── Blocked View ── */}
            {isBlocked ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-inactive)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <ShieldAlert size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                    <h3 className="text-xl font-bold mb-2">User Blocked</h3>
                    <p>You cannot see posts or content from blocked users.</p>
                </div>
            ) : (
                <>
                    {/* ── Content Upload Summary ── */}
            <div style={{ padding: '0 1rem 0.5rem' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="upload-summary-card">
                        <Grid size={20} color="#ff3366" />
                        <span className="font-bold">{photoPosts.length}</span>
                        <span style={{ color: 'var(--text-inactive)', fontSize: '12px' }}>Photos</span>
                    </div>
                    <div className="upload-summary-card">
                        <Film size={20} color="#af52de" />
                        <span className="font-bold">{videoPosts.length}</span>
                        <span style={{ color: 'var(--text-inactive)', fontSize: '12px' }}>Videos</span>
                    </div>
                    <div className="upload-summary-card">
                        <TrendingUp size={20} color="#facc15" />
                        <span className="font-bold">{posts.length}</span>
                        <span style={{ color: 'var(--text-inactive)', fontSize: '12px' }}>Total</span>
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
                                        background: 'var(--border-color)',
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
                                        autoPlay={false}
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
                                                color: 'var(--text-active)',
                                                pointerEvents: 'none',
                                            }}
                                        >
                                            ▶ Tap for sound
                                        </div>
                                    )}
                                    {(post.music_url || post.music_title) && (
                                        <div style={{
                                            position: 'absolute', top: '6px', left: '6px', zIndex: 5,
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                                            padding: '2px 6px', borderRadius: '10px', color: '#fff',
                                            fontSize: '9px', fontWeight: '600',
                                        }}>
                                            <Music size={9} color="#f5a524" />
                                            <span>{post.music_title || '♪'}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {posts.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-inactive)' }}>
                                <Grid size={40} color="#2c2c2e" style={{ margin: '0 auto 1rem' }} />
                                <div className="font-bold" style={{ color: 'var(--text-active)', marginBottom: '4px' }}>No Posts Yet</div>
                                <p>When {isOwnProfile ? 'you share' : `${displayUsername} shares`} photos and videos, they will appear here.</p>
                            </div>
                        )}
                    </>
                )}

                {/* Followers Tab */}
                {activeTab === 'followers' && (
                    <div style={{ padding: '8px 0' }}>
                        {followersList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-inactive)' }}>No followers yet</div>
                        ) : (
                            followersList.map(f => (
                                <div key={f.id} className="user-list-item" onClick={() => navigate(`/profile/${f.username}`)}>
                                    <img src={f.avatar_url} alt={f.name} className="user-list-avatar" />
                                    <div style={{ flex: 1 }}>
                                        <div className="font-bold" style={{ fontSize: '14px' }}>{f.username}</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-inactive)' }}>{f.name}</div>
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
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-inactive)' }}>Not following anyone yet</div>
                        ) : (
                            followingList.map(f => (
                                <div key={f.id} className="user-list-item" onClick={() => navigate(`/profile/${f.username}`)}>
                                    <img src={f.avatar_url} alt={f.name} className="user-list-avatar" />
                                    <div style={{ flex: 1 }}>
                                        <div className="font-bold" style={{ fontSize: '14px' }}>{f.username}</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-inactive)' }}>{f.name}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {selectedPost && (() => {
                const currentIndex = posts.findIndex(p => p.id === selectedPost.id);
                const hasNext = currentIndex < posts.length - 1;
                const hasPrev = currentIndex > 0;

                const handleTouchStart = (e: React.TouchEvent) => {
                    setTouchEnd(null);
                    setTouchStart(e.targetTouches[0].clientX);
                };

                const handleTouchMove = (e: React.TouchEvent) => {
                    setTouchEnd(e.targetTouches[0].clientX);
                };

                const handleTouchEnd = () => {
                    if (!touchStart || !touchEnd) return;
                    const distance = touchStart - touchEnd;
                    if (distance > 50 && hasNext) setSelectedPost(posts[currentIndex + 1]);
                    if (distance < -50 && hasPrev) setSelectedPost(posts[currentIndex - 1]);
                };

                return (
                    <div className="post-modal-backdrop post-modal-backdrop--fullscreen" onClick={() => setSelectedPost(null)}>
                        <div 
                            className="post-modal post-modal--fullscreen" 
                            onClick={(e) => e.stopPropagation()}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <div className="modal-top-bar">
                                <span className="modal-username">{displayUsername}</span>
                                <button className="modal-close-btn" type="button" onClick={() => setSelectedPost(null)}>
                                    <X size={22} />
                                </button>
                            </div>
                            <div className="modal-media-stage" style={{ position: 'relative' }}>
                                {hasPrev && (
                                    <button 
                                        className="nav-btn left"
                                        onClick={(e) => { e.stopPropagation(); setSelectedPost(posts[currentIndex - 1]); }}
                                        style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', padding: '8px', color: 'white', cursor: 'pointer' }}
                                    >
                                        <ChevronLeft size={28} />
                                    </button>
                                )}
                                <PostMedia
                                    key={selectedPost.id}
                                    post={selectedPost}
                                    className="modal-image"
                                    controls
                                    playsInline
                                    soundOn
                                    loop={false}
                                />
                                {hasNext && (
                                    <button 
                                        className="nav-btn right"
                                        onClick={(e) => { e.stopPropagation(); setSelectedPost(posts[currentIndex + 1]); }}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', padding: '8px', color: 'white', cursor: 'pointer' }}
                                    >
                                        <ChevronRight size={28} />
                                    </button>
                                )}
                            </div>
                            {(selectedPost.music_url || selectedPost.music_title) && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 16px',
                                    background: 'rgba(245,165,36,0.1)',
                                    borderBottom: '1px solid var(--border-color)',
                                }}>
                                    <Music size={14} color="#f5a524" />
                                    <span style={{ color: 'var(--text-active)', fontSize: '13px', fontWeight: '600', flex: 1 }}>
                                        {selectedPost.music_title || 'Music'}
                                        {selectedPost.music_artist ? ` • ${selectedPost.music_artist}` : ''}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#f5a524' }}>🔊 Playing</span>
                                </div>
                            )}
                            {selectedPost.caption && (
                                <div className="modal-details modal-details--sheet">
                                    <p className="modal-caption">{selectedPost.caption}</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}
                </>
            )}

            {/* Edit Profile Sheet */}
            {isOwnProfile && currentUser && profile && (
                <EditProfileSheet
                    isOpen={isEditOpen}
                    onClose={() => setIsEditOpen(false)}
                    currentUser={{ id: currentUser.id, username: currentUser.username || '', avatar_url: currentUser.avatar_url, bio: profile.bio }}
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
