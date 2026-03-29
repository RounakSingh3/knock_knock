import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Film, Grid3X3, Star } from 'lucide-react';
import { fetchExplorePosts, type PostData } from '../lib/database';

const Explore = () => {
    const navigate = useNavigate();
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchExplorePosts().then(data => {
            setPosts(data);
            setLoading(false);
        });
    }, []);

    // Generate fallback images if no posts from DB
    const fallbackImages = Array.from({ length: 18 }).map((_, i) =>
        `https://images.unsplash.com/photo-${1600000000000 + i * 50000}?w=400&q=80`
    );

    const filteredPosts = searchTerm
        ? posts.filter(p =>
            p.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.caption && p.caption.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        : posts;

    return (
        <div className="explore-page pb-20">
            <div style={{ display: 'flex', gap: '8px', padding: '0 12px 16px', alignItems: 'center' }}>
                <div className="search-bar" style={{ flex: 1, margin: 0 }}>
                    <Search size={20} color="#8e8e93" />
                    <input
                        type="text"
                        placeholder="Search for people or posts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button style={{ 
                    background: 'var(--surface-color)', 
                    border: 'none', 
                    borderRadius: '12px', 
                    padding: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    cursor: 'pointer'
                }}>
                    <Star size={24} color="#facc15" />
                </button>
            </div>

            {/* Tabs */}
            <div className="explore-tabs">
                <button className="explore-tab active">
                    <Grid3X3 size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    For You
                </button>
                <button className="explore-tab" onClick={() => navigate('/reels')}>
                    <Film size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    Videos
                </button>
            </div>

            <div className="explore-grid">
                {loading ? (
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#8e8e93' }} />
                    </div>
                ) : filteredPosts.length > 0 ? (
                    filteredPosts.map((post) => (
                        <div key={post.id} className="explore-item">
                            <img src={post.image_url} alt={post.caption || 'Explore'} loading="lazy" />
                        </div>
                    ))
                ) : (
                    // Fallback to generated images
                    fallbackImages.map((img, i) => (
                        <div key={i} className="explore-item">
                            <img src={img} alt={`Explore ${i}`} loading="lazy" />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Explore;
