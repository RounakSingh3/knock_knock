import React from 'react';

const shimmerStyle: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--surface-color) 25%, var(--border-color) 50%, var(--surface-color) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s ease-in-out infinite',
};

/** Grid skeleton for Explore page */
export const GridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px' }}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} style={{ aspectRatio: '1', ...shimmerStyle }} />
        ))}
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
);

/** Horizontal skeleton for story rows */
export const HorizontalSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
    <div style={{ display: 'flex', gap: '12px', overflow: 'hidden' }}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} style={{ width: '80px', height: '120px', borderRadius: '12px', flexShrink: 0, ...shimmerStyle }} />
        ))}
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
);

/** Trending banner skeleton */
export const TrendingSkeleton: React.FC = () => (
    <div style={{ display: 'flex', gap: '8px', overflow: 'hidden', padding: '0 0 8px' }}>
        {[1, 2, 3].map(i => (
            <div key={i} style={{ width: '140px', height: '180px', borderRadius: '16px', flexShrink: 0, ...shimmerStyle }} />
        ))}
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
);
