CREATE POLICY dokumen_admin_all ON public.dokumen
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY dokumen_hrd_all ON public.dokumen
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

CREATE POLICY dokumen_select_own ON public.dokumen
    FOR SELECT TO authenticated
    USING (pegawai_id = public.current_pegawai_id());

CREATE POLICY dokumen_insert_own ON public.dokumen
    FOR INSERT TO authenticated
    WITH CHECK (pegawai_id = public.current_pegawai_id());
