-- Enforce that every public.users row truly corresponds to a Supabase Auth
-- user, and automatically clean up if that auth user is ever deleted.
ALTER TABLE public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;
