import React from 'react';
import { Flame, Play, Sparkles, TrendingUp, Music, Heart, MessageCircle, Share2, Film } from 'lucide-react';
import type { PostData } from '../lib/database';

export interface BollywoodItem {
    id: string;
    title: string;
    celebName: string;
    tag: string;
    imageUrl: string;
    likesCount: number;
    videoUrl?: string;
    musicTitle?: string;
    musicArtist?: string;
    createdAgo: string;
}

export const INSTANT_BOLLYWOOD_ITEMS: BollywoodItem[] = [
    {
        id: 'bolly-1',
        title: 'Ranbir Kapoor & Alia Bhatt Spotted at Airport! Looking Super Stylish ✈️❤️',
        celebName: 'Ranbir & Alia',
        tag: 'Paparazzi Spotted',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Ranbir_Kapoor_snapped_at_Kalina_airport.jpg',
        videoUrl: 'https://cdn.pixabay.com/video/2021/04/12/70860-536767554_tiny.mp4',
        likesCount: 14200,
        musicTitle: 'Kesariya',
        musicArtist: 'Arijit Singh & Pritam',
        createdAgo: '10m ago',
    },
    {
        id: 'bolly-2',
        title: 'Shah Rukh Khan Announces New Action Thriller Project! Fans Can\'t Keep Calm 🔥👑',
        celebName: 'Shah Rukh Khan',
        tag: 'Movie Update',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Shah_Rukh_Khan_graces_the_launch_of_the_new_Santro.jpg',
        likesCount: 28900,
        musicTitle: 'Zaalima',
        musicArtist: 'Arijit Singh & Harshdeep',
        createdAgo: '35m ago',
    },
    {
        id: 'bolly-3',
        title: 'Deepika Padukone Stuns in Ember Gold Saree at Red Carpet Event! ✨😍',
        celebName: 'Deepika Padukone',
        tag: 'Red Carpet Look',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Deepika_Padukone_2025_%281%29.png/960px-Deepika_Padukone_2025_%281%29.png',
        likesCount: 19800,
        musicTitle: 'Deewani Mastani',
        musicArtist: 'Shreya Ghoshal',
        createdAgo: '1h ago',
    },
    {
        id: 'bolly-4',
        title: 'Badshah & Karan Aujla Drop New Teaser! Internet Goes Crazy 🚀🔥',
        celebName: 'Badshah x Karan Aujla',
        tag: 'Music Release',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Katrina_Kaif_at_the_Bharat_audio_launch.jpg/960px-Katrina_Kaif_at_the_Bharat_audio_launch.jpg',
        videoUrl: 'https://cdn.pixabay.com/video/2020/05/25/40149-424075191_tiny.mp4',
        likesCount: 31400,
        musicTitle: 'Tauba Tauba',
        musicArtist: 'Karan Aujla',
        createdAgo: '2h ago',
    },
    {
        id: 'bolly-5',
        title: 'Kriti Sanon & Kartik Aaryan Reiterate Friendship Goals on Set! 🎬💛',
        celebName: 'Kartik & Kriti',
        tag: 'Behind The Scenes',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Kriti_Sanon_at_Adipurush_pre_release_event_%282%29_%28cropped%29.jpg/960px-Kriti_Sanon_at_Adipurush_pre_release_event_%282%29_%28cropped%29.jpg',
        likesCount: 11500,
        musicTitle: 'Pasoori Nu',
        musicArtist: 'Arijit Singh & Tulsi Kumar',
        createdAgo: '3h ago',
    },
];

interface BollywoodSectionProps {
    onSelectPost?: (post: PostData) => void;
}

