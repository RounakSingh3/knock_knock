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
    const MAX_PULL_DISTANCE = 100;
    const REFRESH_THRESHOLD = 60;

    const handleTouchStart = (e: TouchEvent) => {
        // Only allow pulling if we are at the very top of the page
        if (window.scrollY > 0) return;
        
        startY.current = e.touches[0].clientY;
        isDragging.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
        if (!isDragging.current || isRefreshing) return;

        currentY.current = e.touches[0].clientY;
        const distance = currentY.current - startY.current;

        // Only pull down
        if (distance > 0) {
            // Prevent default scroll behavior while pulling down
            if (e.cancelable) {
                e.preventDefault();
            }
            // Add resistance
            const resistance = distance * 0.4;
            setPullDistance(Math.min(resistance, MAX_PULL_DISTANCE));
        }
    };

    const handleTouchEnd = async () => {
        if (!isDragging.current) return;
        isDragging.current = false;

        if (pullDistance >= REFRESH_THRESHOLD && !isRefreshing) {
            setIsRefreshing(true);
            setPullDistance(REFRESH_THRESHOLD); // Hold the spinner at threshold
            
            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            // Snap back
            setPullDistance(0);
        }
    };

    useEffect(() => {
        // We add non-passive event listeners to preventDefault on touchmove
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [pullDistance, isRefreshing]);

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
