BEGIN;

CREATE POLICY "perm_ordens_de_servico_select"
ON public.ordens_de_servico
FOR SELECT TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'ver')
    OR public.is_internal_user(auth.uid())
    OR tecnico_responsavel_id IN (
      SELECT funcionario_id FROM public.user_profiles
      WHERE user_id = auth.uid() AND ativo = TRUE
    )
  )
);

CREATE POLICY "perm_ordens_de_servico_insert"
ON public.ordens_de_servico
FOR INSERT TO authenticated
WITH CHECK (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'criar')
  )
);

CREATE POLICY "perm_ordens_de_servico_update"
ON public.ordens_de_servico
FOR UPDATE TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'editar')
    OR tecnico_responsavel_id IN (
      SELECT funcionario_id FROM public.user_profiles
      WHERE user_id = auth.uid() AND ativo = TRUE
    )
  )
);

CREATE POLICY "perm_ordens_de_servico_delete"
ON public.ordens_de_servico
FOR DELETE TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'excluir')
  )
);

CREATE POLICY "perm_os_servicos_select"
ON public.os_servicos
FOR SELECT TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'ver')
    OR public.is_internal_user(auth.uid())
  )
);

CREATE POLICY "perm_os_servicos_insert"
ON public.os_servicos
FOR INSERT TO authenticated
WITH CHECK (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'criar')
    OR public.has_permissao('assistencia', 'editar')
  )
);

CREATE POLICY "perm_os_servicos_update"
ON public.os_servicos
FOR UPDATE TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'editar')
    OR tecnico_id IN (
      SELECT funcionario_id FROM public.user_profiles
      WHERE user_id = auth.uid() AND ativo = TRUE
    )
  )
);

CREATE POLICY "perm_os_servicos_delete"
ON public.os_servicos
FOR DELETE TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'editar')
  )
);

CREATE POLICY "perm_os_fotos_select"
ON public.os_fotos
FOR SELECT TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'ver')
    OR public.is_internal_user(auth.uid())
  )
);

CREATE POLICY "perm_os_fotos_insert"
ON public.os_fotos
FOR INSERT TO authenticated
WITH CHECK (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'criar')
    OR public.has_permissao('assistencia', 'editar')
    OR ordem_id IN (
      SELECT os.id FROM public.ordens_de_servico os
      WHERE os.tecnico_responsavel_id IN (
        SELECT funcionario_id FROM public.user_profiles
        WHERE user_id = auth.uid() AND ativo = TRUE
      )
      AND os.deleted_at IS NULL
    )
  )
);

CREATE POLICY "perm_os_fotos_update"
ON public.os_fotos
FOR UPDATE TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'editar')
  )
);

CREATE POLICY "perm_os_fotos_delete"
ON public.os_fotos
FOR DELETE TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'editar')
    OR ordem_id IN (
      SELECT os.id FROM public.ordens_de_servico os
      WHERE os.tecnico_responsavel_id IN (
        SELECT funcionario_id FROM public.user_profiles
        WHERE user_id = auth.uid() AND ativo = TRUE
      )
      AND os.deleted_at IS NULL
    )
  )
);

CREATE POLICY "perm_os_checklist_saida_select"
ON public.os_checklist_saida
FOR SELECT TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'ver')
    OR public.is_internal_user(auth.uid())
  )
);

CREATE POLICY "perm_os_checklist_saida_insert"
ON public.os_checklist_saida
FOR INSERT TO authenticated
WITH CHECK (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'criar')
    OR public.has_permissao('assistencia', 'editar')
    OR ordem_id IN (
      SELECT os.id FROM public.ordens_de_servico os
      WHERE os.tecnico_responsavel_id IN (
        SELECT funcionario_id FROM public.user_profiles
        WHERE user_id = auth.uid() AND ativo = TRUE
      )
      AND os.deleted_at IS NULL
    )
  )
);

CREATE POLICY "perm_os_checklist_saida_update"
ON public.os_checklist_saida
FOR UPDATE TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'editar')
    OR ordem_id IN (
      SELECT os.id FROM public.ordens_de_servico os
      WHERE os.tecnico_responsavel_id IN (
        SELECT funcionario_id FROM public.user_profiles
        WHERE user_id = auth.uid() AND ativo = TRUE
      )
      AND os.deleted_at IS NULL
    )
  )
);

CREATE POLICY "perm_os_checklist_saida_delete"
ON public.os_checklist_saida
FOR DELETE TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_permissao('assistencia', 'editar')
  )
);

COMMIT;