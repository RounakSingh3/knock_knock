import React, { useState, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { fetchConnectionUserIds, fetchFollowing, fetchProfilesByIds, fetchChattedUserIds, sendMessage, type ProfileData, type PostData, type MessageData } from '../lib/database';

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

    // Reset state when modal closes
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

        // Create a JSON payload for the shared post
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
            alert("Failed to send message. Your session might have expired. Please try logging out and logging back in.");
            console.error("Message send error:", error);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex',
            justifyContent: 'center', alignItems: 'flex-end',
            animation: 'fadeIn 0.2s ease-out'
        }} onClick={onClose}>
            <div style={{
                background: '#1c1c1e', width: '100%', maxWidth: '500px',
                borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                padding: '24px', display: 'flex', flexDirection: 'column',
                maxHeight: '80vh',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }} onClick={e => e.stopPropagation()}>
                
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ color: '#fff', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Share to...</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </header>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: '#8e8e93' }}>
                            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : connections.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#8e8e93' }}>
                            No connections found. Follow some people to share posts with them!
                        </div>
                    ) : (
                        connections.map(contact => (
                            <div key={contact.id} style={{ 
                                display: 'flex', alignItems: 'center', padding: '12px 0', 
                                borderBottom: '1px solid #2c2c2e' 
                            }}>
                                <img 
                                    src={contact.avatar_url || 'https://i.pravatar.cc/150'} 
                                    alt={contact.username} 
                                    style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', marginRight: '16px' }}
                                />
                                <span style={{ flex: 1, color: '#fff', fontSize: '16px', fontWeight: '500' }}>
                                    {contact.username}
                                </span>
                                
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {sentTo[contact.id] ? (
                                        <button 
                                            onClick={() => onViewChat?.(contact.id)}
                                            style={{ 
                                                background: '#ff3366', color: '#fff', 
                                                border: 'none', padding: '6px 12px', 
                                                borderRadius: '20px', fontSize: '13px', fontWeight: 'bold',
                                                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
                                            }}
                                        >
                                            View Chat
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleSend(contact.id)}
                                            disabled={sendingTo[contact.id]}
                                            style={{ 
                                                background: sendingTo[contact.id] ? '#2c2c2e' : '#fff', 
                                                color: sendingTo[contact.id] ? '#fff' : '#000', 
                                                border: 'none', padding: '6px 16px', 
                                                borderRadius: '20px', fontSize: '13px', fontWeight: 'bold',
                                                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
                                            }}
                                        >
                                            {sendingTo[contact.id] ? <Loader2 size={14} className="animate-spin" /> : 'Send'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
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

export default ShareModal;
