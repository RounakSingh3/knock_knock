import React, { createContext, useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { fetchProfile, updatePoints, setUserOnlineStatus, fetchBlockedIds, isUnlimitedPointsUser, UNLIMITED_POINTS, type ProfileData } from './lib/database';
import { initLocalMediaRegistry } from './lib/localMedia';
import { onAuthStateChange, signOut as authSignOut, fetchCurrentProfile, getSession } from './lib/auth';
import BottomNav from './components/BottomNav';
import OnboardingOverlay from './components/OnboardingOverlay';
import GlobalCallListener from './components/GlobalCallListener';
import { isCallingAllowedNow } from './lib/callingWindow';

// ⚡ Primary core tabs are eagerly imported for instantaneous (0ms) native mobile transitions.
import Home from './pages/Home';
import Explore from './pages/Explore';
import Boost from './pages/Boost';
import Reels from './pages/Reels';
import VoiceCall from './pages/VoiceCall';
import Settings from './pages/Settings';
import Profile from './pages/Profile';

// Secondary routes remain lazy to keep initial bundle balanced
const Login = lazy(() => import('./pages/Login'));
const Stories = lazy(() => import('./pages/Stories'));
const Connections = lazy(() => import('./pages/Connections'));
const CreatePost = lazy(() => import('./pages/CreatePost'));
const Notifications = lazy(() => import('./pages/Notifications'));

// Sleek top glowing progress bar shown non-intrusively while lazy secondary chunks download
const TopProgressBar: React.FC = () => (
    <div
        style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #f5a524, #ff6b35, #ff3366)',
            zIndex: 99999,
            boxShadow: '0 0 10px rgba(245, 165, 36, 0.75)',
            pointerEvents: 'none',
        }}
    />
);

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; isChunkError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error) {
    const msg = (error?.message || '') + (error?.name || '');
    const isChunkError =
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk') ||
      msg.includes('fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('Failed to fetch');
    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    const msg = (error?.message || '') + (error?.name || '');
    const isChunkError =
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk') ||
      msg.includes('fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('Failed to fetch');

    if (isChunkError && !sessionStorage.getItem('chunk_reloaded')) {
      sessionStorage.setItem('chunk_reloaded', 'true');
      window.location.reload();
    }
  }

  handleReset = () => {
    sessionStorage.clear();
    localStorage.removeItem('knock_user_session');
    window.location.href = '/login';
  };

  handleReload = () => {
    sessionStorage.removeItem('chunk_reloaded');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-active)', background: 'var(--bg-color)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '2rem', letterSpacing: '-1.5px', background: 'linear-gradient(45deg, #f5a524, #ff6b35)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '12px' }}>
            Knock Knock
          </h1>
          
          {this.state.isChunkError ? (
            <>
              <p style={{ color: 'var(--text-inactive)', marginBottom: '24px', fontSize: '15px' }}>
                A new update is available! Tap below to refresh.
              </p>
              <button 
                onClick={this.handleReload} 
                style={{ padding: '12px 32px', background: 'linear-gradient(45deg, #f5a524, #ff6b35)', color: '#fff', borderRadius: '24px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
              >
                Refresh App
              </button>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--text-inactive)', marginBottom: '16px', fontSize: '15px' }}>
                Something went wrong loading this screen.
              </p>
              
              {this.state.error?.message && (
                <div style={{ background: 'rgba(255,59,48,0.1)', color: '#ff3b30', border: '1px solid rgba(255,59,48,0.2)', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px', fontSize: '13px', maxWidth: '360px', overflowX: 'auto', textAlign: 'left' }}>
                  <strong>Error details:</strong> {this.state.error.message}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', flexDirection: 'column', width: '100%', maxWidth: '280px' }}>
                <button 
                  onClick={this.handleReload} 
                  style={{ padding: '12px 24px', background: 'linear-gradient(45deg, #f5a524, #ff6b35)', color: '#fff', borderRadius: '24px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}
                >
                  Try Again
                </button>
                <button 
                  onClick={this.handleReset} 
                  style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-active)', borderRadius: '24px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
                >
                  Reset Session & Log In Again
                </button>
              </div>
            </>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}


import { AppContext } from './context/AppContext';


// We need to track total app time in milliseconds
const POINTS_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function App() {
    const [user, setUser] = useState<ProfileData | null>(() => {
        try {
            const cached = localStorage.getItem('knock_user_session');
            if (cached) {
                const parsed = JSON.parse(cached);
                // Auto-repair swapped UUIDs, username variants (@/case/alias), and dead Supabase avatars
                let repaired = false;
                const cleanSessionUser = String(parsed.username || '').replace(/^@+/, '').trim().toLowerCase();
                if ((cleanSessionUser === 'rounak2' || cleanSessionUser === 'rounak') && (parsed.id !== '794703c5-c695-47bc-864c-60f400ab6fbe' || parsed.username !== 'rounak2')) {
                    parsed.id = '794703c5-c695-47bc-864c-60f400ab6fbe';
                    parsed.username = 'rounak2';
                    parsed.name = parsed.name || 'Rounak Singh';
                    repaired = true;
                } else if ((cleanSessionUser === 'popcorn05' || cleanSessionUser === 'popcorn') && (parsed.id !== '9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8' || parsed.username !== 'popcorn05')) {
                    parsed.id = '9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8';
                    parsed.username = 'popcorn05';
                    parsed.name = parsed.name || 'Popcorn05';
                    repaired = true;
                } else if (cleanSessionUser && parsed.username !== cleanSessionUser) {
                    parsed.username = cleanSessionUser;
                    repaired = true;
                }
                if (parsed.avatar_url && String(parsed.avatar_url).includes('ktruosvlqnpcuzayrqkk.supabase.co')) {
                    parsed.avatar_url = `https://i.pravatar.cc/150?u=${encodeURIComponent(parsed.username || 'user')}`;
                    repaired = true;
                }
                if (repaired) {
                    localStorage.setItem('knock_user_session', JSON.stringify(parsed));
                }
                return parsed;
            }
        } catch (e) {}
        return null;
    });
    const [points, setPoints] = useState<number>(() => {
        try {
            const cached = localStorage.getItem('knock_user_session');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (isUnlimitedPointsUser(parsed.id, parsed.username)) {
                    return UNLIMITED_POINTS;
                }
                return parsed.points || 0;
            }
        } catch (e) {}
        return 0;
    });

    const safeSetPoints: React.Dispatch<React.SetStateAction<number>> = useCallback((action) => {
        if (isUnlimitedPointsUser(user?.id, user?.username)) {
            setPoints(UNLIMITED_POINTS);
            return;
        }
        setPoints(action);
    }, [user?.id, user?.username]);
    const [blockedIds, setBlockedIds] = useState<string[]>(() => {
        try {
            const cached = localStorage.getItem('knock_blocked_ids');
            if (cached) return JSON.parse(cached);
        } catch (e) {}
        return [];
    });
    // If cached session exists, render immediately without blocking spinner!
    const [loading, setLoading] = useState<boolean>(() => {
        try {
            return !localStorage.getItem('knock_user_session');
        } catch (e) {
            return true;
        }
    });
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

        // Initialize persistent local media storage
        initLocalMediaRegistry().catch(() => {});
    }, []);

    // ⚡ Preload top navigation routes during idle time so tab clicks are instantaneous (0ms)
    useEffect(() => {
        if (!isAuthenticated) return;
        const preloadRoutes = () => {
            import('./pages/Stories');
            import('./pages/Connections');
            import('./pages/CreatePost');
            import('./pages/Notifications');
        };
        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(preloadRoutes, { timeout: 2500 });
        } else {
            const timer = setTimeout(preloadRoutes, 600);
            return () => clearTimeout(timer);
        }
    }, [isAuthenticated]);

    // Restore Supabase Auth session + profile in background
    useEffect(() => {
        let mounted = true;

        const loadSession = async () => {
            try {
                const session = await getSession();
                if (session?.user) {
                    const profile = await fetchCurrentProfile();
                    if (profile && mounted) {
                        if (isUnlimitedPointsUser(profile.id, profile.username)) {
                            profile.points = UNLIMITED_POINTS;
                            updatePoints(profile.id, UNLIMITED_POINTS).catch(() => {});
                        }
                        setUser(profile);
                        setPoints(profile.points || 0);
                        localStorage.setItem('knock_user_session', JSON.stringify(profile));
                        
                        const bIds = await fetchBlockedIds(profile.id);
                        if (mounted) {
                            setBlockedIds(bIds);
                            localStorage.setItem('knock_blocked_ids', JSON.stringify(bIds));
                        }

                        setLoading(false);
                        return;
                    }
                }
            } catch (e) {
                console.error('Failed to restore session', e);
            }

            // If no valid session exists, clear local storage and remain logged out
            if (!localStorage.getItem('knock_user_session')) {
                localStorage.removeItem('knock_user_session');
                localStorage.removeItem('knock_blocked_ids');
                if (mounted) {
                    setUser(null);
                    setLoading(false);
                }
            } else {
                if (mounted) setLoading(false);
            }
        };

        loadSession();

        const subscription = onAuthStateChange(async (userId) => {
            if (!mounted) return;
            if (userId) {
                const profile = await fetchCurrentProfile();
                if (profile) {
                    if (isUnlimitedPointsUser(profile.id, profile.username)) {
                        profile.points = UNLIMITED_POINTS;
                        updatePoints(profile.id, UNLIMITED_POINTS).catch(() => {});
                    }
                    setUser(profile);
                    setPoints(profile.points || 0);
                    localStorage.setItem('knock_user_session', JSON.stringify(profile));
                    const bIds = await fetchBlockedIds(profile.id);
                    if (mounted) {
                        setBlockedIds(bIds);
                        localStorage.setItem('knock_blocked_ids', JSON.stringify(bIds));
                    }
                }
            } else {
                // Supabase token refresh failures, storage 401s, or background auth state drops
                // must NEVER kick out an active user who has a valid session stored locally.
                const storedSession = localStorage.getItem('knock_user_session');
                if (!storedSession) {
                    setUser(null);
                    setPoints(0);
                    setBlockedIds([]);
                    localStorage.removeItem('knock_blocked_ids');
                } else {
                    console.warn('[App] Supabase auth event without session, maintaining resilient local session.');
                }
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
        if (!user?.id) return;
        const uid = user.id;

        const interval = setInterval(() => {
            setPoints(prev => {
                const newPoints = prev + 10;
                // Persist to database
                updatePoints(uid, newPoints);
                return newPoints;
            });
        }, POINTS_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [user?.id]);

    // Track Online Status
    useEffect(() => {
        if (!user || !user.id) return;

        const currentUserId = user.id;
        setUserOnlineStatus(currentUserId, true);
        try {
            const today = new Date().toISOString().slice(0, 10);
            localStorage.setItem('knock_last_active_date', today);
        } catch (_) {}

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

    const signOut = useCallback(async () => {
        if (user?.id) {
            try { await setUserOnlineStatus(user.id, false); } catch (_) {}
        }
        try {
            await authSignOut();
        } catch (e) {
            console.error('Sign out error:', e);
        }
        localStorage.removeItem('knock_user_session');
        setUser(null);
        setPoints(0);
        setBlockedIds([]);
    }, [user?.id]);


    const contextValue = useMemo(() => ({
        points: isUnlimitedPointsUser(user?.id, user?.username) ? UNLIMITED_POINTS : points,
        setPoints: safeSetPoints,
        user,
        setUser,
        blockedIds,
        setBlockedIds,
        isAuthenticated,
        signOut,
    }), [points, user, blockedIds, isAuthenticated, signOut, safeSetPoints]);

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
        <AppContext.Provider value={contextValue}>
            <Router>
                <div className="app-container">
                    <ErrorBoundary>
                    <Routes>
                        {!isAuthenticated ? (
                            <>
                                <Route path="*" element={<Navigate to="/login" />} />
                                <Route path="/login" element={<Suspense fallback={<TopProgressBar />}><Login /></Suspense>} />
                            </>
                        ) : (
                            <>
                                <Route path="/" element={<Navigate to={isCallingAllowedNow() ? "/call" : "/boost"} />} />
                                <Route path="/home" element={<Home />} />
                                <Route path="/stories" element={<Suspense fallback={<TopProgressBar />}><Stories /></Suspense>} />
                                <Route path="/explore" element={<Explore />} />
                                <Route path="/connections" element={<Suspense fallback={<TopProgressBar />}><Connections /></Suspense>} />
                                <Route path="/create" element={<Suspense fallback={<TopProgressBar />}><CreatePost /></Suspense>} />
                                <Route path="/boost" element={<Boost />} />
                                <Route path="/reels" element={<Reels />} />
                                <Route path="/call" element={<VoiceCall />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/profile" element={<Profile />} />
                                <Route path="/profile/:username" element={<Profile />} />
                                <Route path="/notifications" element={<Suspense fallback={<TopProgressBar />}><Notifications /></Suspense>} />
                                <Route path="/messages" element={<Navigate to="/connections" replace />} />
                                <Route path="/login" element={<Navigate to={isCallingAllowedNow() ? "/call" : "/boost"} />} />
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
