
-- ia_acoes_log: restrict SELECT to admins or the user that ran the action
DROP POLICY IF EXISTS ia_acoes_select ON public.ia_acoes_log;
CREATE POLICY ia_acoes_select_admin_or_owner ON public.ia_acoes_log
  FOR SELECT TO authenticated
  USING (
    empresa_id = get_my_empresa_id()
    AND (is_admin_user(auth.uid()) OR usuario_id = auth.uid())
  );

-- caixa_movimentacoes: restrict SELECT to adm/socio or has_permissao financeiro.ver
DROP POLICY IF EXISTS caixa_mov_select_tenant ON public.caixa_movimentacoes;
CREATE POLICY caixa_mov_select_financeiro ON public.caixa_movimentacoes
  FOR SELECT TO authenticated
  USING (
    empresa_id = get_my_empresa_id()
    AND (is_adm_ou_socio() OR has_permissao('financeiro','ver'))
  );

-- distribuicoes_mensais: restrict SELECT to adm/socio or financeiro.ver
DROP POLICY IF EXISTS distribuicoes_select_tenant ON public.distribuicoes_mensais;
CREATE POLICY distribuicoes_select_financeiro ON public.distribuicoes_mensais
  FOR SELECT TO authenticated
  USING (
    empresa_id = get_my_empresa_id()
    AND (is_adm_ou_socio() OR has_permissao('financeiro','ver'))
  );

-- audit_pagamentos: add INSERT policy scoped to current empresa (append-only audit)
CREATE POLICY audit_pagamentos_insert_tenant ON public.audit_pagamentos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_my_empresa_id());

-- tabelas_fiscais: remove write policies for any admin (no empresa scoping); only service_role writes
DROP POLICY IF EXISTS tabelas_fiscais_admin_insert ON public.tabelas_fiscais;
DROP POLICY IF EXISTS tabelas_fiscais_admin_update ON public.tabelas_fiscais;
DROP POLICY IF EXISTS tabelas_fiscais_admin_delete ON public.tabelas_fiscais;
-- read policy kept (admins can view fiscal tables)
