import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, Send, Check, CheckCheck, Image as ImageIcon, Trash2, Mic, Users, MessageSquare, Search, Plus, UserPlus, Sparkles, UserCheck, Camera } from 'lucide-react';
import { fetchConnectionUserIds, fetchProfilesByIds, fetchMessages, sendMessage, subscribeToMessages, markMessagesAsRead, uploadMedia, deleteMessage, fetchFollowing, fetchFollowers, updatePoints, type ProfileData, type MessageData } from '../lib/database';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/media';

export interface GroupChatData {
    id: string;
    name: string;
    avatar_url?: string;
    created_by: string;
    created_at: string;
    members: string[]; // array of user IDs
    lastMessage?: GroupMessageData | null;
    unreadCount?: number;
}

export interface GroupMessageData {
    id: string;
    group_id: string;
    sender_id: string;
    sender_name: string;
    sender_avatar?: string;
    content: string;
    created_at: string;
}

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

// ── Multi-Key Local Storage Chat Recovery Helpers (Zero Data Loss) ──
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

// ── Group Storage Helpers ──
function loadStoredGroups(myId: string): GroupChatData[] {
    try {
        const raw = localStorage.getItem(`knock_groups_${myId}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {}
    return [];
}

function saveStoredGroups(myId: string, groups: GroupChatData[]) {
    try {
        localStorage.setItem(`knock_groups_${myId}`, JSON.stringify(groups));
    } catch (e) {}
}

function loadGroupMessages(groupId: string): GroupMessageData[] {
    try {
        const raw = localStorage.getItem(`knock_group_msgs_${groupId}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {}
    return [];
}

function saveGroupMessages(groupId: string, msgs: GroupMessageData[]) {
    try {
        localStorage.setItem(`knock_group_msgs_${groupId}`, JSON.stringify(msgs));
    } catch (e) {}
}

const SENDER_COLORS = ['#34B7F1', '#ff4500', '#25D366', '#a855f7', '#f5a524', '#ec4899', '#06b6d4'];
function getSenderColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

const ChatPanel: React.FC<ChatPanelProps> = ({
    isOpen,
    onClose,
    currentUser,
    initialOpenUserId,
    refreshKey = 0,
    pendingShare = null,
}) => {
    const navigate = useNavigate();

    // ── Navigation & Views ──
    const [view, setView] = useState<'list' | 'chat' | 'group_chat'>('list');
    const [activeTab, setActiveTab] = useState<'chats' | 'groups' | 'connections'>('chats');
    const [searchQuery, setSearchQuery] = useState('');

    // ── Direct Chat States ──
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
    const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
    const [messages, setMessages] = useState<MessageData[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // ── Group Chat States ──
    const [groupsList, setGroupsList] = useState<GroupChatData[]>(() => loadStoredGroups(currentUser.id));
    const [selectedGroup, setSelectedGroup] = useState<GroupChatData | null>(null);
    const [groupMessages, setGroupMessages] = useState<GroupMessageData[]>([]);
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [groupSearchQuery, setGroupSearchQuery] = useState('');

    // ── Input & Media ──
    const [messageInput, setMessageInput] = useState('');
    const [isRecordingVoice, setIsRecordingVoice] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isUploadingVoice, setIsUploadingVoice] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [viewingSnap, setViewingSnap] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const voiceTimerRef = useRef<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

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
            if (viewingSnap) {
                setViewingSnap(null);
                window.history.pushState({ chatPanel: true }, '');
            } else if (showCreateGroupModal) {
                setShowCreateGroupModal(false);
                window.history.pushState({ chatPanel: true }, '');
            } else if (view === 'chat' || view === 'group_chat') {
                setView('list');
                setSelectedContact(null);
                setSelectedGroup(null);
                window.history.pushState({ chatPanel: true }, '');
            } else {
                onClose();
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isOpen, viewingSnap, showCreateGroupModal, view, onClose]);

    // Fetch Direct Chat Threads
    const fetchChatThreads = async (myId: string) => {
        const { data: msgs, error } = await supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
            .order('created_at', { ascending: false });

        const threadsMap = scanAllLocalChatThreads(myId);

        if (msgs && Array.isArray(msgs)) {
            msgs.forEach((m: MessageData) => {
                const partnerId = m.sender_id === myId ? m.receiver_id : m.sender_id;
                if (!threadsMap.has(partnerId)) {
                    threadsMap.set(partnerId, { lastMessage: m, unreadCount: 0 });
                }
                if (m.receiver_id === myId && !m.is_read) {
                    threadsMap.get(partnerId)!.unreadCount += 1;
                }
                if (new Date(m.created_at).getTime() > new Date(threadsMap.get(partnerId)!.lastMessage.created_at).getTime()) {
                    threadsMap.get(partnerId)!.lastMessage = m;
                }
            });
        }

        return Array.from(threadsMap.entries()).map(([partnerId, data]) => ({
            partnerId,
            ...data,
        }));
    };

    const refreshContacts = useCallback(() => {
        if (!currentUser?.id) return;
        setLoadingContacts(true);

        Promise.all([
            fetchConnectionUserIds(currentUser.id),
            fetchFollowing(currentUser.id),
            fetchFollowers(currentUser.id),
            fetchChatThreads(currentUser.id),
            supabase.from('profiles').select('id, username, name, avatar_url, bio, gender').limit(100)
        ]).then(([connIds, followingProfiles, followerProfiles, threadData, { data: allDbProfiles }]) => {
            const partnerIds = new Set<string>(threadData.map(t => t.partnerId));

            if (initialOpenUserId) {
                partnerIds.add(initialOpenUserId);
            }

            const dbProfilesMap = new Map((allDbProfiles || []).map(p => [p.id, p]));

            fetchProfilesByIds(Array.from(partnerIds)).then(fetchedProfiles => {
                const profilesMap = new Map<string, ProfileData>();
                (allDbProfiles || []).forEach(p => profilesMap.set(p.id, p as any));
                fetchedProfiles.forEach(p => profilesMap.set(p.id, p));

                const activeChats: ChatContact[] = threadData
                    .map(t => {
                        const profile = profilesMap.get(t.partnerId) || dbProfilesMap.get(t.partnerId);
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
                
                const allFriendIds = new Set<string>([
                    ...connIds,
                    ...followingProfiles.map(p => p.id),
                    ...followerProfiles.map(p => p.id),
                    ...(allDbProfiles || []).map(p => p.id)
                ]);
                allFriendIds.delete(currentUser.id);
                
                const unchattedConnIds = Array.from(allFriendIds).filter(id => !chattedSet.has(id));

                const unchattedConns: ChatContact[] = unchattedConnIds.map(id => {
                    const p = profilesMap.get(id) || dbProfilesMap.get(id);
                    if (!p) return null;
                    return {
                        ...p,
                        lastMessage: null,
                        unreadCount: 0,
                    };
                }).filter(Boolean) as ChatContact[];

                let merged = [...activeChats, ...unchattedConns];

                if (initialOpenUserId && !merged.some(c => c.id === initialOpenUserId)) {
                    const p = profilesMap.get(initialOpenUserId) || dbProfilesMap.get(initialOpenUserId);
                    if (p) {
                        merged = [{ ...p, lastMessage: null, unreadCount: 0 }, ...merged];
                    }
                }

                setAllContacts(merged);
                if (currentUser?.id) {
                    localStorage.setItem(`knock_chat_list_${currentUser.id}`, JSON.stringify(merged));
                }
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
    }, [currentUser.id, initialOpenUserId]);

    useEffect(() => {
        if (!isOpen) {
            setView('list');
            setSelectedContact(null);
            setSelectedGroup(null);
            return;
        }

        refreshContacts();

        // Listen for 1-on-1 messages
        const channel = supabase
            .channel(`chat-list-${currentUser.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                () => refreshContacts()
            )
            .subscribe();

        // Listen for group invitations or group updates
        const groupChannel = supabase
            .channel(`group-sync-${currentUser.id}`)
            .on('broadcast', { event: 'new-group-invite' }, ({ payload }) => {
                if (payload && payload.group) {
                    setGroupsList(prev => {
                        if (prev.some(g => g.id === payload.group.id)) return prev;
                        const updated = [payload.group, ...prev];
                        saveStoredGroups(currentUser.id, updated);
                        return updated;
                    });
                }
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
            groupChannel.unsubscribe();
        };
    }, [isOpen, currentUser.id, refreshKey, refreshContacts]);

    // Handle incoming pending post shares
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
                const updated = [...prev, pendingShare.message];
                localStorage.setItem(`knock_chat_msgs_${currentUser.id}_${selectedContact.id}`, JSON.stringify(updated));
                return updated;
            });
            scrollToBottom();
        }
    }, [pendingShare, view, selectedContact?.id]);

    // ── Load 1-on-1 Chat Room ──
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
                    (data || []).forEach(m => idMap.set(m.id, m));
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

    // ── Load Group Chat Room ──
    useEffect(() => {
        if (view === 'group_chat' && selectedGroup) {
            const local = loadGroupMessages(selectedGroup.id);
            setGroupMessages(local);
            scrollToBottom();

            // Real-time group messaging channel
            const channel = supabase
                .channel(`group-${selectedGroup.id}`)
                .on('broadcast', { event: 'new-group-message' }, ({ payload }) => {
                    if (payload && payload.message) {
                        setGroupMessages(prev => {
                            if (prev.some(m => m.id === payload.message.id)) return prev;
                            const updated = [...prev, payload.message];
                            saveGroupMessages(selectedGroup.id, updated);
                            return updated;
                        });
                        setGroupsList(prev => {
                            const updated = prev.map(g => g.id === selectedGroup.id ? { ...g, lastMessage: payload.message } : g);
                            saveStoredGroups(currentUser.id, updated);
                            return updated;
                        });
                        scrollToBottom();
                    }
                })
                .subscribe();

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

    // ── Create Group Handler ──
    const handleCreateGroup = () => {
        if (!newGroupName.trim()) {
            alert('Please enter a group name.');
            return;
        }

        const members = Array.from(new Set([currentUser.id, ...Array.from(selectedMembers)]));
        const newGroup: GroupChatData = {
            id: `grp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            name: newGroupName.trim(),
            avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(newGroupName.trim())}`,
            created_by: currentUser.id,
            created_at: new Date().toISOString(),
            members,
            lastMessage: null,
            unreadCount: 0,
        };

        const updated = [newGroup, ...groupsList];
        setGroupsList(updated);
        saveStoredGroups(currentUser.id, updated);

        // Broadcast invite to other online members
        members.forEach(memberId => {
            if (memberId !== currentUser.id) {
                supabase.channel(`group-sync-${memberId}`).send({
                    type: 'broadcast',
                    event: 'new-group-invite',
                    payload: { group: newGroup }
                }).catch(() => {});
            }
        });

        // Reset modal state
        setNewGroupName('');
        setSelectedMembers(new Set());
        setShowCreateGroupModal(false);
        setSelectedGroup(newGroup);
        setView('group_chat');
    };

    // ── Send 1-on-1 Message ──
    const handleSendDirect = async (text: string) => {
        if (!text.trim() || !selectedContact) return;
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
            console.error('Failed to send message:', error);
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
                return updated.sort((a, b) => {
                    const timeA = a.lastMessage?.created_at ?? '';
                    const timeB = b.lastMessage?.created_at ?? '';
                    return timeB.localeCompare(timeA);
                });
            });
        }
    };

    // ── Send Group Message ──
    const handleSendGroup = async (text: string) => {
        if (!text.trim() || !selectedGroup) return;

        const newMsg: GroupMessageData = {
            id: `grp-msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            group_id: selectedGroup.id,
            sender_id: currentUser.id,
            sender_name: currentUser.name || currentUser.username,
            sender_avatar: currentUser.avatar_url,
            content: text,
            created_at: new Date().toISOString(),
        };

        const updated = [...groupMessages, newMsg];
        setGroupMessages(updated);
        saveGroupMessages(selectedGroup.id, updated);
        scrollToBottom();

        // Update group last message in list
        setGroupsList(prev => {
            const up = prev.map(g => g.id === selectedGroup.id ? { ...g, lastMessage: newMsg } : g);
            saveStoredGroups(currentUser.id, up);
            return up;
        });

        // Broadcast to group members
        supabase.channel(`group-${selectedGroup.id}`).send({
            type: 'broadcast',
            event: 'new-group-message',
            payload: { message: newMsg }
        }).catch(() => {});
    };

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageInput.trim()) return;
        const text = messageInput.trim();
        setMessageInput('');

        if (view === 'chat') {
            handleSendDirect(text);
        } else if (view === 'group_chat') {
            handleSendGroup(text);
        }
    };

    // ── Image / Snap Upload ──
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
                handleSendDirect(text);
            } else if (view === 'group_chat' && selectedGroup) {
                handleSendGroup(text);
            }

            const newPoints = (currentUser.points || 0) + 10;
            await updatePoints(currentUser.id, newPoints);
        } catch (err) {
            console.error('Error uploading snap:', err);
            alert('Failed to upload photo. Please try again.');
        } finally {
            setIsUploadingImage(false);
        }
    };

    // ── Voice Recording ──
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
        if (!mediaRecorderRef.current) return;
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
                if (view === 'chat' && selectedContact) {
                    handleSendDirect(text);
                } else if (view === 'group_chat' && selectedGroup) {
                    handleSendGroup(text);
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

    const handleDeleteMessage = async (msgId: string) => {
        if (!selectedContact) return;
        if (window.confirm('Delete this message?')) {
            const { error } = await deleteMessage(msgId, currentUser.id);
            if (!error) {
                setMessages(prev => {
                    const updated = prev.filter(m => m.id !== msgId);
                    localStorage.setItem(`knock_chat_msgs_${currentUser.id}_${selectedContact.id}`, JSON.stringify(updated));
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
                    position: 'relative',
                    width: '200px',
                    height: '260px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: 'var(--surface-color)',
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
                        <img
                            src={mediaUrl}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: chatFilter }}
                        />
                    )}
                </div>
                {sharedPost.caption && (
                    <div style={{
                        fontSize: '13px',
                        padding: '0 4px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}>
                        {sharedPost.caption}
                    </div>
                )}
            </div>
        );
    };

    if (!isOpen) return null;

    // Filter contacts & groups based on search
    const filteredContacts = allContacts.filter(c =>
        (c.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const chattedContacts = filteredContacts.filter(c => c.lastMessage !== null && c.lastMessage !== undefined);
    const unchattedContacts = filteredContacts.filter(c => c.lastMessage === null || c.lastMessage === undefined);

    const filteredGroups = groupsList.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--bg-color)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInRight 0.3s ease-out',
        }}>
            {view === 'list' ? (
                <>
                    {/* ── WhatsApp-Style Header ── */}
                    <header style={{
                        padding: '16px 16px 12px',
                        background: 'var(--surface-color)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-active)', margin: 0, letterSpacing: '-0.5px' }}>
                                    Knock Chat
                                </h2>
                                <span style={{
                                    background: 'rgba(245, 165, 36, 0.2)',
                                    color: '#f5a524',
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    padding: '2px 8px',
                                    borderRadius: '10px'
                                }}>
                                    LIVE
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                    onClick={() => setShowCreateGroupModal(true)}
                                    title="Create Group"
                                    style={{
                                        background: 'linear-gradient(135deg, #f5a524, #ff4500)',
                                        border: 'none',
                                        color: '#000',
                                        borderRadius: '20px',
                                        padding: '6px 12px',
                                        fontWeight: '700',
                                        fontSize: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 10px rgba(245,165,36,0.3)'
                                    }}
                                >
                                    <Users size={15} />
                                    <span>New Group</span>
                                </button>
                                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', cursor: 'pointer', padding: '4px' }}>
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '16px',
                            padding: '8px 14px',
                        }}>
                            <Search size={16} color="var(--text-inactive)" />
                            <input
                                type="text"
                                placeholder="Search chats, groups, or friends..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-active)',
                                    fontSize: '14px',
                                    outline: 'none',
                                    flex: 1
                                }}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', cursor: 'pointer' }}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* WhatsApp-Style Navigation Tabs */}
                        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', margin: '0 -16px', padding: '0 16px' }}>
                            <button
                                onClick={() => setActiveTab('chats')}
                                style={{
                                    flex: 1,
                                    padding: '10px 0',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: activeTab === 'chats' ? '3px solid #f5a524' : '3px solid transparent',
                                    color: activeTab === 'chats' ? '#f5a524' : 'var(--text-inactive)',
                                    fontWeight: '700',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <MessageSquare size={16} />
                                <span>Chats</span>
                                {chattedContacts.length > 0 && (
                                    <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '10px' }}>
                                        {chattedContacts.length}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => setActiveTab('groups')}
                                style={{
                                    flex: 1,
                                    padding: '10px 0',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: activeTab === 'groups' ? '3px solid #f5a524' : '3px solid transparent',
                                    color: activeTab === 'groups' ? '#f5a524' : 'var(--text-inactive)',
                                    fontWeight: '700',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Users size={16} />
                                <span>Groups</span>
                                {groupsList.length > 0 && (
                                    <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '10px' }}>
                                        {groupsList.length}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => setActiveTab('connections')}
                                style={{
                                    flex: 1,
                                    padding: '10px 0',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: activeTab === 'connections' ? '3px solid #f5a524' : '3px solid transparent',
                                    color: activeTab === 'connections' ? '#f5a524' : 'var(--text-inactive)',
                                    fontWeight: '700',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <UserCheck size={16} />
                                <span>Connections</span>
                            </button>
                        </div>
                    </header>

                    {/* ── Main Tab Content ── */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                        {/* ── TAB 1: 1-on-1 CHATS ── */}
                        {activeTab === 'chats' && (
                            <>
                                {loadingContacts && allContacts.length === 0 ? (
                                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-inactive)' }}>Loading chats...</div>
                                ) : chattedContacts.length === 0 ? (
                                    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-inactive)' }}>
                                        <div style={{ fontSize: '36px', marginBottom: '12px' }}>💬</div>
                                        <h3 style={{ margin: '0 0 6px', color: 'var(--text-active)', fontSize: '17px' }}>No conversation yet</h3>
                                        <p style={{ margin: 0, fontSize: '13px' }}>Tap on "Connections" or start a new chat with your friends!</p>
                                    </div>
                                ) : (
                                    chattedContacts.map(contact => {
                                        const lastMsg = contact.lastMessage!;
                                        const unread = contact.unreadCount || 0;
                                        const isMe = lastMsg.sender_id === currentUser.id;

                                        const getMessagePreview = () => {
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
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '14px 16px',
                                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                    cursor: 'pointer',
                                                    transition: 'background 0.2s ease',
                                                }}
                                            >
                                                <div style={{ position: 'relative', marginRight: '14px' }}>
                                                    <img
                                                        src={contact.avatar_url || 'https://i.pravatar.cc/150'}
                                                        alt={contact.username}
                                                        style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover' }}
                                                    />
                                                    <div style={{
                                                        position: 'absolute', bottom: '2px', right: '2px',
                                                        width: '12px', height: '12px', borderRadius: '50%',
                                                        background: '#10b981', border: '2px solid var(--bg-color)'
                                                    }} />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <h3 style={{
                                                            margin: 0,
                                                            fontSize: '16px',
                                                            color: 'var(--text-active)',
                                                            fontWeight: unread > 0 ? '700' : '600',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}>
                                                            {contact.name || contact.username}
                                                        </h3>
                                                        <span style={{ fontSize: '11px', color: unread > 0 ? '#f5a524' : 'var(--text-inactive)' }}>
                                                            {new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                        <p style={{
                                                            margin: 0,
                                                            fontSize: '13.5px',
                                                            color: unread > 0 ? 'var(--text-active)' : 'var(--text-inactive)',
                                                            fontWeight: unread > 0 ? '600' : 'normal',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            marginRight: '8px',
                                                            flex: 1,
                                                        }}>
                                                            {getMessagePreview()}
                                                        </p>
                                                        {unread > 0 && (
                                                            <span style={{
                                                                background: '#f5a524',
                                                                color: '#000',
                                                                fontSize: '11px',
                                                                fontWeight: 'bold',
                                                                borderRadius: '50%',
                                                                minWidth: '18px',
                                                                height: '18px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                padding: '0 4px',
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
                            </>
                        )}

                        {/* ── TAB 2: GROUPS ── */}
                        {activeTab === 'groups' && (
                            <>
                                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-inactive)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Your Groups ({filteredGroups.length})
                                    </span>
                                    <button
                                        onClick={() => setShowCreateGroupModal(true)}
                                        style={{
                                            background: 'none', border: 'none', color: '#f5a524',
                                            fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
                                        }}
                                    >
                                        <Plus size={16} /> Create Group
                                    </button>
                                </div>

                                {filteredGroups.length === 0 ? (
                                    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-inactive)' }}>
                                        <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
                                        <h3 style={{ margin: '0 0 6px', color: 'var(--text-active)', fontSize: '17px' }}>No groups yet</h3>
                                        <p style={{ margin: '0 0 16px', fontSize: '13px' }}>Create a group with your friends to chat and share together!</p>
                                        <button
                                            onClick={() => setShowCreateGroupModal(true)}
                                            style={{
                                                background: 'linear-gradient(135deg, #f5a524, #ff4500)',
                                                color: '#000', border: 'none', padding: '10px 20px', borderRadius: '20px',
                                                fontWeight: '800', fontSize: '14px', cursor: 'pointer'
                                            }}
                                        >
                                            + Create Group Now
                                        </button>
                                    </div>
                                ) : (
                                    filteredGroups.map(group => {
                                        const lastMsg = group.lastMessage;
                                        return (
                                            <div
                                                key={group.id}
                                                onClick={() => { setSelectedGroup(group); setView('group_chat'); }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '14px 16px',
                                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <div style={{ position: 'relative', marginRight: '14px' }}>
                                                    <div style={{
                                                        width: '52px',
                                                        height: '52px',
                                                        borderRadius: '16px',
                                                        background: 'linear-gradient(135deg, #34B7F1, #25D366)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '22px',
                                                        boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)'
                                                    }}>
                                                        👥
                                                    </div>
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-active)', fontWeight: '700' }}>
                                                            {group.name}
                                                        </h3>
                                                        {lastMsg && (
                                                            <span style={{ fontSize: '11px', color: 'var(--text-inactive)' }}>
                                                                {new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                        <p style={{
                                                            margin: 0,
                                                            fontSize: '13px',
                                                            color: lastMsg ? 'var(--text-active)' : 'var(--text-inactive)',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            flex: 1
                                                        }}>
                                                            {lastMsg ? (
                                                                <span>
                                                                    <strong style={{ color: getSenderColor(lastMsg.sender_name) }}>{lastMsg.sender_name}: </strong>
                                                                    {lastMsg.content.startsWith('[VOICE_REACTION]') ? '🎙️ Voice note' : lastMsg.content.startsWith('[SNAP]') ? '📷 Photo' : lastMsg.content}
                                                                </span>
                                                            ) : (
                                                                `${group.members.length} members • Tap to chat`
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </>
                        )}

                        {/* ── TAB 3: CONNECTIONS ── */}
                        {activeTab === 'connections' && (
                            <>
                                <div style={{ padding: '12px 16px 6px', color: 'var(--text-inactive)', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px' }}>
                                    ALL CONNECTIONS & FRIENDS
                                </div>
                                {unchattedContacts.map(contact => (
                                    <div
                                        key={contact.id}
                                        onClick={() => { setSelectedContact(contact); setView('chat'); }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '14px 16px',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <img
                                            src={contact.avatar_url || 'https://i.pravatar.cc/150'}
                                            alt={contact.username}
                                            style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', marginRight: '14px' }}
                                        />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-active)', fontWeight: '600' }}>
                                                {contact.name || contact.username}
                                            </h3>
                                            <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#f5a524', fontWeight: '500' }}>
                                                Tap to message 💬
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </>
            ) : view === 'chat' && selectedContact ? (
                /* ── 1-ON-1 DIRECT CHAT ROOM ── */
                <>
                    <header style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'var(--surface-color)' }}>
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
                            onClick={() => {
                                if (selectedContact?.username) {
                                    navigate(`/profile/${encodeURIComponent(selectedContact.username)}`);
                                    onClose(); 
                                }
                            }}
                        >
                            <div style={{ position: 'relative', marginRight: '12px' }}>
                                <img
                                    src={selectedContact?.avatar_url || 'https://i.pravatar.cc/150'}
                                    alt=""
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                                <div style={{ position: 'absolute', bottom: '0', right: '0', width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', border: '2px solid var(--surface-color)' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h2 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-active)', margin: 0 }}>
                                    {selectedContact?.name || selectedContact?.username || 'User'}
                                </h2>
                                <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '500' }}>Online</span>
                            </div>
                        </div>
                    </header>

                    {/* Messages Stream */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'var(--bg-color)'
                    }}>
                        {loadingMessages && messages.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-inactive)', margin: 'auto' }}>Loading chat...</div>
                        ) : messages.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-inactive)', margin: 'auto', padding: '24px' }}>
                                <div style={{ fontSize: '36px', marginBottom: '8px' }}>👋</div>
                                <h3 style={{ color: 'var(--text-active)', margin: '0 0 6px' }}>Say hello to {selectedContact?.username}!</h3>
                                <p style={{ margin: 0, fontSize: '13px' }}>Send a message or voice note to start chatting.</p>
                            </div>
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
                                            color: isMe ? '#000' : 'var(--text-active)',
                                            padding: isShare ? '8px' : '10px 14px',
                                            borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                            maxWidth: '75%',
                                            fontSize: '15px',
                                            wordBreak: 'break-word',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
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
                                                                border: 'none',
                                                                borderRadius: '12px',
                                                                padding: '12px 18px',
                                                                color: '#fff',
                                                                fontWeight: 'bold',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px'
                                                            }}
                                                        >
                                                            <ImageIcon size={18} /> Tap to View Photo / Video
                                                        </button>
                                                    );
                                                })() : msg.content
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                            <span style={{ fontSize: '10px', color: 'var(--text-inactive)' }}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {isMe && (
                                                <>
                                                    {msg.is_read ? (
                                                        <CheckCheck size={12} color="#34B7F1" />
                                                    ) : (
                                                        <Check size={12} color="var(--text-inactive)" />
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteMessage(msg.id)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-inactive)' }}
                                                    >
                                                        <Trash2 size={12} />
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

                    {/* Input Bar */}
                    <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', padding: '12px', background: 'var(--surface-color)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <input 
                            type="file" 
                            accept="image/*,video/*" 
                            style={{ display: 'none' }} 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                        />
                        <input 
                            type="file" 
                            accept="image/*,video/*" 
                            capture="environment"
                            style={{ display: 'none' }} 
                            ref={cameraInputRef} 
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
                                        background: '#ff3366', color: '#fff', border: 'none',
                                        borderRadius: '50%', width: '44px', height: '44px',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Send size={20} style={{ marginLeft: '2px' }} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => cameraInputRef.current?.click()}
                                    title="Take Camera Snap"
                                    style={{ background: 'none', border: 'none', color: '#f5a524', padding: '8px 6px', cursor: 'pointer' }}
                                    disabled={isUploadingImage || isUploadingVoice}
                                >
                                    <Camera size={24} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Attach Photo / Video"
                                    style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', padding: '8px 6px', cursor: 'pointer' }}
                                    disabled={isUploadingImage || isUploadingVoice}
                                >
                                    <ImageIcon size={24} />
                                </button>
                                <button
                                    type="button"
                                    onClick={startVoiceRecording}
                                    title="Record Voice Note"
                                    style={{ background: 'none', border: 'none', color: '#f5a524', padding: '8px 6px', cursor: 'pointer', marginRight: '4px' }}
                                    disabled={isUploadingImage || isUploadingVoice}
                                >
                                    <Mic size={24} />
                                </button>
                                <input
                                    type="text"
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    placeholder="Message..."
                                    disabled={isUploadingImage || isUploadingVoice}
                                    style={{
                                        flex: 1, background: 'var(--border-color)', border: 'none',
                                        borderRadius: '24px', padding: '12px 16px', color: 'var(--text-active)',
                                        outline: 'none', fontSize: '15px',
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={!messageInput.trim()}
                                    style={{
                                        background: messageInput.trim() ? '#f5a524' : 'var(--border-color)',
                                        color: messageInput.trim() ? '#000' : 'var(--text-inactive)',
                                        border: 'none', borderRadius: '50%', width: '44px', height: '44px',
                                        marginLeft: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center',
                                        cursor: messageInput.trim() ? 'pointer' : 'default',
                                    }}
                                >
                                    <Send size={20} style={{ marginLeft: '4px' }} />
                                </button>
                            </>
                        )}
                    </form>
                </>
            ) : view === 'group_chat' && selectedGroup ? (
                /* ── GROUP CHAT ROOM VIEW ── */
                <>
                    <header style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'var(--surface-color)' }}>
                        <button
                            onClick={() => { setView('list'); setSelectedGroup(null); }}
                            style={{ background: 'none', border: 'none', color: '#f5a524', marginRight: '12px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #34B7F1, #25D366)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '18px', marginRight: '12px'
                        }}>
                            👥
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <h2 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-active)', margin: 0 }}>
                                {selectedGroup.name}
                            </h2>
                            <span style={{ fontSize: '12px', color: 'var(--text-inactive)' }}>
                                {selectedGroup.members.length} members
                            </span>
                        </div>
                    </header>

                    {/* Group Messages Stream */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'var(--bg-color)'
                    }}>
                        {groupMessages.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-inactive)', margin: 'auto', padding: '24px' }}>
                                <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎉</div>
                                <h3 style={{ color: 'var(--text-active)', margin: '0 0 6px' }}>Welcome to {selectedGroup.name}!</h3>
                                <p style={{ margin: 0, fontSize: '13px' }}>Send the first message to kick off the group chat.</p>
                            </div>
                        ) : (
                            groupMessages.map(msg => {
                                const isMe = msg.sender_id === currentUser.id;
                                const senderColor = getSenderColor(msg.sender_name);

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
                                        <div style={{
                                            background: isMe ? '#f5a524' : 'var(--border-color)',
                                            color: isMe ? '#000' : 'var(--text-active)',
                                            padding: '10px 14px',
                                            borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                            maxWidth: '75%',
                                            fontSize: '15px',
                                            wordBreak: 'break-word',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                                        }}>
                                            {!isMe && (
                                                <div style={{ fontSize: '12px', fontWeight: '800', color: senderColor, marginBottom: '4px' }}>
                                                    {msg.sender_name}
                                                </div>
                                            )}
                                            {(msg.content.startsWith('[VOICE_REACTION]') || msg.content.startsWith('[VOICE]')) ? (
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
                                                            border: 'none',
                                                            borderRadius: '12px',
                                                            padding: '12px 18px',
                                                            color: '#fff',
                                                            fontWeight: 'bold',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px'
                                                        }}
                                                    >
                                                        <ImageIcon size={18} /> Tap to View Photo / Video
                                                    </button>
                                                );
                                            })() : msg.content}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                            <span style={{ fontSize: '10px', color: 'var(--text-inactive)' }}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {isMe && <CheckCheck size={12} color="#34B7F1" />}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Group Input Bar */}
                    <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', padding: '12px', background: 'var(--surface-color)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <input 
                            type="file" 
                            accept="image/*,video/*" 
                            style={{ display: 'none' }} 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                        />
                        <input 
                            type="file" 
                            accept="image/*,video/*" 
                            capture="environment"
                            style={{ display: 'none' }} 
                            ref={cameraInputRef} 
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
                                        background: '#ff3366', color: '#fff', border: 'none',
                                        borderRadius: '50%', width: '44px', height: '44px',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Send size={20} style={{ marginLeft: '2px' }} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => cameraInputRef.current?.click()}
                                    title="Take Camera Snap"
                                    style={{ background: 'none', border: 'none', color: '#f5a524', padding: '8px 6px', cursor: 'pointer' }}
                                    disabled={isUploadingImage || isUploadingVoice}
                                >
                                    <Camera size={24} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Attach Photo / Video"
                                    style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', padding: '8px 6px', cursor: 'pointer' }}
                                    disabled={isUploadingImage || isUploadingVoice}
                                >
                                    <ImageIcon size={24} />
                                </button>
                                <button
                                    type="button"
                                    onClick={startVoiceRecording}
                                    title="Record Voice Note"
                                    style={{ background: 'none', border: 'none', color: '#f5a524', padding: '8px 6px', cursor: 'pointer', marginRight: '4px' }}
                                    disabled={isUploadingImage || isUploadingVoice}
                                >
                                    <Mic size={24} />
                                </button>
                                <input
                                    type="text"
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    placeholder="Message group..."
                                    disabled={isUploadingImage || isUploadingVoice}
                                    style={{
                                        flex: 1, background: 'var(--border-color)', border: 'none',
                                        borderRadius: '24px', padding: '12px 16px', color: 'var(--text-active)',
                                        outline: 'none', fontSize: '15px',
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={!messageInput.trim()}
                                    style={{
                                        background: messageInput.trim() ? '#f5a524' : 'var(--border-color)',
                                        color: messageInput.trim() ? '#000' : 'var(--text-inactive)',
                                        border: 'none', borderRadius: '50%', width: '44px', height: '44px',
                                        marginLeft: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center',
                                        cursor: messageInput.trim() ? 'pointer' : 'default',
                                    }}
                                >
                                    <Send size={20} style={{ marginLeft: '4px' }} />
                                </button>
                            </>
                        )}
                    </form>
                </>
            ) : null}

            {/* ── CREATE NEW GROUP MODAL ── */}
            {showCreateGroupModal && (
                <div
                    onClick={() => setShowCreateGroupModal(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10000,
                        background: 'rgba(0,0,0,0.85)',
                        backdropFilter: 'blur(16px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        boxSizing: 'border-box'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '460px',
                            maxHeight: '85vh',
                            background: '#1c1c1e',
                            borderRadius: '24px',
                            overflowY: 'auto',
                            boxShadow: '0 25px 60px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.15)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '20px'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-active)' }}>
                                Create New Group 👥
                            </h3>
                            <button onClick={() => setShowCreateGroupModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', cursor: 'pointer' }}>
                                <X size={22} />
                            </button>
                        </div>

                        {/* Group Name Input */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#888', marginBottom: '6px' }}>
                                GROUP NAME
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Weekend Vibes 🔥"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    borderRadius: '14px',
                                    padding: '12px 16px',
                                    color: '#fff',
                                    fontSize: '15px',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        {/* Search contacts to add */}
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#888', marginBottom: '6px' }}>
                                ADD MEMBERS ({selectedMembers.size} selected)
                            </label>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '12px',
                                padding: '8px 12px',
                                marginBottom: '10px'
                            }}>
                                <Search size={15} color="var(--text-inactive)" />
                                <input
                                    type="text"
                                    placeholder="Search connections..."
                                    value={groupSearchQuery}
                                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                                    style={{
                                        background: 'none', border: 'none', color: '#fff', fontSize: '13px', outline: 'none', flex: 1
                                    }}
                                />
                            </div>
                        </div>

                        {/* Members selection list */}
                        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '240px', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                            {allContacts
                                .filter(c => (c.username || '').toLowerCase().includes(groupSearchQuery.toLowerCase()) || (c.name || '').toLowerCase().includes(groupSearchQuery.toLowerCase()))
                                .map(contact => {
                                    const isChecked = selectedMembers.has(contact.id);
                                    return (
                                        <div
                                            key={contact.id}
                                            onClick={() => {
                                                setSelectedMembers(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(contact.id)) next.delete(contact.id);
                                                    else next.add(contact.id);
                                                    return next;
                                                });
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '10px 12px',
                                                borderRadius: '14px',
                                                cursor: 'pointer',
                                                background: isChecked ? 'rgba(245, 165, 36, 0.15)' : 'rgba(255,255,255,0.03)',
                                                border: isChecked ? '1px solid rgba(245, 165, 36, 0.4)' : '1px solid transparent'
                                            }}
                                        >
                                            <img
                                                src={contact.avatar_url || 'https://i.pravatar.cc/150'}
                                                alt=""
                                                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-active)' }}>
                                                    {contact.name || contact.username}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-inactive)' }}>
                                                    @{contact.username}
                                                </div>
                                            </div>
                                            <div style={{
                                                width: '22px', height: '22px', borderRadius: '50%',
                                                border: isChecked ? 'none' : '2px solid rgba(255,255,255,0.3)',
                                                background: isChecked ? '#f5a524' : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {isChecked && <Check size={14} color="#000" strokeWidth={3} />}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={handleCreateGroup}
                            disabled={!newGroupName.trim()}
                            style={{
                                width: '100%',
                                background: newGroupName.trim() ? 'linear-gradient(135deg, #f5a524, #ff4500)' : 'rgba(255,255,255,0.1)',
                                color: newGroupName.trim() ? '#000' : 'var(--text-inactive)',
                                border: 'none',
                                padding: '14px',
                                borderRadius: '16px',
                                fontWeight: '800',
                                fontSize: '15px',
                                cursor: newGroupName.trim() ? 'pointer' : 'default',
                                boxShadow: newGroupName.trim() ? '0 4px 16px rgba(245,165,36,0.35)' : 'none'
                            }}
                        >
                            Create Group ({selectedMembers.size + 1} members)
                        </button>
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
