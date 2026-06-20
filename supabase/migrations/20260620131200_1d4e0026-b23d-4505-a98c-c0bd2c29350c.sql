
-- 1) user_profiles: restrict self-insert so perfil_id MUST be NULL (no self-escalation)
DROP POLICY IF EXISTS "Users insert own profile" ON public.user_profiles;
CREATE POLICY "Users insert own profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND empresa_id IS NOT NULL
  AND empresa_id = get_my_empresa_id()
  AND perfil_id IS NULL
);

-- 2) tabelas_fiscais: remove admin read, restrict to service_role only
DROP POLICY IF EXISTS tabelas_fiscais_admin_read ON public.tabelas_fiscais;
DROP POLICY IF EXISTS tabelas_fiscais_service_only ON public.tabelas_fiscais;
CREATE POLICY tabelas_fiscais_service_only
ON public.tabelas_fiscais
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.tabelas_fiscais FROM authenticated, anon;

-- 3) email_unsubscribe_tokens: explicit deny for authenticated/anon (defense in depth)
DROP POLICY IF EXISTS "Deny authenticated read tokens" ON public.email_unsubscribe_tokens;
CREATE POLICY "Deny authenticated read tokens"
ON public.email_unsubscribe_tokens
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.email_unsubscribe_tokens FROM authenticated, anon;
