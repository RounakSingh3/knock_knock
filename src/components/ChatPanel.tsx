import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, Send, Check, CheckCheck, Image as ImageIcon, Trash2, Mic, Users, Plus, Check as CheckIcon, Info, LogOut, UserPlus, Search } from 'lucide-react';
import { fetchConnectionUserIds, fetchProfilesByIds, fetchMessages, sendMessage, subscribeToMessages, markMessagesAsRead, uploadMedia, deleteMessage, fetchFollowing, fetchFollowers, updatePoints, type ProfileData, type MessageData } from '../lib/database';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/media';

interface ChatContact extends ProfileData {
    lastMessage?: MessageData | null;
    unreadCount?: number;
}

export interface GroupMember {
    id: string;
    username: string;
    name?: string;
    avatar_url?: string;
}

export interface GroupMessage {
    id: string;
    group_id: string;
    sender_id: string;
    sender_name: string;
    sender_avatar?: string;
    content: string;
    created_at: string;
}

export interface GroupChat {
    id: string;
    name: string;
    avatar_emoji: string;
    creator_id: string;
    created_at: string;
    members: GroupMember[];
    lastMessage?: GroupMessage | null;
}

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: ProfileData & { username: string; id: string };
    initialOpenUserId?: string | null;
    refreshKey?: number;
    pendingShare?: { receiverId: string; message: MessageData } | null;
}

