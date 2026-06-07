import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { fetchProfile, updatePoints, setUserOnlineStatus, type ProfileData } from './lib/database';
import { onAuthStateChange, signOut as authSignOut, fetchCurrentProfile, getSession } from './lib/auth';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Stories from './pages/Stories';
import Explore from './pages/Explore';
import Connections from './pages/Connections';
import Boost from './pages/Boost';
import Reels from './pages/Reels';
import VoiceCall from './pages/VoiceCall';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import CreatePost from './pages/CreatePost';
import OnboardingOverlay from './components/OnboardingOverlay';

// Global Context for Points & Auth
interface AppContextType {
    points: number;
    setPoints: React.Dispatch<React.SetStateAction<number>>;
    user: ProfileData | null;
    setUser: React.Dispatch<React.SetStateAction<ProfileData | null>>;
    isAuthenticated: boolean;
    signOut: () => void;
}

export const AppContext = createContext<AppContextType>({
    points: 0,
    setPoints: () => { },
    user: null,
    setUser: () => { },
    isAuthenticated: false,
    signOut: () => { },
});

// We need to track total app time in milliseconds
const POINTS_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function App() {
    const [points, setPoints] = useState(0);
    const [user, setUser] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [onboardingDone, setOnboardingDone] = useState(false);

    const isAuthenticated = !!user;

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
                        setLoading(false);
                        return;
                    }
                }
            } catch (e) {
                console.error('Failed to restore session', e);
            }

            const savedUser = localStorage.getItem('knock_user_session');
            if (savedUser && mounted) {
                try {
                    const parsedUser = JSON.parse(savedUser) as ProfileData;
                    setUser(parsedUser);
                    setPoints(parsedUser.points || 0);
                } catch (e) {
                    localStorage.removeItem('knock_user_session');
                }
            }
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
                }
            } else {
                setUser(null);
                setPoints(0);
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
                    <p style={{ color: '#8e8e93', marginTop: '1rem' }}>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <AppContext.Provider value={{ points, setPoints, user, setUser, isAuthenticated, signOut }}>
            <Router>
                <div className="app-container">
                    <Routes>
                        {!isAuthenticated ? (
                            <>
                                <Route path="*" element={<Navigate to="/login" />} />
                                <Route path="/login" element={<Login />} />
                            </>
                        ) : (
                            <>
                                <Route path="/" element={<Navigate to="/home" />} />
                                <Route path="/home" element={<Home />} />
                                <Route path="/stories" element={<Stories />} />
                                <Route path="/explore" element={<Explore />} />
                                <Route path="/connections" element={<Connections />} />
                                <Route path="/create" element={<CreatePost />} />
                                <Route path="/boost" element={<Boost />} />
                                <Route path="/reels" element={<Reels />} />
                                <Route path="/call" element={<VoiceCall />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/profile" element={<Profile />} />
                                <Route path="/profile/:username" element={<Profile />} />
                                <Route path="/login" element={<Navigate to="/home" />} />
                            </>
                        )}
                    </Routes>
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
