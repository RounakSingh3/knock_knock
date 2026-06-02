-- ============================================
-- Knock Knock App — Connections Migration
-- ============================================
-- Run this in Supabase SQL Editor to add the connections system.
-- This supports voice-match connections with streak tracking.

-- 1. CONNECTIONS TABLE
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_b UUID REFERENCES profiles(id) ON DELETE CASCADE,
  streak_count INTEGER DEFAULT 1,
  last_interaction_at TIMESTAMPTZ DEFAULT now(),
  matched_via TEXT DEFAULT 'voice_call',
  compatibility_percent INTEGER DEFAULT 0,
  shared_likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_a, user_b)
);

-- 2. Enable RLS
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- 3. Public access policy (same pattern as other tables)
CREATE POLICY "Public access to connections"
  ON connections FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Index for fast lookups by either user
CREATE INDEX IF NOT EXISTS idx_connections_user_a ON connections(user_a);
CREATE INDEX IF NOT EXISTS idx_connections_user_b ON connections(user_b);
CREATE INDEX IF NOT EXISTS idx_connections_streak ON connections(streak_count DESC);
