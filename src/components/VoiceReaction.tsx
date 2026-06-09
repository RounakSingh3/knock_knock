import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { uploadVoiceReaction, sendMessage, trackEngagement } from '../lib/database';

interface VoiceReactionProps {
    postId: string;
    postCategory?: string;
    currentUserId: string;
    postOwnerId: string;
}

const VoiceReaction: React.FC<VoiceReactionProps> = ({ postId, postCategory, currentUserId, postOwnerId }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isSending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                
                setSending(true);
                try {
                    const audioUrl = await uploadVoiceReaction(audioBlob, currentUserId);
                    const content = `[VOICE_REACTION] ${audioUrl}`;
                    await sendMessage(currentUserId, postOwnerId, content);
                    await trackEngagement(currentUserId, postId, 'voice_react', 1, postCategory || 'General');
                    setSent(true);
                    setTimeout(() => setSent(false), 3000);
                } catch (err) {
                    console.error('Failed to send voice reaction:', err);
                }
                setSending(false);
            };

            recorder.start();
            setIsRecording(true);

            // Auto-stop after 5 seconds
            setTimeout(() => {
                if (recorder.state === 'recording') {
                    recorder.stop();
                    setIsRecording(false);
                }
            }, 5000);
        } catch (err) {
            console.error('Mic access denied:', err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    if (sent) {
        return (
            <button className="masonry-like-btn" style={{ background: 'rgba(52,199,89,0.9)', cursor: 'default' }}>
                <span style={{ fontSize: '12px' }}>✓</span>
            </button>
        );
    }

    if (isSending) {
        return (
            <button className="masonry-like-btn" style={{ cursor: 'default' }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} color="var(--text-active)" />
            </button>
        );
    }

    return (
        <button
            className="masonry-like-btn"
            onClick={(e) => {
                e.stopPropagation();
                if (isRecording) stopRecording();
                else startRecording();
            }}
            style={{
                background: isRecording ? 'rgba(255,51,102,0.95)' : undefined,
                animation: isRecording ? 'pulse 1s ease-in-out infinite' : undefined,
            }}
        >
            {isRecording ? <Square size={14} color="var(--text-active)" /> : <Mic size={16} color="var(--text-active)" />}
        </button>
    );
};

export default VoiceReaction;
