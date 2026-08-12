CREATE POLICY kategori_dokumen_admin_all ON public.kategori_dokumen
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY kategori_dokumen_hrd_all ON public.kategori_dokumen
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

CREATE POLICY kategori_dokumen_select_authenticated ON public.kategori_dokumen
    FOR SELECT TO authenticated
    USING (true);
