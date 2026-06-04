import React, { useRef, useEffect } from 'react';
import { type PostData } from '../lib/database';
import { PostModalContent } from './PostModal';

interface ExploreFeedViewerProps {
    posts: PostData[];
    initialIndex: number;
    onClose: () => void;
    onCommentClick: (postId: string) => void;
    onShareClick: (post: PostData) => void;
}

const ExploreFeedViewer: React.FC<ExploreFeedViewerProps> = ({ posts, initialIndex, onClose, onCommentClick, onShareClick }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo(0, scrollRef.current.clientHeight * initialIndex);
        }
    }, [initialIndex]);

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
            {posts.map((post) => (
                <div key={post.id} style={{ height: '100%', scrollSnapAlign: 'start', width: '100%', position: 'relative' }}>
                    <PostModalContent 
                        post={post} 
                        onClose={onClose} 
                        onCommentClick={onCommentClick} 
                        onShareClick={onShareClick} 
                        isEmbedded={true}
                    />
                </div>
            ))}
        </div>
    );
};

export default ExploreFeedViewer;
