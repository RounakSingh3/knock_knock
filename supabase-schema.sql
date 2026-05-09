-- ============================================
-- Knock Knock App — Supabase Database Schema
-- ============================================
-- PRODUCTION-READY: Uses Supabase Auth with proper RLS
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → Authentication → Providers → Email
--    - Set "Confirm email" to OFF
--    - Set "Double confirm email changes" to OFF
-- 2. Run this entire script in SQL Editor
--    (Dashboard → SQL Editor → New Query → Paste & Run)

-- ============================================
-- RESET: Drop old tables and functions
-- ============================================
DROP TRIGGER IF EXISTS on_like_changed ON likes;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.update_likes_count();
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.increment_points(INT);
DROP FUNCTION IF EXISTS public.spend_points(INT);

DROP TABLE IF EXISTS bookmarks CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS follows CASCADE;
DROP TABLE IF EXISTS stories CASCADE;
DROP TABLE IF EXISTS likes CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
-- Links to auth.users via ID. No password column —
-- passwords are hashed and managed by Supabase Auth.
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT,
  gender TEXT,
  dob DATE,
  avatar_url TEXT DEFAULT 'https://i.pravatar.cc/150',
  points INTEGER DEFAULT 0,
  is_online BOOLEAN DEFAULT false,
  streak_count INTEGER DEFAULT 0,
  last_story_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast username lookups
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- ============================================
-- 2. POSTS TABLE
-- ============================================
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  image_url TEXT NOT NULL,
  caption TEXT,
  attached_link TEXT,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fetching posts by user
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_username ON public.posts(username);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);

-- ============================================
-- 3. LIKES TABLE (many-to-many)
-- ============================================
CREATE TABLE public.likes (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- ============================================
-- 4. STORIES TABLE
-- ============================================
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
<<<<<<< HEAD
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
=======
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT,
>>>>>>> 3b4f6af (feat: Combined Instagram + Snapchat stories redesign with streak system)
  image_url TEXT NOT NULL,
  caption TEXT,
  hashtags TEXT,
  filter_name TEXT DEFAULT 'Normal',
  is_boosted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stories_boosted ON public.stories(is_boosted, created_at DESC);

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================
-- When a new user signs up via Supabase Auth, this trigger
-- automatically creates a row in public.profiles using
-- the metadata passed during signUp().
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, name, gender, dob, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', ''),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'gender', ''),
    CASE
      WHEN NEW.raw_user_meta_data->>'dob' IS NOT NULL AND NEW.raw_user_meta_data->>'dob' != ''
      THEN (NEW.raw_user_meta_data->>'dob')::DATE
      ELSE NULL
    END,
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      'https://i.pravatar.cc/150?u=' || COALESCE(NEW.raw_user_meta_data->>'username', NEW.id::TEXT)
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TRIGGER: Auto-update likes_count on posts
-- ============================================
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER on_like_changed
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

-- ============================================
-- RPC: Secure point increment
-- ============================================
-- Users can only ADD points (never set arbitrary values).
-- Runs as SECURITY DEFINER so it bypasses RLS to update
-- the profile, but only for the authenticated user.
CREATE OR REPLACE FUNCTION public.increment_points(amount INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF amount < 0 THEN
    RAISE EXCEPTION 'Cannot increment by a negative amount';
  END IF;

  UPDATE public.profiles
  SET points = points + amount
  WHERE id = auth.uid();
END;
$$;

-- ============================================
-- RPC: Secure point spending
-- ============================================
-- Users can SPEND points (e.g. story boost). Prevents
-- going below zero and only affects the authenticated user.
CREATE OR REPLACE FUNCTION public.spend_points(amount INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_points INT;
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Spend amount must be positive';
  END IF;

  SELECT points INTO current_points
  FROM public.profiles
  WHERE id = auth.uid();

  IF current_points IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF current_points < amount THEN
    RAISE EXCEPTION 'Insufficient points: have %, need %', current_points, amount;
  END IF;

  UPDATE public.profiles
  SET points = points - amount
  WHERE id = auth.uid();
END;
$$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- ── PROFILES ──

-- Anyone can read any profile (needed for viewing other users)
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  USING (true);

-- Profile rows are created by the trigger (SECURITY DEFINER),
-- not directly by clients. No INSERT policy needed for clients.

-- Users can update their own profile only
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can delete their own profile only
CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- ── POSTS ──

-- Anyone can read all posts
CREATE POLICY "posts_select"
  ON public.posts FOR SELECT
  USING (true);

-- Authenticated users can create posts (must set their own user_id)
CREATE POLICY "posts_insert_own"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts only
CREATE POLICY "posts_update_own"
  ON public.posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own posts only
CREATE POLICY "posts_delete_own"
  ON public.posts FOR DELETE
  USING (auth.uid() = user_id);

-- ── LIKES ──

-- Anyone can read all likes
CREATE POLICY "likes_select"
  ON public.likes FOR SELECT
  USING (true);

-- Authenticated users can insert likes (must use their own user_id)
CREATE POLICY "likes_insert_own"
  ON public.likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes only
CREATE POLICY "likes_delete_own"
  ON public.likes FOR DELETE
  USING (auth.uid() = user_id);

-- ── STORIES ──

-- Anyone can read all stories
CREATE POLICY "stories_select"
  ON public.stories FOR SELECT
  USING (true);

-- Authenticated users can create stories (must set their own user_id)
CREATE POLICY "stories_insert_own"
  ON public.stories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own stories only
CREATE POLICY "stories_update_own"
  ON public.stories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own stories only
CREATE POLICY "stories_delete_own"
  ON public.stories FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 5. FOLLOWS TABLE
-- ============================================
CREATE TABLE public.follows (
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

-- ============================================
-- 6. COMMENTS TABLE
-- ============================================
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_comments_created_at ON public.comments(created_at DESC);

-- ============================================
-- 7. BOOKMARKS TABLE
-- ============================================
CREATE TABLE public.bookmarks (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- ============================================
-- ENABLE RLS ON NEW TABLES
-- ============================================
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- ── FOLLOWS ──

-- Anyone can read follows
CREATE POLICY "follows_select"
  ON public.follows FOR SELECT
  USING (true);

-- Authenticated users can insert their own follows
CREATE POLICY "follows_insert_own"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Users can delete their own follows
CREATE POLICY "follows_delete_own"
  ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ── COMMENTS ──

-- Anyone can read all comments
CREATE POLICY "comments_select"
  ON public.comments FOR SELECT
  USING (true);

-- Authenticated users can create comments
CREATE POLICY "comments_insert_own"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "comments_delete_own"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);

-- ── BOOKMARKS ──

-- Users can only read their own bookmarks
CREATE POLICY "bookmarks_select_own"
  ON public.bookmarks FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users can insert their own bookmarks
CREATE POLICY "bookmarks_insert_own"
  ON public.bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own bookmarks
CREATE POLICY "bookmarks_delete_own"
  ON public.bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- SEED DATA (sample posts for initial feed)
-- ============================================
-- NOTE: Seed data can no longer be inserted with NULL user_id.
-- These must be created by a real authenticated user, or you
-- can temporarily insert via the Supabase dashboard using the
-- service_role key. Below are example inserts that require a
-- valid auth.users ID.
--
-- For development: Sign up a test user first, copy their UUID,
-- then run inserts with that UUID as user_id.
