-- Migration to add comments_count and shares_count to the posts table
-- This allows us to track engagement (Likes, Comments, Shares) on user posts.

-- 1. Add comments_count column
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;

-- 2. Add shares_count column
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;

-- Optional: If you want to mock some random engagement for existing posts to see how it looks:
-- UPDATE public.posts SET comments_count = floor(random() * 50)::int, shares_count = floor(random() * 20)::int WHERE comments_count = 0;
