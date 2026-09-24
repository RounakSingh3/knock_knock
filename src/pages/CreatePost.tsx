import React, { useState, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { uploadMedia, createNewPost, updatePoints, formatKnockVideoLink, awardUploadPoints, isKnockVideoLink, parseKnockVideoLink, sendAddMentionNotification, fetchConnectionUserIds, fetchFollowing, fetchProfilesByIds, type ProfileData } from '../lib/database';
import { getMediaTypeFromFile, compressImage, prepareVideoForUpload } from '../lib/media';
import { CONTENT_CATEGORIES, extractHashtags, recordHashtagSignal } from '../lib/algorithm';
import { ImagePlus, Loader2, Link as LinkIcon, Trash2, Music, X, Rocket, Film, Play, Sparkles, AtSign, UserPlus, Search, Check, Hash, Plus, Layers } from 'lucide-react';
import { MusicPickerModal, type Track } from '../components/MusicPickerModal';
import KnockVideoPickerModal, { type KnockVideoItem } from '../components/KnockVideoPickerModal';
import UploadRewardModal from '../components/UploadRewardModal';

const POPULAR_HASHTAGS = [
    { tag: '#trending', category: 'General' },
    { tag: '#viral', category: 'General' },
    { tag: '#reels', category: 'General' },
    { tag: '#foryou', category: 'General' },
    { tag: '#tech', category: 'Tech' },
    { tag: '#gaming', category: 'Gaming' },
    { tag: '#music', category: 'Music' },
    { tag: '#dance', category: 'Dance' },
    { tag: '#comedy', category: 'Comedy' },
    { tag: '#funny', category: 'Comedy' },
    { tag: '#fitness', category: 'Lifestyle' },
    { tag: '#food', category: 'Food' },
    { tag: '#travel', category: 'Travel' },
    { tag: '#art', category: 'Art' },
    { tag: '#fashion', category: 'Fashion' },
    { tag: '#nature', category: 'Nature' },
    { tag: '#education', category: 'Education' },
    { tag: '#lifestyle', category: 'Lifestyle' },
];

/** Rich hashtag autocomplete database with category & reach indicators */
const HASHTAG_DATABASE = [
    { tag: 'trending', label: '#trending', category: 'General', reach: '🔥 Trending' },
    { tag: 'viral', label: '#viral', category: 'General', reach: '🔥 10M+ reach' },
    { tag: 'reels', label: '#reels', category: 'General', reach: '🎥 Reels' },
    { tag: 'foryou', label: '#foryou', category: 'General', reach: '⚡ FYP' },
    { tag: 'knockknock', label: '#knockknock', category: 'General', reach: '✨ Community' },
    { tag: 'music', label: '#music', category: 'Music', reach: '🎵 Music' },
    { tag: 'song', label: '#song', category: 'Music', reach: '🎶 Beats' },
    { tag: 'beats', label: '#beats', category: 'Music', reach: '🎧 Audio' },
    { tag: 'musician', label: '#musician', category: 'Music', reach: '🎤 Artist' },
    { tag: 'vibe', label: '#vibe', category: 'Music', reach: '✨ Vibes' },
    { tag: 'dance', label: '#dance', category: 'Dance', reach: '💃 Dance' },
    { tag: 'dancer', label: '#dancer', category: 'Dance', reach: '🌟 Popular' },
    { tag: 'choreography', label: '#choreography', category: 'Dance', reach: '🔥 Hot' },
    { tag: 'dancechallenge', label: '#dancechallenge', category: 'Dance', reach: '⚡ Challenge' },
    { tag: 'comedy', label: '#comedy', category: 'Comedy', reach: '😂 Comedy' },
    { tag: 'funny', label: '#funny', category: 'Comedy', reach: '🤣 Fun' },
    { tag: 'memes', label: '#memes', category: 'Comedy', reach: '🔥 Viral' },
    { tag: 'jokes', label: '#jokes', category: 'Comedy', reach: '✨ Jokes' },
    { tag: 'gaming', label: '#gaming', category: 'Gaming', reach: '🎮 Gaming' },
    { tag: 'gamer', label: '#gamer', category: 'Gaming', reach: '👾 Streamer' },
    { tag: 'gameplay', label: '#gameplay', category: 'Gaming', reach: '🕹️ Plays' },
    { tag: 'esports', label: '#esports', category: 'Gaming', reach: '🏆 Esports' },
    { tag: 'fitness', label: '#fitness', category: 'Lifestyle', reach: '💪 Fitness' },
    { tag: 'workout', label: '#workout', category: 'Lifestyle', reach: '🏋️ Gym' },
    { tag: 'health', label: '#health', category: 'Lifestyle', reach: '🥗 Health' },
    { tag: 'motivation', label: '#motivation', category: 'Lifestyle', reach: '🔥 Daily' },
    { tag: 'food', label: '#food', category: 'Food', reach: '🍕 Food' },
    { tag: 'foodie', label: '#foodie', category: 'Food', reach: '🤤 Foodie' },
    { tag: 'cooking', label: '#cooking', category: 'Food', reach: '🍳 Recipe' },
    { tag: 'delicious', label: '#delicious', category: 'Food', reach: '🍰 Yummy' },
    { tag: 'travel', label: '#travel', category: 'Travel', reach: '✈️ Travel' },
    { tag: 'wanderlust', label: '#wanderlust', category: 'Travel', reach: '🌍 Adventure' },
    { tag: 'nature', label: '#nature', category: 'Nature', reach: '🌲 Nature' },
    { tag: 'scenic', label: '#scenic', category: 'Travel', reach: '🌅 Views' },
    { tag: 'tech', label: '#tech', category: 'Tech', reach: '💻 Tech' },
    { tag: 'coding', label: '#coding', category: 'Tech', reach: '⚡ Code' },
    { tag: 'developer', label: '#developer', category: 'Tech', reach: '🚀 Dev' },
    { tag: 'ai', label: '#ai', category: 'Tech', reach: '🤖 AI' },
    { tag: 'fashion', label: '#fashion', category: 'Fashion', reach: '👗 Style' },
    { tag: 'art', label: '#art', category: 'Art', reach: '🎨 Creative' },
    { tag: 'photography', label: '#photography', category: 'Art', reach: '📸 Photo' },
    { tag: 'love', label: '#love', category: 'Lifestyle', reach: '❤️ Love' },
    { tag: 'friends', label: '#friends', category: 'Lifestyle', reach: '👥 Squad' },
];

/** Curated thematic hashtag packs for instant 1-tap batch addition */
const HASHTAG_PACKS = [
    { name: '🔥 Trending Pack', tags: ['#viral', '#trending', '#reels', '#foryou', '#knockknock'], category: 'General' },
    { name: '🎵 Music & Audio', tags: ['#music', '#song', '#beats', '#musician', '#vibe'], category: 'Music' },
    { name: '💃 Dance & Rhythm', tags: ['#dance', '#dancer', '#choreography', '#dancechallenge'], category: 'Dance' },
    { name: '😂 Comedy & Memes', tags: ['#comedy', '#funny', '#memes', '#jokes'], category: 'Comedy' },
    { name: '🎮 Gaming Zone', tags: ['#gaming', '#gamer', '#gameplay', '#esports'], category: 'Gaming' },
    { name: '💪 Fitness & Gym', tags: ['#fitness', '#workout', '#gym', '#motivation'], category: 'Lifestyle' },
    { name: '🍕 Food & Recipes', tags: ['#food', '#foodie', '#cooking', '#delicious'], category: 'Food' },
    { name: '✈️ Travel & Explore', tags: ['#travel', '#wanderlust', '#nature', '#scenic'], category: 'Travel' },
    { name: '💻 Tech & Code', tags: ['#tech', '#coding', '#developer', '#ai'], category: 'Tech' },
];

const CSS_FILTERS = [
    { name: 'Normal', filter: 'none' },
    { name: 'Clarendon', filter: 'contrast(1.2) saturate(1.35)' },
    { name: 'Gingham', filter: 'brightness(1.05) hue-rotate(-10deg)' },
    { name: 'Moon', filter: 'grayscale(1) contrast(1.1) brightness(1.1)' },
    { name: 'Lark', filter: 'contrast(0.9)' },
    { name: 'Reyes', filter: 'sepia(0.22) brightness(1.1) contrast(0.85) saturate(0.75)' },
    { name: 'Juno', filter: 'saturate(1.4) hue-rotate(-10deg) contrast(1.1)' },
    { name: 'Slumber', filter: 'saturate(0.66) brightness(1.05)' },
    { name: 'Crema', filter: 'sepia(0.5) contrast(1.25) brightness(1.15) saturate(0.9) hue-rotate(-2deg)' },
    { name: 'Ludwig', filter: 'sepia(0.25) contrast(1.05) brightness(1.05) saturate(2)' },
    { name: 'Aden', filter: 'hue-rotate(-20deg) contrast(0.9) saturate(0.85) brightness(1.2)' },
    { name: 'Perpetua', filter: 'contrast(1.1) brightness(1.25) saturate(1.1)' }
];

const CreatePost = () => {
    const { user, points, setPoints } = useContext(AppContext);
    const navigate = useNavigate();

    const queryParams = new URLSearchParams(window.location.search);
    const isFromSpotlight = queryParams.get('redirect') === 'boost';

    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedFilter, setSelectedFilter] = useState('none');
    const [caption, setCaption] = useState('');
    const [attachedLink, setAttachedLink] = useState('');
    const [attachedKnockVideo, setAttachedKnockVideo] = useState<KnockVideoItem | null>(null);
    const [isVideoPickerOpen, setIsVideoPickerOpen] = useState(false);
    const [category, setCategory] = useState('General');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [uploadProgress, setUploadProgress] = useState<{ percentage: number; loadedMB: string; totalMB: string } | null>(null);
    const [boostToSpotlight, setBoostToSpotlight] = useState(isFromSpotlight && points >= 10);
    const [boostAmount, setBoostAmount] = useState(points >= 100 ? 100 : Math.max(10, points));

    const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

    // 🏷️ Add / Mention Friend State
    const [taggedFriend, setTaggedFriend] = useState<ProfileData | null>(null);
    const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
    const [friendsList, setFriendsList] = useState<ProfileData[]>([]);
    const [friendSearchQuery, setFriendSearchQuery] = useState('');
    const [loadingFriends, setLoadingFriends] = useState(false);

    const loadFriendsToMention = async () => {
        if (!user) return;
        setLoadingFriends(true);
        try {
            const [connIds, followingProfiles] = await Promise.all([
                fetchConnectionUserIds(user.id),
                fetchFollowing(user.id)
            ]);
            const idSet = new Set(connIds);
            const profiles = await fetchProfilesByIds(Array.from(idSet));
            const map = new Map<string, ProfileData>();
            profiles.forEach(p => map.set(p.id, p));
            followingProfiles.forEach(p => map.set(p.id, p));
            map.delete(user.id);
            setFriendsList(Array.from(map.values()));
        } catch (e) {
            console.error('Failed to load friends:', e);
        } finally {
            setLoadingFriends(false);
        }
    };

    // Celebratory upload reward modal
    const [showRewardModal, setShowRewardModal] = useState(false);
    const [rewardPointsEarned, setRewardPointsEarned] = useState(0);
    const [rewardNewBalance, setRewardNewBalance] = useState(0);

    // 🏷️ Hashtags & Algorithm Training State (Instagram-Style System)
    const MAX_HASHTAGS = 30; // Instagram maximum hashtag limit
    const [customHashtag, setCustomHashtag] = useState('');
    const [showPacks, setShowPacks] = useState(false);

    // Dynamically track all #hashtags present in caption
    const activeHashtags = useMemo(() => extractHashtags(caption), [caption]);

    // Live autocomplete suggestions based on current custom hashtag input
    const autocompleteSuggestions = useMemo(() => {
        const query = customHashtag.replace(/^#+/, '').trim().toLowerCase();
        if (!query) return [];
        return HASHTAG_DATABASE
            .filter(item => item.tag.includes(query) && !activeHashtags.includes(item.tag))
            .slice(0, 6);
    }, [customHashtag, activeHashtags]);

    const handleToggleHashtag = (tagWithHash: string, suggestedCategory?: string) => {
        const cleanTag = tagWithHash.replace(/^#+/, '').trim().toLowerCase();
        const tagRegex = new RegExp(`(^|\\s)#${cleanTag}\\b`, 'gi');
        if (tagRegex.test(caption)) {
            // Remove hashtag from caption
            const updated = caption.replace(tagRegex, '').trim();
            setCaption(updated);
        } else {
            if (activeHashtags.length >= MAX_HASHTAGS) return;
            // Add hashtag to caption
            const updated = caption ? `${caption.trim()} #${cleanTag}` : `#${cleanTag}`;
            setCaption(updated);
            if (suggestedCategory && suggestedCategory !== 'General' && category === 'General') {
                setCategory(suggestedCategory);
            }
        }
    };

    /**
     * Add multiple hashtags simultaneously (space, comma, or newline separated).
     * Accepts lists like: "#viral #reels #dance #music" or "viral, reels, dance, music"
     */
    const handleAddMultipleHashtags = (rawInput?: string, suggestedCategory?: string) => {
        const text = (rawInput !== undefined ? rawInput : customHashtag).trim();
        if (!text) return;

        // Split tokens by space, comma, or newline
        const tokens = text
            .replace(/,/g, ' ')
            .split(/\s+/)
            .map(t => t.replace(/^#+/, '').replace(/[^a-zA-Z0-9_\u0080-\uFFFF]/g, '').trim().toLowerCase())
            .filter(Boolean);

        if (tokens.length === 0) return;

        let currentCaption = caption;
        let currentTags = extractHashtags(currentCaption);
        let lastSuggestedCategory = suggestedCategory;

        for (const token of tokens) {
            if (currentTags.length >= MAX_HASHTAGS) break;
            if (!currentTags.includes(token)) {
                currentCaption = currentCaption ? `${currentCaption.trim()} #${token}` : `#${token}`;
                currentTags.push(token);
                if (!lastSuggestedCategory) {
                    const matched = HASHTAG_DATABASE.find(h => h.tag === token);
                    if (matched && matched.category !== 'General') {
                        lastSuggestedCategory = matched.category;
                    }
                }
            }
        }

        setCaption(currentCaption);
        if (lastSuggestedCategory && category === 'General') {
            setCategory(lastSuggestedCategory);
        }
        setCustomHashtag('');
    };

    /** 1-Tap apply curated topic packs (adds all tags from the bundle) */
    const handleApplyPack = (packTags: string[], packCategory?: string) => {
        let currentCaption = caption;
        let currentTags = extractHashtags(currentCaption);
        for (const rawTag of packTags) {
            if (currentTags.length >= MAX_HASHTAGS) break;
            const clean = rawTag.replace(/^#+/, '').trim().toLowerCase();
            if (!currentTags.includes(clean)) {
                currentCaption = currentCaption ? `${currentCaption.trim()} #${clean}` : `#${clean}`;
                currentTags.push(clean);
            }
        }
        setCaption(currentCaption);
        if (packCategory && packCategory !== 'General' && category === 'General') {
            setCategory(packCategory);
        }
    };

    const handleClearAllHashtags = () => {
        const stripped = caption.replace(/(^|\s)#[a-zA-Z0-9_\u0080-\uFFFF]+\b/gi, '').trim();
        setCaption(stripped);
    };

    const handleRemoveHashtag = (tagToRemove: string) => {
        const clean = tagToRemove.replace(/^#+/, '').trim().toLowerCase();
        const tagRegex = new RegExp(`(^|\\s)#${clean}\\b`, 'gi');
        setCaption(prev => prev.replace(tagRegex, '').trim());
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    const handleRemoveFile = () => {
        setFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setSelectedFilter('none');
    };

    const handleUpload = async () => {
        if (!file || !user) {
            setError('Please select a media file first.');
            return;
        }

        setLoading(true);
        setError('');
        setUploadProgress(null);

        try {
            const mediaType = getMediaTypeFromFile(file);
            let fileToUpload = file;

            let videoPosterBlob: Blob | null = null;
            if (mediaType === 'image') {
                try {
                    setError('Compressing image for fast upload...');
                    fileToUpload = await compressImage(file, 1200, 1200, 0.8);
                    setError('');
                } catch (compErr) {
                    console.error('Image compression failed, using original file:', compErr);
                }
            } else if (mediaType === 'video') {
                const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
                if (file.size > MAX_VIDEO_SIZE) {
                    setError(`This video is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please select a video smaller than 50MB.`);
                    setLoading(false);
                    return;
                }
                try {
                    const prepared = await prepareVideoForUpload(fileToUpload);
                    fileToUpload = prepared.videoFile;
                    if (prepared.posterBlob) {
                        videoPosterBlob = prepared.posterBlob;
                    }
                } catch (_) {}
            }

            const initialTotalMB = (fileToUpload.size / (1024 * 1024)).toFixed(1);
            setUploadProgress({ percentage: 0, loadedMB: '0.0', totalMB: initialTotalMB });
            const fileExt = fileToUpload.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const path = `posts/${fileName}`;

            let uploadedPosterUrl: string | undefined = undefined;
            if (videoPosterBlob) {
                try {
                    const posterFile = new File([videoPosterBlob], `${fileName.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
                    const posterPath = `posts/posters/${fileName.replace(/\.[^.]+$/, '')}.jpg`;
                    uploadedPosterUrl = await uploadMedia(posterFile, posterPath);
                } catch (pe) {
                    console.warn('Failed to upload video poster:', pe);
                }
            }

            const publicUrl = await uploadMedia(fileToUpload, path, (progress) => {
                const total = progress.total || fileToUpload.size || 1;
                const percentage = Math.min(100, Math.round((progress.loaded / total) * 100));
                const loadedMB = (progress.loaded / (1024 * 1024)).toFixed(1);
                const totalMB = (total / (1024 * 1024)).toFixed(1);
                setUploadProgress({ percentage, loadedMB, totalMB });
            });

            let finalUrl = publicUrl;
            if (uploadedPosterUrl) {
                finalUrl = `${finalUrl}#POSTER:${encodeURIComponent(uploadedPosterUrl)}`;
            }
            if (selectedFilter !== 'none') {
                try {
                    const u = new URL(finalUrl);
                    u.searchParams.set('filter', selectedFilter);
                    finalUrl = u.toString();
                } catch (e) {
                    finalUrl = finalUrl.includes('?') 
                        ? `${finalUrl}&filter=${encodeURIComponent(selectedFilter)}`
                        : `${finalUrl}?filter=${encodeURIComponent(selectedFilter)}`;
                }
            }

            // Expiry is 24 hours from now
            const boostExpiresAt = boostToSpotlight 
                ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                : null;

            await createNewPost({
                user_id: user.id,
                username: user.username || 'user',
                avatar_url: user.avatar_url || 'https://i.pravatar.cc/150',
                image_url: finalUrl,
                caption,
                attached_link: attachedLink || undefined,
                media_type: mediaType,
                category,
                css_filter: selectedFilter,
                boost_expires_at: boostExpiresAt,
                boost_impressions_remaining: boostToSpotlight ? boostAmount : 0,
                music_title: selectedTrack?.title,
                music_artist: selectedTrack?.artist,
                music_url: selectedTrack?.url
            });

            // Send mention notification to tagged friend so they can customize & repost in chat
            if (taggedFriend && user?.id) {
                sendAddMentionNotification({
                    senderId: user.id,
                    recipientId: taggedFriend.id,
                    mediaUrl: finalUrl,
                    caption: caption,
                }).catch(e => console.warn('Failed to send add mention notification:', e));
            }

            // Award points for uploading content on Knock Knock!
            const POST_REWARD_POINTS = 10;
            let currentBal = points;
            if (user?.id) {
                currentBal = await awardUploadPoints(user.id, POST_REWARD_POINTS, points);
                setPoints(currentBal);
            }

            // Immediately train recommendation algorithm for active user's posted topics
            if (activeHashtags.length > 0) {
                recordHashtagSignal(activeHashtags, 5.0);
            }

            if (boostToSpotlight) {
                const isUnlimited = user?.username === 'popcorn05' || user?.id === '9d147c04-d7ba-42cf-a84e-b8f0cae2e1c8';
                currentBal = isUnlimited ? 999999999 : Math.max(0, currentBal - boostAmount);
                await updatePoints(user.id, currentBal);
                setPoints(currentBal);
            }

            // Invalidate feed caches so newly uploaded content appears immediately at top of Home & Explore
            try {
                localStorage.removeItem('knock_home_posts_cache');
                localStorage.removeItem('knock_explore_posts_cache_v7');
            } catch (e) {}

            // Trigger celebratory reward congratulation modal
            setRewardPointsEarned(POST_REWARD_POINTS);
            setRewardNewBalance(currentBal);
            setShowRewardModal(true);
        } catch (err: unknown) {
            console.error('Upload Error:', err);
            const message = err instanceof Error ? err.message : 'An error occurred during upload.';
            setError(message);
        } finally {
            setLoading(false);
            setUploadProgress(null);
        }
    };

    const handleRewardModalClose = () => {
        setShowRewardModal(false);
        const redirect = queryParams.get('redirect');
        if (redirect === 'boost') {
            navigate(boostToSpotlight ? '/boost?mode=feed' : '/boost?mode=select');
        } else if (redirect) {
            navigate(`/${redirect}`);
        } else {
            navigate('/home');
        }
    };

    return (
        <div style={{ padding: '16px', background: 'var(--bg-color)', minHeight: '100vh', color: 'var(--text-active)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>New Post</h1>
                <button 
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', fontSize: '16px' }}
                >
                    Cancel
                </button>
            </div>

            {error && <div style={{ color: '#f5a524', marginBottom: '16px', padding: '12px', background: 'rgba(245, 165, 36,0.1)', borderRadius: '8px' }}>{error}</div>}

            {!previewUrl ? (
                <label style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    border: '2px dashed #2c2c2e', borderRadius: '16px', height: '300px', cursor: 'pointer',
                    background: 'var(--surface-color)', marginBottom: '24px'
                }}>
                    <ImagePlus size={48} color="#8e8e93" style={{ marginBottom: '16px' }} />
                    <span style={{ color: 'var(--text-inactive)' }}>Tap to select photo or video</span>
                    <input 
                        type="file" 
                        accept="image/*,video/*" 
                        multiple={false} 
                        onChange={handleFileChange} 
                        style={{ display: 'none' }} 
                    />
                </label>
            ) : (
                <div style={{ position: 'relative', marginBottom: '16px', borderRadius: '16px', overflow: 'hidden', background: 'var(--surface-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                    {file?.type.startsWith('video/') ? (
                        <video src={previewUrl} style={{ maxWidth: '100%', maxHeight: '100%', filter: selectedFilter }} controls autoPlay playsInline loop />
                    ) : (
                        <img src={previewUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: selectedFilter }} alt="Preview" />
                    )}
                    {file && (
                        <div style={{
                            position: 'absolute', top: '12px', left: '12px',
                            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                            padding: '4px 10px', borderRadius: '12px',
                            fontSize: '11px', color: '#fff', fontWeight: 'bold'
                        }}>
                            {file.type.startsWith('video/') ? '🎬 Video' : '📷 Photo'} • {(file.size / (1024 * 1024)).toFixed(1)} MB
                        </div>
                    )}
                    <button 
                        onClick={handleRemoveFile}
                        style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer', display: 'flex' }}
                    >
                        <Trash2 size={20} color="#ff3b30" />
                    </button>
                </div>
            )}

            {file && file.type.startsWith('video/') && file.size > 20 * 1024 * 1024 && (
                <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(245, 165, 36, 0.1)', border: '1px solid rgba(245, 165, 36, 0.25)', borderRadius: '12px', fontSize: '12px', color: '#f5a524' }}>
                    💡 Large video detected ({(file.size / (1024 * 1024)).toFixed(1)} MB). Upload may take a minute depending on your connection.
                </div>
            )}

            {previewUrl && (
                <div style={{ marginBottom: '24px', overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '8px', WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ display: 'inline-flex', gap: '12px' }}>
                        {CSS_FILTERS.map(f => (
                            <button
                                key={f.name}
                                onClick={() => setSelectedFilter(f.filter)}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                    opacity: selectedFilter === f.filter ? 1 : 0.6,
                                    transform: selectedFilter === f.filter ? 'scale(1.05)' : 'scale(1)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ 
                                    width: '60px', height: '60px', borderRadius: '12px', 
                                    background: 'var(--border-color)', marginBottom: '8px', overflow: 'hidden',
                                    border: selectedFilter === f.filter ? '2px solid #f5a524' : '2px solid transparent'
                                }}>
                                    {file?.type.startsWith('video/') ? (
                                        <video src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: f.filter }} muted />
                                    ) : (
                                        <img src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: f.filter }} alt="" />
                                    )}
                                </div>
                                <span style={{ color: 'var(--text-active)', fontSize: '11px', fontWeight: selectedFilter === f.filter ? 'bold' : 'normal' }}>
                                    {f.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ marginBottom: '16px' }}>
                <textarea 
                    placeholder="Write a caption..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    style={{
                        width: '100%',
                        background: 'var(--surface-color)',
                        border: '1px solid #2c2c2e',
                        borderRadius: '12px',
                        padding: '16px',
                        color: 'var(--text-active)',
                        minHeight: '100px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                }}
            />
            <button 
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMusicModalOpen(true); }}
                style={{ 
                    marginTop: '8px', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    background: selectedTrack ? 'rgba(245, 165, 36, 0.1)' : 'var(--surface-color)', 
                    border: selectedTrack ? '1px solid rgba(245, 165, 36, 0.3)' : '1px solid #2c2c2e', 
                    padding: '8px 12px', 
                    borderRadius: '20px', 
                    color: selectedTrack ? '#f5a524' : 'var(--text-active)',
                    cursor: 'pointer',
                    fontSize: '14px'
                }}
            >
                <Music size={16} color={selectedTrack ? "#f5a524" : "var(--text-active)"} />
                {selectedTrack ? `${selectedTrack.title} • ${selectedTrack.artist}` : 'Add Music'}
                {selectedTrack && (
                    <div onClick={(e) => { e.stopPropagation(); setSelectedTrack(null); }} style={{ marginLeft: '4px', display: 'flex', alignItems: 'center' }}>
                        <X size={14} />
                    </div>
                )}
            </button>
        </div>

            {/* 🏷️ Hashtags & Algorithm Topic Training Section (Instagram-Style Multi-Hashtags) */}
            <div style={{
                marginBottom: '20px',
                background: 'rgba(245, 165, 36, 0.05)',
                border: '1px solid rgba(245, 165, 36, 0.25)',
                borderRadius: '16px',
                padding: '14px 16px'
            }}>
                {/* Header with Title, Badge, and Instagram Hashtag Counter */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            background: 'rgba(245, 165, 36, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Hash size={16} color="#f5a524" />
                        </div>
                        <div>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-active)' }}>
                                Hashtags & Topics (#)
                            </span>
                        </div>
                    </div>
                    <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#f5a524',
                        background: 'rgba(245, 165, 36, 0.12)',
                        padding: '3px 8px',
                        borderRadius: '10px'
                    }}>
                        ⚡ Trains Algorithm
                    </span>
                </div>

                {/* Subtitle & Instagram 30-Limit Counter */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-inactive)', margin: 0, lineHeight: 1.4 }}>
                        Tag multiple topics to target your video to interested viewers.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: activeHashtags.length >= 30 ? 'rgba(239,68,68,0.2)' : activeHashtags.length >= 25 ? 'rgba(245,165,36,0.2)' : 'rgba(255,255,255,0.06)',
                            color: activeHashtags.length >= 30 ? '#ef4444' : activeHashtags.length >= 25 ? '#f5a524' : 'var(--text-inactive)',
                            border: activeHashtags.length >= 30 ? '1px solid rgba(239,68,68,0.5)' : '1px solid transparent'
                        }}>
                            {activeHashtags.length} / {MAX_HASHTAGS}
                        </span>
                        {activeHashtags.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClearAllHashtags}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: '2px 4px'
                                }}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* 30 Limit Warning Banner */}
                {activeHashtags.length >= 30 && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#fca5a5',
                        borderRadius: '10px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <span>⚠️ Maximum 30 hashtags reached (Instagram limit).</span>
                    </div>
                )}

                {/* Active Hashtag Badges */}
                {activeHashtags.length > 0 && (
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginBottom: '12px',
                        padding: '10px',
                        background: 'rgba(0,0,0,0.25)',
                        borderRadius: '12px',
                        border: '1px solid rgba(245, 165, 36, 0.2)',
                        maxHeight: '130px',
                        overflowY: 'auto'
                    }}>
                        {activeHashtags.map(tag => (
                            <span
                                key={tag}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'linear-gradient(135deg, rgba(245, 165, 36, 0.25), rgba(255, 107, 53, 0.18))',
                                    border: '1px solid #f5a524',
                                    color: '#f5a524',
                                    padding: '4px 10px',
                                    borderRadius: '16px',
                                    fontSize: '12px',
                                    fontWeight: 700
                                }}
                            >
                                #{tag}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveHashtag(tag)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#f5a524',
                                        padding: 0,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <X size={13} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {/* Custom Hashtag Input Bar with Autocomplete Dropdown */}
                <div style={{ position: 'relative', marginBottom: '12px' }}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleAddMultipleHashtags();
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            background: 'var(--surface-color)',
                            border: '1px solid #2c2c2e',
                            borderRadius: '12px',
                            padding: '8px 12px'
                        }}>
                            <span style={{ color: '#f5a524', fontWeight: 800, marginRight: '4px', fontSize: '14px' }}>#</span>
                            <input
                                type="text"
                                disabled={activeHashtags.length >= 30}
                                placeholder={activeHashtags.length >= 30 ? "Maximum 30 hashtags reached" : "Type or paste multiple tags (e.g. #music, #dance, #viral)..."}
                                value={customHashtag}
                                onChange={(e) => setCustomHashtag(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddMultipleHashtags();
                                    } else if (e.key === ' ' || e.key === ',') {
                                        if (customHashtag.trim().length > 0) {
                                            e.preventDefault();
                                            handleAddMultipleHashtags();
                                        }
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-active)',
                                    outline: 'none',
                                    fontSize: '13px',
                                    fontFamily: 'inherit'
                                }}
                            />
                            {customHashtag && (
                                <button
                                    type="button"
                                    onClick={() => setCustomHashtag('')}
                                    style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', padding: 0 }}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            disabled={activeHashtags.length >= 30 || !customHashtag.trim()}
                            onClick={() => handleAddMultipleHashtags()}
                            style={{
                                background: activeHashtags.length >= 30 || !customHashtag.trim() ? 'var(--border-color)' : 'linear-gradient(135deg, #f5a524, #ff6b35)',
                                border: 'none',
                                color: activeHashtags.length >= 30 || !customHashtag.trim() ? 'var(--text-inactive)' : '#000',
                                padding: '9px 14px',
                                borderRadius: '12px',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: activeHashtags.length >= 30 || !customHashtag.trim() ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <Plus size={14} strokeWidth={3} />
                            <span>Add</span>
                        </button>
                    </form>

                    {/* Instagram-Style Live Autocomplete Suggestions Dropdown */}
                    {autocompleteSuggestions.length > 0 && activeHashtags.length < 30 && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 40,
                            marginTop: '4px',
                            background: '#1c1c1e',
                            border: '1px solid rgba(245, 165, 36, 0.4)',
                            borderRadius: '12px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                            overflow: 'hidden'
                        }}>
                            <div style={{ padding: '6px 12px', fontSize: '11px', color: '#8e8e93', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                Suggested Hashtags (Instagram style):
                            </div>
                            {autocompleteSuggestions.map(item => (
                                <button
                                    key={item.tag}
                                    type="button"
                                    onClick={() => handleAddMultipleHashtags(item.tag, item.category)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: '#f5a524', fontWeight: 700, fontSize: '13px' }}>#{item.tag}</span>
                                        <span style={{ fontSize: '11px', color: '#8e8e93' }}>• {item.category}</span>
                                    </div>
                                    <span style={{ fontSize: '11px', color: '#f5a524', background: 'rgba(245,165,36,0.1)', padding: '2px 6px', borderRadius: '8px' }}>
                                        {item.reach}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 1-Tap Quick Trending & Category Topic Chips */}
                <div style={{ marginBottom: '14px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-inactive)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                        🔥 Popular Topics (Tap multiple to add to video):
                    </span>
                    <div style={{
                        display: 'flex',
                        gap: '6px',
                        overflowX: 'auto',
                        paddingBottom: '4px',
                        WebkitOverflowScrolling: 'touch'
                    }}>
                        {POPULAR_HASHTAGS.map(({ tag, category: catHint }) => {
                            const isAdded = activeHashtags.includes(tag.replace('#', ''));
                            return (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => handleToggleHashtag(tag, catHint)}
                                    style={{
                                        background: isAdded ? 'rgba(245, 165, 36, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                        border: isAdded ? '1px solid #f5a524' : '1px solid rgba(255, 255, 255, 0.1)',
                                        color: isAdded ? '#f5a524' : 'var(--text-inactive)',
                                        padding: '5px 10px',
                                        borderRadius: '14px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <span>{tag}</span>
                                    {isAdded ? <Check size={12} strokeWidth={3} /> : <span style={{ opacity: 0.5, fontSize: '10px' }}>+</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 📦 Curated Hashtag Topic Packs (1-Tap Batch Add) */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-inactive)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Layers size={13} color="#f5a524" />
                            <span>1-Tap Thematic Packs (Instagram Sets):</span>
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowPacks(!showPacks)}
                            style={{ background: 'none', border: 'none', color: '#f5a524', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                        >
                            {showPacks ? 'Show Less ▴' : 'View All Packs ▾'}
                        </button>
                    </div>

                    <div style={{
                        display: 'flex',
                        gap: '6px',
                        overflowX: 'auto',
                        paddingBottom: '4px',
                        WebkitOverflowScrolling: 'touch'
                    }}>
                        {(showPacks ? HASHTAG_PACKS : HASHTAG_PACKS.slice(0, 4)).map(pack => {
                            const unaddedCount = pack.tags.filter(t => !activeHashtags.includes(t.replace('#', ''))).length;
                            const isFullyAdded = unaddedCount === 0;

                            return (
                                <button
                                    key={pack.name}
                                    type="button"
                                    onClick={() => handleApplyPack(pack.tags, pack.category)}
                                    disabled={isFullyAdded || activeHashtags.length >= 30}
                                    style={{
                                        background: isFullyAdded ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                        border: isFullyAdded ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                                        color: isFullyAdded ? '#4ade80' : 'var(--text-active)',
                                        padding: '6px 10px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: isFullyAdded ? 'default' : 'pointer',
                                        whiteSpace: 'nowrap',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <span>{pack.name}</span>
                                    <span style={{
                                        fontSize: '10px',
                                        padding: '1px 5px',
                                        borderRadius: '8px',
                                        background: isFullyAdded ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 165, 36, 0.2)',
                                        color: isFullyAdded ? '#4ade80' : '#f5a524',
                                        fontWeight: 700
                                    }}>
                                        {isFullyAdded ? '✓ Added' : `+${unaddedCount}`}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Knock Knock Video Link & Attachment Section */}
            <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '14px', color: 'var(--text-inactive)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Attached Video or Link</span>
                    <span style={{ fontSize: '11px', color: '#f5a524', fontWeight: 600 }}>👈 Left Swipe Feature</span>
                </label>

                {attachedKnockVideo ? (
                    /* Attached Knock Knock Video Card */
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(245, 165, 36, 0.12) 0%, rgba(255, 107, 53, 0.08) 100%)',
                        border: '1px solid rgba(245, 165, 36, 0.4)',
                        borderRadius: '16px',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        boxShadow: '0 4px 15px rgba(245, 165, 36, 0.15)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '10px',
                                background: '#000',
                                overflow: 'hidden',
                                position: 'relative',
                                flexShrink: 0
                            }}>
                                <video src={attachedKnockVideo.videoUrl} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                                    <Play size={14} fill="#fff" color="#fff" />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{
                                        fontSize: '9px',
                                        background: 'linear-gradient(135deg, #f5a524, #ff6b35)',
                                        color: '#000',
                                        fontWeight: 800,
                                        padding: '1px 6px',
                                        borderRadius: '8px',
                                        textTransform: 'uppercase'
                                    }}>
                                        Knock Video
                                    </span>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#f5a524' }}>
                                        @{attachedKnockVideo.username}
                                    </span>
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-inactive)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                                    {attachedKnockVideo.caption || 'Connected Knock Knock Video'}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <button
                                type="button"
                                onClick={() => setIsVideoPickerOpen(true)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    padding: '6px 10px',
                                    color: 'var(--text-active)',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                Change
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setAttachedKnockVideo(null);
                                    setAttachedLink('');
                                }}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '28px',
                                    height: '28px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={14} color="#ef4444" />
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Button to open Knock Knock Video Picker */
                    <button
                        type="button"
                        onClick={() => setIsVideoPickerOpen(true)}
                        style={{
                            width: '100%',
                            background: 'rgba(245, 165, 36, 0.08)',
                            border: '1px dashed rgba(245, 165, 36, 0.4)',
                            borderRadius: '14px',
                            padding: '12px 16px',
                            color: '#f5a524',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 700,
                            marginBottom: '10px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Film size={18} color="#f5a524" />
                        <span>Attach Knock Knock Video 🎥 (Swipe Left to Watch)</span>
                    </button>
                )}

                {/* 🏷️ Add Friend (@Mention) Section */}
                {taggedFriend ? (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
                        border: '1.5px solid rgba(99, 102, 241, 0.4)',
                        borderRadius: '14px',
                        padding: '10px 14px',
                        marginBottom: '10px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img
                                src={taggedFriend.avatar_url || 'https://i.pravatar.cc/150'}
                                alt=""
                                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{
                                        fontSize: '9px',
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        color: '#fff',
                                        fontWeight: 800,
                                        padding: '1px 6px',
                                        borderRadius: '8px',
                                        textTransform: 'uppercase'
                                    }}>
                                        Added Friend
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#a5b4fc' }}>
                                        @{taggedFriend.username}
                                    </span>
                                </div>
                                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', display: 'block', marginTop: '2px' }}>
                                    They will receive this in chat to customize & repost!
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setTaggedFriend(null)}
                            style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={14} color="#ef4444" />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => {
                            setIsAddFriendModalOpen(true);
                            loadFriendsToMention();
                        }}
                        style={{
                            width: '100%',
                            background: 'rgba(99, 102, 241, 0.08)',
                            border: '1px dashed rgba(99, 102, 241, 0.4)',
                            borderRadius: '14px',
                            padding: '12px 16px',
                            color: '#a5b4fc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 700,
                            marginBottom: '10px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <AtSign size={18} color="#a5b4fc" />
                        <span>Add Friend / Mention (@Tag)</span>
                    </button>
                )}

                {/* Optional Manual Link Input */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--surface-color)',
                    border: '1px solid #2c2c2e',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    marginTop: '8px'
                }}>
                    <LinkIcon size={16} color="#8e8e93" style={{ marginRight: '10px' }} />
                    <input 
                        type="url"
                        placeholder="Or paste external/custom link..."
                        value={attachedLink}
                        onChange={(e) => {
                            setAttachedLink(e.target.value);
                            if (!e.target.value) setAttachedKnockVideo(null);
                        }}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-active)',
                            outline: 'none',
                            fontSize: '13px'
                        }}
                    />
                    {attachedLink && (
                        <button
                            type="button"
                            onClick={() => {
                                setAttachedLink('');
                                setAttachedKnockVideo(null);
                            }}
                            style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', padding: 0 }}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-inactive)', marginTop: '6px', paddingLeft: '4px' }}>
                    💡 Viewers can swipe left on your post to instantly open and watch this video!
                </p>
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '14px', color: 'var(--text-inactive)', marginBottom: '8px', display: 'block' }}>Category</label>
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{
                        width: '100%',
                        background: 'var(--surface-color)',
                        border: '1px solid #2c2c2e',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        color: 'var(--text-active)',
                        fontSize: '15px',
                        outline: 'none',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238e8e93' viewBox='0 0 16 16'%3E%3Cpath d='M8 12L2 6h12z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 16px center',
                    }}
                >
                    {CONTENT_CATEGORIES.map(cat => (
                        <option key={cat} value={cat} style={{ background: 'var(--surface-color)' }}>{cat}</option>
                    ))}
                </select>
            </div>

            <div style={{ 
                marginBottom: '24px', 
                padding: '16px', 
                background: 'rgba(245, 165, 36, 0.05)', 
                border: '1px solid rgba(245, 165, 36, 0.2)', 
                borderRadius: '16px' 
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>🚀</span>
                        <div>
                            <span style={{ color: 'var(--text-active)', fontWeight: 'bold', display: 'block' }}>Boost Post</span>
                            <span style={{ color: 'var(--text-inactive)', fontSize: '12px' }}>Feature in Boost feed for 24h</span>
                        </div>
                    </div>
                    {points > 0 ? (
                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                            <input 
                                type="checkbox" 
                                checked={boostToSpotlight} 
                                onChange={(e) => setBoostToSpotlight(e.target.checked)}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{ 
                                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                                backgroundColor: boostToSpotlight ? '#f5a524' : '#555', 
                                transition: '.4s', borderRadius: '24px' 
                            }}>
                                <span style={{ 
                                    position: 'absolute', content: '""', height: '18px', width: '18px', 
                                    left: boostToSpotlight ? '22px' : '4px', bottom: '3px', 
                                    backgroundColor: 'white', transition: '.4s', borderRadius: '50%' 
                                }} />
                            </span>
                        </label>
                    ) : (
                        <span style={{ color: '#f5a524', fontSize: '12px', fontWeight: 'bold' }}>Need points</span>
                    )}
                </div>
                {boostToSpotlight && points > 0 && (
                    <div style={{ marginTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-active)' }}>Points to spend: <strong style={{ color: '#ffcc00' }}>{boostAmount}</strong></span>
                            <span style={{ fontSize: '13px', color: 'var(--text-inactive)' }}>Guarantees {boostAmount} views</span>
                        </div>
                        <input 
                            type="range" 
                            min="1" 
                            max={points >= 999999999 ? 1000 : Math.max(1, points)} 
                            value={boostAmount} 
                            onChange={(e) => setBoostAmount(parseInt(e.target.value))}
                            style={{ width: '100%', accentColor: '#f5a524' }}
                        />
                    </div>
                )}
                {points === 0 && (
                    <p style={{ color: 'var(--text-inactive)', fontSize: '11px', marginTop: '8px', marginBottom: 0 }}>
                        You currently have {points} points. Stay active or make posts to earn more points!
                    </p>
                )}
            </div>

            {loading ? (
                <div style={{
                    width: '100%',
                    background: 'var(--surface-color)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '30px',
                    padding: '16px',
                    boxSizing: 'border-box',
                    marginBottom: '16px'
                }}>
                    {uploadProgress !== null ? (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--text-active)', fontWeight: 'bold' }}>
                                <span>Uploading {file ? getMediaTypeFromFile(file) : 'file'}...</span>
                                <span style={{ color: '#f5a524' }}>
                                    {uploadProgress.percentage}% ({uploadProgress.loadedMB} / {uploadProgress.totalMB} MB)
                                </span>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${uploadProgress.percentage}%`, height: '100%', background: 'linear-gradient(90deg, #f5a524, #ff6b35)', transition: 'width 0.15s ease-out' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--text-inactive)' }}>
                                <span>⚡ Direct cloud upload</span>
                                <span>{uploadProgress.percentage === 100 ? 'Saving post...' : 'Please keep app open'}</span>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-active)' }}>
                            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                            <span>Processing media...</span>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Add Background Music Option */}
                    <div style={{ marginBottom: '16px' }}>
                        {selectedTrack ? (
                            <>
                                <audio
                                    src={selectedTrack.url}
                                    autoPlay
                                    loop
                                    playsInline
                                    style={{ display: 'none' }}
                                />
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: 'rgba(245, 165, 36, 0.15)', border: '1px solid #f5a524',
                                    borderRadius: '16px', padding: '12px 16px', color: '#fff'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Music size={20} color="#f5a524" />
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{selectedTrack.title}</div>
                                            <div style={{ fontSize: '12px', color: '#aaa' }}>{selectedTrack.artist} • {selectedTrack.category}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedTrack(null)}
                                        style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setIsMusicModalOpen(true)}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '8px', background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.2)',
                                    borderRadius: '16px', padding: '12px', color: '#fff', fontSize: '14px',
                                    fontWeight: 'bold', cursor: 'pointer'
                                }}
                            >
                                <Music size={18} color="#f5a524" />
                                <span>Add Background Music / Track</span>
                            </button>
                        )}
                    </div>

                    <button 
                        onClick={handleUpload}
                        disabled={!file}
                        style={{
                            width: '100%',
                            background: !file ? 'var(--border-color)' : 'linear-gradient(45deg, #f5a524, #ff6b35)',
                            color: !file ? 'var(--text-inactive)' : 'var(--text-active)',
                            border: 'none',
                            borderRadius: '30px',
                            padding: '16px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            cursor: !file ? 'not-allowed' : 'pointer',
                            transition: 'background 0.2s',
                            marginBottom: '16px'
                        }}
                    >
                        Share Post / Reel
                    </button>
                </>
            )}

            {/* Music Picker Modal */}
            <MusicPickerModal
                isOpen={isMusicModalOpen}
                onClose={() => setIsMusicModalOpen(false)}
                onSelectTrack={(track) => setSelectedTrack(track)}
                selectedTrackId={selectedTrack?.id}
            />

            {/* Knock Knock Video Picker Modal */}
            <KnockVideoPickerModal
                isOpen={isVideoPickerOpen}
                onClose={() => setIsVideoPickerOpen(false)}
                currentUserId={user?.id}
                currentUsername={user?.username}
                onSelectVideo={(vid) => {
                    setAttachedKnockVideo(vid);
                    setAttachedLink(formatKnockVideoLink(vid));
                }}
            />

            {/* Celebratory Upload Reward Congratulatory Modal */}
            <UploadRewardModal
                isOpen={showRewardModal}
                pointsAwarded={rewardPointsEarned}
                newTotalPoints={rewardNewBalance}
                uploadType={file?.type.startsWith('video/') ? 'video' : 'post'}
                onClose={handleRewardModalClose}
            />

            {/* 🏷️ Add Friend Modal */}
            {isAddFriendModalOpen && (
                <div 
                    onClick={() => setIsAddFriendModalOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 100060,
                        background: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'var(--surface-color)',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            borderRadius: '24px',
                            width: '100%',
                            maxWidth: '380px',
                            maxHeight: '75vh',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Modal Header */}
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AtSign size={20} color="#a5b4fc" />
                                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-active)' }}>
                                    Add Friend
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsAddFriendModalOpen(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.08)', border: 'none',
                                    borderRadius: '50%', width: '28px', height: '28px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--text-inactive)', cursor: 'pointer'
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Search Input */}
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '12px',
                                padding: '8px 12px',
                                gap: '8px'
                            }}>
                                <Search size={16} color="var(--text-inactive)" />
                                <input
                                    type="text"
                                    value={friendSearchQuery}
                                    onChange={(e) => setFriendSearchQuery(e.target.value)}
                                    placeholder="Search friend username or name..."
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-active)',
                                        fontSize: '13px',
                                        outline: 'none',
                                        flex: 1
                                    }}
                                />
                            </div>
                        </div>

                        {/* Friends List */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                            {loadingFriends ? (
                                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-inactive)', fontSize: '13px' }}>
                                    Loading friends...
                                </div>
                            ) : friendsList.filter(f => (f.username || '').toLowerCase().includes(friendSearchQuery.toLowerCase()) || (f.name || '').toLowerCase().includes(friendSearchQuery.toLowerCase())).length === 0 ? (
                                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-inactive)' }}>
                                    <p style={{ margin: 0, fontSize: '13px' }}>No friends found</p>
                                </div>
                            ) : (
                                friendsList
                                    .filter(f => (f.username || '').toLowerCase().includes(friendSearchQuery.toLowerCase()) || (f.name || '').toLowerCase().includes(friendSearchQuery.toLowerCase()))
                                    .map(friend => (
                                        <div
                                            key={friend.id}
                                            onClick={() => {
                                                setTaggedFriend(friend);
                                                setIsAddFriendModalOpen(false);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '10px 12px',
                                                borderRadius: '12px',
                                                cursor: 'pointer',
                                                background: taggedFriend?.id === friend.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                                transition: 'background 0.15s ease'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <img
                                                    src={friend.avatar_url || 'https://i.pravatar.cc/150'}
                                                    alt=""
                                                    style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                                                />
                                                <div>
                                                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-active)' }}>
                                                        {friend.name || friend.username}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#a5b4fc' }}>
                                                        @{friend.username}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                style={{
                                                    background: taggedFriend?.id === friend.id ? '#6366f1' : 'rgba(255,255,255,0.08)',
                                                    color: taggedFriend?.id === friend.id ? '#fff' : 'var(--text-active)',
                                                    border: 'none',
                                                    borderRadius: '10px',
                                                    padding: '6px 12px',
                                                    fontSize: '12px',
                                                    fontWeight: 700
                                                }}
                                            >
                                                {taggedFriend?.id === friend.id ? 'Added' : '+ Add'}
                                            </button>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreatePost;
