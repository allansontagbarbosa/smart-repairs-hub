
-- DITT-SEC-02

DROP POLICY IF EXISTS "Admin gerencia caixa empresa" ON public.caixa_empresa;
DROP POLICY IF EXISTS "Empresa vê seu caixa" ON public.caixa_empresa;
DROP POLICY IF EXISTS "Admin gerencia movs caixa" ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS "Empresa vê movs caixa" ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS "Admin gerencia distribuições" ON public.distribuicoes_mensais;
DROP POLICY IF EXISTS "Empresa vê distribuições" ON public.distribuicoes_mensais;
DROP POLICY IF EXISTS "loja_crediario_all" ON public.loja_crediario;
DROP POLICY IF EXISTS "loja_parcelas_all" ON public.loja_crediario_parcelas;
DROP POLICY IF EXISTS "pagamentos_clientes_select" ON public.pagamentos_clientes;
DROP POLICY IF EXISTS "pagamentos_clientes_insert" ON public.pagamentos_clientes;
DROP POLICY IF EXISTS "pagamentos_clientes_update" ON public.pagamentos_clientes;
DROP POLICY IF EXISTS "pagamentos_clientes_delete" ON public.pagamentos_clientes;
DROP POLICY IF EXISTS "rec_cli_select_empresa" ON public.recebimentos_clientes;
DROP POLICY IF EXISTS "rec_cli_insert_empresa" ON public.recebimentos_clientes;
DROP POLICY IF EXISTS "rec_cli_update_empresa" ON public.recebimentos_clientes;
DROP POLICY IF EXISTS "rec_cli_delete_empresa" ON public.recebimentos_clientes;

DROP POLICY IF EXISTS "Admin gerencia contas sócios" ON public.socio_contas;
DROP POLICY IF EXISTS "Sócio vê sua conta + admin vê todas" ON public.socio_contas;

CREATE POLICY "socio_contas_select_auth" ON public.socio_contas
  FOR SELECT TO authenticated
  USING (
    empresa_id = get_my_empresa_id()
    AND (
      is_admin_user(auth.uid())
      OR is_adm_ou_socio()
      OR socio_id IN (SELECT id FROM public.socios WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "socio_contas_insert_auth" ON public.socio_contas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));
CREATE POLICY "socio_contas_update_auth" ON public.socio_contas
  FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()))
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));
CREATE POLICY "socio_contas_delete_auth" ON public.socio_contas
  FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin gerencia extrato sócios" ON public.socio_movimentacoes;
DROP POLICY IF EXISTS "Sócio vê seu extrato + admin vê todos" ON public.socio_movimentacoes;

CREATE POLICY "socio_movs_select_auth" ON public.socio_movimentacoes
  FOR SELECT TO authenticated
  USING (
    empresa_id = get_my_empresa_id()
    AND (
      is_admin_user(auth.uid())
      OR is_adm_ou_socio()
      OR socio_id IN (SELECT id FROM public.socios WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "socio_movs_insert_auth" ON public.socio_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));
CREATE POLICY "socio_movs_update_auth" ON public.socio_movimentacoes
  FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()))
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));
CREATE POLICY "socio_movs_delete_auth" ON public.socio_movimentacoes
  FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));

-- Duplicates
DROP POLICY IF EXISTS "Empresa isolada" ON public.listas_preco;
DROP POLICY IF EXISTS "Empresa isolada" ON public.lojas;
DROP POLICY IF EXISTS "loja_metas_all" ON public.loja_metas;

-- Broad ALL bypasses with adequate per-command coverage
DROP POLICY IF EXISTS "tenant_isolation" ON public.os_transferencias;
DROP POLICY IF EXISTS "tenant_isolation" ON public.socio_metas;

-- notificacoes_socio
DROP POLICY IF EXISTS "tenant_isolation" ON public.notificacoes_socio;
CREATE POLICY "notif_socio_insert_auth" ON public.notificacoes_socio
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = get_my_empresa_id()
    AND (is_admin_user(auth.uid()) OR is_adm_ou_socio() OR user_id = auth.uid())
  );
CREATE POLICY "notif_socio_update_own" ON public.notificacoes_socio
  FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND user_id = auth.uid())
  WITH CHECK (empresa_id = get_my_empresa_id() AND user_id = auth.uid());
CREATE POLICY "notif_socio_delete_admin" ON public.notificacoes_socio
  FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND (is_admin_user(auth.uid()) OR user_id = auth.uid()));

-- socio_insights_cache
DROP POLICY IF EXISTS "tenant_isolation" ON public.socio_insights_cache;
CREATE POLICY "insights_admin_select" ON public.socio_insights_cache
  FOR SELECT TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));
CREATE POLICY "insights_proprio_insert" ON public.socio_insights_cache
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND user_id = auth.uid());
CREATE POLICY "insights_proprio_update" ON public.socio_insights_cache
  FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND user_id = auth.uid())
  WITH CHECK (empresa_id = get_my_empresa_id() AND user_id = auth.uid());
CREATE POLICY "insights_proprio_delete" ON public.socio_insights_cache
  FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND (is_admin_user(auth.uid()) OR user_id = auth.uid()));

-- extrato_socio
DROP POLICY IF EXISTS "tenant_isolation" ON public.extrato_socio;
CREATE POLICY "extrato_socio_admin_select" ON public.extrato_socio
  FOR SELECT TO authenticated
  USING (empresa_id = get_my_empresa_id() AND (is_admin_user(auth.uid()) OR is_adm_ou_socio()));
CREATE POLICY "extrato_socio_admin_insert" ON public.extrato_socio
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));
CREATE POLICY "extrato_socio_admin_update" ON public.extrato_socio
  FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()))
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));
CREATE POLICY "extrato_socio_admin_delete" ON public.extrato_socio
  FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));

-- fechamentos_mensais
DROP POLICY IF EXISTS "tenant_isolation" ON public.fechamentos_mensais;
CREATE POLICY "fechamentos_admin_select" ON public.fechamentos_mensais
  FOR SELECT TO authenticated
  USING (empresa_id = get_my_empresa_id() AND (is_admin_user(auth.uid()) OR is_adm_ou_socio()));
CREATE POLICY "fechamentos_admin_insert" ON public.fechamentos_mensais
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));
CREATE POLICY "fechamentos_admin_update" ON public.fechamentos_mensais
  FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()))
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));
CREATE POLICY "fechamentos_admin_delete" ON public.fechamentos_mensais
  FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));

-- solicitacoes_lancamento
DROP POLICY IF EXISTS "tenant_isolation" ON public.solicitacoes_lancamento;
CREATE POLICY "solicit_admin_select" ON public.solicitacoes_lancamento
  FOR SELECT TO authenticated
  USING (empresa_id = get_my_empresa_id() AND (is_admin_user(auth.uid()) OR is_adm_ou_socio()));
CREATE POLICY "solicit_insert_auth" ON public.solicitacoes_lancamento
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND (is_admin_user(auth.uid()) OR is_adm_ou_socio()));
CREATE POLICY "solicit_update_admin" ON public.solicitacoes_lancamento
  FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()))
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));
CREATE POLICY "solicit_delete_admin" ON public.solicitacoes_lancamento
  FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));

-- notificacoes — allow system broadcast (user_id IS NULL) by admin/sócio
DROP POLICY IF EXISTS "notif_insert_self" ON public.notificacoes;
CREATE POLICY "notif_insert_self" ON public.notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = get_my_empresa_id()
    AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND (is_admin_user(auth.uid()) OR is_adm_ou_socio()))
    )
  );
