-- =========================================================================
-- KNOCK KNOCK COMPLETE DATABASE SCHEMA & STORAGE SETUP
-- Run this in the Supabase SQL Editor of your new project
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    name TEXT,
    avatar_url TEXT,
    bio TEXT,
    gender TEXT DEFAULT 'other',
    points INTEGER DEFAULT 100,
    is_online BOOLEAN DEFAULT true,
    streak_count INTEGER DEFAULT 0,
    last_story_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. POSTS TABLE
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    username TEXT,
    avatar_url TEXT,
    image_url TEXT NOT NULL,
    caption TEXT,
    likes_count INTEGER DEFAULT 0,
    imps_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    attached_link TEXT,
    media_type TEXT DEFAULT 'image',
    category TEXT DEFAULT 'General',
    css_filter TEXT,
    boost_expires_at TIMESTAMPTZ,
    boost_impressions_remaining INTEGER DEFAULT 0,
    music_title TEXT,
    music_artist TEXT,
    music_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. LIKES TABLE
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(post_id, user_id)
);

-- 4. POST IMPRESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.post_imps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(post_id, user_id)
);

-- 5. STORIES TABLE
CREATE TABLE IF NOT EXISTS public.stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    username TEXT,
    image_url TEXT NOT NULL,
    poster_url TEXT,
    filter_name TEXT DEFAULT 'Normal',
    is_boosted BOOLEAN DEFAULT false,
    caption TEXT,
    music_title TEXT,
    music_artist TEXT,
    music_url TEXT,
    target_screens INTEGER DEFAULT 0,
    screens_delivered INTEGER DEFAULT 0,
    points_spent INTEGER DEFAULT 0,
    link_url TEXT,
    link_cta TEXT,
    is_sponsored BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. FOLLOWS TABLE
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(follower_id, following_id)
);

-- 7. CONNECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_b UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    streak_count INTEGER DEFAULT 1,
    last_interaction_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    matched_via TEXT DEFAULT 'voice',
    compatibility_percent INTEGER DEFAULT 80,
    shared_likes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. ENGAGEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.engagements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    value INTEGER DEFAULT 1,
    category TEXT DEFAULT 'General',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    username TEXT,
    avatar_url TEXT,
    content TEXT,
    is_voice BOOLEAN DEFAULT false,
    voice_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. BLOCKS TABLE
CREATE TABLE IF NOT EXISTS public.blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(blocker_id, blocked_id)
);

-- 12. CALL REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.call_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(sender_id, receiver_id)
);

-- =========================================================================
-- INDEXES FOR ULTRA-FAST FEED & REELS PERFORMANCE
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts (user_id);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON public.stories (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_participants ON public.messages (sender_id, receiver_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_likes_post_user ON public.likes (post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON public.comments (post_id, created_at DESC);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enabling public read and write access for seamless app experience
-- =========================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_imps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_requests ENABLE ROW LEVEL SECURITY;

-- Allow full public read/write access for anonymous and authenticated users
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('profiles', 'posts', 'likes', 'post_imps', 'stories', 'follows', 'connections', 'messages', 'engagements', 'comments', 'blocks', 'call_requests')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public access" ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY "Public access" ON public.%I FOR ALL USING (true) WITH CHECK (true);', tbl);
    END LOOP;
END $$;

-- =========================================================================
-- STORAGE BUCKET CONFIGURATION
-- Sets up the 'knock-knock-eight.versel' bucket with public read access
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('knock-knock-eight.versel', 'knock-knock-eight.versel', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage public read policy
DROP POLICY IF EXISTS "Public read storage" ON storage.objects;
CREATE POLICY "Public read storage" ON storage.objects FOR SELECT USING (bucket_id = 'knock-knock-eight.versel');

-- Storage public upload/write policy
DROP POLICY IF EXISTS "Public write storage" ON storage.objects;
CREATE POLICY "Public write storage" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'knock-knock-eight.versel');

DROP POLICY IF EXISTS "Public update storage" ON storage.objects;
CREATE POLICY "Public update storage" ON storage.objects FOR UPDATE USING (bucket_id = 'knock-knock-eight.versel');

DROP POLICY IF EXISTS "Public delete storage" ON storage.objects;
CREATE POLICY "Public delete storage" ON storage.objects FOR DELETE USING (bucket_id = 'knock-knock-eight.versel');
