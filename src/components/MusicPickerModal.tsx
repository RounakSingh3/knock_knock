import React, { useState, useRef } from 'react';
import { X, Play, Pause, Music, Search, Check, Sparkles } from 'lucide-react';

export interface Track {
    id: string;
    title: string;
    artist: string;
    category: string;
    url: string;
    cover: string;
    duration: string;
}

export const FREE_MUSIC_TRACKS: Track[] = [
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
        title: 'Midnight Coffee',
        artist: 'Aesthetic Melodies',
        category: 'Lofi',
        url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=lofi-chill-medium-version-109038.mp3',
        cover: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=150',
        duration: '1:45',
    },
    {
        id: 'pop-1',
        title: 'Summer Sunshine',
        artist: 'PopVibes',
        category: 'Pop',
        url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a815a3.mp3?filename=summer-walk-15363.mp3',
        cover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=150',
        duration: '2:30',
    },
    {
        id: 'chill-1',
        title: 'Gentle Breeze',
        artist: 'Relaxing Sound',
        category: 'Chill',
        url: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_946d5c64ef.mp3?filename=relaxing-light-background-music-11756.mp3',
        cover: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=150',
        duration: '2:05',
    },
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
        id: 'acoustic-1',
        title: 'Sunset Acoustic Guitar',
        artist: 'Indie Folk',
        category: 'Acoustic',
        url: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939b46617.mp3?filename=acoustic-guitar-loop-124976.mp3',
        cover: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=150',
        duration: '2:10',
    },
    {
        id: 'synth-1',
        title: 'Neon Cyber Drive',
        artist: 'Synthwave 80s',
        category: 'Synthwave',
        url: 'https://cdn.pixabay.com/download/audio/2022/11/06/audio_c89b706c9a.mp3?filename=synthwave-80s-127027.mp3',
        cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=150',
        duration: '2:40',
    },
];

const CATEGORIES = ['All', 'Lofi', 'Pop', 'Chill', 'Hip Hop', 'Acoustic', 'Synthwave'];

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
    const audioRef = useRef<HTMLAudioElement | null>(null);

    if (!isOpen) return null;

    const filteredTracks = FREE_MUSIC_TRACKS.filter(t => {
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
            }
            setPlayingTrackId(null);
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
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
        }
        setPlayingTrackId(null);
        onSelectTrack(track);
        onClose();
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
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
        }}>
            <div style={{
                width: '100%', maxWidth: '500px', height: '80vh',
                background: '#1c1c1e', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)'
            }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Music size={20} color="#f5a524" />
                        <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Add Background Music</h2>
                    </div>
                    <button onClick={handleClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '4px' }}>
                        <X size={24} />
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
                            placeholder="Search free sounds, lofi, pop..."
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
                                        <img src={track.cover} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
