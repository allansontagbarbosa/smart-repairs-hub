-- 1) Restrict staff_manage_lojista_usuarios to same empresa via lojistas join
DROP POLICY IF EXISTS "staff_manage_lojista_usuarios" ON public.lojista_usuarios;

CREATE POLICY "staff_manage_lojista_usuarios"
ON public.lojista_usuarios
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lojistas l
    WHERE l.id = lojista_usuarios.lojista_id
      AND l.empresa_id = public.get_my_empresa_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lojistas l
    WHERE l.id = lojista_usuarios.lojista_id
      AND l.empresa_id = public.get_my_empresa_id()
  )
);

-- 2) Prevent a user from simultaneously being a lojista and having an active internal profile with empresa_id
CREATE OR REPLACE FUNCTION public.prevent_lojista_internal_profile_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When inserting/updating user_profiles: block if user is an active lojista
  IF TG_TABLE_NAME = 'user_profiles' THEN
    IF NEW.ativo = true AND NEW.empresa_id IS NOT NULL AND NEW.user_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.lojista_usuarios lu
        WHERE lu.user_id = NEW.user_id AND lu.ativo = true
      ) THEN
        RAISE EXCEPTION 'Usuário já vinculado como lojista ativo; não pode ter perfil interno ativo com empresa.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- When inserting/updating lojista_usuarios: block if user has active internal profile with empresa
  IF TG_TABLE_NAME = 'lojista_usuarios' THEN
    IF NEW.ativo = true AND NEW.user_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.user_id = NEW.user_id AND up.ativo = true AND up.empresa_id IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'Usuário já possui perfil interno ativo vinculado a uma empresa; não pode ser lojista ativo simultaneamente.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_overlap_user_profiles ON public.user_profiles;
CREATE TRIGGER trg_prevent_overlap_user_profiles
BEFORE INSERT OR UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_lojista_internal_profile_overlap();

DROP TRIGGER IF EXISTS trg_prevent_overlap_lojista_usuarios ON public.lojista_usuarios;
CREATE TRIGGER trg_prevent_overlap_lojista_usuarios
BEFORE INSERT OR UPDATE ON public.lojista_usuarios
FOR EACH ROW EXECUTE FUNCTION public.prevent_lojista_internal_profile_overlap();

-- 3) Restrict Admin update empresa profiles policy to authenticated role
DROP POLICY IF EXISTS "Admin update empresa profiles" ON public.user_profiles;

CREATE POLICY "Admin update empresa profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  public.is_admin_user(auth.uid())
  AND empresa_id = public.get_my_empresa_id()
)
WITH CHECK (
  public.is_admin_user(auth.uid())
  AND empresa_id = public.get_my_empresa_id()
);
