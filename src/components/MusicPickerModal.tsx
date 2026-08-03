import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Play, Pause, Music, Search, Check, Sparkles, Upload, Flame, Loader2 } from 'lucide-react';

export interface Track {
    id: string;
    title: string;
    artist: string;
    category: string;
    url: string;
    cover: string;
    duration: string;
    isCustom?: boolean;
    isITunes?: boolean;
}

export const FREE_MUSIC_TRACKS: Track[] = [
    // 🔥 Trending & Viral
    {
        id: 'trend-1',
        title: 'As It Was Vibes',
        artist: 'Pop Collective',
        category: 'Trending',
        url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
        cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150',
        duration: '2:15',
    },
    {
        id: 'trend-2',
        title: 'Calm Down Instrumental',
        artist: 'Afro Beats Sound',
        category: 'Trending',
        url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a815a3.mp3?filename=summer-walk-15363.mp3',
        cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150',
        duration: '2:30',
    },
    {
        id: 'trend-3',
        title: 'Flowers Acoustic Remix',
        artist: 'Summer Acoustic',
        category: 'Trending',
        url: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939b46617.mp3?filename=acoustic-guitar-loop-124976.mp3',
        cover: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=150',
        duration: '2:10',
    },

    // 🇮🇳 Bollywood & Desi Vibes
    {
        id: 'desi-1',
        title: 'Kesariya Melodic Flute',
        artist: 'Desi Flute Project',
        category: 'Bollywood',
        url: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_946d5c64ef.mp3?filename=relaxing-light-background-music-11756.mp3',
        cover: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150',
        duration: '2:40',
    },
    {
        id: 'desi-2',
        title: 'Maan Meri Jaan Lofi',
        artist: 'Indian Lofi Station',
        category: 'Bollywood',
        url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=lofi-chill-medium-version-109038.mp3',
        cover: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=150',
        duration: '2:00',
    },
    {
        id: 'desi-3',
        title: 'Tum Hi Ho Sitar Ambient',
        artist: 'Classic Sitar Strings',
        category: 'Bollywood',
        url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a815a4.mp3?filename=hip-hop-rock-beats-118000.mp3',
        cover: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=150',
        duration: '2:25',
    },

    // 🔥 Punjabi Hits
    {
        id: 'punjabi-1',
        title: 'Elevated Bass Drop',
        artist: 'Punjabi Trap Records',
        category: 'Punjabi',
        url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a815a4.mp3?filename=hip-hop-rock-beats-118000.mp3',
        cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150',
        duration: '1:55',
    },
    {
        id: 'punjabi-2',
        title: '295 Heavy Beat',
        artist: 'Desi Dhol Beats',
        category: 'Punjabi',
        url: 'https://cdn.pixabay.com/download/audio/2022/11/06/audio_c89b706c9a.mp3?filename=synthwave-80s-127027.mp3',
        cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=150',
        duration: '2:20',
    },

    // 💖 Romantic & Chill
    {
        id: 'romantic-1',
        title: 'Perfect Sunset Romance',
        artist: 'Piano Dreams',
        category: 'Romantic',
        url: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_946d5c64ef.mp3?filename=relaxing-light-background-music-11756.mp3',
        cover: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=150',
        duration: '2:35',
    },

    // 💃 Pop Hits & Dance
    {
        id: 'pop-1',
        title: 'Summer Sunshine Walk',
        artist: 'PopVibes',
        category: 'Pop',
        url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a815a3.mp3?filename=summer-walk-15363.mp3',
        cover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=150',
        duration: '2:30',
    },

    // 🌌 Lofi & Midnight
    {
        id: 'lofi-1',
        title: 'Lofi Study Night',
        artist: 'ChillBeats',
        category: 'Lofi',
        url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
        cover: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=150',
        duration: '2:15',
    },
];

const CATEGORIES = ['All', 'Bollywood', 'Hollywood', 'Punjabi', 'Romantic', 'Pop', 'Lofi', 'Hip Hop', 'EDM'];

