import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, X, Video } from 'lucide-react';
import { AppContext } from '../App';
import { supabase } from '../lib/supabase';
import { fetchProfilesByIds, type ProfileData } from '../lib/database';

interface IncomingCall {
    callerId: string;
    callerProfile: ProfileData | null;
    type: 'audio' | 'video';
    room: string;
}

const GlobalCallListener: React.FC = () => {
    const { user } = useContext(AppContext);
    const navigate = useNavigate();
    const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
    const channelRef = React.useRef<any>(null);

    useEffect(() => {
        if (!user) return;

        const channel = supabase.channel('direct-calls');
        channelRef.current = channel;

        channel.on('broadcast', { event: 'call-invite' }, async (payload) => {
            const { callerId, receiverId, type, room } = payload.payload;
            if (receiverId === user.id) {
                // Fetch caller profile
                const profiles = await fetchProfilesByIds([callerId]);
                const callerProfile = profiles.length > 0 ? profiles[0] : null;
                
                setIncomingCall({ callerId, callerProfile, type: type || 'audio', room });

                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(`Incoming call from ${callerProfile?.username || 'Someone'}`, {
                        body: 'Click to open Knock Knock',
                        icon: callerProfile?.avatar_url || '/logo192.png',
                    });
                }
            }
        });

        channel.on('broadcast', { event: 'call-cancel' }, (payload) => {
            const { callerId, receiverId } = payload.payload;
            if (receiverId === user.id) {
                setIncomingCall(null);
            }
        });

        channel.subscribe();

        // Listen for new messages globally for native notifications
        const messageChannel = supabase.channel(`global-messages-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `receiver_id=eq.${user.id}`
                },
                async (payload) => {
                    const newMsg = payload.new as any;
                    
                    if ('Notification' in window && Notification.permission === 'granted') {
                        // Optionally fetch sender profile for the icon
                        const senderProfiles = await fetchProfilesByIds([newMsg.sender_id]);
                        const sender = senderProfiles[0];
                        
                        let bodyText = newMsg.content;
                        if (bodyText.startsWith('[SHARE_POST]')) bodyText = 'Shared a post with you';
                        if (bodyText.startsWith('[VOICE_REACTION]')) bodyText = 'Sent a voice reaction 🎙️';

                        new Notification(`New message from ${sender?.username || 'Someone'}`, {
                            body: bodyText,
                            icon: sender?.avatar_url || '/logo192.png',
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(messageChannel);
        };
    }, [user]);

    const handleAccept = () => {
        if (!incomingCall || !channelRef.current) return;
        
        // Notify caller we accepted
        channelRef.current.send({
            type: 'broadcast',
            event: 'call-accept',
            payload: {
                callerId: incomingCall.callerId,
                receiverId: user?.id,
                room: incomingCall.room
            }
        });

        const route = `/call?direct=true&partnerId=${incomingCall.callerId}&role=answerer&room=${incomingCall.room}`;
        setIncomingCall(null);
        navigate(route);
    };

    const handleDecline = () => {
        if (!incomingCall || !channelRef.current) return;

        channelRef.current.send({
            type: 'broadcast',
            event: 'call-decline',
            payload: {
                callerId: incomingCall.callerId,
                receiverId: user?.id
            }
        });

        setIncomingCall(null);
    };

    if (!incomingCall) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
            zIndex: 99999, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <div style={{
                background: 'var(--surface-color)', padding: '40px', borderRadius: '24px',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)', width: '80%', maxWidth: '320px',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <img 
                    src={incomingCall.callerProfile?.avatar_url || 'https://i.pravatar.cc/150'} 
                    alt="Caller" 
                    style={{
                        width: '100px', height: '100px', borderRadius: '50%',
                        objectFit: 'cover', marginBottom: '20px',
                        border: '3px solid #ff3366', padding: '3px',
                        animation: 'pulseRing 2s infinite'
                    }}
                />
                
                <h2 style={{ color: 'var(--text-active)', margin: '0 0 8px 0', fontSize: '22px', fontWeight: 'bold' }}>
                    {incomingCall.callerProfile?.username || 'Someone'}
                </h2>
                <p style={{ color: 'var(--text-inactive)', margin: '0 0 32px 0', fontSize: '15px' }}>
                    is calling you...
                </p>

                <div style={{ display: 'flex', gap: '24px' }}>
                    <button 
                        onClick={handleDecline}
                        style={{
                            width: '60px', height: '60px', borderRadius: '50%',
                            background: '#FF3B30', border: 'none', color: 'var(--text-active)',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            cursor: 'pointer', boxShadow: '0 4px 12px rgba(255, 59, 48, 0.4)'
                        }}
                    >
                        <X size={28} />
                    </button>

                    <button 
                        onClick={handleAccept}
                        style={{
                            width: '60px', height: '60px', borderRadius: '50%',
                            background: '#34C759', border: 'none', color: 'var(--text-active)',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            cursor: 'pointer', boxShadow: '0 4px 12px rgba(52, 199, 89, 0.4)',
                            animation: 'bounce 2s infinite'
                        }}
                    >
                        {incomingCall.type === 'video' ? <Video size={28} /> : <Phone size={28} />}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes pulseRing {
                    0% { box-shadow: 0 0 0 0 rgba(255, 51, 102, 0.4); }
                    70% { box-shadow: 0 0 0 20px rgba(255, 51, 102, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 51, 102, 0); }
                }
                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-10px); }
                    60% { transform: translateY(-5px); }
                }
            `}</style>
        </div>
    );
};

export default GlobalCallListener;
