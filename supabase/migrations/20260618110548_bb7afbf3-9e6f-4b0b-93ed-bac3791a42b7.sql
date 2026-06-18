
-- ============ audit_pagamentos ============
DROP POLICY IF EXISTS "tenant_isolation" ON public.audit_pagamentos;
DROP POLICY IF EXISTS "audit_pagamentos_select_empresa" ON public.audit_pagamentos;
CREATE POLICY "audit_pagamentos_select_admin_socio"
  ON public.audit_pagamentos
  FOR SELECT TO authenticated
  USING (empresa_id = get_my_empresa_id() AND (is_admin_user(auth.uid()) OR is_adm_ou_socio()));

-- ============ historico_ordens ============
DROP POLICY IF EXISTS "tenant_isolation" ON public.historico_ordens;

-- ============ ordens_de_servico ============
DROP POLICY IF EXISTS "tenant_isolation" ON public.ordens_de_servico;

-- ============ pecas_utilizadas_lotes ============
DROP POLICY IF EXISTS "tenant_isolation" ON public.pecas_utilizadas_lotes;

-- ============ socios ============
DROP POLICY IF EXISTS "tenant_isolation" ON public.socios;

-- ============ etiqueta_templates ============
DROP POLICY IF EXISTS "tenant_isolation" ON public.etiqueta_templates;
DROP POLICY IF EXISTS "Usuários veem etiquetas da sua empresa" ON public.etiqueta_templates;
DROP POLICY IF EXISTS "Usuários inserem etiquetas da sua empresa" ON public.etiqueta_templates;
DROP POLICY IF EXISTS "Usuários atualizam etiquetas da sua empresa" ON public.etiqueta_templates;
DROP POLICY IF EXISTS "Usuários removem etiquetas da sua empresa" ON public.etiqueta_templates;
CREATE POLICY "etiqueta_templates_tenant"
  ON public.etiqueta_templates
  FOR ALL TO authenticated
  USING (empresa_id = get_my_empresa_id())
  WITH CHECK (empresa_id = get_my_empresa_id());

-- ============ tipos_servico ============
DROP POLICY IF EXISTS "tenant_isolation" ON public.tipos_servico;

-- ============ ia_conversas (role fix) ============
DROP POLICY IF EXISTS "ia_conversas_insert" ON public.ia_conversas;
CREATE POLICY "ia_conversas_insert"
  ON public.ia_conversas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND usuario_id = auth.uid());

-- ============ ia_acoes_log (role fix) ============
DROP POLICY IF EXISTS "tenant_isolation" ON public.ia_acoes_log;
DROP POLICY IF EXISTS "ia_acoes_select" ON public.ia_acoes_log;
CREATE POLICY "ia_acoes_select"
  ON public.ia_acoes_log
  FOR SELECT TO authenticated
  USING (empresa_id = get_my_empresa_id());

-- ============ os_status_historico (role fix + drop broad ALL) ============
DROP POLICY IF EXISTS "tenant_isolation" ON public.os_status_historico;
DROP POLICY IF EXISTS "os_status_historico_select" ON public.os_status_historico;
DROP POLICY IF EXISTS "os_status_historico_insert" ON public.os_status_historico;
CREATE POLICY "os_status_historico_select"
  ON public.os_status_historico
  FOR SELECT TO authenticated
  USING (empresa_id = get_my_empresa_id());
CREATE POLICY "os_status_historico_insert"
  ON public.os_status_historico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id());

-- ============ notificacoes (impersonation fix) ============
DROP POLICY IF EXISTS "notif_insert_self" ON public.notificacoes;
CREATE POLICY "notif_insert_self"
  ON public.notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id() AND user_id = auth.uid());
