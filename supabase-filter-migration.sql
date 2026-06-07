-- Add css_filter column to posts table to support image/video filters
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS css_filter TEXT DEFAULT 'none';
