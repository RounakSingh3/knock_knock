import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../App';
import Post from '../components/Post';
import { fetchPosts, type PostData } from '../lib/database';
import { Loader2 } from 'lucide-react';

const Home = () => {
    const { signOut } = useContext(AppContext);
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPosts()
            .then(data => {
                setPosts(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch posts:', err);
                setError('Failed to load posts. Please check your connection and try again.');
                setLoading(false);
            });
    }, []);

    return (
        <div className="home-page pb-20">
            {/* Top Bar */}
            <header className="home-header">
                <h1 className="app-title">Knock Knock</h1>
                <div className="header-actions">
                    <button
                        onClick={signOut}
                        style={{
                            background: 'none',
                            border: '1px solid rgba(255,255,255,0.15)',
                            color: '#8e8e93',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '13px',
                            cursor: 'pointer',
                        }}
                    >
                        Sign Out
                    </button>
                </div>
            </header>

            {/* Feed */}
            <div className="feed-container">
                {error ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#ff3b30' }}>
                        <p>{error}</p>
                        <button
                            onClick={() => { setError(''); setLoading(true); fetchPosts().then(data => { setPosts(data); setLoading(false); }).catch(() => { setError('Failed to load posts.'); setLoading(false); }); }}
                            style={{ marginTop: '1rem', padding: '8px 20px', background: 'rgba(255,51,102,0.2)', border: '1px solid #ff3366', borderRadius: '8px', color: '#ff3366', cursor: 'pointer' }}
                        >
                            Retry
                        </button>
                    </div>
                ) : loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#8e8e93' }} />
                    </div>
                ) : posts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#8e8e93' }}>
                        <p>No posts yet. Be the first to post!</p>
                    </div>
                ) : (
                    posts.map((post) => (
                        <Post
                            key={post.id}
                            id={post.id}
                            username={post.username}
                            avatarUrl={post.avatar_url || 'https://i.pravatar.cc/150'}
                            imageUrl={post.image_url}
                            likes={post.likes_count}
                            caption={post.caption || ''}
                            attachedLink={post.attached_link}
                            timeAgo={getTimeAgo(post.created_at)}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

function getTimeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
}

export default Home;
