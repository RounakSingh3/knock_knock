import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { ArrowLeft, Bell, PhoneCall, Heart, MessageCircle, UserPlus, Zap, Check, CheckCheck, Sparkles, Flame } from 'lucide-react';
import { fetchUserLikes, fetchUserEngagements, fetchFollowers } from '../lib/database';

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

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
    {
        id: 'notif-1',
        type: 'call',
        title: 'Incoming Direct Call',
        description: 'Priya Sharma requested a voice call with you.',
        userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        username: 'priya_sharma',
        timeAgo: '5m ago',
        isRead: false,
        targetUrl: '/call?user=priya_sharma'
    },
    {
        id: 'notif-2',
        type: 'reward',
        title: 'Daily Streak Bonus!',
        description: 'You earned +50 points for maintaining a 3-day story streak 🔥',
        timeAgo: '25m ago',
        isRead: false,
        targetUrl: '/profile'
    },
    {
        id: 'notif-3',
        type: 'like',
        title: 'New Like on your Post',
        description: 'alex_dev liked your latest post: "Midnight vibes 🌙"',
        userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        username: 'alex_dev',
        timeAgo: '1h ago',
        isRead: false,
        targetUrl: '/home'
    },
    {
        id: 'notif-4',
        type: 'follow',
        title: 'New Connection Request',
        description: 'sara_vibe started following you on Knock Knock.',
        userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        username: 'sara_vibe',
        timeAgo: '2h ago',
        isRead: true,
        targetUrl: '/profile/sara_vibe'
    },
    {
        id: 'notif-5',
        type: 'comment',
        title: 'New Comment',
        description: 'rahul_m commented: "Awesome music selection! 🔥"',
        userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
        username: 'rahul_m',
        timeAgo: '4h ago',
        isRead: true,
        targetUrl: '/home'
    },
    {
        id: 'notif-6',
        type: 'reward',
        title: 'App Activity Award',
        description: 'You received 10 bonus points for active engagement today ⚡',
        timeAgo: '6h ago',
        isRead: true,
        targetUrl: '/boost'
    }
];

export const Notifications: React.FC = () => {
    const { user, points } = useContext(AppContext);
    const navigate = useNavigate();

    const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
        const saved = localStorage.getItem('knock_notifications');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return INITIAL_NOTIFICATIONS;
    });

    const [activeFilter, setActiveFilter] = useState<'all' | 'calls' | 'social' | 'rewards'>('all');

    useEffect(() => {
        localStorage.setItem('knock_notifications', JSON.stringify(notifications));
    }, [notifications]);

    const markAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
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
                            Stay updated with calls, likes & activity
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
            {filteredNotifications.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '60px 20px', background: 'var(--surface-color)',
                    borderRadius: '20px', border: '1px solid var(--border-color)',
                }}>
                    <Bell size={48} color="var(--text-inactive)" style={{ opacity: 0.5, marginBottom: '12px' }} />
                    <h3 style={{ margin: '0 0 6px', color: 'var(--text-active)' }}>No notifications here</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-inactive)' }}>You're all caught up!</p>
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

                            {/* Unread Red Dot */}
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
