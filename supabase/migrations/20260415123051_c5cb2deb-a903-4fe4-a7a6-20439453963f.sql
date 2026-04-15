
-- ============================================================
-- 0. Ensure get_my_empresa_id uses user_profiles (already exists but re-create for safety)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT up.empresa_id
  FROM public.user_profiles up
  WHERE up.user_id = auth.uid() AND up.ativo = true
  LIMIT 1;
$$;

-- ============================================================
-- 1. Auto-fill empresa_id trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_empresa_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := public.get_my_empresa_id();
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Helper: drop + recreate for each table
--    Pattern: drop old permissive policies, create empresa-scoped ones
-- ============================================================

-- ---- funcionarios ----
DROP POLICY IF EXISTS "Anon full access" ON public.funcionarios;
DROP POLICY IF EXISTS "Authenticated full access" ON public.funcionarios;
CREATE POLICY "Empresa isolada" ON public.funcionarios FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- clientes ----
DROP POLICY IF EXISTS "Anon full access" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated full access" ON public.clientes;
CREATE POLICY "Empresa isolada" ON public.clientes FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- aparelhos ----
DROP POLICY IF EXISTS "Anon full access" ON public.aparelhos;
DROP POLICY IF EXISTS "Authenticated full access" ON public.aparelhos;
CREATE POLICY "Empresa isolada" ON public.aparelhos FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());
-- Keep anon read for portal lookups
CREATE POLICY "Anon read aparelhos" ON public.aparelhos FOR SELECT TO anon USING (true);

-- ---- ordens_de_servico (has portal policies - keep them) ----
DROP POLICY IF EXISTS "Staff full access" ON public.ordens_de_servico;
CREATE POLICY "Staff empresa isolada" ON public.ordens_de_servico FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()) AND empresa_id = public.get_my_empresa_id())
  WITH CHECK (is_internal_user(auth.uid()) AND empresa_id = public.get_my_empresa_id());
-- Portal policies already exist and are fine (they filter by client ownership)

