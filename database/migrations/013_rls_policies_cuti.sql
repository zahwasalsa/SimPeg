-- Admin: full access to all cuti
CREATE POLICY cuti_admin_all ON public.cuti
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- HRD: full CRUD on cuti (includes approve/reject via UPDATE)
CREATE POLICY cuti_hrd_all ON public.cuti
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

-- Pegawai: can view their own leave history
CREATE POLICY cuti_select_own ON public.cuti
    FOR SELECT TO authenticated
    USING (pegawai_id = public.current_pegawai_id());

-- Pegawai: can submit a new leave request for themselves only
CREATE POLICY cuti_insert_own ON public.cuti
    FOR INSERT TO authenticated
    WITH CHECK (pegawai_id = public.current_pegawai_id());
