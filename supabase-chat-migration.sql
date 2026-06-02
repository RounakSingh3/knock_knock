-- Migration: Create Messages Table for Real-Time Chat

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL
);

-- Turn on Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow users to insert messages if they are the sender
CREATE POLICY "Users can send messages"
    ON public.messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

-- Allow users to read messages if they are either sender or receiver
CREATE POLICY "Users can read their own messages"
    ON public.messages FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Allow users to update messages (e.g. mark as read) if they are the receiver
CREATE POLICY "Users can mark messages as read"
    ON public.messages FOR UPDATE
    USING (auth.uid() = receiver_id);

-- Enable Supabase Realtime for the messages table
-- This allows instant UI updates when a message is sent
alter publication supabase_realtime add table messages;
