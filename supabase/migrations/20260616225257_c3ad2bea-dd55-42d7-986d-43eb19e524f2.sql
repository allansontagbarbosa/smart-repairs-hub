-- 1. user_profiles INSERT: require self + same empresa as inviter
DROP POLICY IF EXISTS "System insert profile" ON public.user_profiles;
CREATE POLICY "Users insert own profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND empresa_id IS NOT NULL
  AND empresa_id = get_my_empresa_id()
);

-- 2. tabelas_fiscais: tenant-scope SELECT
DROP POLICY IF EXISTS "tabelas_fiscais_read" ON public.tabelas_fiscais;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tabelas_fiscais' AND column_name = 'empresa_id'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "tabelas_fiscais_tenant_read"
      ON public.tabelas_fiscais
      FOR SELECT
      TO authenticated
      USING (empresa_id = get_my_empresa_id())
    $p$;
  ELSE
    EXECUTE $p$
      CREATE POLICY "tabelas_fiscais_admin_read"
      ON public.tabelas_fiscais
      FOR SELECT
      TO authenticated
      USING (is_admin_user(auth.uid()))
    $p$;
  END IF;
END $$;