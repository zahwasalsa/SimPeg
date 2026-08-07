-- divisi: Admin & HRD full CRUD, everyone else can read (reference data for dropdowns/profile)
CREATE POLICY divisi_admin_all ON public.divisi
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY divisi_hrd_all ON public.divisi
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

CREATE POLICY divisi_select_authenticated ON public.divisi
    FOR SELECT TO authenticated
    USING (true);

-- jabatan: same pattern as divisi
CREATE POLICY jabatan_admin_all ON public.jabatan
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY jabatan_hrd_all ON public.jabatan
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

CREATE POLICY jabatan_select_authenticated ON public.jabatan
    FOR SELECT TO authenticated
    USING (true);
