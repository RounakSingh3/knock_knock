import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ktruosvlqnpcuzayrqkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0cnVvc3ZscW5wY3V6YXlycWtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTkxODUsImV4cCI6MjA4ODEzNTE4NX0.UcU8kEa20Sxw_txzGDvbmu-fWm60hOuCMQRgN-hhJ_I';

const CREATOR_ACCOUNTS = [
    { email: 'memecentral@knockknock.app', username: 'meme_central_official', avatar: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop', category: 'Memes' },
    { email: 'sarcasticindian@knockknock.app', username: 'the_sarcastic_indian', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop', category: 'Memes' },
    { email: 'desimemefactory@knockknock.app', username: 'desimeme_factory', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop', category: 'Memes' },
    { email: 'bollywoodhub@knockknock.app', username: 'bollywood_hungama_hub', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop', category: 'Bollywood' },
    { email: 'cinemasuperstars@knockknock.app', username: 'cinema_superstars', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop', category: 'Bollywood' },
    { email: 'bollywoodpaparazzi@knockknock.app', username: 'bollywood_paparazzi', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop', category: 'Bollywood' },
    { email: 'ironaesthetic@knockknock.app', username: 'iron_aesthetic_wear', avatar: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=150&auto=format&fit=crop', category: 'Fitness' },
    { email: 'fitwardrobe@knockknock.app', username: 'fit_wardrobe_daily', avatar: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=150&auto=format&fit=crop', category: 'Fitness' },
    { email: 'cricketcarnival@knockknock.app', username: 'cricket_carnival_ipl', avatar: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=150&auto=format&fit=crop', category: 'Sports' },
    { email: 'epicsports@knockknock.app', username: 'epic_sports_moments', avatar: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=150&auto=format&fit=crop', category: 'Sports' },
];

const MEME_IMAGES = [
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1548247416-ec66f4900b2e?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop'
];

const BOLLYWOOD_IMAGES = [
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop',
];

const GYM_IMAGES = [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1549576490-b0b4831ef60a?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=800&auto=format&fit=crop',
];

const SPORTS_IMAGES = [
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519766304817-4f37bda74a29?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop',
];

const MUSIC_TRACKS = [
    { title: 'Chaleya', artist: 'Arijit Singh & Anirudh', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { title: 'Illuminati', artist: 'Sushin Shyam', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
    { title: 'Winning Speech', artist: 'Karan Aujla', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
    { title: 'Apna Bana Le', artist: 'Arijit Singh', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
    { title: 'Starboy', artist: 'The Weeknd', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
    { title: 'Believer', artist: 'Imagine Dragons', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
];

const MEME_CAPTIONS = [
    "Me explaining to my mom why I need 8 hours of sleep after doing absolutely nothing all day 💀 #relatable #memes",
    "Nobody: \nMy brain at 3 AM: Let's calculate the trajectory of a falling samosa 🧠😂 #funnymemes",
    "POV: You wrote 2 lines of code and now you expect a senior developer salary 🚀💻 #coder #techmemes",
    "When you check your bank balance after a single weekend out with friends 📉😭 #pain #memesdaily",
    "Gym trainer: Just 2 more reps!\nThe reps: 💀💀💀 #gymmemes #fitnesshumor",
    "Me pretending to be shocked when the consequences of my own actions catch up with me 🤡 #relatable",
    "That one friend who calculates splitwise down to 0.50 rupees 🧾🤣 #desimemes #friendship",
    "My WiFi disconnecting for 0.001 seconds during the most intense ranked match 📶💥 #gamermemes",
    "Teachers in exam hall: 'The paper is very easy'\nThe paper: Calculate the mass of the sun using trigonometry 😭",
    "Me getting ready for bed knowing damn well I'm going to scroll reels for another 3 hours 📱😴",
    "When your code works on the first try and you don't even know why 😳💻 #programmerlife",
    "Monday morning alarm hits different when you slept at 4:30 AM ⏰🫠 #struggleisreal",
    "Group project members disappearing faster than magician cards 🎩✨ #collegelife",
    "When your mom finds the one thing you hid in the cleanest spot of the room 🕵️‍♀️🎯",
    "Me calculating how much money I saved by not buying things I couldn't afford anyway 📈😎"
];

const BOLLYWOOD_CAPTIONS = [
    "Shah Rukh Khan drops intense new look from upcoming mega action thriller! Fans go crazy across social media 🔥👑 #SRK #KingKhan #Bollywood",
    "Salman Khan Tiger roar is back! Exclusive behind the scenes photos from the grand international set 🎬🐅 #SalmanKhan #BollywoodNews",
    "Hrithik Roshan flaunts Greek God physique in latest photoshoot! True fitness & screen icon ⭐💪 #HrithikRoshan #FitnessIcon",
    "Ranbir Kapoor announces grand new mythological action project with top visionary director 🎥✨ #RanbirKapoor #BollywoodHero",
    "Deepika Padukone stuns at the Cannes film festival red carpet with breathtaking royal elegance 👑✨ #DeepikaPadukone #FashionIcon",
    "Alia Bhatt wins hearts with stellar international award ceremony appearance! Pure grace 💖🏆 #AliaBhatt #GlobalStar",
    "Allu Arjun Pushpa 2 mania sweeps the globe! Teaser breaks all all-time streaming records in 24 hours 🪓🔥 #Pushpa2 #AlluArjun",
    "Prabhas and team celebrate massive pre-release buzz with record-breaking advance bookings worldwide 🌟🏹 #Prabhas #Kalki",
    "Kartik Aaryan wraps high-octane schedule with grand celebrations on set! 🍿🎉 #KartikAaryan #BollywoodBuzz",
    "Ranveer Singh brings electrifying energy to the red carpet premiere! Nobody matches this charisma ⚡🤩 #RanveerSingh"
];

const GYM_CAPTIONS = [
    "Oversized pump cover off, let's put in the work! Today is heavy chest & triceps day ⚡💪 #gymoutfit #pumpcover #bodybuilding",
    "Aesthetic compression fit check! Consistency over motivation, every single day 🏋️‍♂️🔥 #gymfit #fitnessaesthetic #workoutwear",
    "Nothing beats a clean monochrome gym fit to get in the zone. Drop set intensity high! 💯🖤 #gymstyle #athleticwear #gains",
    "Leg day essentials: Flat soles, heavy-duty knee sleeves, and maximum focus 🦵🔥 #legdayoutfit #squats #gymfashion",
    "Back & biceps pump hits differently in this seamless compression tee ⚡🐍 #backworkout #gymthreads #fitnessmotivation",
    "Discipline is doing what needs to be done even when you don't feel like it. Morning grind complete 🌅👟 #morningworkout #gymfits",
    "Activewear that moves with you. High-stretch performance fabrics for intense HIIT & lifting 🏃‍♂️💨 #activewear #fitspo #athletic",
    "Golden hour post-workout flex! The pump is real, keep pushing your limits ⏳🥇 #gymprogress #fitnessgoals #bodybuilding",
    "Comfort meets performance. Clean workout hoodie for those chilly morning cardio sessions ❄️🏃 #gymhoodie #workoutaesthetic",
    "Built brick by brick. No shortcuts, just heavy iron and pure dedication 🧱💥 #gymoutfits #physiquegoals #fitlife"
];

const SPORTS_CAPTIONS = [
    "Virat Kohli 82* at Melbourne Cricket Ground: One of the greatest T20 innings in the history of world cricket 🏏👑 #ViratKohli #KingKohli #CricketLegend",
    "MS Dhoni finishing off in style! The iconic World Cup 2011 six that etched history forever 🇮🇳🏆 #Dhoni #WorldCup2011 #Legend",
    "Rohit Sharma pulling for maximum! The Hitman's signature effortless six over mid-wicket 🏏🔥 #RohitSharma #Hitman #IPL",
    "Lionel Messi lifting the World Cup in Lusail: The ultimate football fairytale completed 🐐⚽ #Messi #WorldCup #FootballIcon",
    "Cristiano Ronaldo iconic bicycle kick in Turin: Pure athletic mastery defying gravity ⚽🚀 #CR7 #Ronaldo #UCL",
    "IPL Super Over madness! Last ball thriller keeps 50,000 stadium fans on their feet 🏏⚡ #IPL2026 #CricketThrill #CricketFever",
    "Michael Jordan flying from the free-throw line: The iconic gravity-defying dunk that redefined basketball 🏀👑 #Jordan #NBAIcon",
    "Usain Bolt smiling at the camera mid-sprint: Absolute speed and dominance in Olympic history ⚡🥇 #UsainBolt #Olympics #Legend",
    "Jasprit Bumrah's unplayable yorker crashing into the middle stump! Pure bowling art 🎯💥 #Bumrah #CricketHighlights #FastBowling",
    "Champions League final winning moment! Pure passion, roar, and emotion on the pitch 🏆⚽ #ChampionsLeague #FootballDrama"
];

async function seedContent() {
    console.log('🚀 Starting Knock Knock Content Seeder...');

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 1. Authenticate or create the creator accounts
    const authenticatedUsers = [];

    for (const acc of CREATOR_ACCOUNTS) {
        let authUser = null;
        const password = 'KnockKnockCreator2026!';

        const signInRes = await client.auth.signInWithPassword({ email: acc.email, password });
        if (signInRes.data?.user) {
            authUser = signInRes.data.user;
        } else {
            const signUpRes = await client.auth.signUp({ email: acc.email, password });
            authUser = signUpRes.data?.user;
        }

        if (authUser) {
            authenticatedUsers.push({
                id: authUser.id,
                username: acc.username,
                avatar: acc.avatar,
                category: acc.category,
                client: createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
            });
            // Sign in this specific client instance
            await authenticatedUsers[authenticatedUsers.length - 1].client.auth.signInWithPassword({ email: acc.email, password });
        }
    }

    console.log(`✅ Successfully ready with ${authenticatedUsers.length} creator bot accounts!`);

    if (authenticatedUsers.length === 0) {
        console.error('❌ Could not authenticate creator bots.');
        return;
    }

    const allPostsToInsert = [];

    // 2. Generate 500 Memes
    console.log('📦 Generating 500 Memes...');
    const memeCreators = authenticatedUsers.filter(u => u.category === 'Memes');
    for (let i = 0; i < 500; i++) {
        const creator = memeCreators[i % memeCreators.length] || authenticatedUsers[0];
        const img = MEME_IMAGES[i % MEME_IMAGES.length];
        const captionBase = MEME_CAPTIONS[i % MEME_CAPTIONS.length];
        const music = MUSIC_TRACKS[i % MUSIC_TRACKS.length];
        const randomLikes = Math.floor(Math.random() * 950) + 120;
        const randomImps = Math.floor(Math.random() * 80) + 10;
        const randomComments = Math.floor(Math.random() * 45) + 5;
        const createdDate = new Date(Date.now() - Math.floor(Math.random() * 15 * 24 * 60 * 60 * 1000)).toISOString();

        allPostsToInsert.push({
            creator,
            post: {
                user_id: creator.id,
                username: creator.username,
                avatar_url: creator.avatar,
                image_url: img,
                caption: `${captionBase} #${i + 1}`,
                category: 'Memes',
                media_type: 'image',
                likes_count: randomLikes,
                imps_count: randomImps,
                comments_count: randomComments,
                shares_count: Math.floor(randomLikes / 8),
                music_title: music.title,
                music_artist: music.artist,
                music_url: music.url,
                created_at: createdDate
            }
        });
    }

    // 3. Generate 150 Bollywood Photos & News
    console.log('🎬 Generating 150 Bollywood Hero Photos & News...');
    const bollywoodCreators = authenticatedUsers.filter(u => u.category === 'Bollywood');
    for (let i = 0; i < 150; i++) {
        const creator = bollywoodCreators[i % bollywoodCreators.length] || authenticatedUsers[3 % authenticatedUsers.length];
        const img = BOLLYWOOD_IMAGES[i % BOLLYWOOD_IMAGES.length];
        const captionBase = BOLLYWOOD_CAPTIONS[i % BOLLYWOOD_CAPTIONS.length];
        const music = MUSIC_TRACKS[i % 4]; // Bollywood tracks
        const randomLikes = Math.floor(Math.random() * 1800) + 350;
        const randomImps = Math.floor(Math.random() * 150) + 25;
        const randomComments = Math.floor(Math.random() * 90) + 15;
        const createdDate = new Date(Date.now() - Math.floor(Math.random() * 10 * 24 * 60 * 60 * 1000)).toISOString();

        allPostsToInsert.push({
            creator,
            post: {
                user_id: creator.id,
                username: creator.username,
                avatar_url: creator.avatar,
                image_url: img,
                caption: `${captionBase} ✨ [Exclusive Update #${i + 1}]`,
                category: 'Bollywood',
                media_type: 'image',
                likes_count: randomLikes,
                imps_count: randomImps,
                comments_count: randomComments,
                shares_count: Math.floor(randomLikes / 6),
                music_title: music.title,
                music_artist: music.artist,
                music_url: music.url,
                created_at: createdDate
            }
        });
    }

    // 4. Generate 300 Gym Outfits & Fitness Photos
    console.log('💪 Generating 300 Gym Outfits & Fitness Posts...');
    const fitnessCreators = authenticatedUsers.filter(u => u.category === 'Fitness');
    for (let i = 0; i < 300; i++) {
        const creator = fitnessCreators[i % fitnessCreators.length] || authenticatedUsers[6 % authenticatedUsers.length];
        const img = GYM_IMAGES[i % GYM_IMAGES.length];
        const captionBase = GYM_CAPTIONS[i % GYM_CAPTIONS.length];
        const music = MUSIC_TRACKS[4 + (i % 2)]; // High energy tracks
        const randomLikes = Math.floor(Math.random() * 1200) + 220;
        const randomImps = Math.floor(Math.random() * 110) + 20;
        const randomComments = Math.floor(Math.random() * 60) + 8;
        const createdDate = new Date(Date.now() - Math.floor(Math.random() * 12 * 24 * 60 * 60 * 1000)).toISOString();

        allPostsToInsert.push({
            creator,
            post: {
                user_id: creator.id,
                username: creator.username,
                avatar_url: creator.avatar,
                image_url: img,
                caption: `${captionBase} ⚡ #fitcheck${i + 1}`,
                category: 'Fitness',
                media_type: 'image',
                likes_count: randomLikes,
                imps_count: randomImps,
                comments_count: randomComments,
                shares_count: Math.floor(randomLikes / 7),
                music_title: music.title,
                music_artist: music.artist,
                music_url: music.url,
                created_at: createdDate
            }
        });
    }

    // 5. Generate 200 Iconic Sports Clips & Photos
    console.log('🏏 Generating 200 Iconic Sports Clips & Photos...');
    const sportsCreators = authenticatedUsers.filter(u => u.category === 'Sports');
    for (let i = 0; i < 200; i++) {
        const creator = sportsCreators[i % sportsCreators.length] || authenticatedUsers[8 % authenticatedUsers.length];
        const img = SPORTS_IMAGES[i % SPORTS_IMAGES.length];
        const captionBase = SPORTS_CAPTIONS[i % SPORTS_CAPTIONS.length];
        const music = MUSIC_TRACKS[i % MUSIC_TRACKS.length];
        const randomLikes = Math.floor(Math.random() * 2500) + 500;
        const randomImps = Math.floor(Math.random() * 200) + 40;
        const randomComments = Math.floor(Math.random() * 120) + 20;
        const createdDate = new Date(Date.now() - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000)).toISOString();

        allPostsToInsert.push({
            creator,
            post: {
                user_id: creator.id,
                username: creator.username,
                avatar_url: creator.avatar,
                image_url: img,
                caption: `${captionBase} 🏆 #IconicMoment${i + 1}`,
                category: 'Sports',
                media_type: 'image',
                likes_count: randomLikes,
                imps_count: randomImps,
                comments_count: randomComments,
                shares_count: Math.floor(randomLikes / 5),
                music_title: music.title,
                music_artist: music.artist,
                music_url: music.url,
                created_at: createdDate
            }
        });
    }

    console.log(`🚀 Total Posts Prepared: ${allPostsToInsert.length} posts! Inserting to Supabase in batches...`);

    // Group posts by creator for fast batch insertion
    const postsByCreator = new Map();
    allPostsToInsert.forEach(item => {
        if (!postsByCreator.has(item.creator)) {
            postsByCreator.set(item.creator, []);
        }
        postsByCreator.get(item.creator).push(item.post);
    });

    let totalInserted = 0;

    for (const [creator, creatorPosts] of postsByCreator.entries()) {
        console.log(`📤 Inserting ${creatorPosts.length} posts for @${creator.username}...`);
        
        // Chunk into 50 posts per insert
        const CHUNK_SIZE = 50;
        for (let i = 0; i < creatorPosts.length; i += CHUNK_SIZE) {
            const chunk = creatorPosts.slice(i, i + CHUNK_SIZE);
            const { data, error } = await creator.client.from('posts').insert(chunk);
            if (error) {
                console.warn(`⚠️ Error inserting chunk for ${creator.username}:`, error.message);
            } else {
                totalInserted += chunk.length;
                console.log(`✅ [${totalInserted}/${allPostsToInsert.length}] Inserted chunk of ${chunk.length} posts.`);
            }
        }
    }

    console.log(`🎉 Seeding Complete! Successfully added ${totalInserted} posts across Memes, Bollywood, Gym & Sports!`);
}

seedContent().catch(console.error);
