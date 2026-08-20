import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, Send, Check, CheckCheck, Image as ImageIcon, Trash2, Mic, Users, Plus, Check as CheckIcon, Info, LogOut, Search, MessageSquarePlus, PhoneCall, Sparkles } from 'lucide-react';
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

function formatWhatsAppDate(isoDateStr: string): string {
    if (!isoDateStr) return '';
    const date = new Date(isoDateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (isYesterday) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' });
    }
}

function groupMessagesByDate(msgs: (MessageData | GroupMessage)[]) {
    const groups: { dateLabel: string; messages: (MessageData | GroupMessage)[] }[] = [];
    const todayStr = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    msgs.forEach(msg => {
        const msgDate = new Date(msg.created_at);
        const msgDateStr = msgDate.toDateString();
        let label = msgDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        if (msgDateStr === todayStr) label = 'Today';
        else if (msgDateStr === yesterdayStr) label = 'Yesterday';

        let existing = groups.find(g => g.dateLabel === label);
        if (!existing) {
            existing = { dateLabel: label, messages: [] };
            groups.push(existing);
        }
        existing.messages.push(msg);
    });
    return groups;
}

// ── Multi-Key Local Storage Chat Recovery Helpers ──
function loadLocalChatMessages(myId: string, partnerId: string): MessageData[] {
    const keys = [
        `knock_chat_msgs_${myId}_${partnerId}`,
        `knock_chat_msgs_${partnerId}_${myId}`,
        `knock_chat_msgs_${partnerId}`,
        `knock_chat_${partnerId}`,
    ];
    const idMap = new Map<string, MessageData>();

    keys.forEach(k => {
        try {
            const raw = localStorage.getItem(k);
            if (raw) {
                const parsed: MessageData[] = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    parsed.forEach(m => {
                        if (m && m.id && m.content) idMap.set(m.id, m);
                    });
                }
            }
        } catch (e) {}
    });

    return Array.from(idMap.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function scanAllLocalChatThreads(myId: string): Map<string, { lastMessage: MessageData; unreadCount: number }> {
    const map = new Map<string, { lastMessage: MessageData; unreadCount: number }>();
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('knock_chat_msgs_') || key.startsWith('knock_chat_'))) {
                const parts = key.replace('knock_chat_msgs_', '').replace('knock_chat_', '').split('_');
                const otherId = parts.length >= 2 ? (parts[0] === myId ? parts[1] : parts[0]) : parts[0];
                if (otherId && otherId !== myId) {
                    try {
                        const msgs: MessageData[] = JSON.parse(localStorage.getItem(key) || '[]');
                        if (Array.isArray(msgs) && msgs.length > 0) {
                            const last = msgs[msgs.length - 1];
                            map.set(otherId, { lastMessage: last, unreadCount: 0 });
                        }
                    } catch (e) {}
                }
            }
        }
    } catch (e) {}
    return map;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
    isOpen,
    onClose,
    currentUser,
    initialOpenUserId,
    refreshKey = 0,
    pendingShare = null,
}) => {
    const [allContacts, setAllContacts] = useState<ChatContact[]>(() => {
        if (currentUser?.id) {
            const cached = localStorage.getItem(`knock_chat_list_${currentUser.id}`);
            if (cached) {
                try { return JSON.parse(cached); } catch (e) {}
            }
        }
        return [];
    });
    const [loadingContacts, setLoadingContacts] = useState(false);
    const navigate = useNavigate();

    const [view, setView] = useState<'list' | 'chat' | 'group_chat'>('list');
    const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'direct' | 'groups'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);

    // Group state
    const [groups, setGroups] = useState<GroupChat[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<GroupChat | null>(null);
    const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupEmoji, setNewGroupEmoji] = useState('🔥');
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [newChatSearchQuery, setNewChatSearchQuery] = useState('');

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
            } catch (e) {}
        }
    }, [currentUser?.id]);

    const saveGroups = (updated: GroupChat[]) => {
        setGroups(updated);
        if (currentUser?.id) {
            localStorage.setItem(`knock_groups_${currentUser.id}`, JSON.stringify(updated));
        }
    };

    const saveChatListCache = (list: ChatContact[]) => {
        if (currentUser?.id) {
            localStorage.setItem(`knock_chat_list_${currentUser.id}`, JSON.stringify(list));
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
            if (showNewChatModal) {
                setShowNewChatModal(false);
                window.history.pushState({ chatPanel: true }, '');
            } else if (showCreateGroupModal) {
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
    }, [isOpen, viewingSnap, view, showCreateGroupModal, showGroupInfoModal, showNewChatModal, onClose]);

    // Fetch all chat threads from Supabase & merge with local history
    const fetchChatThreads = async (myId: string) => {
        const { data: msgs, error } = await supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
            .order('created_at', { ascending: false });

        const threadMap = scanAllLocalChatThreads(myId);

        if (msgs && Array.isArray(msgs)) {
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
                    if (new Date(msg.created_at).getTime() > new Date(current.lastMessage.created_at).getTime()) {
                        current.lastMessage = msg;
                    }
                }
            }
        }

        return threadMap;
    };

    const refreshContacts = useCallback(() => {
        if (!currentUser?.id) return;
        setLoadingContacts(true);

        fetchChatThreads(currentUser.id).then(async threadMap => {
            try {
                const [connIds, followingIds, followerIds, { data: allProfiles }] = await Promise.all([
                    fetchConnectionUserIds(currentUser.id),
                    fetchFollowing(currentUser.id),
                    fetchFollowers(currentUser.id),
                    supabase.from('profiles').select('id, username, name, avatar_url, bio, gender').limit(100)
                ]);

                const allIds = new Set<string>([
                    ...connIds,
                    ...followingIds,
                    ...followerIds,
                    ...Array.from(threadMap.keys()),
                    ...(allProfiles || []).map(p => p.id)
                ]);

                allIds.delete(currentUser.id);

                const profilesToUse: any[] = allProfiles && allProfiles.length > 0 
                    ? (allProfiles as any[]).filter(p => p.id !== currentUser.id)
                    : await fetchProfilesByIds(Array.from(allIds));

                const contactsWithThreads: ChatContact[] = profilesToUse.map(profile => {
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
                    return (a.name || a.username || '').localeCompare(b.name || b.username || '');
                });

                if (initialOpenUserId && !merged.some(c => c.id === initialOpenUserId)) {
                    const p = profilesToUse.find(p => p.id === initialOpenUserId);
                    if (p) {
                        merged = [{ ...p, lastMessage: null, unreadCount: 0 }, ...merged];
                    }
                }

                setAllContacts(merged);
                saveChatListCache(merged);
            } catch (err) {
                console.error('Error refreshing contacts:', err);
            } finally {
                setLoadingContacts(false);
            }
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

    // Handle incoming pending post shares
    useEffect(() => {
        if (!pendingShare) return;

        setAllContacts(prev => {
            const existing = prev.find(c => c.id === pendingShare.receiverId);
            if (existing) {
                const updated = [
                    { ...existing, lastMessage: pendingShare.message, unreadCount: 0 },
                    ...prev.filter(c => c.id !== pendingShare.receiverId),
                ].sort((a, b) => {
                    const timeA = a.lastMessage?.created_at ?? '';
                    const timeB = b.lastMessage?.created_at ?? '';
                    return timeB.localeCompare(timeA);
                });
                saveChatListCache(updated);
                return updated;
            }
            return prev;
        });

        if (view === 'chat' && selectedContact?.id === pendingShare.receiverId) {
            setMessages(prev => {
                if (prev.some(m => m.id === pendingShare.message.id)) return prev;
                const updated = [...prev, pendingShare.message];
                localStorage.setItem(`knock_chat_msgs_${currentUser.id}_${selectedContact.id}`, JSON.stringify(updated));
                return updated;
            });
            scrollToBottom();
        }
    }, [pendingShare, view, selectedContact?.id]);

    // 1-on-1 Chat Persistence & Real-time Subscriptions
    useEffect(() => {
        if (view === 'chat' && selectedContact) {
            const cacheKey = `knock_chat_msgs_${currentUser.id}_${selectedContact.id}`;
            const initialLocalMsgs = loadLocalChatMessages(currentUser.id, selectedContact.id);
            if (initialLocalMsgs.length > 0) {
                setMessages(initialLocalMsgs);
            }

            setLoadingMessages(true);
            markMessagesAsRead(selectedContact.id, currentUser.id);

            fetchMessages(currentUser.id, selectedContact.id).then(data => {
                setMessages(prev => {
                    const idMap = new Map<string, MessageData>();
                    initialLocalMsgs.forEach(m => idMap.set(m.id, m));
                    prev.forEach(m => idMap.set(m.id, m));
                    data.forEach(m => idMap.set(m.id, m));
                    const sorted = Array.from(idMap.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                    localStorage.setItem(cacheKey, JSON.stringify(sorted));
                    return sorted;
                });
                setLoadingMessages(false);
                scrollToBottom();
            });

            const subscription = subscribeToMessages(currentUser.id, selectedContact.id, (newMsg) => {
                markMessagesAsRead(selectedContact.id, currentUser.id);
                setMessages(prev => {
                    if (prev.some(m => m.id === newMsg.id || (m.id.startsWith('temp-') && m.content === newMsg.content))) {
                        const updated = prev.map(m => (m.id.startsWith('temp-') && m.content === newMsg.content) ? newMsg : m);
                        localStorage.setItem(cacheKey, JSON.stringify(updated));
                        return updated;
                    }
                    const updated = [...prev, newMsg];
                    localStorage.setItem(cacheKey, JSON.stringify(updated));
                    return updated;
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
                        setGroups(prev => {
                            const updated = prev.map(g => g.id === selectedGroup.id ? { ...g, lastMessage: payload } : g);
                            saveGroups(updated);
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
                content: `✨ Group "${newGroupName.trim()}" created`,
                created_at: new Date().toISOString()
            }
        };

        const updatedGroups = [newGroup, ...groups];
        saveGroups(updatedGroups);

        setNewGroupName('');
        setSelectedMemberIds([]);
        setShowCreateGroupModal(false);

        setSelectedGroup(newGroup);
        setView('group_chat');
    };

    const toggleMemberSelection = (friendId: string) => {
        setSelectedMemberIds(prev => 
            prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
        );
    };

    const handleLeaveGroup = (groupId: string) => {
        if (window.confirm('Leave this group?')) {
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
                } catch (compErr) {}
            }
            const fileExt = fileToUpload.name.split('.').pop();
            const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
            const path = `chat_snaps/${fileName}`;

            const publicUrl = await uploadMedia(fileToUpload, path);
            const text = `[SNAP] ${publicUrl}`;

            if (view === 'chat' && selectedContact) {
                const cacheKey = `knock_chat_msgs_${currentUser.id}_${selectedContact.id}`;
                const optimisticMsg: MessageData = {
                    id: `temp-${Date.now()}`,
                    sender_id: currentUser.id,
                    receiver_id: selectedContact.id,
                    content: text,
                    created_at: new Date().toISOString(),
                    is_read: false,
                };
                setMessages(prev => {
                    const updated = [...prev, optimisticMsg];
                    localStorage.setItem(cacheKey, JSON.stringify(updated));
                    return updated;
                });
                scrollToBottom();

                const newPoints = (currentUser.points || 0) + 10;
                await updatePoints(currentUser.id, newPoints);

                const { data, error } = await sendMessage(currentUser.id, selectedContact.id, text);
                if (error) {
                    setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
                } else if (data) {
                    setMessages(prev => {
                        const updated = prev.map(m => m.id === optimisticMsg.id ? data : m);
                        localStorage.setItem(cacheKey, JSON.stringify(updated));
                        return updated;
                    });
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
            alert('Please enable microphone permissions to send voice messages.');
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
                    const cacheKey = `knock_chat_msgs_${currentUser.id}_${selectedContact.id}`;
                    const optimisticMsg: MessageData = {
                        id: `temp-${Date.now()}`,
                        sender_id: currentUser.id,
                        receiver_id: selectedContact.id,
                        content: text,
                        created_at: new Date().toISOString(),
                        is_read: false,
                    };
                    setMessages(prev => {
                        const updated = [...prev, optimisticMsg];
                        localStorage.setItem(cacheKey, JSON.stringify(updated));
                        return updated;
                    });
                    scrollToBottom();

                    const { data, error } = await sendMessage(currentUser.id, selectedContact.id, text);
                    if (error) {
                        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
                    } else if (data) {
                        setMessages(prev => {
                            const updated = prev.map(m => m.id === optimisticMsg.id ? data : m);
                            localStorage.setItem(cacheKey, JSON.stringify(updated));
                            return updated;
                        });
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
            const cacheKey = `knock_chat_msgs_${currentUser.id}_${selectedContact.id}`;
            const optimisticMsg: MessageData = {
                id: `temp-${Date.now()}`,
                sender_id: currentUser.id,
                receiver_id: selectedContact.id,
                content: text,
                created_at: new Date().toISOString(),
                is_read: false,
            };
            setMessages(prev => {
                const updated = [...prev, optimisticMsg];
                localStorage.setItem(cacheKey, JSON.stringify(updated));
                return updated;
            });
            scrollToBottom();

            const { data, error } = await sendMessage(currentUser.id, selectedContact.id, text);
            if (error) {
                console.error('Failed to send:', error);
                setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
            } else if (data) {
                setMessages(prev => {
                    const updated = prev.map(m => m.id === optimisticMsg.id ? data : m);
                    localStorage.setItem(cacheKey, JSON.stringify(updated));
                    return updated;
                });
                setAllContacts(prev => {
                    const updated = prev.map(c =>
                        c.id === selectedContact.id
                            ? { ...c, lastMessage: data }
                            : c
                    );
                    const sorted = updated.sort((a, b) => {
                        const timeA = a.lastMessage?.created_at ?? '';
                        const timeB = b.lastMessage?.created_at ?? '';
                        return timeB.localeCompare(timeA);
                    });
                    saveChatListCache(sorted);
                    return sorted;
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

            setGroups(prev => {
                const updated = prev.map(g => g.id === selectedGroup.id ? { ...g, lastMessage: groupMsg } : g);
                saveGroups(updated);
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
            if (view === 'chat' && selectedContact) {
                const cacheKey = `knock_chat_msgs_${currentUser.id}_${selectedContact.id}`;
                const { error } = await deleteMessage(msgId, currentUser.id);
                if (!error) {
                    setMessages(prev => {
                        const updated = prev.filter(m => m.id !== msgId);
                        localStorage.setItem(cacheKey, JSON.stringify(updated));
                        return updated;
                    });
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

    // Filter contacts according to active tab & search query
    const filteredContacts = allContacts.filter(c => {
        const matchesQuery = 
            (c.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.lastMessage?.content || '').toLowerCase().includes(searchQuery.toLowerCase());
        
        if (!matchesQuery) return false;

        if (activeTab === 'unread') return (c.unreadCount || 0) > 0;
        if (activeTab === 'direct') return true;
        if (activeTab === 'groups') return false;
        return true;
    });

    const filteredGroups = groups.filter(g => {
        const matchesQuery = 
            (g.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (g.lastMessage?.content || '').toLowerCase().includes(searchQuery.toLowerCase());
        
        if (!matchesQuery) return false;

        if (activeTab === 'direct') return false;
        return true;
    });

    const totalUnreadCount = allContacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'var(--bg-color)', zIndex: 1000, display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.3s ease-out',
        }}>
            {view === 'list' ? (
                <>
                    {/* WhatsApp-Style Header */}
                    <header style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '16px', borderBottom: '1px solid #222', background: 'var(--surface-color)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-active)', margin: 0, letterSpacing: '-0.3px' }}>
                                Chats
                            </h2>
                            {totalUnreadCount > 0 && (
                                <span style={{
                                    background: '#25D366', color: '#000', fontSize: '11px',
                                    fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px'
                                }}>
                                    {totalUnreadCount}
                                </span>
                            )}
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                onClick={() => setShowCreateGroupModal(true)}
                                style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '6px 12px',
                                    color: '#f5a524', fontSize: '13px', fontWeight: 'bold',
                                    display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer'
                                }}
                            >
                                <Users size={15} /> Group
                            </button>
                            <button
                                onClick={() => setShowNewChatModal(true)}
                                style={{
                                    background: 'var(--primary-gradient)',
                                    border: 'none', borderRadius: '16px', padding: '6px 12px',
                                    color: '#fff', fontSize: '13px', fontWeight: 'bold',
                                    display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(245, 165, 36, 0.3)'
                                }}
                            >
                                <MessageSquarePlus size={15} /> + New
                            </button>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', cursor: 'pointer', padding: '4px' }}>
                                <X size={24} />
                            </button>
                        </div>
                    </header>

                    {/* WhatsApp-Style Search Bar */}
                    <div style={{ padding: '10px 16px', background: 'var(--surface-color)', borderBottom: '1px solid #1c1c1e' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                            borderRadius: '16px', padding: '8px 14px',
                        }}>
                            <Search size={16} color="var(--text-inactive)" />
                            <input
                                type="text"
                                placeholder="Search chats or messages..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    background: 'none', border: 'none', color: '#fff',
                                    fontSize: '14px', outline: 'none', flex: 1
                                }}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', cursor: 'pointer' }}>
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* WhatsApp-Style Filter Pills */}
                    <div style={{
                        display: 'flex', gap: '8px', padding: '10px 16px',
                        borderBottom: '1px solid #1c1c1e', background: 'var(--surface-color)', overflowX: 'auto'
                    }}>
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'unread', label: `Unread (${totalUnreadCount})` },
                            { id: 'direct', label: `Direct (${allContacts.length})` },
                            { id: 'groups', label: `Groups (${groups.length})` },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                style={{
                                    padding: '5px 14px', borderRadius: '14px', fontSize: '13px', fontWeight: 'bold',
                                    border: activeTab === tab.id ? '1px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.08)',
                                    background: activeTab === tab.id ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.04)',
                                    color: activeTab === tab.id ? '#fff' : 'var(--text-inactive)',
                                    cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap',
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Chat Feed List */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                        {loadingContacts && allContacts.length === 0 ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-inactive)' }}>Loading chats...</div>
                        ) : (
                            <>
                                {/* ── Groups Section ── */}
                                {filteredGroups.length > 0 && (
                                    <div>
                                        {filteredGroups.map(group => (
                                            <div
                                                key={group.id}
                                                onClick={() => { setSelectedGroup(group); setView('group_chat'); }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', padding: '14px 16px',
                                                    borderBottom: '1px solid #1c1c1e', cursor: 'pointer',
                                                    background: 'rgba(245, 165, 36, 0.02)',
                                                }}
                                            >
                                                <div style={{
                                                    width: '52px', height: '52px', borderRadius: '50%',
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
                                                            {group.lastMessage ? formatWhatsAppDate(group.lastMessage.created_at) : ''}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                        <p style={{
                                                            margin: 0, fontSize: '13px', color: 'var(--text-inactive)',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                            flex: 1, marginRight: '8px'
                                                        }}>
                                                            {group.lastMessage ? `${group.lastMessage.sender_name}: ${group.lastMessage.content}` : `${group.members.length} members`}
                                                        </p>
                                                        <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '8px', color: '#f5a524' }}>
                                                            Group
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* ── Direct Chats Section ── */}
                                {filteredContacts.map(contact => {
                                    const lastMsg = contact.lastMessage;
                                    const unread = contact.unreadCount || 0;
                                    const isMe = lastMsg?.sender_id === currentUser.id;

                                    const getMessagePreview = () => {
                                        if (!lastMsg) return 'Tap to start chatting';
                                        if (lastMsg.content.startsWith('[SHARE_POST]')) {
                                            return getSharePreview(lastMsg.content, isMe, contact.username);
                                        }
                                        if (lastMsg.content.startsWith('[VOICE_REACTION]') || lastMsg.content.startsWith('[VOICE]')) {
                                            return isMe ? '🎙️ Voice note' : `🎙️ Voice note from ${contact.username}`;
                                        }
                                        if (lastMsg.content.startsWith('[SNAP]')) {
                                            return isMe ? '📷 Photo' : `📷 Photo from ${contact.username}`;
                                        }
                                        return lastMsg.content;
                                    };

                                    return (
                                        <div
                                            key={contact.id}
                                            onClick={() => { setSelectedContact(contact); setView('chat'); }}
                                            style={{
                                                display: 'flex', alignItems: 'center', padding: '14px 16px',
                                                borderBottom: '1px solid #1a1a1c', cursor: 'pointer',
                                                backgroundColor: unread > 0 ? 'rgba(37, 211, 102, 0.05)' : 'transparent',
                                                transition: 'background-color 0.15s ease',
                                            }}
                                        >
                                            <div style={{ position: 'relative', marginRight: '14px', flexShrink: 0 }}>
                                                <img
                                                    src={contact.avatar_url || 'https://i.pravatar.cc/150'}
                                                    alt={contact.username}
                                                    style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover' }}
                                                />
                                                <span style={{
                                                    position: 'absolute', bottom: '2px', right: '2px',
                                                    width: '12px', height: '12px', borderRadius: '50%',
                                                    background: '#25D366', border: '2px solid #000'
                                                }} />
                                            </div>

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <h3 style={{
                                                        margin: 0, fontSize: '16px', color: 'var(--text-active)',
                                                        fontWeight: unread > 0 ? '700' : '600',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>
                                                        {contact.name || contact.username}
                                                    </h3>
                                                    <span style={{ fontSize: '12px', color: unread > 0 ? '#25D366' : 'var(--text-inactive)', fontWeight: unread > 0 ? 'bold' : 'normal' }}>
                                                        {lastMsg ? formatWhatsAppDate(lastMsg.created_at) : ''}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', flex: 1, marginRight: '8px' }}>
                                                        {lastMsg && isMe && (
                                                            <span>
                                                                {lastMsg.is_read ? (
                                                                    <CheckCheck size={16} color="#34B7F1" />
                                                                ) : (
                                                                    <Check size={16} color="#8696a0" />
                                                                )}
                                                            </span>
                                                        )}
                                                        <p style={{
                                                            margin: 0, fontSize: '14px',
                                                            color: unread > 0 ? 'var(--text-active)' : 'var(--text-inactive)',
                                                            fontWeight: unread > 0 ? '600' : 'normal',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                        }}>
                                                            {getMessagePreview()}
                                                        </p>
                                                    </div>

                                                    {unread > 0 && (
                                                        <span style={{
                                                            background: '#25D366', color: '#000', fontSize: '12px',
                                                            fontWeight: 'bold', borderRadius: '50%', minWidth: '20px',
                                                            height: '20px', display: 'flex', alignItems: 'center',
                                                            justifyContent: 'center', padding: '0 5px',
                                                        }}>
                                                            {unread}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {filteredContacts.length === 0 && filteredGroups.length === 0 && (
                                    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-inactive)' }}>
                                        <MessageSquarePlus size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                                        <h3 style={{ color: 'var(--text-active)', margin: '0 0 8px' }}>No chats found</h3>
                                        <p style={{ margin: '0 0 20px', fontSize: '14px' }}>
                                            {searchQuery ? `No chats matching "${searchQuery}"` : 'Start a new conversation with friends on Knock Knock!'}
                                        </p>
                                        <button
                                            onClick={() => setShowNewChatModal(true)}
                                            style={{
                                                background: 'var(--primary-gradient)', border: 'none', borderRadius: '20px',
                                                padding: '10px 24px', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer'
                                            }}
                                        >
                                            + Start New Chat
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            ) : view === 'group_chat' && selectedGroup ? (
                /* ── WhatsApp-Style Group Chat Room View ── */
                <>
                    <header style={{
                        display: 'flex', alignItems: 'center', padding: '12px 16px',
                        borderBottom: '1px solid #2c2c2e', background: 'var(--surface-color)'
                    }}>
                        <button
                            onClick={() => setView('list')}
                            style={{ background: 'none', border: 'none', color: '#f5a524', marginRight: '8px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                        >
                            <ChevronLeft size={26} />
                        </button>
                        <div 
                            style={{ display: 'flex', alignItems: 'center', flex: 1, cursor: 'pointer' }}
                            onClick={() => setShowGroupInfoModal(true)}
                        >
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #f5a524, #a855f7)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '20px', marginRight: '12px', flexShrink: 0
                            }}>
                                {selectedGroup.avatar_emoji || '👥'}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-active)', margin: 0 }}>
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

                    {/* WhatsApp-Style Group Message Stream */}
                    <div style={{
                        flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column',
                        background: 'radial-gradient(circle at center, #111116 0%, #08080a 100%)'
                    }}>
                        {groupMessages.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-inactive)', margin: 'auto', padding: '24px' }}>
                                <div style={{ fontSize: '40px', marginBottom: '8px' }}>{selectedGroup.avatar_emoji}</div>
                                <h3 style={{ color: 'var(--text-active)', margin: '0 0 6px' }}>Welcome to {selectedGroup.name}!</h3>
                                <p style={{ margin: 0, fontSize: '13px' }}>Messages in this group are shared in real-time with all members.</p>
                            </div>
                        ) : (
                            groupMessagesByDate(groupMessages).map((dateGroup, dIdx) => (
                                <React.Fragment key={dIdx}>
                                    <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
                                        <span style={{
                                            background: 'rgba(255,255,255,0.08)', color: 'var(--text-inactive)',
                                            fontSize: '11px', fontWeight: 'bold', padding: '3px 12px', borderRadius: '10px'
                                        }}>
                                            {dateGroup.dateLabel}
                                        </span>
                                    </div>

                                    {(dateGroup.messages as GroupMessage[]).map(msg => {
                                        const isMe = msg.sender_id === currentUser.id;
                                        const isShare = msg.content.startsWith('[SHARE_POST]');

                                        return (
                                            <div
                                                key={msg.id}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: isMe ? 'flex-end' : 'flex-start',
                                                    marginBottom: '10px',
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
                                                    background: isMe ? 'linear-gradient(135deg, #005c4b, #025144)' : 'var(--border-color)',
                                                    color: '#fff',
                                                    padding: isShare ? '8px' : '10px 14px',
                                                    borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                                    maxWidth: '82%',
                                                    fontSize: '15px',
                                                    lineHeight: '1.4',
                                                    wordBreak: 'break-word',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
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
                                                                    style={{ width: '200px', height: '36px', borderRadius: '18px' }}
                                                                />
                                                            </div>
                                                        ) : msg.content.startsWith('[SNAP]') ? (() => {
                                                            const url = msg.content.replace('[SNAP] ', '');
                                                            const isVideo = url.match(/\.(mp4|webm|mov)(\?.*)?$/i);
                                                            return (
                                                                <button 
                                                                    onClick={() => setViewingSnap({ url, type: isVideo ? 'video' : 'image' })}
                                                                    style={{ 
                                                                        background: 'rgba(255,255,255,0.15)',
                                                                        border: 'none', borderRadius: '12px', padding: '12px 18px',
                                                                        color: '#fff', fontWeight: 'bold', cursor: 'pointer',
                                                                        display: 'flex', alignItems: 'center', gap: '8px'
                                                                    }}
                                                                >
                                                                    <ImageIcon size={18} /> Tap to View Photo / Video
                                                                </button>
                                                            );
                                                        })() : msg.content
                                                    )}
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                        <span style={{ fontSize: '10px', opacity: 0.65 }}>
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {isMe && (
                                                            <button
                                                                onClick={() => handleDeleteMessage(msg.id)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.5)' }}
                                                            >
                                                                <Trash2 size={11} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* WhatsApp-Style Input Bar */}
                    <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-color)', borderTop: '1px solid #222' }}>
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
                                <button type="button" onClick={cancelVoiceRecording} style={{ background: 'none', border: 'none', color: '#ff3b30', padding: '8px', cursor: 'pointer' }}>
                                    <Trash2 size={22} />
                                </button>
                                <button
                                    type="button"
                                    onClick={stopAndSendVoiceRecording}
                                    style={{
                                        background: '#25D366', color: '#000', border: 'none',
                                        borderRadius: '50%', width: '42px', height: '42px',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', padding: '6px', cursor: 'pointer', marginRight: '4px' }}
                                    disabled={isUploadingImage || isUploadingVoice}
                                >
                                    <ImageIcon size={22} />
                                </button>
                                <button
                                    type="button"
                                    onClick={startVoiceRecording}
                                    style={{ background: 'none', border: 'none', color: '#f5a524', padding: '6px', cursor: 'pointer', marginRight: '6px' }}
                                    disabled={isUploadingImage || isUploadingVoice}
                                >
                                    <Mic size={22} />
                                </button>
                                <input
                                    type="text"
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    placeholder={`Message ${selectedGroup.name}...`}
                                    disabled={isUploadingImage || isUploadingVoice}
                                    style={{
                                        flex: 1, background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                                        borderRadius: '22px', padding: '10px 16px', color: 'var(--text-active)',
                                        outline: 'none', fontSize: '15px',
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={!messageInput.trim()}
                                    style={{
                                        background: messageInput.trim() ? '#25D366' : 'rgba(255,255,255,0.08)',
                                        color: messageInput.trim() ? '#000' : 'rgba(255,255,255,0.3)',
                                        border: 'none', borderRadius: '50%', width: '42px', height: '42px',
                                        marginLeft: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center',
                                        cursor: messageInput.trim() ? 'pointer' : 'default',
                                    }}
                                >
                                    <Send size={18} style={{ marginLeft: '2px' }} />
                                </button>
                            </>
                        )}
                    </form>
                </>
            ) : (
                /* ── WhatsApp-Style Direct 1-on-1 Chat Room ── */
                <>
                    <header style={{
                        display: 'flex', alignItems: 'center', padding: '12px 16px',
                        borderBottom: '1px solid #222', background: 'var(--surface-color)'
                    }}>
                        <button
                            onClick={() => {
                                setView('list');
                                if (initialOpenUserId) onClose();
                            }}
                            style={{ background: 'none', border: 'none', color: '#f5a524', marginRight: '8px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                        >
                            <ChevronLeft size={26} />
                        </button>
                        <div 
                            style={{ display: 'flex', alignItems: 'center', flex: 1, cursor: 'pointer' }}
                            onClick={() => {
                                if (selectedContact?.username) {
                                    navigate(`/profile/${encodeURIComponent(selectedContact.username)}`);
                                    onClose(); 
                                }
                            }}
                        >
                            <div style={{ position: 'relative', marginRight: '10px' }}>
                                <img
                                    src={selectedContact?.avatar_url || 'https://i.pravatar.cc/150'}
                                    alt=""
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                                <span style={{
                                    position: 'absolute', bottom: '0', right: '0',
                                    width: '10px', height: '10px', borderRadius: '50%',
                                    background: '#25D366', border: '2px solid #000'
                                }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-active)', margin: 0 }}>
                                    {selectedContact?.name || selectedContact?.username || 'User'}
                                </h2>
                                <span style={{ fontSize: '11px', color: '#25D366' }}>Online</span>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                navigate(`/call?user=${encodeURIComponent(selectedContact?.username || '')}`);
                                onClose();
                            }}
                            style={{ background: 'none', border: 'none', color: '#f5a524', padding: '8px', cursor: 'pointer' }}
                            title="Direct Voice Call"
                        >
                            <PhoneCall size={20} />
                        </button>
                    </header>

                    {/* WhatsApp-Style Message Stream with Dates & Status Checkmarks */}
                    <div style={{
                        flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column',
                        background: 'radial-gradient(circle at center, #111116 0%, #08080a 100%)'
                    }}>
                        {loadingMessages && messages.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-inactive)', margin: 'auto' }}>Loading chat history...</div>
                        ) : messages.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-inactive)', margin: 'auto', padding: '24px' }}>
                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>👋</div>
                                <h3 style={{ color: 'var(--text-active)', margin: '0 0 6px' }}>Say hello to {selectedContact?.username}!</h3>
                                <p style={{ margin: 0, fontSize: '13px' }}>Send a message or voice note to start the conversation.</p>
                            </div>
                        ) : (
                            groupMessagesByDate(messages).map((dateGroup, dIdx) => (
                                <React.Fragment key={dIdx}>
                                    <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
                                        <span style={{
                                            background: 'rgba(255,255,255,0.08)', color: 'var(--text-inactive)',
                                            fontSize: '11px', fontWeight: 'bold', padding: '3px 12px', borderRadius: '10px'
                                        }}>
                                            {dateGroup.dateLabel}
                                        </span>
                                    </div>

                                    {(dateGroup.messages as MessageData[]).map(msg => {
                                        const isMe = msg.sender_id === currentUser.id;
                                        const isShare = msg.content.startsWith('[SHARE_POST]');

                                        return (
                                            <div
                                                key={msg.id}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: isMe ? 'flex-end' : 'flex-start',
                                                    marginBottom: '10px',
                                                }}
                                            >
                                                <div style={{
                                                    background: isMe ? 'linear-gradient(135deg, #005c4b, #025144)' : 'var(--border-color)',
                                                    color: '#fff',
                                                    padding: isShare ? '8px' : '10px 14px',
                                                    borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                                    maxWidth: '80%',
                                                    fontSize: '15px',
                                                    lineHeight: '1.4',
                                                    wordBreak: 'break-word',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
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
                                                                    style={{ width: '200px', height: '36px', borderRadius: '18px' }}
                                                                />
                                                            </div>
                                                        ) : msg.content.startsWith('[SNAP]') ? (() => {
                                                            const url = msg.content.replace('[SNAP] ', '');
                                                            const isVideo = url.match(/\.(mp4|webm|mov)(\?.*)?$/i);
                                                            return (
                                                                <button 
                                                                    onClick={() => setViewingSnap({ url, type: isVideo ? 'video' : 'image' })}
                                                                    style={{ 
                                                                        background: 'rgba(255,255,255,0.15)',
                                                                        border: 'none', borderRadius: '12px', padding: '12px 18px',
                                                                        color: '#fff', fontWeight: 'bold', cursor: 'pointer',
                                                                        display: 'flex', alignItems: 'center', gap: '8px'
                                                                    }}
                                                                >
                                                                    <ImageIcon size={18} /> Tap to View Photo / Video
                                                                </button>
                                                            );
                                                        })() : msg.content
                                                    )}

                                                    {/* WhatsApp-Style Micro Timestamp & Checkmarks inside bubble */}
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                        <span style={{ fontSize: '10px', opacity: 0.65 }}>
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {isMe && (
                                                            <>
                                                                <span>
                                                                    {msg.is_read ? (
                                                                        <CheckCheck size={14} color="#34B7F1" />
                                                                    ) : (
                                                                        <Check size={14} color="#8696a0" />
                                                                    )}
                                                                </span>
                                                                <button
                                                                    onClick={() => handleDeleteMessage(msg.id)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.5)' }}
                                                                >
                                                                    <Trash2 size={11} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* WhatsApp-Style Input Bar */}
                    <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-color)', borderTop: '1px solid #222' }}>
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
                                <button type="button" onClick={cancelVoiceRecording} style={{ background: 'none', border: 'none', color: '#ff3b30', padding: '8px', cursor: 'pointer' }}>
                                    <Trash2 size={22} />
                                </button>
                                <button
                                    type="button"
                                    onClick={stopAndSendVoiceRecording}
                                    style={{
                                        background: '#25D366', color: '#000', border: 'none',
                                        borderRadius: '50%', width: '42px', height: '42px',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', padding: '6px', cursor: 'pointer', marginRight: '4px' }}
                                    disabled={isUploadingImage || isUploadingVoice}
                                >
                                    <ImageIcon size={22} />
                                </button>
                                <button
                                    type="button"
                                    onClick={startVoiceRecording}
                                    style={{ background: 'none', border: 'none', color: '#f5a524', padding: '6px', cursor: 'pointer', marginRight: '6px' }}
                                    disabled={isUploadingImage || isUploadingVoice}
                                >
                                    <Mic size={22} />
                                </button>
                                <input
                                    type="text"
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    placeholder="Type a message..."
                                    disabled={isUploadingImage || isUploadingVoice}
                                    style={{
                                        flex: 1, background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                                        borderRadius: '22px', padding: '10px 16px', color: 'var(--text-active)',
                                        outline: 'none', fontSize: '15px',
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={!messageInput.trim()}
                                    style={{
                                        background: messageInput.trim() ? '#25D366' : 'rgba(255,255,255,0.08)',
                                        color: messageInput.trim() ? '#000' : 'rgba(255,255,255,0.3)',
                                        border: 'none', borderRadius: '50%', width: '42px', height: '42px',
                                        marginLeft: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center',
                                        cursor: messageInput.trim() ? 'pointer' : 'default',
                                    }}
                                >
                                    <Send size={18} style={{ marginLeft: '2px' }} />
                                </button>
                            </>
                        )}
                    </form>
                </>
            )}

            {/* ── NEW CHAT MODAL (Start chat with anyone) ── */}
            {showNewChatModal && (
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
                                Start New Conversation 💬
                            </h3>
                            <button
                                onClick={() => setShowNewChatModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', cursor: 'pointer' }}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                            borderRadius: '14px', padding: '10px 14px', marginBottom: '14px'
                        }}>
                            <Search size={18} color="var(--text-inactive)" />
                            <input
                                type="text"
                                placeholder="Search by name or username..."
                                value={newChatSearchQuery}
                                onChange={(e) => setNewChatSearchQuery(e.target.value)}
                                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '14px', outline: 'none', flex: 1 }}
                            />
                        </div>

                        {/* Contacts List */}
                        <div style={{ flex: 1, overflowY: 'auto', minHeight: '200px', maxHeight: '350px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {allContacts
                                .filter(c => 
                                    (c.username || '').toLowerCase().includes(newChatSearchQuery.toLowerCase()) ||
                                    (c.name || '').toLowerCase().includes(newChatSearchQuery.toLowerCase())
                                )
                                .map(contact => (
                                    <div
                                        key={contact.id}
                                        onClick={() => {
                                            setSelectedContact(contact);
                                            setShowNewChatModal(false);
                                            setView('chat');
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '12px',
                                            padding: '10px 12px', borderRadius: '12px', cursor: 'pointer',
                                            background: 'rgba(255,255,255,0.03)',
                                        }}
                                    >
                                        <img
                                            src={contact.avatar_url || 'https://i.pravatar.cc/150'}
                                            alt=""
                                            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-active)' }}>
                                                {contact.name || contact.username}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-inactive)' }}>
                                                @{contact.username}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
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

                        {/* Group Name & Emoji */}
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

                        {/* Emoji Selection */}
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

                        {/* Select Members */}
                        <div style={{ flex: 1, overflowY: 'auto', minHeight: '180px', maxHeight: '280px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {allContacts.map(friend => {
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
                            })}
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

                        {/* Members */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-inactive)', marginBottom: '8px' }}>
                                MEMBERS ({selectedGroup.members.length})
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

                        {/* Leave Button */}
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
