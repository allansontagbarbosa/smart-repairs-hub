
-- backup_historico: restrict to authenticated
DROP POLICY IF EXISTS "Admin gerencia backups da empresa" ON public.backup_historico;
CREATE POLICY "Admin gerencia backups da empresa"
ON public.backup_historico
FOR ALL
TO authenticated
USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()))
WITH CHECK (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));

-- os_transferencias: restrict SELECT/UPDATE/DELETE to authenticated
DROP POLICY IF EXISTS os_transferencias_delete ON public.os_transferencias;
CREATE POLICY os_transferencias_delete
ON public.os_transferencias
FOR DELETE
TO authenticated
USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());

DROP POLICY IF EXISTS os_transferencias_update ON public.os_transferencias;
CREATE POLICY os_transferencias_update
ON public.os_transferencias
FOR UPDATE
TO authenticated
USING (
  empresa_id = get_my_empresa_id()
  AND (
    is_adm_ou_socio()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE ((up.user_id = auth.uid()) OR (up.id = auth.uid()))
        AND up.ativo = true
        AND up.funcionario_id = ANY (ARRAY[os_transferencias.funcionario_origem_id, os_transferencias.funcionario_destino_id])
    )
  )
)
WITH CHECK (empresa_id = get_my_empresa_id());

DROP POLICY IF EXISTS os_transferencias_visiveis ON public.os_transferencias;
CREATE POLICY os_transferencias_visiveis
ON public.os_transferencias
FOR SELECT
TO authenticated
USING (
  empresa_id = get_my_empresa_id()
  AND (
    is_adm_ou_socio()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE ((up.user_id = auth.uid()) OR (up.id = auth.uid()))
        AND up.ativo = true
        AND up.funcionario_id = ANY (ARRAY[os_transferencias.funcionario_origem_id, os_transferencias.funcionario_destino_id])
    )
  )
);
