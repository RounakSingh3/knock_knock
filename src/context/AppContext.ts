import { createContext } from 'react';
import type { ProfileData } from '../lib/database';

export interface AppContextType {
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
