-- ia_acoes_log: restrict writes. This table is an AI audit log - inserts should only come from edge functions (service_role bypasses RLS). Block authenticated INSERT/UPDATE/DELETE entirely except admins for deletes.
CREATE POLICY ia_acoes_insert_admin ON public.ia_acoes_log
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));

CREATE POLICY ia_acoes_update_admin ON public.ia_acoes_log
  FOR UPDATE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()))
  WITH CHECK (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));

CREATE POLICY ia_acoes_delete_admin ON public.ia_acoes_log
  FOR DELETE TO authenticated
  USING (empresa_id = get_my_empresa_id() AND is_admin_user(auth.uid()));

-- tabelas_fiscais: restrict writes to admins
CREATE POLICY tabelas_fiscais_admin_insert ON public.tabelas_fiscais
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY tabelas_fiscais_admin_update ON public.tabelas_fiscais
  FOR UPDATE TO authenticated
  USING (is_admin_user(auth.uid()))
  WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY tabelas_fiscais_admin_delete ON public.tabelas_fiscais
  FOR DELETE TO authenticated
  USING (is_admin_user(auth.uid()));