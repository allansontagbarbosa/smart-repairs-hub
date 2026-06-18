
-- atacado_comissoes: drop broad {public} ALL, keep tenant_isolation
DROP POLICY IF EXISTS "tenant_all" ON public.atacado_comissoes;

-- socio_contas: drop broad ALL, keep per-command admin policies
DROP POLICY IF EXISTS "tenant_isolation" ON public.socio_contas;

-- socio_movimentacoes: drop broad ALL
DROP POLICY IF EXISTS "tenant_isolation" ON public.socio_movimentacoes;

-- cashback_config: drop duplicate ALL
DROP POLICY IF EXISTS "cashback_config_admin" ON public.cashback_config;

-- cashback_movimentacoes: drop duplicate ALL
DROP POLICY IF EXISTS "cashback_mov_admin_write" ON public.cashback_movimentacoes;

-- cashback_saldos: drop duplicate ALL
DROP POLICY IF EXISTS "cashback_saldos_admin_write" ON public.cashback_saldos;

-- checklist_templates: drop duplicate ALL
DROP POLICY IF EXISTS "checklist_templates_tenant" ON public.checklist_templates;

-- loja_trade_in: drop {public}-targeted ALL
DROP POLICY IF EXISTS "loja_trade_in_all" ON public.loja_trade_in;

-- lojista_grupos: drop {public}-targeted ALL
DROP POLICY IF EXISTS "Admin gerencia grupos da empresa" ON public.lojista_grupos;

-- tecnico_sessoes: drop broad ALL, keep self-scoped per-command policies
DROP POLICY IF EXISTS "tenant_isolation" ON public.tecnico_sessoes;
-- Ensure SELECT works for tenant members (per-command policies were insert/update only)
DROP POLICY IF EXISTS "sessoes_select_tenant" ON public.tecnico_sessoes;
CREATE POLICY "sessoes_select_tenant" ON public.tecnico_sessoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());
DROP POLICY IF EXISTS "sessoes_delete_admin" ON public.tecnico_sessoes;
CREATE POLICY "sessoes_delete_admin" ON public.tecnico_sessoes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_my_empresa_id() AND public.is_admin_user(auth.uid()));

-- tv_paineis: drop one of the duplicate ALL policies
DROP POLICY IF EXISTS "tv_paineis_empresa_isolada" ON public.tv_paineis;

-- retiradas_socios: re-scope SELECT policy from {public} to {authenticated}
DROP POLICY IF EXISTS "retiradas_visiveis" ON public.retiradas_socios;
CREATE POLICY "retiradas_visiveis" ON public.retiradas_socios
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND (
      public.is_adm_ou_socio()
      OR socio_id IN (SELECT id FROM public.socios WHERE user_id = auth.uid())
    )
  );
