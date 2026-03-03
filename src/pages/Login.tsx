import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';

const Login = () => {
    const navigate = useNavigate();

    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [globalError, setGlobalError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (errors[e.target.name]) {
            setErrors({ ...errors, [e.target.name]: '' });
        }
        setGlobalError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors: Record<string, string> = {};

        if (!formData.email.trim()) newErrors.email = 'Email is required';
        if (!formData.password.trim()) newErrors.password = 'Password is required';
        if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
        if (isSignUp && !formData.name.trim()) newErrors.name = 'Name is required';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setLoading(true);
        setGlobalError('');

        try {
            if (isSignUp) {
                // Sign Up
                const { error } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            name: formData.name,
                        },
                    },
                });

                if (error) {
                    setGlobalError(error.message);
                    setLoading(false);
                    return;
                }

                // Profile is created automatically via the database trigger
                navigate('/home');
            } else {
                // Sign In
                const { error } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.password,
                });

                if (error) {
                    setGlobalError(error.message);
                    setLoading(false);
                    return;
                }

                navigate('/home');
            }
        } catch (err) {
            setGlobalError('An unexpected error occurred. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <h1 className="app-title text-4xl mb-2 text-center" style={{ background: '-webkit-linear-gradient(45deg, #ff3366, #ff9933)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Knock Knock
                    </h1>
                    <p className="text-gray-400 text-center mb-8 flex justify-center items-center gap-2">
                        {isSignUp ? 'Create your account' : 'Welcome back'} <Sparkles size={16} className="text-yellow-400" />
                    </p>
                </div>

                {globalError && (
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
                        {globalError}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="login-form">
                    {isSignUp && (
                        <div className="form-group">
                            <label>Full Name *</label>
                            <input
                                type="text"
                                name="name"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={handleChange}
                                className={errors.name ? 'error-input' : ''}
                                disabled={loading}
                            />
                            {errors.name && <span className="error-text">{errors.name}</span>}
                        </div>
                    )}

                    <div className="form-group">
                        <label>Email Address *</label>
                        <input
                            type="email"
                            name="email"
                            placeholder="you@example.com"
                            value={formData.email}
                            onChange={handleChange}
                            className={errors.email ? 'error-input' : ''}
                            disabled={loading}
                        />
                        {errors.email && <span className="error-text">{errors.email}</span>}
                    </div>

                    <div className="form-group mb-8">
                        <label>Password *</label>
                        <input
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                            className={errors.password ? 'error-input' : ''}
                            disabled={loading}
                        />
                        {errors.password && <span className="error-text">{errors.password}</span>}
                    </div>

                    <button
                        type="submit"
                        className="premium-btn w-full justify-center text-lg py-4 mt-4"
                        disabled={loading}
                        style={{ opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="mr-2" style={{ animation: 'spin 1s linear infinite' }} />
                                {isSignUp ? 'Creating Account...' : 'Signing In...'}
                            </>
                        ) : (
                            <>
                                {isSignUp ? 'Create Account' : 'Sign In'} <ArrowRight size={20} className="ml-2" />
                            </>
                        )}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '24px' }}>
                    <button
                        onClick={() => { setIsSignUp(!isSignUp); setErrors({}); setGlobalError(''); }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#8e8e93',
                            cursor: 'pointer',
                            fontSize: '14px',
                        }}
                    >
                        {isSignUp ? (
                            <>Already have an account? <span style={{ color: '#ff3366', fontWeight: 'bold' }}>Sign In</span></>
                        ) : (
                            <>Don't have an account? <span style={{ color: '#ff3366', fontWeight: 'bold' }}>Sign Up</span></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
