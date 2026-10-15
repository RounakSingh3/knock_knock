import React, { useState, useRef, useEffect, useCallback, useContext, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, MessageCircle, Send, ChevronLeft, Music, Play, Pause, Volume2, VolumeX, Link as LinkIcon, Flame } from 'lucide-react';
import { fetchVideoPosts, fetchUserEngagements, trackEngagement, toggleImp, normalizePost, fetchPostById, resolveLocalMediaUrl, toggleLike as toggleLikeDb, checkIfLikedBatch, isPostLikedLocally, getLocalLikes, getLocalComments, type PostData, type MessageData } from '../lib/database';
import { getCleanSongUrl, isVideoUrl, isVideoPost, getFeedMutedPreference, setFeedMutedPreference } from '../lib/media';
import { AppContext } from '../context/AppContext';
import { audioPlayer } from '../lib/audioPlayer';
import { rankReels, getHybridInterestProfile, recordImplicitSignal, generateInfiniteStream, recordHashtagSignal } from '../lib/algorithm';
import { extractPosterFromUrl, getFallbackPoster, videoPosterCache, isFallbackPoster } from '../components/PostMedia';

// ⚡ Lazy-load heavy modals so Reels renders instantly
const ChatPanel = lazy(() => import('../components/ChatPanel'));
const ShareModal = lazy(() => import('../components/ShareModal'));
const CommentsSheet = lazy(() => import('../components/CommentsSheet'));

export interface ReelData {
    id: string | number;
    videoUrl: string;
    posterUrl: string;
    rawMediaUrl?: string;
    creator: string;
    creatorAvatar: string;
    caption: string;
    song: string;
    likes: number;
    imps?: number;
    comments: number;
    shares: number;
    category: string;
    css_filter?: string;
    attachedLink?: string;
    musicUrl?: string;
    is_user_upload?: boolean;
    created_at?: string;
    creator_id?: string;
}

export const RELIABLE_FALLBACK_VIDEOS: Record<string, string> = {
    Nature: 'https://videos.pexels.com/video-files/855564/855564-sd_640_360_24fps.mp4',
    Travel: 'https://videos.pexels.com/video-files/3015510/3015510-sd_640_360_24fps.mp4',
    Sports: 'https://videos.pexels.com/video-files/3571264/3571264-sd_640_360_30fps.mp4',
    Food: 'https://videos.pexels.com/video-files/2795173/2795173-sd_640_360_25fps.mp4',
    Dance: 'https://videos.pexels.com/video-files/3195394/3195394-sd_640_360_25fps.mp4',
    Animals: 'https://videos.pexels.com/video-files/2022395/2022395-sd_640_360_30fps.mp4',
    Pets: 'https://videos.pexels.com/video-files/2022395/2022395-sd_640_360_30fps.mp4',
    Art: 'https://videos.pexels.com/video-files/5752729/5752729-sd_640_360_30fps.mp4',
    General: 'https://videos.pexels.com/video-files/3209828/3209828-sd_640_360_25fps.mp4',
};

export const REELS_DATA: ReelData[] = [
    {
        id: 1,
        videoUrl: 'https://videos.pexels.com/video-files/855564/855564-sd_640_360_24fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/855564/free-video-855564.jpg?auto=compress&w=400',
        creator: 'nature_vibes',
        creatorAvatar: 'https://i.pravatar.cc/150?img=1',
        caption: '🌅 Golden hour hits different when you\'re at the coast',
        song: 'Chill Vibes — LofiBeats',
        likes: 14200,
        comments: 387,
        shares: 1204,
        category: 'Nature',
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/09/81/85/0981857c-ef55-7eb1-d631-f7e1068bd2dc/mzaf_17162354108241480327.plus.aac.p.m4a',
    },
    {
        id: 2,
        videoUrl: 'https://videos.pexels.com/video-files/3015510/3015510-sd_640_360_24fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/3015510/free-video-3015510.jpg?auto=compress&w=400',
        creator: 'city_explorer',
        creatorAvatar: 'https://i.pravatar.cc/150?img=5',
        caption: '🏙️ Neon lights and late-night bites in the city that never sleeps',
        song: 'After Dark — Mr.Kitty',
        likes: 28400,
        comments: 912,
        shares: 3410,
        category: 'Travel',
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/3e/cb/52/3ecb5294-5ea1-e392-7262-1b10cc67a299/mzaf_17548677748266742699.plus.aac.p.m4a',
    },
    {
        id: 3,
        videoUrl: 'https://videos.pexels.com/video-files/856973/856973-sd_640_360_25fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/856973/free-video-856973.jpg?auto=compress&w=400',
        creator: 'ocean_dreams',
        creatorAvatar: 'https://i.pravatar.cc/150?img=12',
        caption: '🌊 The ocean is calling and I must go 🐠',
        song: 'Ocean Eyes — Billie Eilish',
        likes: 45600,
        comments: 1230,
        shares: 5620,
        category: 'Nature',
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/d6/59/2b/d6592b0b-1e7e-4743-b2e4-f2af038fd783/mzaf_7697277787797935735.plus.aac.p.m4a',
    },
    {
        id: 4,
        videoUrl: 'https://videos.pexels.com/video-files/3571264/3571264-sd_640_360_30fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/3571264/free-video-3571264.jpg?auto=compress&w=400',
        creator: 'fitness_freak',
        creatorAvatar: 'https://i.pravatar.cc/150?img=8',
        caption: '💪 No shortcuts. Just grind. Who\'s in? 🔥',
        song: 'Stronger — Kanye West',
        likes: 19800,
        comments: 654,
        shares: 2100,
        category: 'Sports',
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/9e/cc/69/9ecc6918-a8dc-354f-909f-ccc20a0a7a33/mzaf_7863921970418240507.plus.aac.p.m4a',
    },
    {
        id: 5,
        videoUrl: 'https://videos.pexels.com/video-files/2795173/2795173-sd_640_360_25fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/2795173/free-video-2795173.jpg?auto=compress&w=400',
        creator: 'foodie_fam',
        creatorAvatar: 'https://i.pravatar.cc/150?img=20',
        caption: '🍕 Wait for it… the cheese pull is insane 🤤',
        song: 'THAT\'S WHAT I WANT — Lil Nas X',
        likes: 67300,
        comments: 2100,
        shares: 8900,
        category: 'Food',
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ac/57/e0/ac57e012-013a-dbc9-8526-ed12c2dacc66/mzaf_4836012189133996186.plus.aac.p.m4a',
    },
    {
        id: 6,
        videoUrl: 'https://videos.pexels.com/video-files/854669/854669-sd_640_360_30fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/854669/free-video-854669.jpg?auto=compress&w=400',
        creator: 'sky_watcher',
        creatorAvatar: 'https://i.pravatar.cc/150?img=33',
        caption: '☁️ Clouds moving in time-lapse is pure therapy',
        song: 'Weightless — Marconi Union',
        likes: 32100,
        comments: 880,
        shares: 4200,
        category: 'Nature',
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/65/69/07/656907c9-eb54-c59c-72b9-dad8489a0165/mzaf_3316991574698499044.plus.aac.p.m4a',
    },
    {
        id: 7,
        videoUrl: 'https://videos.pexels.com/video-files/3195394/3195394-sd_640_360_25fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/3195394/free-video-3195394.jpg?auto=compress&w=400',
        creator: 'dance_central',
        creatorAvatar: 'https://i.pravatar.cc/150?img=41',
        caption: '💃 Tried this trend and nailed it on the first try 🎯',
        song: 'Levitating — Dua Lipa',
        likes: 89200,
        comments: 4300,
        shares: 12400,
        category: 'Dance',
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/59/dc/4d/59dc4dda-93ff-8f1c-c536-f005f6ea6af5/mzaf_3066686759813252385.plus.aac.p.m4a',
    },
    {
        id: 8,
        videoUrl: 'https://videos.pexels.com/video-files/2022395/2022395-sd_640_360_30fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/2022395/free-video-2022395.jpg?auto=compress&w=400',
        creator: 'pet_paradise',
        creatorAvatar: 'https://i.pravatar.cc/150?img=48',
        caption: '🐶 When your dog has more personality than you 😂',
        song: 'Happy — Pharrell Williams',
        likes: 112000,
        comments: 8700,
        shares: 24000,
        category: 'Animals',
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ed/a0/19/eda019cf-2794-66d1-208d-2e2e74c26c3d/mzaf_16469762943852039623.plus.aac.p.m4a',
    },
    {
        id: 9,
        videoUrl: 'https://videos.pexels.com/video-files/3209828/3209828-sd_640_360_25fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/3209828/free-video-3209828.jpg?auto=compress&w=400',
        creator: 'adventure_co',
        creatorAvatar: 'https://i.pravatar.cc/150?img=55',
        caption: '🏔️ Life begins at the end of your comfort zone',
        song: 'Adventure — Matthew Parker',
        likes: 53400,
        comments: 1890,
        shares: 6700,
        category: 'Travel',
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c7/ed/61/c7ed61a0-9bfd-a92b-5406-33687f7d12dc/mzaf_16539405415188574752.plus.aac.p.m4a',
    },
    {
        id: 10,
        videoUrl: 'https://videos.pexels.com/video-files/5752729/5752729-sd_640_360_30fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/5752729/free-video-5752729.jpg?auto=compress&w=400',
        creator: 'street_vibes',
        creatorAvatar: 'https://i.pravatar.cc/150?img=60',
        caption: '🎨 Street art is the voice of the city walls',
        song: 'The Staunton Lick — Lemon Jelly',
        likes: 27800,
        comments: 740,
        shares: 3100,
        category: 'Art',
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/4b/ad/b7/4badb793-5d36-f0f6-a790-04d2ad573fec/mzaf_13864281869793412693.plus.aac.p.m4a',
    },
    {
        id: 11,
        videoUrl: 'https://videos.pexels.com/video-files/2519660/2519660-sd_640_360_24fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/2519660/free-video-2519660.jpg?auto=compress&w=400',
        creator: 'astro_lover',
        creatorAvatar: 'https://i.pravatar.cc/150?img=65',
        caption: '🌌 The Milky Way never gets old. Who else is a night owl? 🦉',
        song: 'Starlight — Muse',
        likes: 76500,
        comments: 3200,
        shares: 9100,
        category: 'Nature',
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/00/2c/2a/002c2a41-d59f-92a6-740a-35641b4e1e48/mzaf_9814325723002930170.plus.aac.p.m4a',
    },
    {
        id: 12,
        videoUrl: 'https://videos.pexels.com/video-files/3571264/3571264-sd_640_360_30fps.mp4',
        posterUrl: 'https://images.pexels.com/videos/3571264/free-video-3571264.jpg?auto=compress&w=400',
        creator: 'morning_routine',
        creatorAvatar: 'https://i.pravatar.cc/150?img=22',
        caption: '☀️ 5AM morning routine that changed my life',
        song: 'Sunrise — Norah Jones',
        likes: 41200,
        comments: 1560,
        shares: 5400,
        category: 'Lifestyle',
        musicUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/2d/50/49/2d5049cd-24d9-73a9-b0f2-2a69cfec5337/mzaf_10789591133834750192.plus.aac.p.m4a',
    },
];

