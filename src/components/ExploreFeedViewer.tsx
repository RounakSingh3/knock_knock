import React, { useRef, useEffect, useLayoutEffect, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { type PostData, trackEngagement, normalizePost } from '../lib/database';
import { PostModalContent } from './PostModal';
import { AppContext } from '../context/AppContext';
import { getFeedMutedPreference, setFeedMutedPreference } from '../lib/media';

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
    const [isGlobalMuted, setIsGlobalMuted] = useState(() => getFeedMutedPreference());
    const isInitialMountRef = useRef(true);

    // Immediate positioning to guarantee target reel is active without layout jump
    useLayoutEffect(() => {
        if (!scrollRef.current) return;
        const container = scrollRef.current;
        const targetEl = targetPost ? itemRefs.current[targetPost.id] : null;
        if (targetEl) {
            container.scrollTop = targetEl.offsetTop;
        } else {
            container.scrollTop = container.clientHeight * initialIndex;
        }
        const t = setTimeout(() => {
            isInitialMountRef.current = false;
        }, 100);
        return () => clearTimeout(t);
    }, [initialIndex, targetPost]);

    // Responsive IntersectionObserver for swiping/scrolling between reels
    useEffect(() => {
        if (!scrollRef.current) return;
        
        const observer = new IntersectionObserver((entries) => {
            if (isInitialMountRef.current) return;

            const intersecting = entries.filter(e => e.isIntersecting);
            if (intersecting.length > 0) {
                const dominant = intersecting.reduce((prev, curr) => 
                    curr.intersectionRatio > prev.intersectionRatio ? curr : prev
                );
                const postId = dominant.target.getAttribute('data-postid');
                const category = dominant.target.getAttribute('data-category') || 'General';
                
                if (postId && postId !== activePostId) {
                    setActivePostId(postId);
                    const idx = posts.findIndex(p => p.id === postId);
                    if (idx !== -1) setCurrentIndex(idx);

                    if (user) {
                        watchTimers.current[postId] = Date.now();
                        trackEngagement(user.id, postId, 'view', 1, category).catch(() => {});
                    }
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
            threshold: [0.4, 0.7, 0.9]
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
    }, [user?.id, posts, activePostId]);

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
                height: '100%',
                zIndex: 99999, 
                overflowY: 'scroll', 
                scrollSnapType: 'y mandatory', 
                WebkitOverflowScrolling: 'touch',
                overscrollBehaviorY: 'contain',
                background: '#000',
                display: 'block'
            }} 
            ref={scrollRef}
        >
            {posts.map((rawPost, index) => {
                const post = normalizePost(rawPost) || rawPost;
                const isNear = Math.abs(index - currentIndex) <= 3;
                return (
                    <div 
                        key={post.id} 
                        ref={el => { itemRefs.current[post.id] = el; }} 
                        data-postid={post.id}
                        data-category={post.category || 'General'}
                        style={{ 
                            height: '100%', 
                            width: '100%',
                            scrollSnapAlign: 'start', 
                            scrollSnapStop: 'always', 
                            position: 'relative',
                            overflow: 'hidden',
                            boxSizing: 'border-box'
                        }}
                    >
                        {isNear ? (
                            <PostModalContent 
                                post={post} 
                                onClose={onClose} 
                                onCommentClick={onCommentClick} 
                                onShareClick={onShareClick} 
                                isEmbedded={true}
                                isActive={post.id === activePostId}
                                isMuted={isGlobalMuted}
                                onMuteToggle={(muted) => {
                                    setIsGlobalMuted(muted);
                                    setFeedMutedPreference(muted);
                                }}
                            />
                        ) : (
                            <div style={{ width: '100%', height: '100%', background: '#000' }} />
                        )}
                    </div>
                );
            })}
        </div>,
        document.body
    );
};

export default ExploreFeedViewer;
