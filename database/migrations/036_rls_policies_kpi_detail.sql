-- Admin: full access to all kpi_detail
CREATE POLICY kpi_detail_admin_all ON public.kpi_detail
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- HRD: full CRUD on kpi_detail (mengelola indikator)
CREATE POLICY kpi_detail_hrd_all ON public.kpi_detail
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

-- Pegawai: can view detail rows belonging to their own kpi
CREATE POLICY kpi_detail_select_own ON public.kpi_detail
    FOR SELECT TO authenticated
    USING (
        kpi_id IN (SELECT id FROM public.kpi WHERE pegawai_id = public.current_pegawai_id())
    );

-- Pegawai: can update realization on their own kpi_detail rows (indicator/
-- target/weight restriction enforced in Validation/Service layer, not RLS).
CREATE POLICY kpi_detail_update_own ON public.kpi_detail
    FOR UPDATE TO authenticated
    USING (
        kpi_id IN (SELECT id FROM public.kpi WHERE pegawai_id = public.current_pegawai_id())
    )
    WITH CHECK (
        kpi_id IN (SELECT id FROM public.kpi WHERE pegawai_id = public.current_pegawai_id())
    );
