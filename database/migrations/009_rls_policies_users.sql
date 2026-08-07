-- Admin: full access to all user accounts
CREATE POLICY users_admin_all ON public.users
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- Everyone: can view their own account row
CREATE POLICY users_select_own ON public.users
    FOR SELECT TO authenticated
    USING (id = auth.uid());
