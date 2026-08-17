-- Admin: full access to all kpi
CREATE POLICY kpi_admin_all ON public.kpi
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- HRD: full CRUD on kpi (menetapkan target/indikator KPI)
CREATE POLICY kpi_hrd_all ON public.kpi
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

-- Pegawai: can view their own KPI records
CREATE POLICY kpi_select_own ON public.kpi
    FOR SELECT TO authenticated
    USING (pegawai_id = public.current_pegawai_id());

-- Pegawai: can update their own KPI record (menginput capaian) — kolom mana
-- yang boleh diubah (achievement, bukan target/period) ditegakkan di
-- Validation/Service layer, bukan RLS (lihat docs project mengenai service
-- role key membypass RLS: otorisasi sesungguhnya ada di kode backend).
CREATE POLICY kpi_update_own ON public.kpi
    FOR UPDATE TO authenticated
    USING (pegawai_id = public.current_pegawai_id())
    WITH CHECK (pegawai_id = public.current_pegawai_id());
