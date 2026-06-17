
-- 1) notificacoes: drop broad ALL policies, add per-user scoped policies
DROP POLICY IF EXISTS "Empresa isolada" ON public.notificacoes;
DROP POLICY IF EXISTS tenant_isolation ON public.notificacoes;

CREATE POLICY notif_select_own ON public.notificacoes
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY notif_insert_tenant ON public.notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE POLICY notif_update_own ON public.notificacoes
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND (user_id IS NULL OR user_id = auth.uid())
  )
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY notif_delete_own ON public.notificacoes
  FOR DELETE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- 2) Drop the broad tenant_isolation ALL policies that bypass per-command perm_* policies
DROP POLICY IF EXISTS tenant_isolation ON public.avaliacoes_fornecedor;
DROP POLICY IF EXISTS tenant_isolation ON public.comissoes;
DROP POLICY IF EXISTS tenant_isolation ON public.contas_a_pagar;
DROP POLICY IF EXISTS tenant_isolation ON public.movimentacoes_financeiras;
DROP POLICY IF EXISTS tenant_isolation ON public.metas;
DROP POLICY IF EXISTS "Empresa isolada" ON public.estoque_itens;
DROP POLICY IF EXISTS tenant_isolation ON public.estoque_itens;
DROP POLICY IF EXISTS "Empresa isolada" ON public.pecas_utilizadas;

-- Metas also had legacy "ADM ..." policies without permission checks — drop them too
DROP POLICY IF EXISTS "ADM atualiza metas" ON public.metas;
DROP POLICY IF EXISTS "ADM cria metas" ON public.metas;
DROP POLICY IF EXISTS "ADM e usuários autenticados leem metas da empresa" ON public.metas;
DROP POLICY IF EXISTS "ADM faz soft delete de metas" ON public.metas;
