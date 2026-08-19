-- Mengikuti pola persis kategori_dokumen (022_rls_policies_kategori_dokumen.sql):
-- admin/hrd kelola penuh, seluruh role terautentikasi boleh SELECT (data
-- referensi dipakai di dropdown/filter oleh siapa pun).
CREATE POLICY jenis_sertifikasi_admin_all ON public.jenis_sertifikasi
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY jenis_sertifikasi_hrd_all ON public.jenis_sertifikasi
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

CREATE POLICY jenis_sertifikasi_select_authenticated ON public.jenis_sertifikasi
    FOR SELECT TO authenticated
    USING (true);
