
-- 1) user_profiles: prevent privilege escalation via self-update
DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
CREATE POLICY "Users update own profile"
ON public.user_profiles
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND perfil_id IS NOT DISTINCT FROM (SELECT up.perfil_id FROM public.user_profiles up WHERE up.user_id = auth.uid())
  AND empresa_id IS NOT DISTINCT FROM (SELECT up.empresa_id FROM public.user_profiles up WHERE up.user_id = auth.uid())
  AND funcionario_id IS NOT DISTINCT FROM (SELECT up.funcionario_id FROM public.user_profiles up WHERE up.user_id = auth.uid())
  AND ativo IS NOT DISTINCT FROM (SELECT up.ativo FROM public.user_profiles up WHERE up.user_id = auth.uid())
);

-- 2) atacado_catalogo_acessos: hide senha_hash from authenticated users
REVOKE SELECT (senha_hash) ON public.atacado_catalogo_acessos FROM authenticated, anon;

-- 3) funcionarios: drop redundant tenant_isolation so per-permission policies actually constrain access
DROP POLICY IF EXISTS tenant_isolation ON public.funcionarios;

-- 4) backup_historico: restrict to admins of the company
DROP POLICY IF EXISTS "Admin gerencia backups da empresa" ON public.backup_historico;
DROP POLICY IF EXISTS "Empresa vê seus backups" ON public.backup_historico;
DROP POLICY IF EXISTS tenant_isolation ON public.backup_historico;

CREATE POLICY "Admin gerencia backups da empresa"
ON public.backup_historico
FOR ALL
USING (
  empresa_id = public.get_my_empresa_id()
  AND public.is_admin_user(auth.uid())
)
WITH CHECK (
  empresa_id = public.get_my_empresa_id()
  AND public.is_admin_user(auth.uid())
);
