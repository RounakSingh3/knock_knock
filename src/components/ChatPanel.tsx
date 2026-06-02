import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, Send, Check, CheckCheck } from 'lucide-react';
import { fetchConnectionUserIds, fetchProfilesByIds, fetchMessages, sendMessage, subscribeToMessages, type ProfileData, type MessageData } from '../lib/database';

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: ProfileData & { username: string; id: string };
}

const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose, currentUser }) => {
    const [contacts, setContacts] = useState<ProfileData[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    
    // View state: 'list' or 'chat'
    const [view, setView] = useState<'list' | 'chat'>('list');
    const [selectedContact, setSelectedContact] = useState<ProfileData | null>(null);
    
    // Chat state
    const [messages, setMessages] = useState<MessageData[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [messageInput, setMessageInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch contacts when panel opens
    useEffect(() => {
        if (isOpen && contacts.length === 0) {
            setLoadingContacts(true);
            fetchConnectionUserIds(currentUser.id).then(ids => {
                fetchProfilesByIds(ids).then(profiles => {
                    setContacts(profiles);
                    setLoadingContacts(false);
                });
            });
        }
    }, [isOpen]);

    // Load messages when a contact is selected
    useEffect(() => {
        if (view === 'chat' && selectedContact) {
            setLoadingMessages(true);
            fetchMessages(currentUser.id, selectedContact.id).then(data => {
                setMessages(data);
                setLoadingMessages(false);
                scrollToBottom();
            });

            // Subscribe to new messages
            const subscription = subscribeToMessages(currentUser.id, selectedContact.id, (newMsg) => {
                setMessages(prev => [...prev, newMsg]);
                scrollToBottom();
            });

            return () => {
                subscription.unsubscribe();
            };
        }
    }, [view, selectedContact]);

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

        // Optimistically add to UI
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
            // Revert optimistic msg on failure if needed
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        } else if (data) {
            // Replace temp id with real id
            setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data : m));
        }
    };

    const formatTime = (iso: string) => {
        const date = new Date(iso);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (!isOpen) return null;

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
                    
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                        {loadingContacts ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#8e8e93' }}>Loading connections...</div>
                        ) : contacts.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#8e8e93' }}>
                                No connections yet. Match in Voice Call to chat!
                            </div>
                        ) : (
                            contacts.map(contact => (
                                <div 
                                    key={contact.id}
                                    onClick={() => { setSelectedContact(contact); setView('chat'); }}
                                    style={{ 
                                        display: 'flex', alignItems: 'center', padding: '16px', 
                                        borderBottom: '1px solid #1c1c1e', cursor: 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <img 
                                        src={contact.avatar_url || 'https://i.pravatar.cc/150'} 
                                        alt={contact.username} 
                                        style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', marginRight: '16px' }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', fontWeight: '600' }}>{contact.username}</h3>
                                        <p style={{ margin: 0, fontSize: '14px', color: '#8e8e93', marginTop: '4px' }}>Tap to chat</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            ) : (
                <>
                    <header style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid #2c2c2e', background: '#121212' }}>
                        <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: '#ff3366', marginRight: '12px', display: 'flex', alignItems: 'center' }}>
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
                                            padding: '12px 16px',
                                            borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                            maxWidth: '75%',
                                            fontSize: '15px',
                                            lineHeight: '1.4'
                                        }}>
                                            {msg.content}
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
