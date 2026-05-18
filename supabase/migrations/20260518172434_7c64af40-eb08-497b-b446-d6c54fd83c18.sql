-- RH
CREATE POLICY "perm_funcionario_movimentacoes_select" ON public.funcionario_movimentacoes FOR SELECT TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','ver')));
CREATE POLICY "perm_funcionario_movimentacoes_insert" ON public.funcionario_movimentacoes FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','criar')));
CREATE POLICY "perm_funcionario_movimentacoes_update" ON public.funcionario_movimentacoes FOR UPDATE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','editar')));
CREATE POLICY "perm_funcionario_movimentacoes_delete" ON public.funcionario_movimentacoes FOR DELETE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','excluir')));

CREATE POLICY "perm_funcionario_ponto_entradas_select" ON public.funcionario_ponto_entradas FOR SELECT TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','ver')));
CREATE POLICY "perm_funcionario_ponto_entradas_insert" ON public.funcionario_ponto_entradas FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','criar')));
CREATE POLICY "perm_funcionario_ponto_entradas_update" ON public.funcionario_ponto_entradas FOR UPDATE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','editar')));
CREATE POLICY "perm_funcionario_ponto_entradas_delete" ON public.funcionario_ponto_entradas FOR DELETE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','excluir')));

CREATE POLICY "perm_funcionario_importacoes_ponto_select" ON public.funcionario_importacoes_ponto FOR SELECT TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','ver')));
CREATE POLICY "perm_funcionario_importacoes_ponto_insert" ON public.funcionario_importacoes_ponto FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','criar')));
CREATE POLICY "perm_funcionario_importacoes_ponto_update" ON public.funcionario_importacoes_ponto FOR UPDATE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','editar')));
CREATE POLICY "perm_funcionario_importacoes_ponto_delete" ON public.funcionario_importacoes_ponto FOR DELETE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','excluir')));

-- Financeiro
CREATE POLICY "perm_contas_pagar_pagamentos_select" ON public.contas_pagar_pagamentos FOR SELECT TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('financeiro','ver')));
CREATE POLICY "perm_contas_pagar_pagamentos_insert" ON public.contas_pagar_pagamentos FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('financeiro','criar')));
CREATE POLICY "perm_contas_pagar_pagamentos_update" ON public.contas_pagar_pagamentos FOR UPDATE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('financeiro','editar')));
CREATE POLICY "perm_contas_pagar_pagamentos_delete" ON public.contas_pagar_pagamentos FOR DELETE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('financeiro','excluir')));

-- Configurações
CREATE POLICY "perm_comissoes_servico_select" ON public.comissoes_servico FOR SELECT TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('configuracoes','ver')));
CREATE POLICY "perm_comissoes_servico_insert" ON public.comissoes_servico FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('configuracoes','ver')));
CREATE POLICY "perm_comissoes_servico_update" ON public.comissoes_servico FOR UPDATE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('configuracoes','ver')));
CREATE POLICY "perm_comissoes_servico_delete" ON public.comissoes_servico FOR DELETE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('configuracoes','ver')));