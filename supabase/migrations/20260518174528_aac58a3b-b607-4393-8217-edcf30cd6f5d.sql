BEGIN;

-- estoque_movimentos
CREATE POLICY "perm_estoque_movimentos_select" ON public.estoque_movimentos FOR SELECT TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','ver')));
CREATE POLICY "perm_estoque_movimentos_insert" ON public.estoque_movimentos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','criar')));
CREATE POLICY "perm_estoque_movimentos_update" ON public.estoque_movimentos FOR UPDATE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','editar')));
CREATE POLICY "perm_estoque_movimentos_delete" ON public.estoque_movimentos FOR DELETE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','excluir')));

-- estoque_lotes
CREATE POLICY "perm_estoque_lotes_select" ON public.estoque_lotes FOR SELECT TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','ver')));
CREATE POLICY "perm_estoque_lotes_insert" ON public.estoque_lotes FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','criar')));
CREATE POLICY "perm_estoque_lotes_update" ON public.estoque_lotes FOR UPDATE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','editar')));
CREATE POLICY "perm_estoque_lotes_delete" ON public.estoque_lotes FOR DELETE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','excluir')));

-- pecas_utilizadas_lotes
CREATE POLICY "perm_pecas_utilizadas_lotes_select" ON public.pecas_utilizadas_lotes FOR SELECT TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','ver')));
CREATE POLICY "perm_pecas_utilizadas_lotes_insert" ON public.pecas_utilizadas_lotes FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','criar')));
CREATE POLICY "perm_pecas_utilizadas_lotes_update" ON public.pecas_utilizadas_lotes FOR UPDATE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','editar')));
CREATE POLICY "perm_pecas_utilizadas_lotes_delete" ON public.pecas_utilizadas_lotes FOR DELETE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','excluir')));

-- conferencias_estoque
CREATE POLICY "perm_conferencias_estoque_select" ON public.conferencias_estoque FOR SELECT TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','ver')));
CREATE POLICY "perm_conferencias_estoque_insert" ON public.conferencias_estoque FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','criar')));
CREATE POLICY "perm_conferencias_estoque_update" ON public.conferencias_estoque FOR UPDATE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','editar')));
CREATE POLICY "perm_conferencias_estoque_delete" ON public.conferencias_estoque FOR DELETE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','excluir')));

-- conferencia_itens
CREATE POLICY "perm_conferencia_itens_select" ON public.conferencia_itens FOR SELECT TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','ver')));
CREATE POLICY "perm_conferencia_itens_insert" ON public.conferencia_itens FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','criar')));
CREATE POLICY "perm_conferencia_itens_update" ON public.conferencia_itens FOR UPDATE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','editar')));
CREATE POLICY "perm_conferencia_itens_delete" ON public.conferencia_itens FOR DELETE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','excluir')));

-- historico_custo_peca
CREATE POLICY "perm_historico_custo_peca_select" ON public.historico_custo_peca FOR SELECT TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','ver')));
CREATE POLICY "perm_historico_custo_peca_insert" ON public.historico_custo_peca FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','criar')));
CREATE POLICY "perm_historico_custo_peca_update" ON public.historico_custo_peca FOR UPDATE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','editar')));
CREATE POLICY "perm_historico_custo_peca_delete" ON public.historico_custo_peca FOR DELETE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','excluir')));

-- estoque_aparelhos
CREATE POLICY "perm_estoque_aparelhos_select" ON public.estoque_aparelhos FOR SELECT TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('aparelhos','ver')));
CREATE POLICY "perm_estoque_aparelhos_insert" ON public.estoque_aparelhos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('aparelhos','criar')));
CREATE POLICY "perm_estoque_aparelhos_update" ON public.estoque_aparelhos FOR UPDATE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('aparelhos','editar')));
CREATE POLICY "perm_estoque_aparelhos_delete" ON public.estoque_aparelhos FOR DELETE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('aparelhos','excluir')));

