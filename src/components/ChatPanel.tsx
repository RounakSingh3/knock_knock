import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, Send, Check, CheckCheck, Image as ImageIcon, Trash2, Mic, Square } from 'lucide-react';
import { fetchConnectionUserIds, fetchProfilesByIds, fetchMessages, sendMessage, subscribeToMessages, markMessagesAsRead, uploadMedia, deleteMessage, fetchFollowing, fetchFollowers, updatePoints, type ProfileData, type MessageData } from '../lib/database';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/media';

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
    if (content.startsWith('[VOICE_REACTION]') || content.startsWith('[VOICE]')) {
        return isMe ? 'You sent a voice mail 🎙️' : `🎙️ ${contactName} sent a voice mail`;
    }
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
    const navigate = useNavigate();

    const [view, setView] = useState<'list' | 'chat'>('list');
    const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);

    const [messages, setMessages] = useState<MessageData[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [messageInput, setMessageInput] = useState('');

    // Voice recording states
    const [isRecordingVoice, setIsRecordingVoice] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isUploadingVoice, setIsUploadingVoice] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const voiceTimerRef = useRef<any>(null);
    const [viewingSnap, setViewingSnap] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
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

    // Handle Hardware Back Button
    useEffect(() => {
        if (!isOpen) return;

        // Push a state when opened to trap the back button
        window.history.pushState({ chatPanel: true }, '');

        const handlePopState = () => {
            if (viewingSnap) {
                setViewingSnap(null);
                // Push state again so the next back button press doesn't exit the page
                window.history.pushState({ chatPanel: true }, '');
            } else if (view === 'chat') {
                setView('list');
                window.history.pushState({ chatPanel: true }, '');
            } else {
                onClose();
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isOpen, viewingSnap, view, onClose]);

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
            fetchFollowing(currentUser.id),
            fetchFollowers(currentUser.id),
            fetchChatThreads(currentUser.id),
        ]).then(([connIds, followingProfiles, followerProfiles, threadData]) => {
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
                
                const allFriendIds = new Set([
                    ...connIds,
                    ...followingProfiles.map(p => p.id),
                    ...followerProfiles.map(p => p.id)
                ]);
                
                const unchattedConnIds = Array.from(allFriendIds).filter(id => !chattedSet.has(id));

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

    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !selectedContact) return;
        const file = e.target.files[0];
        
        if (fileInputRef.current) fileInputRef.current.value = '';

        setIsUploadingImage(true);
        try {
            let fileToUpload = file;
            if (file.type.startsWith('image/')) {
                try {
                    fileToUpload = await compressImage(file, 1000, 1000, 0.75);
                } catch (compErr) {
                    console.error('Chat image compression failed, using original file:', compErr);
                }
            }
            const fileExt = fileToUpload.name.split('.').pop();
            const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
            const path = `chat_snaps/${fileName}`; // Keep them separate

            const publicUrl = await uploadMedia(fileToUpload, path);
            const text = `[SNAP] ${publicUrl}`;

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

            // Reward points for sending a snap
            const newPoints = (currentUser.points || 0) + 10;
            await updatePoints(currentUser.id, newPoints);

            const { data, error } = await sendMessage(currentUser.id, selectedContact.id, text);
            if (error) {
                console.error('Failed to send snap:', error);
                setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
            } else if (data) {
                setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data : m));
            }
        } catch (err) {
            console.error('Error uploading snap:', err);
            alert('Failed to upload snap. Please try again.');
        } finally {
            setIsUploadingImage(false);
        }
    };

    const startVoiceRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];
            setRecordingTime(0);

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.start();
            setIsRecordingVoice(true);
            voiceTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Error starting voice recording:', err);
            alert('Microphone access denied or unavailable.');
        }
    };

    const stopAndSendVoiceRecording = async () => {
        if (!mediaRecorderRef.current || !selectedContact) return;
        const recorder = mediaRecorderRef.current;
        
        if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
        setIsRecordingVoice(false);
        setIsUploadingVoice(true);

        recorder.onstop = async () => {
            if (recorder.stream) {
                recorder.stream.getTracks().forEach(t => t.stop());
            }
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            audioChunksRef.current = [];

            if (audioBlob.size === 0) {
                setIsUploadingVoice(false);
                return;
            }

            try {
                const ext = 'webm';
                const path = `chat_voice/${currentUser.id}-${Date.now()}.${ext}`;
                const file = new File([audioBlob], `voice-${Date.now()}.${ext}`, { type: 'audio/webm' });
                const voiceUrl = await uploadMedia(file, path);

                const text = `[VOICE_REACTION] ${voiceUrl}`;
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
                    console.error('Failed to send voice message:', error);
                    setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
                } else if (data) {
                    setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data : m));
                }
            } catch (err) {
                console.error('Voice upload failed:', err);
                alert('Failed to send voice message.');
            } finally {
                setIsUploadingVoice(false);
            }
        };

        recorder.stop();
    };

    const cancelVoiceRecording = () => {
        if (mediaRecorderRef.current) {
            const recorder = mediaRecorderRef.current;
            recorder.onstop = () => {
                if (recorder.stream) {
                    recorder.stream.getTracks().forEach(t => t.stop());
                }
            };
            recorder.stop();
        }
        if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
        setIsRecordingVoice(false);
        setRecordingTime(0);
        audioChunksRef.current = [];
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

    const handleDeleteMessage = async (msgId: string) => {
        if (window.confirm('Delete this message for everyone?')) {
            const { error } = await deleteMessage(msgId, currentUser.id);
            if (!error) {
                setMessages(prev => prev.filter(m => m.id !== msgId));
            } else {
                alert('Failed to delete message.');
            }
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
                    borderRadius: '12px', overflow: 'hidden', background: 'var(--surface-color)',
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
            position: 'fixed', inset: 0,
            background: 'var(--bg-color)', zIndex: 1000, display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.3s ease-out',
        }}>
            {view === 'list' ? (
                <>
                    <header style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid #2c2c2e', background: 'var(--surface-color)' }}>
                        <h2 style={{ flex: 1, fontSize: '20px', fontWeight: 'bold', color: 'var(--text-active)', margin: 0 }}>Messages</h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-inactive)' }}>
                            <X size={24} />
                        </button>
                    </header>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                        {loadingContacts ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-inactive)' }}>Loading...</div>
                        ) : allContacts.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-inactive)', lineHeight: '1.6' }}>
                                No friends yet! Follow people to see them here.<br/><br/>
                                On Knock Knock, you can talk, send messages, and share reels and photos with your friends!
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
                                                backgroundColor: unread > 0 ? 'rgba(245, 165, 36, 0.05)' : 'transparent',
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
                                                        margin: 0, fontSize: '16px', color: 'var(--text-active)',
                                                        fontWeight: unread > 0 ? '700' : '600',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>
                                                        {contact.username}
                                                    </h3>
                                                    <span style={{ fontSize: '11px', color: unread > 0 ? '#f5a524' : 'var(--text-inactive)' }}>
                                                        {new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                    <p style={{
                                                        margin: 0, fontSize: '14px',
                                                        color: unread > 0 ? 'var(--text-active)' : 'var(--text-inactive)',
                                                        fontWeight: unread > 0 ? '500' : 'normal',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                        marginRight: '8px', flex: 1,
                                                    }}>
                                                        {getMessagePreview()}
                                                    </p>
                                                    {unread > 0 && (
                                                        <span style={{
                                                            background: '#f5a524', color: 'var(--text-active)', fontSize: '11px',
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
                                    <div style={{ padding: '12px 16px 8px', color: 'var(--text-inactive)', fontSize: '13px', fontWeight: '600' }}>
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
                                            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-active)', fontWeight: '600' }}>
                                                {contact.username}
                                            </h3>
                                            <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-inactive)' }}>
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
                    <header style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid #2c2c2e', background: 'var(--surface-color)' }}>
                        <button
                            onClick={() => {
                                setView('list');
                                if (initialOpenUserId) onClose();
                            }}
                            style={{ background: 'none', border: 'none', color: '#f5a524', marginRight: '12px', display: 'flex', alignItems: 'center' }}
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div 
                            style={{ display: 'flex', alignItems: 'center', flex: 1, cursor: 'pointer' }}
                            onClick={(e) => {
                                e.preventDefault();
                                const username = selectedContact?.username;
                                if (username) {
                                    navigate(`/profile/${encodeURIComponent(username)}`);
                                    onClose(); 
                                }
                            }}
                        >
                            <img
                                src={selectedContact?.avatar_url || 'https://i.pravatar.cc/150'}
                                alt=""
                                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', marginRight: '12px' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-active)', margin: 0 }}>
                                    {selectedContact?.username || 'User'}
                                </h2>
                                <span style={{ fontSize: '12px', color: 'var(--text-inactive)' }}>View Profile</span>
                            </div>
                        </div>
                    </header>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)' }}>
                        {loadingMessages ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-inactive)', margin: 'auto' }}>Loading chat...</div>
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
                                            background: isMe ? '#f5a524' : 'var(--border-color)',
                                            color: 'var(--text-active)',
                                            padding: isShare ? '8px' : '12px 16px',
                                            borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                            maxWidth: '75%',
                                            fontSize: '15px',
                                            lineHeight: '1.4',
                                            wordBreak: 'break-word',
                                        }}>
                                            {isShare ? renderSharedContent(msg, isMe) : (
                                                (msg.content.startsWith('[VOICE_REACTION]') || msg.content.startsWith('[VOICE]')) ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <div style={{ fontSize: '12px', opacity: 0.8, fontWeight: 'bold' }}>
                                                            🎙️ Voice Mail
                                                        </div>
                                                        <audio
                                                            controls
                                                            src={msg.content.replace('[VOICE_REACTION] ', '').replace('[VOICE] ', '')}
                                                            style={{
                                                                width: '200px', height: '36px',
                                                                borderRadius: '18px',
                                                                filter: isMe ? 'none' : 'invert(1) hue-rotate(180deg)',
                                                            }}
                                                        />
                                                    </div>
                                                ) : msg.content.startsWith('[SNAP]') ? (() => {
                                                    const url = msg.content.replace('[SNAP] ', '');
                                                    const isVideo = url.match(/\.(mp4|webm|mov)(\?.*)?$/i);
                                                    const isExpired = Date.now() - new Date(msg.created_at).getTime() > 24 * 60 * 60 * 1000;
                                                    
                                                    if (isExpired) {
                                                        return (
                                                            <div style={{ padding: '8px', fontStyle: 'italic', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <ImageIcon size={16} /> Expired Snap
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <button 
                                                            onClick={() => setViewingSnap({ url, type: isVideo ? 'video' : 'image' })}
                                                            style={{ 
                                                                background: isMe ? 'rgba(255,255,255,0.2)' : 'var(--primary-color)',
                                                                border: 'none', borderRadius: '12px', padding: '12px 20px',
                                                                color: '#fff', fontWeight: 'bold', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', gap: '8px'
                                                            }}
                                                        >
                                                            <ImageIcon size={18} /> Tap to View Snap
                                                        </button>
                                                    );
                                                })() : msg.content.startsWith('[IMAGE]') ? (
                                                    <img 
                                                        src={msg.content.replace('[IMAGE] ', '')} 
                                                        alt="Sent image" 
                                                        style={{ maxWidth: '100%', borderRadius: '12px', display: 'block' }} 
                                                    />
                                                ) : msg.content
                                            )}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-inactive)', marginTop: '4px', display: 'flex', alignItems: 'center' }}>
                                            {formatTime(msg.created_at)}
                                            {isMe && (
                                                <>
                                                    <span style={{ marginLeft: '4px' }}>
                                                        {msg.is_read ? <CheckCheck size={14} color="#34C759" /> : <Check size={14} />}
                                                    </span>
                                                    <button
                                                        onClick={() => handleDeleteMessage(msg.id)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 8px', color: 'var(--text-inactive)', display: 'flex', alignItems: 'center' }}
                                                        title="Delete message"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', padding: '12px', background: 'var(--surface-color)', borderTop: '1px solid #2c2c2e' }}>
                        <input 
                            type="file" 
                            accept="image/*,video/*" 
                            style={{ display: 'none' }} 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                        />
                        {isRecordingVoice ? (
                            <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '12px', padding: '0 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff3b30', fontWeight: 'bold', fontSize: '14px', flex: 1 }}>
                                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff3b30', animation: 'pulse 1s infinite' }} />
                                    <span>Recording... {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={cancelVoiceRecording}
                                    style={{ background: 'none', border: 'none', color: '#ff3b30', padding: '8px', cursor: 'pointer' }}
                                    title="Cancel recording"
                                >
                                    <Trash2 size={22} />
                                </button>
                                <button
                                    type="button"
                                    onClick={stopAndSendVoiceRecording}
                                    style={{
                                        background: '#ff3366', color: '#fff', border: 'none',
                                        borderRadius: '50%', width: '44px', height: '44px',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                                        cursor: 'pointer', boxShadow: '0 2px 10px rgba(255,51,102,0.4)',
                                    }}
                                    title="Send Voice Mail"
                                >
                                    <Send size={20} style={{ marginLeft: '2px' }} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        background: 'none', border: 'none', color: 'var(--text-inactive)',
                                        padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                        marginRight: '4px', opacity: isUploadingImage || isUploadingVoice ? 0.5 : 1
                                    }}
                                    disabled={isUploadingImage || isUploadingVoice}
                                    title="Send Image / Video"
                                >
                                    <ImageIcon size={24} />
                                </button>
                                <button
                                    type="button"
                                    onClick={startVoiceRecording}
                                    style={{
                                        background: 'none', border: 'none', color: '#f5a524',
                                        padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                        marginRight: '8px', opacity: isUploadingImage || isUploadingVoice ? 0.5 : 1
                                    }}
                                    disabled={isUploadingImage || isUploadingVoice}
                                    title="Record Voice Mail"
                                >
                                    <Mic size={24} />
                                </button>
                                <input
                                    type="text"
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    placeholder={isUploadingVoice ? "Sending voice mail..." : isUploadingImage ? "Uploading..." : "Message..."}
                                    disabled={isUploadingImage || isUploadingVoice}
                                    style={{
                                        flex: 1,
                                        background: 'var(--border-color)',
                                        border: 'none',
                                        borderRadius: '24px',
                                        padding: '12px 16px',
                                        color: 'var(--text-active)',
                                        outline: 'none',
                                        fontSize: '15px',
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={!messageInput.trim()}
                                    style={{
                                        background: messageInput.trim() ? '#f5a524' : 'var(--border-color)',
                                        color: 'var(--text-active)',
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
                            </>
                        )}
                    </form>
                </>
            )}

            {/* Full-screen Snap Viewer */}
            {viewingSnap && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: '#000', zIndex: 100000, display: 'flex',
                    flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                    <button 
                        onClick={() => setViewingSnap(null)}
                        style={{ position: 'absolute', top: '40px', right: '20px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', padding: '8px', color: '#fff', cursor: 'pointer', zIndex: 2 }}
                    >
                        <X size={24} />
                    </button>
                    {viewingSnap.type === 'video' ? (
                        <video src={viewingSnap.url} autoPlay controls style={{ maxWidth: '100%', maxHeight: '100%' }} />
                    ) : (
                        <img src={viewingSnap.url} alt="Snap" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    )}
                </div>
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
