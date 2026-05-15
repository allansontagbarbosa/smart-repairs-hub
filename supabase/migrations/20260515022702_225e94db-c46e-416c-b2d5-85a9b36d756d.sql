CREATE OR REPLACE FUNCTION public.eh_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT pa.codigo INTO v_role
  FROM public.user_profiles up
  LEFT JOIN public.perfis_acesso pa ON pa.id = up.perfil_id
  WHERE up.user_id = auth.uid()
    AND up.ativo = true;

  RETURN v_role IN ('admin', 'administrador', 'owner', 'dono');
END;
$$;

GRANT EXECUTE ON FUNCTION public.eh_admin() TO authenticated;