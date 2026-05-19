BEGIN;

-- FUNCIONARIOS
CREATE POLICY "perm_funcionarios_select" ON public.funcionarios FOR SELECT TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('rh','ver')
    OR id IN (
      SELECT funcionario_id FROM public.user_profiles
      WHERE user_id = auth.uid() AND ativo = TRUE AND funcionario_id IS NOT NULL
    )
  )
);

CREATE POLICY "perm_funcionarios_insert" ON public.funcionarios FOR INSERT TO authenticated
WITH CHECK (
  empresa_id = public.get_my_empresa_id()
  AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','criar'))
);

CREATE POLICY "perm_funcionarios_update" ON public.funcionarios FOR UPDATE TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','editar'))
);

CREATE POLICY "perm_funcionarios_delete" ON public.funcionarios FOR DELETE TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','excluir'))
);

-- COMISSOES
CREATE POLICY "perm_comissoes_select" ON public.comissoes FOR SELECT TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('financeiro','ver')
    OR public.has_permissao('rh','ver')
    OR funcionario_id IN (
      SELECT funcionario_id FROM public.user_profiles
      WHERE user_id = auth.uid() AND ativo = TRUE AND funcionario_id IS NOT NULL
    )
  )
);

CREATE POLICY "perm_comissoes_insert" ON public.comissoes FOR INSERT TO authenticated
WITH CHECK (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('financeiro','criar')
    OR public.has_permissao('assistencia','editar')
  )
);

CREATE POLICY "perm_comissoes_update" ON public.comissoes FOR UPDATE TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (public.is_admin_user(auth.uid()) OR public.has_permissao('financeiro','editar'))
);

CREATE POLICY "perm_comissoes_delete" ON public.comissoes FOR DELETE TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (public.is_admin_user(auth.uid()) OR public.has_permissao('financeiro','excluir'))
);

-- SOCIOS
CREATE POLICY "perm_socios_select" ON public.socios FOR SELECT TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('financeiro','ver')
    OR user_id = auth.uid()
  )
);

CREATE POLICY "perm_socios_insert" ON public.socios FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_my_empresa_id() AND public.is_admin_user(auth.uid()));

CREATE POLICY "perm_socios_update" ON public.socios FOR UPDATE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND public.is_admin_user(auth.uid()));

CREATE POLICY "perm_socios_delete" ON public.socios FOR DELETE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND public.is_admin_user(auth.uid()));

COMMIT;