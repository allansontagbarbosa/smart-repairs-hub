-- 1. Email tables: bind policies explicitly to service_role
DROP POLICY IF EXISTS "Service role can insert send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;
CREATE POLICY "Service role can insert send log" ON public.email_send_log FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can read send log" ON public.email_send_log FOR SELECT TO service_role USING (true);
CREATE POLICY "Service role can update send log" ON public.email_send_log FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage send state" ON public.email_send_state;
CREATE POLICY "Service role can manage send state" ON public.email_send_state FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON public.suppressed_emails;
DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;
CREATE POLICY "Service role can insert suppressed emails" ON public.suppressed_emails FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can read suppressed emails" ON public.suppressed_emails FOR SELECT TO service_role USING (true);

REVOKE ALL ON public.email_send_log FROM anon, authenticated;
REVOKE ALL ON public.email_send_state FROM anon, authenticated;
REVOKE ALL ON public.suppressed_emails FROM anon, authenticated;
GRANT ALL ON public.email_send_log TO service_role;
GRANT ALL ON public.email_send_state TO service_role;
GRANT ALL ON public.suppressed_emails TO service_role;

-- 2. Append-only audit tables
REVOKE UPDATE, DELETE, TRUNCATE ON public.os_auditoria FROM anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.os_status_historico FROM anon, authenticated;
GRANT SELECT, INSERT ON public.os_auditoria TO authenticated;
GRANT SELECT, INSERT ON public.os_status_historico TO authenticated;
GRANT ALL ON public.os_auditoria TO service_role;
GRANT ALL ON public.os_status_historico TO service_role;

DROP POLICY IF EXISTS "os_auditoria_no_update" ON public.os_auditoria;
CREATE POLICY "os_auditoria_no_update" ON public.os_auditoria AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false);
DROP POLICY IF EXISTS "os_auditoria_no_delete" ON public.os_auditoria;
CREATE POLICY "os_auditoria_no_delete" ON public.os_auditoria AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

DROP POLICY IF EXISTS "os_status_historico_no_update" ON public.os_status_historico;
CREATE POLICY "os_status_historico_no_update" ON public.os_status_historico AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false);
DROP POLICY IF EXISTS "os_status_historico_no_delete" ON public.os_status_historico;
CREATE POLICY "os_status_historico_no_delete" ON public.os_status_historico AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);