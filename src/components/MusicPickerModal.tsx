import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Play, Pause, Music, Search, Check, Sparkles, Upload, Flame, Loader2 } from 'lucide-react';
import { audioPlayer } from '../lib/audioPlayer';

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
    // 🔥 Trending & Viral (100% Real Studio Audio)
    {
        id: 'trend-1',
        title: 'Chaleya',
        artist: 'Arijit Singh & Anirudh',
        category: 'Bollywood',
        url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/55/fb/9c/55fb9c31-320a-5dba-0a3f-5e69552085a7/mzaf_13508224660474474886.plus.aac.p.m4a',
        cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150',
        duration: '0:30',
    },
    {
        id: 'trend-2',
        title: 'Winning Speech',
        artist: 'Karan Aujla',
        category: 'Punjabi',
        url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e3/ae/b6/e3aeb64f-cadd-5830-c39f-6af51cd91670/mzaf_6001527501800958065.plus.aac.p.m4a',
        cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150',
        duration: '0:30',
    },
    {
        id: 'trend-3',
        title: 'Starboy',
        artist: 'The Weeknd',
        category: 'Hollywood',
        url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a',
        cover: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=150',
        duration: '0:30',
    }
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
            audioPlayer.stop();
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
            audioPlayer.stop();
            setPlayingTrackId(null);
        } else {
            audioPlayer.stop();
            audioPlayer.play(track.url, false);
            setPlayingTrackId(track.id);
            // We lose the exact onended callback with the DOM element easily here,
            // but the state doesn't break anything if it stays highlighted.
        }
    };

    const handleSelect = (track: Track) => {
        audioPlayer.stop();
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
        audioPlayer.stop();
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
