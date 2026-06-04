-- 1. Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('knock-knock-eight.versel', 'knock-knock-eight.versel', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public access to read files
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'knock-knock-eight.versel' );

-- 3. Allow authenticated users to upload files
CREATE POLICY "Auth Users Upload"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'knock-knock-eight.versel'
    AND auth.role() = 'authenticated'
);

-- 4. Allow users to update their own files
CREATE POLICY "Auth Users Update"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'knock-knock-eight.versel'
    AND auth.role() = 'authenticated'
);

-- 5. Allow users to delete their own files
CREATE POLICY "Auth Users Delete"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'knock-knock-eight.versel'
    AND auth.role() = 'authenticated'
);
