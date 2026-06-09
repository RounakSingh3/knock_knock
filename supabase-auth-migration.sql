-- ============================================
-- Knock Knock — Fix login / profiles for Supabase Auth
-- Run once in Supabase Dashboard → SQL Editor
-- ============================================
-- Fixes: "Could not find the 'password' column of 'profiles' in the schema cache"

-- 1. Remove legacy plain-text password column (Auth stores passwords in auth.users)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS password;

-- 2. Ensure username exists (required for Knock Knock login)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_story_at TIMESTAMPTZ;

-- 3. Link profile id to Supabase Auth user (skip if already set)
-- If you have old custom-auth rows with random UUIDs, create a NEW account after this migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_id_fkey' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'profiles_id_fkey may already exist or ids conflict — new signups still work via trigger.';
END $$;

-- 4. Replace signup trigger (NO password column)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, name, gender, dob, avatar_url, points)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NULLIF(NEW.raw_user_meta_data->>'gender', ''),
    NULLIF(NEW.raw_user_meta_data->>'dob', '')::date,
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      'https://i.pravatar.cc/150?u=' || COALESCE(NEW.raw_user_meta_data->>'username', NEW.id::text)
    ),
    100
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(EXCLUDED.username, profiles.username),
    name = COALESCE(EXCLUDED.name, profiles.name),
    gender = COALESCE(EXCLUDED.gender, profiles.gender),
    dob = COALESCE(EXCLUDED.dob, profiles.dob),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. RLS: allow insert on own profile (trigger uses SECURITY DEFINER, but app reads need SELECT)
DROP POLICY IF EXISTS "Public access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

CREATE POLICY "Anyone can view profiles"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 6. Refresh API schema cache
NOTIFY pgrst, 'reload schema';
