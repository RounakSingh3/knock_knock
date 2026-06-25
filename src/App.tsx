import React, { createContext, useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { fetchProfile, updatePoints, setUserOnlineStatus, fetchBlockedIds, type ProfileData } from './lib/database';
import { onAuthStateChange, signOut as authSignOut, fetchCurrentProfile, getSession } from './lib/auth';
import BottomNav from './components/BottomNav';
import OnboardingOverlay from './components/OnboardingOverlay';
import GlobalCallListener from './components/GlobalCallListener';

// ⚡ Lazy-load pages so only the page you visit is downloaded (huge speed boost).
// Login is loaded eagerly because it's the first thing unauthenticated users see.
import Login from './pages/Login';
const Home = lazy(() => import('./pages/Home'));
const Stories = lazy(() => import('./pages/Stories'));
const Explore = lazy(() => import('./pages/Explore'));
const Connections = lazy(() => import('./pages/Connections'));
const Boost = lazy(() => import('./pages/Boost'));
const Reels = lazy(() => import('./pages/Reels'));
const VoiceCall = lazy(() => import('./pages/VoiceCall'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const CreatePost = lazy(() => import('./pages/CreatePost'));

// Compact loading spinner shown while a lazy page chunk downloads
const PageLoader: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
    <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="text-center">
            <h1 className="app-title text-4xl mb-2" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, letterSpacing: '-1.5px', background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Knock Knock
            </h1>
            <p style={{ color: 'var(--text-inactive)', marginTop: '1rem' }}>{message}</p>
        </div>
    </div>
);

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    if (error.name === 'ChunkLoadError' || (error.message && error.message.includes('fetch dynamically imported module'))) {
      if (!sessionStorage.getItem('chunk_reloaded')) {
        sessionStorage.setItem('chunk_reloaded', 'true');
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-active)', background: 'var(--bg-color)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h2 style={{ marginBottom: '16px' }}>Oops, something went wrong.</h2>
            <p style={{ color: 'var(--text-inactive)', marginBottom: '24px' }}>The app encountered an error. This usually happens after an update.</p>
            <button 
                onClick={() => { sessionStorage.removeItem('chunk_reloaded'); window.location.reload(); }} 
                style={{ padding: '12px 24px', background: 'linear-gradient(45deg, #f5a524, #ff6b35)', color: '#fff', borderRadius: '24px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
            >
                Reload App
            </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Global Context for Points & Auth
interface AppContextType {
    points: number;
    setPoints: React.Dispatch<React.SetStateAction<number>>;
    user: ProfileData | null;
    setUser: React.Dispatch<React.SetStateAction<ProfileData | null>>;
    blockedIds: string[];
    setBlockedIds: React.Dispatch<React.SetStateAction<string[]>>;
    isAuthenticated: boolean;
    signOut: () => void;
}

export const AppContext = createContext<AppContextType>({
    points: 0,
    setPoints: () => { },
    user: null,
    setUser: () => { },
    blockedIds: [],
    setBlockedIds: () => { },
    isAuthenticated: false,
    signOut: () => { },
});

// We need to track total app time in milliseconds
const POINTS_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function App() {
    const [points, setPoints] = useState(0);
    const [user, setUser] = useState<ProfileData | null>(null);
    const [blockedIds, setBlockedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [onboardingDone, setOnboardingDone] = useState(false);

    const isAuthenticated = !!user;

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then((registration) => {
                console.log('Service Worker registered with scope:', registration.scope);
            }).catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
        }

        if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }, []);

    // Restore Supabase Auth session + profile
    useEffect(() => {
        let mounted = true;

        const loadSession = async () => {
            try {
                const session = await getSession();
                if (session?.user) {
                    const profile = await fetchCurrentProfile();
                    if (profile && mounted) {
                        setUser(profile);
                        setPoints(profile.points || 0);
                        localStorage.setItem('knock_user_session', JSON.stringify(profile));
                        
                        const bIds = await fetchBlockedIds(profile.id);
                        if (mounted) setBlockedIds(bIds);

                        setLoading(false);
                        return;
                    }
                }
            } catch (e) {
                console.error('Failed to restore session', e);
            }

            // If no valid session exists, clear local storage and remain logged out
            localStorage.removeItem('knock_user_session');
            if (mounted) setLoading(false);
        };

        loadSession();

        const subscription = onAuthStateChange(async (userId) => {
            if (!mounted) return;
            if (userId) {
                const profile = await fetchCurrentProfile();
                if (profile) {
                    setUser(profile);
                    setPoints(profile.points || 0);
                    localStorage.setItem('knock_user_session', JSON.stringify(profile));
                    const bIds = await fetchBlockedIds(profile.id);
                    if (mounted) setBlockedIds(bIds);
                }
            } else {
                setUser(null);
                setPoints(0);
                setBlockedIds([]);
                localStorage.removeItem('knock_user_session');
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // Also fetch fresh profile data to keep points updated
    useEffect(() => {
        if (user && user.id) {
            fetchProfile(user.id).then(profile => {
                if (profile) {
                    setPoints(profile.points);
                    // Update the session quietly so it's fresh for next load
                    localStorage.setItem('knock_user_session', JSON.stringify({ ...user, ...profile }));
                }
            }).catch(err => {
                console.error('Failed to fetch profile:', err);
            });
        }
    }, [user?.id]);

    // Track time spent in app & award points
    useEffect(() => {
        if (!user) return;

        const interval = setInterval(() => {
            setPoints(prev => {
                const newPoints = prev + 10;
                // Persist to database
                updatePoints(user.id, newPoints);
                return newPoints;
            });
        }, POINTS_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [user]);

    // Sync points to database whenever they change (debounced)
    useEffect(() => {
        if (!user || points === 0) return;

        const timeout = setTimeout(() => {
            updatePoints(user.id, points);
        }, 1000);

        return () => clearTimeout(timeout);
    }, [points, user]);

    // Track Online Status
    useEffect(() => {
        if (!user || !user.id) return;

        const currentUserId = user.id;
        setUserOnlineStatus(currentUserId, true);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                setUserOnlineStatus(currentUserId, true);
            } else {
                setUserOnlineStatus(currentUserId, false);
            }
        };

        const handleBeforeUnload = () => {
            setUserOnlineStatus(currentUserId, false);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            setUserOnlineStatus(currentUserId, false);
        };
    }, [user?.id]);

    const signOut = async () => {
        try {
            await authSignOut();
        } catch (e) {
            console.error('Sign out error:', e);
        }
        localStorage.removeItem('knock_user_session');
        setUser(null);
        setPoints(0);
    };

    if (loading) {
        return (
            <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div className="text-center">
                    <h1 className="app-title text-4xl mb-2" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, letterSpacing: '-1.5px', background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Knock Knock
                    </h1>
                    <p style={{ color: 'var(--text-inactive)', marginTop: '1rem' }}>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <AppContext.Provider value={{ points, setPoints, user, setUser, blockedIds, setBlockedIds, isAuthenticated, signOut }}>
            <Router>
                <div className="app-container">
                    <ErrorBoundary>
                    <Routes>
                        {!isAuthenticated ? (
                            <>
                                <Route path="*" element={<Navigate to="/login" />} />
                                <Route path="/login" element={<Login />} />
                            </>
                        ) : (
                            <>
                                <Route path="/" element={<Navigate to="/home" />} />
                                <Route path="/home" element={<Suspense fallback={<PageLoader message="Loading home..." />}><Home /></Suspense>} />
                                <Route path="/stories" element={<Suspense fallback={<PageLoader />}><Stories /></Suspense>} />
                                <Route path="/explore" element={<Suspense fallback={<PageLoader />}><Explore /></Suspense>} />
                                <Route path="/connections" element={<Suspense fallback={<PageLoader />}><Connections /></Suspense>} />
                                <Route path="/create" element={<Suspense fallback={<PageLoader />}><CreatePost /></Suspense>} />
                                <Route path="/boost" element={<Suspense fallback={<PageLoader />}><Boost /></Suspense>} />
                                <Route path="/reels" element={<Suspense fallback={<PageLoader />}><Reels /></Suspense>} />
                                <Route path="/call" element={<Suspense fallback={<PageLoader />}><VoiceCall /></Suspense>} />
                                <Route path="/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
                                <Route path="/profile" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
                                <Route path="/profile/:username" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
                                <Route path="/login" element={<Navigate to="/home" />} />
                            </>
                        )}
                    </Routes>
                    </ErrorBoundary>
                    {isAuthenticated && <GlobalCallListener />}
                    {isAuthenticated && !onboardingDone && (
                        <OnboardingOverlay onComplete={() => setOnboardingDone(true)} />
                    )}
                    {isAuthenticated && <BottomNav />}
                </div>
            </Router>
        </AppContext.Provider>
    );
}

export default App;
