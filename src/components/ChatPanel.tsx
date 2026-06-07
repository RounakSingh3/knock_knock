import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, Send, Check, CheckCheck } from 'lucide-react';
import { fetchConnectionUserIds, fetchProfilesByIds, fetchMessages, sendMessage, subscribeToMessages, markMessagesAsRead, type ProfileData, type MessageData } from '../lib/database';
import { supabase } from '../lib/supabase';

interface ChatContact extends ProfileData {
    lastMessage?: MessageData | null;
    unreadCount?: number;
}

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: ProfileData & { username: string; id: string };
    initialOpenUserId?: string | null;
    refreshKey?: number;
    pendingShare?: { receiverId: string; message: MessageData } | null;
}

function parseSharePayload(content: string) {
    try {
        return JSON.parse(content.replace('[SHARE_POST] ', ''));
    } catch {
        return null;
    }
}

function isShareReel(content: string) {
    const payload = parseSharePayload(content);
    if (!payload) return false;
    const url = payload.image_url || payload.media_url || '';
    return payload.media_type === 'video' || /\.(mp4|webm|mov)$/i.test(url);
}

function getSharePreview(content: string, isMe: boolean, contactName: string) {
    const reel = isShareReel(content);
    const label = reel ? 'reel' : 'post';
    return isMe ? `You shared a ${label}` : `📷 ${contactName} shared a ${label}`;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
    isOpen,
    onClose,
    currentUser,
    initialOpenUserId,
    refreshKey = 0,
    pendingShare = null,
}) => {
    const [allContacts, setAllContacts] = useState<ChatContact[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(false);

    const [view, setView] = useState<'list' | 'chat'>('list');
    const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);

    const [messages, setMessages] = useState<MessageData[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [messageInput, setMessageInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Hide bottom navigation when ChatPanel is open
    useEffect(() => {
        const nav = document.querySelector('.bottom-nav') as HTMLElement;
        if (!nav) return;
        
        if (isOpen) {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'flex';
        }
        
        return () => {
            if (nav) nav.style.display = 'flex';
        };
    }, [isOpen]);

    const fetchChatThreads = async (myId: string) => {
        const { data: msgs, error } = await supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching chat threads:', error);
            return [];
        }

        const threadsMap = new Map<string, { lastMessage: MessageData; unreadCount: number }>();
        (msgs || []).forEach((m: MessageData) => {
            const partnerId = m.sender_id === myId ? m.receiver_id : m.sender_id;
            if (!threadsMap.has(partnerId)) {
                threadsMap.set(partnerId, { lastMessage: m, unreadCount: 0 });
            }
            if (m.receiver_id === myId && !m.is_read) {
                threadsMap.get(partnerId)!.unreadCount += 1;
            }
        });

        return Array.from(threadsMap.entries()).map(([partnerId, data]) => ({
            partnerId,
            ...data,
        }));
    };

    const refreshContacts = useCallback(() => {
        setLoadingContacts(true);
        Promise.all([
            fetchConnectionUserIds(currentUser.id),
            fetchChatThreads(currentUser.id),
        ]).then(([connIds, threadData]) => {
            const partnerIds = threadData.map(t => t.partnerId);

            if (initialOpenUserId && !partnerIds.includes(initialOpenUserId)) {
                partnerIds.push(initialOpenUserId);
            }

            fetchProfilesByIds(partnerIds).then(fetchedProfiles => {
                const profilesMap = new Map(fetchedProfiles.map(p => [p.id, p]));

                const activeChats: ChatContact[] = threadData
                    .map(t => {
                        const profile = profilesMap.get(t.partnerId);
                        if (!profile) return null;
                        return {
                            ...profile,
                            lastMessage: t.lastMessage,
                            unreadCount: t.unreadCount,
                        };
                    })
                    .filter(Boolean) as ChatContact[];

                activeChats.sort((a, b) => {
                    const timeA = a.lastMessage?.created_at ?? '';
                    const timeB = b.lastMessage?.created_at ?? '';
                    return timeB.localeCompare(timeA);
                });

                const chattedSet = new Set(threadData.map(t => t.partnerId));
                const unchattedConnIds = connIds.filter(id => !chattedSet.has(id));

                fetchProfilesByIds(unchattedConnIds).then(unchattedProfiles => {
                    const unchattedConns: ChatContact[] = unchattedProfiles.map(p => ({
                        ...p,
                        lastMessage: null,
                        unreadCount: 0,
                    }));

                    let merged = [...activeChats, ...unchattedConns];

                    if (initialOpenUserId && !merged.some(c => c.id === initialOpenUserId)) {
                        const p = profilesMap.get(initialOpenUserId);
                        if (p) {
                            merged = [{ ...p, lastMessage: null, unreadCount: 0 }, ...merged];
                        }
                    }

                    setAllContacts(merged);
                    setLoadingContacts(false);

                    if (initialOpenUserId) {
                        const targetUser = merged.find(p => p.id === initialOpenUserId);
                        if (targetUser) {
                            setSelectedContact(targetUser);
                            setView('chat');
                        }
                    }
                });
            });
        });
    }, [currentUser.id, initialOpenUserId]);

    useEffect(() => {
        if (!isOpen) {
            setView('list');
            setSelectedContact(null);
            return;
        }

        refreshContacts();

        const channel = supabase
            .channel(`chat-list-${currentUser.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                () => refreshContacts()
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [isOpen, currentUser.id, refreshKey, refreshContacts]);

    useEffect(() => {
        if (!pendingShare) return;

        setAllContacts(prev => {
            const existing = prev.find(c => c.id === pendingShare.receiverId);
            if (existing) {
                return [
                    { ...existing, lastMessage: pendingShare.message, unreadCount: 0 },
                    ...prev.filter(c => c.id !== pendingShare.receiverId),
                ].sort((a, b) => {
                    const timeA = a.lastMessage?.created_at ?? '';
                    const timeB = b.lastMessage?.created_at ?? '';
                    return timeB.localeCompare(timeA);
                });
            }
            return prev;
        });

        if (view === 'chat' && selectedContact?.id === pendingShare.receiverId) {
            setMessages(prev => {
                if (prev.some(m => m.id === pendingShare.message.id)) return prev;
                return [...prev, pendingShare.message];
            });
            scrollToBottom();
        }
    }, [pendingShare, view, selectedContact?.id]);

    useEffect(() => {
        if (view === 'chat' && selectedContact) {
            setLoadingMessages(true);
            markMessagesAsRead(selectedContact.id, currentUser.id);

            fetchMessages(currentUser.id, selectedContact.id).then(data => {
                setMessages(data);
                setLoadingMessages(false);
                scrollToBottom();
            });

            const subscription = subscribeToMessages(currentUser.id, selectedContact.id, (newMsg) => {
                markMessagesAsRead(selectedContact.id, currentUser.id);
                setMessages(prev => {
                    if (prev.some(m => m.id === newMsg.id || (m.id.startsWith('temp-') && m.content === newMsg.content))) {
                        return prev.map(m => (m.id.startsWith('temp-') && m.content === newMsg.content) ? newMsg : m);
                    }
                    return [...prev, newMsg];
                });
                scrollToBottom();
            });

            return () => {
                subscription.unsubscribe();
            };
        }
    }, [view, selectedContact, currentUser.id]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageInput.trim() || !selectedContact) return;

        const text = messageInput.trim();
        setMessageInput('');

        const optimisticMsg: MessageData = {
            id: `temp-${Date.now()}`,
            sender_id: currentUser.id,
            receiver_id: selectedContact.id,
            content: text,
            created_at: new Date().toISOString(),
            is_read: false,
        };
        setMessages(prev => [...prev, optimisticMsg]);
        scrollToBottom();

        const { data, error } = await sendMessage(currentUser.id, selectedContact.id, text);
        if (error) {
            console.error('Failed to send:', error);
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        } else if (data) {
            setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data : m));
            setAllContacts(prev => {
                const updated = prev.map(c =>
                    c.id === selectedContact.id
                        ? { ...c, lastMessage: data }
                        : c
                );
                return updated.sort((a, b) => {
                    const timeA = a.lastMessage?.created_at ?? '';
                    const timeB = b.lastMessage?.created_at ?? '';
                    return timeB.localeCompare(timeA);
                });
            });
        }
    };

    const formatTime = (iso: string) => {
        const date = new Date(iso);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderSharedContent = (msg: MessageData, isMe: boolean) => {
        const sharedPost = parseSharePayload(msg.content);
        if (!sharedPost) return 'Shared a post';

        const isReel = isShareReel(msg.content);
        const mediaUrl = sharedPost.image_url || sharedPost.media_url;
        const isVideo = isReel || (mediaUrl && /\.(mp4|webm|mov)$/i.test(mediaUrl));

        let chatFilter = sharedPost.css_filter || 'none';
        try {
            if (chatFilter === 'none' && mediaUrl) {
                const url = new URL(mediaUrl);
                const f = url.searchParams.get('filter');
                if (f) chatFilter = decodeURIComponent(f);
            }
        } catch(e) {}

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', opacity: 0.8, padding: '0 4px', fontWeight: 'bold' }}>
                    {isMe ? 'You shared' : `${selectedContact?.username || 'They'} shared`}{' '}
                    {sharedPost.username ? `@${sharedPost.username}'s` : 'a'} {isReel ? 'reel' : 'post'}
                </div>
                <div style={{
                    position: 'relative', width: '200px', height: '260px',
                    borderRadius: '12px', overflow: 'hidden', background: '#1c1c1e',
                }}>
                    {isVideo ? (
                        <video
                            src={mediaUrl}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: chatFilter }}
                            muted
                            playsInline
                            controls
                            preload="metadata"
                        />
                    ) : (
                        <img src={mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: chatFilter }} />
                    )}
                </div>
                {sharedPost.caption && (
                    <div style={{
                        fontSize: '13px', padding: '0 4px',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                        {sharedPost.caption}
                    </div>
                )}
            </div>
        );
    };

    if (!isOpen) return null;

    const chattedContacts = allContacts.filter(c => c.lastMessage);
    const unchattedContacts = allContacts.filter(c => !c.lastMessage);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: '#000', zIndex: 1000, display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.3s ease-out',
        }}>
            {view === 'list' ? (
                <>
                    <header style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid #2c2c2e', background: '#121212' }}>
                        <h2 style={{ flex: 1, fontSize: '20px', fontWeight: 'bold', color: '#fff', margin: 0 }}>Messages</h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8e8e93' }}>
                            <X size={24} />
                        </button>
                    </header>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                        {loadingContacts ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#8e8e93' }}>Loading...</div>
                        ) : allContacts.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#8e8e93' }}>
                                No messages yet. Share a reel or post to start chatting!
                            </div>
                        ) : (
                            <>
                                {chattedContacts.map(contact => {
                                    const lastMsg = contact.lastMessage!;
                                    const unread = contact.unreadCount || 0;

                                    const getMessagePreview = () => {
                                        const isMe = lastMsg.sender_id === currentUser.id;
                                        if (lastMsg.content.startsWith('[SHARE_POST]')) {
                                            return getSharePreview(lastMsg.content, isMe, contact.username);
                                        }
                                        if (lastMsg.content.startsWith('[VOICE_REACTION]')) {
                                            return isMe ? 'You sent a voice reaction' : `🎙️ ${contact.username} sent a voice reaction`;
                                        }
                                        return isMe ? `You: ${lastMsg.content}` : lastMsg.content;
                                    };

                                    return (
                                        <div
                                            key={contact.id}
                                            onClick={() => { setSelectedContact(contact); setView('chat'); }}
                                            style={{
                                                display: 'flex', alignItems: 'center', padding: '16px',
                                                borderBottom: '1px solid #1c1c1e', cursor: 'pointer',
                                                backgroundColor: unread > 0 ? 'rgba(255, 51, 102, 0.05)' : 'transparent',
                                            }}
                                        >
                                            <img
                                                src={contact.avatar_url || 'https://i.pravatar.cc/150'}
                                                alt={contact.username}
                                                style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', marginRight: '16px' }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <h3 style={{
                                                        margin: 0, fontSize: '16px', color: '#fff',
                                                        fontWeight: unread > 0 ? '700' : '600',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>
                                                        {contact.username}
                                                    </h3>
                                                    <span style={{ fontSize: '11px', color: unread > 0 ? '#ff3366' : '#8e8e93' }}>
                                                        {new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                    <p style={{
                                                        margin: 0, fontSize: '14px',
                                                        color: unread > 0 ? '#fff' : '#8e8e93',
                                                        fontWeight: unread > 0 ? '500' : 'normal',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                        marginRight: '8px', flex: 1,
                                                    }}>
                                                        {getMessagePreview()}
                                                    </p>
                                                    {unread > 0 && (
                                                        <span style={{
                                                            background: '#ff3366', color: '#fff', fontSize: '11px',
                                                            fontWeight: 'bold', borderRadius: '50%', minWidth: '18px',
                                                            height: '18px', display: 'flex', alignItems: 'center',
                                                            justifyContent: 'center', padding: '0 4px',
                                                        }}>
                                                            {unread}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {unchattedContacts.length > 0 && chattedContacts.length > 0 && (
                                    <div style={{ padding: '12px 16px 8px', color: '#8e8e93', fontSize: '13px', fontWeight: '600' }}>
                                        Connections
                                    </div>
                                )}

                                {unchattedContacts.map(contact => (
                                    <div
                                        key={contact.id}
                                        onClick={() => { setSelectedContact(contact); setView('chat'); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', padding: '16px',
                                            borderBottom: '1px solid #1c1c1e', cursor: 'pointer',
                                        }}
                                    >
                                        <img
                                            src={contact.avatar_url || 'https://i.pravatar.cc/150'}
                                            alt={contact.username}
                                            style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', marginRight: '16px' }}
                                        />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', fontWeight: '600' }}>
                                                {contact.username}
                                            </h3>
                                            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#8e8e93' }}>
                                                Tap to chat
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <header style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid #2c2c2e', background: '#121212' }}>
                        <button
                            onClick={() => {
                                setView('list');
                                if (initialOpenUserId) onClose();
                            }}
                            style={{ background: 'none', border: 'none', color: '#ff3366', marginRight: '12px', display: 'flex', alignItems: 'center' }}
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <img
                            src={selectedContact?.avatar_url || 'https://i.pravatar.cc/150'}
                            alt=""
                            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', marginRight: '12px' }}
                        />
                        <h2 style={{ flex: 1, fontSize: '18px', fontWeight: '600', color: '#fff', margin: 0 }}>{selectedContact?.username}</h2>
                    </header>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
                        {loadingMessages ? (
                            <div style={{ textAlign: 'center', color: '#8e8e93', margin: 'auto' }}>Loading chat...</div>
                        ) : (
                            messages.map(msg => {
                                const isMe = msg.sender_id === currentUser.id;
                                const isShare = msg.content.startsWith('[SHARE_POST]');
                                return (
                                    <div
                                        key={msg.id}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: isMe ? 'flex-end' : 'flex-start',
                                            marginBottom: '12px',
                                        }}
                                    >
                                        <div style={{
                                            background: isMe ? '#ff3366' : '#2c2c2e',
                                            color: '#fff',
                                            padding: isShare ? '8px' : '12px 16px',
                                            borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                            maxWidth: '75%',
                                            fontSize: '15px',
                                            lineHeight: '1.4',
                                            wordBreak: 'break-word',
                                        }}>
                                            {isShare ? renderSharedContent(msg, isMe) : (
                                                msg.content.startsWith('[VOICE_REACTION]') ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <div style={{ fontSize: '12px', opacity: 0.8, fontWeight: 'bold' }}>
                                                            🎙️ Voice Reaction
                                                        </div>
                                                        <audio
                                                            controls
                                                            src={msg.content.replace('[VOICE_REACTION] ', '')}
                                                            style={{
                                                                width: '200px', height: '36px',
                                                                borderRadius: '18px',
                                                                filter: 'invert(1) hue-rotate(180deg)',
                                                            }}
                                                        />
                                                    </div>
                                                ) : msg.content
                                            )}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#8e8e93', marginTop: '4px', display: 'flex', alignItems: 'center' }}>
                                            {formatTime(msg.created_at)}
                                            {isMe && (
                                                <span style={{ marginLeft: '4px' }}>
                                                    {msg.is_read ? <CheckCheck size={14} color="#34C759" /> : <Check size={14} />}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSend} style={{ display: 'flex', padding: '12px', background: '#121212', borderTop: '1px solid #2c2c2e' }}>
                        <input
                            type="text"
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            placeholder="Message..."
                            style={{
                                flex: 1,
                                background: '#2c2c2e',
                                border: 'none',
                                borderRadius: '24px',
                                padding: '12px 16px',
                                color: '#fff',
                                outline: 'none',
                                fontSize: '15px',
                            }}
                        />
                        <button
                            type="submit"
                            disabled={!messageInput.trim()}
                            style={{
                                background: messageInput.trim() ? '#ff3366' : '#2c2c2e',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: '44px',
                                height: '44px',
                                marginLeft: '12px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                cursor: messageInput.trim() ? 'pointer' : 'default',
                            }}
                        >
                            <Send size={20} style={{ marginLeft: '4px' }} />
                        </button>
                    </form>
                </>
            )}
            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
            `}</style>
        </div>
    );
};

export default ChatPanel;
