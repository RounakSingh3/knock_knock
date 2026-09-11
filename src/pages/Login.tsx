import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { signUp, signIn, checkUsernameAvailable, fetchCurrentProfile } from '../lib/auth';
import { Sparkles, ArrowRight, Loader2, Check, X, Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES, getUserLanguage, setUserLanguage, getLoginStrings } from '../lib/translation';

const Login = () => {
    const navigate = useNavigate();
    const { setUser } = useContext(AppContext);

    const [isSignUp, setIsSignUp] = useState(true);
    const [loading, setLoading] = useState(false);
    const [language, setLanguage] = useState(getUserLanguage());
    const strings = getLoginStrings(language);
    const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        dob: '',
        gender: '',
        password: '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [globalError, setGlobalError] = useState('');

    // Debounced username check
    const checkUsernameRef = React.useRef<ReturnType<typeof setTimeout>>();

    const checkUsername = async (username: string) => {
        if (!username.trim() || username.length < 3) {
            setUsernameStatus('idle');
            return;
        }

        setUsernameStatus('checking');
        const available = await checkUsernameAvailable(username);
        setUsernameStatus(available ? 'available' : 'taken');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });

        if (errors[name]) {
            setErrors({ ...errors, [name]: '' });
        }
        setGlobalError('');

        // Check username availability with debounce (only when signing up)
        if (isSignUp && name === 'username') {
            setUsernameStatus('idle');
            clearTimeout(checkUsernameRef.current);
            checkUsernameRef.current = setTimeout(() => checkUsername(value), 500);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors: Record<string, string> = {};

        if (!formData.username.trim()) newErrors.username = 'Username is required';
        if (!formData.password.trim()) newErrors.password = 'Password is required';
        if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';

        if (isSignUp) {
            if (!formData.name.trim()) newErrors.name = 'Name is required';
            if (formData.username.length < 3) newErrors.username = 'Username must be at least 3 characters';
            if (!/^[a-zA-Z0-9._]+$/.test(formData.username)) newErrors.username = 'Only letters, numbers, dots and underscores';
            if (!formData.dob) newErrors.dob = 'Date of birth is required';
            if (!formData.gender) newErrors.gender = 'Gender is required';
            if (usernameStatus === 'taken') newErrors.username = 'Username is already taken';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setLoading(true);
        setGlobalError('');

        try {
            if (isSignUp) {
                await signUp({
                    username: formData.username,
                    password: formData.password,
                    name: formData.name,
                    gender: formData.gender,
                    dob: formData.dob,
                });
            } else {
                await signIn(formData.username, formData.password);
            }

            const profile = await fetchCurrentProfile();
            if (!profile) {
                setGlobalError(
                    'Signed in but profile is missing. Run supabase-auth-migration.sql in your Supabase SQL Editor, then try again.'
                );
                setLoading(false);
                return;
            }

            (profile as any).preferred_language = language;
            localStorage.setItem('knock_user_session', JSON.stringify(profile));
            localStorage.setItem('knock_user_lang', language);
            setUser(profile);
            navigate('/call');
        } catch (err: any) {
            console.error('Auth error:', err);
            // Provide user-friendly error messages
            const message = err?.message || 'An unexpected error occurred.';
            if (message.includes('User already registered')) {
                setGlobalError('This username is already taken.');
            } else if (message.includes('Invalid login credentials')) {
                setGlobalError('Invalid username or password.');
            } else if (message.includes('password') && message.includes('schema cache')) {
                setGlobalError(
                    'Database needs an update: open Supabase → SQL Editor, run supabase-auth-migration.sql from the project, then sign up again.'
                );
            } else {
                setGlobalError(message);
            }
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                {/* Language Switcher Pill */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                    }}>
                        <Globe size={14} color="#f5a524" />
                        <select
                            value={language}
                            onChange={(e) => {
                                const val = e.target.value;
                                setLanguage(val);
                                setUserLanguage(val);
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                outline: 'none',
                            }}
                            aria-label="Select Language"
                        >
                            {SUPPORTED_LANGUAGES.map(lang => (
                                <option key={lang.code} value={lang.code} style={{ background: '#1c1c1e', color: '#fff' }}>
                                    {lang.flag} {lang.nativeName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="login-header">
                    <h1 className="app-title text-4xl mb-2 text-center" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, letterSpacing: '-1.5px', background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Knock Knock
                    </h1>
                    <p className="text-gray-400 text-center mb-8 flex justify-center items-center gap-2">
                        {isSignUp ? strings.createAccount : strings.welcomeBack} <Sparkles size={16} className="text-yellow-400" />
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
                    {/* Username field - shared between Sign In and Sign Up */}
                    <div className="form-group">
                        <label>{strings.username} *</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                name="username"
                                placeholder={strings.usernamePlaceholder}
                                value={formData.username}
                                onChange={handleChange}
                                className={errors.username ? 'error-input' : ''}
                                disabled={loading}
                                style={{ paddingRight: '40px' }}
                            />
                            {/* Availability indicator (only on Sign Up) */}
                            {isSignUp && (
                                <div style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                }}>
                                    {usernameStatus === 'checking' && (
                                        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-inactive)' }} />
                                    )}
                                    {usernameStatus === 'available' && (
                                        <Check size={18} style={{ color: '#34C759' }} />
                                    )}
                                    {usernameStatus === 'taken' && (
                                        <X size={18} style={{ color: '#ff3b30' }} />
                                    )}
                                </div>
                            )}
                        </div>
                        {isSignUp && usernameStatus === 'available' && (
                            <span style={{ color: '#34C759', fontSize: '0.8rem' }}>Username is available!</span>
                        )}
                        {isSignUp && usernameStatus === 'taken' && (
                            <span style={{ color: '#ff3b30', fontSize: '0.8rem' }}>Username is already taken</span>
                        )}
                        {errors.username && (!isSignUp || usernameStatus !== 'taken') && (
                            <span className="error-text">{errors.username}</span>
                        )}
                    </div>

                    {/* Sign Up Specific Fields */}
                    {isSignUp && (
                        <>
                            <div className="form-group">
                                <label>{strings.fullName} *</label>
                                <input
                                    type="text"
                                    name="name"
                                    placeholder={strings.fullNamePlaceholder}
                                    value={formData.name}
                                    onChange={handleChange}
                                    className={errors.name ? 'error-input' : ''}
                                    disabled={loading}
                                />
                                {errors.name && <span className="error-text">{errors.name}</span>}
                            </div>

                            <div className="form-group">
                                <label>{strings.dob} *</label>
                                <input
                                    type="date"
                                    name="dob"
                                    value={formData.dob}
                                    onChange={handleChange}
                                    className={errors.dob ? 'error-input' : ''}
                                    disabled={loading}
                                    style={{ colorScheme: 'dark' }}
                                />
                                {errors.dob && <span className="error-text">{errors.dob}</span>}
                            </div>

                            <div className="form-group">
                                <label>{strings.gender} *</label>
                                <select
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleChange}
                                    className={errors.gender ? 'error-input' : ''}
                                    disabled={loading}
                                >
                                    <option value="" disabled>{strings.selectGender}</option>
                                    <option value="male">{strings.male}</option>
                                    <option value="female">{strings.female}</option>
                                    <option value="other">{strings.other}</option>
                                    <option value="prefer_not_to_say">{strings.preferNotToSay}</option>
                                </select>
                                {errors.gender && <span className="error-text">{errors.gender}</span>}
                            </div>

                            <div className="form-group">
                                <label>{strings.preferredLanguage}</label>
                                <select
                                    value={language}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setLanguage(val);
                                        setUserLanguage(val);
                                    }}
                                    disabled={loading}
                                    style={{ colorScheme: 'dark' }}
                                >
                                    {SUPPORTED_LANGUAGES.map(lang => (
                                        <option key={lang.code} value={lang.code}>
                                            {lang.flag} {lang.name} ({lang.nativeName})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}

                    {/* Password Field - shared */}
                    <div className="form-group mb-8">
                        <label>{strings.password} *</label>
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
                        disabled={loading || (isSignUp && usernameStatus === 'taken')}
                        style={{ opacity: (loading || (isSignUp && usernameStatus === 'taken')) ? 0.7 : 1 }}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="mr-2" style={{ animation: 'spin 1s linear infinite' }} />
                                {isSignUp ? `${strings.submitCreate}...` : `${strings.submitSignIn}...`}
                            </>
                        ) : (
                            <>
                                {isSignUp ? strings.submitCreate : strings.submitSignIn} <ArrowRight size={20} className="ml-2" />
                            </>
                        )}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '24px' }}>
                    <button
                        onClick={() => { setIsSignUp(!isSignUp); setErrors({}); setGlobalError(''); setUsernameStatus('idle'); }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-inactive)',
                            cursor: 'pointer',
                            fontSize: '14px',
                        }}
                    >
                        {isSignUp ? (
                            <>{strings.alreadyHaveAccount} <span style={{ color: '#f5a524', fontWeight: 'bold' }}>{strings.signInLink}</span></>
                        ) : (
                            <>{strings.dontHaveAccount} <span style={{ color: '#f5a524', fontWeight: 'bold' }}>{strings.signUpLink}</span></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
