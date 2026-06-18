
-- ============================================================
-- caixa_movimentacoes: split tenant_isolation into SELECT + role-gated writes
-- ============================================================
DROP POLICY IF EXISTS "tenant_isolation" ON public.caixa_movimentacoes;

CREATE POLICY "caixa_mov_select_tenant" ON public.caixa_movimentacoes
  FOR SELECT TO authenticated
  USING (empresa_id = get_my_empresa_id());

CREATE POLICY "caixa_mov_insert_adm_socio" ON public.caixa_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

CREATE POLICY "caixa_mov_update_adm_socio" ON public.caixa_movimentacoes
  FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio())
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

CREATE POLICY "caixa_mov_delete_adm_socio" ON public.caixa_movimentacoes
  FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

-- ============================================================
-- cashback_audit_log: drop broad INSERT policy, restrict writes to adm/sócio
-- ============================================================
DROP POLICY IF EXISTS "Admin insere audit log" ON public.cashback_audit_log;
DROP POLICY IF EXISTS "tenant_isolation" ON public.cashback_audit_log;

CREATE POLICY "cashback_audit_select_tenant" ON public.cashback_audit_log
  FOR SELECT TO authenticated
  USING (empresa_id = get_my_empresa_id());

CREATE POLICY "cashback_audit_insert_adm_socio" ON public.cashback_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

CREATE POLICY "cashback_audit_update_adm_socio" ON public.cashback_audit_log
  FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio())
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

CREATE POLICY "cashback_audit_delete_adm_socio" ON public.cashback_audit_log
  FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

-- ============================================================
-- cashback_clientes: drop broad FOR ALL, role-gate writes
-- ============================================================
DROP POLICY IF EXISTS "Admin gerencia cashback_clientes" ON public.cashback_clientes;
DROP POLICY IF EXISTS "tenant_isolation" ON public.cashback_clientes;

CREATE POLICY "cashback_clientes_select_tenant" ON public.cashback_clientes
  FOR SELECT TO authenticated
  USING (empresa_id = get_my_empresa_id());

CREATE POLICY "cashback_clientes_insert_adm_socio" ON public.cashback_clientes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

CREATE POLICY "cashback_clientes_update_adm_socio" ON public.cashback_clientes
  FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio())
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

CREATE POLICY "cashback_clientes_delete_adm_socio" ON public.cashback_clientes
  FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

-- ============================================================
-- cashback_taxas_categoria: drop broad FOR ALL, role-gate writes
-- ============================================================
DROP POLICY IF EXISTS "Admin gerencia cashback_taxas" ON public.cashback_taxas_categoria;
DROP POLICY IF EXISTS "tenant_isolation" ON public.cashback_taxas_categoria;

-- The existing "Cliente vê suas taxas + admin tudo" SELECT policy remains and covers reads.

CREATE POLICY "cashback_taxas_insert_adm_socio" ON public.cashback_taxas_categoria
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

CREATE POLICY "cashback_taxas_update_adm_socio" ON public.cashback_taxas_categoria
  FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio())
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

CREATE POLICY "cashback_taxas_delete_adm_socio" ON public.cashback_taxas_categoria
  FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

-- ============================================================
-- distribuicoes_mensais: split into SELECT + role-gated writes
-- ============================================================
DROP POLICY IF EXISTS "tenant_isolation" ON public.distribuicoes_mensais;

CREATE POLICY "distribuicoes_select_tenant" ON public.distribuicoes_mensais
  FOR SELECT TO authenticated
  USING (empresa_id = get_my_empresa_id());

CREATE POLICY "distribuicoes_insert_adm_socio" ON public.distribuicoes_mensais
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

CREATE POLICY "distribuicoes_update_adm_socio" ON public.distribuicoes_mensais
  FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio())
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

CREATE POLICY "distribuicoes_delete_adm_socio" ON public.distribuicoes_mensais
  FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

-- ============================================================
-- prejuizos: drop overly permissive "Empresa isolada" + tenant_isolation FOR ALL,
-- restrict to adm/sócio for both reads and writes (sensitive financial data)
-- ============================================================
DROP POLICY IF EXISTS "Empresa isolada" ON public.prejuizos;
DROP POLICY IF EXISTS "tenant_isolation" ON public.prejuizos;

CREATE POLICY "prejuizos_select_adm_socio" ON public.prejuizos
  FOR SELECT TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

CREATE POLICY "prejuizos_insert_adm_socio" ON public.prejuizos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

CREATE POLICY "prejuizos_update_adm_socio" ON public.prejuizos
  FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio())
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

CREATE POLICY "prejuizos_delete_adm_socio" ON public.prejuizos
  FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

-- ============================================================
-- funcionarios: tighten SELECT — only RH/admin or the employee themselves.
-- Removes general "rh:ver" permission gate so non-RH roles (vendedor/técnico)
-- cannot read sensitive CPF/salary/bank data.
-- ============================================================
DROP POLICY IF EXISTS "perm_funcionarios_select" ON public.funcionarios;

CREATE POLICY "perm_funcionarios_select" ON public.funcionarios
  FOR SELECT TO authenticated
  USING (
    empresa_id = get_my_empresa_id()
    AND (
      is_admin_user(auth.uid())
      OR is_rh()
      OR id IN (
        SELECT user_profiles.funcionario_id
        FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
      )
    )
  );
