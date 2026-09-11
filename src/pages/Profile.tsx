import React, { useState, useEffect, useContext, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { 
    fetchProfileByUsername, fetchUserPosts, type ProfileData, type PostData,
    fetchFollowers, fetchFollowing, fetchFollowCounts, checkIfFollowing, toggleFollow,
    uploadMedia, updateProfile, blockUser, unblockUser,
    getCallRequestStatus, sendCallRequest, updateCallRequestStatus, fetchUserOnlineStatus, checkConnection, type CallRequestData,
    checkIfLiked, toggleLike, toggleImp, fetchUserImps, deletePost
} from '../lib/database';
import { Loader2, Settings, Grid, Film, UserPlus, Zap, Clock, TrendingUp, Users, UserCheck, Star, X, Camera, Phone, ShieldAlert, Lock, RefreshCw, Bell, Music, ChevronLeft, ChevronRight, Volume2, VolumeX, MessageCircle, Send, Heart, Share2, Trash2, Flame } from 'lucide-react';
import { isVideoPost, compressImage } from '../lib/media';
import PostMedia from '../components/PostMedia';
import EditProfileSheet from '../components/EditProfileSheet';
import { supabase } from '../lib/supabase';
import { audioPlayer } from '../lib/audioPlayer';

const ChatPanel = lazy(() => import('../components/ChatPanel'));
const ShareModal = lazy(() => import('../components/ShareModal'));
const CommentsSheet = lazy(() => import('../components/CommentsSheet'));

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
    const [isMuted, setIsMuted] = useState(false);

    // ── Share, Chat, and Comments States ──
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [postToShare, setPostToShare] = useState<PostData | null>(null);
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatUserId, setChatUserId] = useState<string | null>(null);
    const [chatRefreshKey, setChatRefreshKey] = useState(0);
    const [pendingShare, setPendingShare] = useState<{ receiverId: string; message: any } | null>(null);
    const [postFilter, setPostFilter] = useState<'all' | 'reels'>('all');

    // Selected post interaction states
    const [selectedPostLiked, setSelectedPostLiked] = useState(false);
    const [selectedPostLikesCount, setSelectedPostLikesCount] = useState(0);
    const [selectedPostImped, setSelectedPostImped] = useState(false);
    const [selectedPostImpsCount, setSelectedPostImpsCount] = useState(0);

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [callingStatus, setCallingStatus] = useState<'none' | 'calling'>('none');
    const [updatingAvatar, setUpdatingAvatar] = useState(false);
    const [isBlocking, setIsBlocking] = useState(false);
    
    // Call Requests & Online Status States
    const [callRequest, setCallRequest] = useState<CallRequestData | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [loadingCallAction, setLoadingCallAction] = useState(false);

    // Sync like & imp status when selectedPost changes
    useEffect(() => {
        if (selectedPost && currentUser) {
            checkIfLiked(currentUser.id, selectedPost.id).then(setSelectedPostLiked);
            setSelectedPostLikesCount(selectedPost.likes_count || 0);
            fetchUserImps(currentUser.id).then(imps => setSelectedPostImped(imps.includes(selectedPost.id)));
            setSelectedPostImpsCount(selectedPost.imps_count || 0);
        }
    }, [selectedPost?.id, currentUser?.id]);

    const handleSharePost = (post: PostData) => {
        const enrichedPost: PostData = {
            ...post,
            username: post.username || profile?.username || displayUsername,
            avatar_url: post.avatar_url || profile?.avatar_url || ''
        };
        setPostToShare(enrichedPost);
        setIsShareOpen(true);
    };

    const handleToggleSelectedLike = async () => {
        if (!currentUser || !selectedPost) return;
        const newLiked = !selectedPostLiked;
        setSelectedPostLiked(newLiked);
        setSelectedPostLikesCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));
        await toggleLike(currentUser.id, selectedPost.id, selectedPostLiked);
    };

    const handleToggleSelectedImp = async () => {
        if (!currentUser || !selectedPost) return;
        const newImped = !selectedPostImped;
        setSelectedPostImped(newImped);
        setSelectedPostImpsCount(prev => newImped ? prev + 1 : Math.max(0, prev - 1));
        await toggleImp(currentUser.id, selectedPost.id, selectedPostImped);
    };

    const handleDeleteSelectedPost = async () => {
        if (!currentUser || !selectedPost) return;
        if (window.confirm('Delete this post?')) {
            const ok = await deletePost(selectedPost.id);
            if (ok) {
                setPosts(prev => prev.filter(p => p.id !== selectedPost.id));
                setSelectedPost(null);
            }
        }
    };

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

                // Canonical URL update if accessed via alias like /profile/tara -> /profile/tara01
                if (profileData.username && cleanUser.toLowerCase() !== profileData.username.toLowerCase()) {
                    navigate(`/profile/${profileData.username}`, { replace: true });
                }
                
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

    const displayUsername = profile?.username || username;
    const isOwnProfile = currentUser && (currentUser.username === profile?.username || currentUser.id === profile?.id);

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

                                    {/* Message Button to direct message account owner */}
                                    <button 
                                        className="profile-action-btn" 
                                        style={{ background: 'linear-gradient(135deg, #f5a524, #ff4500)', color: '#000', fontWeight: 'bold' }}
                                        onClick={() => {
                                            setChatUserId(profile.id);
                                            setIsChatOpen(true);
                                        }}
                                        title="Message User"
                                    >
                                        <MessageCircle size={16} /> Message
                                    </button>

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
                    {!isBlocked && (
                        <button 
                            className="profile-action-btn" 
                            style={{ flex: isOwnProfile ? 1 : '0 0 auto', padding: isOwnProfile ? undefined : '0 12px' }}
                            onClick={() => {
                                const shareUrl = window.location.href;
                                if (navigator.share) {
                                    navigator.share({
                                        title: `${profile?.name || displayUsername} (@${displayUsername}) on Knock Knock`,
                                        text: `Check out ${profile?.name || displayUsername}'s profile on Knock Knock!`,
                                        url: shareUrl,
                                    }).catch(() => {});
                                } else {
                                    navigator.clipboard.writeText(shareUrl);
                                    alert('Profile link copied to clipboard!');
                                }
                            }}
                            title="Share Profile"
                        >
                            <Share2 size={16} /> Share
                        </button>
                    )}
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
                    <div 
                        className="upload-summary-card" 
                        style={{ cursor: 'pointer', border: postFilter === 'all' && activeTab === 'posts' ? '1px solid rgba(255,51,102,0.4)' : undefined }}
                        onClick={() => { setActiveTab('posts'); setPostFilter('all'); }}
                    >
                        <Grid size={20} color="#ff3366" />
                        <span className="font-bold">{photoPosts.length}</span>
                        <span style={{ color: 'var(--text-inactive)', fontSize: '12px' }}>Photos</span>
                    </div>
                    <div 
                        className="upload-summary-card" 
                        style={{ cursor: 'pointer', border: postFilter === 'reels' && activeTab === 'posts' ? '1px solid rgba(175,82,222,0.6)' : undefined }}
                        onClick={() => { setActiveTab('posts'); setPostFilter('reels'); }}
                    >
                        <Film size={20} color="#af52de" />
                        <span className="font-bold">{videoPosts.length}</span>
                        <span style={{ color: 'var(--text-inactive)', fontSize: '12px' }}>Videos / Reels</span>
                    </div>
                    <div 
                        className="upload-summary-card" 
                        style={{ cursor: 'pointer' }}
                        onClick={() => { setActiveTab('posts'); setPostFilter('all'); }}
                    >
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
                        {/* Sub-filter chips: All Posts vs Reels */}
                        {posts.length > 0 && (
                            <div style={{ display: 'flex', gap: '8px', padding: '8px 12px 10px', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    onClick={() => setPostFilter('all')}
                                    style={{
                                        padding: '5px 12px',
                                        borderRadius: '16px',
                                        border: postFilter === 'all' ? '1px solid #f5a524' : '1px solid rgba(255,255,255,0.1)',
                                        background: postFilter === 'all' ? 'rgba(245,165,36,0.15)' : 'rgba(255,255,255,0.04)',
                                        color: postFilter === 'all' ? '#f5a524' : 'var(--text-inactive)',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    All Posts ({posts.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPostFilter('reels')}
                                    style={{
                                        padding: '5px 12px',
                                        borderRadius: '16px',
                                        border: postFilter === 'reels' ? '1px solid #f5a524' : '1px solid rgba(255,255,255,0.1)',
                                        background: postFilter === 'reels' ? 'rgba(245,165,36,0.15)' : 'rgba(255,255,255,0.04)',
                                        color: postFilter === 'reels' ? '#f5a524' : 'var(--text-inactive)',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <Film size={12} />
                                    <span>Reels ({videoPosts.length})</span>
                                </button>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                            {(postFilter === 'reels' ? videoPosts : posts).map(post => {
                                const isVideo = isVideoPost(post);
                                return (
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

                                        {/* Quick Send Reel / Post Button directly on card */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSharePost(post);
                                            }}
                                            title={isVideo ? "Send Reel" : "Send Post"}
                                            style={{
                                                position: 'absolute',
                                                top: '6px',
                                                right: '6px',
                                                zIndex: 6,
                                                background: 'rgba(0,0,0,0.65)',
                                                backdropFilter: 'blur(8px)',
                                                border: '1px solid rgba(255,255,255,0.15)',
                                                borderRadius: '50%',
                                                width: '28px',
                                                height: '28px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#fff',
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
                                            }}
                                        >
                                            <Send size={13} />
                                        </button>

                                        {isVideo && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    bottom: 6,
                                                    left: 6,
                                                    background: 'rgba(0,0,0,0.65)',
                                                    backdropFilter: 'blur(6px)',
                                                    borderRadius: 6,
                                                    padding: '2px 6px',
                                                    fontSize: 10,
                                                    color: '#f5a524',
                                                    fontWeight: '700',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '3px',
                                                    pointerEvents: 'none',
                                                }}
                                            >
                                                <Film size={10} /> Reel
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
                                );
                            })}
                        </div>
                        {(postFilter === 'reels' ? videoPosts : posts).length === 0 && (
                            <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-inactive)' }}>
                                <Grid size={40} color="#2c2c2e" style={{ margin: '0 auto 1rem' }} />
                                <div className="font-bold" style={{ color: 'var(--text-active)', marginBottom: '4px' }}>
                                    {postFilter === 'reels' ? 'No Reels Found' : 'No Posts Yet'}
                                </div>
                                <p>
                                    {postFilter === 'reels' 
                                        ? `This account has not uploaded any video reels yet.`
                                        : `When ${isOwnProfile ? 'you share' : `${displayUsername} shares`} photos and videos, they will appear here.`
                                    }
                                </p>
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
                    const target = e.target as HTMLElement;
                    if (target.closest('button') || target.closest('.modal-mute-btn') || target.closest('.modal-close-btn') || target.closest('video') || target.closest('.nav-btn')) {
                        return;
                    }
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {profile?.avatar_url && (
                                        <img
                                            src={profile.avatar_url}
                                            alt=""
                                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }}
                                        />
                                    )}
                                    <span className="modal-username">{displayUsername}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
                                    {/* Prominent Send Reel Button in Top Bar */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSharePost(selectedPost);
                                        }}
                                        title={isVideoPost(selectedPost) ? "Send Reel to friends" : "Send Post to friends"}
                                        style={{
                                            height: '32px',
                                            padding: '0 12px',
                                            borderRadius: '16px',
                                            background: 'linear-gradient(135deg, #f5a524, #ff4500)',
                                            border: 'none',
                                            color: '#000',
                                            fontWeight: '700',
                                            fontSize: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 8px rgba(245,165,36,0.35)'
                                        }}
                                    >
                                        <Send size={13} />
                                        <span>Send</span>
                                    </button>

                                    <button
                                        className="modal-mute-btn"
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                                        aria-label={isMuted ? 'Unmute' : 'Mute'}
                                        style={{
                                            width: '34px',
                                            height: '34px',
                                            borderRadius: '50%',
                                            background: 'rgba(0, 0, 0, 0.5)',
                                            backdropFilter: 'blur(8px)',
                                            WebkitBackdropFilter: 'blur(8px)',
                                            border: 'none',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                    </button>
                                    <button className="modal-close-btn" type="button" onClick={() => setSelectedPost(null)}>
                                        <X size={22} />
                                    </button>
                                </div>
                            </div>
                            <div className="modal-media-stage" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
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
                                    autoPlay={true}
                                    soundOn={!isMuted}
                                    muted={isMuted}
                                    loop={true}
                                    objectFit="contain"
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

                            {/* Full Bottom Action Bar with Send Reel, Like, Comments, and Imp */}
                            <div className="modal-details modal-details--sheet">
                                {selectedPost.caption && (
                                    <p className="modal-caption">{selectedPost.caption}</p>
                                )}
                                {selectedPost.attached_link && (
                                    <a
                                        href={selectedPost.attached_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="modal-link"
                                        style={{ color: '#f5a524', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}
                                    >
                                        🔗 {selectedPost.attached_link}
                                    </a>
                                )}
                                <div className="modal-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    <button
                                        className={`modal-action-btn ${selectedPostLiked ? 'liked' : ''}`}
                                        onClick={handleToggleSelectedLike}
                                        style={{ color: selectedPostLiked ? '#ff4500' : 'var(--text-active)' }}
                                    >
                                        <Heart size={20} fill={selectedPostLiked ? '#ff4500' : 'none'} color={selectedPostLiked ? '#ff4500' : 'var(--text-active)'} />
                                        <span>{selectedPostLikesCount}</span>
                                    </button>
                                    <button
                                        className="modal-action-btn"
                                        onClick={() => {
                                            setCommentsPostId(selectedPost.id);
                                            setIsCommentsOpen(true);
                                        }}
                                    >
                                        <MessageCircle size={20} />
                                        <span>{selectedPost.comments_count || 0}</span>
                                    </button>
                                    <button
                                        className="modal-action-btn"
                                        onClick={() => handleSharePost(selectedPost)}
                                        style={{ color: '#f5a524', fontWeight: '700' }}
                                        title={isVideoPost(selectedPost) ? "Send Reel to friends" : "Send Post to friends"}
                                    >
                                        <Send size={20} />
                                        <span>{isVideoPost(selectedPost) ? 'Send Reel' : 'Send'}</span>
                                    </button>
                                    <button
                                        className={`modal-action-btn ${selectedPostImped ? 'imped' : ''}`}
                                        onClick={handleToggleSelectedImp}
                                        title="Imp / Boost post"
                                        style={{ color: selectedPostImped ? '#ff4500' : 'var(--text-active)' }}
                                    >
                                        <Flame size={20} fill={selectedPostImped ? '#ff4500' : 'none'} color={selectedPostImped ? '#ff4500' : 'var(--text-active)'} />
                                        <span>{selectedPostImpsCount}</span>
                                    </button>
                                    {isOwnProfile && (
                                        <button
                                            className="modal-action-btn"
                                            style={{ color: '#ff3b30', marginLeft: 'auto' }}
                                            onClick={handleDeleteSelectedPost}
                                            title="Delete Post"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    )}
                                </div>
                            </div>
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

            {/* Comments Sheet Modal */}
            {isCommentsOpen && commentsPostId && currentUser && (
                <Suspense fallback={null}>
                    <CommentsSheet
                        postId={commentsPostId}
                        isOpen={isCommentsOpen}
                        currentUser={{ id: currentUser.id, username: currentUser.username || 'user', avatar_url: currentUser.avatar_url }}
                        onClose={() => {
                            setIsCommentsOpen(false);
                            setCommentsPostId(null);
                        }}
                    />
                </Suspense>
            )}

            {/* Direct Chat Panel */}
            {isChatOpen && currentUser && (
                <Suspense fallback={null}>
                    <ChatPanel
                        isOpen={isChatOpen}
                        onClose={() => {
                            setIsChatOpen(false);
                            setChatUserId(null);
                        }}
                        currentUser={{ ...currentUser, username: currentUser.username || 'user' }}
                        initialOpenUserId={chatUserId}
                        refreshKey={chatRefreshKey}
                        pendingShare={pendingShare}
                    />
                </Suspense>
            )}

            {/* Send Reel / Share Modal */}
            {isShareOpen && postToShare && currentUser && (
                <Suspense fallback={null}>
                    <ShareModal
                        isOpen={isShareOpen}
                        onClose={() => {
                            setIsShareOpen(false);
                            setPostToShare(null);
                        }}
                        post={postToShare}
                        currentUser={{ ...currentUser, username: currentUser.username || 'user' }}
                        onMessageSent={(receiverId, message) => {
                            setPendingShare({ receiverId, message });
                            setChatRefreshKey(k => k + 1);
                        }}
                        onViewChat={(userId) => {
                            setIsShareOpen(false);
                            setPostToShare(null);
                            setChatUserId(userId);
                            setIsChatOpen(true);
                        }}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default Profile;
