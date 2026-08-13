import { supabase } from './supabase';
import type { PostData } from './database';

export interface NewsItem {
    id: string;
    title: string;
    summary: string;
    url: string;
    source: string;
    publishedAt: string;
    category: 'Cricket & IPL' | 'Bollywood' | 'Hollywood' | 'Gaming' | 'Sports';
    imageUrl: string;
    likesCount: number;
}

const CATEGORY_IMAGES: Record<string, string[]> = {
    'Cricket & IPL': [
        'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?w=600&auto=format&fit=crop',
    ],
    'Bollywood': [
        'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=600&auto=format&fit=crop',
    ],
    'Hollywood': [
        'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&auto=format&fit=crop',
    ],
    'Gaming': [
        'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop',
    ],
    'Sports': [
        'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&auto=format&fit=crop',
    ],
};

const FALLBACK_NEWS: NewsItem[] = [
    {
        id: 'news-ipl-1',
        title: 'IPL 2026 Season Mega Highlights: Top Teams Prepare for Epic Weekend Clashes',
        summary: 'Exciting matches scheduled as top franchises gear up with intense practice sessions and star-studded line-ups.',
        url: 'https://news.google.com/search?q=IPL+2026',
        source: 'Cricket Highlights',
        publishedAt: new Date().toISOString(),
        category: 'Cricket & IPL',
        imageUrl: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&auto=format&fit=crop',
        likesCount: 1420,
    },
    {
        id: 'news-bolly-1',
        title: 'Bollywood Blockbuster Buzz: Major Film Releases Set to Dominate Box Office This Month',
        summary: 'Top Bollywood stars announce grand releases and teasers, creating huge excitement across theatres nationwide.',
        url: 'https://news.google.com/search?q=Bollywood+News',
        source: 'Bollywood Buzz',
        publishedAt: new Date().toISOString(),
        category: 'Bollywood',
        imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop',
        likesCount: 2350,
    },
    {
        id: 'news-holly-1',
        title: 'Hollywood Cinematic Universe: Global Teaser Drops and Streaming World Premieres',
        summary: 'Massive excitement as new global franchise trailers release alongside award-season announcements.',
        url: 'https://news.google.com/search?q=Hollywood+Movies',
        source: 'Hollywood Spotlight',
        publishedAt: new Date().toISOString(),
        category: 'Hollywood',
        imageUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop',
        likesCount: 1890,
    },
    {
        id: 'news-game-1',
        title: 'Gaming & Esports 2026: Next-Gen Titles and Major Esports Championships Announced',
        summary: 'Gamers celebrate as new battle-royale and AAA action game updates roll out globally with stunning visuals.',
        url: 'https://news.google.com/search?q=Video+Games+News',
        source: 'Gaming & Esports Hub',
        publishedAt: new Date().toISOString(),
        category: 'Gaming',
        imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop',
        likesCount: 3120,
    },
    {
        id: 'news-sports-1',
        title: 'Global Sports Roundup: World Football and Athletics Championships Heat Up',
        summary: 'Thrilling victories and high-stakes matches unfold as international teams clash for championship titles.',
        url: 'https://news.google.com/search?q=Sports+News',
        source: 'World Sports',
        publishedAt: new Date().toISOString(),
        category: 'Sports',
        imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop',
        likesCount: 980,
    },
];

const RSS_FEEDS: Record<string, string> = {
    'Cricket & IPL': 'https://news.google.com/rss/search?q=cricket+IPL&hl=en-IN&gl=IN&ceid=IN:en',
    'Bollywood': 'https://news.google.com/rss/search?q=bollywood+hindi+cinema&hl=en-IN&gl=IN&ceid=IN:en',
    'Hollywood': 'https://news.google.com/rss/search?q=hollywood+movies&hl=en-IN&gl=IN&ceid=IN:en',
    'Gaming': 'https://news.google.com/rss/search?q=gaming+esports+videogames&hl=en-IN&gl=IN&ceid=IN:en',
    'Sports': 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-IN&gl=IN&ceid=IN:en',
};

/**
 * Fetch real-time Google News for a specific category
 */
export async function fetchGoogleNews(category: 'Cricket & IPL' | 'Bollywood' | 'Hollywood' | 'Gaming' | 'Sports' | 'All' = 'All'): Promise<NewsItem[]> {
    try {
        const categoriesToFetch = category === 'All' 
            ? (['Cricket & IPL', 'Bollywood', 'Hollywood', 'Gaming', 'Sports'] as const)
            : [category];

        const allItems: NewsItem[] = [];

        await Promise.all(
            categoriesToFetch.map(async (cat) => {
                const rssUrl = RSS_FEEDS[cat];
                if (!rssUrl) return;

                try {
                    // Fetch using public rss2json converter
                    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`);
                    if (!res.ok) throw new Error('RSS conversion failed');

                    const data = await res.json();
                    if (data.status === 'ok' && Array.isArray(data.items)) {
                        const images = CATEGORY_IMAGES[cat] || [];
                        data.items.slice(0, 4).forEach((item: any, i: number) => {
                            // Clean title to remove source prefix
                            const cleanTitle = (item.title || '').replace(/ - .*$/, '').trim();
                            const cleanSource = item.author || (item.title || '').split(' - ').pop() || 'Google News';

                            allItems.push({
                                id: `news-${cat.toLowerCase().replace(/[^a-z0-9]/g, '')}-${i}-${Date.now()}`,
                                title: cleanTitle || item.title,
                                summary: (item.description || '').replace(/<[^>]*>?/gm, '').slice(0, 140) + '...',
                                url: item.link || item.guid || 'https://news.google.com',
                                source: cleanSource,
                                publishedAt: item.pubDate || new Date().toISOString(),
                                category: cat,
                                imageUrl: item.enclosure?.link || item.thumbnail || images[i % images.length],
                                likesCount: Math.floor(Math.random() * 800) + 400,
                            });
                        });
                    }
                } catch (e) {
                    console.warn(`Could not fetch live RSS for ${cat}, using high-quality curated feed:`, e);
                }
            })
        );

        if (allItems.length > 0) {
            return allItems;
        }
    } catch (err) {
        console.warn('Google News fetch error:', err);
    }

    // Fallback to top curated daily trends
    if (category === 'All') return FALLBACK_NEWS;
    return FALLBACK_NEWS.filter(n => n.category === category);
}

/**
 * Auto-publish daily trending news to the database as official community posts
 */
export async function syncNewsToDatabase(newsList: NewsItem[]): Promise<void> {
    try {
        if (!newsList || newsList.length === 0) return;

        // Check if news posts were already published today to avoid spamming
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase
            .from('posts')
            .select('id, caption')
            .ilike('caption', `%[NEWS:${todayStr}%`)
            .limit(5);

        if (existing && existing.length >= 3) {
            return; // Already synced for today
        }

        // Post top 3 items
        for (const item of newsList.slice(0, 3)) {
            const caption = `🔥 [NEWS:${todayStr}] ${item.title}\n\n📰 Source: ${item.source}\n\n${item.summary}`;
            
            await supabase.from('posts').insert({
                user_id: '00000000-0000-0000-0000-000000000000',
                username: 'google_news_daily',
                avatar_url: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=150',
                image_url: item.imageUrl,
                caption,
                attached_link: item.url,
                category: item.category === 'Cricket & IPL' ? 'Cricket' : item.category,
                likes_count: item.likesCount,
                created_at: new Date().toISOString(),
            });
        }
    } catch (e) {
        console.warn('Error auto-syncing news to database:', e);
    }
}
