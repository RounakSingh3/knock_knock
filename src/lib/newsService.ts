import { supabase } from './supabase';
import type { PostData } from './database';

export type NewsCategory = 'Cricket & IPL' | 'Bollywood' | 'Hollywood' | 'Gaming' | 'Sports' | 'Tech & AI' | 'Business & World';

export interface NewsItem {
    id: string;
    title: string;
    summary: string;
    url: string;
    source: string;
    publishedAt: string;
    category: NewsCategory;
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
        'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&auto=format&fit=crop',
    ],
    'Tech & AI': [
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop',
    ],
    'Business & World': [
        'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop',
    ],
};

export const FALLBACK_NEWS: NewsItem[] = [
    // 🏏 CRICKET & IPL
    {
        id: 'news-cricket-1',
        title: 'IPL 2026 Season Mega Highlights: Top Teams Prepare for Epic Weekend Clashes',
        summary: 'Top franchises have confirmed their playing XIs for this weekend’s high-stakes blockbuster matches. Star batsmen demonstrated red-hot form during evening powerplay drills under the floodlights, with coaching staffs emphasizing death-over yorkers and aggressive spin variations. Stadiums across the country are completely sold out as fans gear up for thrilling cricket action.',
        url: 'https://news.google.com/search?q=IPL+2026',
        source: 'Cricket Highlights',
        publishedAt: '12m ago',
        category: 'Cricket & IPL',
        imageUrl: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&auto=format&fit=crop',
        likesCount: 1420,
    },
    {
        id: 'news-cricket-2',
        title: 'Sensational Century: Young Indian Prodigy Shatters Fastest T20 Century Record',
        summary: 'In an electrifying display of fearless stroke play, the 21-year-old opener smashed 108 off just 42 deliveries. Hitting 11 sixes straight down the ground and pulling bouncers into the stands, the innings turned the match around and drew comparisons to legendary world-class batsmen.',
        url: 'https://news.google.com/search?q=Cricket+World+Cup',
        source: 'CricBuzz Today',
        publishedAt: '45m ago',
        category: 'Cricket & IPL',
        imageUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&auto=format&fit=crop',
        likesCount: 2150,
    },
    {
        id: 'news-cricket-3',
        title: 'Super-Over Thriller: Dramatic Final Delivery Decides Nail-Biting IPL Showdown',
        summary: 'Requiring 4 runs off the final ball of a frantic super over, the fielding side executed a pinpoint yorker to secure a famous 1-run victory. The dugout stormed the pitch in wild jubilation as thousands of fans stood in awe of the intense tactical battle.',
        url: 'https://news.google.com/search?q=IPL+Super+Over',
        source: 'ESPN Cricket',
        publishedAt: '2h ago',
        category: 'Cricket & IPL',
        imageUrl: 'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?w=600&auto=format&fit=crop',
        likesCount: 1890,
    },
    {
        id: 'news-cricket-4',
        title: 'World Test Championship Race: India and Australia Face Off in Crucial Border Series',
        summary: 'The battle for the World Test Championship final heats up as fast bowlers exploit green-top pitches with swinging deliveries. Both team captains expressed determination, stating that mental discipline and stamina under pressure will determine who claims the coveted trophy.',
        url: 'https://news.google.com/search?q=WTC+Final+Standings',
        source: 'The Daily Pitch',
        publishedAt: '4h ago',
        category: 'Cricket & IPL',
        imageUrl: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&auto=format&fit=crop',
        likesCount: 1640,
    },
    {
        id: 'news-cricket-5',
        title: 'Bowling Masterclass: Veteran Pacer Claims Historic 5-Wicket Haul in Powerplay',
        summary: 'With deadly swing bowling and deceptive cutters, the fast-bowling veteran ripped through the top order in record time. Commentators hailed the spell as one of the finest bowling performances in modern franchise cricket history.',
        url: 'https://news.google.com/search?q=T20+Fast+Bowlers',
        source: 'Cricket Insider',
        publishedAt: '6h ago',
        category: 'Cricket & IPL',
        imageUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&auto=format&fit=crop',
        likesCount: 1320,
    },

    // 🤖 TECH & AI
    {
        id: 'news-tech-1',
        title: 'Next-Generation Multimodal AI Models Revolutionize Real-Time Voice and Video',
        summary: 'Leading artificial intelligence labs have unveiled groundbreaking reasoning models capable of zero-latency natural speech conversations and real-time vision perception. Developers worldwide are using these advances to build autonomous agents and intelligent companions that interact with human-level fluidity.',
        url: 'https://news.google.com/search?q=Artificial+Intelligence+Breakthrough',
        source: 'TechCrunch Global',
        publishedAt: '18m ago',
        category: 'Tech & AI',
        imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=600&auto=format&fit=crop',
        likesCount: 3840,
    },
    {
        id: 'news-tech-2',
        title: 'Autonomous Humanoid Robots Begin Commercial Factory Deployments Across the Globe',
        summary: 'Engineers demonstrated agile bipedal robots seamlessly handling complex logistics and heavy precision assembly alongside human workers. Powered by spatial neural networks, the humanoid bots navigate warehouse obstacles and adapt to unexpected tasks in real time.',
        url: 'https://news.google.com/search?q=Humanoid+Robotics',
        source: 'Wired News',
        publishedAt: '1h ago',
        category: 'Tech & AI',
        imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop',
        likesCount: 2950,
    },
    {
        id: 'news-tech-3',
        title: 'Quantum Computing Milestone: 1,000-Qubit Processor Solves Complex Molecular Simulation',
        summary: 'Physicists and computer scientists achieved a major breakthrough in quantum supremacy, simulating protein folding configurations in minutes that would take classical supercomputers centuries. The milestone opens revolutionary opportunities for medicine and material science.',
        url: 'https://news.google.com/search?q=Quantum+Computing',
        source: 'MIT Technology Review',
        publishedAt: '3h ago',
        category: 'Tech & AI',
        imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop',
        likesCount: 2470,
    },
    {
        id: 'news-tech-4',
        title: 'Smartphones Enter the Spatial Computing Era with Seamless Micro-OLED AR Displays',
        summary: 'Tech giants revealed next-generation flagship smartphones equipped with ultra-dense silicon, 120Hz high-brightness displays, and embedded holographic projection sensors. Industry analysts predict spatial computing will transform social media and mobile pair programming.',
        url: 'https://news.google.com/search?q=NextGen+Smartphones',
        source: 'The Verge',
        publishedAt: '5h ago',
        category: 'Tech & AI',
        imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop',
        likesCount: 2190,
    },
    {
        id: 'news-tech-5',
        title: 'Open Source Developer Community Celebrates Explosive Growth of On-Device Edge Models',
        summary: 'Lightweight neural models can now run completely offline on consumer laptops and mobile devices with remarkable accuracy. Privacy advocates and indie developers praised the transition towards local processing and decentralized intelligence.',
        url: 'https://news.google.com/search?q=Open+Source+AI',
        source: 'Hacker News Daily',
        publishedAt: '7h ago',
        category: 'Tech & AI',
        imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=600&auto=format&fit=crop',
        likesCount: 1890,
    },

    // 🎬 BOLLYWOOD
    {
        id: 'news-bolly-1',
        title: 'Bollywood Blockbuster Buzz: Major Action Epics Set to Dominate Box Office This Month',
        summary: 'Leading Bollywood production houses have dropped thrilling theatrical teasers and hit musical soundtracks for the upcoming festive releases. Critics highlight stunning cinematography, intense action choreography, and standout ensemble performances. Advance ticket bookings have shattered opening-weekend records across nationwide cinema chains.',
        url: 'https://news.google.com/search?q=Bollywood+News',
        source: 'Bollywood Buzz',
        publishedAt: '25m ago',
        category: 'Bollywood',
        imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop',
        likesCount: 2350,
    },
    {
        id: 'news-bolly-2',
        title: 'Music Chartbuster: New Romantic Duet Surpasses 50 Million Streams in 24 Hours',
        summary: 'Featuring soaring vocals and enchanting acoustic melodies, the title track from the upcoming musical romance has captured social media feeds worldwide. Fans have created millions of dance reels and emotional clips celebrating the song.',
        url: 'https://news.google.com/search?q=Bollywood+Music+Hits',
        source: 'Filmfare Online',
        publishedAt: '1h ago',
        category: 'Bollywood',
        imageUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600&auto=format&fit=crop',
        likesCount: 3120,
    },
    {
        id: 'news-bolly-3',
        title: 'Global Film Festival Ovation: Indian Indie Thriller Wins Prestigious Jury Award',
        summary: 'A gripping social suspense film directed by an emerging Mumbai filmmaker received a thunderous 10-minute standing ovation at the international festival. International distributors engaged in a heated bidding war for worldwide streaming rights.',
        url: 'https://news.google.com/search?q=Indian+Cinema+Awards',
        source: 'Cinema Chronicle',
        publishedAt: '3h ago',
        category: 'Bollywood',
        imageUrl: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=600&auto=format&fit=crop',
        likesCount: 1980,
    },
    {
        id: 'news-bolly-4',
        title: 'Megastar Reunion: Two Iconic Screen Legends Sign High-Budget Spy Thriller Franchise',
        summary: 'Thirty years after their first silver screen pairing, two of Indian cinema’s biggest icons have reunited for an adrenaline-fueled spy universe film. Shooting locations include snow-covered European mountains and bustling historic streets.',
        url: 'https://news.google.com/search?q=Bollywood+Megastars',
        source: 'Times of Cinema',
        publishedAt: '5h ago',
        category: 'Bollywood',
        imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop',
        likesCount: 2780,
    },
    {
        id: 'news-bolly-5',
        title: 'Behind the Scenes: How Groundbreaking VFX Brought Ancient Mythology to Life',
        summary: 'Visual effects studios revealed the meticulous digital artistry behind massive mythological battle sequences. Using motion-capture suits and high-resolution photogrammetry, artists built majestic airborne fortresses and mystical creatures.',
        url: 'https://news.google.com/search?q=Bollywood+VFX',
        source: 'Animation & Film World',
        publishedAt: '8h ago',
        category: 'Bollywood',
        imageUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600&auto=format&fit=crop',
        likesCount: 1650,
    },

    // 🌟 HOLLYWOOD
    {
        id: 'news-holly-1',
        title: 'Hollywood Cinematic Universe: Global Teaser Drops and Streaming World Premieres',
        summary: 'Massive excitement erupted worldwide as studio executives unveiled new trailers for upcoming sci-fi and superhero epics. The reveal confirmed IMAX 3D theatrical release schedules along with brand-new superstar cast additions. Fans praised the mind-bending visual effects and gripping storylines unveiled in the first-look previews.',
        url: 'https://news.google.com/search?q=Hollywood+Movies',
        source: 'Hollywood Spotlight',
        publishedAt: '30m ago',
        category: 'Hollywood',
        imageUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop',
        likesCount: 1890,
    },
    {
        id: 'news-holly-2',
        title: 'Academy Awards Season Frontrunners: Critics Praise Sweeping Historical Masterpiece',
        summary: 'As awards season approaches, top film guilds have released their favorite nominations. An emotional period drama featuring transformative performances from leading actors has emerged as the heavy favorite for Best Picture and Director honors.',
        url: 'https://news.google.com/search?q=Oscars+Predictions',
        source: 'Variety Weekly',
        publishedAt: '2h ago',
        category: 'Hollywood',
        imageUrl: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=600&auto=format&fit=crop',
        likesCount: 2410,
    },
    {
        id: 'news-holly-3',
        title: 'IMAX Box Office Records Shattered: Interstellar Sci-Fi Odyssey Surpasses $800M',
        summary: 'The visionary director’s space exploration epic has dominated global box office earnings for three consecutive weeks. Audiences praised the visceral practical effects, astronomical accuracy, and unforgettable orchestral soundtrack.',
        url: 'https://news.google.com/search?q=IMAX+Box+Office',
        source: 'The Hollywood Reporter',
        publishedAt: '4h ago',
        category: 'Hollywood',
        imageUrl: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&auto=format&fit=crop',
        likesCount: 3150,
    },
    {
        id: 'news-holly-4',
        title: 'Surprise Franchise Revival: Legendary Classic Sci-Fi Saga Returns with Original Cast',
        summary: 'Decades after the beloved conclusion, studio chiefs announced a brand-new trilogy continuing the intergalactic saga. The announcement sent shockwaves through fandom communities, trending across global social platforms.',
        url: 'https://news.google.com/search?q=SciFi+Movies',
        source: 'Deadline Hollywood',
        publishedAt: '6h ago',
        category: 'Hollywood',
        imageUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop',
        likesCount: 2210,
    },

    // 🎮 GAMING
    {
        id: 'news-game-1',
        title: 'Gaming & Esports 2026: Next-Gen Titles and Major Esports Championships Announced',
        summary: 'Gamers and esports enthusiasts celebrated as major developers unveiled huge graphical overhauls, dynamic destructible maps, and balanced weapon loadouts. International championship circuits kicked off with record live streams and massive multi-million dollar prize pools across battle royale and tactical shooter tournaments.',
        url: 'https://news.google.com/search?q=Video+Games+News',
        source: 'Gaming & Esports Hub',
        publishedAt: '40m ago',
        category: 'Gaming',
        imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop',
        likesCount: 3120,
    },
    {
        id: 'news-game-2',
        title: 'Open-World Fantasy RPG Sells 10 Million Copies in Record-Breaking Launch Week',
        summary: 'Combining breathtaking ray-traced landscapes with deep tactical combat, the eagerly awaited dark-fantasy epic has set new records on digital distribution platforms. Reviewers praised the branching storytelling and fluid combat mechanics.',
        url: 'https://news.google.com/search?q=RPG+Game+Launches',
        source: 'IGN Daily',
        publishedAt: '1h ago',
        category: 'Gaming',
        imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop',
        likesCount: 4210,
    },
    {
        id: 'news-game-3',
        title: 'Esports World Cup Grand Finals: Underdog Squad Triumphs in Thrilling 5-Game Series',
        summary: 'In one of the greatest comebacks in competitive gaming history, an unranked rookie squad defeated reigning world champions in front of a roaring 20,000-seat arena. The decisive game ended with a clutch 1v3 outplay.',
        url: 'https://news.google.com/search?q=Esports+Championship',
        source: 'Dot Esports',
        publishedAt: '3h ago',
        category: 'Gaming',
        imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop',
        likesCount: 2680,
    },
    {
        id: 'news-game-4',
        title: 'Next-Generation Handheld Gaming Consoles Deliver Desktop-Grade 1080p 120FPS Performance',
        summary: 'Hardware manufacturers unveiled portable handheld gaming PCs powered by low-power 4nm APUs with integrated AI upscaling. Gamers can now take massive AAA titles anywhere with stunning visual fidelity and long battery life.',
        url: 'https://news.google.com/search?q=Handheld+Gaming',
        source: 'PC Gamer',
        publishedAt: '5h ago',
        category: 'Gaming',
        imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop',
        likesCount: 2340,
    },

    // 🏆 SPORTS
    {
        id: 'news-sports-1',
        title: 'Global Sports Roundup: World Football and Athletics Championships Heat Up',
        summary: 'High-drama football derbies and world-class athletic championships produced unforgettable moments with dramatic stoppage-time winners and historic photo-finishes. Managers and star athletes expressed determination as teams battle for top spots on international championship leaderboards.',
        url: 'https://news.google.com/search?q=Sports+News',
        source: 'World Sports',
        publishedAt: '35m ago',
        category: 'Sports',
        imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&auto=format&fit=crop',
        likesCount: 980,
    },
    {
        id: 'news-sports-2',
        title: 'Champions League Thriller: Stoppage-Time Header Sends Stadium into Raptures',
        summary: 'Trailing 2-1 on aggregate in the 94th minute, the home side earned a corner kick that resulted in an unbelievable diving header into the top corner. The stadium erupted in thunderous celebration as the victory clinched a spot in the European semi-finals.',
        url: 'https://news.google.com/search?q=Champions+League',
        source: 'Sky Sports',
        publishedAt: '1h ago',
        category: 'Sports',
        imageUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&auto=format&fit=crop',
        likesCount: 3450,
    },
    {
        id: 'news-sports-3',
        title: 'Grand Slam Tennis Drama: Epic Five-Set Classic Delivers Shock Quarterfinal Upset',
        summary: 'After 4 hours and 42 minutes of grueling baseline rallies under searing sun, the young wildcard qualifier defeated the top-seeded grand slam champion. The historic match featured tiebreakers in three consecutive sets.',
        url: 'https://news.google.com/search?q=Tennis+Grand+Slam',
        source: 'Tennis Channel Today',
        publishedAt: '3h ago',
        category: 'Sports',
        imageUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&auto=format&fit=crop',
        likesCount: 1750,
    },
    {
        id: 'news-sports-4',
        title: 'Formula 1 Grand Prix: Rain-Soaked Street Circuit Decided by Daring Tire Pit Strategy',
        summary: 'Sudden tropical downpours threw the Grand Prix into chaos. A bold call by race engineers to switch to intermediate wet tires two laps before rivals enabled an audacious overtake around the outside of the final chicane.',
        url: 'https://news.google.com/search?q=Formula+1+Racing',
        source: 'Motorsport Direct',
        publishedAt: '5h ago',
        category: 'Sports',
        imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&auto=format&fit=crop',
        likesCount: 2280,
    },

    // 💼 BUSINESS & WORLD
    {
        id: 'news-biz-1',
        title: 'Global Markets Rally as Tech Innovation and Clean Energy Investments Surge',
        summary: 'Equities reached record highs across major international stock exchanges, driven by robust quarterly earnings from semiconductor and renewable infrastructure leaders. Economists highlighted declining inflation and resilient consumer spending as positive indicators for global economic momentum.',
        url: 'https://news.google.com/search?q=Global+Stock+Markets',
        source: 'Bloomberg Markets',
        publishedAt: '50m ago',
        category: 'Business & World',
        imageUrl: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=600&auto=format&fit=crop',
        likesCount: 2150,
    },
    {
        id: 'news-biz-2',
        title: 'Space Exploration Milestone: Commercial Lunar Lander Successfully Touches Down',
        summary: 'Flight controllers cheered as telemetry confirmed the uncrewed lunar exploration spacecraft achieved a soft landing near the moon’s south pole. The mission carries high-resolution scientific instruments to analyze sub-surface water ice and solar radiation.',
        url: 'https://news.google.com/search?q=Space+Exploration',
        source: 'Reuters Science',
        publishedAt: '2h ago',
        category: 'Business & World',
        imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop',
        likesCount: 3620,
    },
    {
        id: 'news-biz-3',
        title: 'Electric Vehicles Surpass 30% of New Global Automobile Sales Ahead of Schedule',
        summary: 'Rapid battery chemistry breakthroughs, expanding fast-charging networks, and affordable compact EV models have pushed clean mobility adoption to historic highs across Europe, Asia, and North America.',
        url: 'https://news.google.com/search?q=Electric+Vehicles',
        source: 'Financial Times',
        publishedAt: '4h ago',
        category: 'Business & World',
        imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop',
        likesCount: 1980,
    },
    {
        id: 'news-biz-4',
        title: 'Next-Gen Fusion Reactor Sustains Record Energy Output for Over 1,000 Seconds',
        summary: 'International physicists operating magnetic confinement fusion facilities achieved a historic milestone, sustaining burning plasma reactions that generated net positive thermal energy without degrading protective containment tiles.',
        url: 'https://news.google.com/search?q=Clean+Fusion+Energy',
        source: 'Scientific American',
        publishedAt: '6h ago',
        category: 'Business & World',
        imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop',
        likesCount: 2840,
    },
];

