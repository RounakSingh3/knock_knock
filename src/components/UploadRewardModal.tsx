import React, { useEffect, useState } from 'react';
import { Sparkles, Trophy, Zap, ArrowRight } from 'lucide-react';

interface UploadRewardModalProps {
    isOpen: boolean;
    pointsAwarded: number;
    newTotalPoints: number;
    uploadType?: 'post' | 'knockup' | 'video';
    onClose: () => void;
}

export const UploadRewardModal: React.FC<UploadRewardModalProps> = ({
    isOpen,
    pointsAwarded,
    newTotalPoints,
    uploadType = 'post',
    onClose,
}) => {
    const [animateIn, setAnimateIn] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => setAnimateIn(true), 50);
            return () => clearTimeout(timer);
        } else {
            setAnimateIn(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const titleText = uploadType === 'knockup' 
        ? '24h KnockUp Published!' 
        : uploadType === 'video'
        ? 'Video Uploaded!'
        : 'Post Published!';

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(14px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.25s ease-out'
        }}>
            <div style={{
                background: 'linear-gradient(145deg, #1c1917 0%, #0c0a09 100%)',
                border: '1px solid rgba(245, 165, 36, 0.4)',
                borderRadius: '28px',
                padding: '32px 24px',
                maxWidth: '380px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 25px 60px -15px rgba(245, 165, 36, 0.35), 0 0 40px rgba(0, 0, 0, 0.8)',
                transform: animateIn ? 'scale(1)' : 'scale(0.85)',
                opacity: animateIn ? 1 : 0,
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Floating Glow */}
                <div style={{
                    position: 'absolute',
                    top: '-50px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '260px',
                    height: '260px',
                    background: 'radial-gradient(circle, rgba(245, 165, 36, 0.25) 0%, transparent 70%)',
                    pointerEvents: 'none',
                    zIndex: 0
                }} />

                {/* Trophy Badge */}
                <div style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f5a524 0%, #ff6b35 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px',
                    boxShadow: '0 0 35px rgba(245, 165, 36, 0.6), 0 4px 15px rgba(0,0,0,0.4)',
                    border: '3px solid rgba(255, 255, 255, 0.3)',
                    position: 'relative',
                    zIndex: 1
                }}>
                    <Trophy size={42} color="#000" strokeWidth={2.4} />
                    <div style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        background: '#fff',
                        borderRadius: '50%',
                        padding: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}>
                        <Sparkles size={16} color="#f5a524" fill="#f5a524" />
                    </div>
                </div>

                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(245, 165, 36, 0.15)',
                        border: '1px solid rgba(245, 165, 36, 0.4)',
                        color: '#f5a524',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        marginBottom: '10px'
                    }}>
                        <Sparkles size={13} fill="#f5a524" />
                        <span>Congratulations!</span>
                    </div>

                    <h2 style={{
                        margin: '0 0 8px',
                        fontSize: '22px',
                        fontWeight: 800,
                        color: '#fff',
                        letterSpacing: '-0.5px'
                    }}>
                        {titleText}
                    </h2>

                    <p style={{
                        margin: '0 0 24px',
                        fontSize: '14px',
                        color: 'rgba(255, 255, 255, 0.7)',
                        lineHeight: 1.45
                    }}>
                        You earned a reward for uploading content on Knock Knock!
                    </p>

                    {/* Points Gain Pill */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(245, 165, 36, 0.2) 0%, rgba(255, 107, 53, 0.15) 100%)',
                        border: '1px solid rgba(245, 165, 36, 0.5)',
                        borderRadius: '20px',
                        padding: '16px',
                        marginBottom: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-around'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Earned
                            </span>
                            <span style={{ fontSize: '26px', fontWeight: 900, color: '#f5a524', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                +{pointsAwarded} <Zap size={20} fill="#f5a524" />
                            </span>
                        </div>

                        <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.1)' }} />

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Total Points
                            </span>
                            <span style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>
                                {newTotalPoints >= 99999999 ? '∞ Royalty' : newTotalPoints.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={onClose}
                        style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #f5a524 0%, #ff6b35 100%)',
                            border: 'none',
                            borderRadius: '16px',
                            padding: '14px 20px',
                            color: '#000',
                            fontWeight: 800,
                            fontSize: '15px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            boxShadow: '0 8px 25px rgba(245, 165, 36, 0.45)',
                            transition: 'transform 0.15s ease'
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <span>Awesome! Keep Going</span>
                        <ArrowRight size={18} strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UploadRewardModal;