-- ---- estoque ----
DROP POLICY IF EXISTS "Anon full access" ON public.estoque;
DROP POLICY IF EXISTS "Authenticated full access" ON public.estoque;
CREATE POLICY "Empresa isolada" ON public.estoque FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- estoque_itens ----
DROP POLICY IF EXISTS "Anon full access" ON public.estoque_itens;
DROP POLICY IF EXISTS "Authenticated full access" ON public.estoque_itens;
CREATE POLICY "Empresa isolada" ON public.estoque_itens FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- estoque_aparelhos ----
DROP POLICY IF EXISTS "Anon full access" ON public.estoque_aparelhos;
DROP POLICY IF EXISTS "Authenticated full access" ON public.estoque_aparelhos;
CREATE POLICY "Empresa isolada" ON public.estoque_aparelhos FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- estoque_categorias ----
DROP POLICY IF EXISTS "Anon full access" ON public.estoque_categorias;
DROP POLICY IF EXISTS "Authenticated full access" ON public.estoque_categorias;
CREATE POLICY "Empresa isolada" ON public.estoque_categorias FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- fornecedores ----
DROP POLICY IF EXISTS "Anon full access" ON public.fornecedores;
DROP POLICY IF EXISTS "Authenticated full access" ON public.fornecedores;
CREATE POLICY "Empresa isolada" ON public.fornecedores FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- contas_a_pagar ----
DROP POLICY IF EXISTS "Anon full access" ON public.contas_a_pagar;
DROP POLICY IF EXISTS "Authenticated full access" ON public.contas_a_pagar;
CREATE POLICY "Empresa isolada" ON public.contas_a_pagar FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- recebimentos ----
DROP POLICY IF EXISTS "Authenticated full access" ON public.recebimentos;
CREATE POLICY "Empresa isolada" ON public.recebimentos FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- movimentacoes_financeiras ----
DROP POLICY IF EXISTS "Anon full access" ON public.movimentacoes_financeiras;
DROP POLICY IF EXISTS "Authenticated full access" ON public.movimentacoes_financeiras;
CREATE POLICY "Empresa isolada" ON public.movimentacoes_financeiras FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- comissoes ----
DROP POLICY IF EXISTS "Anon full access" ON public.comissoes;
DROP POLICY IF EXISTS "Authenticated full access" ON public.comissoes;
CREATE POLICY "Empresa isolada" ON public.comissoes FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- comissoes_servico ----
DROP POLICY IF EXISTS "Anon full access" ON public.comissoes_servico;
DROP POLICY IF EXISTS "Authenticated full access" ON public.comissoes_servico;
CREATE POLICY "Empresa isolada" ON public.comissoes_servico FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- conferencias_estoque ----
DROP POLICY IF EXISTS "Anon full access" ON public.conferencias_estoque;
DROP POLICY IF EXISTS "Authenticated full access" ON public.conferencias_estoque;
CREATE POLICY "Empresa isolada" ON public.conferencias_estoque FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- conferencia_itens ----
DROP POLICY IF EXISTS "Anon full access" ON public.conferencia_itens;
DROP POLICY IF EXISTS "Authenticated full access" ON public.conferencia_itens;
CREATE POLICY "Empresa isolada" ON public.conferencia_itens FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- entradas_estoque ----
DROP POLICY IF EXISTS "Authenticated full access entradas_estoque" ON public.entradas_estoque;
CREATE POLICY "Empresa isolada" ON public.entradas_estoque FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- entradas_estoque_itens ----
DROP POLICY IF EXISTS "Authenticated full access entradas_estoque_itens" ON public.entradas_estoque_itens;
CREATE POLICY "Empresa isolada" ON public.entradas_estoque_itens FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- pedidos_compra ----
DROP POLICY IF EXISTS "Authenticated full access pedidos_compra" ON public.pedidos_compra;
CREATE POLICY "Empresa isolada" ON public.pedidos_compra FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- pedidos_compra_itens ----
DROP POLICY IF EXISTS "Authenticated full access pedidos_compra_itens" ON public.pedidos_compra_itens;
CREATE POLICY "Empresa isolada" ON public.pedidos_compra_itens FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- lojas ----
DROP POLICY IF EXISTS "Authenticated full access" ON public.lojas;
DROP POLICY IF EXISTS "Authenticated read lojas" ON public.lojas;
CREATE POLICY "Empresa isolada" ON public.lojas FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- perfis_acesso ----
DROP POLICY IF EXISTS "Anon full access" ON public.perfis_acesso;
DROP POLICY IF EXISTS "Authenticated full access" ON public.perfis_acesso;
CREATE POLICY "Empresa isolada" ON public.perfis_acesso FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR empresa_id IS NULL)
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- empresa_config ----
DROP POLICY IF EXISTS "Anon full access" ON public.empresa_config;
DROP POLICY IF EXISTS "Authenticated full access" ON public.empresa_config;
CREATE POLICY "Empresa isolada" ON public.empresa_config FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- tipos_servico ----
DROP POLICY IF EXISTS "Anon full access" ON public.tipos_servico;
DROP POLICY IF EXISTS "Authenticated full access" ON public.tipos_servico;
CREATE POLICY "Empresa isolada" ON public.tipos_servico FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR empresa_id IS NULL)
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- tipos_defeito ----
DROP POLICY IF EXISTS "Anon full access" ON public.tipos_defeito;
DROP POLICY IF EXISTS "Authenticated full access" ON public.tipos_defeito;
CREATE POLICY "Empresa isolada" ON public.tipos_defeito FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR empresa_id IS NULL)
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- formas_pagamento ----
DROP POLICY IF EXISTS "Authenticated full access" ON public.formas_pagamento;
DROP POLICY IF EXISTS "Authenticated read formas_pagamento" ON public.formas_pagamento;
CREATE POLICY "Empresa isolada" ON public.formas_pagamento FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR empresa_id IS NULL)
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- categorias_financeiras ----
DROP POLICY IF EXISTS "Anon full access" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "Authenticated full access" ON public.categorias_financeiras;
CREATE POLICY "Empresa isolada" ON public.categorias_financeiras FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR empresa_id IS NULL)
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- centros_custo ----
DROP POLICY IF EXISTS "Anon full access" ON public.centros_custo;
DROP POLICY IF EXISTS "Authenticated full access" ON public.centros_custo;
CREATE POLICY "Empresa isolada" ON public.centros_custo FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR empresa_id IS NULL)
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- modelos_documento ----
DROP POLICY IF EXISTS "Anon full access" ON public.modelos_documento;
DROP POLICY IF EXISTS "Authenticated full access" ON public.modelos_documento;
CREATE POLICY "Empresa isolada" ON public.modelos_documento FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR empresa_id IS NULL)
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- templates_mensagem ----
DROP POLICY IF EXISTS "Anon full access" ON public.templates_mensagem;
DROP POLICY IF EXISTS "Authenticated full access" ON public.templates_mensagem;
CREATE POLICY "Empresa isolada" ON public.templates_mensagem FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR empresa_id IS NULL)
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- notificacoes ----
DROP POLICY IF EXISTS "Authenticated full access notificacoes" ON public.notificacoes;
CREATE POLICY "Empresa isolada" ON public.notificacoes FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- auditoria ----
DROP POLICY IF EXISTS "Admin read auditoria" ON public.auditoria;
DROP POLICY IF EXISTS "System insert auditoria" ON public.auditoria;
CREATE POLICY "Empresa read auditoria" ON public.auditoria FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id() AND is_admin_user(auth.uid()));
CREATE POLICY "Empresa insert auditoria" ON public.auditoria FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_my_empresa_id() OR empresa_id IS NULL);

