CREATE POLICY dokumen_version_admin_all ON public.dokumen_version
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY dokumen_version_hrd_all ON public.dokumen_version
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

CREATE POLICY dokumen_version_select_own ON public.dokumen_version
    FOR SELECT TO authenticated
    USING (
        dokumen_id IN (SELECT id FROM public.dokumen WHERE pegawai_id = public.current_pegawai_id())
    );

CREATE POLICY dokumen_version_insert_own ON public.dokumen_version
    FOR INSERT TO authenticated
    WITH CHECK (
        dokumen_id IN (SELECT id FROM public.dokumen WHERE pegawai_id = public.current_pegawai_id())
    );
