-- Supabase Auth now owns password storage (auth.users.encrypted_password).
-- We must never store/hash passwords ourselves in public.users going forward.
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