const GROUP_EMOJIS = ['🔥', '🚀', '🎉', '🌴', '💬', '✨', '🎸', '⚽', '🍕', '👾', '👑', '⚡', '💃', '🍿'];

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

    const [view, setView] = useState<'list' | 'chat' | 'group_chat'>('list');
    const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'groups'>('all');
    const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);

    // Group state
    const [groups, setGroups] = useState<GroupChat[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<GroupChat | null>(null);
    const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupEmoji, setNewGroupEmoji] = useState('🔥');
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [friendSearchQuery, setFriendSearchQuery] = useState('');

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
    const groupChannelRef = useRef<any>(null);

    // Load groups from localStorage
    useEffect(() => {
        if (!currentUser?.id) return;
        const savedGroups = localStorage.getItem(`knock_groups_${currentUser.id}`);
        if (savedGroups) {
            try {
                setGroups(JSON.parse(savedGroups));
            } catch (e) {
                console.error('Error parsing groups:', e);
            }
        }
    }, [currentUser?.id]);

    // Save groups to localStorage whenever updated
    const saveGroups = (updated: GroupChat[]) => {
        setGroups(updated);
        if (currentUser?.id) {
            localStorage.setItem(`knock_groups_${currentUser.id}`, JSON.stringify(updated));
        }
    };

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

        window.history.pushState({ chatPanel: true }, '');

        const handlePopState = () => {
            if (showCreateGroupModal) {
                setShowCreateGroupModal(false);
                window.history.pushState({ chatPanel: true }, '');
            } else if (showGroupInfoModal) {
                setShowGroupInfoModal(false);
                window.history.pushState({ chatPanel: true }, '');
            } else if (viewingSnap) {
                setViewingSnap(null);
                window.history.pushState({ chatPanel: true }, '');
            } else if (view === 'chat' || view === 'group_chat') {
                setView('list');
                window.history.pushState({ chatPanel: true }, '');
            } else {
                onClose();
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isOpen, viewingSnap, view, showCreateGroupModal, showGroupInfoModal, onClose]);

    const fetchChatThreads = async (myId: string) => {
        const { data: msgs, error } = await supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
            .order('created_at', { ascending: false });

        if (error || !msgs) return new Map();

        const threadMap = new Map<string, { lastMessage: MessageData; unreadCount: number }>();

        for (const msg of msgs) {
            const otherId = msg.sender_id === myId ? msg.receiver_id : msg.sender_id;
            if (!threadMap.has(otherId)) {
                threadMap.set(otherId, {
                    lastMessage: msg,
                    unreadCount: (!msg.is_read && msg.receiver_id === myId) ? 1 : 0,
                });
            } else {
                const current = threadMap.get(otherId)!;
                if (!msg.is_read && msg.receiver_id === myId) {
                    current.unreadCount += 1;
                }
            }
        }

        return threadMap;
    };

    const refreshContacts = useCallback(() => {
        if (!currentUser?.id) return;
        setLoadingContacts(true);

        fetchChatThreads(currentUser.id).then(threadMap => {
            Promise.all([
                fetchConnectionUserIds(currentUser.id),
                fetchFollowing(currentUser.id),
                fetchFollowers(currentUser.id),
            ]).then(([connIds, followingIds, followerIds]) => {
                const allIds = new Set<string>([
                    ...connIds,
                    ...followingIds,
                    ...followerIds,
                    ...Array.from(threadMap.keys()),
                ]);

                allIds.delete(currentUser.id);

                if (allIds.size === 0) {
                    setAllContacts([]);
                    setLoadingContacts(false);
                    return;
                }

                fetchProfilesByIds(Array.from(allIds)).then(profiles => {
                    const contactsWithThreads: ChatContact[] = profiles.map(profile => {
                        const thread = threadMap.get(profile.id);
                        return {
                            ...profile,
                            lastMessage: thread?.lastMessage || null,
                            unreadCount: thread?.unreadCount || 0,
                        };
                    });

                    let merged = contactsWithThreads.sort((a, b) => {
                        const timeA = a.lastMessage?.created_at ?? '';
                        const timeB = b.lastMessage?.created_at ?? '';
                        if (timeA && timeB) return timeB.localeCompare(timeA);
                        if (timeA) return -1;
                        if (timeB) return 1;
                        return (a.username || '').localeCompare(b.username || '');
                    });

                    if (initialOpenUserId && !merged.some(c => c.id === initialOpenUserId)) {
                        const p = profiles.find(p => p.id === initialOpenUserId);
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
            setSelectedGroup(null);
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

    // 1-on-1 Chat Subscriptions
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

    // Group Chat Real-Time Subscription
    useEffect(() => {
        if (view === 'group_chat' && selectedGroup) {
            // Load group messages from local cache
            const cacheKey = `knock_group_msgs_${selectedGroup.id}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    setGroupMessages(JSON.parse(cached));
                } catch (e) {
                    setGroupMessages([]);
                }
            } else {
                setGroupMessages([]);
            }
            scrollToBottom();

            // Subscribe to live broadcast for this group
            const channel = supabase.channel(`group_room_${selectedGroup.id}`, {
                config: { broadcast: { self: false } }
            });

            channel
                .on('broadcast', { event: 'group_message' }, ({ payload }) => {
                    if (payload && payload.group_id === selectedGroup.id) {
                        setGroupMessages(prev => {
                            if (prev.some(m => m.id === payload.id)) return prev;
                            const updated = [...prev, payload];
                            localStorage.setItem(cacheKey, JSON.stringify(updated));
                            return updated;
                        });
                        // Update group last message
                        setGroups(prev => {
                            const updated = prev.map(g => g.id === selectedGroup.id ? { ...g, lastMessage: payload } : g);
                            localStorage.setItem(`knock_groups_${currentUser.id}`, JSON.stringify(updated));
                            return updated;
                        });
                        scrollToBottom();
                    }
                })
                .subscribe();

            groupChannelRef.current = channel;

            return () => {
                channel.unsubscribe();
            };
        }
    }, [view, selectedGroup, currentUser.id]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    // ── Group Creation Logic ──
    const handleCreateGroup = () => {
        if (!newGroupName.trim() || selectedMemberIds.length === 0) return;

        const selectedFriends = allContacts.filter(c => selectedMemberIds.includes(c.id));
        const membersList: GroupMember[] = [
            { id: currentUser.id, username: currentUser.username, name: currentUser.name, avatar_url: currentUser.avatar_url },
            ...selectedFriends.map(f => ({ id: f.id, username: f.username, name: f.name, avatar_url: f.avatar_url }))
        ];

        const newGroup: GroupChat = {
            id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: newGroupName.trim(),
            avatar_emoji: newGroupEmoji,
            creator_id: currentUser.id,
            created_at: new Date().toISOString(),
            members: membersList,
            lastMessage: {
                id: `init-${Date.now()}`,
                group_id: '',
                sender_id: currentUser.id,
                sender_name: currentUser.username,
                content: `✨ ${currentUser.username} created the group "${newGroupName.trim()}"`,
                created_at: new Date().toISOString()
            }
        };

        const updatedGroups = [newGroup, ...groups];
        saveGroups(updatedGroups);

        // Reset creation form
        setNewGroupName('');
        setSelectedMemberIds([]);
        setShowCreateGroupModal(false);

        // Directly open the created group
        setSelectedGroup(newGroup);
        setView('group_chat');
    };

    const toggleMemberSelection = (friendId: string) => {
        setSelectedMemberIds(prev => 
            prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
        );
    };

    const handleLeaveGroup = (groupId: string) => {
        if (window.confirm('Are you sure you want to leave this group?')) {
            const updated = groups.filter(g => g.id !== groupId);
            saveGroups(updated);
            setShowGroupInfoModal(false);
            setView('list');
            setSelectedGroup(null);
        }
    };

    // ── Image Uploading ──
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        if (fileInputRef.current) fileInputRef.current.value = '';

        setIsUploadingImage(true);
        try {
            let fileToUpload = file;
            if (file.type.startsWith('image/')) {
                try {
                    fileToUpload = await compressImage(file, 1000, 1000, 0.75);
                } catch (compErr) {
                    console.error('Chat image compression failed:', compErr);
                }
            }
            const fileExt = fileToUpload.name.split('.').pop();
            const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
            const path = `chat_snaps/${fileName}`;

            const publicUrl = await uploadMedia(fileToUpload, path);
            const text = `[SNAP] ${publicUrl}`;

            if (view === 'chat' && selectedContact) {
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

                const newPoints = (currentUser.points || 0) + 10;
                await updatePoints(currentUser.id, newPoints);

                const { data, error } = await sendMessage(currentUser.id, selectedContact.id, text);
                if (error) {
                    setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
                } else if (data) {
                    setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data : m));
                }
            } else if (view === 'group_chat' && selectedGroup) {
                const groupMsg: GroupMessage = {
                    id: `gmsg-${Date.now()}`,
                    group_id: selectedGroup.id,
                    sender_id: currentUser.id,
                    sender_name: currentUser.username,
                    sender_avatar: currentUser.avatar_url,
                    content: text,
                    created_at: new Date().toISOString()
                };

                setGroupMessages(prev => {
                    const updated = [...prev, groupMsg];
                    localStorage.setItem(`knock_group_msgs_${selectedGroup.id}`, JSON.stringify(updated));
                    return updated;
                });
                groupChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'group_message',
                    payload: groupMsg
                });
                scrollToBottom();
            }
        } catch (err) {
            console.error('Image upload failed:', err);
            alert('Failed to send photo.');
        } finally {
            setIsUploadingImage(false);
        }
    };

    // ── Voice Recording ──
    const startVoiceRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start(200);
            setIsRecordingVoice(true);
            setRecordingTime(0);

            voiceTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Microphone access denied:', err);
            alert('Please enable microphone permissions to send voice mails.');
        }
    };

    const stopAndSendVoiceRecording = async () => {
        if (!mediaRecorderRef.current || !isRecordingVoice) return;
        const recorder = mediaRecorderRef.current;

        if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
        setIsRecordingVoice(false);

        recorder.onstop = async () => {
            if (recorder.stream) {
                recorder.stream.getTracks().forEach(t => t.stop());
            }

            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            if (audioBlob.size < 1000) {
                alert('Voice recording was too short.');
                return;
            }

            setIsUploadingVoice(true);
            try {
                const ext = 'webm';
                const path = `chat_voice/${currentUser.id}-${Date.now()}.${ext}`;
                const file = new File([audioBlob], `voice-${Date.now()}.${ext}`, { type: 'audio/webm' });
                const voiceUrl = await uploadMedia(file, path);
                const text = `[VOICE_REACTION] ${voiceUrl}`;

                if (view === 'chat' && selectedContact) {
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
                        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
                    } else if (data) {
                        setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data : m));
                    }
                } else if (view === 'group_chat' && selectedGroup) {
                    const groupMsg: GroupMessage = {
                        id: `gmsg-${Date.now()}`,
                        group_id: selectedGroup.id,
                        sender_id: currentUser.id,
                        sender_name: currentUser.username,
                        sender_avatar: currentUser.avatar_url,
                        content: text,
                        created_at: new Date().toISOString()
                    };

                    setGroupMessages(prev => {
                        const updated = [...prev, groupMsg];
                        localStorage.setItem(`knock_group_msgs_${selectedGroup.id}`, JSON.stringify(updated));
                        return updated;
                    });
                    groupChannelRef.current?.send({
                        type: 'broadcast',
                        event: 'group_message',
                        payload: groupMsg
                    });
                    scrollToBottom();
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

    // ── Send Message ──
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageInput.trim()) return;

        const text = messageInput.trim();
        setMessageInput('');

        if (view === 'chat' && selectedContact) {
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
        } else if (view === 'group_chat' && selectedGroup) {
            const groupMsg: GroupMessage = {
                id: `gmsg-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                group_id: selectedGroup.id,
                sender_id: currentUser.id,
                sender_name: currentUser.username,
                sender_avatar: currentUser.avatar_url,
                content: text,
                created_at: new Date().toISOString()
            };

            setGroupMessages(prev => {
                const updated = [...prev, groupMsg];
                localStorage.setItem(`knock_group_msgs_${selectedGroup.id}`, JSON.stringify(updated));
                return updated;
            });

            // Update group in list
            setGroups(prev => {
                const updated = prev.map(g => g.id === selectedGroup.id ? { ...g, lastMessage: groupMsg } : g);
                localStorage.setItem(`knock_groups_${currentUser.id}`, JSON.stringify(updated));
                return updated;
            });

            groupChannelRef.current?.send({
                type: 'broadcast',
                event: 'group_message',
                payload: groupMsg
            });
            scrollToBottom();
        }
    };

    const handleDeleteMessage = async (msgId: string) => {
        if (window.confirm('Delete this message?')) {
            if (view === 'chat') {
                const { error } = await deleteMessage(msgId, currentUser.id);
                if (!error) {
                    setMessages(prev => prev.filter(m => m.id !== msgId));
                }
            } else if (view === 'group_chat' && selectedGroup) {
                setGroupMessages(prev => {
                    const updated = prev.filter(m => m.id !== msgId);
                    localStorage.setItem(`knock_group_msgs_${selectedGroup.id}`, JSON.stringify(updated));
                    return updated;
                });
            }
        }
    };

    const formatTime = (iso: string) => {
        const date = new Date(iso);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderSharedContent = (content: string, isMe: boolean) => {
        const sharedPost = parseSharePayload(content);
        if (!sharedPost) return 'Shared a post';

        const isReel = isShareReel(content);
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
                    {isMe ? 'You shared' : `${selectedContact?.username || 'Shared'}`}{' '}
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

    const filteredFriendsForGroup = allContacts.filter(f => 
        (f.username || '').toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
        (f.name || '').toLowerCase().includes(friendSearchQuery.toLowerCase())
    );

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'var(--bg-color)', zIndex: 1000, display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.3s ease-out',
        }}>
            {view === 'list' ? (
                <>
                    {/* List View Header */}
                    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #2c2c2e', background: 'var(--surface-color)' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-active)', margin: 0 }}>Messages</h2>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                                onClick={() => setShowCreateGroupModal(true)}
                                style={{
                                    background: 'linear-gradient(45deg, #f5a524, #ff6b35)',
                                    border: 'none', borderRadius: '18px', padding: '6px 14px',
                                    color: '#fff', fontSize: '13px', fontWeight: 'bold',
                                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(245, 165, 36, 0.3)',
                                }}
                            >
                                <Users size={16} /> + New Group
                            </button>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', cursor: 'pointer', padding: '4px' }}>
                                <X size={24} />
                            </button>
                        </div>
                    </header>

                    {/* Filter Tabs */}
                    <div style={{
                        display: 'flex', gap: '8px', padding: '12px 16px 8px',
                        borderBottom: '1px solid #1c1c1e', background: 'var(--surface-color)'
                    }}>
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'direct', label: `Direct (${allContacts.length})` },
                            { id: 'groups', label: `Groups (${groups.length})` },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                style={{
                                    padding: '6px 14px', borderRadius: '16px', fontSize: '13px', fontWeight: 'bold',
                                    border: 'none',
                                    background: activeTab === tab.id ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.06)',
                                    color: activeTab === tab.id ? '#fff' : 'var(--text-inactive)',
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                        {loadingContacts ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-inactive)' }}>Loading conversations...</div>
                        ) : (
                            <>
                                {/* ── Groups Section ── */}
                                {(activeTab === 'all' || activeTab === 'groups') && groups.length > 0 && (
                                    <div>
                                        <div style={{ padding: '12px 16px 6px', color: 'var(--accent-amber)', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Group Chats 👥
                                        </div>
                                        {groups.map(group => (
                                            <div
                                                key={group.id}
                                                onClick={() => { setSelectedGroup(group); setView('group_chat'); }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', padding: '14px 16px',
                                                    borderBottom: '1px solid #1c1c1e', cursor: 'pointer',
                                                    background: 'rgba(245, 165, 36, 0.03)',
                                                }}
                                            >
                                                <div style={{
                                                    width: '50px', height: '50px', borderRadius: '50%',
                                                    background: 'linear-gradient(135deg, #f5a524, #a855f7)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '24px', marginRight: '14px', flexShrink: 0,
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                                }}>
                                                    {group.avatar_emoji || '👥'}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <h3 style={{
                                                            margin: 0, fontSize: '16px', color: 'var(--text-active)',
                                                            fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                        }}>
                                                            {group.name}
                                                        </h3>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-inactive)' }}>
                                                            {group.lastMessage ? new Date(group.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                        <p style={{
                                                            margin: 0, fontSize: '13px', color: 'var(--text-inactive)',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                        }}>
                                                            {group.lastMessage ? `${group.lastMessage.sender_name}: ${group.lastMessage.content}` : `${group.members.length} members`}
                                                        </p>
                                                        <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '8px', color: '#f5a524' }}>
                                                            {group.members.length} friends
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* ── Direct Chats Section ── */}
                                {(activeTab === 'all' || activeTab === 'direct') && (
                                    <>
                                        {chattedContacts.length > 0 && (
                                            <div>
                                                {groups.length > 0 && activeTab === 'all' && (
                                                    <div style={{ padding: '12px 16px 6px', color: 'var(--text-inactive)', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                        Direct Messages 💬
                                                    </div>
                                                )}
                                                {chattedContacts.map(contact => {
                                                    const lastMsg = contact.lastMessage!;
                                                    const unread = contact.unreadCount || 0;

                                                    const getMessagePreview = () => {
                                                        const isMe = lastMsg.sender_id === currentUser.id;
                                                        if (lastMsg.content.startsWith('[SHARE_POST]')) {
                                                            return getSharePreview(lastMsg.content, isMe, contact.username);
                                                        }
                                                        if (lastMsg.content.startsWith('[VOICE_REACTION]') || lastMsg.content.startsWith('[VOICE]')) {
                                                            return isMe ? 'You sent a voice mail 🎙️' : `🎙️ ${contact.username} sent a voice mail`;
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
                                            </div>
                                        )}

                                        {unchattedContacts.length > 0 && (
                                            <div>
                                                <div style={{ padding: '12px 16px 8px', color: 'var(--text-inactive)', fontSize: '13px', fontWeight: '600' }}>
                                                    Connections
                                                </div>
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
                                            </div>
                                        )}
                                    </>
                                )}

                                {allContacts.length === 0 && groups.length === 0 && (
                                    <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-inactive)', lineHeight: '1.6' }}>
                                        <Users size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                                        <h3 style={{ color: 'var(--text-active)', margin: '0 0 8px' }}>No conversations yet</h3>
                                        <p style={{ margin: '0 0 20px', fontSize: '14px' }}>
                                            Connect with friends on Knock Knock or create a group to start chatting!
                                        </p>
                                        <button
                                            onClick={() => setShowCreateGroupModal(true)}
                                            style={{
                                                background: 'var(--primary-gradient)', border: 'none', borderRadius: '20px',
                                                padding: '10px 24px', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer'
                                            }}
                                        >
                                            + Create a Friend Group
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            ) : view === 'group_chat' && selectedGroup ? (
                /* ── Group Chat Room View ── */
                <>
                    <header style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #2c2c2e', background: 'var(--surface-color)' }}>
                        <button
                            onClick={() => setView('list')}
                            style={{ background: 'none', border: 'none', color: '#f5a524', marginRight: '10px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div 
                            style={{ display: 'flex', alignItems: 'center', flex: 1, cursor: 'pointer' }}
                            onClick={() => setShowGroupInfoModal(true)}
                        >
                            <div style={{
                                width: '38px', height: '38px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #f5a524, #a855f7)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '20px', marginRight: '12px', flexShrink: 0
                            }}>
                                {selectedGroup.avatar_emoji || '👥'}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h2 style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--text-active)', margin: 0 }}>
                                    {selectedGroup.name}
                                </h2>
                                <span style={{ fontSize: '12px', color: 'var(--text-inactive)' }}>
                                    {selectedGroup.members.length} members • Tap for info
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowGroupInfoModal(true)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', padding: '6px', cursor: 'pointer' }}
                        >
                            <Info size={20} />
                        </button>
                    </header>

                    {/* Group Message Stream */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)' }}>
                        {groupMessages.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-inactive)', margin: 'auto', padding: '24px' }}>
                                <div style={{ fontSize: '36px', marginBottom: '8px' }}>{selectedGroup.avatar_emoji}</div>
                                <h3 style={{ color: 'var(--text-active)', margin: '0 0 6px' }}>Welcome to {selectedGroup.name}!</h3>
                                <p style={{ margin: 0, fontSize: '13px' }}>Send a message to start chatting with everyone in the group.</p>
                            </div>
                        ) : (
                            groupMessages.map(msg => {
                                const isMe = msg.sender_id === currentUser.id;
                                const isShare = msg.content.startsWith('[SHARE_POST]');

                                return (
                                    <div
                                        key={msg.id}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: isMe ? 'flex-end' : 'flex-start',
                                            marginBottom: '14px',
                                        }}
                                    >
                                        {!isMe && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', marginLeft: '4px' }}>
                                                {msg.sender_avatar && (
                                                    <img src={msg.sender_avatar} alt="" style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} />
                                                )}
                                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#f5a524' }}>
                                                    {msg.sender_name}
                                                </span>
                                            </div>
                                        )}
                                        <div style={{
                                            background: isMe ? 'var(--primary-gradient)' : 'var(--border-color)',
                                            color: '#fff',
                                            padding: isShare ? '8px' : '12px 16px',
                                            borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                            maxWidth: '80%',
                                            fontSize: '15px',
                                            lineHeight: '1.4',
                                            wordBreak: 'break-word',
                                            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                                        }}>
                                            {isShare ? renderSharedContent(msg.content, isMe) : (
                                                (msg.content.startsWith('[VOICE_REACTION]') || msg.content.startsWith('[VOICE]')) ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <div style={{ fontSize: '12px', opacity: 0.8, fontWeight: 'bold' }}>
                                                            🎙️ Group Voice Mail
                                                        </div>
                                                        <audio
                                                            controls
                                                            src={msg.content.replace('[VOICE_REACTION] ', '').replace('[VOICE] ', '')}
                                                            style={{
                                                                width: '200px', height: '36px',
                                                                borderRadius: '18px',
                                                            }}
                                                        />
                                                    </div>
                                                ) : msg.content.startsWith('[SNAP]') ? (() => {
                                                    const url = msg.content.replace('[SNAP] ', '');
                                                    const isVideo = url.match(/\.(mp4|webm|mov)(\?.*)?$/i);
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
                                                            <ImageIcon size={18} /> Tap to View Photo / Video
                                                        </button>
                                                    );
                                                })() : msg.content
                                            )}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-inactive)', marginTop: '4px', display: 'flex', alignItems: 'center' }}>
                                            {formatTime(msg.created_at)}
                                            {isMe && (
                                                <button
                                                    onClick={() => handleDeleteMessage(msg.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 8px', color: 'var(--text-inactive)', display: 'flex', alignItems: 'center' }}
                                                    title="Delete message"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Group Message Input */}
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
                                >
                                    <Mic size={24} />
                                </button>
                                <input
                                    type="text"
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    placeholder={`Message ${selectedGroup.name}...`}
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
                            </>
                        )}
                    </form>
                </>
            ) : (
                /* ── Direct 1-on-1 Chat View ── */
                <>
                    <header style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid #2c2c2e', background: 'var(--surface-color)' }}>
                        <button
                            onClick={() => {
                                setView('list');
                                if (initialOpenUserId) onClose();
                            }}
                            style={{ background: 'none', border: 'none', color: '#f5a524', marginRight: '12px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
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
                                            {isShare ? renderSharedContent(msg.content, isMe) : (
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

            {/* ── CREATE GROUP MODAL ── */}
            {showCreateGroupModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                    zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    backdropFilter: 'blur(4px)',
                }}>
                    <div style={{
                        width: '100%', maxWidth: '500px', maxHeight: '85vh',
                        background: 'var(--surface-color)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                        display: 'flex', flexDirection: 'column', padding: '20px',
                        border: '1px solid var(--border-color)',
                        animation: 'slideUp 0.3s ease-out',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'var(--text-active)' }}>
                                Create New Friend Group 👥
                            </h3>
                            <button
                                onClick={() => setShowCreateGroupModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', cursor: 'pointer' }}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Group Name & Emoji Picker */}
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #f5a524, #a855f7)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '24px', flexShrink: 0
                            }}>
                                {newGroupEmoji}
                            </div>
                            <input
                                type="text"
                                placeholder="Group Name (e.g. Squad 🔥)"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                style={{
                                    flex: 1, background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                                    borderRadius: '14px', padding: '12px 16px', color: '#fff', fontSize: '15px', outline: 'none'
                                }}
                            />
                        </div>

                        {/* Emoji Selection Bar */}
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '14px' }}>
                            {GROUP_EMOJIS.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => setNewGroupEmoji(emoji)}
                                    style={{
                                        background: newGroupEmoji === emoji ? 'rgba(245, 165, 36, 0.3)' : 'rgba(255,255,255,0.05)',
                                        border: newGroupEmoji === emoji ? '2px solid #f5a524' : '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px', padding: '8px 10px', fontSize: '20px', cursor: 'pointer'
                                    }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>

                        {/* Search Friends */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                            borderRadius: '12px', padding: '8px 12px', marginBottom: '12px'
                        }}>
                            <Search size={16} color="var(--text-inactive)" />
                            <input
                                type="text"
                                placeholder="Search friends to add..."
                                value={friendSearchQuery}
                                onChange={(e) => setFriendSearchQuery(e.target.value)}
                                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '13px', outline: 'none', flex: 1 }}
                            />
                        </div>

                        {/* Friends Checklist */}
                        <div style={{ flex: 1, overflowY: 'auto', minHeight: '180px', maxHeight: '300px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {filteredFriendsForGroup.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-inactive)', padding: '24px 0', fontSize: '13px' }}>
                                    No friends found. Follow people or connect with them to add them to your group!
                                </div>
                            ) : (
                                filteredFriendsForGroup.map(friend => {
                                    const isSelected = selectedMemberIds.includes(friend.id);
                                    return (
                                        <div
                                            key={friend.id}
                                            onClick={() => toggleMemberSelection(friend.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '10px 12px', borderRadius: '12px', cursor: 'pointer',
                                                background: isSelected ? 'rgba(245, 165, 36, 0.12)' : 'rgba(255,255,255,0.03)',
                                                border: isSelected ? '1px solid #f5a524' : '1px solid transparent',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <img
                                                    src={friend.avatar_url || 'https://i.pravatar.cc/150'}
                                                    alt=""
                                                    style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                                                />
                                                <div>
                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-active)' }}>
                                                        {friend.name || friend.username}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-inactive)' }}>
                                                        @{friend.username}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{
                                                width: '22px', height: '22px', borderRadius: '6px',
                                                background: isSelected ? '#f5a524' : 'rgba(255,255,255,0.1)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.2)'
                                            }}>
                                                {isSelected && <CheckIcon size={14} color="#000" strokeWidth={3} />}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Create Button */}
                        <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setShowCreateGroupModal(false)}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '16px',
                                    background: 'rgba(255,255,255,0.08)', border: 'none',
                                    color: 'var(--text-active)', fontWeight: 'bold', cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateGroup}
                                disabled={!newGroupName.trim() || selectedMemberIds.length === 0}
                                style={{
                                    flex: 2, padding: '12px', borderRadius: '16px',
                                    background: (!newGroupName.trim() || selectedMemberIds.length === 0) ? 'var(--border-color)' : 'var(--primary-gradient)',
                                    border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '15px',
                                    cursor: (!newGroupName.trim() || selectedMemberIds.length === 0) ? 'not-allowed' : 'pointer',
                                    boxShadow: (!newGroupName.trim() || selectedMemberIds.length === 0) ? 'none' : '0 4px 14px rgba(245, 165, 36, 0.4)'
                                }}
                            >
                                Create Group ({selectedMemberIds.length + 1} members)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── GROUP INFO MODAL ── */}
            {showGroupInfoModal && selectedGroup && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                    zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    backdropFilter: 'blur(4px)',
                }}>
                    <div style={{
                        width: '100%', maxWidth: '500px', maxHeight: '80vh',
                        background: 'var(--surface-color)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                        display: 'flex', flexDirection: 'column', padding: '20px',
                        border: '1px solid var(--border-color)',
                        animation: 'slideUp 0.3s ease-out',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'var(--text-active)' }}>
                                Group Info
                            </h3>
                            <button
                                onClick={() => setShowGroupInfoModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', cursor: 'pointer' }}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        <div style={{ textAlign: 'center', padding: '16px 0 20px', borderBottom: '1px solid #2c2c2e' }}>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #f5a524, #a855f7)',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '32px', marginBottom: '10px',
                            }}>
                                {selectedGroup.avatar_emoji || '👥'}
                            </div>
                            <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 'bold', color: 'var(--text-active)' }}>
                                {selectedGroup.name}
                            </h2>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-inactive)' }}>
                                Group • {selectedGroup.members.length} members
                            </p>
                        </div>

                        {/* Members List */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-inactive)', marginBottom: '8px' }}>
                                MEMBERS
                            </div>
                            {selectedGroup.members.map(member => (
                                <div
                                    key={member.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <img
                                            src={member.avatar_url || 'https://i.pravatar.cc/150'}
                                            alt=""
                                            style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                                        />
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-active)' }}>
                                                {member.name || member.username}
                                                {member.id === selectedGroup.creator_id && (
                                                    <span style={{ marginLeft: '6px', fontSize: '11px', background: 'rgba(245, 165, 36, 0.2)', color: '#f5a524', padding: '1px 6px', borderRadius: '8px' }}>
                                                        Admin
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-inactive)' }}>
                                                @{member.username} {member.id === currentUser.id ? '(You)' : ''}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Leave Group Action */}
                        <div style={{ marginTop: '16px' }}>
                            <button
                                onClick={() => handleLeaveGroup(selectedGroup.id)}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '16px',
                                    background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#ef4444', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                <LogOut size={16} /> Leave Group
                            </button>
                        </div>
                    </div>
                </div>
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
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.3; }
                    100% { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default ChatPanel;
