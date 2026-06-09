import React, { useState, useEffect, useContext } from 'react';
import { Search, Loader2, Users, Image, BookOpen, UserPlus, UserCheck, RefreshCw, Play } from 'lucide-react';
import { searchUsers, searchPostsByCaption, searchStoriesByHashtag, fetchBoostedStories, checkIfFollowing, toggleFollow, fetchDiscoverPosts, fetchUserEngagements, type UserStoryGroup, type StoryData, type ProfileData, type PostData, type MessageData } from '../lib/database';
import { CONTENT_CATEGORIES, buildInterestProfile, assembleFeed, shuffleFeedForRefresh } from '../lib/algorithm';
import StoryViewer from '../components/StoryViewer';
import PostMedia from '../components/PostMedia';
import { AppContext } from '../App';
import { useNavigate } from 'react-router-dom';
import ExploreFeedViewer from '../components/ExploreFeedViewer';
import CommentsSheet from '../components/CommentsSheet';
import ShareModal from '../components/ShareModal';
import ChatPanel from '../components/ChatPanel';
import PullToRefresh from '../components/PullToRefresh';
import { isVideoPost } from '../lib/media';

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
    
    // Discover (Default) State
    const [discoverPosts, setDiscoverPosts] = useState<PostData[]>([]);
    const [isDiscoverLoading, setIsDiscoverLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Search Results State
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [peopleResults, setPeopleResults] = useState<ProfileData[]>([]);
    const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
    const [postResults, setPostResults] = useState<PostData[]>([]);
    const [storyResults, setStoryResults] = useState<UserStoryGroup[]>([]);
    const [activeStoryGroupIndex, setActiveStoryGroupIndex] = useState<number | null>(null);

    // Post Modal State
    const [activeFeedState, setActiveFeedState] = useState<{ posts: PostData[], index: number } | null>(null);
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [postToShare, setPostToShare] = useState<PostData | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatUserId, setChatUserId] = useState<string | null>(null);
    const [chatRefreshKey, setChatRefreshKey] = useState(0);
    const [pendingShare, setPendingShare] = useState<{ receiverId: string; message: MessageData } | null>(null);

    const [isRefreshing, setIsRefreshing] = useState(false);

    // Load Discover Feed
    const loadDiscoverFeed = async () => {
        setIsDiscoverLoading(true);
        try {
            const rawPosts = await fetchDiscoverPosts(selectedCategory, 100);
            if (user) {
                const engagements = await fetchUserEngagements(user.id);
                const profile = buildInterestProfile(engagements);
                const scoredPosts = assembleFeed(rawPosts, profile, 0, 30);
                const shuffled = shuffleFeedForRefresh(scoredPosts);
                setDiscoverPosts(shuffled.map(s => s.post));
            } else {
                setDiscoverPosts(rawPosts.slice(0, 30));
            }
        } catch (e) {
            console.error('Error loading discover feed:', e);
        } finally {
            setIsDiscoverLoading(false);
        }
    };

    useEffect(() => {
        if (searchTerm.trim().length > 0) return;
        loadDiscoverFeed();
    }, [selectedCategory, searchTerm, user]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadDiscoverFeed();
        setIsRefreshing(false);
    };

    // Handle Search Queries
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.trim().length < 2) {
                setPeopleResults([]);
                setPostResults([]);
                if (activeTab === 'stories') {
                    setLoadingSearch(true);
                    fetchBoostedStories().then(data => {
                        setStoryResults(groupByUser(data));
                        setLoadingSearch(false);
                    });
                }
                return;
            }
            performSearch();
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm, activeTab]);

    const performSearch = async () => {
        setLoadingSearch(true);
        const query = searchTerm.trim();

        if (activeTab === 'people' && query.length >= 2) {
            const results = await searchUsers(query);
            setPeopleResults(results);
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
            const results = await searchPostsByCaption(query || '%');
            setPostResults(results);
        } else if (activeTab === 'stories') {
            const term = query.startsWith('#') ? query.substring(1) : query;
            const data = await searchStoriesByHashtag(term);
            setStoryResults(data);
        }
        setLoadingSearch(false);
    };

    const handleToggleFollow = async (profileId: string) => {
        if (!user) return;
        const isFollowing = followingMap[profileId] || false;
        await toggleFollow(user.id, profileId, isFollowing);
        setFollowingMap(prev => ({ ...prev, [profileId]: !isFollowing }));
    };

    const tabStyle = (tab: string) => ({
        flex: 1, padding: '10px', background: 'none', border: 'none',
        color: activeTab === tab ? '#ff3366' : 'var(--text-inactive)',
        borderBottom: activeTab === tab ? '2px solid #ff3366' : '2px solid transparent',
        fontWeight: activeTab === tab ? 'bold' as const : 'normal' as const,
        fontSize: '14px', cursor: 'pointer' as const,
        display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: '6px',
    });

    const isSearching = searchTerm.trim().length > 0;

    return (
        <div className="explore-page pb-20" style={{ background: 'var(--bg-color)', minHeight: '100vh' }}>
            {/* Search Bar */}
            <div style={{ padding: '16px', paddingBottom: '8px' }}>
                <div style={{
                    background: 'var(--surface-color)', padding: '10px 16px', borderRadius: '14px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                    <Search size={20} color="#8e8e93" />
                    <input
                        type="text"
                        placeholder="Search people, posts, or tags..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-active)', width: '100%', outline: 'none', fontSize: '15px' }}
                    />
                </div>
            </div>

            {/* Category Chips removed to allow silent algorithmic learning */}
            {/* Search Tabs (Only shown when searching) */}
            {isSearching && (
                <div style={{ display: 'flex', borderBottom: '1px solid #2c2c2e', marginTop: '8px' }}>
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
            )}

            {/* Content Area */}
            <PullToRefresh onRefresh={handleRefresh}>
                <div style={{ padding: '8px 16px' }}>
                    {!isSearching ? (
                        /* Discover Feed (Default View) */
                        isDiscoverLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-inactive)' }} />
                            </div>
                        ) : discoverPosts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-inactive)' }}>
                                No content found for this category.
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px' }}>
                                    {discoverPosts.map((post, idx) => (
                                    <div key={post.id} style={{ aspectRatio: '1', position: 'relative', cursor: 'pointer' }} onClick={() => setActiveFeedState({ posts: discoverPosts, index: idx })}>
                                        <PostMedia post={post} className="" muted loop playsInline autoPlay={false}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        {isVideoPost(post) && (
                                            <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                                                <Play size={16} color="var(--text-active)" fill="var(--text-active)" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            </>
                        )
                ) : (
                    /* Search Results View */
                    loadingSearch ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-inactive)' }} />
                        </div>
                    ) : (
                        <>
                            {activeTab === 'people' && (
                                peopleResults.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-inactive)' }}>
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
                                                <h4 style={{ margin: 0, color: 'var(--text-active)', fontSize: '15px', fontWeight: '600' }}>{person.username}</h4>
                                                {person.bio && <p style={{ margin: '2px 0 0', color: 'var(--text-inactive)', fontSize: '13px' }}>{person.bio}</p>}
                                            </div>
                                            {user && person.id !== user.id && (
                                                <button
                                                    onClick={() => handleToggleFollow(person.id)}
                                                    style={{
                                                        background: followingMap[person.id] ? 'transparent' : '#ff3366',
                                                        border: followingMap[person.id] ? '1px solid #3a3a3c' : 'none',
                                                        color: 'var(--text-active)', borderRadius: '20px',
                                                        padding: '8px 18px', fontSize: '13px', fontWeight: 'bold',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                                    }}
                                                >
                                                    {followingMap[person.id] ? <><UserCheck size={14} /> Unfriend</> : <><UserPlus size={14} /> Friend</>}
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )
                            )}

                            {activeTab === 'posts' && (
                                postResults.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-inactive)' }}>
                                        No posts found
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px' }}>
                                        {postResults.map((post, idx) => (
                                            <div key={post.id} style={{ aspectRatio: '1', position: 'relative', cursor: 'pointer' }} onClick={() => setActiveFeedState({ posts: postResults, index: idx })}>
                                                <PostMedia post={post} className="" muted loop playsInline autoPlay={false}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                {isVideoPost(post) && (
                                                    <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                                                        <Play size={16} color="var(--text-active)" fill="var(--text-active)" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}

                            {activeTab === 'stories' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                                    {storyResults.length > 0 ? (
                                        storyResults.map((group, idx) => (
                                            <div key={group.userId} style={{ position: 'relative', aspectRatio: '9/16', cursor: 'pointer' }} onClick={() => setActiveStoryGroupIndex(idx)}>
                                                <img src={group.stories[0].image_url} alt="" loading="lazy" style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                                                <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.5)', padding: '3px 8px', borderRadius: '10px' }}>
                                                    <img src={group.avatarUrl} alt="" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
                                                    <span style={{ color: 'var(--text-active)', fontSize: '10px', fontWeight: 'bold' }}>{group.username}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--text-inactive)' }}>
                                            No stories found
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )
                )}
                </div>
            </PullToRefresh>

            {activeStoryGroupIndex !== null && (
                <StoryViewer
                    storyGroups={storyResults}
                    initialGroupIndex={activeStoryGroupIndex}
                    currentUserId={user?.id}
                    onClose={() => setActiveStoryGroupIndex(null)}
                    onGroupsUpdated={setStoryResults}
                />
            )}

            {activeFeedState && (
                <ExploreFeedViewer
                    posts={activeFeedState.posts}
                    initialIndex={activeFeedState.index}
                    onClose={() => setActiveFeedState(null)}
                    onCommentClick={(postId) => { setCommentsPostId(postId); setIsCommentsOpen(true); }}
                    onShareClick={(post) => { setPostToShare(post); setIsShareOpen(true); }}
                />
            )}

            {isCommentsOpen && commentsPostId && user && (
                <CommentsSheet postId={commentsPostId} isOpen={isCommentsOpen} currentUser={user as any} onClose={() => setIsCommentsOpen(false)} />
            )}

            {user && (
                <ChatPanel 
                    isOpen={isChatOpen} 
                    onClose={() => { setIsChatOpen(false); setChatUserId(null); }} 
                    currentUser={{ ...user, username: user.username || 'user' }} 
                    initialOpenUserId={chatUserId}
                    refreshKey={chatRefreshKey}
                    pendingShare={pendingShare}
                />
            )}

            {isShareOpen && postToShare && user && (
                <ShareModal 
                    post={postToShare} 
                    isOpen={isShareOpen} 
                    currentUser={user as any} 
                    onClose={() => setIsShareOpen(false)} 
                    onMessageSent={(receiverId, message) => {
                        setPendingShare({ receiverId, message });
                        setChatRefreshKey(k => k + 1);
                    }}
                    onViewChat={(userId) => {
                        setIsShareOpen(false);
                        setPostToShare(null);
                        setChatUserId(userId);
                        setIsChatOpen(true);
                    }}
                />
            )}
        </div>
    );
};

export default Explore;
