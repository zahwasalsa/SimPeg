-- Admin: full access to all roadmap_karier
CREATE POLICY roadmap_karier_admin_all ON public.roadmap_karier
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- HRD: full CRUD on roadmap_karier (menetapkan posisi saat ini/target,
-- persyaratan, dan progres)
CREATE POLICY roadmap_karier_hrd_all ON public.roadmap_karier
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

-- Pegawai: hanya boleh memantau (SELECT) roadmap karier miliknya sendiri.
-- Berbeda dari kpi_update_own — blueprint tidak pernah menyebutkan pegawai
-- mengisi/mengubah data roadmap karier (hanya "memantau secara mandiri"),
-- jadi tidak ada policy UPDATE/INSERT/DELETE untuk pegawai di sini.
CREATE POLICY roadmap_karier_select_own ON public.roadmap_karier
    FOR SELECT TO authenticated
    USING (pegawai_id = public.current_pegawai_id());
