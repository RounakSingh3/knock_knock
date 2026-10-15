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

    // Resolve target post in deduped stream
    const resolvedInitialIndex = displayPosts.findIndex(p => p.id === initialPost?.id);
    const effectiveIndex = resolvedInitialIndex !== -1 ? resolvedInitialIndex : (initialIndex < displayPosts.length ? initialIndex : 0);
    const targetPost = displayPosts[effectiveIndex] || initialPost;

    const [currentIndex, setCurrentIndex] = useState(effectiveIndex);
    const [activePostId, setActivePostId] = useState<string | null>(targetPost?.id || null);
    const activePostIdRef = useRef<string | null>(targetPost?.id || null);
    useEffect(() => { activePostIdRef.current = activePostId; }, [activePostId]);
    const [isGlobalMuted, setIsGlobalMuted] = useState(() => getFeedMutedPreference());
    const isInitialMountRef = useRef(true);
    const hasPositionedInitialRef = useRef(false);

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
        activePostIdRef.current = postId;
        setActivePostId(postId);
        const resolvedIdx = index !== undefined ? index : displayPosts.findIndex(p => p.id === postId);
        if (resolvedIdx !== -1) setCurrentIndex(resolvedIdx);

        if (user) {
            watchTimers.current[postId] = Date.now();
            const currentPost = displayPosts.find(p => p.id === postId);
            const category = currentPost?.category || 'General';
            trackEngagement(user.id, postId, 'view', 1, category).catch(() => {});
            recordPostScreenDelivery(postId, user.id, currentPost?.boost_impressions_remaining);
        }
    }, [displayPosts, user]);

    // Keep isInitialMountRef active only until initial scroll positions so IntersectionObserver doesn't override target reel
    useEffect(() => {
        if (effectiveIndex === 0) {
            isInitialMountRef.current = false;
            return;
        }
        isInitialMountRef.current = true;
        const timer = setTimeout(() => {
            isInitialMountRef.current = false;
        }, 120);

        // Immediate unblock if user explicitly initiates a touch or wheel interaction
        const container = scrollRef.current;
        const onUserTouch = () => {
            isInitialMountRef.current = false;
        };
        if (container) {
            container.addEventListener('touchstart', onUserTouch, { passive: true });
            container.addEventListener('wheel', onUserTouch, { passive: true });
        }

        return () => {
            clearTimeout(timer);
            if (container) {
                container.removeEventListener('touchstart', onUserTouch);
                container.removeEventListener('wheel', onUserTouch);
            }
        };
    }, [effectiveIndex, targetPost?.id]);

    // Immediate positioning to guarantee target reel is aligned once on mount without layout jump
    useLayoutEffect(() => {
        if (hasPositionedInitialRef.current) return;
        const container = scrollRef.current;
        if (!container) return;

        const scrollToTarget = () => {
            if (hasPositionedInitialRef.current) return;
            const targetEl = targetPost ? itemRefs.current[targetPost.id] : null;
            const targetTop = (targetEl && targetEl.offsetTop > 0)
                ? targetEl.offsetTop
                : (container.clientHeight || window.innerHeight) * effectiveIndex;
            container.scrollTo({ top: targetTop, behavior: 'instant' as ScrollBehavior });
        };

        scrollToTarget();
        const rafId = requestAnimationFrame(scrollToTarget);
        const t1 = setTimeout(() => {
            scrollToTarget();
            hasPositionedInitialRef.current = true;
            isInitialMountRef.current = false;
        }, 120);

        return () => {
            cancelAnimationFrame(rafId);
            clearTimeout(t1);
        };
    }, []);

    const scrollEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounced scroll listener to smoothly activate post when scroll snap settles without mid-drag stutter
    const handleScroll = useCallback(() => {
        const container = scrollRef.current;
        if (!container) return;
        // Do NOT switch active post while programmatic initial scroll is positioning
        if (isInitialMountRef.current) return;

        if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
        scrollEndTimeoutRef.current = setTimeout(() => {
            const h = container.clientHeight || window.innerHeight;
            if (h <= 0) return;
            const snapIndex = Math.round(container.scrollTop / h);
            if (snapIndex >= 0 && snapIndex < displayPosts.length) {
                const target = displayPosts[snapIndex];
                if (target && target.id !== activePostIdRef.current) {
                    activatePost(target.id, snapIndex);
                }
            }
        }, 50);
    }, [displayPosts, activatePost]);

    // Responsive IntersectionObserver for swiping/scrolling between reels
    useEffect(() => {
        if (!scrollRef.current) return;
        
        const observer = new IntersectionObserver((entries) => {
            if (isInitialMountRef.current) return;

            const intersecting = entries.filter(e => e.isIntersecting && e.intersectionRatio >= 0.65);
            if (intersecting.length > 0) {
                const dominant = intersecting.reduce((prev, curr) => 
                    curr.intersectionRatio > prev.intersectionRatio ? curr : prev
                );
                const postId = dominant.target.getAttribute('data-postid');
                if (postId && postId !== activePostIdRef.current) {
                    activatePost(postId);
                }
            }

            entries.forEach(entry => {
                if (!entry.isIntersecting) {
                    const postId = entry.target.getAttribute('data-postid');
                    const category = entry.target.getAttribute('data-category') || 'General';
                    if (postId && user) {
                        const startTime = watchTimers.current[postId];
                        if (startTime) {
                            const durationSeconds = (Date.now() - startTime) / 1000;
                            if (durationSeconds > 0.5) {
                                trackEngagement(user.id, postId, 'watch_time', durationSeconds, category).catch(() => {});
                            }
                            delete watchTimers.current[postId];
                        }
                    }
                }
            });
        }, {
            root: scrollRef.current,
            threshold: [0.65, 0.85]
        });

        Object.values(itemRefs.current).forEach(el => {
            if (el) observer.observe(el);
        });

        return () => {
            observer.disconnect();
            if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
            if (user) {
                Object.entries(watchTimers.current).forEach(([pId, startT]) => {
                    const durationSeconds = (Date.now() - startT) / 1000;
                    if (durationSeconds > 0.5) {
                        trackEngagement(user.id, pId, 'watch_time', durationSeconds, 'General').catch(() => {});
                    }
                });
            }
        };
    }, [user?.id, displayPosts.length, activatePost]);

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
                scrollSnapType: 'y mandatory', 
                WebkitOverflowScrolling: 'touch',
                overscrollBehaviorY: 'contain',
                background: '#000',
                display: 'block',
                willChange: 'scroll-position',
                transform: 'translateZ(0)',
            }} 
            ref={scrollRef}
            onScroll={handleScroll}
        >
            {displayPosts.map((rawPost, index) => {
                const post = normalizePost(rawPost) || rawPost;
                const isNearActive = (index === effectiveIndex) || Math.abs(index - currentIndex) <= 1;
                const isNext = index === currentIndex + 1;
                const preloadMode: 'auto' | 'metadata' = (post.id === activePostId || isNext) ? 'auto' : 'metadata';
                return (
                    <div 
                        key={post.id} 
                        ref={el => { itemRefs.current[post.id] = el; }} 
                        data-postid={post.id}
                        data-category={post.category || 'General'}
                        style={{ 
                            height: '100dvh', 
                            minHeight: '100dvh',
                            maxHeight: '100dvh',
                            width: '100vw',
                            scrollSnapAlign: 'start', 
                            scrollSnapStop: 'always', 
                            position: 'relative',
                            overflow: 'hidden',
                            boxSizing: 'border-box',
                            flexShrink: 0,
                            background: '#000',
                            transform: 'translateZ(0)',
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
                                onDelete={onDelete}
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
