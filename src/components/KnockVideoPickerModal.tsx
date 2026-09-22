import React, { useState, useEffect } from 'react';
import { X, Play, Video, Search, Check, Link as LinkIcon, Film, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { fetchUserPosts, fetchVideoPosts, fetchPostById, type PostData } from '../lib/database';
import { REELS_DATA, type ReelData } from '../pages/Reels';
import { isVideoPost, isVideoUrl } from '../lib/media';

export interface KnockVideoItem {
    id: string | number;
    videoUrl: string;
    caption?: string;
    username: string;
    avatarUrl?: string;
    likes?: number;
    posterUrl?: string;
}

interface KnockVideoPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectVideo: (video: KnockVideoItem) => void;
    currentUserId?: string;
    currentUsername?: string;
}

export const KnockVideoPickerModal: React.FC<KnockVideoPickerModalProps> = ({
    isOpen,
    onClose,
    onSelectVideo,
    currentUserId,
    currentUsername,
}) => {
    const [activeTab, setActiveTab] = useState<'mine' | 'community' | 'link'>('mine');
    const [myVideos, setMyVideos] = useState<KnockVideoItem[]>([]);
    const [communityVideos, setCommunityVideos] = useState<KnockVideoItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedVideo, setSelectedVideo] = useState<KnockVideoItem | null>(null);

    // Link tab state
    const [manualLink, setManualLink] = useState('');
    const [linkValidationMsg, setLinkValidationMsg] = useState<string | null>(null);

    // Fetch user videos and community videos
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        setLoading(true);

        const loadVideos = async () => {
            try {
                // 1. Fetch current user's videos
                let userVids: KnockVideoItem[] = [];
                if (currentUsername) {
                    const userPosts = await fetchUserPosts(currentUsername, currentUserId);
                    userVids = userPosts
                        .filter(p => isVideoPost(p) || isVideoUrl(p.image_url))
                        .map(p => ({
                            id: p.id,
                            videoUrl: p.image_url,
                            caption: p.caption,
                            username: p.username || currentUsername,
                            avatarUrl: p.avatar_url,
                            likes: p.likes_count,
                            posterUrl: p.image_url
                        }));
                }

                // 2. Fetch community video posts from Knock Knock
                const commPosts = await fetchVideoPosts(currentUserId);
                const commVids: KnockVideoItem[] = commPosts.map(p => ({
                    id: p.id,
                    videoUrl: p.image_url,
                    caption: p.caption,
                    username: p.username || 'user',
                    avatarUrl: p.avatar_url,
                    likes: p.likes_count,
                    posterUrl: p.image_url
                }));

                // 3. Include default Knock Knock reels as community videos
                const reelItems: KnockVideoItem[] = REELS_DATA.map(r => ({
                    id: r.id,
                    videoUrl: r.videoUrl,
                    caption: r.caption,
                    username: r.creator,
                    avatarUrl: r.creatorAvatar,
                    likes: r.likes,
                    posterUrl: r.posterUrl
                }));

                // Combine and deduplicate
                const seenIds = new Set<string | number>();
                const allCommunity: KnockVideoItem[] = [];
                [...commVids, ...reelItems].forEach(item => {
                    if (!seenIds.has(item.id)) {
                        seenIds.add(item.id);
                        allCommunity.push(item);
                    }
                });

                if (isMounted) {
                    setMyVideos(userVids);
                    setCommunityVideos(allCommunity);
                    // If user has no videos of their own, default to community videos
                    if (userVids.length === 0) {
                        setActiveTab('community');
                    }
                }
            } catch (err) {
                console.error('[KnockVideoPickerModal] Error loading videos:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadVideos();
        return () => { isMounted = false; };
    }, [isOpen, currentUserId, currentUsername]);

    if (!isOpen) return null;

    const handleConfirmSelection = () => {
        if (!selectedVideo) return;
        onSelectVideo(selectedVideo);
        onClose();
    };

    const handleManualLinkValidate = async () => {
        const raw = manualLink.trim();
        if (!raw) return;

        setLinkValidationMsg(null);

        // Check if direct video URL
        if (isVideoUrl(raw) || /\.(mp4|webm|mov)(\?.*)?$/i.test(raw)) {
            const item: KnockVideoItem = {
                id: `video-${Date.now()}`,
                videoUrl: raw,
                caption: 'Attached Knock Knock Video',
                username: currentUsername || 'creator',
            };
            setSelectedVideo(item);
            return;
        }

        // Check if it's a Knock Knock post ID or URL
        let extractedId = raw;
        if (raw.includes('/reels?id=')) {
            const match = raw.match(/[?&]id=([^&#]+)/);
            if (match) extractedId = match[1];
        } else if (raw.includes('kk:video:')) {
            extractedId = raw.replace('kk:video:', '').trim();
        }

        const foundPost = await fetchPostById(extractedId);
        if (foundPost && (isVideoPost(foundPost) || isVideoUrl(foundPost.image_url))) {
            const item: KnockVideoItem = {
                id: foundPost.id,
                videoUrl: foundPost.image_url,
                caption: foundPost.caption,
                username: foundPost.username,
                avatarUrl: foundPost.avatar_url,
                likes: foundPost.likes_count,
            };
            setSelectedVideo(item);
            setLinkValidationMsg('✅ Knock Knock video found and verified!');
        } else {
            setLinkValidationMsg('Could not find a Knock Knock video matching this link or ID. Please check the URL or pick from the lists.');
        }
    };

    // Filter by search query
    const filterVideos = (list: KnockVideoItem[]) => {
        if (!searchQuery.trim()) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(v => 
            (v.caption && v.caption.toLowerCase().includes(q)) ||
            (v.username && v.username.toLowerCase().includes(q))
        );
    };

    const currentList = activeTab === 'mine' ? filterVideos(myVideos) : filterVideos(communityVideos);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
        }}>
            <div style={{
                background: 'var(--surface-color, #18181b)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '480px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '18px 20px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #f5a524, #ff6b35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(245, 165, 36, 0.35)'
                        }}>
                            <Film size={20} color="#000" strokeWidth={2.4} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-active, #fff)' }}>
                                Attach Knock Knock Video
                            </h3>
                            <span style={{ fontSize: '11px', color: 'var(--text-inactive, #a1a1aa)' }}>
                                Viewers can swipe left to watch this video
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: 'var(--text-inactive, #a1a1aa)', cursor: 'pointer', padding: '4px' }}
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    background: 'rgba(0, 0, 0, 0.4)',
                    padding: '6px',
                    gap: '6px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                    <button
                        onClick={() => setActiveTab('mine')}
                        style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: '12px',
                            border: 'none',
                            background: activeTab === 'mine' ? 'linear-gradient(135deg, #f5a524, #ff6b35)' : 'transparent',
                            color: activeTab === 'mine' ? '#000' : 'var(--text-inactive, #a1a1aa)',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        📹 My Videos ({myVideos.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('community')}
                        style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: '12px',
                            border: 'none',
                            background: activeTab === 'community' ? 'linear-gradient(135deg, #f5a524, #ff6b35)' : 'transparent',
                            color: activeTab === 'community' ? '#000' : 'var(--text-inactive, #a1a1aa)',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        🌐 Community Reels
                    </button>
                    <button
                        onClick={() => setActiveTab('link')}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '12px',
                            border: 'none',
                            background: activeTab === 'link' ? 'linear-gradient(135deg, #f5a524, #ff6b35)' : 'transparent',
                            color: activeTab === 'link' ? '#000' : 'var(--text-inactive, #a1a1aa)',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        🔗 Link / ID
                    </button>
                </div>

                {/* Search Bar for video lists */}
                {activeTab !== 'link' && (
                    <div style={{ padding: '12px 16px 6px', position: 'relative' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '14px',
                            padding: '8px 12px'
                        }}>
                            <Search size={16} color="#8e8e93" style={{ marginRight: '8px' }} />
                            <input
                                type="text"
                                placeholder={`Search ${activeTab === 'mine' ? 'your uploaded' : 'Knock Knock'} videos...`}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-active, #fff)',
                                    fontSize: '13px',
                                    outline: 'none'
                                }}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', padding: 0 }}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Video Content Area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: '10px' }}>
                            <Loader2 size={32} color="#f5a524" className="animate-spin" />
                            <span style={{ fontSize: '13px', color: 'var(--text-inactive, #a1a1aa)' }}>
                                Loading Knock Knock videos...
                            </span>
                        </div>
                    ) : activeTab === 'link' ? (
                        /* Direct Link / Post ID Input */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '10px 0' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-inactive, #a1a1aa)', display: 'block', marginBottom: '6px' }}>
                                    Enter Knock Knock Video Link, Reel URL, or Post ID:
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        placeholder="e.g. /reels?id=123 or https://..."
                                        value={manualLink}
                                        onChange={e => setManualLink(e.target.value)}
                                        style={{
                                            flex: 1,
                                            background: 'rgba(255, 255, 255, 0.06)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '12px',
                                            padding: '10px 14px',
                                            color: '#fff',
                                            fontSize: '13px',
                                            outline: 'none'
                                        }}
                                    />
                                    <button
                                        onClick={handleManualLinkValidate}
                                        style={{
                                            background: 'linear-gradient(135deg, #f5a524, #ff6b35)',
                                            border: 'none',
                                            borderRadius: '12px',
                                            padding: '0 16px',
                                            color: '#000',
                                            fontWeight: 800,
                                            fontSize: '12px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Verify
                                    </button>
                                </div>
                            </div>

                            {linkValidationMsg && (
                                <div style={{
                                    fontSize: '12px',
                                    color: linkValidationMsg.startsWith('✅') ? '#22c55e' : '#f5a524',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    {linkValidationMsg.startsWith('✅') ? <Check size={14} /> : <AlertCircle size={14} />}
                                    <span>{linkValidationMsg}</span>
                                </div>
                            )}

                            <div style={{
                                background: 'rgba(245, 165, 36, 0.08)',
                                border: '1px solid rgba(245, 165, 36, 0.2)',
                                borderRadius: '14px',
                                padding: '12px 14px',
                                fontSize: '12px',
                                color: 'var(--text-inactive, #a1a1aa)',
                                lineHeight: 1.5
                            }}>
                                💡 Tip: You can connect any video uploaded to Knock Knock. When viewers view your post or 24h Knockup, they can swipe left to jump directly into this video!
                            </div>
                        </div>
                    ) : currentList.length === 0 ? (
                        /* Empty State */
                        <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '50%',
                                background: 'rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 12px'
                            }}>
                                <Video size={28} color="#8e8e93" />
                            </div>
                            <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: 'var(--text-active, #fff)' }}>
                                {activeTab === 'mine' ? 'No Uploaded Videos Found' : 'No Videos Found'}
                            </h4>
                            <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-inactive, #a1a1aa)', lineHeight: 1.4 }}>
                                {activeTab === 'mine' 
                                    ? "You haven't posted any videos yet on your account. You can pick any video from Community Reels to attach!" 
                                    : "No matching videos found in this search."}
                            </p>
                            {activeTab === 'mine' && (
                                <button
                                    onClick={() => setActiveTab('community')}
                                    style={{
                                        background: 'linear-gradient(135deg, #f5a524, #ff6b35)',
                                        border: 'none',
                                        borderRadius: '16px',
                                        padding: '8px 18px',
                                        color: '#000',
                                        fontWeight: 800,
                                        fontSize: '12px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Browse Community Reels
                                </button>
                            )}
                        </div>
                    ) : (
                        /* Video List */
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                            {currentList.map((item) => {
                                const isSelected = selectedVideo?.id === item.id;
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedVideo(item)}
                                        style={{
                                            background: isSelected ? 'rgba(245, 165, 36, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                            border: isSelected ? '2px solid #f5a524' : '1px solid rgba(255, 255, 255, 0.08)',
                                            borderRadius: '16px',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            position: 'relative',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            transition: 'transform 0.15s ease, border-color 0.15s ease'
                                        }}
                                    >
                                        {/* Thumbnail Container */}
                                        <div style={{ position: 'relative', width: '100%', aspectRatio: '9 / 12', background: '#000', overflow: 'hidden' }}>
                                            <video
                                                src={item.videoUrl}
                                                muted
                                                playsInline
                                                preload="metadata"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                            {/* Play Icon Badge */}
                                            <div style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                background: 'rgba(0,0,0,0.65)',
                                                borderRadius: '50%',
                                                padding: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backdropFilter: 'blur(4px)'
                                            }}>
                                                <Play size={12} color="#fff" fill="#fff" />
                                            </div>

                                            {/* Selection Checkmark */}
                                            {isSelected && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '8px',
                                                    left: '8px',
                                                    background: '#f5a524',
                                                    borderRadius: '50%',
                                                    padding: '3px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
                                                }}>
                                                    <Check size={14} color="#000" strokeWidth={3} />
                                                </div>
                                            )}

                                            {/* Creator Info */}
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 100%)',
                                                padding: '20px 8px 6px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                {item.avatarUrl && (
                                                    <img
                                                        src={item.avatarUrl}
                                                        alt={item.username}
                                                        style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }}
                                                    />
                                                )}
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    @{item.username}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Caption snippet */}
                                        <div style={{ padding: '8px 10px', fontSize: '11px', color: 'var(--text-inactive, #a1a1aa)', lineHeight: 1.35, height: '32px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.caption || 'Knock Knock Video'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Selected Preview & Confirm Bar */}
                {selectedVideo && (
                    <div style={{
                        padding: '14px 18px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: '#000',
                                overflow: 'hidden',
                                flexShrink: 0,
                                position: 'relative'
                            }}>
                                <video src={selectedVideo.videoUrl} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                                    <Play size={12} fill="#fff" color="#fff" />
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span style={{ fontSize: '12px', fontWeight: 800, color: '#f5a524', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    @{selectedVideo.username}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-inactive, #a1a1aa)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {selectedVideo.caption || 'Knock Knock Video'}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={handleConfirmSelection}
                            style={{
                                background: 'linear-gradient(135deg, #f5a524, #ff6b35)',
                                border: 'none',
                                borderRadius: '14px',
                                padding: '10px 18px',
                                color: '#000',
                                fontWeight: 800,
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                flexShrink: 0,
                                boxShadow: '0 4px 15px rgba(245, 165, 36, 0.4)'
                            }}
                        >
                            <Check size={16} strokeWidth={2.5} />
                            <span>Attach Video</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KnockVideoPickerModal;
