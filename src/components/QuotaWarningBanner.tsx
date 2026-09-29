import React, { useState, useEffect } from 'react';
import { isSupabaseQuotaRestricted, onQuotaStatusChange } from '../lib/fallbackData';
import { AlertCircle, X, ExternalLink, ShieldCheck } from 'lucide-react';

export const QuotaWarningBanner: React.FC = () => {
    const [restricted, setRestricted] = useState(isSupabaseQuotaRestricted());
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        return onQuotaStatusChange((isRestricted) => {
            setRestricted(isRestricted);
        });
    }, []);

    if (!restricted || dismissed) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '72px',
            left: '12px',
            right: '12px',
            maxWidth: '560px',
            margin: '0 auto',
            zIndex: 9999,
            background: 'linear-gradient(135deg, rgba(28, 25, 23, 0.95), rgba(41, 37, 36, 0.95))',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(245, 165, 36, 0.35)',
            borderRadius: '16px',
            padding: '12px 16px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            animation: 'slideUp 0.3s ease-out'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(245, 165, 36, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}>
                    <ShieldCheck size={18} color="#f5a524" />
                </div>
                <div style={{ fontSize: '12.5px', lineHeight: '1.4' }}>
                    <div style={{ fontWeight: 'bold', color: '#f5a524', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Resilient Mode Active</span>
                        <span style={{ fontSize: '10px', background: 'rgba(245, 165, 36, 0.2)', padding: '1px 6px', borderRadius: '8px' }}>Offline Guard</span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11.5px', marginTop: '2px' }}>
                        All posts, videos, and features are fully operational on your device.
                    </div>
                </div>
            </div>

            <button
                onClick={() => setDismissed(true)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.6)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                }}
                aria-label="Dismiss banner"
            >
                <X size={16} />
            </button>
        </div>
    );
};

export default QuotaWarningBanner;
