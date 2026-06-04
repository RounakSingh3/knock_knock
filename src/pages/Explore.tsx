import React, { useState, useEffect, useContext } from 'react';
import { Search, Loader2, Users, Image, BookOpen, UserPlus, UserCheck } from 'lucide-react';
import { searchUsers, searchPostsByCaption, searchStoriesByHashtag, fetchBoostedStories, checkIfFollowing, toggleFollow, type UserStoryGroup, type StoryData, type ProfileData, type PostData } from '../lib/database';
import { CONTENT_CATEGORIES } from '../lib/algorithm';
import StoryViewer from '../components/StoryViewer';
import PostMedia from '../components/PostMedia';
import { AppContext } from '../App';
import { useNavigate } from 'react-router-dom';

function groupByUser(stories: StoryData[]): UserStoryGroup[] {
    const groups: Record<string, UserStoryGroup> = {};
    stories.forEach(s => {
        const uid = s.user_id || 'unknown';
        if (!groups[uid]) {
            groups[uid] = { userId: uid, username: s.username || 'user', avatarUrl: `https://i.pravatar.cc/150?u=${s.username || uid}`, stories: [] };
        }
        groups[uid].stories.push(s);
    });
    return Object.values(groups);
}

const Explore = () => {
    const { user } = useContext(AppContext);
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'people' | 'posts' | 'stories'>('people');
    const [loading, setLoading] = useState(false);

    // People results
    const [peopleResults, setPeopleResults] = useState<ProfileData[]>([]);
    const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

    // Posts results
    const [postResults, setPostResults] = useState<PostData[]>([]);

    // Stories results
    const [storyResults, setStoryResults] = useState<UserStoryGroup[]>([]);
    const [activeStoryGroupIndex, setActiveStoryGroupIndex] = useState<number | null>(null);

    // Category filter
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.trim().length < 2 && !selectedCategory) {
                setPeopleResults([]);
                setPostResults([]);
                if (activeTab === 'stories') {
                    setLoading(true);
                    fetchBoostedStories().then(data => {
                        setStoryResults(groupByUser(data));
                        setLoading(false);
                    });
                }
                return;
            }
            performSearch();
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm, activeTab, selectedCategory]);

    const performSearch = async () => {
        setLoading(true);
        const query = searchTerm.trim();

        if (activeTab === 'people' && query.length >= 2) {
            const results = await searchUsers(query);
            setPeopleResults(results);
            // Check follow status for each
            if (user) {
                const map: Record<string, boolean> = {};
                await Promise.all(results.map(async (p) => {
                    if (p.id !== user.id) {
                        map[p.id] = await checkIfFollowing(user.id, p.id);
                    }
                }));
                setFollowingMap(map);
            }
        } else if (activeTab === 'posts') {
            let results = await searchPostsByCaption(query || '%');
            if (selectedCategory) {
                results = results.filter(p => p.category === selectedCategory);
            }
            setPostResults(results);
        } else if (activeTab === 'stories') {
            if (query) {
                const term = query.startsWith('#') ? query.substring(1) : query;
                const data = await searchStoriesByHashtag(term);
                setStoryResults(data);
            } else {
                const data = await fetchBoostedStories();
                setStoryResults(groupByUser(data));
            }
        }
        setLoading(false);
    };

    const handleToggleFollow = async (profileId: string) => {
        if (!user) return;
        const isFollowing = followingMap[profileId] || false;
        await toggleFollow(user.id, profileId, isFollowing);
        setFollowingMap(prev => ({ ...prev, [profileId]: !isFollowing }));
    };

    const tabStyle = (tab: string) => ({
        flex: 1, padding: '10px', background: 'none', border: 'none',
        color: activeTab === tab ? '#ff3366' : '#8e8e93',
        borderBottom: activeTab === tab ? '2px solid #ff3366' : '2px solid transparent',
        fontWeight: activeTab === tab ? 'bold' as const : 'normal' as const,
        fontSize: '14px', cursor: 'pointer' as const,
        display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: '6px',
    });

    return (
        <div className="explore-page pb-20" style={{ background: '#000', minHeight: '100vh' }}>
            {/* Search Bar */}
            <div style={{ padding: '16px', paddingBottom: '8px' }}>
                <div style={{
                    background: '#1c1c1e', padding: '10px 16px', borderRadius: '14px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                    <Search size={20} color="#8e8e93" />
                    <input
                        type="text"
                        placeholder={activeTab === 'people' ? 'Search people...' : activeTab === 'posts' ? 'Search posts...' : 'Search #hashtags...'}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '15px' }}
                    />
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #2c2c2e' }}>
                <button onClick={() => setActiveTab('people')} style={tabStyle('people')}>
                    <Users size={16} /> People
                </button>
                <button onClick={() => setActiveTab('posts')} style={tabStyle('posts')}>
                    <Image size={16} /> Posts
                </button>
                <button onClick={() => setActiveTab('stories')} style={tabStyle('stories')}>
                    <BookOpen size={16} /> Stories
                </button>
            </div>

            {/* Category Chips (for Posts tab) */}
            {activeTab === 'posts' && (
                <div style={{
                    display: 'flex', gap: '8px', padding: '12px 16px',
                    overflowX: 'auto', WebkitOverflowScrolling: 'touch',
                }}>
                    <button
                        onClick={() => { setSelectedCategory(null); }}
                        style={{
                            background: !selectedCategory ? '#ff3366' : '#2c2c2e',
                            color: '#fff', border: 'none', borderRadius: '16px',
                            padding: '6px 14px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                    >All</button>
                    {CONTENT_CATEGORIES.filter(c => c !== 'General').map(cat => (
                        <button
                            key={cat}
                            onClick={() => { setSelectedCategory(cat); }}
                            style={{
                                background: selectedCategory === cat ? '#ff3366' : '#2c2c2e',
                                color: '#fff', border: 'none', borderRadius: '16px',
                                padding: '6px 14px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                        >{cat}</button>
                    ))}
                </div>
            )}

            {/* Content */}
            <div style={{ padding: '8px 16px' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#8e8e93' }} />
                    </div>
                ) : (
                    <>
                        {/* People Tab */}
                        {activeTab === 'people' && (
                            searchTerm.trim().length < 2 ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: '#8e8e93' }}>
                                    Type at least 2 characters to search people
                                </div>
                            ) : peopleResults.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: '#8e8e93' }}>
                                    No users found for "{searchTerm}"
                                </div>
                            ) : (
                                peopleResults.map(person => (
                                    <div key={person.id} style={{
                                        display: 'flex', alignItems: 'center', padding: '14px 0',
                                        borderBottom: '1px solid #1c1c1e',
                                    }}>
                                        <img
                                            src={person.avatar_url || 'https://i.pravatar.cc/150'}
                                            alt="" onClick={() => navigate(`/profile/${person.username}`)}
                                            style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', marginRight: '14px', cursor: 'pointer' }}
                                        />
                                        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/profile/${person.username}`)}>
                                            <h4 style={{ margin: 0, color: '#fff', fontSize: '15px', fontWeight: '600' }}>{person.username}</h4>
                                            {person.bio && <p style={{ margin: '2px 0 0', color: '#8e8e93', fontSize: '13px' }}>{person.bio}</p>}
                                        </div>
                                        {user && person.id !== user.id && (
                                            <button
                                                onClick={() => handleToggleFollow(person.id)}
                                                style={{
                                                    background: followingMap[person.id] ? 'transparent' : '#ff3366',
                                                    border: followingMap[person.id] ? '1px solid #3a3a3c' : 'none',
                                                    color: '#fff', borderRadius: '20px',
                                                    padding: '8px 18px', fontSize: '13px', fontWeight: 'bold',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                                }}
                                            >
                                                {followingMap[person.id] ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
                                            </button>
                                        )}
                                    </div>
                                ))
                            )
                        )}

                        {/* Posts Tab */}
                        {activeTab === 'posts' && (
                            postResults.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: '#8e8e93' }}>
                                    {searchTerm.trim() || selectedCategory ? 'No posts found' : 'Search for posts or pick a category'}
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                                    {postResults.map(post => (
                                        <div key={post.id} style={{ aspectRatio: '1', position: 'relative', cursor: 'pointer' }} onClick={() => navigate(`/profile/${post.username}`)}>
                                            <PostMedia post={post} className="" muted loop playsInline autoPlay={false}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            {post.category && post.category !== 'General' && (
                                                <span style={{
                                                    position: 'absolute', bottom: '4px', left: '4px',
                                                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                                                    fontSize: '10px', padding: '2px 6px', borderRadius: '6px',
                                                }}>{post.category}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* Stories Tab */}
                        {activeTab === 'stories' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                                {storyResults.length > 0 ? (
                                    storyResults.map((group, idx) => (
                                        <div key={group.userId} style={{ position: 'relative', aspectRatio: '9/16', cursor: 'pointer' }} onClick={() => setActiveStoryGroupIndex(idx)}>
                                            <img src={group.stories[0].image_url} alt="" loading="lazy" style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                                            <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.5)', padding: '3px 8px', borderRadius: '10px' }}>
                                                <img src={group.avatarUrl} alt="" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
                                                <span style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>{group.username}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: '#8e8e93' }}>
                                        No stories found
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {activeStoryGroupIndex !== null && (
                <StoryViewer
                    storyGroups={storyResults}
                    initialGroupIndex={activeStoryGroupIndex}
                    currentUserId={user?.id}
                    onClose={() => setActiveStoryGroupIndex(null)}
                    onGroupsUpdated={setStoryResults}
                />
            )}
        </div>
    );
};

export default Explore;
