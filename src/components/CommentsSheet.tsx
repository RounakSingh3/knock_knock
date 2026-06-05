import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Mic, Square, Loader2, Trash2 } from 'lucide-react';
import { fetchComments, addComment, deleteComment, uploadVoiceReaction, type CommentData } from '../lib/database';

interface CommentsSheetProps {
    isOpen: boolean;
    onClose: () => void;
    postId: string;
    currentUser: { id: string; username: string; avatar_url?: string };
}

const CommentsSheet: React.FC<CommentsSheetProps> = ({ isOpen, onClose, postId, currentUser }) => {
    const [comments, setComments] = useState<CommentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && postId) {
            setLoading(true);
            fetchComments(postId).then(data => {
                setComments(data);
                setLoading(false);
            });
        }
    }, [isOpen, postId]);

    if (!isOpen) return null;

    const timeAgo = (dateStr: string) => {
        const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
        if (diff < 60) return 'now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return `${Math.floor(diff / 86400)}d`;
    };

    const handleSendText = async () => {
        if (!text.trim() || sending) return;
        setSending(true);
        const { error } = await addComment(
            postId, currentUser.id, currentUser.username,
            currentUser.avatar_url || 'https://i.pravatar.cc/150', text.trim()
        );
        if (!error) {
            setText('');
            const updated = await fetchComments(postId);
            setComments(updated);
        } else {
            alert('Failed to upload comment: ' + (error.message || 'Unknown error'));
        }
        setSending(false);
    };

    const startVoiceComment = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];
            setRecordingTime(0);

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                if (timerRef.current) clearInterval(timerRef.current);
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setSending(true);
                try {
                    const voiceUrl = await uploadVoiceReaction(blob, currentUser.id);
                    const { error } = await addComment(
                        postId, currentUser.id, currentUser.username,
                        currentUser.avatar_url || 'https://i.pravatar.cc/150',
                        '🎙️ Voice comment', true, voiceUrl
                    );
                    if (error) throw new Error(error.message);
                    const updated = await fetchComments(postId);
                    setComments(updated);
                } catch (err: any) {
                    console.error('Voice comment failed:', err);
                    alert('Failed to upload voice comment: ' + (err.message || 'Unknown error'));
                }
                setSending(false);
            };

            recorder.start();
            setIsRecording(true);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= 4) {
                        recorder.stop();
                        setIsRecording(false);
                        return 0;
                    }
                    return prev + 1;
                });
            }, 1000);
        } catch (err) {
            console.error('Mic denied:', err);
        }
    };

    const stopVoiceComment = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const handleDelete = async (commentId: string) => {
        await deleteComment(commentId);
        setComments(prev => prev.filter(c => c.id !== commentId));
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.7)', zIndex: 10000,
            display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
        }} onClick={onClose}>
            <div style={{
                background: '#1c1c1e', width: '100%', maxWidth: '500px',
                borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                display: 'flex', flexDirection: 'column', maxHeight: '70vh',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 20px', borderBottom: '1px solid #2c2c2e',
                }}>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '17px', fontWeight: 'bold' }}>
                        Comments {comments.length > 0 && <span style={{ color: '#8e8e93', fontWeight: 'normal' }}>({comments.length})</span>}
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer' }}>
                        <X size={22} />
                    </button>
                </div>

                {/* Comments List */}
                <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: '#8e8e93' }}>
                            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : comments.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: '#8e8e93' }}>
                            No comments yet. Be the first! 💬
                        </div>
                    ) : (
                        comments.map(comment => (
                            <div key={comment.id} style={{
                                display: 'flex', gap: '12px', padding: '12px 0',
                                borderBottom: '1px solid rgba(44,44,46,0.5)',
                            }}>
                                <img
                                    src={comment.avatar_url || 'https://i.pravatar.cc/150'}
                                    alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>{comment.username}</span>
                                        <span style={{ color: '#8e8e93', fontSize: '12px' }}>{timeAgo(comment.created_at)}</span>
                                    </div>
                                    {comment.is_voice && comment.voice_url ? (
                                        <audio
                                            controls src={comment.voice_url}
                                            style={{
                                                width: '100%', height: '32px', marginTop: '6px',
                                                borderRadius: '16px', filter: 'invert(1) hue-rotate(180deg)',
                                            }}
                                        />
                                    ) : (
                                        <p style={{ color: '#e0e0e0', fontSize: '14px', margin: '4px 0 0', lineHeight: '1.4' }}>
                                            {comment.content}
                                        </p>
                                    )}
                                </div>
                                {comment.user_id === currentUser.id && (
                                    <button
                                        onClick={() => handleDelete(comment.id)}
                                        style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', padding: '4px', alignSelf: 'flex-start' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Input Bar */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '12px 16px', borderTop: '1px solid #2c2c2e', background: '#121212',
                }}>
                    <img
                        src={currentUser.avatar_url || 'https://i.pravatar.cc/150'}
                        alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <input
                        type="text" value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendText()}
                        placeholder="Add a comment..."
                        style={{
                            flex: 1, background: '#2c2c2e', border: 'none', borderRadius: '20px',
                            padding: '10px 16px', color: '#fff', fontSize: '14px', outline: 'none',
                        }}
                    />
                    {/* Voice comment button */}
                    <button
                        onClick={isRecording ? stopVoiceComment : startVoiceComment}
                        disabled={sending}
                        style={{
                            background: isRecording ? '#ff3366' : '#2c2c2e',
                            border: 'none', borderRadius: '50%', width: '38px', height: '38px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'all 0.2s',
                            animation: isRecording ? 'pulse 1s ease-in-out infinite' : 'none',
                        }}
                    >
                        {isRecording ? <Square size={16} color="#fff" /> : <Mic size={18} color="#fff" />}
                    </button>
                    {isRecording && (
                        <span style={{ color: '#ff3366', fontSize: '13px', fontWeight: 'bold', minWidth: '24px' }}>
                            {recordingTime}s
                        </span>
                    )}
                    {/* Send text button */}
                    {text.trim() && (
                        <button
                            onClick={handleSendText}
                            disabled={sending}
                            style={{
                                background: '#ff3366', border: 'none', borderRadius: '50%',
                                width: '38px', height: '38px', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            }}
                        >
                            {sending ? <Loader2 size={16} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} color="#fff" />}
                        </button>
                    )}
                </div>
            </div>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default CommentsSheet;
