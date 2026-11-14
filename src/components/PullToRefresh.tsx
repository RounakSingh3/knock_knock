import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: React.ReactNode;
}

const MAX_PULL_DISTANCE = 80;
const REFRESH_THRESHOLD = 52;

const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const startY = useRef(0);
    const startX = useRef(0);
    const isDragging = useRef(false);
    const pullDistanceRef = useRef(0);
    const isRefreshingRef = useRef(false);
    const rafId = useRef<number | null>(null);
    const onRefreshRef = useRef(onRefresh);
    onRefreshRef.current = onRefresh;

    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const spinnerRef = useRef<HTMLDivElement>(null);

    const applyPullStyles = (dist: number, withTransition = false) => {
        const transitionStyle = withTransition
            ? 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), height 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.22s ease'
            : 'none';

        if (contentRef.current) {
            contentRef.current.style.transition = withTransition ? 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
            contentRef.current.style.transform = dist > 0 ? `translate3d(0, ${dist}px, 0)` : '';
            contentRef.current.style.willChange = dist > 0 ? 'transform' : 'auto';
        }
        if (indicatorRef.current) {
            indicatorRef.current.style.transition = withTransition ? 'height 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
            indicatorRef.current.style.height = `${dist}px`;
        }
        if (spinnerRef.current) {
            const progress = Math.min(dist / REFRESH_THRESHOLD, 1);
            spinnerRef.current.style.transition = transitionStyle;
            spinnerRef.current.style.opacity = `${progress}`;
            spinnerRef.current.style.transform = `translate3d(0, ${Math.min(dist - 28, 0)}px, 0) rotate(${progress * 360}deg)`;
        }
    };

    const handleTouchStart = (e: TouchEvent) => {
        if (isRefreshingRef.current) return;
        const container = containerRef.current;
        const scrollTop = window.scrollY || document.documentElement.scrollTop || (container ? container.scrollTop : 0);
        if (scrollTop > 2) return;

        startY.current = e.touches[0].clientY;
        startX.current = e.touches[0].clientX;
        isDragging.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
        if (!isDragging.current || isRefreshingRef.current) return;

        const currentY = e.touches[0].clientY;
        const currentX = e.touches[0].clientX;
        const diffY = currentY - startY.current;
        const diffX = Math.abs(currentX - startX.current);

        // If horizontal swipe is dominant (e.g. story carousel, swipe navigation), cancel pull
        if (diffX > Math.abs(diffY)) {
            isDragging.current = false;
            return;
        }

        const container = containerRef.current;
        const scrollTop = window.scrollY || document.documentElement.scrollTop || (container ? container.scrollTop : 0);

        // Cancel dragging if scrolled down or scrolling up
        if (scrollTop > 2 || diffY < 0) {
            isDragging.current = false;
            if (pullDistanceRef.current > 0) {
                pullDistanceRef.current = 0;
                applyPullStyles(0, true);
            }
            return;
        }

        // Only pull down when at the very top of viewport
        if (diffY > 0 && scrollTop <= 2) {
            const resistance = Math.pow(diffY, 0.82) * 1.4;
            const targetDistance = Math.min(resistance, MAX_PULL_DISTANCE);
            pullDistanceRef.current = targetDistance;

            if (rafId.current === null) {
                rafId.current = requestAnimationFrame(() => {
                    applyPullStyles(pullDistanceRef.current, false);
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
            pullDistanceRef.current = REFRESH_THRESHOLD;
            applyPullStyles(REFRESH_THRESHOLD, true);

            try {
                // Strict 3.5-second safety timeout guarantees the spinner never hangs
                await Promise.race([
                    onRefreshRef.current(),
                    new Promise(resolve => setTimeout(resolve, 3500))
                ]);
            } catch (err) {
                console.error('[PullToRefresh] Refresh failed:', err);
            } finally {
                isRefreshingRef.current = false;
                setIsRefreshing(false);
                pullDistanceRef.current = 0;
                applyPullStyles(0, true);
            }
        } else {
            pullDistanceRef.current = 0;
            applyPullStyles(0, true);
        }
    };

    const handleTouchCancel = () => {
        isDragging.current = false;
        pullDistanceRef.current = 0;
        applyPullStyles(0, true);
    };

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        el.addEventListener('touchstart', handleTouchStart, { passive: true });
        el.addEventListener('touchmove', handleTouchMove, { passive: true });
        el.addEventListener('touchend', handleTouchEnd, { passive: true });
        el.addEventListener('touchcancel', handleTouchCancel, { passive: true });

        return () => {
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchmove', handleTouchMove);
            el.removeEventListener('touchend', handleTouchEnd);
            el.removeEventListener('touchcancel', handleTouchCancel);
            if (rafId.current !== null) {
                cancelAnimationFrame(rafId.current);
            }
        };
    }, []);

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', overscrollBehaviorY: 'contain' }}>
            {/* Pull to Refresh Indicator */}
            <div
                ref={indicatorRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                    zIndex: 20,
                    willChange: 'height',
                }}
            >
                <div
                    ref={spinnerRef}
                    style={{
                        opacity: 0,
                        transform: 'translate3d(0, -28px, 0)',
                        willChange: 'transform, opacity',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Loader2
                        size={22}
                        color="#f5a524"
                        style={{
                            animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none'
                        }}
                    />
                </div>
            </div>

            {/* Content wrapped in pull container */}
            <div ref={contentRef}>
                {children}
            </div>
        </div>
    );
};

export default React.memo(PullToRefresh);
