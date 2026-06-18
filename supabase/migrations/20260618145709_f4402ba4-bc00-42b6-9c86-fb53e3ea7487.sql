
-- cashback_audit_log: remover policy frouxa e exigir admin/sócio no SELECT
DROP POLICY IF EXISTS "Admin vê audit log" ON public.cashback_audit_log;
DROP POLICY IF EXISTS cashback_audit_select_tenant ON public.cashback_audit_log;
CREATE POLICY cashback_audit_select_adm_socio ON public.cashback_audit_log
  FOR SELECT TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

-- cashback_clientes: tirar {public}, recriar como authenticated
DROP POLICY IF EXISTS "Cliente vê sua ativação + admin tudo" ON public.cashback_clientes;
CREATE POLICY "Cliente vê sua ativação + admin tudo"
  ON public.cashback_clientes
  FOR SELECT TO authenticated
  USING (
    cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
    OR empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid())
  );

-- cashback_taxas_categoria: tirar {public}, recriar como authenticated
DROP POLICY IF EXISTS "Cliente vê suas taxas + admin tudo" ON public.cashback_taxas_categoria;
CREATE POLICY "Cliente vê suas taxas + admin tudo"
  ON public.cashback_taxas_categoria
  FOR SELECT TO authenticated
  USING (
    cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
    OR empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid())
  );

-- ia_uso_tokens: remover ia_uso_select {public} (tenant_isolation autenticado já cobre)
DROP POLICY IF EXISTS ia_uso_select ON public.ia_uso_tokens;

-- lojista_grupos: tirar {public}, recriar como authenticated
DROP POLICY IF EXISTS "Empresa vê seus grupos" ON public.lojista_grupos;
CREATE POLICY "Empresa vê seus grupos"
  ON public.lojista_grupos
  FOR SELECT TO authenticated
  USING (
    empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

-- user_profiles: eliminar a policy ALL que permite escalada e fixar UPDATE em authenticated
DROP POLICY IF EXISTS tenant_isolation ON public.user_profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
CREATE POLICY "Users update own profile"
  ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND NOT (perfil_id       IS DISTINCT FROM (SELECT up.perfil_id       FROM public.user_profiles up WHERE up.user_id = auth.uid()))
    AND NOT (empresa_id      IS DISTINCT FROM (SELECT up.empresa_id      FROM public.user_profiles up WHERE up.user_id = auth.uid()))
    AND NOT (funcionario_id  IS DISTINCT FROM (SELECT up.funcionario_id  FROM public.user_profiles up WHERE up.user_id = auth.uid()))
    AND NOT (ativo           IS DISTINCT FROM (SELECT up.ativo           FROM public.user_profiles up WHERE up.user_id = auth.uid()))
  );

-- user_profiles: garantir DELETE só para admin do mesmo tenant (a antiga ALL cobria implicitamente)
DROP POLICY IF EXISTS "Admin delete empresa profiles" ON public.user_profiles;
CREATE POLICY "Admin delete empresa profiles"
  ON public.user_profiles
  FOR DELETE TO authenticated
  USING (is_admin_user(auth.uid()) AND empresa_id IS NOT NULL AND empresa_id = get_my_empresa_id());