/** Search real iTunes music database (100% Free - Bollywood, Hollywood, Global) */
async function fetchITunesTracks(searchTerm: string, category: string): Promise<Track[]> {
    try {
        let query = searchTerm.trim();
        if (!query) {
            if (category === 'Bollywood') query = 'bollywood hindi top hits';
            else if (category === 'Hollywood') query = 'hollywood billboard top pop hits';
            else if (category === 'Punjabi') query = 'punjabi top hits Diljit Karan Aujla';
            else if (category === 'Romantic') query = 'romantic hindi songs Arijit Singh';
            else if (category === 'Pop') query = 'top pop hits 2026';
            else if (category === 'Lofi') query = 'lofi chill hindi songs';
            else if (category === 'Hip Hop') query = 'hip hop rap desi hits';
            else if (category === 'EDM') query = 'edm dance hits';
            else query = 'bollywood hindi top songs 2026';
        }

        // Search Indian iTunes Store (country=IN) for full Bollywood & Global catalogue
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=IN&media=music&entity=song&limit=60`);
        if (!res.ok) return [];

        const data = await res.json();
        if (!data.results) return [];

        const seenKeys = new Set<string>();
        const tracks: Track[] = [];

        for (const item of data.results) {
            if (!item.previewUrl || !item.trackName) continue;

            const dedupeKey = `${item.trackName.toLowerCase()}-${(item.artistName || '').toLowerCase()}`;
            if (seenKeys.has(dedupeKey)) continue;
            seenKeys.add(dedupeKey);

            const durationSec = Math.round((item.trackTimeMillis || 30000) / 1000);
            const mins = Math.floor(durationSec / 60);
            const secs = (durationSec % 60).toString().padStart(2, '0');
            const cover = item.artworkUrl100
                ? item.artworkUrl100.replace('100x100bb', '300x300bb')
                : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150';

            tracks.push({
                id: `itunes-${item.trackId}`,
                title: item.trackName,
                artist: item.artistName || 'Unknown Artist',
                category: item.primaryGenreName || category || 'Music',
                url: item.previewUrl,
                cover,
                duration: `${mins}:${secs}`,
                isITunes: true,
            });
        }

        return tracks;
    } catch (e) {
        console.warn('iTunes music fetch error:', e);
        return [];
    }
}

interface MusicPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTrack: (track: Track) => void;
    selectedTrackId?: string;
}

export const MusicPickerModal: React.FC<MusicPickerModalProps> = ({
    isOpen,
    onClose,
    onSelectTrack,
    selectedTrackId,
}) => {
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
    const [customTracks, setCustomTracks] = useState<Track[]>([]);
    const [iTunesTracks, setITunesTracks] = useState<Track[]>([]);
    const [isSearchingMusic, setIsSearchingMusic] = useState(false);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const blobUrlsRef = useRef<string[]>([]);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch iTunes tracks on search / category change with debounce
    useEffect(() => {
        if (!isOpen) return;

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        setIsSearchingMusic(true);

        debounceTimerRef.current = setTimeout(async () => {
            const tracks = await fetchITunesTracks(search, activeCategory);
            setITunesTracks(tracks);
            setIsSearchingMusic(false);
        }, 300);

        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, [search, activeCategory, isOpen]);

    // Cleanup audio and blob URLs on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current.load();
                audioRef.current = null;
            }
            blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
            blobUrlsRef.current = [];
        };
    }, []);

    if (!isOpen) return null;

    // Combine custom uploads + iTunes search results + fallback dummy tracks if empty
    const displayTracks = [
        ...customTracks,
        ...iTunesTracks,
        ...(iTunesTracks.length === 0 && !isSearchingMusic ? FREE_MUSIC_TRACKS : [])
    ];

    const togglePlay = (track: Track, e: React.MouseEvent) => {
        e.stopPropagation();
        if (playingTrackId === track.id) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current.load();
            }
            setPlayingTrackId(null);
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current.load();
            }
            const newAudio = new Audio(track.url);
            audioRef.current = newAudio;
            newAudio.play().catch(err => console.warn('Audio play failed:', err));
            setPlayingTrackId(track.id);
            newAudio.onended = () => setPlayingTrackId(null);
        }
    };

    const handleSelect = (track: Track) => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current.load();
        }
        setPlayingTrackId(null);
        onSelectTrack(track);
        onClose();
    };

    const handleCustomAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const fileUrl = URL.createObjectURL(file);
            blobUrlsRef.current.push(fileUrl);
            const titleWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            
            const newTrack: Track = {
                id: `custom-${Date.now()}`,
                title: titleWithoutExt || 'My Custom Song',
                artist: 'Custom Upload',
                category: 'My Music',
                url: fileUrl,
                cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150',
                duration: 'Custom',
                isCustom: true
            };

            setCustomTracks(prev => [newTrack, ...prev]);
            handleSelect(newTrack);
        }
    };

    const handleClose = () => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        setPlayingTrackId(null);
        onClose();
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
        }}>
            <div style={{
                width: '100%', maxWidth: '500px', height: '85vh',
                background: '#1c1c1e', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)'
            }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Music size={22} color="#f5a524" />
                        <div>
                            <h2 style={{ color: '#fff', fontSize: '17px', fontWeight: 'bold', margin: 0, lineHeight: 1.2 }}>
                                Bollywood & Global Music 🎵
                            </h2>
                            <p style={{ color: '#aaa', fontSize: '11px', margin: 0, marginTop: '2px' }}>
                                Millions of Real Songs • Free 30s Audio Previews
                            </p>
                        </div>
                    </div>
                    <button onClick={handleClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '4px' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Upload Your Own Song CTA */}
                <div style={{ padding: '12px 20px 4px' }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="audio/*"
                        onChange={handleCustomAudioUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '8px', background: 'linear-gradient(90deg, #f5a524, #ff6b35)',
                            border: 'none', borderRadius: '16px', padding: '12px',
                            color: '#000', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
                            boxShadow: '0 4px 15px rgba(245,165,36,0.3)'
                        }}
                    >
                        <Upload size={18} />
                        <span>Upload Any Custom Audio File 📁</span>
                    </button>
                </div>

                {/* Search Input */}
                <div style={{ padding: '12px 20px 8px' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        background: 'rgba(255,255,255,0.08)', borderRadius: '14px',
                        padding: '10px 14px'
                    }}>
                        <Search size={18} color="#aaa" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search Arijit Singh, Kesariya, Drake, Punjabi..."
                            style={{
                                width: '100%', background: 'none', border: 'none',
                                color: '#fff', outline: 'none', fontSize: '14px'
                            }}
                        />
                        {isSearchingMusic && (
                            <Loader2 size={16} color="#f5a524" style={{ animation: 'spin 1s linear infinite' }} />
                        )}
                    </div>
                </div>

                {/* Categories Horizontal Scroll */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '8px 20px', scrollbarWidth: 'none' }}>
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            style={{
                                padding: '6px 14px', borderRadius: '18px', border: 'none',
                                background: activeCategory === cat ? '#f5a524' : 'rgba(255,255,255,0.08)',
                                color: activeCategory === cat ? '#000' : '#ccc',
                                fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                                whiteSpace: 'nowrap', transition: 'all 0.2s'
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Music Tracks List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {isSearchingMusic && displayTracks.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#aaa', gap: '12px' }}>
                            <Loader2 size={32} color="#f5a524" style={{ animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontSize: '14px' }}>Searching Bollywood & Global Tracks...</span>
                        </div>
                    ) : displayTracks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#aaa', fontSize: '14px' }}>
                            No tracks found. Try searching another song or artist!
                        </div>
                    ) : (
                        displayTracks.map(track => {
                            const isSelected = selectedTrackId === track.id;
                            const isPlaying = playingTrackId === track.id;
                            return (
                                <div
                                    key={track.id}
                                    onClick={() => handleSelect(track)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 14px', borderRadius: '16px',
                                        background: isSelected ? 'rgba(245, 165, 36, 0.15)' : 'rgba(255,255,255,0.04)',
                                        border: isSelected ? '1px solid #f5a524' : '1px solid rgba(255,255,255,0.06)',
                                        cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, overflow: 'hidden' }}>
                                        <div style={{ position: 'relative', width: '48px', height: '48px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0 }}>
                                            <img src={track.cover} alt={track.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <button
                                                onClick={(e) => togglePlay(track, e)}
                                                style={{
                                                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
                                                    border: 'none', color: '#fff', display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center', cursor: 'pointer'
                                                }}
                                            >
                                                {isPlaying ? <Pause size={18} fill="#fff" /> : <Play size={18} fill="#fff" style={{ marginLeft: '2px' }} />}
                                            </button>
                                        </div>
                                        <div style={{ overflow: 'hidden', flex: 1, paddingRight: '8px' }}>
                                            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</span>
                                                {track.isCustom && <span style={{ fontSize: '9px', background: '#f5a524', color: '#000', padding: '1px 5px', borderRadius: '6px', flexShrink: 0 }}>Custom</span>}
                                                {track.isITunes && <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '1px 5px', borderRadius: '6px', flexShrink: 0 }}>Official</span>}
                                                {isSelected && <Check size={16} color="#f5a524" style={{ flexShrink: 0 }} />}
                                            </div>
                                            <div style={{ color: '#aaa', fontSize: '12px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {track.artist} • {track.category} ({track.duration})
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleSelect(track)}
                                        style={{
                                            background: isSelected ? '#f5a524' : 'rgba(255,255,255,0.1)',
                                            color: isSelected ? '#000' : '#fff',
                                            border: 'none', borderRadius: '12px', padding: '6px 14px',
                                            fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                                            flexShrink: 0
                                        }}
                                    >
                                        {isSelected ? 'Selected' : 'Use Track'}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
