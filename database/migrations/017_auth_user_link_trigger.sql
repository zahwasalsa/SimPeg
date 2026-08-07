-- Auto-provision a matching public.users row whenever a new Supabase Auth
-- user is created, keeping public.users.id in lockstep with auth.users.id.
-- This is what makes auth.uid() in our RLS policies actually resolve to a
-- real row, and removes the need for the app to insert into public.users
-- itself during registration.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    requested_role TEXT;
BEGIN
    requested_role := NEW.raw_user_meta_data ->> 'role';

    IF requested_role IS NULL OR requested_role NOT IN ('admin', 'hrd', 'pegawai', 'pimpinan') THEN
        requested_role := 'pegawai';
    END IF;

    INSERT INTO public.users (id, email, password_hash, role, is_active)
    VALUES (NEW.id, NEW.email, NULL, requested_role, TRUE);

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();
