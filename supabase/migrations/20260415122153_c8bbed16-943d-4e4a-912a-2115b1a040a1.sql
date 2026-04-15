
CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.perfis_acesso pa ON pa.id = up.perfil_id
    WHERE up.user_id = _user_id AND up.ativo = true AND pa.nome_perfil IN ('admin', 'Administrador')
  )
$$;
