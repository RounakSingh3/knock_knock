import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Flame, ExternalLink, Globe, Heart, Share2, Sparkles, X, ChevronRight, MessageSquare } from 'lucide-react';
import { fetchGoogleNews, syncNewsToDatabase, type NewsItem, type NewsCategory } from '../lib/newsService';

interface DailyNewsFeedProps {
    onShareNews?: (news: NewsItem) => void;
    externalActiveNews?: NewsItem | null;
    onCloseNews?: () => void;
}

const CATEGORIES: ('All' | NewsCategory)[] = [
    'All',
    'Tech & AI',
    'Cricket & IPL',
    'Bollywood',
    'Hollywood',
    'Gaming',
    'Sports',
    'Business & World',
];

const CATEGORY_EMOJIS: Record<string, string> = {
    'All': '🔥',
    'Tech & AI': '🤖',
    'Cricket & IPL': '🏏',
    'Bollywood': '🎬',
    'Hollywood': '🌟',
    'Gaming': '🎮',
    'Sports': '🏆',
    'Business & World': '💼',
};

export const DailyNewsFeed: React.FC<DailyNewsFeedProps> = ({ onShareNews, externalActiveNews, onCloseNews }) => {
    const [selectedCategory, setSelectedCategory] = useState<'All' | NewsCategory>('All');
    const [newsList, setNewsList] = useState<NewsItem[]>([]);
    const [visibleCount, setVisibleCount] = useState(10);
    const [isLoading, setIsLoading] = useState(true);
    const [activeNewsModal, setActiveNewsModal] = useState<NewsItem | null>(null);
    const [likedNews, setLikedNews] = useState<Set<string>>(new Set());
    const modalContentRef = useRef<HTMLDivElement>(null);

    const currentActiveNews = externalActiveNews !== undefined && externalActiveNews !== null 
        ? externalActiveNews 
        : activeNewsModal;

    const closeModal = () => {
        setActiveNewsModal(null);
        if (onCloseNews) onCloseNews();
    };

    useEffect(() => {
        if (currentActiveNews && modalContentRef.current) {
            modalContentRef.current.scrollTop = 0;
        }
    }, [currentActiveNews]);

    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);
        setVisibleCount(10);

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
                                Daily News Feed
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
                            {newsList.length > 0 && (
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    background: 'rgba(245,165,36,0.15)',
                                    color: '#f5a524',
                                    border: '1px solid rgba(245,165,36,0.3)',
                                    padding: '1px 7px',
                                    borderRadius: '8px'
                                }}>
                                    {newsList.length} articles
                                </span>
                            )}
                        </div>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-inactive)', marginTop: '2px' }}>
                            Top breaking headlines & in-depth coverage • Updated live
                        </p>
                    </div>
                </div>
            </div>

            {/* Category Filter Pills (100% Vertical Flow, Wrapped) */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                paddingBottom: '10px',
                width: '100%',
                boxSizing: 'border-box'
            }}>
                {CATEGORIES.map(cat => {
                    const isSelected = selectedCategory === cat;
                    return (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 12px',
                                borderRadius: '16px',
                                border: isSelected ? '1px solid #f5a524' : '1px solid rgba(255,255,255,0.08)',
                                background: isSelected ? 'rgba(245, 165, 36, 0.2)' : 'rgba(255,255,255,0.04)',
                                color: isSelected ? '#f5a524' : 'var(--text-active)',
                                fontSize: '11.5px',
                                fontWeight: isSelected ? '700' : '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <span>{CATEGORY_EMOJIS[cat]}</span>
                            <span>{cat}</span>
                        </button>
                    );
                })}
            </div>

            {/* Pure Vertical News Feed — ALL News Cards Stacked Vertically */}
            {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                    {[1, 2, 3].map(i => (
                        <div
                            key={i}
                            style={{
                                width: '100%',
                                height: '240px',
                                borderRadius: '18px',
                                background: 'rgba(255,255,255,0.04)',
                                animation: 'pulse 1.5s infinite ease-in-out'
                            }}
                        />
                    ))}
                </div>
            ) : newsList.length === 0 ? (
                <div style={{
                    padding: '28px 16px',
                    textAlign: 'center',
                    color: 'var(--text-inactive)',
                    fontSize: '13px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '16px',
                    marginTop: '8px'
                }}>
                    No news articles available for {selectedCategory} at the moment.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '6px', width: '100%', boxSizing: 'border-box' }}>
                    {newsList.slice(0, visibleCount).map((news, idx) => {
                        const isLiked = likedNews.has(news.id);
                        return (
                            <div
                                key={news.id}
                                onClick={() => setActiveNewsModal(news)}
                                style={{
                                    width: '100%',
                                    borderRadius: '18px',
                                    overflow: 'hidden',
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
                                    cursor: 'pointer',
                                    transition: 'transform 0.15s ease, background 0.2s ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    boxSizing: 'border-box'
                                }}
                            >
                                {/* 1. Full-Width Cover Image (Top of Vertical Card) */}
                                <div style={{
                                    width: '100%',
                                    height: idx === 0 ? '195px' : '170px',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    background: '#111'
                                }}>
                                    <img
                                        src={news.imageUrl}
                                        alt={news.title}
                                        loading="lazy"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                            e.currentTarget.onerror = null;
                                            e.currentTarget.src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600';
                                        }}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            filter: 'brightness(0.75)'
                                        }}
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)'
                                    }} />

                                    {/* Category Pill (Top-Left) */}
                                    <div style={{
                                        position: 'absolute',
                                        top: '10px',
                                        left: '10px',
                                        background: 'rgba(0,0,0,0.7)',
                                        backdropFilter: 'blur(8px)',
                                        padding: '3px 9px',
                                        borderRadius: '12px',
                                        fontSize: '10.5px',
                                        fontWeight: '800',
                                        color: '#f5a524',
                                        border: '1px solid rgba(245,165,36,0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <span>{CATEGORY_EMOJIS[news.category] || '📰'}</span>
                                        <span>{news.category}</span>
                                    </div>

                                    {/* Like & Share (Top-Right) */}
                                    <div style={{
                                        position: 'absolute',
                                        top: '10px',
                                        right: '10px',
                                        display: 'flex',
                                        gap: '6px'
                                    }}>
                                        <button
                                            type="button"
                                            onClick={(e) => toggleLike(news.id, e)}
                                            style={{
                                                background: 'rgba(0,0,0,0.65)',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '30px',
                                                height: '30px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                backdropFilter: 'blur(8px)'
                                            }}
                                        >
                                            <Heart size={14} fill={isLiked ? '#ff4500' : 'none'} color={isLiked ? '#ff4500' : '#fff'} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => handleShare(news, e)}
                                            style={{
                                                background: 'rgba(0,0,0,0.65)',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '30px',
                                                height: '30px',
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
                                </div>

                                {/* 2. Vertical Text & Actions Body (Bottom of Vertical Card) */}
                                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-inactive)' }}>
                                        <span style={{ color: '#f5a524', fontWeight: '800' }}>{news.source}</span>
                                        <span>•</span>
                                        <span>{news.publishedAt}</span>
                                    </div>
                                    <h3 style={{
                                        margin: 0,
                                        fontSize: idx === 0 ? '15.5px' : '14.5px',
                                        fontWeight: '800',
                                        color: '#ffffff',
                                        lineHeight: 1.35,
                                        letterSpacing: '-0.2px'
                                    }}>
                                        {news.title}
                                    </h3>
                                    <p style={{
                                        margin: 0,
                                        fontSize: '12.5px',
                                        color: 'rgba(255,255,255,0.75)',
                                        lineHeight: 1.45,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {news.summary}
                                    </p>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        paddingTop: '8px',
                                        marginTop: '4px',
                                        borderTop: '1px solid rgba(255,255,255,0.06)'
                                    }}>
                                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Heart size={12} fill={isLiked ? '#ff4500' : 'none'} color={isLiked ? '#ff4500' : '#888'} />
                                            {news.likesCount + (isLiked ? 1 : 0)} likes
                                        </span>
                                        <span style={{ fontSize: '11px', color: '#f5a524', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            Read Full Story <ChevronRight size={13} />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Load More Button */}
                    {visibleCount < newsList.length && (
                        <button
                            type="button"
                            onClick={() => setVisibleCount(prev => Math.min(newsList.length, prev + 8))}
                            style={{
                                width: '100%',
                                marginTop: '4px',
                                padding: '13px 0',
                                borderRadius: '14px',
                                border: '1px solid rgba(245, 165, 36, 0.35)',
                                background: 'rgba(245, 165, 36, 0.1)',
                                color: '#f5a524',
                                fontSize: '13px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <span>Load More Stories ({newsList.length - visibleCount} remaining)</span>
                            <ChevronRight size={14} />
                        </button>
                    )}
                </div>
            )}

            {/* Decent, Comfortable News Reader Card — Portal to escape PullToRefresh transform */}
            {currentActiveNews && createPortal(
                <div
                    onClick={closeModal}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 100000,
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        boxSizing: 'border-box',
                    }}
                >
                    <div
                        ref={modalContentRef}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '390px',
                            background: '#18181b',
                            borderRadius: '22px',
                            boxShadow: '0 24px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.12)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            padding: '16px 18px',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative',
                            animation: 'newsCardPopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                            maxHeight: '85vh',
                            overflowY: 'auto',
                            boxSizing: 'border-box',
                        }}
                    >
                        {/* Top Bar: Category pill + Source badge + Close button */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                    background: 'rgba(245, 165, 36, 0.15)',
                                    color: '#f5a524',
                                    border: '1px solid rgba(245, 165, 36, 0.35)',
                                    padding: '3px 9px',
                                    borderRadius: '10px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <span>{CATEGORY_EMOJIS[currentActiveNews.category] || '📰'}</span>
                                    <span>{currentActiveNews.category}</span>
                                </span>
                                <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: '600' }}>
                                    {currentActiveNews.source}
                                </span>
                            </div>

                            <button
                                onClick={closeModal}
                                aria-label="Close News"
                                style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '30px',
                                    height: '30px',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                    flexShrink: 0
                                }}
                            >
                                <X size={17} />
                            </button>
                        </div>

                        {/* Headline - Immediately in front */}
                        <h3 style={{
                            margin: '0 0 8px 0',
                            fontSize: '15.5px',
                            fontWeight: '800',
                            color: '#ffffff',
                            lineHeight: 1.35,
                            letterSpacing: '-0.2px'
                        }}>
                            {currentActiveNews.title}
                        </h3>

                        {/* Full News Story - Directly in front, zero scrolling needed */}
                        <p style={{
                            margin: '0 0 12px 0',
                            color: '#e2e8f0',
                            fontSize: '13.5px',
                            lineHeight: 1.55,
                            fontWeight: '400',
                            display: '-webkit-box',
                            WebkitLineClamp: 6,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                        }}>
                            {currentActiveNews.summary}
                        </p>

                        {/* Image Preview Banner */}
                        {currentActiveNews.imageUrl && (
                            <div style={{
                                width: '100%',
                                height: '135px',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                position: 'relative',
                                marginBottom: '12px',
                                background: '#0a0a0a',
                                flexShrink: 0
                            }}>
                                <img
                                    src={currentActiveNews.imageUrl}
                                    alt={currentActiveNews.title}
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                        e.currentTarget.onerror = null;
                                        e.currentTarget.src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600';
                                    }}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                            </div>
                        )}

                        {/* Bottom Actions Row: Like, Share, Source Link & Close */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: 'auto', paddingTop: '4px' }}>
                            <button
                                onClick={(e) => toggleLike(currentActiveNews.id, e)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: likedNews.has(currentActiveNews.id) ? 'rgba(245, 165, 36, 0.2)' : 'rgba(255,255,255,0.06)',
                                    color: likedNews.has(currentActiveNews.id) ? '#f5a524' : '#fff',
                                    fontWeight: '600',
                                    fontSize: '12px',
                                    height: '34px',
                                    padding: '0 12px',
                                    borderRadius: '10px',
                                    border: likedNews.has(currentActiveNews.id) ? '1px solid #f5a524' : '1px solid rgba(255,255,255,0.1)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <Heart
                                    size={14}
                                    fill={likedNews.has(currentActiveNews.id) ? '#f5a524' : 'none'}
                                    color={likedNews.has(currentActiveNews.id) ? '#f5a524' : '#fff'}
                                />
                                <span>{currentActiveNews.likesCount + (likedNews.has(currentActiveNews.id) ? 1 : 0)}</span>
                            </button>

                            <button
                                onClick={(e) => handleShare(currentActiveNews, e)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'rgba(255,255,255,0.06)',
                                    color: '#fff',
                                    fontWeight: '600',
                                    fontSize: '12px',
                                    height: '34px',
                                    padding: '0 12px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    cursor: 'pointer'
                                }}
                            >
                                <Share2 size={14} />
                                <span>Share</span>
                            </button>

                            {currentActiveNews.url && currentActiveNews.url !== '#' && (
                                <a
                                    href={currentActiveNews.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        marginLeft: 'auto',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        color: '#94a3b8',
                                        fontSize: '11px',
                                        textDecoration: 'none',
                                        padding: '4px 6px',
                                        borderRadius: '6px',
                                        transition: 'color 0.2s'
                                    }}
                                >
                                    <span>Source</span>
                                    <ExternalLink size={11} />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            , document.body)}

            <style>{`
                @keyframes newsCardPopIn {
                    from { opacity: 0; transform: scale(0.94) translateY(8px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default DailyNewsFeed;
