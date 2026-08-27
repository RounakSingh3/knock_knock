import React, { useState, useEffect } from 'react';
import { Flame, ExternalLink, Globe, Heart, Share2, Sparkles, X, ChevronRight, MessageSquare } from 'lucide-react';
import { fetchGoogleNews, syncNewsToDatabase, type NewsItem } from '../lib/newsService';

interface DailyNewsFeedProps {
    onShareNews?: (news: NewsItem) => void;
}

const CATEGORIES: ('All' | 'Cricket & IPL' | 'Bollywood' | 'Hollywood' | 'Gaming' | 'Sports')[] = [
    'All',
    'Cricket & IPL',
    'Bollywood',
    'Hollywood',
    'Gaming',
    'Sports',
];

const CATEGORY_EMOJIS: Record<string, string> = {
    'All': '🔥',
    'Cricket & IPL': '🏏',
    'Bollywood': '🎬',
    'Hollywood': '🌟',
    'Gaming': '🎮',
    'Sports': '🏆',
};

export const DailyNewsFeed: React.FC<DailyNewsFeedProps> = ({ onShareNews }) => {
    const [selectedCategory, setSelectedCategory] = useState<'All' | 'Cricket & IPL' | 'Bollywood' | 'Hollywood' | 'Gaming' | 'Sports'>('All');
    const [newsList, setNewsList] = useState<NewsItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeNewsModal, setActiveNewsModal] = useState<NewsItem | null>(null);
    const [likedNews, setLikedNews] = useState<Set<string>>(new Set());

    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);

        fetchGoogleNews(selectedCategory).then(items => {
            if (!isMounted) return;
            setNewsList(items);
            setIsLoading(false);

            // Auto-sync top news to database as real posts
            if (selectedCategory === 'All') {
                syncNewsToDatabase(items).catch(() => {});
            }
        });

        return () => { isMounted = false; };
    }, [selectedCategory]);

    const toggleLike = (newsId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setLikedNews(prev => {
            const next = new Set(prev);
            if (next.has(newsId)) next.delete(newsId);
            else next.add(newsId);
            return next;
        });
    };

    const handleShare = (news: NewsItem, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onShareNews) {
            onShareNews(news);
        } else if (navigator.share) {
            navigator.share({
                title: news.title,
                text: `${news.title}\n\nCheck this out on Knock Knock!`,
                url: news.url
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(`${news.title}\n${news.url}`);
            alert('Link copied to clipboard!');
        }
    };

    return (
        <div style={{ marginBottom: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #ff4500, #f5a524)',
                        borderRadius: '10px',
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 10px rgba(245,165,36,0.35)'
                    }}>
                        <Flame size={18} color="#000" />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: '800', fontSize: '17px', color: 'var(--text-active)', letterSpacing: '-0.3px' }}>
                                Trending
                            </span>
                            <span style={{
                                background: 'rgba(255, 69, 0, 0.2)',
                                color: '#ff4500',
                                border: '1px solid rgba(255, 69, 0, 0.4)',
                                fontSize: '9px',
                                fontWeight: '900',
                                padding: '1px 6px',
                                borderRadius: '6px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                LIVE
                            </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-inactive)', marginTop: '2px' }}>
                            Swipe horizontally • Cricket, Bollywood, Hollywood, Gaming & Sports
                        </p>
                    </div>
                </div>
            </div>

            {/* Category Pills */}
            <div style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '8px',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch'
            }}>
                {CATEGORIES.map(cat => {
                    const isSelected = selectedCategory === cat;
                    return (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 12px',
                                borderRadius: '18px',
                                border: isSelected ? '1px solid #f5a524' : '1px solid rgba(255,255,255,0.08)',
                                background: isSelected ? 'rgba(245, 165, 36, 0.2)' : 'rgba(255,255,255,0.04)',
                                color: isSelected ? '#f5a524' : 'var(--text-active)',
                                fontSize: '12px',
                                fontWeight: isSelected ? '700' : '500',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s ease',
                                flexShrink: 0
                            }}
                        >
                            <span>{CATEGORY_EMOJIS[cat]}</span>
                            <span>{cat}</span>
                        </button>
                    );
                })}
            </div>

            {/* News Cards Carousel */}
            {isLoading ? (
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    overflowX: 'hidden',
                    padding: '4px 0'
                }}>
                    {[1, 2, 3].map(i => (
                        <div
                            key={i}
                            style={{
                                width: '260px',
                                height: '170px',
                                borderRadius: '18px',
                                background: 'rgba(255,255,255,0.05)',
                                flexShrink: 0,
                                animation: 'pulse 1.5s infinite ease-in-out'
                            }}
                        />
                    ))}
                </div>
            ) : (
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    overflowX: 'auto',
                    padding: '4px 0',
                    scrollbarWidth: 'none',
                    WebkitOverflowScrolling: 'touch'
                }}>
                    {newsList.map(news => {
                        const isLiked = likedNews.has(news.id);
                        return (
                            <div
                                key={news.id}
                                onClick={() => setActiveNewsModal(news)}
                                style={{
                                    width: '260px',
                                    height: '180px',
                                    borderRadius: '18px',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    flexShrink: 0,
                                    cursor: 'pointer',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: '#1c1c1e',
                                    transition: 'transform 0.2s ease',
                                }}
                            >
                                {/* Background Image */}
                                <img
                                    src={news.imageUrl}
                                    alt={news.title}
                                    loading="lazy"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        filter: 'brightness(0.7)'
                                    }}
                                />

                                {/* Gradient Overlay */}
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)'
                                }} />

                                {/* Category Badge */}
                                <div style={{
                                    position: 'absolute',
                                    top: '10px',
                                    left: '10px',
                                    background: 'rgba(0,0,0,0.65)',
                                    backdropFilter: 'blur(8px)',
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    color: '#f5a524',
                                    border: '1px solid rgba(245,165,36,0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <span>{CATEGORY_EMOJIS[news.category] || '📰'}</span>
                                    <span>{news.category}</span>
                                </div>

                                {/* Like & Share Actions (Top Right) */}
                                <div style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '10px',
                                    display: 'flex',
                                    gap: '6px'
                                }}>
                                    <button
                                        onClick={(e) => toggleLike(news.id, e)}
                                        style={{
                                            background: 'rgba(0,0,0,0.65)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '28px',
                                            height: '28px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            backdropFilter: 'blur(8px)'
                                        }}
                                    >
                                        <Heart
                                            size={14}
                                            fill={isLiked ? '#ff4500' : 'none'}
                                            color={isLiked ? '#ff4500' : '#fff'}
                                        />
                                    </button>
                                    <button
                                        onClick={(e) => handleShare(news, e)}
                                        style={{
                                            background: 'rgba(0,0,0,0.65)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '28px',
                                            height: '28px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            backdropFilter: 'blur(8px)'
                                        }}
                                    >
                                        <Share2 size={13} color="#fff" />
                                    </button>
                                </div>

                                {/* Content Details */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '10px',
                                    left: '12px',
                                    right: '12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px'
                                }}>
                                    <div style={{
                                        fontSize: '10px',
                                        color: '#bbb',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <span>{news.source}</span>
                                    </div>
                                    <h4 style={{
                                        margin: 0,
                                        fontSize: '12.5px',
                                        fontWeight: '700',
                                        color: '#fff',
                                        lineHeight: 1.3,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {news.title}
                                    </h4>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Full News Reader Modal */}
            {activeNewsModal && (
                <div
                    onClick={() => setActiveNewsModal(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 100000,
                        background: 'rgba(0,0,0,0.85)',
                        backdropFilter: 'blur(16px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        boxSizing: 'border-box',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '480px',
                            maxHeight: '88vh',
                            background: '#1c1c1e',
                            borderRadius: '24px',
                            overflowY: 'auto',
                            boxShadow: '0 25px 60px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.15)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative',
                            animation: 'newsModalScaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                    >
                        {/* Modal Header Image */}
                        <div style={{ position: 'relative', width: '100%', height: '220px', flexShrink: 0 }}>
                            <img
                                src={activeNewsModal.imageUrl}
                                alt={activeNewsModal.title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'linear-gradient(to top, #1c1c1e 0%, transparent 60%)'
                            }} />
                            <button
                                onClick={() => setActiveNewsModal(null)}
                                style={{
                                    position: 'absolute',
                                    top: '16px',
                                    right: '16px',
                                    background: 'rgba(0,0,0,0.65)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '36px',
                                    height: '36px',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    backdropFilter: 'blur(8px)',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                                }}
                            >
                                <X size={20} />
                            </button>
                            <div style={{
                                position: 'absolute',
                                bottom: '12px',
                                left: '20px',
                                background: '#f5a524',
                                color: '#000',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 'bold'
                            }}>
                                {CATEGORY_EMOJIS[activeNewsModal.category]} {activeNewsModal.category}
                            </div>
                        </div>

                        {/* Modal Body Content */}
                        <div style={{ padding: '20px' }}>
                            <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                                Source: <strong style={{ color: '#aaa' }}>{activeNewsModal.source}</strong>
                            </div>
                            <h2 style={{
                                margin: 0,
                                fontSize: '18px',
                                fontWeight: '800',
                                color: '#fff',
                                lineHeight: 1.35,
                                marginBottom: '14px'
                            }}>
                                {activeNewsModal.title}
                            </h2>

                            <p style={{
                                color: '#ccc',
                                fontSize: '14px',
                                lineHeight: 1.6,
                                marginBottom: '24px'
                            }}>
                                {activeNewsModal.summary}
                            </p>

                            {/* Actions & Links */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <a
                                    href={activeNewsModal.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        background: 'linear-gradient(90deg, #f5a524, #ff6b35)',
                                        color: '#000',
                                        fontWeight: '800',
                                        fontSize: '14px',
                                        padding: '12px 20px',
                                        borderRadius: '16px',
                                        textDecoration: 'none',
                                        boxShadow: '0 4px 16px rgba(245,165,36,0.35)'
                                    }}
                                >
                                    <ExternalLink size={16} />
                                    <span>View Full Story</span>
                                </a>

                                <button
                                    onClick={(e) => handleShare(activeNewsModal, e)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        background: 'rgba(255,255,255,0.08)',
                                        color: '#fff',
                                        fontWeight: '600',
                                        fontSize: '14px',
                                        padding: '12px 20px',
                                        borderRadius: '16px',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Share2 size={16} />
                                    <span>Share with Friends</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes newsModalScaleUp {
                    from { transform: scale(0.92) translateY(12px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default DailyNewsFeed;