export function formatCount(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
}

function postToReel(post: PostData): ReelData {
    const cleanMusicUrl = getCleanSongUrl(post.music_title, post.music_url) || (post.music_url && !post.music_url.includes('soundhelix') ? post.music_url : undefined);
    let filter = post.css_filter;
    try {
        if (!filter || filter === 'none') {
            const url = new URL(post.image_url);
            const f = url.searchParams.get('filter');
            if (f) filter = decodeURIComponent(f);
        }
    } catch(e) {}

    const effectiveMedia = resolveLocalMediaUrl(post.image_url);
    const resolvedPoster = extractPosterFromUrl(post.image_url);
    const rawNoHash = (effectiveMedia || post.image_url || '').split('#')[0];
    let cleanVideoUrl = rawNoHash;
    try {
        const u = new URL(rawNoHash, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        if (u.searchParams.has('filter')) {
            u.searchParams.delete('filter');
        }
        cleanVideoUrl = rawNoHash.startsWith('http') ? u.toString() : (u.pathname + u.search);
    } catch (_) {}

    return {
        id: post.id,
        videoUrl: cleanVideoUrl,
        posterUrl: (resolvedPoster && !isFallbackPoster(resolvedPoster)) ? resolvedPoster : '',
        rawMediaUrl: post.image_url,
        creator: post.username,
        creatorAvatar: post.avatar_url || `https://i.pravatar.cc/150?u=${post.username}`,
        caption: post.caption || '',
        song: post.music_title ? `${post.music_title} — ${post.music_artist || post.username}` : 'Original Sound',
        likes: post.likes_count || 0,
        imps: post.imps_count || 0,
        comments: (post as any).comments_count || 0,
        shares: post.shares_count || 0,
        category: post.category || 'Uploads',
        css_filter: filter,
        attachedLink: post.attached_link,
        musicUrl: cleanMusicUrl,
        is_user_upload: true,
        created_at: post.created_at,
        creator_id: post.user_id,
    };
}

const Reels: React.FC = () => {
    const { user, blockedIds } = useContext(AppContext);
    const [searchParams] = useSearchParams();
    const rawTargetId = searchParams.get('id');
    const targetReelId = (rawTargetId && rawTargetId !== 'undefined' && rawTargetId !== 'null') ? rawTargetId : null;
    const targetVideoUrl = searchParams.get('v') || searchParams.get('url');
    const targetCaption = searchParams.get('caption');
    const targetUser = searchParams.get('user');
    const [reelsList, setReelsList] = useState<ReelData[]>(REELS_DATA);
    const [likedReels, setLikedReels] = useState<Set<string | number>>(() => {
        const set = new Set<string | number>();
        try {
            const local = getLocalLikes();
            Object.entries(local).forEach(([k, v]) => {
                if (v) {
                    const parts = k.split('_');
                    const rId = parts.length > 1 ? parts.slice(1).join('_') : k;
                    set.add(rId);
                    const asNum = Number(rId);
                    if (!isNaN(asNum)) set.add(asNum);
                }
            });
        } catch (_) {}
        return set;
    });
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [commentsReelId, setCommentsReelId] = useState<string | null>(null);
    const [impedReels, setImpedReels] = useState<Set<string | number>>(new Set());
    const [failedVisuals, setFailedVisuals] = useState<Set<string | number>>(new Set());
    const [fallbackVideos, setFallbackVideos] = useState<Record<string | number, string>>({});
    const [bufferingReels, setBufferingReels] = useState<Set<string | number>>(new Set());
    const [mutedAll, setMutedAll] = useState(() => getFeedMutedPreference());
    const [activeIndex, setActiveIndex] = useState(0);
    const [selectedReelIndex, setSelectedReelIndex] = useState<number | null>(null);

    const [playStates, setPlayStates] = useState<boolean[]>(REELS_DATA.map(() => true));
    const [heartBursts, setHeartBursts] = useState<{ id: number; x: number; y: number }[]>([]);
    // ⚡ Progress stored in ref (NOT state) to avoid re-rendering 3x/sec
    const progressesRef = useRef<number[]>(REELS_DATA.map(() => 0));
    const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // If targetReelId is present on mount and exists in default REELS_DATA, open immediately
    useEffect(() => {
        if (!targetReelId) return;
        const initialIdx = REELS_DATA.findIndex(r => String(r.id) === String(targetReelId));
        if (initialIdx !== -1) {
            setSelectedReelIndex(initialIdx);
            setActiveIndex(initialIdx);
        }
    }, [targetReelId]);

    // Sync liked reels from database/local storage
    useEffect(() => {
        if (reelsList.length > 0) {
            const ids = reelsList.map(r => r.id);
            const uId = user?.id || '';
            checkIfLikedBatch(uId, ids).then(likedMap => {
                setLikedReels(prev => {
                    const next = new Set(prev);
                    Object.entries(likedMap).forEach(([id, isL]) => {
                        if (isL) {
                            next.add(id);
                            const asNum = Number(id);
                            if (!isNaN(asNum)) next.add(asNum);
                        }
                    });
                    return next;
                });
            });
        }
    }, [user?.id, reelsList]);


    // Audio playback logic moved to native <audio> controls.

    // Chat and share states
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [postToShare, setPostToShare] = useState<PostData | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatUserId, setChatUserId] = useState<string | null>(null);
    const [chatRefreshKey, setChatRefreshKey] = useState(0);
    const [pendingShare, setPendingShare] = useState<{ receiverId: string; message: MessageData } | null>(null);

    const [rawReelPool, setRawReelPool] = useState<ReelData[]>([]);
    const [reelPage, setReelPage] = useState(0);
    const completedReelsRef = useRef<Set<string | number>>(new Set());

    // Watch time & replay tracking
    const watchStartRef = useRef<number>(0);
    const replayCountRef = useRef<Record<number, number>>({});

    useEffect(() => {
        Promise.all([
            fetchVideoPosts(user?.id),
            user?.id ? fetchUserEngagements(user.id) : Promise.resolve([])
        ]).then(async ([videoPosts, engagements]) => {
            const validPosts = videoPosts.filter(p => !p.user_id || !blockedIds.includes(p.user_id));
            const resolvedPosts = validPosts.map((rawP) => {
                const p = normalizePost(rawP);
                if (!p) return null;
                const cleanUrl = getCleanSongUrl(p.music_title, p.music_url);
                return { ...p, music_url: cleanUrl || p.music_url };
            });
            const userReels = resolvedPosts
                .filter((p): p is PostData => Boolean(p))
                .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                .map(postToReel);

            // Interleave userReels and REELS_DATA with author anti-clustering
            const merged: ReelData[] = [];
            const pexelsPool = [...REELS_DATA];
            const userPool = [...userReels];

            // If user has recent reels, prioritize them first
            if (user) {
                const myReelIdx = userPool.findIndex(r => r.creator === user.username || (r.creator_id && r.creator_id === user.id));
                if (myReelIdx !== -1) {
                    merged.push(userPool.splice(myReelIdx, 1)[0]);
                }
            }

            while (userPool.length > 0 || pexelsPool.length > 0) {
                const lastCreator = merged.length > 0 ? merged[merged.length - 1].creator : '';

                // Try to pick from userPool if author is different from lastCreator, prioritizing community uploads in top positions
                let chosenFromUserIdx = userPool.findIndex(r => r.creator !== lastCreator);
                if (chosenFromUserIdx !== -1 && (merged.length < 6 || merged.length % 2 === 0 || pexelsPool.length === 0)) {
                    merged.push(userPool.splice(chosenFromUserIdx, 1)[0]);
                } else if (pexelsPool.length > 0 && (pexelsPool[0].creator !== lastCreator || userPool.length === 0)) {
                    merged.push(pexelsPool.shift()!);
                } else if (userPool.length > 0) {
                    merged.push(userPool.shift()!);
                } else if (pexelsPool.length > 0) {
                    merged.push(pexelsPool.shift()!);
                }
            }

            // Apply Pillar 1 & 5: Variable Reward Schedule & Hyper-Personalization with Everyday Reshuffle
            const hybridProfile = getHybridInterestProfile(engagements);
            const todayKey = new Date().toISOString().slice(0, 10);
            const ranked = rankReels(merged, hybridProfile, user?.id, todayKey);

            if (targetVideoUrl) {
                const directReel: ReelData = {
                    id: targetReelId || `direct_${Date.now()}`,
                    videoUrl: targetVideoUrl,
                    posterUrl: targetVideoUrl,
                    creator: targetUser || 'creator',
                    creatorAvatar: `https://i.pravatar.cc/150?u=${targetUser || 'user'}`,
                    caption: targetCaption || '',
                    song: 'Original Sound',
                    likes: 1250,
                    comments: 24,
                    shares: 42,
                    category: 'Uploads',
                };
                ranked.unshift(directReel);
                setSelectedReelIndex(0);
                setActiveIndex(0);
            } else if (targetReelId) {
                let targetIdx = ranked.findIndex(r => String(r.id) === String(targetReelId));
                if (targetIdx === -1) {
                    try {
                        const fetchedPost = await fetchPostById(targetReelId);
                        if (fetchedPost && isVideoPost(fetchedPost)) {
                            const newReel = postToReel(fetchedPost);
                            ranked.unshift(newReel);
                            targetIdx = 0;
                        }
                    } catch (err) {
                        console.warn('[Reels] Could not fetch target reel by id:', err);
                    }
                }
                if (targetIdx !== -1) {
                    setSelectedReelIndex(targetIdx);
                    setActiveIndex(targetIdx);
                }
            }

            setRawReelPool(ranked);
            setReelsList(ranked);
            setPlayStates(ranked.map(() => true));
            progressesRef.current = ranked.map(() => 0);
        });
    }, [user?.id, user?.username, blockedIds, targetReelId]);

    const containerRef = useRef<HTMLDivElement>(null);
    const modalScrollRef = useRef<HTMLDivElement>(null);
    const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
    const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);
    const lastTapRef = useRef<number>(0);
    const navigate = useNavigate();
    const activeIndexRef = useRef<number>(activeIndex);

    useEffect(() => {
        activeIndexRef.current = activeIndex;
    }, [activeIndex]);

    // Pillar 4: Prioritized Pre-buffering — Prime the NEXT video once active video is running
    const primeNextVideo = useCallback((currentIdx: number) => {
        const nextIdx = currentIdx + 1;
        if (nextIdx < reelsList.length) {
            const nextVideo = videoRefs.current[nextIdx];
            if (nextVideo && nextVideo.preload !== 'auto') {
                nextVideo.preload = 'auto';
            }
        }
        const nextNextIdx = currentIdx + 2;
        if (nextNextIdx < reelsList.length) {
            const nextNextVideo = videoRefs.current[nextNextIdx];
            if (nextNextVideo && nextNextVideo.preload === 'none') {
                nextNextVideo.preload = 'metadata';
            }
        }
    }, [reelsList.length]);

    // Helper to safely play audio with interaction fallback if browser blocks autoplay
    const playReelAudio = useCallback((audio: HTMLAudioElement | null) => {
        if (!audio || mutedAll) return;
        // Already playing → don't restart (repeated activations used to reset music to 0 and stutter)
        if (!audio.paused) return;
        const p = audio.play();
        if (p !== undefined) {
            p.catch((err) => {
                if (err.name === 'AbortError') return;
                console.warn('[Reels] Audio play blocked, awaiting user tap:', err);
                const handleTapToPlay = () => {
                    audio.play().catch(() => {});
                    window.removeEventListener('click', handleTapToPlay, { capture: true });
                    window.removeEventListener('touchstart', handleTapToPlay, { capture: true });
                };
                window.addEventListener('click', handleTapToPlay, { once: true, capture: true });
                window.addEventListener('touchstart', handleTapToPlay, { once: true, capture: true });
            });
        }
    }, [mutedAll]);

    // Unconditionally silence all audio when navigating away from Reels
    useEffect(() => {
        return () => {
            videoRefs.current.forEach(v => v?.pause());
            audioRefs.current.forEach(a => {
                if (a) {
                    a.pause();
                    a.currentTime = 0;
                }
            });
            audioPlayer.stop();
        };
    }, []);

    const lastScrolledModalIndexRef = useRef<number | null>(null);

    // Auto-scroll to selected reel index when modal opens and play media immediately
    useEffect(() => {
        if (selectedReelIndex === null) {
            lastScrolledModalIndexRef.current = null;
            return;
        }

        if (modalScrollRef.current) {
            // Only scroll to selectedReelIndex when opening a new reel, NEVER when reelsList appends more items!
            if (lastScrolledModalIndexRef.current !== selectedReelIndex) {
                lastScrolledModalIndexRef.current = selectedReelIndex;
                const height = modalScrollRef.current.clientHeight || window.innerHeight;
                modalScrollRef.current.scrollTo(0, height * selectedReelIndex);
                setActiveIndex(selectedReelIndex);
            }

            const syncReelMedia = () => {
                videoRefs.current.forEach((v, idx) => {
                    if (!v) return;
                    const reel = reelsList[idx];
                    const hasMusic = Boolean(reel?.musicUrl);
                    v.muted = hasMusic ? true : mutedAll;
                    if (idx === selectedReelIndex) {
                        if (v.paused) {
                            const playPromise = v.play();
                            if (playPromise !== undefined) {
                                playPromise.then(() => primeNextVideo(selectedReelIndex)).catch((err) => {
                                    if (err.name === 'AbortError') return;
                                    console.warn('[Reels] Autoplay rejected, falling back to muted play:', err);
                                    setMutedAll(true);
                                    setFeedMutedPreference(true);
                                    v.muted = true;
                                    v.play().then(() => primeNextVideo(selectedReelIndex)).catch(() => {});
                                });
                            }
                        } else {
                            primeNextVideo(selectedReelIndex);
                        }
                    } else if (!v.paused) {
                        v.pause();
                    }
                });
                audioRefs.current.forEach((a, idx) => {
                    if (!a) return;
                    a.muted = mutedAll;
                    if (idx === selectedReelIndex && !mutedAll) {
                        playReelAudio(a);
                    } else if (!a.paused) {
                        a.pause();
                        a.currentTime = 0;
                    }
                });
                setPlayStates(prev => {
                    if (prev[selectedReelIndex]) return prev;
                    const n = [...prev];
                    n[selectedReelIndex] = true;
                    return n;
                });
            };

            syncReelMedia();
            const timer = setTimeout(syncReelMedia, 150);
            return () => clearTimeout(timer);
        }
    }, [selectedReelIndex, mutedAll, playReelAudio, primeNextVideo]);

    // Centralized instant reel activation for both onScroll and IntersectionObserver
    const activateReel = useCallback((idx: number) => {
        if (idx < 0 || idx >= reelsList.length) return;
        const isSame = activeIndexRef.current === idx;
        // ⚡ Same reel already playing → nothing to do (scroll, scrollend & observer all fire for one swipe)
        if (isSame) {
            const current = videoRefs.current[idx];
            if (current && !current.paused) return;
        }
        activeIndexRef.current = idx;
        if (!isSame) {
            setActiveIndex(idx);
        }

        const reel = reelsList[idx];
        const hasMusic = Boolean(reel?.musicUrl);

        // Immediate zero-latency play on target video
        const targetVideo = videoRefs.current[idx];
        if (targetVideo) {
            targetVideo.muted = hasMusic ? true : mutedAll;
            if (targetVideo.paused) {
                const playPromise = targetVideo.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        primeNextVideo(idx);
                    }).catch((err) => {
                        if (err.name === 'AbortError') return;
                        console.warn('[Reels] Autoplay rejected, falling back to muted play:', err);
                        setMutedAll(true);
                        setFeedMutedPreference(true);
                        targetVideo.muted = true;
                        targetVideo.play().then(() => primeNextVideo(idx)).catch(() => {});
                    });
                }
            } else {
                primeNextVideo(idx);
            }
        }

        // Pause all other video elements synchronously to free decoder and network
        videoRefs.current.forEach((v, i) => {
            if (v && i !== idx && !v.paused) {
                v.pause();
            }
        });

        // Manage audio: play active reel's audio if unmuted, stop all others
        audioRefs.current.forEach((a, i) => {
            if (a) {
                a.muted = mutedAll;
                if (i === idx && !mutedAll) {
                    playReelAudio(a);
                } else if (!a.paused) {
                    a.pause();
                    a.currentTime = 0;
                }
            }
        });

        // Only update playStates if it was actually false, preventing unnecessary React re-renders!
        setPlayStates((prev) => {
            if (prev[idx]) return prev;
            const next = [...prev];
            next[idx] = true;
            return next;
        });
    }, [reelsList, mutedAll, playReelAudio, primeNextVideo]);

    const scrollEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // High-performance scroll listener to smoothly switch reels when snap settles
    const handleReelsScroll = useCallback(() => {
        const el = modalScrollRef.current;
        if (!el) return;
        const h = el.clientHeight || window.innerHeight;
        if (h <= 0) return;
        
        const snapIdx = Math.round(el.scrollTop / h);
        if (snapIdx >= 0 && snapIdx < reelsList.length && snapIdx !== activeIndexRef.current) {
            const distFromSnap = Math.abs(el.scrollTop - (snapIdx * h));
            if (distFromSnap < 15) {
                activateReel(snapIdx);
                return;
            }
        }

        if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
        scrollEndTimeoutRef.current = setTimeout(() => {
            const curH = el.clientHeight || window.innerHeight;
            if (curH <= 0) return;
            const targetIdx = Math.round(el.scrollTop / curH);
            if (targetIdx >= 0 && targetIdx < reelsList.length) {
                activateReel(targetIdx);
            }
        }, 50);
    }, [reelsList.length, activateReel]);

    // Native scrollend listener for instantaneous snap settlement without timer overhead
    useEffect(() => {
        const el = modalScrollRef.current;
        if (!el || selectedReelIndex === null) return;
        const handleScrollEnd = () => {
            const h = el.clientHeight || window.innerHeight;
            if (h <= 0) return;
            const snapIdx = Math.round(el.scrollTop / h);
            if (snapIdx >= 0 && snapIdx < reelsList.length) {
                activateReel(snapIdx);
            }
        };
        el.addEventListener('scrollend', handleScrollEnd, { passive: true });
        return () => {
            el.removeEventListener('scrollend', handleScrollEnd);
        };
    }, [selectedReelIndex, reelsList.length, activateReel]);

    // 💻 Laptop & Desktop keyboard navigation: ArrowUp, ArrowDown, PageUp, PageDown, Space, 'm'
    useEffect(() => {
        if (selectedReelIndex === null) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
                return;
            }

            const el = modalScrollRef.current;
            const h = el ? (el.clientHeight || window.innerHeight) : window.innerHeight;

            if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j') {
                e.preventDefault();
                const nextIdx = Math.min(reelsList.length - 1, activeIndexRef.current + 1);
                if (el) {
                    el.scrollTo({ top: nextIdx * h, behavior: 'smooth' });
                }
            } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k') {
                e.preventDefault();
                const prevIdx = Math.max(0, activeIndexRef.current - 1);
                if (el) {
                    el.scrollTo({ top: prevIdx * h, behavior: 'smooth' });
                }
            } else if (e.key === ' ' || e.key.toLowerCase() === 'k') {
                e.preventDefault();
                togglePlay(activeIndexRef.current);
            } else if (e.key.toLowerCase() === 'm') {
                e.preventDefault();
                setMutedAll(prev => {
                    const next = !prev;
                    setFeedMutedPreference(next);
                    return next;
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [reelsList.length, togglePlay, selectedReelIndex]);

    // IntersectionObserver with 0.35/0.60 threshold for instantaneous pre-snap activation
    useEffect(() => {
        if (selectedReelIndex === null) return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const card = entry.target as HTMLElement;
                    const idxStr = card?.getAttribute('data-reel-index');
                    const idx = idxStr !== null ? parseInt(idxStr, 10) : -1;
                    if (idx === -1) return;

                    // ⚡ Activate incoming reel as soon as it dominates 60% of viewport
                    if (entry.intersectionRatio >= 0.60) {
                        activateReel(idx);
                    } else if (entry.intersectionRatio < 0.35) {
                        const video = videoRefs.current[idx];
                        if (video && !video.paused) video.pause();
                        if (audioRefs.current[idx]) {
                            audioRefs.current[idx]?.pause();
                            audioRefs.current[idx]!.currentTime = 0;
                        }
                    }
                });
            },
            { 
                root: modalScrollRef.current,
                threshold: [0.35, 0.60]
            }
        );

        const cards = modalScrollRef.current?.querySelectorAll('.reel-card');
        cards?.forEach((card) => {
            observer.observe(card);
        });

        return () => {
            observer.disconnect();
            if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
        };
    }, [selectedReelIndex, reelsList, activateReel]);

    // ⚡ Synchronize active video play when sliding window mounts new active video element
    useEffect(() => {
        if (selectedReelIndex === null) return;
        const video = videoRefs.current[activeIndex];
        if (video && video.paused) {
            const reel = reelsList[activeIndex];
            const hasMusic = Boolean(reel?.musicUrl);
            video.muted = hasMusic ? true : mutedAll;
            const p = video.play();
            if (p !== undefined) {
                p.then(() => primeNextVideo(activeIndex)).catch((err) => {
                    if (err.name === 'AbortError') return;
                    video.muted = true;
                    video.play().then(() => primeNextVideo(activeIndex)).catch(() => {});
                });
            }
        }
        // Explicitly pause any offscreen/non-active video elements to release mobile hardware decoder resources
        videoRefs.current.forEach((v, idx) => {
            if (v && idx !== activeIndex && !v.paused) {
                v.pause();
            }
        });
        // 🎵 The active reel's <audio> only mounts after this render, so start it here
        const activeAudio = audioRefs.current[activeIndex];
        if (activeAudio && !mutedAll) {
            activeAudio.muted = false;
            playReelAudio(activeAudio);
        }
    }, [activeIndex, selectedReelIndex, mutedAll, reelsList, primeNextVideo, playReelAudio]);

    // Pillar 3: The Infinite Scroll — Auto-extend stream when user nears bottom
    useEffect(() => {
        if (selectedReelIndex !== null && activeIndex >= reelsList.length - 2 && rawReelPool.length > 0) {
            const nextPage = reelPage + 1;
            setReelPage(nextPage);
            const nextBatch = generateInfiniteStream(
                rawReelPool,
                nextPage,
                10,
                (batch) => {
                    const profile = getHybridInterestProfile([]);
                    const todayKey = new Date().toISOString().slice(0, 10);
                    return rankReels(batch, profile, user?.id, todayKey);
                }
            );
            const newReelsWithKeys = nextBatch.map((r, i) => ({
                ...r,
                id: `${r.id}_p${nextPage}_${i}`
            }));
            setReelsList(prev => [...prev, ...newReelsWithKeys]);
            setPlayStates(prev => [...prev, ...newReelsWithKeys.map(() => true)]);
            progressesRef.current = [...progressesRef.current, ...newReelsWithKeys.map(() => 0)];
        }
    }, [activeIndex, reelsList.length, rawReelPool, reelPage, selectedReelIndex, user?.id]);

    // Pillar 2: Implicit Signal Tracking — Watch time, fast-skip penalties, and dwell
    useEffect(() => {
        if (watchStartRef.current > 0) {
            const watchDuration = (Date.now() - watchStartRef.current) / 1000;
            const prevReel = reelsList[activeIndex];
            if (prevReel) {
                const reelIdStr = String(prevReel.id);
                if (watchDuration < 1.5) {
                    // Fast skip signal (penalizes category / content in implicit profile)
                    recordImplicitSignal({
                        type: 'skip',
                        postId: reelIdStr,
                        category: prevReel.category || 'General',
                        value: watchDuration,
                        timestamp: Date.now()
                    });
                } else if (watchDuration >= 4.0) {
                    // Positive dwell signal
                    recordImplicitSignal({
                        type: 'dwell',
                        targetId: reelIdStr,
                        category: prevReel.category || 'General',
                        caption: prevReel.caption,
                        value: watchDuration * 1000,
                        timestamp: Date.now()
                    });
                }
                if (user && typeof prevReel.id === 'string') {
                    trackEngagement(user.id, prevReel.id, 'watch_time', watchDuration, prevReel.category || 'General');
                }
            }
        }
        watchStartRef.current = Date.now();
    }, [activeIndex]);

    // Pillar 2: Re-watch Loop Detection (Super-strong positive signal)
    // Reels use `loop`, so the 'ended' event never fires — replays are detected from the
    // progress wrap-around inside the RAF progress loop below.

    const activeProgressBarRef = useRef<HTMLElement | null>(null);

    // Cache active progress bar element when active reel changes, eliminating 60fps DOM queries
    useEffect(() => {
        if (selectedReelIndex === null) return;
        activeProgressBarRef.current = document.querySelector(
            `.reel-card[data-reel-index="${activeIndex}"] .reel-progress-fill`
        ) as HTMLElement;
    }, [selectedReelIndex, activeIndex]);

    // Pillar 2: Progress bar updater & 80%+ completion signal tracking
    // ⚡ Uses requestAnimationFrame + direct DOM manipulation instead of setState to avoid re-rendering
    useEffect(() => {
        if (selectedReelIndex === null) return;
        let rafId: number;
        const reelsListRef_local = reelsList; // capture for closure
        let lastPct = 0;

        const tick = () => {
            const activeVideo = videoRefs.current[activeIndex];
            if (activeVideo && activeVideo.duration) {
                const pct = (activeVideo.currentTime / activeVideo.duration) * 100;
                progressesRef.current[activeIndex] = pct;

                // 🔁 Looping videos never fire 'ended' — detect the wrap-around as a re-watch signal
                if (lastPct > 90 && pct < 10) {
                    const reel = reelsListRef_local[activeIndex];
                    if (reel) {
                        const loops = (replayCountRef.current[activeIndex] || 0) + 1;
                        replayCountRef.current[activeIndex] = loops;
                        recordImplicitSignal({
                            type: 'replay',
                            targetId: String(reel.id),
                            category: reel.category || 'General',
                            caption: reel.caption,
                            value: loops,
                            timestamp: Date.now()
                        });
                        if (user && typeof reel.id === 'string' && loops >= 2) {
                            trackEngagement(user.id, reel.id, 'replay', loops, reel.category || 'General');
                        }
                    }
                }
                lastPct = pct;

                // ⚡ Direct DOM update only for active reel using cached element ref
                if (activeProgressBarRef.current) {
                    activeProgressBarRef.current.style.width = `${pct}%`;
                }

                if (pct >= 80) {
                    const currentReel = reelsListRef_local[activeIndex];
                    if (currentReel && !completedReelsRef.current.has(currentReel.id)) {
                        completedReelsRef.current.add(currentReel.id);
                        recordImplicitSignal({
                            type: 'watch_pct',
                            postId: String(currentReel.id),
                            category: currentReel.category || 'General',
                            value: pct,
                            timestamp: Date.now()
                        });
                    }
                }
            }
            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [selectedReelIndex, activeIndex, reelsList, user]);

    const togglePlay = useCallback(
        (idx: number) => {
            const video = videoRefs.current[idx];
            const audio = audioRefs.current[idx];
            if (!video) return;
            if (video.paused) {
                video.play().catch(() => { });
                if (audio && !mutedAll) audio.play().catch(() => { });
                setPlayStates((prev) => {
                    const next = [...prev];
                    next[idx] = true;
                    return next;
                });
            } else {
                video.pause();
                if (audio) audio.pause();
                setPlayStates((prev) => {
                    const next = [...prev];
                    next[idx] = false;
                    return next;
                });
            }
        },
        [mutedAll]
    );

    const toggleLike = useCallback(async (reelId: string | number) => {
        const pIdStr = String(reelId);
        const pIdNum = typeof reelId === 'number' ? reelId : Number(reelId);
        const isCurrentlyLiked = likedReels.has(reelId) || likedReels.has(pIdStr) || (!isNaN(pIdNum) && likedReels.has(pIdNum));
        const newLiked = !isCurrentlyLiked;

        setLikedReels((prev) => {
            const next = new Set(prev);
            if (newLiked) {
                next.add(reelId);
                next.add(pIdStr);
                if (!isNaN(pIdNum)) next.add(pIdNum);
            } else {
                next.delete(reelId);
                next.delete(pIdStr);
                if (!isNaN(pIdNum)) next.delete(pIdNum);
            }
            return next;
        });

        // Persist locally and sync with Supabase
        const userId = user?.id || '';
        await toggleLikeDb(userId, pIdStr, isCurrentlyLiked);

        // Update likes count on the reel in reelsList
        setReelsList((prev) => prev.map(r => {
            if (String(r.id) === pIdStr) {
                return { ...r, likes: Math.max(0, (r.likes || 0) + (newLiked ? 1 : -1)) };
            }
            return r;
        }));
    }, [user?.id, likedReels]);

    const handleDoubleTap = useCallback(
        (idx: number, e: React.MouseEvent | React.TouchEvent) => {
            const now = Date.now();
            if (now - lastTapRef.current < 300) {
                // Double tap — like
                const r = reelsList[idx];
                if (r) {
                    const isAlreadyLiked = likedReels.has(r.id) || likedReels.has(String(r.id));
                    if (!isAlreadyLiked) {
                        toggleLike(r.id);
                    }
                }
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const clientX = 'touches' in e ? e.touches[0]?.clientX ?? rect.width / 2 : (e as React.MouseEvent).clientX;
                const clientY = 'touches' in e ? e.touches[0]?.clientY ?? rect.height / 2 : (e as React.MouseEvent).clientY;
                const burstId = Date.now();
                setHeartBursts((prev) => [...prev, { id: burstId, x: clientX - rect.left, y: clientY - rect.top }]);
                setTimeout(() => setHeartBursts((prev) => prev.filter((h) => h.id !== burstId)), 900);
            } else {
                // Single tap — toggle play
                togglePlay(idx);
            }
            lastTapRef.current = now;
        },
        [togglePlay, reelsList, likedReels, toggleLike]
    );

    const toggleImpReel = useCallback(async (reelId: string | number) => {
        setImpedReels((prev) => {
            const next = new Set(prev);
            if (next.has(reelId)) next.delete(reelId);
            else next.add(reelId);
            return next;
        });
        if (user && typeof reelId === 'string') {
            const currentlyImped = impedReels.has(reelId);
            await toggleImp(user.id, reelId, currentlyImped);
        }
    }, [user?.id, impedReels]);

    const touchStartPosRef = useRef<{x: number, y: number} | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!e.changedTouches[0]) return;
        touchStartPosRef.current = {
            x: e.changedTouches[0].screenX,
            y: e.changedTouches[0].screenY
        };
    };

    const handleTouchEnd = (reel: ReelData, e: React.TouchEvent) => {
        if (!touchStartPosRef.current || !e.changedTouches[0]) return;
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        
        const diffX = touchEndX - touchStartPosRef.current.x;
        const diffY = touchEndY - touchStartPosRef.current.y;
        touchStartPosRef.current = null;

        // Only trigger horizontal swipe if X movement is greater than Y movement (to avoid triggering on scroll)
        if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX < 0) {
                // Swipe Left -> Profile (match Instagram/TikTok behavior)
                navigate(`/profile/${reel.creator}`);
            } else {
                // Swipe Right -> Close Player
                closePlayer();
            }
        }
    };

    const closePlayer = () => {
        // Pause all videos and audios when returning to grid
        videoRefs.current.forEach(v => v?.pause());
        audioRefs.current.forEach(a => {
            if (a) {
                a.pause();
                a.currentTime = 0;
            }
        });
        setSelectedReelIndex(null);
    };

    // 🔙 Instagram-style hardware / browser back handling to close player
    useEffect(() => {
        if (selectedReelIndex === null) return;
        window.history.pushState({ modal: 'reel_player' }, '');
        const handlePopState = () => {
            closePlayer();
        };
        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [selectedReelIndex]);

    return (
        <div className="explore-page pb-20" ref={containerRef} style={{ background: 'var(--bg-color)' }}>
            {/* Header & Create Story Area */}
            <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h1 className="font-bold text-2xl">Reels</h1>
                <button 
                    onClick={() => navigate('/create')}
                    style={{
                        background: 'linear-gradient(45deg, #f5a524, #ff6b35)',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '8px 16px',
                        color: 'var(--text-active)',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(245, 165, 36, 0.3)'
                    }}
                >
                    + Create Post
                </button>
            </div>

            {/* Grid View */}
            <div className="explore-grid">
                {reelsList.map((reel, idx) => (
                    <div 
                        key={reel.id} 
                        className="explore-item" 
                        onClick={() => {
                            setActiveIndex(idx);
                            setSelectedReelIndex(idx);
                        }}
                        style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                    >
                        {(() => {
                            const clean = reel.videoUrl.split('#')[0].split('?')[0];
                            const cached = videoPosterCache.get(clean);
                            const validCached = cached && !isFallbackPoster(cached) ? cached : undefined;
                            const validPosterUrl = reel.posterUrl && !isVideoUrl(reel.posterUrl) && !isFallbackPoster(reel.posterUrl) ? reel.posterUrl : undefined;
                            const urlPoster = extractPosterFromUrl(reel.videoUrl);
                            const validUrlPoster = urlPoster && !isFallbackPoster(urlPoster) ? urlPoster : undefined;
                            const posterSrc = validPosterUrl || validCached || validUrlPoster;
                            if (posterSrc) {
                                return (
                                    <img
                                        src={posterSrc}
                                        alt={reel.caption || 'Reel'}
                                        loading="lazy"
                                        decoding="async"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop';
                                        }}
                                    />
                                );
                            }
                            return (
                                <video
                                    src={`${reel.videoUrl.split('#')[0]}#t=0.001`}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                                    muted
                                    playsInline
                                    preload="metadata"
                                />
                            );
                        })()}
                        <div style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            color: 'var(--text-active)',
                            textShadow: '0 1px 3px rgba(0,0,0,0.8)'
                        }}>
                            <Play size={16} fill="var(--text-active)" />
                        </div>
                        <div style={{
                            position: 'absolute',
                            bottom: 8,
                            left: 8,
                            color: 'var(--text-active)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            textShadow: '0 1px 3px rgba(0,0,0,0.8)'
                        }}>
                            <Heart size={12} fill="var(--text-active)" stroke="none" />
                            {formatCount(reel.likes)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Full-Screen Player */}
            {selectedReelIndex !== null && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    background: 'var(--bg-color)'
                }}>
                    {/* Modal Controls */}
                    <div style={{
                        position: 'absolute',
                        top: 'max(24px, env(safe-area-inset-top, 24px))',
                        left: 16,
                        right: 16,
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        pointerEvents: 'none'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'auto' }}>
                            <button 
                                onClick={() => {
                                    if (window.history.state?.modal === 'reel_player') {
                                        window.history.back();
                                    } else {
                                        closePlayer();
                                    }
                                }}
                                className="modal-back-btn"
                                aria-label="Back"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            <span style={{ color: '#fff', fontWeight: 800, fontSize: '18px', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                                Reels
                            </span>
                        </div>
                        <button
                            onClick={() => {
                                const newMuted = !mutedAll;
                                setMutedAll(newMuted);
                                setFeedMutedPreference(newMuted);
                                if (!newMuted) {
                                    const currentReel = reelsList[activeIndex];
                                    if (currentReel) {
                                        recordImplicitSignal({
                                            type: 'unmute',
                                            postId: String(currentReel.id),
                                            category: currentReel.category || 'General',
                                            timestamp: Date.now()
                                        });
                                    }
                                }
                                videoRefs.current.forEach((v, vIdx) => {
                                    if (v) {
                                        const hasMusic = Boolean(reelsList[vIdx]?.musicUrl);
                                        v.muted = hasMusic ? true : newMuted;
                                    }
                                });
                                audioRefs.current.forEach((a, idx) => {
                                    if (!a) return;
                                    a.muted = newMuted;
                                    if (idx === activeIndex) {
                                        if (newMuted) {
                                            a.pause();
                                        } else {
                                            playReelAudio(a);
                                        }
                                    }
                                });
                            }}
                            style={{ 
                                background: 'rgba(0,0,0,0.5)', border: 'none', color: 'var(--text-active)', 
                                width: '40px', height: '40px', borderRadius: '50%', pointerEvents: 'auto',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            {mutedAll ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                    </div>

                    {/* Scrollable Player */}
                    <div className="reels-page" ref={modalScrollRef} onScroll={handleReelsScroll}>
                        {reelsList.map((reel, idx) => {
                            const isLiked = likedReels.has(reel.id);
                            const isNearby = (idx >= activeIndex - 1) && (idx <= activeIndex + 2);

                            // ⚡ Virtualization: far-away reels render as empty snap placeholders.
                            // Keeps scroll height & snap points identical while cutting DOM + re-render cost per swipe.
                            if (idx < activeIndex - 1 || idx > activeIndex + 2) {
                                return (
                                    <div
                                        className="reel-card"
                                        key={reel.id}
                                        data-reel-index={idx}
                                    />
                                );
                            }
                            
                            return (
                                <div 
                                    className="reel-card" 
                                    key={reel.id}
                                    data-reel-index={idx}
                                    onTouchStart={handleTouchStart}
                                    onTouchEnd={(e) => handleTouchEnd(reel, e)}
                                >
                                    {isNearby ? (
                                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                            <video
                                                ref={(el) => {
                                                    const prev = videoRefs.current[idx];
                                                    if (!el && prev) {
                                                        try {
                                                            prev.pause();
                                                        } catch (_) {}
                                                    }
                                                    videoRefs.current[idx] = el;
                                                }}
                                                src={fallbackVideos[reel.id] || (reel.videoUrl ? reel.videoUrl.split('#')[0] : resolveLocalMediaUrl(reel.rawMediaUrl).split('#')[0])}
                                                poster={isVideoUrl(reel.posterUrl) || isFallbackPoster(reel.posterUrl) ? undefined : reel.posterUrl}
                                                loop
                                                playsInline
                                                // @ts-ignore
                                                webkit-playsinline="true"
                                                x5-playsinline="true"
                                                x5-video-player-type="h5"
                                                x5-video-orientation="portrait"
                                                // @ts-ignore
                                                disablePictureInPicture={true}
                                                // @ts-ignore
                                                disableRemotePlayback={true}
                                                preload={idx === activeIndex || idx === activeIndex + 1 ? 'auto' : 'metadata'}
                                                autoPlay={idx === selectedReelIndex}
                                                muted={Boolean(reel.musicUrl) || mutedAll}
                                                className="reel-video"
                                                style={{
                                                    filter: reel.css_filter || 'none',
                                                    transform: 'translateZ(0)',
                                                    WebkitTransform: 'translateZ(0)',
                                                    willChange: 'transform',
                                                }}
                                                onEnded={(e) => {
                                                    const v = e.currentTarget;
                                                    v.currentTime = 0;
                                                    const p = v.play();
                                                    if (p !== undefined) p.catch(() => {});
                                                }}
                                                onClick={(e) => handleDoubleTap(idx, e)}
                                                onWaiting={() => {
                                                    if (idx === activeIndex) {
                                                        if (bufferingTimeoutRef.current) clearTimeout(bufferingTimeoutRef.current);
                                                        bufferingTimeoutRef.current = setTimeout(() => {
                                                            setBufferingReels(prev => new Set(prev).add(reel.id));
                                                        }, 250);
                                                    }
                                                }}
                                                onPlaying={() => {
                                                    if (bufferingTimeoutRef.current) {
                                                        clearTimeout(bufferingTimeoutRef.current);
                                                        bufferingTimeoutRef.current = null;
                                                    }
                                                    setFailedVisuals(prev => {
                                                        if (!prev.has(reel.id)) return prev;
                                                        const next = new Set(prev);
                                                        next.delete(reel.id);
                                                        return next;
                                                    });
                                                    setBufferingReels(prev => {
                                                        if (!prev.has(reel.id)) return prev;
                                                        const next = new Set(prev);
                                                        next.delete(reel.id);
                                                        return next;
                                                    });
                                                    primeNextVideo(idx);
                                                }}
                                                onCanPlay={() => {
                                                    if (bufferingTimeoutRef.current) {
                                                        clearTimeout(bufferingTimeoutRef.current);
                                                        bufferingTimeoutRef.current = null;
                                                    }
                                                    setFailedVisuals(prev => {
                                                        if (!prev.has(reel.id)) return prev;
                                                        const next = new Set(prev);
                                                        next.delete(reel.id);
                                                        return next;
                                                    });
                                                    setBufferingReels(prev => {
                                                        if (!prev.has(reel.id)) return prev;
                                                        const next = new Set(prev);
                                                        next.delete(reel.id);
                                                        return next;
                                                    });
                                                }}
                                                onTimeUpdate={(e) => {
                                                    const v = e.currentTarget;
                                                    const a = audioRefs.current[idx];
                                                    if (a && !v.paused && !a.paused && v.currentTime < 0.35 && Math.abs(a.currentTime - v.currentTime) > 0.4) {
                                                        a.currentTime = v.currentTime;
                                                    }
                                                }}
                                                onError={() => {
                                                    if (!fallbackVideos[reel.id]) {
                                                        if (String(reel.id) === '52b23ede-dc9d-4c4d-8371-c01b5c916013' || reel.rawMediaUrl?.includes('1790250320016') || reel.caption?.includes('sonambajwa')) {
                                                            setFallbackVideos(prev => ({ ...prev, [reel.id]: '/videos/sonambajwa.mp4' }));
                                                            return;
                                                        }
                                                        const fbUrl = RELIABLE_FALLBACK_VIDEOS[reel.category] || RELIABLE_FALLBACK_VIDEOS.General;
                                                        setFallbackVideos(prev => ({ ...prev, [reel.id]: fbUrl }));
                                                        return;
                                                    }
                                                    setFailedVisuals(prev => new Set(prev).add(reel.id));
                                                    if (audioRefs.current[idx]) {
                                                        audioRefs.current[idx]?.pause();
                                                    }
                                                    setBufferingReels(prev => {
                                                        if (!prev.has(reel.id)) return prev;
                                                        const next = new Set(prev);
                                                        next.delete(reel.id);
                                                        return next;
                                                    });
                                                }}
                                            />
                                            {bufferingReels.has(reel.id) && idx === activeIndex && (
                                                <div className="reel-buffering-indicator">
                                                    <div className="reel-spinner" />
                                                </div>
                                            )}
                                            {failedVisuals.has(reel.id) && reel.posterUrl && !isVideoUrl(reel.posterUrl) && !isFallbackPoster(reel.posterUrl) && (
                                                <div style={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: '#000',
                                                    zIndex: 2,
                                                    pointerEvents: 'none'
                                                }}>
                                                    <img
                                                        src={reel.posterUrl}
                                                        alt={reel.caption || ''}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div
                                            className="reel-video"
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                background: '#000',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            {reel.posterUrl && !isVideoUrl(reel.posterUrl) && !isFallbackPoster(reel.posterUrl) ? (
                                                <img
                                                    src={reel.posterUrl}
                                                    alt=""
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
                                                    loading="lazy"
                                                    decoding="async"
                                                />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', background: '#121216' }} />
                                            )}
                                        </div>
                                    )}

                                    {/* Link Indicator */}
                                    {reel.attachedLink && (
                                        <div style={{ position: 'absolute', top: 100, right: 20, zIndex: 10, background: 'rgba(0,0,0,0.6)', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                                            <LinkIcon size={20} color="var(--text-active)" />
                                        </div>
                                    )}

                                    {/* Heart burst animation */}
                                    {idx === activeIndex && heartBursts.map((h) => (
                                        <div
                                            key={h.id}
                                            className="heart-burst"
                                            style={{ left: h.x, top: h.y }}
                                        >
                                            <Heart size={80} fill="#f5a524" stroke="none" />
                                        </div>
                                    ))}

                                    {/* Pause indicator */}
                                    {!playStates[idx] && (
                                        <div className="reel-pause-indicator">
                                            <Play size={54} fill="var(--text-active)" stroke="none" />
                                        </div>
                                    )}

                                    {/* Bottom gradient overlay */}
                                    <div className="reel-gradient-bottom" />

                                    {/* Creator info & caption */}
                                    <div className="reel-info">
                                        <div
                                            className="reel-creator"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (reel.creator) {
                                                    navigate(`/profile/${reel.creator}`);
                                                }
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <img
                                                src={reel.creatorAvatar}
                                                alt={reel.creator}
                                                className="reel-creator-avatar"
                                            />
                                            <span className="reel-creator-name">@{reel.creator}</span>
                                            <button
                                                className="reel-follow-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                }}
                                            >
                                                Friend
                                            </button>
                                        </div>
                                        {reel.musicUrl && idx === activeIndex && (
                                            <audio
                                                ref={(el) => { audioRefs.current[idx] = el; }}
                                                src={reel.musicUrl}
                                                loop
                                                style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                                                playsInline
                                                preload="auto"
                                            />
                                        )}
                                        <div className="reel-song">
                                            <Music size={12} />
                                            <span className="reel-song-marquee">{reel.song || 'Original Audio'}</span>
                                        </div>
                                        <p className="reel-caption">
                                            {reel.caption.split(/(\s+)/).map((word, wIdx) => {
                                                if (word.startsWith('#') && word.length > 1) {
                                                    const cleanTag = word.replace(/[^a-zA-Z0-9_\u0080-\uFFFF#]/g, '');
                                                    return (
                                                        <span
                                                            key={wIdx}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                recordHashtagSignal([cleanTag.replace('#', '')], 3.0);
                                                                closePlayer();
                                                                navigate(`/explore?q=${encodeURIComponent(cleanTag)}&tab=posts`);
                                                            }}
                                                            style={{
                                                                color: '#f5a524',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                display: 'inline'
                                                            }}
                                                        >
                                                            {word}
                                                        </span>
                                                    );
                                                }
                                                return word;
                                            })}
                                        </p>
                                    </div>

                                    {/* Side actions */}
                                    <div className="reel-actions">
                                        <button
                                            className={`reel-action-btn ${isLiked ? 'liked' : ''}`}
                                            onClick={() => toggleLike(reel.id)}
                                        >
                                            <Heart
                                                size={28}
                                                fill={isLiked ? '#f5a524' : 'none'}
                                                stroke={isLiked ? '#f5a524' : 'var(--text-active)'}
                                            />
                                            <span>{formatCount(reel.likes + (isLiked ? 1 : 0))}</span>
                                        </button>
                                        <button
                                            className="reel-action-btn"
                                            onClick={() => {
                                                setCommentsReelId(String(reel.id));
                                                setIsCommentsOpen(true);
                                            }}
                                            aria-label="Comments"
                                        >
                                            <MessageCircle size={28} />
                                            <span>{formatCount(Math.max(reel.comments, getLocalComments(String(reel.id)).length))}</span>
                                        </button>
                                        <button 
                                            className="reel-action-btn"
                                            onClick={() => {
                                                const mappedPost: PostData = {
                                                    id: String(reel.id),
                                                    user_id: '',
                                                    image_url: reel.videoUrl || reel.posterUrl,
                                                    caption: reel.caption,
                                                    media_type: 'video',
                                                    attached_link: reel.attachedLink,
                                                    created_at: new Date().toISOString(),
                                                    likes_count: reel.likes,
                                                    comments_count: reel.comments,
                                                    shares_count: reel.shares,
                                                    username: reel.creator,
                                                    avatar_url: reel.creatorAvatar
                                                };
                                                setPostToShare(mappedPost);
                                                setIsShareOpen(true);
                                            }}
                                            title="Send"
                                            aria-label="Send"
                                        >
                                            <Send size={26} style={{ transform: 'rotate(-20deg)', transformOrigin: 'center' }} />
                                            <span>{formatCount(reel.shares)}</span>
                                        </button>
                                        <button
                                            className={`reel-action-btn ${impedReels.has(reel.id) ? 'imped' : ''}`}
                                            onClick={() => toggleImpReel(reel.id)}
                                        >
                                            <Flame
                                                size={28}
                                                fill={impedReels.has(reel.id) ? '#ff4500' : 'none'}
                                                stroke={impedReels.has(reel.id) ? '#ff4500' : 'var(--text-active)'}
                                            />
                                            <span>{formatCount((reel.imps || 0) + (impedReels.has(reel.id) ? 1 : 0))}</span>
                                        </button>
                                        <div
                                            className="reel-disc"
                                            style={{ animationPlayState: idx === activeIndex && playStates[idx] ? 'running' : 'paused' }}
                                        >
                                            <img src={reel.creatorAvatar} alt="" />
                                        </div>
                                    </div>

                                    {/* Progress bar — width updated directly by RAF, not React state */}
                                    <div className="reel-progress-bar">
                                        <div
                                            className="reel-progress-fill"
                                            style={{ width: '0%' }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {user && (
                <Suspense fallback={null}>
                    <ChatPanel 
                        isOpen={isChatOpen} 
                        onClose={() => { setIsChatOpen(false); setChatUserId(null); }} 
                        currentUser={{ ...user, username: user.username || 'user' }} 
                        initialOpenUserId={chatUserId}
                        refreshKey={chatRefreshKey}
                        pendingShare={pendingShare}
                    />
                </Suspense>
            )}

            {isShareOpen && postToShare && user && (
                <Suspense fallback={null}>
                    <ShareModal 
                        isOpen={isShareOpen} 
                        onClose={() => { setIsShareOpen(false); setPostToShare(null); }} 
                        post={postToShare}
                        currentUser={{ ...user, username: user.username || 'user' }} 
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
                </Suspense>
            )}

            {isCommentsOpen && commentsReelId && user && (
                <Suspense fallback={null}>
                    <CommentsSheet
                        postId={commentsReelId}
                        isOpen={isCommentsOpen}
                        currentUser={{ id: user.id, username: user.username || 'user', avatar_url: user.avatar_url }}
                        onClose={() => {
                            setIsCommentsOpen(false);
                            setCommentsReelId(null);
                        }}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default Reels;
