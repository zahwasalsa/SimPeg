-- SECURITY DEFINER: bypasses RLS internally to avoid infinite recursion
-- when a policy on `users`/`pegawai` needs to look up the caller's own row.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_pegawai_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT id FROM public.pegawai WHERE user_id = auth.uid();
$$;
