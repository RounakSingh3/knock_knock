import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { ArrowLeft, Bell, PhoneCall, Heart, MessageCircle, UserPlus, Zap, CheckCheck, Flame, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface NotificationItem {
    id: string;
    type: 'call' | 'like' | 'comment' | 'follow' | 'streak' | 'reward';
    title: string;
    description: string;
    userAvatar?: string;
    username?: string;
    timeAgo: string;
    isRead: boolean;
    targetUrl?: string;
}

function formatTimeAgo(isoString: string): string {
    const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
}

export const Notifications: React.FC = () => {
    const { user } = useContext(AppContext);
    const navigate = useNavigate();

    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<'all' | 'calls' | 'social' | 'rewards'>('all');

    // Purge any legacy fake notifications from localStorage
    useEffect(() => {
        localStorage.removeItem('knock_notifications');
    }, []);

    useEffect(() => {
        if (!user?.id) {
            setLoading(false);
            return;
        }

        const loadRealNotifications = async () => {
            setLoading(true);
            try {
                const items: NotificationItem[] = [];

                // 1. Fetch real direct messages received by this user
                const { data: messages } = await supabase
                    .from('messages')
                    .select('id, sender_id, text, is_read, created_at')
                    .eq('receiver_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(25);

                if (messages && messages.length > 0) {
                    const senderIds = Array.from(new Set(messages.map(m => m.sender_id)));
                    const { data: senderProfiles } = await supabase
                        .from('profiles')
                        .select('id, username, name, avatar_url')
                        .in('id', senderIds);

                    const profileMap = new Map((senderProfiles || []).map(p => [p.id, p]));

                    messages.forEach(msg => {
                        const sender = profileMap.get(msg.sender_id);
                        const senderName = sender?.name || sender?.username || 'Someone';
                        items.push({
                            id: `msg-${msg.id}`,
                            type: 'comment',
                            title: `Message from ${senderName}`,
                            description: msg.text || 'Sent you a message',
                            userAvatar: sender?.avatar_url || `https://i.pravatar.cc/150?u=${msg.sender_id}`,
                            username: sender?.username,
                            timeAgo: formatTimeAgo(msg.created_at),
                            isRead: msg.is_read ?? false,
                            targetUrl: `/home`
                        });
                    });
                }

                // 2. Fetch real connections
                const { data: connections } = await supabase
                    .from('connections')
                    .select('id, user_a, user_b, created_at, compatibility_percent')
                    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
                    .order('created_at', { ascending: false })
                    .limit(15);

                if (connections && connections.length > 0) {
                    const partnerIds = connections.map(c => c.user_a === user.id ? c.user_b : c.user_a);
                    const { data: partnerProfiles } = await supabase
                        .from('profiles')
                        .select('id, username, name, avatar_url')
                        .in('id', partnerIds);

                    const profileMap = new Map((partnerProfiles || []).map(p => [p.id, p]));

                    connections.forEach(conn => {
                        const partnerId = conn.user_a === user.id ? conn.user_b : conn.user_a;
                        const partner = profileMap.get(partnerId);
                        const partnerName = partner?.name || partner?.username || 'A new friend';
                        items.push({
                            id: `conn-${conn.id}`,
                            type: 'follow',
                            title: 'New Connection! 🤝',
                            description: `You connected with ${partnerName} (${conn.compatibility_percent || 90}% match)`,
                            userAvatar: partner?.avatar_url || `https://i.pravatar.cc/150?u=${partnerId}`,
                            username: partner?.username,
                            timeAgo: formatTimeAgo(conn.created_at),
                            isRead: true,
                            targetUrl: `/profile/${partner?.username || ''}`
                        });
                    });
                }

                setNotifications(items);
            } catch (err) {
                console.error('Error loading real notifications:', err);
            } finally {
                setLoading(false);
            }
        };

        loadRealNotifications();
    }, [user?.id]);

    const markAsRead = async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        if (id.startsWith('msg-')) {
            const msgId = id.replace('msg-', '');
            await supabase.from('messages').update({ is_read: true }).eq('id', msgId);
        }
    };

    const markAllAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        if (user?.id) {
            await supabase.from('messages').update({ is_read: true }).eq('receiver_id', user.id);
        }
    };

    const handleNotificationClick = (notif: NotificationItem) => {
        markAsRead(notif.id);
        if (notif.targetUrl) {
            navigate(notif.targetUrl);
        }
    };

    const filteredNotifications = notifications.filter(n => {
        if (activeFilter === 'calls') return n.type === 'call';
        if (activeFilter === 'social') return n.type === 'like' || n.type === 'comment' || n.type === 'follow';
        if (activeFilter === 'rewards') return n.type === 'reward' || n.type === 'streak';
        return true;
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const getIcon = (type: NotificationItem['type']) => {
        switch (type) {
            case 'call': return <PhoneCall size={18} color="#34d399" />;
            case 'like': return <Heart size={18} color="#ef4444" fill="#ef4444" />;
            case 'comment': return <MessageCircle size={18} color="#60a5fa" />;
            case 'follow': return <UserPlus size={18} color="#a855f7" />;
            case 'streak': return <Flame size={18} color="#ff6b35" />;
            case 'reward': return <Zap size={18} color="#f5a524" fill="#f5a524" />;
            default: return <Bell size={18} color="#f5a524" />;
        }
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px', paddingBottom: '90px' }}>
            {/* Top Navigation Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            background: 'var(--surface-color)', border: 'none', color: '#fff',
                            width: '38px', height: '38px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-active)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Notifications
                            {unreadCount > 0 && (
                                <span style={{
                                    background: 'var(--primary-gradient)', color: '#fff',
                                    fontSize: '12px', padding: '2px 8px', borderRadius: '12px',
                                    fontWeight: 'bold',
                                }}>
                                    {unreadCount} new
                                </span>
                            )}
                        </h1>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-inactive)' }}>
                            Real-time updates & activity
                        </p>
                    </div>
                </div>

                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            color: 'var(--accent-amber)', fontSize: '12px', padding: '6px 12px',
                            borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                            fontWeight: '600'
                        }}
                    >
                        <CheckCheck size={14} /> Mark all read
                    </button>
                )}
            </div>

            {/* Filter Tabs */}
            <div style={{
                display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '20px',
                paddingBottom: '4px', WebkitOverflowScrolling: 'touch',
            }}>
                {[
                    { id: 'all', label: 'All' },
                    { id: 'calls', label: '📞 Calls' },
                    { id: 'social', label: '❤️ Social' },
                    { id: 'rewards', label: '⚡ Rewards' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveFilter(tab.id as any)}
                        style={{
                            padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold',
                            border: activeFilter === tab.id ? '1px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.1)',
                            background: activeFilter === tab.id ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.05)',
                            color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Notifications List */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-color)' }} />
                </div>
            ) : filteredNotifications.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '60px 20px', background: 'var(--surface-color)',
                    borderRadius: '20px', border: '1px solid var(--border-color)',
                }}>
                    <Bell size={48} color="var(--text-inactive)" style={{ opacity: 0.5, marginBottom: '12px' }} />
                    <h3 style={{ margin: '0 0 6px', color: 'var(--text-active)' }}>No notifications yet</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-inactive)' }}>You're all caught up! Real notifications will appear here.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredNotifications.map(item => (
                        <div
                            key={item.id}
                            onClick={() => handleNotificationClick(item)}
                            style={{
                                display: 'flex', alignItems: 'flex-start', gap: '14px',
                                padding: '14px 16px', borderRadius: '18px',
                                background: item.isRead ? 'rgba(255,255,255,0.03)' : 'rgba(245, 165, 36, 0.08)',
                                border: item.isRead ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(245, 165, 36, 0.3)',
                                cursor: 'pointer', position: 'relative', transition: 'transform 0.15s ease',
                            }}
                        >
                            {/* Avatar or Category Icon */}
                            {item.userAvatar ? (
                                <div style={{ position: 'relative' }}>
                                    <img
                                        src={item.userAvatar}
                                        alt=""
                                        style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                    <div style={{
                                        position: 'absolute', bottom: '-2px', right: '-2px',
                                        background: '#07060d', borderRadius: '50%', padding: '3px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {getIcon(item.type)}
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.08)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>
                                    {getIcon(item.type)}
                                </div>
                            )}

                            {/* Content Text */}
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: 'var(--text-active)' }}>
                                        {item.title}
                                    </h4>
                                    <span style={{ fontSize: '11px', color: 'var(--text-inactive)' }}>{item.timeAgo}</span>
                                </div>
                                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
                                    {item.description}
                                </p>
                            </div>

                            {/* Unread Indicator */}
                            {!item.isRead && (
                                <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: 'var(--primary-color)', flexShrink: 0,
                                    marginTop: '6px', boxShadow: '0 0 8px var(--primary-color)'
                                }} />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Notifications;
