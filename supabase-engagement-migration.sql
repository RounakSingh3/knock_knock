-- Migration: Create Engagements Table for Algorithmic Feed

CREATE TABLE IF NOT EXISTS public.engagements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    post_id UUID NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('view', 'like', 'share', 'watch_time', 'replay', 'save', 'voice_react')),
    value NUMERIC DEFAULT 1,
    category TEXT DEFAULT 'General',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for fast lookups by user (for building interest profiles)
CREATE INDEX idx_engagements_user_id ON public.engagements(user_id);

-- Index for fast lookups by post (for scoring posts)
CREATE INDEX idx_engagements_post_id ON public.engagements(post_id);

-- Composite index for user + category (for interest profiling)
CREATE INDEX idx_engagements_user_category ON public.engagements(user_id, category);

-- Row Level Security
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;

-- Users can insert their own engagements
CREATE POLICY "Users can track own engagements"
    ON public.engagements FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can read their own engagements
CREATE POLICY "Users can read own engagements"
    ON public.engagements FOR SELECT
    USING (auth.uid() = user_id);

-- Add 'category' column to existing posts table if it doesn't exist
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
