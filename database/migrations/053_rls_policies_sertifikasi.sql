-- Admin: full access to all sertifikasi
CREATE POLICY sertifikasi_admin_all ON public.sertifikasi
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- HRD: full access to all sertifikasi (oversight/koreksi, sama seperti modul lain)
CREATE POLICY sertifikasi_hrd_all ON public.sertifikasi
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

-- Pegawai: mengelola penuh sertifikasi miliknya sendiri (FR-CERT-001
-- "Pengguna dapat menambahkan data sertifikat" — self-service, sama seperti
-- dokumen/penelitian/hki, bukan pola admin-menetapkan-untuk-pegawai seperti
-- kpi/roadmap_karier).
CREATE POLICY sertifikasi_select_own ON public.sertifikasi
    FOR SELECT TO authenticated
    USING (pegawai_id = public.current_pegawai_id());

CREATE POLICY sertifikasi_insert_own ON public.sertifikasi
    FOR INSERT TO authenticated
    WITH CHECK (pegawai_id = public.current_pegawai_id());

CREATE POLICY sertifikasi_update_own ON public.sertifikasi
    FOR UPDATE TO authenticated
    USING (pegawai_id = public.current_pegawai_id())
    WITH CHECK (pegawai_id = public.current_pegawai_id());

-- Catatan: tidak ada sertifikasi_delete_own — mengikuti pola dokumen/
-- penelitian/hki, self-delete ditegakkan di layer Express (authorize +
-- Service), bukan RLS. RLS di sini hanya defense-in-depth; backend memakai
-- service role key yang bypass RLS sepenuhnya.
