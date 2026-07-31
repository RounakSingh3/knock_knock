import React, { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, Music, Search, Check, Sparkles, Upload, Flame } from 'lucide-react';

export interface Track {
    id: string;
    title: string;
    artist: string;
    category: string;
    url: string;
    cover: string;
    duration: string;
    isCustom?: boolean;
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
    {
        id: 'romantic-2',
        title: 'Until I Found You Piano',
        artist: 'Soft Piano Keys',
        category: 'Romantic',
        url: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939b46617.mp3?filename=acoustic-guitar-loop-124976.mp3',
        cover: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=150',
        duration: '2:15',
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
    {
        id: 'pop-2',
        title: 'Levitating Party Groove',
        artist: 'Club Anthems',
        category: 'Pop',
        url: 'https://cdn.pixabay.com/download/audio/2022/11/06/audio_c89b706c9a.mp3?filename=synthwave-80s-127027.mp3',
        cover: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=150',
        duration: '2:45',
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
    {
        id: 'lofi-2',
        title: 'Midnight Coffee Lofi',
        artist: 'Aesthetic Melodies',
        category: 'Lofi',
        url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=lofi-chill-medium-version-109038.mp3',
        cover: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=150',
        duration: '1:45',
    },
    {
        id: 'lofi-3',
        title: 'Rainy Window Beats',
        artist: 'Sleepy Head',
        category: 'Lofi',
        url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
        cover: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=150',
        duration: '2:10',
    },

    // ⚡ Hip Hop & Trap
    {
        id: 'hiphop-1',
        title: 'Urban Street Beat',
        artist: 'BeatMaker Pro',
        category: 'Hip Hop',
        url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a815a4.mp3?filename=hip-hop-rock-beats-118000.mp3',
        cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150',
        duration: '1:50',
    },
    {
        id: 'hiphop-2',
        title: 'Trap Lord Heavy Bass',
        artist: '808 Mafia Sound',
        category: 'Hip Hop',
        url: 'https://cdn.pixabay.com/download/audio/2022/11/06/audio_c89b706c9a.mp3?filename=synthwave-80s-127027.mp3',
        cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=150',
        duration: '2:05',
    },

    // 🚀 EDM & Cyberpunk
    {
        id: 'edm-1',
        title: 'Neon Cyber Drive',
        artist: 'Synthwave 80s',
        category: 'EDM',
        url: 'https://cdn.pixabay.com/download/audio/2022/11/06/audio_c89b706c9a.mp3?filename=synthwave-80s-127027.mp3',
        cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=150',
        duration: '2:40',
    },
    {
        id: 'edm-2',
        title: 'Festival Mainstage Drop',
        artist: 'Electro Shock',
        category: 'EDM',
        url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a815a3.mp3?filename=summer-walk-15363.mp3',
        cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150',
        duration: '2:50',
    },
];

const CATEGORIES = ['All', 'Trending', 'Bollywood', 'Punjabi', 'Romantic', 'Pop', 'Lofi', 'Hip Hop', 'EDM'];

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
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const blobUrlsRef = useRef<string[]>([]);

    // Cleanup audio and blob URLs on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current.load();
                audioRef.current = null;
            }
            // Revoke all blob URLs to prevent memory leaks
            blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
            blobUrlsRef.current = [];
        };
    }, []);

    if (!isOpen) return null;

    const allTracks = [...customTracks, ...FREE_MUSIC_TRACKS];

    const filteredTracks = allTracks.filter(t => {
        const matchesCategory = activeCategory === 'All' || t.category === activeCategory;
        const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
                              t.artist.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

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
            blobUrlsRef.current.push(fileUrl); // Track for cleanup
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
                        <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Music Library 🎵</h2>
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
                        <span>Upload Any Song From Your Device 📁</span>
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
                            placeholder="Search Bollywood, Punjabi, Pop, Lofi..."
                            style={{
                                width: '100%', background: 'none', border: 'none',
                                color: '#fff', outline: 'none', fontSize: '14px'
                            }}
                        />
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
                    {filteredTracks.map(track => {
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ position: 'relative', width: '48px', height: '48px', borderRadius: '12px', overflow: 'hidden' }}>
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
                                    <div>
                                        <div style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {track.title}
                                            {track.isCustom && <span style={{ fontSize: '10px', background: '#f5a524', color: '#000', padding: '1px 6px', borderRadius: '8px' }}>Custom</span>}
                                            {isSelected && <Check size={16} color="#f5a524" />}
                                        </div>
                                        <div style={{ color: '#aaa', fontSize: '12px', marginTop: '2px' }}>
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
                                        fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                                    }}
                                >
                                    {isSelected ? 'Selected' : 'Use Track'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
