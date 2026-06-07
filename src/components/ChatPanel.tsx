import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, Send, Check, CheckCheck } from 'lucide-react';
import { fetchConnectionUserIds, fetchChattedUserIds, fetchProfilesByIds, fetchMessages, sendMessage, subscribeToMessages, markMessagesAsRead, type ProfileData, type MessageData } from '../lib/database';
import { supabase } from '../lib/supabase';

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: ProfileData & { username: string; id: string };
    initialOpenUserId?: string | null;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose, currentUser, initialOpenUserId }) => {
    const [connections, setConnections] = useState<ProfileData[]>([]);
    const [requests, setRequests] = useState<ProfileData[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'connections' | 'requests'>('connections');
    const [view, setView] = useState<'list' | 'chat'>('list');
    const [selectedContact, setSelectedContact] = useState<ProfileData | null>(null);
    
    const [messages, setMessages] = useState<MessageData[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [messageInput, setMessageInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

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
        (msgs || []).forEach((m: any) => {
            const partnerId = m.sender_id === myId ? m.receiver_id : m.sender_id;
            if (!threadsMap.has(partnerId)) {
                threadsMap.set(partnerId, {
                    lastMessage: m,
                    unreadCount: 0
                });
            }
            if (m.receiver_id === myId && !m.is_read) {
                threadsMap.get(partnerId)!.unreadCount += 1;
            }
        });

        return Array.from(threadsMap.entries()).map(([partnerId, data]) => ({
            partnerId,
            ...data
        }));
    };

    // Fetch contacts when panel opens and subscribe to real-time message changes
    useEffect(() => {
        if (!isOpen) {
            setView('list');
            setSelectedContact(null);
            return;
        }

        const refreshContacts = () => {
            setLoadingContacts(true);
            Promise.all([
                fetchConnectionUserIds(currentUser.id),
                fetchChatThreads(currentUser.id)
            ]).then(([connIds, threadData]) => {
                const connSet = new Set(connIds);
                const partnerIds = threadData.map(t => t.partnerId);
                
                if (initialOpenUserId && !partnerIds.includes(initialOpenUserId)) {
                    partnerIds.push(initialOpenUserId);
                }

                fetchProfilesByIds(partnerIds).then(fetchedProfiles => {
                    const profilesMap = new Map(fetchedProfiles.map(p => [p.id, p]));
                    
                    const sortedContacts = threadData
                        .map(t => {
                            const profile = profilesMap.get(t.partnerId);
                            if (!profile) return null;
                            return {
                                ...profile,
                                lastMessage: t.lastMessage,
                                unreadCount: t.unreadCount
                            };
                        })
                        .filter(Boolean) as any[];

                    // Add any connections that don't have message threads yet
                    const chattedSet = new Set(threadData.map(t => t.partnerId));
                    const unchattedConnIds = connIds.filter(id => !chattedSet.has(id));
                    
                    fetchProfilesByIds(unchattedConnIds).then(unchattedProfiles => {
                        const allConns = [
                            ...sortedContacts.filter(c => connSet.has(c.id)),
                            ...unchattedProfiles.map(p => ({ ...p, lastMessage: null, unreadCount: 0 }))
                        ];
                        
                        const allReqs = sortedContacts.filter(c => !connSet.has(c.id));
                        
                        if (initialOpenUserId && !chattedSet.has(initialOpenUserId) && !connSet.has(initialOpenUserId)) {
                            const p = profilesMap.get(initialOpenUserId);
                            if (p && !allReqs.some(r => r.id === initialOpenUserId)) {
                                allReqs.unshift({ ...p, lastMessage: null, unreadCount: 0 });
                            }
                        }

                        setConnections(allConns);
                        setRequests(allReqs);
                        setLoadingContacts(false);
                        
                        if (initialOpenUserId) {
                            const targetUser = [...allConns, ...allReqs].find(p => p.id === initialOpenUserId);
                            if (targetUser) {
                                setSelectedContact(targetUser);
                                setView('chat');
                            }
                        }
                    });
                });
            });
        };

        refreshContacts();

        // Subscribe to messages changes to keep the chat list updated in real-time
        const channel = supabase
            .channel(`chat-list-${currentUser.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages'
                },
                () => {
                    refreshContacts();
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [isOpen, initialOpenUserId, currentUser.id]);

    // Load messages when a contact is selected
    useEffect(() => {
        if (view === 'chat' && selectedContact) {
            setLoadingMessages(true);
            
            // Mark messages from this sender as read when we open the chat
            markMessagesAsRead(selectedContact.id, currentUser.id);

            fetchMessages(currentUser.id, selectedContact.id).then(data => {
                setMessages(data);
                setLoadingMessages(false);
                scrollToBottom();
            });

            const subscription = subscribeToMessages(currentUser.id, selectedContact.id, (newMsg) => {
                // Mark incoming message as read
                markMessagesAsRead(selectedContact.id, currentUser.id);
                setMessages(prev => [...prev, newMsg]);
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
            is_read: false
        };
        setMessages(prev => [...prev, optimisticMsg]);
        scrollToBottom();

        const { data, error } = await sendMessage(currentUser.id, selectedContact.id, text);
        if (error) {
            console.error('Failed to send:', error);
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        } else if (data) {
            setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data : m));
        }
    };

    const formatTime = (iso: string) => {
        const date = new Date(iso);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (!isOpen) return null;

    const displayContacts = activeTab === 'connections' ? connections : requests;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: '#000', zIndex: 1000, display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.3s ease-out'
        }}>
            {view === 'list' ? (
                <>
                    <header style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid #2c2c2e', background: '#121212' }}>
                        <h2 style={{ flex: 1, fontSize: '20px', fontWeight: 'bold', color: '#fff', margin: 0 }}>Chats</h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8e8e93' }}>
                            <X size={24} />
                        </button>
                    </header>
                    
                    <div style={{ display: 'flex', borderBottom: '1px solid #2c2c2e', background: '#121212' }}>
                        <button 
                            onClick={() => setActiveTab('connections')}
                            style={{ 
                                flex: 1, padding: '12px', background: 'none', border: 'none', 
                                color: activeTab === 'connections' ? '#ff3366' : '#8e8e93',
                                borderBottom: activeTab === 'connections' ? '2px solid #ff3366' : '2px solid transparent',
                                fontWeight: activeTab === 'connections' ? 'bold' : 'normal',
                                fontSize: '15px'
                            }}
                        >
                            Connections
                        </button>
                        <button 
                            onClick={() => setActiveTab('requests')}
                            style={{ 
                                flex: 1, padding: '12px', background: 'none', border: 'none', 
                                color: activeTab === 'requests' ? '#ff3366' : '#8e8e93',
                                borderBottom: activeTab === 'requests' ? '2px solid #ff3366' : '2px solid transparent',
                                fontWeight: activeTab === 'requests' ? 'bold' : 'normal',
                                fontSize: '15px'
                            }}
                        >
                            For You
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                        {loadingContacts ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#8e8e93' }}>Loading...</div>
                        ) : displayContacts.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#8e8e93' }}>
                                {activeTab === 'connections' 
                                    ? "No connections yet. Match in Voice Call to chat!"
                                    : "No message requests yet."}
                            </div>
                        ) : (
                            displayContacts.map(contact => {
                                const lastMsg = (contact as any).lastMessage;
                                const unread = (contact as any).unreadCount || 0;
                                
                                const getMessagePreview = () => {
                                    if (!lastMsg) return 'Tap to chat';
                                    if (lastMsg.content.startsWith('[SHARE_POST]')) {
                                        return '📷 Shared a post';
                                    }
                                    if (lastMsg.content.startsWith('[VOICE_REACTION]')) {
                                        return '🎙️ Voice reaction';
                                    }
                                    return lastMsg.content;
                                };

                                return (
                                    <div 
                                        key={contact.id}
                                        onClick={() => { setSelectedContact(contact); setView('chat'); }}
                                        style={{ 
                                            display: 'flex', alignItems: 'center', padding: '16px', 
                                            borderBottom: '1px solid #1c1c1e', cursor: 'pointer',
                                            transition: 'background 0.2s',
                                            backgroundColor: unread > 0 ? 'rgba(255, 51, 102, 0.05)' : 'transparent'
                                        }}
                                    >
                                        <img 
                                            src={contact.avatar_url || 'https://i.pravatar.cc/150'} 
                                            alt={contact.username} 
                                            style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', marginRight: '16px' }}
                                        />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', fontWeight: unread > 0 ? '700' : '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.username}</h3>
                                                {lastMsg && (
                                                    <span style={{ fontSize: '11px', color: unread > 0 ? '#ff3366' : '#8e8e93' }}>
                                                        {new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                <p style={{ 
                                                    margin: 0, fontSize: '14px', 
                                                    color: unread > 0 ? '#fff' : '#8e8e93',
                                                    fontWeight: unread > 0 ? '500' : 'normal',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    marginRight: '8px', flex: 1
                                                }}>
                                                    {getMessagePreview()}
                                                </p>
                                                {unread > 0 && (
                                                    <span style={{ 
                                                        background: '#ff3366', color: '#fff', fontSize: '11px', 
                                                        fontWeight: 'bold', borderRadius: '50%', minWidth: '18px', 
                                                        height: '18px', display: 'flex', alignItems: 'center', 
                                                        justifyContent: 'center', padding: '0 4px' 
                                                    }}>
                                                        {unread}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            ) : (
                <>
                    <header style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid #2c2c2e', background: '#121212' }}>
                        <button onClick={() => {
                            setView('list'); 
                            if (initialOpenUserId) onClose(); // If opened directly to a chat, back button closes panel
                        }} style={{ background: 'none', border: 'none', color: '#ff3366', marginRight: '12px', display: 'flex', alignItems: 'center' }}>
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
                            messages.map((msg, index) => {
                                const isMe = msg.sender_id === currentUser.id;
                                return (
                                    <div key={msg.id} style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: isMe ? 'flex-end' : 'flex-start',
                                        marginBottom: '12px'
                                    }}>
                                        <div style={{
                                            background: isMe ? '#ff3366' : '#2c2c2e',
                                            color: '#fff',
                                            padding: msg.content.startsWith('[SHARE_POST]') ? '8px' : '12px 16px',
                                            borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                            maxWidth: '75%',
                                            fontSize: '15px',
                                            lineHeight: '1.4',
                                            wordBreak: 'break-word'
                                        }}>
                                            {(() => {
                                                if (msg.content.startsWith('[SHARE_POST]')) {
                                                    try {
                                                        const jsonStr = msg.content.replace('[SHARE_POST] ', '');
                                                        const sharedPost = JSON.parse(jsonStr);
                                                        return (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                <div style={{ fontSize: '12px', opacity: 0.8, padding: '0 4px', fontWeight: 'bold' }}>
                                                                    Shared {sharedPost.username ? `@${sharedPost.username}'s` : 'a'} post
                                                                </div>
                                                                <div style={{ 
                                                                    position: 'relative', width: '200px', height: '260px', 
                                                                    borderRadius: '12px', overflow: 'hidden', background: '#1c1c1e'
                                                                }}>
                                                                    {sharedPost.media_type === 'video' ? (
                                                                        <video 
                                                                            src={sharedPost.image_url || sharedPost.media_url} 
                                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                                            muted 
                                                                            playsInline 
                                                                            controls
                                                                            preload="metadata"
                                                                        />
                                                                    ) : (
                                                                        <img src={sharedPost.image_url || sharedPost.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    )}
                                                                </div>
                                                                {sharedPost.caption && (
                                                                    <div style={{ fontSize: '13px', padding: '0 4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                                        {sharedPost.caption}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    } catch (e) {
                                                        return "Shared a post";
                                                    }
                                                }
                                                if (msg.content.startsWith('[VOICE_REACTION]')) {
                                                    const audioUrl = msg.content.replace('[VOICE_REACTION] ', '');
                                                    return (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            <div style={{ fontSize: '12px', opacity: 0.8, fontWeight: 'bold' }}>
                                                                🎙️ Voice Reaction
                                                            </div>
                                                            <audio 
                                                                controls 
                                                                src={audioUrl} 
                                                                style={{ 
                                                                    width: '200px', height: '36px', 
                                                                    borderRadius: '18px',
                                                                    filter: 'invert(1) hue-rotate(180deg)',
                                                                }} 
                                                            />
                                                        </div>
                                                    );
                                                }
                                                return msg.content;
                                            })()}
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
                                )
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
                                fontSize: '15px'
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
                                transition: 'background 0.2s'
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
