import React, { useRef, useEffect, useLayoutEffect, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { type PostData, trackEngagement, normalizePost, fetchAllPostsForScoring, recordPostScreenDelivery } from '../lib/database';
import { PostModalContent } from './PostModal';
import { AppContext } from '../context/AppContext';
import { getFeedMutedPreference, setFeedMutedPreference } from '../lib/media';

interface ExploreFeedViewerProps {
    posts: PostData[];
    initialIndex: number;
    onClose: () => void;
    onCommentClick: (postId: string) => void;
    onShareClick: (post: PostData) => void;
    onLikeToggle?: (postId: string, liked: boolean) => void;
    onImpToggle?: (postId: string, imped: boolean) => void;
    onDelete?: (postId: string) => void;
    zIndex?: number;
    likedPosts?: Record<string, boolean>;
    impedPosts?: Record<string, boolean>;
}

const ExploreFeedViewer: React.FC<ExploreFeedViewerProps> = ({
    posts,
    initialIndex,
    onClose,
    onCommentClick,
    onShareClick,
    onLikeToggle,
    onImpToggle,
    onDelete,
    zIndex,
    likedPosts,
    impedPosts,
}) => {
    const { user } = useContext(AppContext);
    const scrollRef = useRef<HTMLDivElement>(null);
    const watchTimers = useRef<Record<string, number>>({});
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const cleanMediaKey = (url?: string) => {
        if (!url) return '';
        return url.split('?')[0].split('#')[0].toLowerCase().trim();
    };

    const initialPost = posts[initialIndex] || posts[0];

    const dedupePosts = useCallback((list: PostData[]): PostData[] => {
        const seenIds = new Set<string>();
        const seenUrls = new Set<string>();
        const targetId = list[initialIndex]?.id;
        const res: PostData[] = [];
        for (const p of list) {
            if (!p || !p.id) continue;
            if (targetId && p.id === targetId) {
                seenIds.add(String(p.id));
                const key = cleanMediaKey(p.image_url);
                if (key) seenUrls.add(key);
                res.push(p);
                continue;
            }
            const key = cleanMediaKey(p.image_url);
            if (seenIds.has(String(p.id))) continue;
            if (key && seenUrls.has(key)) continue;
            seenIds.add(String(p.id));
            if (key) seenUrls.add(key);
            res.push(p);
        }
        return res;
    }, [initialIndex]);

    // Keep active stream in state with auto-replenish to guarantee next video is ALWAYS available
    const [displayPosts, setDisplayPosts] = useState<PostData[]>(() => dedupePosts(posts));
    const displayPostsRef = useRef<PostData[]>(displayPosts);
    useEffect(() => {
        displayPostsRef.current = displayPosts;
    }, [displayPosts]);

    // Sync incoming posts prop if parent adds more items
    useEffect(() => {
        if (!posts || posts.length === 0) return;
        setDisplayPosts(prev => {
            const existingIds = new Set(prev.map(p => String(p.id)));
            const existingUrls = new Set(prev.map(p => cleanMediaKey(p.image_url)).filter(Boolean));
            const additions: PostData[] = [];
            for (const p of posts) {
                if (!p || !p.id) continue;
                const key = cleanMediaKey(p.image_url);
                if (existingIds.has(String(p.id)) || (key && existingUrls.has(key))) continue;
                existingIds.add(String(p.id));
                if (key) existingUrls.add(key);
                additions.push(p);
            }
            return additions.length > 0 ? [...prev, ...additions] : prev;
        });
    }, [posts]);

    // Resolve target post in deduped stream
    const resolvedInitialIndex = displayPosts.findIndex(p => p.id === initialPost?.id);
    const effectiveIndex = resolvedInitialIndex !== -1 ? resolvedInitialIndex : (initialIndex < displayPosts.length ? initialIndex : 0);
    const targetPost = displayPosts[effectiveIndex] || initialPost;

    const [currentIndex, setCurrentIndex] = useState(effectiveIndex);
    const currentIndexRef = useRef(effectiveIndex);
    useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

    const [activePostId, setActivePostId] = useState<string | null>(targetPost?.id || null);
    const activePostIdRef = useRef<string | null>(targetPost?.id || null);
    useEffect(() => { activePostIdRef.current = activePostId; }, [activePostId]);
    const [isGlobalMuted, setIsGlobalMuted] = useState(() => getFeedMutedPreference());
    const isInitialMountRef = useRef(effectiveIndex > 0);
    const hasPositionedInitialRef = useRef(false);
    const userHasInteractedRef = useRef(false);
    const isReplenishingRef = useRef(false);
    const replenishCycleRef = useRef(0);

    // Auto-replenish feed when user is within 3 items of the bottom so swiping down never stops
    useEffect(() => {
        if (isReplenishingRef.current) return;
        if (currentIndex < displayPosts.length - 3 && displayPosts.length >= 4) return;

        isReplenishingRef.current = true;
        let cancelled = false;
        fetchAllPostsForScoring()
            .then((pool) => {
                if (cancelled) return;
                setDisplayPosts(prev => {
                    const existingIds = new Set(prev.map(p => String(p.id)));
                    const existingUrls = new Set(prev.map(p => cleanMediaKey(p.image_url)).filter(Boolean));
                    const fresh: PostData[] = [];
                    for (const raw of (pool || [])) {
                        const p = normalizePost(raw) || raw;
                        if (!p || !p.id || !p.image_url) continue;
                        const key = cleanMediaKey(p.image_url);
                        if (existingIds.has(String(p.id)) || (key && existingUrls.has(key))) continue;
                        existingIds.add(String(p.id));
                        if (key) existingUrls.add(key);
                        fresh.push(p);
                        if (fresh.length >= 15) break;
                    }
                    if (fresh.length > 0) {
                        return [...prev, ...fresh];
                    }
                    // If all unique posts have been seen, cycle existing pool with unique synthetic keys so swiping down continues seamlessly
                    if (prev.length > 1) {
                        replenishCycleRef.current += 1;
                        const cycle = replenishCycleRef.current;
                        const basePool = prev.slice(0, Math.min(prev.length, 12));
                        const cycled = basePool.map((p, i) => ({
                            ...p,
                            id: `${String(p.id).replace(/_p\d+_\d+$/, '')}_p${cycle}_${i}`,
                        }));
                        return [...prev, ...cycled];
                    }
                    return prev;
                });
            })
            .catch(() => {})
            .finally(() => {
                isReplenishingRef.current = false;
            });
        return () => { cancelled = true; };
    }, [currentIndex, displayPosts.length]);

    // Support Android/mobile hardware and gesture back button
    useEffect(() => {
        window.history.pushState({ modal: 'explore_feed' }, '');
        const handlePopState = () => {
            onClose();
        };
        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [onClose]);

    const activatePost = useCallback((postId: string, index?: number) => {
        if (!postId || postId === activePostIdRef.current) return;
        const prevId = activePostIdRef.current;
        activePostIdRef.current = postId;
        setActivePostId(postId);

        const list = displayPostsRef.current;
        const resolvedIdx = index !== undefined ? index : list.findIndex(p => p.id === postId);
        if (resolvedIdx !== -1) {
            currentIndexRef.current = resolvedIdx;
            setCurrentIndex(resolvedIdx);
        }

        // Defer all telemetry & localStorage work off the animation frame so swiping stays 60/120fps
        const currentUserId = user?.id;
        if (currentUserId) {
            const now = Date.now();
            if (prevId && watchTimers.current[prevId]) {
                const elapsedSec = (now - watchTimers.current[prevId]) / 1000;
                const prevPost = list.find(p => p.id === prevId);
                delete watchTimers.current[prevId];
                if (elapsedSec > 0.5) {
                    setTimeout(() => {
                        trackEngagement(currentUserId, prevId, 'watch_time', elapsedSec, prevPost?.category || 'General').catch(() => {});
                    }, 300);
                }
            }
            watchTimers.current[postId] = now;
            const currentPost = list[resolvedIdx] || list.find(p => p.id === postId);
            const category = currentPost?.category || 'General';
            setTimeout(() => {
                trackEngagement(currentUserId, postId, 'view', 1, category).catch(() => {});
                recordPostScreenDelivery(postId, currentUserId, currentPost?.boost_impressions_remaining);
            }, 250);
        }
    }, [user?.id]);

    // Immediate positioning to guarantee target reel is aligned once on mount without interfering with user swipe
    useLayoutEffect(() => {
        if (hasPositionedInitialRef.current) return;
        const container = scrollRef.current;
        if (!container) return;

        if (effectiveIndex === 0) {
            container.scrollTop = 0;
            hasPositionedInitialRef.current = true;
            isInitialMountRef.current = false;
            return;
        }

        const alignInitial = () => {
            if (userHasInteractedRef.current) {
                hasPositionedInitialRef.current = true;
                isInitialMountRef.current = false;
                return;
            }
            const h = container.clientHeight || window.innerHeight;
            const targetEl = targetPost ? itemRefs.current[targetPost.id] : null;
            const targetTop = (targetEl && targetEl.offsetTop > 0)
                ? targetEl.offsetTop
                : h * effectiveIndex;
            container.scrollTop = targetTop;
            hasPositionedInitialRef.current = true;
            isInitialMountRef.current = false;
        };

        alignInitial();
        const rafId = requestAnimationFrame(alignInitial);
        return () => cancelAnimationFrame(rafId);
    }, []);

    const scrollEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const settleActiveSnap = useCallback(() => {
        const container = scrollRef.current;
        if (!container || isInitialMountRef.current) return;
        const h = container.clientHeight || window.innerHeight;
        if (h <= 0) return;
        const list = displayPostsRef.current;
        const snapIndex = Math.max(0, Math.min(list.length - 1, Math.round(container.scrollTop / h)));
        const target = list[snapIndex];
        if (target && target.id !== activePostIdRef.current) {
            activatePost(target.id, snapIndex);
        }
    }, [activatePost]);

    // Zero-jank scroll listener: never triggers React re-renders mid-swipe; activates only at snap point or scroll settlement
    const handleScroll = useCallback(() => {
        const container = scrollRef.current;
        if (!container || isInitialMountRef.current) return;

        const h = container.clientHeight || window.innerHeight;
        if (h <= 0) return;
        const list = displayPostsRef.current;
        const snapIndex = Math.round(container.scrollTop / h);
        if (snapIndex >= 0 && snapIndex < list.length) {
            const distFromSnap = Math.abs(container.scrollTop - (snapIndex * h));
            if (distFromSnap <= 6) {
                const target = list[snapIndex];
                if (target && target.id !== activePostIdRef.current) {
                    if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
                    activatePost(target.id, snapIndex);
                    return;
                }
            }
        }

        if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
        scrollEndTimeoutRef.current = setTimeout(settleActiveSnap, 80);
    }, [activatePost, settleActiveSnap]);

    // Native scrollend event listener for instantaneous snap activation
    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;
        const onUserInteract = () => {
            userHasInteractedRef.current = true;
            isInitialMountRef.current = false;
        };
        container.addEventListener('touchstart', onUserInteract, { passive: true });
        container.addEventListener('wheel', onUserInteract, { passive: true });
        container.addEventListener('scrollend', settleActiveSnap, { passive: true });
        return () => {
            container.removeEventListener('touchstart', onUserInteract);
            container.removeEventListener('wheel', onUserInteract);
            container.removeEventListener('scrollend', settleActiveSnap);
            if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
        };
    }, [settleActiveSnap]);

    // Keyboard & mouse-drag vertical navigation support for smooth desktop/laptop & mobile use
    const mouseDragRef = useRef<{ startY: number; startScrollTop: number; isDragging: boolean } | null>(null);
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return;
            const container = scrollRef.current;
            if (!container) return;
            const h = container.clientHeight || window.innerHeight;
            if (e.key === 'ArrowDown' || e.key === 'PageDown') {
                e.preventDefault();
                const nextIdx = Math.min(displayPostsRef.current.length - 1, currentIndexRef.current + 1);
                container.scrollTo({ top: nextIdx * h, behavior: 'smooth' });
            } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
                e.preventDefault();
                const prevIdx = Math.max(0, currentIndexRef.current - 1);
                container.scrollTo({ top: prevIdx * h, behavior: 'smooth' });
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Lock background page scroll while fullscreen viewer is open
    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, []);

    // Unconditionally silence any playing audios when closing or leaving feed viewer
    useEffect(() => {
        return () => {
            const allAudios = document.querySelectorAll('audio');
            allAudios.forEach(a => {
                if (a.id !== 'knock-call-audio') {
                    try {
                        a.pause();
                        a.currentTime = 0;
                    } catch(e) {}
                }
            });
        };
    }, []);

    // Mouse drag support for desktop users who try to drag/swipe down with a mouse
    const dragStateRef = useRef<{ isDown: boolean; startY: number; startScrollTop: number }>({
        isDown: false,
        startY: 0,
        startScrollTop: 0,
    });

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, textarea, [role="button"]')) return;
        const container = scrollRef.current;
        if (!container) return;
        dragStateRef.current = {
            isDown: true,
            startY: e.clientY,
            startScrollTop: container.scrollTop,
        };
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!dragStateRef.current.isDown) return;
        const dy = dragStateRef.current.startY - e.clientY;
        if (Math.abs(dy) < 12) return;
        userHasInteractedRef.current = true;
    }, []);

    const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!dragStateRef.current.isDown) return;
        dragStateRef.current.isDown = false;
        const dy = dragStateRef.current.startY - e.clientY;
        const container = scrollRef.current;
        if (!container || Math.abs(dy) < 55) return;
        const direction = dy > 0 ? 1 : -1;
        const nextIdx = Math.max(0, Math.min(displayPosts.length - 1, currentIndexRef.current + direction));
        if (nextIdx !== currentIndexRef.current) {
            userHasInteractedRef.current = true;
            const vh = container.clientHeight || window.innerHeight || 1;
            container.scrollTo({ top: nextIdx * vh, behavior: 'smooth' });
        }
    }, [displayPosts.length]);

    return createPortal(
        <div 
            className="post-modal-backdrop post-modal-backdrop--fullscreen" 
            style={{ 
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: '100dvh', 
                zIndex: zIndex ?? 100020, 
                overflowY: 'scroll', 
                overflowX: 'hidden',
                scrollSnapType: 'y mandatory', 
                WebkitOverflowScrolling: 'touch',
                overscrollBehaviorY: 'contain',
                touchAction: 'pan-y',
                background: '#000',
                display: 'block',
                willChange: 'scroll-position',
            }} 
            ref={scrollRef}
            onScroll={handleScroll}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {displayPosts.map((rawPost, index) => {
                const post = normalizePost(rawPost) || rawPost;
                // Keep 2 items above and 3 items below mounted so rapid swiping never hits an empty frame
                const isNearActive = (index >= currentIndex - 2) && (index <= currentIndex + 3);
                const isNext = index === currentIndex + 1 || index === currentIndex - 1;
                const preloadMode: 'auto' | 'metadata' = (post.id === activePostId || isNext) ? 'auto' : 'metadata';
                return (
                    <div 
                        key={post.id} 
                        ref={el => { itemRefs.current[post.id] = el; }} 
                        data-postid={post.id}
                        data-category={post.category || 'General'}
                        style={{ 
                            height: '100%', 
                            minHeight: '100%',
                            maxHeight: '100%',
                            width: '100%',
                            scrollSnapAlign: 'start', 
                            scrollSnapStop: 'always', 
                            position: 'relative',
                            overflow: 'hidden',
                            boxSizing: 'border-box',
                            flexShrink: 0,
                            background: '#000',
                            touchAction: 'pan-y',
                            contain: 'layout paint size',
                        }}
                    >
                        {isNearActive ? (
                            <PostModalContent 
                                post={post} 
                                onClose={onClose} 
                                onCommentClick={onCommentClick} 
                                onShareClick={onShareClick} 
                                onLikeToggle={onLikeToggle}
                                onImpToggle={onImpToggle}
                                onDelete={(deletedId) => {
                                    const cleanDeleted = String(deletedId).replace(/_p\d+_\d+$/, '');
                                    setDisplayPosts(prev => {
                                        const next = prev.filter(p => p.id !== deletedId && String(p.id).replace(/_p\d+_\d+$/, '') !== cleanDeleted);
                                        if (next.length === 0) {
                                            setTimeout(() => onClose(), 0);
                                        } else {
                                            const nextIdx = Math.min(index, next.length - 1);
                                            const nextPost = next[nextIdx];
                                            if (nextPost) {
                                                setActivePostId(nextPost.id);
                                                setCurrentIndex(nextIdx);
                                            }
                                        }
                                        return next;
                                    });
                                    if (onDelete) onDelete(deletedId);
                                }}
                                isEmbedded={true}
                                isActive={post.id === activePostId}
                                isMuted={isGlobalMuted}
                                preload={preloadMode}
                                onMuteToggle={(muted) => {
                                    setIsGlobalMuted(muted);
                                    setFeedMutedPreference(muted);
                                }}
                                initialLiked={likedPosts?.[post.id]}
                                initialImped={impedPosts?.[post.id]}
                            />
                        ) : null}
                    </div>
                );
            })}
        </div>,
        document.body
    );
};

export default ExploreFeedViewer;