export const BollywoodSection: React.FC<BollywoodSectionProps> = ({ onSelectPost }) => {
    const convertToPostData = (item: BollywoodItem): PostData => ({
        id: item.id,
        user_id: 'instant-bollywood-official',
        username: 'instantbollywood',
        avatar_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150',
        image_url: item.videoUrl || item.imageUrl,
        caption: `${item.title}\n\n#InstantBollywood #${item.celebName.replace(/\s+/g, '')} #BollywoodBuzz`,
        likes_count: item.likesCount,
        created_at: new Date().toISOString(),
        media_type: item.videoUrl ? 'video' : 'image',
        category: 'Bollywood',
        music_title: item.musicTitle,
        music_artist: item.musicArtist,
    });

    return (
        <div style={{ marginBottom: '24px', marginTop: '12px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #ff007f 0%, #7928ca 50%, #f5a524 100%)',
                        width: '28px', height: '28px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 10px rgba(255,0,127,0.4)',
                    }}>
                        <Film size={15} color="#fff" />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-active)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Instant Bollywood <span style={{ fontSize: '11px', background: 'linear-gradient(90deg, #ff007f, #ff6b35)', color: '#fff', padding: '2px 6px', borderRadius: '8px', fontWeight: 'bold' }}>VIRAL</span>
                        </h3>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-inactive)' }}>
                            Celebrity Spotted • Movie Spoilers • Trending Reels
                        </p>
                    </div>
                </div>
            </div>

            {/* Horizontal Scroll Cards */}
            <div style={{
                display: 'flex', gap: '12px', overflowX: 'auto',
                paddingBottom: '8px', scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
            }}>
                {INSTANT_BOLLYWOOD_ITEMS.map((item) => {
                    const post = convertToPostData(item);
                    return (
                        <div
                            key={item.id}
                            onClick={() => onSelectPost?.(post)}
                            style={{
                                flexShrink: 0, width: '220px', height: '280px',
                                borderRadius: '20px', overflow: 'hidden',
                                position: 'relative', cursor: 'pointer',
                                border: '1px solid rgba(255, 0, 127, 0.3)',
                                background: '#1c1c1e',
                                boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                                transition: 'transform 0.2s',
                            }}
                        >
                            {/* Media Background */}
                            {item.videoUrl ? (
                                <video
                                    src={`${item.videoUrl}#t=0.001`}
                                    preload="metadata"
                                    muted
                                    playsInline
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <img
                                    src={item.imageUrl}
                                    alt={item.title}
                                    loading="lazy"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            )}

                            {/* Top Badge */}
                            <div style={{
                                position: 'absolute', top: '10px', left: '10px', right: '10px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                zIndex: 2
                            }}>
                                <span style={{
                                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                                    color: '#ff6b35', fontSize: '10px', fontWeight: 'bold',
                                    padding: '3px 8px', borderRadius: '10px',
                                    border: '1px solid rgba(255,107,53,0.3)',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}>
                                    <Flame size={10} color="#ff6b35" /> {item.tag}
                                </span>
                                {item.videoUrl && (
                                    <div style={{
                                        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                                        width: '24px', height: '24px', borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Play size={12} color="#fff" fill="#fff" />
                                    </div>
                                )}
                            </div>

                            {/* Bottom Info Gradient Box */}
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.95) 70%)',
                                padding: '30px 12px 12px', display: 'flex', flexDirection: 'column', gap: '6px',
                                zIndex: 2
                            }}>
                                {/* Music Tag */}
                                {item.musicTitle && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        color: '#f5a524', fontSize: '10px', fontWeight: 'bold',
                                        background: 'rgba(245,165,36,0.15)', padding: '2px 6px',
                                        borderRadius: '6px', width: 'fit-content',
                                    }}>
                                        <Music size={10} color="#f5a524" /> {item.musicTitle} • {item.musicArtist}
                                    </div>
                                )}

                                {/* Headline Title */}
                                <h4 style={{
                                    margin: 0, color: '#fff', fontSize: '12px', fontWeight: '700',
                                    lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical', overflow: 'hidden'
                                }}>
                                    {item.title}
                                </h4>

                                {/* Meta Stats */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                                    <span style={{ fontSize: '10px', color: '#ff007f', fontWeight: 'bold' }}>
                                        @instantbollywood
                                    </span>
                                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        <Heart size={10} color="#ef4444" fill="#ef4444" /> {(item.likesCount / 1000).toFixed(1)}k
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
