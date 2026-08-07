-- Supabase auto-grants EXECUTE to `anon` directly (not just via PUBLIC) on
-- new functions created in the public schema. Revoke it explicitly here.
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_pegawai_id() FROM anon;
