
-- =========================================================
-- 1) atacado_catalogo_acessos: lock down password hashes
-- =========================================================
DROP POLICY IF EXISTS tenant_via_cliente ON public.atacado_catalogo_acessos;

-- Admin-only SELECT (password hashes visible only to admins)
CREATE POLICY "acessos_admin_select" ON public.atacado_catalogo_acessos
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user(auth.uid())
    AND cliente_id IN (
      SELECT id FROM public.atacado_clientes
      WHERE empresa_id = public.get_my_empresa_id()
    )
  );

-- Admin-only writes
CREATE POLICY "acessos_admin_insert" ON public.atacado_catalogo_acessos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user(auth.uid())
    AND cliente_id IN (
      SELECT id FROM public.atacado_clientes
      WHERE empresa_id = public.get_my_empresa_id()
    )
  );

CREATE POLICY "acessos_admin_update" ON public.atacado_catalogo_acessos
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_user(auth.uid())
    AND cliente_id IN (
      SELECT id FROM public.atacado_clientes
      WHERE empresa_id = public.get_my_empresa_id()
    )
  )
  WITH CHECK (
    public.is_admin_user(auth.uid())
    AND cliente_id IN (
      SELECT id FROM public.atacado_clientes
      WHERE empresa_id = public.get_my_empresa_id()
    )
  );

CREATE POLICY "acessos_admin_delete" ON public.atacado_catalogo_acessos
  FOR DELETE TO authenticated
  USING (
    public.is_admin_user(auth.uid())
    AND cliente_id IN (
      SELECT id FROM public.atacado_clientes
      WHERE empresa_id = public.get_my_empresa_id()
    )
  );

-- =========================================================
-- 2) ia_conversas + ia_mensagens: per-user isolation
-- =========================================================
DROP POLICY IF EXISTS tenant_isolation ON public.ia_conversas;
DROP POLICY IF EXISTS tenant_isolation ON public.ia_mensagens;

-- ia_conversas: ensure update/delete also scoped per-user
DROP POLICY IF EXISTS ia_conversas_update ON public.ia_conversas;
CREATE POLICY "ia_conversas_update" ON public.ia_conversas
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_my_empresa_id() AND usuario_id = auth.uid())
  WITH CHECK (empresa_id = public.get_my_empresa_id() AND usuario_id = auth.uid());

DROP POLICY IF EXISTS ia_conversas_delete ON public.ia_conversas;
CREATE POLICY "ia_conversas_delete" ON public.ia_conversas
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_my_empresa_id() AND usuario_id = auth.uid());

-- ia_mensagens: replace empresa-wide SELECT with conversa-owner SELECT
DROP POLICY IF EXISTS ia_mensagens_select ON public.ia_mensagens;
CREATE POLICY "ia_mensagens_select" ON public.ia_mensagens
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.ia_conversas c
      WHERE c.id = ia_mensagens.conversa_id
        AND c.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ia_mensagens_insert ON public.ia_mensagens;
CREATE POLICY "ia_mensagens_insert" ON public.ia_mensagens
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_my_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.ia_conversas c
      WHERE c.id = ia_mensagens.conversa_id
        AND c.usuario_id = auth.uid()
    )
  );

CREATE POLICY "ia_mensagens_delete" ON public.ia_mensagens
  FOR DELETE TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.ia_conversas c
      WHERE c.id = ia_mensagens.conversa_id
        AND c.usuario_id = auth.uid()
    )
  );

-- =========================================================
-- 3) ordens_de_servico: explicit DENY of UPDATE/DELETE for
--    non-internal users (portal clients & lojistas).
-- =========================================================
CREATE POLICY "os_block_non_internal_update" ON public.ordens_de_servico
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE POLICY "os_block_non_internal_delete" ON public.ordens_de_servico
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "os_block_non_internal_insert" ON public.ordens_de_servico
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid()));
