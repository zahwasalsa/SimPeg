CREATE POLICY hki_admin_all ON public.hki
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY hki_hrd_all ON public.hki
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

-- hki.pegawai_id adalah kolom langsung (bukan lewat penelitian_id, yang
-- opsional) — sama seperti kpi/roadmap_karier, bukan seperti publikasi.
CREATE POLICY hki_select_own ON public.hki
    FOR SELECT TO authenticated
    USING (pegawai_id = public.current_pegawai_id());

CREATE POLICY hki_insert_own ON public.hki
    FOR INSERT TO authenticated
    WITH CHECK (pegawai_id = public.current_pegawai_id());

CREATE POLICY hki_update_own ON public.hki
    FOR UPDATE TO authenticated
    USING (pegawai_id = public.current_pegawai_id())
    WITH CHECK (pegawai_id = public.current_pegawai_id());
