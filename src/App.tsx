import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
<<<<<<< HEAD
import { fetchProfile, incrementPoints, type ProfileData } from './lib/database';
import { getSession, onAuthStateChange, signOut as authSignOut } from './lib/auth';
=======
import { supabase } from './lib/supabase';
import { fetchProfile, updatePoints, setUserOnlineStatus, type ProfileData } from './lib/database';
>>>>>>> 3b4f6af (feat: Combined Instagram + Snapchat stories redesign with streak system)
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Stories from './pages/Stories';
import Explore from './pages/Explore';
import Reels from './pages/Reels';
import VoiceCall from './pages/VoiceCall';
import Login from './pages/Login';
import Profile from './pages/Profile';
import CreatePost from './pages/CreatePost';
import ErrorBoundary from './components/ErrorBoundary';

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

    const isAuthenticated = !!user;

    // Initialize auth state from Supabase session
    useEffect(() => {
        let isMounted = true;

        // Check existing session on mount
        getSession().then(async (session) => {
            if (session?.user && isMounted) {
                const profile = await fetchProfile(session.user.id);
                if (profile && isMounted) {
                    setUser(profile);
                    setPoints(profile.points || 0);
                }
            }
            if (isMounted) setLoading(false);
        }).catch((err) => {
            console.error('Failed to get session:', err);
            if (isMounted) setLoading(false);
        });

        // Listen for auth state changes (sign in, sign out, token refresh)
        const subscription = onAuthStateChange(async (userId) => {
            if (userId && isMounted) {
                const profile = await fetchProfile(userId);
                if (profile && isMounted) {
                    setUser(profile);
                    setPoints(profile.points || 0);
                }
            } else if (isMounted) {
                setUser(null);
                setPoints(0);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // Track time spent in app & award points
    useEffect(() => {
        if (!user) return;

        const interval = setInterval(() => {
            setPoints(prev => {
                const newPoints = prev + 10;
                // Persist to database via secure RPC
                incrementPoints(10);
                return newPoints;
            });
        }, POINTS_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [user]);

<<<<<<< HEAD
    const signOut = async () => {
        try {
            await authSignOut();
        } catch (err) {
            console.error('Sign out error:', err);
        }
=======
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

    const signOut = () => {
        localStorage.removeItem('knock_user_session');
>>>>>>> 3b4f6af (feat: Combined Instagram + Snapchat stories redesign with streak system)
        setUser(null);
        setPoints(0);
    };

    if (loading) {
        return (
            <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div className="text-center">
                    <h1 className="app-title text-4xl mb-2" style={{ background: '-webkit-linear-gradient(45deg, #ff3366, #ff9933)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Knock Knock
                    </h1>
                    <p style={{ color: '#8e8e93', marginTop: '1rem' }}>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
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
                                    <Route path="/create" element={<CreatePost />} />
                                    <Route path="/reels" element={<Reels />} />
                                    <Route path="/call" element={<VoiceCall />} />
                                    <Route path="/profile" element={<Profile />} />
                                    <Route path="/profile/:username" element={<Profile />} />
                                    <Route path="/login" element={<Navigate to="/home" />} />
                                </>
                            )}
                        </Routes>
                        {isAuthenticated && <BottomNav />}
                    </div>
                </Router>
            </AppContext.Provider>
        </ErrorBoundary>
    );
}

export default App;
