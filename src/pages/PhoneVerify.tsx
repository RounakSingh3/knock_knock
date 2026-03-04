import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Sparkles, ArrowLeft, Phone, Shield, Loader2 } from 'lucide-react';

const PhoneVerify = () => {
    const navigate = useNavigate();

    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(0);

    // Countdown timer for resend
    React.useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const sendOtp = async () => {
        if (!phone.trim()) {
            setError('Phone number is required');
            return;
        }

        // Ensure phone has country code
        const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

        setLoading(true);
        setError('');

        try {
            const { error: otpError } = await supabase.auth.signInWithOtp({
                phone: formattedPhone,
            });

            if (otpError) {
                setError(otpError.message);
                setLoading(false);
                return;
            }

            setStep('otp');
            setCountdown(60);
        } catch (err) {
            setError('Failed to send OTP. Please try again.');
        }
        setLoading(false);
    };

    const verifyOtp = async () => {
        if (!otp.trim() || otp.length < 6) {
            setError('Please enter the 6-digit OTP');
            return;
        }

        const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

        setLoading(true);
        setError('');

        try {
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                phone: formattedPhone,
                token: otp,
                type: 'sms',
            });

            if (verifyError) {
                setError(verifyError.message);
                setLoading(false);
                return;
            }

            // If verified, update profile with data from step 1
            if (data.user) {
                const profileData = sessionStorage.getItem('signup_profile');
                if (profileData) {
                    const profile = JSON.parse(profileData);
                    await supabase.from('profiles').upsert({
                        id: data.user.id,
                        name: profile.name,
                        gender: profile.gender,
                        dob: profile.dob,
                        email: profile.email || null,
                        avatar_url: `https://i.pravatar.cc/150?u=${data.user.id}`,
                    });
                    sessionStorage.removeItem('signup_profile');
                }
            }

            navigate('/home');
        } catch (err) {
            setError('Verification failed. Please try again.');
        }
        setLoading(false);
    };

    const resendOtp = async () => {
        if (countdown > 0) return;
        await sendOtp();
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <h1 className="app-title text-4xl mb-2 text-center" style={{ background: '-webkit-linear-gradient(45deg, #ff3366, #ff9933)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Knock Knock
                    </h1>
                    <p className="text-gray-400 text-center mb-8 flex justify-center items-center gap-2">
                        Verify your phone number <Shield size={16} className="text-yellow-400" />
                    </p>
                </div>

                {/* Step indicator */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '28px' }}>
                    <div style={{ width: '40px', height: '4px', borderRadius: '4px', background: 'var(--primary-color)', opacity: 0.5 }} />
                    <div style={{ width: '40px', height: '4px', borderRadius: '4px', background: 'var(--primary-color)' }} />
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(255, 59, 48, 0.15)',
                        border: '1px solid rgba(255, 59, 48, 0.3)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        marginBottom: '20px',
                        color: '#ff3b30',
                        fontSize: '14px',
                        textAlign: 'center',
                    }}>
                        {error}
                    </div>
                )}

                {step === 'phone' ? (
                    <div className="login-form">
                        {/* Phone icon */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                background: 'rgba(255, 51, 102, 0.1)',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                color: 'var(--primary-color)',
                            }}>
                                <Phone size={36} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Phone Number *</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '14px 12px',
                                    color: 'white',
                                    fontSize: '1rem',
                                    minWidth: '65px',
                                    textAlign: 'center',
                                }}>
                                    +91
                                </div>
                                <input
                                    type="tel"
                                    placeholder="9876543210"
                                    value={phone}
                                    onChange={(e) => { setPhone(e.target.value); setError(''); }}
                                    disabled={loading}
                                    maxLength={10}
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>

                        <button
                            className="premium-btn w-full justify-center text-lg py-4 mt-4"
                            onClick={sendOtp}
                            disabled={loading}
                            style={{ opacity: loading ? 0.7 : 1 }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="mr-2" style={{ animation: 'spin 1s linear infinite' }} />
                                    Sending OTP...
                                </>
                            ) : (
                                'Send OTP'
                            )}
                        </button>

                        <button
                            onClick={() => navigate('/login')}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#8e8e93',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                width: '100%',
                                marginTop: '20px',
                            }}
                        >
                            <ArrowLeft size={16} /> Back to profile
                        </button>
                    </div>
                ) : (
                    <div className="login-form">
                        {/* OTP icon */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                background: 'rgba(52, 199, 89, 0.1)',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                color: '#34C759',
                            }}>
                                <Shield size={36} />
                            </div>
                        </div>

                        <p style={{ textAlign: 'center', color: '#8e8e93', marginBottom: '24px', fontSize: '14px' }}>
                            We sent a 6-digit code to<br />
                            <span style={{ color: 'white', fontWeight: 'bold' }}>
                                +91{phone.replace(/^\+91/, '')}
                            </span>
                        </p>

                        <div className="form-group">
                            <label>Enter OTP *</label>
                            <input
                                type="text"
                                placeholder="000000"
                                value={otp}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                    setOtp(val);
                                    setError('');
                                }}
                                disabled={loading}
                                maxLength={6}
                                style={{
                                    textAlign: 'center',
                                    fontSize: '1.5rem',
                                    letterSpacing: '12px',
                                    fontWeight: 'bold',
                                }}
                            />
                        </div>

                        <button
                            className="premium-btn w-full justify-center text-lg py-4 mt-4"
                            onClick={verifyOtp}
                            disabled={loading}
                            style={{ opacity: loading ? 0.7 : 1 }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="mr-2" style={{ animation: 'spin 1s linear infinite' }} />
                                    Verifying...
                                </>
                            ) : (
                                'Verify & Continue'
                            )}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '20px' }}>
                            {countdown > 0 ? (
                                <span style={{ color: '#8e8e93', fontSize: '14px' }}>
                                    Resend OTP in <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>{countdown}s</span>
                                </span>
                            ) : (
                                <button
                                    onClick={resendOtp}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--primary-color)',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                    }}
                                >
                                    Resend OTP
                                </button>
                            )}
                        </div>

                        <button
                            onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#8e8e93',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                width: '100%',
                                marginTop: '12px',
                            }}
                        >
                            <ArrowLeft size={16} /> Change number
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PhoneVerify;