-- ---- avaliacoes (keep anon insert for portal) ----
DROP POLICY IF EXISTS "Authenticated read avaliacoes" ON public.avaliacoes;
DROP POLICY IF EXISTS "Authenticated insert avaliacoes" ON public.avaliacoes;
CREATE POLICY "Empresa read avaliacoes" ON public.avaliacoes FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());
CREATE POLICY "Empresa insert avaliacoes" ON public.avaliacoes FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_my_empresa_id() OR empresa_id IS NULL);
-- Anon insert policy already exists

-- ---- avaliacoes_fornecedor ----
DROP POLICY IF EXISTS "Authenticated full access avaliacoes_fornecedor" ON public.avaliacoes_fornecedor;
CREATE POLICY "Empresa isolada" ON public.avaliacoes_fornecedor FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- garantias (keep anon read for portal) ----
DROP POLICY IF EXISTS "Authenticated full access garantias" ON public.garantias;
CREATE POLICY "Empresa isolada garantias" ON public.garantias FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());
-- Anon read policy already exists

-- ---- historico_ordens (has portal policies - keep them) ----
DROP POLICY IF EXISTS "Authenticated full access" ON public.historico_ordens;
DROP POLICY IF EXISTS "Staff read all history" ON public.historico_ordens;
CREATE POLICY "Staff empresa isolada" ON public.historico_ordens FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()) AND empresa_id = public.get_my_empresa_id())
  WITH CHECK (is_internal_user(auth.uid()) AND empresa_id = public.get_my_empresa_id());
-- Portal policies already exist

-- ---- os_defeitos ----
DROP POLICY IF EXISTS "Authenticated full access" ON public.os_defeitos;
CREATE POLICY "Empresa isolada" ON public.os_defeitos FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- pecas_utilizadas ----
DROP POLICY IF EXISTS "Anon full access" ON public.pecas_utilizadas;
DROP POLICY IF EXISTS "Authenticated full access" ON public.pecas_utilizadas;
CREATE POLICY "Empresa isolada" ON public.pecas_utilizadas FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- listas_preco ----
DROP POLICY IF EXISTS "Anon full access" ON public.listas_preco;
DROP POLICY IF EXISTS "Authenticated full access" ON public.listas_preco;
CREATE POLICY "Empresa isolada" ON public.listas_preco FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- listas_preco_itens ----
DROP POLICY IF EXISTS "Anon full access" ON public.listas_preco_itens;
DROP POLICY IF EXISTS "Authenticated full access" ON public.listas_preco_itens;
CREATE POLICY "Empresa isolada" ON public.listas_preco_itens FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- produtos_base ----
DROP POLICY IF EXISTS "Anon full access" ON public.produtos_base;
DROP POLICY IF EXISTS "Authenticated full access" ON public.produtos_base;
CREATE POLICY "Empresa isolada" ON public.produtos_base FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- marcas ----
DROP POLICY IF EXISTS "Anon full access" ON public.marcas;
DROP POLICY IF EXISTS "Authenticated full access" ON public.marcas;
CREATE POLICY "Empresa isolada" ON public.marcas FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR empresa_id IS NULL)
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- modelos ----
DROP POLICY IF EXISTS "Anon full access" ON public.modelos;
DROP POLICY IF EXISTS "Authenticated full access" ON public.modelos;
CREATE POLICY "Empresa isolada" ON public.modelos FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR empresa_id IS NULL)
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- categorias_sistema ----
DROP POLICY IF EXISTS "Anon full access" ON public.categorias_sistema;
DROP POLICY IF EXISTS "Authenticated full access" ON public.categorias_sistema;
CREATE POLICY "Empresa isolada" ON public.categorias_sistema FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR empresa_id IS NULL)
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- socios ----
DROP POLICY IF EXISTS "Anon full access" ON public.socios;
DROP POLICY IF EXISTS "Authenticated full access" ON public.socios;
CREATE POLICY "Empresa isolada" ON public.socios FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- ajustes_mensais ----
DROP POLICY IF EXISTS "Authenticated full access" ON public.ajustes_mensais;
CREATE POLICY "Empresa isolada" ON public.ajustes_mensais FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- status_ordem_servico ----
DROP POLICY IF EXISTS "Anon full access" ON public.status_ordem_servico;
DROP POLICY IF EXISTS "Authenticated full access" ON public.status_ordem_servico;
CREATE POLICY "Empresa isolada" ON public.status_ordem_servico FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id() OR empresa_id IS NULL)
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- ---- imei_device_cache (shared across tenants - keep open) ----
-- Keep existing policies - IMEI cache is shared data

