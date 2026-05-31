import React, { useState, useEffect, useContext } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { searchStoriesByHashtag, fetchBoostedStories, type UserStoryGroup, type StoryData } from '../lib/database';
import StoryViewer from '../components/StoryViewer';
import { AppContext } from '../App';

/** Helper to group flat stories into user groups */
function groupByUser(stories: StoryData[]): UserStoryGroup[] {
    const groups: Record<string, UserStoryGroup> = {};
    stories.forEach(s => {
        const uid = s.user_id || 'unknown';
        if (!groups[uid]) {
            groups[uid] = {
                userId: uid,
                username: s.username || 'user',
                avatarUrl: `https://i.pravatar.cc/150?u=${s.username || uid}`,
                stories: [],
            };
        }
        groups[uid].stories.push(s);
    });
    return Object.values(groups);
}

const Explore = () => {
    const { user } = useContext(AppContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchedStories, setSearchedStories] = useState<UserStoryGroup[]>([]);
    const [searchingStories, setSearchingStories] = useState(false);
    const [activeStoryGroupIndex, setActiveStoryGroupIndex] = useState<number | null>(null);

    // Effect for Story Searching
    useEffect(() => {
        setSearchingStories(true);
        if (searchTerm.trim()) {
            const term = searchTerm.startsWith('#') ? searchTerm.substring(1) : searchTerm;
            searchStoriesByHashtag(term).then(data => {
                setSearchedStories(data);
                setSearchingStories(false);
            });
        } else {
            fetchBoostedStories().then(data => {
                setSearchedStories(groupByUser(data));
                setSearchingStories(false);
            });
        }
    }, [searchTerm]);

    return (
        <div className="explore-page pb-20">
            <div style={{ display: 'flex', gap: '8px', padding: '16px', alignItems: 'center' }}>
                <div className="search-bar" style={{ flex: 1, margin: 0, background: '#1c1c1e', padding: '10px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Search size={20} color="#8e8e93" />
                    <input
                        type="text"
                        placeholder="Search stories by #hashtag..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }}
                    />
                </div>
            </div>

            <div className="explore-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                {searchingStories ? (
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#8e8e93' }} />
                    </div>
                ) : searchedStories.length > 0 ? (
                    searchedStories.map((group, idx) => (
                        <div 
                            key={group.userId} 
                            className="explore-item" 
                            style={{ position: 'relative', aspectRatio: '9/16', cursor: 'pointer' }}
                            onClick={() => setActiveStoryGroupIndex(idx)}
                        >
                            <img 
                                src={group.stories[0].image_url} 
                                alt={group.stories[0].caption || 'Story'} 
                                loading="lazy" 
                                style={{ height: '100%', width: '100%', objectFit: 'cover' }} 
                            />
                            {/* Profile Overlay */}
                            <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: '12px', backdropFilter: 'blur(4px)' }}>
                                <img src={group.avatarUrl} alt={group.username} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                                <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold' }}>{group.username}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: '#8e8e93' }}>
                        No stories found for "{searchTerm}".
                    </div>
                )}
            </div>

            {/* Story Viewer Overlay */}
            {activeStoryGroupIndex !== null && (
                <StoryViewer 
                    storyGroups={searchedStories} 
                    initialGroupIndex={activeStoryGroupIndex} 
                    currentUserId={user?.id}
                    onClose={() => setActiveStoryGroupIndex(null)}
                    onGroupsUpdated={setSearchedStories}
                />
            )}
        </div>
    );
};

export default Explore;
