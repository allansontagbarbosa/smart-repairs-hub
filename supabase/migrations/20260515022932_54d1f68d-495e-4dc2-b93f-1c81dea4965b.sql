CREATE OR REPLACE FUNCTION public.eh_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_nome_perfil TEXT;
BEGIN
  SELECT pa.nome_perfil INTO v_nome_perfil
  FROM public.user_profiles up
  JOIN public.perfis_acesso pa ON pa.id = up.perfil_id
  WHERE up.user_id = auth.uid()
    AND up.ativo = true
    AND pa.ativo = true;

  RETURN LOWER(COALESCE(v_nome_perfil, '')) IN ('administrador', 'admin', 'owner', 'dono', 'proprietário', 'proprietario');
END;
$$;

GRANT EXECUTE ON FUNCTION public.eh_admin() TO authenticated;