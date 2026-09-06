import React, { useRef, useEffect, useLayoutEffect, useContext, useState } from 'react';
import { type PostData, trackEngagement, normalizePost } from '../lib/database';
import { PostModalContent } from './PostModal';
import { AppContext } from '../context/AppContext';

interface ExploreFeedViewerProps {
    posts: PostData[];
    initialIndex: number;
    onClose: () => void;
    onCommentClick: (postId: string) => void;
    onShareClick: (post: PostData) => void;
}

const ExploreFeedViewer: React.FC<ExploreFeedViewerProps> = ({ posts, initialIndex, onClose, onCommentClick, onShareClick }) => {
    const { user } = useContext(AppContext);
    const scrollRef = useRef<HTMLDivElement>(null);
    const watchTimers = useRef<Record<string, number>>({});
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const targetPost = posts[initialIndex] || posts[0];
    const [activePostId, setActivePostId] = useState<string | null>(targetPost?.id || null);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const isInitialMountRef = useRef(true);

    // Immediate layout positioning to guarantee target reel is active and visible
    useLayoutEffect(() => {
        if (!scrollRef.current || !targetPost) return;
        const targetEl = itemRefs.current[targetPost.id];
        if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
        } else {
            scrollRef.current.scrollTop = scrollRef.current.clientHeight * initialIndex;
        }
    }, [initialIndex, targetPost]);

    // Secondary alignment after backdrop mount
    useEffect(() => {
        const scrollToInitial = () => {
            if (!scrollRef.current || !targetPost) return;
            const targetEl = itemRefs.current[targetPost.id];
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
            } else {
                scrollRef.current.scrollTop = scrollRef.current.clientHeight * initialIndex;
            }
        };

        scrollToInitial();
        const timer = setTimeout(() => {
            scrollToInitial();
            // Unlock observer after scroll settling
            isInitialMountRef.current = false;
        }, 200);

        return () => clearTimeout(timer);
    }, [initialIndex, targetPost]);

    // Responsive IntersectionObserver for swiping/scrolling between reels
    useEffect(() => {
        if (!scrollRef.current) return;
        
        const observer = new IntersectionObserver((entries) => {
            // Do not let initial rendering overrides the clicked reel
            if (isInitialMountRef.current) return;

            entries.forEach(entry => {
                const postId = entry.target.getAttribute('data-postid');
                const category = entry.target.getAttribute('data-category') || 'General';
                if (!postId) return;

                if (entry.isIntersecting) {
                    setActivePostId(postId);
                    const idx = posts.findIndex(p => p.id === postId);
                    if (idx !== -1) setCurrentIndex(idx);
                    
                    if (user) {
                        watchTimers.current[postId] = Date.now();
                        trackEngagement(user.id, postId, 'view', 1, category).catch(() => {});
                    }
                } else {
                    if (user) {
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
            threshold: 0.6
        });

        Object.values(itemRefs.current).forEach(el => {
            if (el) observer.observe(el);
        });

        return () => {
            observer.disconnect();
            if (user) {
                Object.entries(watchTimers.current).forEach(([pId, startT]) => {
                    const durationSeconds = (Date.now() - startT) / 1000;
                    if (durationSeconds > 0.5) {
                        trackEngagement(user.id, pId, 'watch_time', durationSeconds, 'General').catch(() => {});
                    }
                });
            }
        };
    }, [user, posts]);

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

    return (
        <div 
            className="post-modal-backdrop post-modal-backdrop--fullscreen" 
            onClick={onClose} 
            style={{ 
                zIndex: 9999, 
                overflowY: 'auto', 
                scrollSnapType: 'y mandatory', 
                scrollBehavior: 'auto',
                display: 'block'
            }} 
            ref={scrollRef}
        >
            {posts.map((rawPost, index) => {
                const post = normalizePost(rawPost) || rawPost;
                const isNear = Math.abs(index - currentIndex) <= 2;
                return (
                    <div 
                        key={post.id} 
                        ref={el => { itemRefs.current[post.id] = el; }} 
                        data-postid={post.id}
                        data-category={post.category || 'General'}
                        style={{ height: '100%', scrollSnapAlign: 'start', scrollSnapStop: 'always', width: '100%', position: 'relative' }}
                    >
                        {isNear ? (
                            <PostModalContent 
                                post={post} 
                                onClose={onClose} 
                                onCommentClick={onCommentClick} 
                                onShareClick={onShareClick} 
                                isEmbedded={true}
                                isActive={post.id === activePostId}
                            />
                        ) : (
                            <div style={{ width: '100%', height: '100%', background: 'var(--bg-color)' }} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ExploreFeedViewer;
