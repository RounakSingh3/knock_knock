import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { fetchProfile, updatePoints } from './lib/database';
import type { User } from '@supabase/supabase-js';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Stories from './pages/Stories';
import Explore from './pages/Explore';
import VoiceCall from './pages/VoiceCall';
import Login from './pages/Login';

// Global Context for Points & Auth
interface AppContextType {
    points: number;
    setPoints: React.Dispatch<React.SetStateAction<number>>;
    user: User | null;
    isAuthenticated: boolean;
    signOut: () => Promise<void>;
}

export const AppContext = createContext<AppContextType>({
    points: 0,
    setPoints: () => { },
    user: null,
    isAuthenticated: false,
    signOut: async () => { },
});

// We need to track total app time in milliseconds
const POINTS_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function App() {
    const [points, setPoints] = useState(0);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const isAuthenticated = !!user;

    // Listen for Supabase auth state changes
    useEffect(() => {
        // Check initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Load points from database when user logs in
    useEffect(() => {
        if (user) {
            fetchProfile(user.id).then(profile => {
                if (profile) {
                    setPoints(profile.points);
                }
            });
        }
    }, [user]);

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

    const signOut = async () => {
        await supabase.auth.signOut();
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
        <AppContext.Provider value={{ points, setPoints, user, isAuthenticated, signOut }}>
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
                                <Route path="/call" element={<VoiceCall />} />
                                <Route path="/login" element={<Navigate to="/home" />} />
                            </>
                        )}
                    </Routes>
                    {isAuthenticated && <BottomNav />}
                </div>
            </Router>
        </AppContext.Provider>
    );
}

export default App;
