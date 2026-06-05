import React, { useRef, useEffect, useContext, useState } from 'react';
import { type PostData, trackEngagement } from '../lib/database';
import { PostModalContent } from './PostModal';
import { AppContext } from '../App';

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
    const [activePostId, setActivePostId] = useState<string | null>(posts[initialIndex]?.id || null);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo(0, scrollRef.current.clientHeight * initialIndex);
        }
    }, [initialIndex]);

    useEffect(() => {
        if (!user || !scrollRef.current) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const postId = entry.target.getAttribute('data-postid');
                const category = entry.target.getAttribute('data-category') || 'General';
                if (!postId) return;

                if (entry.isIntersecting) {
                    setActivePostId(postId);
                    const idx = posts.findIndex(p => p.id === postId);
                    if (idx !== -1) setCurrentIndex(idx);
                    
                    watchTimers.current[postId] = Date.now();
                    trackEngagement(user.id, postId, 'view', 1, category).catch(() => {});
                } else {
                    const startTime = watchTimers.current[postId];
                    if (startTime) {
                        const durationSeconds = (Date.now() - startTime) / 1000;
                        if (durationSeconds > 0.5) {
                            trackEngagement(user.id, postId, 'watch_time', durationSeconds, category).catch(() => {});
                        }
                        delete watchTimers.current[postId];
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
            // Optional: flush any remaining watch time when component unmounts
            Object.entries(watchTimers.current).forEach(([pId, startT]) => {
                const durationSeconds = (Date.now() - startT) / 1000;
                if (durationSeconds > 0.5) {
                    // We don't have the category easily here, but we can just use General as fallback
                    trackEngagement(user.id, pId, 'watch_time', durationSeconds, 'General').catch(() => {});
                }
            });
        };
    }, [user, posts]);

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
            {posts.map((post, index) => {
                const isNear = Math.abs(index - currentIndex) <= 2;
                return (
                    <div 
                        key={post.id} 
                        ref={el => { itemRefs.current[post.id] = el; }} 
                        data-postid={post.id}
                        data-category={post.category || 'General'}
                        style={{ height: '100%', scrollSnapAlign: 'start', width: '100%', position: 'relative' }}
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
                            <div style={{ width: '100%', height: '100%', background: '#000' }} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ExploreFeedViewer;
