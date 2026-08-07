-- Admin: full access to all absensi
CREATE POLICY absensi_admin_all ON public.absensi
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- HRD: full CRUD on absensi
CREATE POLICY absensi_hrd_all ON public.absensi
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

-- Pegawai: can only view their own attendance records
CREATE POLICY absensi_select_own ON public.absensi
    FOR SELECT TO authenticated
    USING (pegawai_id = public.current_pegawai_id());
