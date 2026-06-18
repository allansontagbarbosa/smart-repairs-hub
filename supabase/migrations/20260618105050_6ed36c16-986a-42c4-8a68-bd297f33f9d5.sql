
-- 1. ajustes_mensais: drop both broad ALL, add per-command with financeiro permission
DROP POLICY IF EXISTS "Empresa isolada" ON public.ajustes_mensais;
DROP POLICY IF EXISTS "tenant_isolation" ON public.ajustes_mensais;
CREATE POLICY "perm_ajustes_mensais_select" ON public.ajustes_mensais FOR SELECT TO authenticated
  USING (empresa_id = get_my_empresa_id() AND (is_admin_user(auth.uid()) OR has_permissao('financeiro','ver')));
CREATE POLICY "perm_ajustes_mensais_insert" ON public.ajustes_mensais FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND (is_admin_user(auth.uid()) OR has_permissao('financeiro','editar')));
CREATE POLICY "perm_ajustes_mensais_update" ON public.ajustes_mensais FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND (is_admin_user(auth.uid()) OR has_permissao('financeiro','editar')))
  WITH CHECK (empresa_id = get_my_empresa_id() AND (is_admin_user(auth.uid()) OR has_permissao('financeiro','editar')));
CREATE POLICY "perm_ajustes_mensais_delete" ON public.ajustes_mensais FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND (is_admin_user(auth.uid()) OR has_permissao('financeiro','excluir')));

-- 2. auditoria_falhas: admin-only
DROP POLICY IF EXISTS "Empresa isolada" ON public.auditoria_falhas;
DROP POLICY IF EXISTS "tenant_isolation" ON public.auditoria_falhas;
CREATE POLICY "auditoria_falhas_admin_select" ON public.auditoria_falhas FOR SELECT TO authenticated
  USING ((empresa_id IS NULL OR empresa_id = get_my_empresa_id()) AND is_admin_user(auth.uid()));
CREATE POLICY "auditoria_falhas_insert" ON public.auditoria_falhas FOR INSERT TO authenticated
  WITH CHECK (empresa_id IS NULL OR empresa_id = get_my_empresa_id());

-- 3. clientes: drop tenant_isolation (Empresa isolada + lojista_read_own_clientes remain)
DROP POLICY IF EXISTS "tenant_isolation" ON public.clientes;

-- 4. empresa_plano: drop both broad ALL, restrict writes to admin
DROP POLICY IF EXISTS "empresa_plano_tenant" ON public.empresa_plano;
DROP POLICY IF EXISTS "tenant_isolation" ON public.empresa_plano;
CREATE POLICY "empresa_plano_select" ON public.empresa_plano FOR SELECT TO authenticated
  USING (empresa_id = get_my_empresa_id());
CREATE POLICY "empresa_plano_admin_write" ON public.empresa_plano FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));
CREATE POLICY "empresa_plano_admin_update" ON public.empresa_plano FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()))
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));
CREATE POLICY "empresa_plano_admin_delete" ON public.empresa_plano FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));

-- 5. estoque: drop duplicate (only one broad ALL kept; no perm_* exists, so single ALL is OK)
DROP POLICY IF EXISTS "Empresa isolada" ON public.estoque;

-- 6. garantias: drop tenant_isolation (Empresa isolada garantias + lojista_read_garantias remain)
DROP POLICY IF EXISTS "tenant_isolation" ON public.garantias;

-- 7. loja_aparelhos: drop redundant public-role ALL
DROP POLICY IF EXISTS "loja_aparelhos_all" ON public.loja_aparelhos;

-- 8. notificacoes: restrict INSERT user_id to self or null
DROP POLICY IF EXISTS "notif_insert_tenant" ON public.notificacoes;
CREATE POLICY "notif_insert_self" ON public.notificacoes FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND (user_id IS NULL OR user_id = auth.uid()));

-- 9. os_auditoria: drop tenant_isolation ALL (immutable audit; insert+select only)
DROP POLICY IF EXISTS "tenant_isolation" ON public.os_auditoria;

-- 10. os_checklist_saida: drop broad ALL
DROP POLICY IF EXISTS "os_checklist_saida_tenant" ON public.os_checklist_saida;

-- 11. os_fotos: drop broad ALL
DROP POLICY IF EXISTS "os_fotos_tenant" ON public.os_fotos;

-- 12. os_servicos: drop broad ALL
DROP POLICY IF EXISTS "Empresa isolada" ON public.os_servicos;

-- 13. retiradas_socios: drop broad ALL, restrict writes to admin/sócio
DROP POLICY IF EXISTS "tenant_isolation" ON public.retiradas_socios;
CREATE POLICY "retiradas_insert_socio" ON public.retiradas_socios FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());
CREATE POLICY "retiradas_update_socio" ON public.retiradas_socios FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_adm_ou_socio())
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_adm_ou_socio());
CREATE POLICY "retiradas_delete_admin" ON public.retiradas_socios FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));
