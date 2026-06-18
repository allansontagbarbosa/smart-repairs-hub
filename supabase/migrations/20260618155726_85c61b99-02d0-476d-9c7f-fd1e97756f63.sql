
DROP POLICY IF EXISTS "Admin update empresa profiles" ON public.user_profiles;

CREATE POLICY "Admin update empresa profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  is_admin_user(auth.uid())
  AND empresa_id IS NOT NULL
  AND empresa_id = get_my_empresa_id()
)
WITH CHECK (
  is_admin_user(auth.uid())
  AND empresa_id IS NOT NULL
  AND empresa_id = get_my_empresa_id()
  -- Lock privilege-sensitive fields: admins cannot escalate perfil_id or ativo via this policy.
  AND perfil_id IS NOT DISTINCT FROM (
    SELECT up.perfil_id FROM public.user_profiles up WHERE up.id = user_profiles.id
  )
  AND ativo IS NOT DISTINCT FROM (
    SELECT up.ativo FROM public.user_profiles up WHERE up.id = user_profiles.id
  )
);
