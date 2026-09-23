export interface CallingScheduleInfo {
    isActive: boolean;
    hours: number;
    minutes: number;
    seconds: number;
    formatted: string;
}

export const isDevBypassActive = (): boolean => {
    try {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('knock_call_dev_bypass') === 'true';
    } catch {
        return false;
    }
};

export const toggleDevBypass = (): boolean => {
    try {
        const next = !isDevBypassActive();
        localStorage.setItem('knock_call_dev_bypass', next ? 'true' : 'false');
        return next;
    } catch {
        return false;
    }
};

export const getCallingScheduleInfo = (): CallingScheduleInfo => {
    const now = new Date();
    const hour = now.getHours();

    // Calling Window: Strictly 8:00 PM (20:00) to 10:00 PM (22:00) daily
    if (hour >= 20 && hour < 22) {
        const end = new Date(now);
        end.setHours(22, 0, 0, 0);
        const diff = Math.max(0, end.getTime() - now.getTime());
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        return {
            isActive: true,
            hours: h,
            minutes: m,
            seconds: s,
            formatted: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        };
    } else {
        const nextStart = new Date(now);
        if (hour >= 22) {
            nextStart.setDate(nextStart.getDate() + 1);
        }
        nextStart.setHours(20, 0, 0, 0);
        const diff = Math.max(0, nextStart.getTime() - now.getTime());
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        return {
            isActive: false,
            hours: h,
            minutes: m,
            seconds: s,
            formatted: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        };
    }
};

export const isCallingAllowedNow = (): boolean => {
    return getCallingScheduleInfo().isActive || isDevBypassActive();
};