const RSS_FEEDS: Record<string, string> = {
    'Cricket & IPL': 'https://news.google.com/rss/search?q=cricket+IPL&hl=en-IN&gl=IN&ceid=IN:en',
    'Tech & AI': 'https://news.google.com/rss/search?q=technology+artificial+intelligence&hl=en-IN&gl=IN&ceid=IN:en',
    'Bollywood': 'https://news.google.com/rss/search?q=bollywood+hindi+cinema&hl=en-IN&gl=IN&ceid=IN:en',
    'Hollywood': 'https://news.google.com/rss/search?q=hollywood+movies&hl=en-IN&gl=IN&ceid=IN:en',
    'Gaming': 'https://news.google.com/rss/search?q=gaming+esports+videogames&hl=en-IN&gl=IN&ceid=IN:en',
    'Sports': 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-IN&gl=IN&ceid=IN:en',
    'Business & World': 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en',
};

/**
 * Fetch real-time Google News for a specific category with higher limits
 */
export async function fetchGoogleNews(category: NewsCategory | 'All' = 'All'): Promise<NewsItem[]> {
    try {
        const categoriesToFetch: NewsCategory[] = category === 'All' 
            ? ['Cricket & IPL', 'Tech & AI', 'Bollywood', 'Hollywood', 'Gaming', 'Sports', 'Business & World']
            : [category];

        const allItems: NewsItem[] = [];

        await Promise.all(
            categoriesToFetch.map(async (cat) => {
                const rssUrl = RSS_FEEDS[cat];
                if (!rssUrl) return;

                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 4500);
                    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`, {
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    if (!res.ok) throw new Error('RSS conversion failed');

                    const data = await res.json();
                    if (data.status === 'ok' && Array.isArray(data.items)) {
                        const images = CATEGORY_IMAGES[cat] || [];
                        data.items.slice(0, 10).forEach((item: any, i: number) => {
                            const cleanTitle = (item.title || '').replace(/ - .*$/, '').trim();
                            const cleanSource = item.author || (item.title || '').split(' - ').pop() || 'Google News';

                            const rawDesc = item.description || item.content || '';
                            const cleanDesc = rawDesc
                                .replace(/<[^>]*>?/gm, ' ')
                                .replace(/&nbsp;/g, ' ')
                                .replace(/&amp;/g, '&')
                                .replace(/&quot;/g, '"')
                                .replace(/&#39;/g, "'")
                                .replace(/\s+/g, ' ')
                                .trim();

                            const finalSummary = cleanDesc && cleanDesc.length > 30 
                                ? (cleanDesc.length > 320 ? cleanDesc.slice(0, 317) + '...' : cleanDesc)
                                : `${cleanTitle}. Stay updated with the latest live developments, team news, and exclusive insights from ${cleanSource}.`;

                            allItems.push({
                                id: `news-${cat.toLowerCase().replace(/[^a-z0-9]/g, '')}-${i}-${Date.now()}`,
                                title: cleanTitle || item.title,
                                summary: finalSummary,
                                url: item.link || item.guid || 'https://news.google.com',
                                source: cleanSource,
                                publishedAt: item.pubDate ? new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
                                category: cat,
                                imageUrl: item.enclosure?.link || item.thumbnail || images[i % images.length],
                                likesCount: Math.floor(Math.random() * 950) + 450,
                            });
                        });
                    }
                } catch (e) {
                    // Fail gracefully to curated fallback stories
                }
            })
        );

        if (allItems.length > 0) {
            // Interleave items from fallback to guarantee depth
            const fallbackFiltered = category === 'All' 
                ? FALLBACK_NEWS 
                : FALLBACK_NEWS.filter(n => n.category === category);
            
            // Merge unique titles
            const seenTitles = new Set(allItems.map(a => a.title.toLowerCase()));
            fallbackFiltered.forEach(f => {
                if (!seenTitles.has(f.title.toLowerCase())) {
                    allItems.push(f);
                }
            });
            return allItems;
        }
    } catch (err) {
        console.warn('Google News fetch error:', err);
    }

    // Return rich curated daily trends
    if (category === 'All') return FALLBACK_NEWS;
    return FALLBACK_NEWS.filter(n => n.category === category);
}

/**
 * Auto-publish daily trending news to the database as official community posts
 */
export async function syncNewsToDatabase(newsList: NewsItem[]): Promise<void> {
    try {
        if (!newsList || newsList.length === 0) return;

        const todayStr = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase
            .from('posts')
            .select('id, caption')
            .ilike('caption', `%[NEWS:${todayStr}%`)
            .limit(5);

        if (existing && existing.length >= 5) {
            return;
        }

        for (const item of newsList.slice(0, 5)) {
            const caption = `🔥 [NEWS:${todayStr}] ${item.title}

📰 Source: ${item.source}

${item.summary}`;
            
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
