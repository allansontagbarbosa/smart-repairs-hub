-- is_internal_user retorna FALSE para lojistas
CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE (user_id = _user_id OR id = _user_id)
        AND ativo = true
        AND empresa_id IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.lojista_usuarios
      WHERE user_id = _user_id
        AND ativo = true
    );
$$;

-- get_my_empresa_id retorna NULL para lojistas
CREATE OR REPLACE FUNCTION public.get_my_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.lojista_usuarios
      WHERE user_id = auth.uid() AND ativo = true
    ) THEN NULL::uuid
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
$$;

NOTIFY pgrst, 'reload schema';