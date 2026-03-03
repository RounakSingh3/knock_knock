import React, { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { fetchExplorePosts, type PostData } from '../lib/database';

const Explore = () => {
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
            <div className="search-bar">
                <Search size={20} color="#8e8e93" />
                <input
                    type="text"
                    placeholder="Search for people or posts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
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
