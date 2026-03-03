-- ============================================
-- Knock Knock App — Supabase Database Schema
-- ============================================
-- Run this entire script in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → Paste & Run)

-- 1. PROFILES TABLE (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  gender TEXT,
  avatar_url TEXT DEFAULT 'https://i.pravatar.cc/150',
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. POSTS TABLE
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  image_url TEXT NOT NULL,
  caption TEXT,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. LIKES TABLE (many-to-many)
CREATE TABLE IF NOT EXISTS likes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- 4. STORIES TABLE
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  filter_name TEXT DEFAULT 'Normal',
  is_boosted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- PROFILES: users can read all profiles, but only update their own
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- POSTS: anyone can read, authenticated users can insert
CREATE POLICY "Anyone can view posts"
  ON posts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = user_id);

-- LIKES: anyone can read, authenticated users can insert/delete their own
CREATE POLICY "Anyone can view likes"
  ON likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like posts"
  ON likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts"
  ON likes FOR DELETE
  USING (auth.uid() = user_id);

-- STORIES: anyone can read, authenticated users can insert their own
CREATE POLICY "Anyone can view stories"
  ON stories FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create stories"
  ON stories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- FUNCTION: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    'https://i.pravatar.cc/150?u=' || NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: run after every new auth signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- FUNCTION: Update likes_count on posts
-- ============================================
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_changed ON likes;
CREATE TRIGGER on_like_changed
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

-- ============================================
-- SEED DATA (sample posts for initial feed)
-- ============================================

-- We need a dummy user for seed posts. This inserts directly into profiles
-- (These posts will show up for everyone but aren't tied to a real auth user)
-- You can delete these once real users start posting.

-- First, create a seed function that inserts posts without FK constraint issues
-- We'll insert posts with user_id = NULL allowed temporarily

-- Alternative: Insert posts directly with mock data (no user_id FK)
-- Let's adjust the posts table to allow NULL user_id for seed data
ALTER TABLE posts ALTER COLUMN user_id DROP NOT NULL;

INSERT INTO posts (username, avatar_url, image_url, caption, likes_count, created_at) VALUES
  ('alex_wanderlust', 'https://i.pravatar.cc/150?u=alex',
   'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=800&q=80',
   'Chasing sunsets in the mountains. 🏔️✨', 1243,
   now() - interval '2 hours'),

  ('sarah.creative', 'https://i.pravatar.cc/150?u=sarah',
   'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80',
   'Morning vibes and good coffee. ☕️', 856,
   now() - interval '4 hours'),

  ('neon_nights', 'https://i.pravatar.cc/150?u=neon',
   'https://images.unsplash.com/photo-1555529733-0e670560f8e1?w=800&q=80',
   'City lights that never sleep. 🌃', 3021,
   now() - interval '12 hours'),

  ('travel_tales', 'https://i.pravatar.cc/150?u=travel',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
   'Lost in the beauty of nature. 🌿', 672,
   now() - interval '1 day'),

  ('pixel_dreamer', 'https://i.pravatar.cc/150?u=pixel',
   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80',
   'Creating art from everyday moments. 🎨', 1890,
   now() - interval '6 hours'),

  ('ocean_soul', 'https://i.pravatar.cc/150?u=ocean',
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
   'Where the sea meets the sky. 🌊', 2150,
   now() - interval '8 hours');

-- Seed some boosted stories
INSERT INTO stories (image_url, filter_name, is_boosted, created_at) VALUES
  ('https://images.unsplash.com/photo-1500000000100?w=400&q=80', 'Vintage', true, now() - interval '1 hour'),
  ('https://images.unsplash.com/photo-1500000000200?w=400&q=80', 'Neon', true, now() - interval '2 hours'),
  ('https://images.unsplash.com/photo-1500000000300?w=400&q=80', 'Cool', true, now() - interval '3 hours'),
  ('https://images.unsplash.com/photo-1500000000400?w=400&q=80', 'Cinematic', true, now() - interval '4 hours');
