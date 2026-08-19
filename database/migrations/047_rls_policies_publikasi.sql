CREATE POLICY publikasi_admin_all ON public.publikasi
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY publikasi_hrd_all ON public.publikasi
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

-- Ownership diturunkan dari penelitian induk (mengikuti pola kpi_detail).
CREATE POLICY publikasi_select_own ON public.publikasi
    FOR SELECT TO authenticated
    USING (
        penelitian_id IN (SELECT id FROM penelitian WHERE pegawai_id = public.current_pegawai_id())
    );

CREATE POLICY publikasi_insert_own ON public.publikasi
    FOR INSERT TO authenticated
    WITH CHECK (
        penelitian_id IN (SELECT id FROM penelitian WHERE pegawai_id = public.current_pegawai_id())
    );

CREATE POLICY publikasi_update_own ON public.publikasi
    FOR UPDATE TO authenticated
    USING (
        penelitian_id IN (SELECT id FROM penelitian WHERE pegawai_id = public.current_pegawai_id())
    )
    WITH CHECK (
        penelitian_id IN (SELECT id FROM penelitian WHERE pegawai_id = public.current_pegawai_id())
    );