-- pedidos_compra
CREATE POLICY "perm_pedidos_compra_select" ON public.pedidos_compra FOR SELECT TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','ver')));
CREATE POLICY "perm_pedidos_compra_insert" ON public.pedidos_compra FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','criar')));
CREATE POLICY "perm_pedidos_compra_update" ON public.pedidos_compra FOR UPDATE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','editar')));
CREATE POLICY "perm_pedidos_compra_delete" ON public.pedidos_compra FOR DELETE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','excluir')));

-- pedidos_compra_itens
CREATE POLICY "perm_pedidos_compra_itens_select" ON public.pedidos_compra_itens FOR SELECT TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','ver')));
CREATE POLICY "perm_pedidos_compra_itens_insert" ON public.pedidos_compra_itens FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','criar')));
CREATE POLICY "perm_pedidos_compra_itens_update" ON public.pedidos_compra_itens FOR UPDATE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','editar')));
CREATE POLICY "perm_pedidos_compra_itens_delete" ON public.pedidos_compra_itens FOR DELETE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','excluir')));

-- entradas_estoque
CREATE POLICY "perm_entradas_estoque_select" ON public.entradas_estoque FOR SELECT TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','ver')));
CREATE POLICY "perm_entradas_estoque_insert" ON public.entradas_estoque FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','criar')));
CREATE POLICY "perm_entradas_estoque_update" ON public.entradas_estoque FOR UPDATE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','editar')));
CREATE POLICY "perm_entradas_estoque_delete" ON public.entradas_estoque FOR DELETE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','excluir')));

-- entradas_estoque_itens
CREATE POLICY "perm_entradas_estoque_itens_select" ON public.entradas_estoque_itens FOR SELECT TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','ver')));
CREATE POLICY "perm_entradas_estoque_itens_insert" ON public.entradas_estoque_itens FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','criar')));
CREATE POLICY "perm_entradas_estoque_itens_update" ON public.entradas_estoque_itens FOR UPDATE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','editar')));
CREATE POLICY "perm_entradas_estoque_itens_delete" ON public.entradas_estoque_itens FOR DELETE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('compras','excluir')));

-- fornecedores
CREATE POLICY "perm_fornecedores_select" ON public.fornecedores FOR SELECT TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('fornecedores','ver')));
CREATE POLICY "perm_fornecedores_insert" ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('fornecedores','criar')));
CREATE POLICY "perm_fornecedores_update" ON public.fornecedores FOR UPDATE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('fornecedores','editar')));
CREATE POLICY "perm_fornecedores_delete" ON public.fornecedores FOR DELETE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('fornecedores','excluir')));

-- avaliacoes_fornecedor
CREATE POLICY "perm_avaliacoes_fornecedor_select" ON public.avaliacoes_fornecedor FOR SELECT TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('fornecedores','ver')));
CREATE POLICY "perm_avaliacoes_fornecedor_insert" ON public.avaliacoes_fornecedor FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('fornecedores','criar')));
CREATE POLICY "perm_avaliacoes_fornecedor_update" ON public.avaliacoes_fornecedor FOR UPDATE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('fornecedores','editar')));
CREATE POLICY "perm_avaliacoes_fornecedor_delete" ON public.avaliacoes_fornecedor FOR DELETE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('fornecedores','excluir')));

-- lojista_faturas
CREATE POLICY "perm_lojista_faturas_select" ON public.lojista_faturas FOR SELECT TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('faturas_b2b','ver')));
CREATE POLICY "perm_lojista_faturas_insert" ON public.lojista_faturas FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('faturas_b2b','criar')));
CREATE POLICY "perm_lojista_faturas_update" ON public.lojista_faturas FOR UPDATE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('faturas_b2b','editar')));
CREATE POLICY "perm_lojista_faturas_delete" ON public.lojista_faturas FOR DELETE TO authenticated USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('faturas_b2b','excluir')));

COMMIT;