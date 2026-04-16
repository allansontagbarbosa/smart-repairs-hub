DROP POLICY IF EXISTS "lojista_read_aparelhos" ON public.aparelhos;
DROP POLICY IF EXISTS "lojista_read_own_os" ON public.ordens_de_servico;
DROP POLICY IF EXISTS "lojista_read_garantias" ON public.garantias;

CREATE POLICY "lojista_read_aparelhos" ON public.aparelhos
  FOR SELECT TO authenticated
  USING (
    is_internal_user(auth.uid())
    OR empresa_id = get_my_empresa_id()
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = aparelhos.cliente_id
        AND c.lojista_id = get_my_lojista_id()
        AND get_my_lojista_id() IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Staff empresa isolada" ON public.ordens_de_servico;

CREATE POLICY "Staff empresa isolada" ON public.ordens_de_servico
  FOR ALL TO authenticated
  USING (
    is_internal_user(auth.uid())
    AND empresa_id = get_my_empresa_id()
  )
  WITH CHECK (
    is_internal_user(auth.uid())
    AND empresa_id = get_my_empresa_id()
  );

CREATE POLICY "lojista_read_own_os" ON public.ordens_de_servico
  FOR SELECT TO authenticated
  USING (
    NOT is_internal_user(auth.uid())
    AND lojista_id = get_my_lojista_id()
    AND get_my_lojista_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "lojista_read_garantias" ON public.garantias;

CREATE POLICY "lojista_read_garantias" ON public.garantias
  FOR SELECT TO authenticated
  USING (
    empresa_id = get_my_empresa_id()
    OR EXISTS (
      SELECT 1 FROM public.ordens_de_servico os
      WHERE os.id = garantias.ordem_id
        AND os.lojista_id = get_my_lojista_id()
        AND get_my_lojista_id() IS NOT NULL
    )
  );

NOTIFY pgrst, 'reload schema';