BEGIN;

-- estoque_itens
CREATE POLICY "perm_estoque_itens_select" ON public.estoque_itens FOR SELECT TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','ver') OR public.is_internal_user(auth.uid())));
CREATE POLICY "perm_estoque_itens_insert" ON public.estoque_itens FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','criar')));
CREATE POLICY "perm_estoque_itens_update" ON public.estoque_itens FOR UPDATE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','editar')));
CREATE POLICY "perm_estoque_itens_delete" ON public.estoque_itens FOR DELETE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','excluir')));

-- pecas_utilizadas
CREATE POLICY "perm_pecas_utilizadas_select" ON public.pecas_utilizadas FOR SELECT TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (
  public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','ver') OR public.has_permissao('assistencia','ver')
  OR ordem_id IN (SELECT os.id FROM public.ordens_de_servico os WHERE os.tecnico_responsavel_id IN (SELECT up.funcionario_id FROM public.user_profiles up WHERE up.user_id = auth.uid() AND up.funcionario_id IS NOT NULL) AND os.deleted_at IS NULL)
));
CREATE POLICY "perm_pecas_utilizadas_insert" ON public.pecas_utilizadas FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_my_empresa_id() AND (
  public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','criar') OR public.has_permissao('assistencia','editar')
  OR ordem_id IN (SELECT os.id FROM public.ordens_de_servico os WHERE os.tecnico_responsavel_id IN (SELECT up.funcionario_id FROM public.user_profiles up WHERE up.user_id = auth.uid() AND up.funcionario_id IS NOT NULL) AND os.deleted_at IS NULL)
));
CREATE POLICY "perm_pecas_utilizadas_update" ON public.pecas_utilizadas FOR UPDATE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (
  public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','editar') OR public.has_permissao('assistencia','editar')
));
CREATE POLICY "perm_pecas_utilizadas_delete" ON public.pecas_utilizadas FOR DELETE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (
  public.is_admin_user(auth.uid()) OR public.has_permissao('pecas','excluir') OR public.has_permissao('assistencia','editar')
  OR ordem_id IN (SELECT os.id FROM public.ordens_de_servico os WHERE os.tecnico_responsavel_id IN (SELECT up.funcionario_id FROM public.user_profiles up WHERE up.user_id = auth.uid() AND up.funcionario_id IS NOT NULL) AND os.deleted_at IS NULL)
));

-- aparelhos
CREATE POLICY "perm_aparelhos_select" ON public.aparelhos FOR SELECT TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (
  public.is_admin_user(auth.uid()) OR public.has_permissao('aparelhos','ver') OR public.has_permissao('assistencia','ver') OR public.is_internal_user(auth.uid())
));
CREATE POLICY "perm_aparelhos_insert" ON public.aparelhos FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_my_empresa_id() AND (
  public.is_admin_user(auth.uid()) OR public.has_permissao('aparelhos','criar') OR public.has_permissao('assistencia','criar')
));
CREATE POLICY "perm_aparelhos_update" ON public.aparelhos FOR UPDATE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (
  public.is_admin_user(auth.uid()) OR public.has_permissao('aparelhos','editar') OR public.has_permissao('assistencia','editar')
));
CREATE POLICY "perm_aparelhos_delete" ON public.aparelhos FOR DELETE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (
  public.is_admin_user(auth.uid()) OR public.has_permissao('aparelhos','excluir')
));

-- metas
CREATE POLICY "perm_metas_select" ON public.metas FOR SELECT TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (
  public.is_admin_user(auth.uid()) OR public.has_permissao('metas','ver')
  OR (escopo = 'empresa')
  OR (escopo = 'tecnico' AND escopo_id IN (SELECT up.funcionario_id FROM public.user_profiles up WHERE up.user_id = auth.uid() AND up.funcionario_id IS NOT NULL))
));
CREATE POLICY "perm_metas_insert" ON public.metas FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('metas','criar')));
CREATE POLICY "perm_metas_update" ON public.metas FOR UPDATE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('metas','editar')));
CREATE POLICY "perm_metas_delete" ON public.metas FOR DELETE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('metas','excluir')));

COMMIT;