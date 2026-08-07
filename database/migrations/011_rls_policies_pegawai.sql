-- Admin: full access to all pegawai
CREATE POLICY pegawai_admin_all ON public.pegawai
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- HRD: full CRUD on pegawai
CREATE POLICY pegawai_hrd_all ON public.pegawai
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

-- Pegawai: can only view their own record
CREATE POLICY pegawai_select_own ON public.pegawai
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());
