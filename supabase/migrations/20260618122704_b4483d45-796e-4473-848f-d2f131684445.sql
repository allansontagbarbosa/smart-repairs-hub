-- ====== ATACADO: remover policies aplicáveis a {public} (anon+auth) ======
DROP POLICY IF EXISTS tenant_all ON public.atacado_aparelhos;
DROP POLICY IF EXISTS tenant_all ON public.atacado_clientes;
DROP POLICY IF EXISTS tenant_all ON public.atacado_metas;
DROP POLICY IF EXISTS tenant_all ON public.atacado_pedidos;
DROP POLICY IF EXISTS tenant_all ON public.atacado_tabelas_preco;

DROP POLICY IF EXISTS tenant_select ON public.atacado_cobrancas_historico;
DROP POLICY IF EXISTS tenant_insert ON public.atacado_cobrancas_historico;
DROP POLICY IF EXISTS tenant_update ON public.atacado_cobrancas_historico;
DROP POLICY IF EXISTS tenant_delete ON public.atacado_cobrancas_historico;

DROP POLICY IF EXISTS tenant_select ON public.atacado_configuracoes;
DROP POLICY IF EXISTS tenant_insert ON public.atacado_configuracoes;
DROP POLICY IF EXISTS tenant_update ON public.atacado_configuracoes;
DROP POLICY IF EXISTS tenant_delete ON public.atacado_configuracoes;

-- Tabelas que só tinham a policy {public}: recriar como {authenticated} via parent
DROP POLICY IF EXISTS tenant_via_pedido ON public.atacado_pedidos_itens;
CREATE POLICY tenant_via_pedido ON public.atacado_pedidos_itens
  AS PERMISSIVE FOR ALL TO authenticated
  USING (pedido_id IN (SELECT id FROM public.atacado_pedidos WHERE empresa_id = public.get_my_empresa_id()))
  WITH CHECK (pedido_id IN (SELECT id FROM public.atacado_pedidos WHERE empresa_id = public.get_my_empresa_id()));

DROP POLICY IF EXISTS tenant_via_pedido_pag ON public.atacado_pedidos_pagamentos;
CREATE POLICY tenant_via_pedido_pag ON public.atacado_pedidos_pagamentos
  AS PERMISSIVE FOR ALL TO authenticated
  USING (pedido_id IN (SELECT id FROM public.atacado_pedidos WHERE empresa_id = public.get_my_empresa_id()))
  WITH CHECK (pedido_id IN (SELECT id FROM public.atacado_pedidos WHERE empresa_id = public.get_my_empresa_id()));

DROP POLICY IF EXISTS tenant_via_tabela ON public.atacado_tabelas_preco_itens;
CREATE POLICY tenant_via_tabela ON public.atacado_tabelas_preco_itens
  AS PERMISSIVE FOR ALL TO authenticated
  USING (tabela_preco_id IN (SELECT id FROM public.atacado_tabelas_preco WHERE empresa_id = public.get_my_empresa_id()))
  WITH CHECK (tabela_preco_id IN (SELECT id FROM public.atacado_tabelas_preco WHERE empresa_id = public.get_my_empresa_id()));

-- ====== LOJA: remover policies {public} duplicadas ======
DROP POLICY IF EXISTS loja_vendas_all ON public.loja_vendas;
DROP POLICY IF EXISTS loja_pagamentos_all ON public.loja_pagamentos;
DROP POLICY IF EXISTS loja_vendas_itens_all ON public.loja_vendas_itens;
DROP POLICY IF EXISTS loja_vendedor_config_all ON public.loja_vendedor_config;

-- loja_pagamentos / loja_vendas_itens podem não ter tenant_isolation — garantir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loja_pagamentos' AND policyname='tenant_via_venda') THEN
    EXECUTE $p$CREATE POLICY tenant_via_venda ON public.loja_pagamentos
      AS PERMISSIVE FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.loja_vendas v WHERE v.id = loja_pagamentos.venda_id AND v.empresa_id = public.get_my_empresa_id()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.loja_vendas v WHERE v.id = loja_pagamentos.venda_id AND v.empresa_id = public.get_my_empresa_id()))$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loja_vendas_itens' AND policyname='tenant_via_venda') THEN
    EXECUTE $p$CREATE POLICY tenant_via_venda ON public.loja_vendas_itens
      AS PERMISSIVE FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.loja_vendas v WHERE v.id = loja_vendas_itens.venda_id AND v.empresa_id = public.get_my_empresa_id()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.loja_vendas v WHERE v.id = loja_vendas_itens.venda_id AND v.empresa_id = public.get_my_empresa_id()))$p$;
  END IF;
END$$;

-- ====== funcionario_jornada: exigir admin ou permissão de RH para escrever ======
DROP POLICY IF EXISTS jornada_modify ON public.funcionario_jornada;
CREATE POLICY jornada_insert ON public.funcionario_jornada
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND (public.is_admin_user(auth.uid()) OR public.is_adm_ou_socio() OR public.is_rh() OR public.has_permissao('rh','editar'))
  );
CREATE POLICY jornada_update ON public.funcionario_jornada
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND (public.is_admin_user(auth.uid()) OR public.is_adm_ou_socio() OR public.is_rh() OR public.has_permissao('rh','editar'))
  )
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND (public.is_admin_user(auth.uid()) OR public.is_adm_ou_socio() OR public.is_rh() OR public.has_permissao('rh','editar'))
  );
CREATE POLICY jornada_delete ON public.funcionario_jornada
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND (public.is_admin_user(auth.uid()) OR public.is_adm_ou_socio() OR public.is_rh() OR public.has_permissao('rh','editar'))
  );

-- ====== notificacoes: broadcast (user_id IS NULL) só pra admin/sócio em SELECT/UPDATE/DELETE ======
DROP POLICY IF EXISTS notif_select_own ON public.notificacoes;
CREATE POLICY notif_select_own ON public.notificacoes
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND (public.is_admin_user(auth.uid()) OR public.is_adm_ou_socio()))
    )
  );

DROP POLICY IF EXISTS notif_update_own ON public.notificacoes;
CREATE POLICY notif_update_own ON public.notificacoes
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND (public.is_admin_user(auth.uid()) OR public.is_adm_ou_socio()))
    )
  )
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND (public.is_admin_user(auth.uid()) OR public.is_adm_ou_socio()))
    )
  );

DROP POLICY IF EXISTS notif_delete_own ON public.notificacoes;
CREATE POLICY notif_delete_own ON public.notificacoes
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND (public.is_admin_user(auth.uid()) OR public.is_adm_ou_socio()))
    )
  );

-- ====== status_ordem_servico: remover leitura ampla ======
DROP POLICY IF EXISTS "Authenticated read status" ON public.status_ordem_servico;
