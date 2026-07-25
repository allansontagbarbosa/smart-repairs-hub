
-- 1) get_my_empresa_id: sentinela para lojistas (evita match com NULL em IS NOT DISTINCT FROM)
CREATE OR REPLACE FUNCTION public.get_my_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.lojista_usuarios
      WHERE user_id = auth.uid() AND ativo = true
    ) THEN '00000000-0000-0000-0000-000000000000'::uuid
    ELSE (
      SELECT empresa_id
      FROM public.user_profiles
      WHERE (user_id = auth.uid() OR id = auth.uid())
        AND ativo = true
        AND empresa_id IS NOT NULL
      ORDER BY created_at ASC
      LIMIT 1
    )
  END;
$function$;

-- 2) os_transferencias: substituir listas de nomes por is_adm_ou_socio(), exigir up.ativo=true,
--    e adicionar política de DELETE consistente.
DROP POLICY IF EXISTS os_transferencias_update ON public.os_transferencias;
DROP POLICY IF EXISTS os_transferencias_visiveis ON public.os_transferencias;
DROP POLICY IF EXISTS os_transferencias_delete ON public.os_transferencias;

CREATE POLICY os_transferencias_visiveis
ON public.os_transferencias
FOR SELECT
USING (
  empresa_id = get_my_empresa_id()
  AND (
    is_adm_ou_socio()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE ((up.user_id = auth.uid()) OR (up.id = auth.uid()))
        AND up.ativo = true
        AND up.funcionario_id = ANY (ARRAY[os_transferencias.funcionario_origem_id, os_transferencias.funcionario_destino_id])
    )
  )
);

CREATE POLICY os_transferencias_update
ON public.os_transferencias
FOR UPDATE
USING (
  empresa_id = get_my_empresa_id()
  AND (
    is_adm_ou_socio()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE ((up.user_id = auth.uid()) OR (up.id = auth.uid()))
        AND up.ativo = true
        AND up.funcionario_id = ANY (ARRAY[os_transferencias.funcionario_origem_id, os_transferencias.funcionario_destino_id])
    )
  )
)
WITH CHECK (
  empresa_id = get_my_empresa_id()
);

CREATE POLICY os_transferencias_delete
ON public.os_transferencias
FOR DELETE
USING (
  empresa_id = get_my_empresa_id()
  AND is_adm_ou_socio()
);
