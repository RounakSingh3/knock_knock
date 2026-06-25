import React, { useState, useEffect } from 'react';
import { Phone, Mic, Sparkles, Users } from 'lucide-react';

const ONBOARDING_KEY = 'kk_onboarding_done';

const steps = [
    {
        icon: <Sparkles size={48} color="#ff6b35" />,
        title: 'Welcome to Knock Knock 👋',
        desc: 'A social app where real connections start with your voice, not your looks.',
        gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)',
    },
    {
        icon: <Phone size={48} color="#34C759" />,
        title: 'Make Friends Through Voice 📞',
        desc: 'Tap "Voice Roulette" to get matched with a random person. Talk, vibe, and if you both click — you become Connections!',
        gradient: 'linear-gradient(135deg, #0f3443, #34e89e20)',
    },
    {
        icon: <Users size={48} color="#f5a524" />,
        title: 'Your Feed, Your Way 🎯',
        desc: '"For You" shows content from everyone. "Connections" shows only your friends. The algorithm learns what you love!',
        gradient: 'linear-gradient(135deg, #2d1b4e, #f5a52420)',
    },
    {
        icon: <Mic size={48} color="#af52de" />,
        title: 'React with Your Voice 🎙️',
        desc: 'See a post you love? Tap the mic icon to record a voice reaction and send it privately to the creator!',
        gradient: 'linear-gradient(135deg, #1a1a2e, #af52de20)',
    },
];

interface OnboardingOverlayProps {
    onComplete: () => void;
}

const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ onComplete }) => {
    const [step, setStep] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const done = localStorage.getItem(ONBOARDING_KEY);
        if (!done) {
            setVisible(true);
        } else {
            onComplete();
        }
    }, [onComplete]);

    if (!visible) return null;

    const handleNext = () => {
        if (step < steps.length - 1) {
            setStep(step + 1);
        } else {
            localStorage.setItem(ONBOARDING_KEY, 'true');
            setVisible(false);
            onComplete();
        }
    };

    const handleSkip = () => {
        localStorage.setItem(ONBOARDING_KEY, 'true');
        setVisible(false);
        onComplete();
    };

    const current = steps[step];

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: current.gradient, zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '32px',
            transition: 'background 0.5s ease',
        }}>
            {/* Skip */}
            <button
                onClick={handleSkip}
                style={{
                    position: 'absolute', top: '16px', right: '20px',
                    background: 'none', border: 'none', color: 'var(--text-inactive)',
                    fontSize: '15px', cursor: 'pointer',
                }}
            >
                Skip
            </button>

            {/* Icon */}
            <div style={{
                width: '100px', height: '100px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', marginBottom: '32px',
                animation: 'fadeInScale 0.5s ease-out',
            }}>
                {current.icon}
            </div>

            {/* Title */}
            <h1 style={{
                color: 'var(--text-active)', fontSize: '26px', fontWeight: 'bold',
                textAlign: 'center', marginBottom: '16px',
                animation: 'fadeInUp 0.5s ease-out',
            }}>
                {current.title}
            </h1>

            {/* Description */}
            <p style={{
                color: '#b0b0b0', fontSize: '16px', textAlign: 'center',
                maxWidth: '320px', lineHeight: '1.6', marginBottom: '48px',
                animation: 'fadeInUp 0.6s ease-out',
            }}>
                {current.desc}
            </p>

            {/* Dots */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
                {steps.map((_, i) => (
                    <div key={i} style={{
                        width: i === step ? '24px' : '8px', height: '8px',
                        borderRadius: '4px', transition: 'all 0.3s',
                        background: i === step ? '#f5a524' : '#3a3a3c',
                    }} />
                ))}
            </div>

            {/* Next / Get Started */}
            <button
                onClick={handleNext}
                style={{
                    background: 'linear-gradient(45deg, #f5a524, #ff6b35)',
                    border: 'none', borderRadius: '30px',
                    padding: '16px 48px', color: 'var(--text-active)',
                    fontWeight: 'bold', fontSize: '17px', cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(245, 165, 36,0.4)',
                }}
            >
                {step === steps.length - 1 ? "Let's Go! 🚀" : 'Next'}
            </button>

            <style>{`
                @keyframes fadeInScale {
                    from { opacity: 0; transform: scale(0.8); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default OnboardingOverlay;
