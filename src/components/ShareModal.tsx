import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, Link as LinkIcon, Share, PlusCircle, Download } from 'lucide-react';
import { fetchConnectionUserIds, fetchFollowing, fetchProfilesByIds, fetchChattedUserIds, sendMessage, type ProfileData, type PostData, type MessageData } from '../lib/database';
import { supabase } from '../lib/supabase';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    post: PostData | null;
    currentUser: ProfileData & { id: string };
    onViewChat?: (userId: string) => void;
    onMessageSent?: (receiverId: string, message: MessageData) => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, post, currentUser, onViewChat, onMessageSent }) => {
    const [connections, setConnections] = useState<ProfileData[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingTo, setSendingTo] = useState<Record<string, boolean>>({});
    const [sentTo, setSentTo] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (isOpen && currentUser) {
            setLoading(true);
            Promise.all([
                fetchConnectionUserIds(currentUser.id),
                fetchChattedUserIds(currentUser.id),
                fetchFollowing(currentUser.id)
            ]).then(([connIds, reqIds, followingProfiles]) => {
                const idSet = new Set([...connIds, ...reqIds]);
                fetchProfilesByIds(Array.from(idSet)).then(fetchedProfiles => {
                    const map = new Map<string, ProfileData>();
                    fetchedProfiles.forEach(p => map.set(p.id, p));
                    followingProfiles.forEach(p => map.set(p.id, p));
                    
                    // Don't include the current user in the share list
                    map.delete(currentUser.id);
                    
                    setConnections(Array.from(map.values()));
                    setLoading(false);
                });
            });
        }
    }, [isOpen, currentUser]);

    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setSendingTo({});
                setSentTo({});
            }, 300);
        }
    }, [isOpen]);

    if (!isOpen || !post) return null;

    const handleSend = async (receiverId: string) => {
        if (sendingTo[receiverId] || sentTo[receiverId]) return;

        setSendingTo(prev => ({ ...prev, [receiverId]: true }));

        const sharePayload = {
            id: post.id,
            image_url: post.image_url,
            media_url: post.image_url,
            media_type: post.media_type,
            caption: post.caption,
            username: post.username,
            avatar_url: post.avatar_url,
        };

        const content = `[SHARE_POST] ${JSON.stringify(sharePayload)}`;

        const { data, error } = await sendMessage(currentUser.id, receiverId, content);

        setSendingTo(prev => ({ ...prev, [receiverId]: false }));
        
        if (!error && data) {
            setSentTo(prev => ({ ...prev, [receiverId]: true }));
            onMessageSent?.(receiverId, data);
        } else {
            alert("Failed to send message. Your session might have expired.");
        }
    };

    const handleAddToStory = async () => {
        try {
            await supabase.from('stories').insert({
                user_id: currentUser.id,
                media_url: post.image_url,
                media_type: post.media_type || 'image',
                created_at: new Date().toISOString()
            });
            alert("Added to your story!");
            onClose();
        } catch(e) {
            alert("Failed to add to story.");
        }
    };

    const handleCopyLink = () => {
        const url = `${window.location.origin}/home`; // Simplification since there's no single post route yet
        navigator.clipboard.writeText(url);
        alert("Link copied to clipboard!");
    };

    const handleNativeShare = () => {
        if (navigator.share) {
            navigator.share({
                title: `Post by ${post.username}`,
                text: post.caption || 'Check out this post on Knock Knock!',
                url: `${window.location.origin}`
            }).catch(console.error);
        } else {
            alert("Native sharing is not supported on this browser.");
        }
    };

    const handleDownload = async () => {
        try {
            const response = await fetch(post.image_url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `knock-knock-${post.id}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch(e) {
            alert("Download failed.");
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex',
            justifyContent: 'center', alignItems: 'flex-end',
            animation: 'fadeIn 0.2s ease-out'
        }} onClick={onClose}>
            <div style={{
                background: 'var(--surface-color)', width: '100%', maxWidth: '500px',
                borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                padding: '24px 0 0 0', display: 'flex', flexDirection: 'column',
                maxHeight: '85%',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px 16px', borderBottom: '1px solid #2c2c2e' }}>
                    <h2 style={{ color: 'var(--text-active)', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Share</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </header>

                {/* Direct Message List (Horizontal Scroll) */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #2c2c2e' }}>
                    <h3 style={{ color: 'var(--text-inactive)', fontSize: '14px', margin: '0 0 16px 0', fontWeight: '600' }}>Direct Message</h3>
                    
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                            <Loader2 size={24} className="animate-spin" color="#8e8e93" />
                        </div>
                    ) : connections.length === 0 ? (
                        <div style={{ color: 'var(--text-inactive)', fontSize: '14px', textAlign: 'center' }}>No connections to share with.</div>
                    ) : (
                        <div style={{ 
                            display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px',
                            scrollbarWidth: 'none', msOverflowStyle: 'none'
                        }}>
                            {connections.map(contact => (
                                <div key={contact.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '70px', flexShrink: 0 }}>
                                    <div style={{ position: 'relative', marginBottom: '8px' }}>
                                        <img 
                                            src={contact.avatar_url || 'https://i.pravatar.cc/150'} 
                                            alt={contact.username} 
                                            style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
                                        />
                                        {sentTo[contact.id] && (
                                            <div style={{ position: 'absolute', bottom: 0, right: 0, background: '#34C759', borderRadius: '50%', padding: '2px' }}>
                                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-active)' }} />
                                            </div>
                                        )}
                                    </div>
                                    <span style={{ color: 'var(--text-active)', fontSize: '12px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                                        {contact.username}
                                    </span>
                                    
                                    {sentTo[contact.id] ? (
                                        <button 
                                            onClick={() => onViewChat?.(contact.id)}
                                            style={{ marginTop: '8px', background: 'var(--border-color)', color: 'var(--text-active)', border: 'none', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer' }}
                                        >
                                            View
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleSend(contact.id)}
                                            disabled={sendingTo[contact.id]}
                                            style={{ marginTop: '8px', background: sendingTo[contact.id] ? 'var(--border-color)' : '#f5a524', color: 'var(--text-active)', border: 'none', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                        >
                                            {sendingTo[contact.id] ? <Loader2 size={12} className="animate-spin" /> : 'Send'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions (Horizontal Scroll) */}
                <div style={{ padding: '20px 24px 40px' }}>
                    <div style={{ 
                        display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '8px',
                        scrollbarWidth: 'none', msOverflowStyle: 'none'
                    }}>
                        
                        <button onClick={handleAddToStory} style={actionButtonStyle}>
                            <div style={iconCircleStyle}><PlusCircle size={24} color="var(--text-active)" /></div>
                            <span style={actionLabelStyle}>Add to Story</span>
                        </button>

                        <button onClick={handleCopyLink} style={actionButtonStyle}>
                            <div style={iconCircleStyle}><LinkIcon size={24} color="var(--text-active)" /></div>
                            <span style={actionLabelStyle}>Copy Link</span>
                        </button>

                        <button onClick={handleNativeShare} style={actionButtonStyle}>
                            <div style={iconCircleStyle}><Share size={24} color="var(--text-active)" /></div>
                            <span style={actionLabelStyle}>Share via...</span>
                        </button>

                        <button onClick={handleDownload} style={actionButtonStyle}>
                            <div style={iconCircleStyle}><Download size={24} color="var(--text-active)" /></div>
                            <span style={actionLabelStyle}>Download</span>
                        </button>

                    </div>
                </div>

            </div>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

const actionButtonStyle: React.CSSProperties = {
    background: 'none', border: 'none', display: 'flex', flexDirection: 'column', 
    alignItems: 'center', cursor: 'pointer', flexShrink: 0, width: '70px', padding: 0
};

const iconCircleStyle: React.CSSProperties = {
    width: '54px', height: '54px', borderRadius: '50%', background: 'var(--border-color)', 
    display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '8px'
};

const actionLabelStyle: React.CSSProperties = {
    color: 'var(--text-active)', fontSize: '12px', textAlign: 'center'
};

export default ShareModal;