-- ---- user_profiles (special: can't use get_my_empresa_id - recursion!) ----
DROP POLICY IF EXISTS "Anon full access" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated full access" ON public.user_profiles;
CREATE POLICY "User own profile" ON public.user_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admin manage profiles" ON public.user_profiles FOR ALL TO authenticated
  USING (is_admin_user(auth.uid()) AND empresa_id = (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid() AND ativo = true LIMIT 1))
  WITH CHECK (is_admin_user(auth.uid()) AND empresa_id = (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid() AND ativo = true LIMIT 1));

-- ============================================================
-- 3. Auto-fill empresa_id triggers on all major tables
-- ============================================================
CREATE TRIGGER set_empresa_id_funcionarios BEFORE INSERT ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_clientes BEFORE INSERT ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_aparelhos BEFORE INSERT ON public.aparelhos FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_ordens BEFORE INSERT ON public.ordens_de_servico FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_estoque BEFORE INSERT ON public.estoque FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_estoque_itens BEFORE INSERT ON public.estoque_itens FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_estoque_aparelhos BEFORE INSERT ON public.estoque_aparelhos FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_estoque_categorias BEFORE INSERT ON public.estoque_categorias FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_fornecedores BEFORE INSERT ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_contas BEFORE INSERT ON public.contas_a_pagar FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_recebimentos BEFORE INSERT ON public.recebimentos FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_movfin BEFORE INSERT ON public.movimentacoes_financeiras FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_comissoes BEFORE INSERT ON public.comissoes FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_comissoes_servico BEFORE INSERT ON public.comissoes_servico FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_conferencias BEFORE INSERT ON public.conferencias_estoque FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_conf_itens BEFORE INSERT ON public.conferencia_itens FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_entradas BEFORE INSERT ON public.entradas_estoque FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_entradas_itens BEFORE INSERT ON public.entradas_estoque_itens FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_pedidos BEFORE INSERT ON public.pedidos_compra FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_pedidos_itens BEFORE INSERT ON public.pedidos_compra_itens FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_lojas BEFORE INSERT ON public.lojas FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_perfis BEFORE INSERT ON public.perfis_acesso FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_empresa_config BEFORE INSERT ON public.empresa_config FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_tipos_servico BEFORE INSERT ON public.tipos_servico FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_tipos_defeito BEFORE INSERT ON public.tipos_defeito FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_formas_pgto BEFORE INSERT ON public.formas_pagamento FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_cat_fin BEFORE INSERT ON public.categorias_financeiras FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_centros BEFORE INSERT ON public.centros_custo FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_doc BEFORE INSERT ON public.modelos_documento FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_templates BEFORE INSERT ON public.templates_mensagem FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_notif BEFORE INSERT ON public.notificacoes FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_auditoria BEFORE INSERT ON public.auditoria FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_avaliacoes BEFORE INSERT ON public.avaliacoes FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_garantias BEFORE INSERT ON public.garantias FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_historico BEFORE INSERT ON public.historico_ordens FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_os_defeitos BEFORE INSERT ON public.os_defeitos FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_pecas BEFORE INSERT ON public.pecas_utilizadas FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_listas BEFORE INSERT ON public.listas_preco FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_listas_itens BEFORE INSERT ON public.listas_preco_itens FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_produtos BEFORE INSERT ON public.produtos_base FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_marcas BEFORE INSERT ON public.marcas FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_modelos BEFORE INSERT ON public.modelos FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_cat_sistema BEFORE INSERT ON public.categorias_sistema FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_socios BEFORE INSERT ON public.socios FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_ajustes BEFORE INSERT ON public.ajustes_mensais FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_status_os BEFORE INSERT ON public.status_ordem_servico FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
CREATE TRIGGER set_empresa_id_aval_forn BEFORE INSERT ON public.avaliacoes_fornecedor FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();
