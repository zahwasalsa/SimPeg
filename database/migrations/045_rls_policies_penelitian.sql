-- Admin: full access to all penelitian
CREATE POLICY penelitian_admin_all ON public.penelitian
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- HRD: full access to all penelitian (oversight/koreksi, sama seperti modul lain)
CREATE POLICY penelitian_hrd_all ON public.penelitian
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'hrd')
    WITH CHECK (public.current_user_role() = 'hrd');

-- Pegawai: mengelola penuh penelitian miliknya sendiri (unlike kpi/roadmap_
-- karier, tidak ada alur "admin menetapkan target untuk pegawai" di sini —
-- penelitian pada dasarnya dilaporkan sendiri oleh peneliti/pengusul,
-- mengikuti FR-RES-001..004 "Pengguna dapat menginput...").
CREATE POLICY penelitian_select_own ON public.penelitian
    FOR SELECT TO authenticated
    USING (pegawai_id = public.current_pegawai_id());

CREATE POLICY penelitian_insert_own ON public.penelitian
    FOR INSERT TO authenticated
    WITH CHECK (pegawai_id = public.current_pegawai_id());

CREATE POLICY penelitian_update_own ON public.penelitian
    FOR UPDATE TO authenticated
    USING (pegawai_id = public.current_pegawai_id())
    WITH CHECK (pegawai_id = public.current_pegawai_id());
