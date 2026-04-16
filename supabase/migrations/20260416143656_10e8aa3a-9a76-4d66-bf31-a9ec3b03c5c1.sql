-- 1. CORRIGIR is_internal_user — excluir lojistas
CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
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

-- 2. CORRIGIR aparelhos
DROP POLICY IF EXISTS "lojista_read_aparelhos" ON public.aparelhos;
DROP POLICY IF EXISTS "Empresa isolada" ON public.aparelhos;

CREATE POLICY "Empresa isolada" ON public.aparelhos
  FOR ALL TO authenticated
  USING (
    is_internal_user(auth.uid())
    AND empresa_id = get_my_empresa_id()
  )
  WITH CHECK (
    is_internal_user(auth.uid())
    AND empresa_id = get_my_empresa_id()
  );

CREATE POLICY "lojista_read_aparelhos" ON public.aparelhos
  FOR SELECT TO authenticated
  USING (
    NOT is_internal_user(auth.uid())
    AND get_my_lojista_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = aparelhos.cliente_id
        AND c.lojista_id = get_my_lojista_id()
    )
  );

-- 3. CORRIGIR garantias
DROP POLICY IF EXISTS "lojista_read_garantias" ON public.garantias;
DROP POLICY IF EXISTS "Empresa isolada garantias" ON public.garantias;

CREATE POLICY "Empresa isolada garantias" ON public.garantias
  FOR ALL TO authenticated
  USING (
    is_internal_user(auth.uid())
    AND empresa_id = get_my_empresa_id()
  )
  WITH CHECK (
    is_internal_user(auth.uid())
    AND empresa_id = get_my_empresa_id()
  );

CREATE POLICY "lojista_read_garantias" ON public.garantias
  FOR SELECT TO authenticated
  USING (
    NOT is_internal_user(auth.uid())
    AND get_my_lojista_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.ordens_de_servico os
      WHERE os.id = garantias.ordem_id
        AND os.lojista_id = get_my_lojista_id()
    )
  );

-- 4. BLOQUEAR lojistas de get_my_empresa_id
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
    ) THEN NULL
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

-- 5. CORRIGIR clientes — lojistas só veem seus clientes
DROP POLICY IF EXISTS "Empresa isolada" ON public.clientes;

CREATE POLICY "Empresa isolada" ON public.clientes
  FOR ALL TO authenticated
  USING (
    is_internal_user(auth.uid())
    AND empresa_id = get_my_empresa_id()
  )
  WITH CHECK (
    is_internal_user(auth.uid())
    AND empresa_id = get_my_empresa_id()
  );

CREATE POLICY "lojista_read_own_clientes" ON public.clientes
  FOR SELECT TO authenticated
  USING (
    NOT is_internal_user(auth.uid())
    AND get_my_lojista_id() IS NOT NULL
    AND lojista_id = get_my_lojista_id()
  );

NOTIFY pgrst, 'reload schema';