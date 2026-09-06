import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: React.ReactNode;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    const startY = useRef(0);
    const currentY = useRef(0);
    const isDragging = useRef(false);
    const pullDistanceRef = useRef(0);
    const isRefreshingRef = useRef(false);
    const rafId = useRef<number | null>(null);
    const onRefreshRef = useRef(onRefresh);
    onRefreshRef.current = onRefresh;

    const MAX_PULL_DISTANCE = 100;
    const REFRESH_THRESHOLD = 60;

    const handleTouchStart = (e: TouchEvent) => {
        if (window.scrollY > 0 || isRefreshingRef.current) return;
        startY.current = e.touches[0].clientY;
        isDragging.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
        if (!isDragging.current || isRefreshingRef.current) return;

        currentY.current = e.touches[0].clientY;
        const distance = currentY.current - startY.current;

        // If user scrolls up, cancel dragging and let native scroll take over
        if (distance < 0 || window.scrollY > 0) {
            isDragging.current = false;
            if (pullDistanceRef.current > 0) {
                pullDistanceRef.current = 0;
                setPullDistance(0);
            }
            return;
        }

        // Only pull down when at the top of the viewport
        if (distance > 0 && window.scrollY <= 0) {
            if (distance > 10 && e.cancelable) {
                e.preventDefault();
            }
            const resistance = distance * 0.4;
            const targetDistance = Math.min(resistance, MAX_PULL_DISTANCE);
            pullDistanceRef.current = targetDistance;

            if (rafId.current === null) {
                rafId.current = requestAnimationFrame(() => {
                    setPullDistance(pullDistanceRef.current);
                    rafId.current = null;
                });
            }
        }
    };

    const handleTouchEnd = async () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        if (rafId.current !== null) {
            cancelAnimationFrame(rafId.current);
            rafId.current = null;
        }

        const dist = pullDistanceRef.current;
        if (dist >= REFRESH_THRESHOLD && !isRefreshingRef.current) {
            isRefreshingRef.current = true;
            setIsRefreshing(true);
            setPullDistance(REFRESH_THRESHOLD);
            pullDistanceRef.current = REFRESH_THRESHOLD;
            
            try {
                await onRefreshRef.current();
            } finally {
                isRefreshingRef.current = false;
                setIsRefreshing(false);
                pullDistanceRef.current = 0;
                setPullDistance(0);
            }
        } else {
            pullDistanceRef.current = 0;
            setPullDistance(0);
        }
    };

    useEffect(() => {
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
            if (rafId.current !== null) {
                cancelAnimationFrame(rafId.current);
            }
        };
    }, []);

    // Calculate spinner rotation and opacity based on pull distance
    const pullProgress = Math.min(pullDistance / REFRESH_THRESHOLD, 1);
    const spinnerRotation = pullProgress * 360;

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            {/* Pull to Refresh Indicator */}
            <div 
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `${Math.max(pullDistance, isRefreshing ? REFRESH_THRESHOLD : 0)}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    transition: isDragging.current ? 'none' : 'height 0.3s ease',
                    zIndex: 10,
                }}
            >
                <div style={{
                    opacity: pullProgress,
                    transform: `translateY(${Math.min(pullDistance - 30, 0)}px)`,
                    transition: isDragging.current ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
                }}>
                    <Loader2 
                        size={24} 
                        color="#8e8e93" 
                        style={{ 
                            transform: `rotate(${spinnerRotation}deg)`,
                            animation: isRefreshing ? 'spin 1s linear infinite' : 'none' 
                        }} 
                    />
                </div>
            </div>

            {/* Content wrapped in pull container */}
            <div style={{ 
                transform: `translateY(${isRefreshing ? REFRESH_THRESHOLD : pullDistance}px)`,
                transition: isDragging.current ? 'none' : 'transform 0.3s ease'
            }}>
                {children}
            </div>
        </div>
    );
};

export default PullToRefresh;
