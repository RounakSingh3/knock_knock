-- ============================================
-- Knock Knock App — Call Requests Migration
-- ============================================

CREATE TABLE IF NOT EXISTS public.call_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(sender_id, receiver_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_requests_sender ON public.call_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_call_requests_receiver ON public.call_requests(receiver_id);

-- Enable RLS
ALTER TABLE public.call_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read call requests they are part of" ON public.call_requests
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert call requests" ON public.call_requests
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users involved can update call requests" ON public.call_requests
    FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users involved can delete call requests" ON public.call_requests
    FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
