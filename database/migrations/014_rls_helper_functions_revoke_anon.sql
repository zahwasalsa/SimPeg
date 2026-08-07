-- Helper functions are only meant to be used internally by RLS policies for
-- the `authenticated` role. Remove default public EXECUTE so the `anon`
-- role cannot call them directly via PostgREST RPC.
-- Note: Supabase grants EXECUTE to anon/authenticated directly (not just via
-- PUBLIC) by default on new functions in the public schema, so `anon` must
-- also be revoked explicitly (see 015_rls_helper_functions_revoke_anon_explicit.sql).
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_pegawai_id() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_pegawai_id() TO authenticated;
