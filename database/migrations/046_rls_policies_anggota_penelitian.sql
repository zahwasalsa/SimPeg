CREATE POLICY anggota_penelitian_admin_all ON public.anggota_penelitian
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY anggota_penelitian_hrd_all ON public.anggota_penelitian
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

-- Ownership diturunkan dari penelitian induk (mengikuti pola kpi_detail).
CREATE POLICY anggota_penelitian_select_own ON public.anggota_penelitian
    FOR SELECT TO authenticated
    USING (
        penelitian_id IN (SELECT id FROM penelitian WHERE pegawai_id = public.current_pegawai_id())
    );

CREATE POLICY anggota_penelitian_insert_own ON public.anggota_penelitian
    FOR INSERT TO authenticated
    WITH CHECK (
        penelitian_id IN (SELECT id FROM penelitian WHERE pegawai_id = public.current_pegawai_id())
    );

CREATE POLICY anggota_penelitian_update_own ON public.anggota_penelitian
    FOR UPDATE TO authenticated
    USING (
        penelitian_id IN (SELECT id FROM penelitian WHERE pegawai_id = public.current_pegawai_id())
    )
    WITH CHECK (
        penelitian_id IN (SELECT id FROM penelitian WHERE pegawai_id = public.current_pegawai_id())
    );
