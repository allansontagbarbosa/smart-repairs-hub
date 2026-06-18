
-- 1) Remover política PERMISSIVE duplicada "Empresa isolada" em tabelas-catálogo
DO $$
DECLARE
  t text;
  tabs text[] := ARRAY[
    'cores','modelos','capacidades','marcas','templates_mensagem','perfis_acesso',
    'modelos_documento','status_ordem_servico','categorias_sistema','formas_pagamento',
    'categorias_financeiras','centros_custo','estoque_categorias','servico_pecas',
    'produtos_base','listas_preco_itens'
  ];
BEGIN
  FOREACH t IN ARRAY tabs LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Empresa isolada" ON public.%I', t);
  END LOOP;
END $$;

-- 2) aprovacoes_lancamento: policies explícitas de escrita (sócio ativo da empresa da solicitação)
DROP POLICY IF EXISTS socio_insere_aprovacao ON public.aprovacoes_lancamento;
CREATE POLICY socio_insere_aprovacao
  ON public.aprovacoes_lancamento
  FOR INSERT
  TO authenticated
  WITH CHECK (
    solicitacao_id IN (
      SELECT s.id FROM public.solicitacoes_lancamento s
      WHERE s.empresa_id IN (
        SELECT so.empresa_id FROM public.socios so
        WHERE so.user_id = auth.uid() AND so.ativo = true AND so.deleted_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS socio_atualiza_aprovacao ON public.aprovacoes_lancamento;
CREATE POLICY socio_atualiza_aprovacao
  ON public.aprovacoes_lancamento
  FOR UPDATE
  TO authenticated
  USING (
    solicitacao_id IN (
      SELECT s.id FROM public.solicitacoes_lancamento s
      WHERE s.empresa_id IN (
        SELECT so.empresa_id FROM public.socios so
        WHERE so.user_id = auth.uid() AND so.ativo = true AND so.deleted_at IS NULL
      )
    )
  )
  WITH CHECK (
    solicitacao_id IN (
      SELECT s.id FROM public.solicitacoes_lancamento s
      WHERE s.empresa_id IN (
        SELECT so.empresa_id FROM public.socios so
        WHERE so.user_id = auth.uid() AND so.ativo = true AND so.deleted_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS admin_deleta_aprovacao ON public.aprovacoes_lancamento;
CREATE POLICY admin_deleta_aprovacao
  ON public.aprovacoes_lancamento
  FOR DELETE
  TO authenticated
  USING (
    is_admin_user(auth.uid())
    AND solicitacao_id IN (
      SELECT s.id FROM public.solicitacoes_lancamento s
      WHERE s.empresa_id = get_my_empresa_id()
    )
  );

-- 3) atacado_catalogo_acessos: revoga acesso da coluna senha_hash p/ roles do app
REVOKE SELECT (senha_hash) ON public.atacado_catalogo_acessos FROM authenticated;
REVOKE SELECT (senha_hash) ON public.atacado_catalogo_acessos FROM anon;
REVOKE UPDATE (senha_hash) ON public.atacado_catalogo_acessos FROM authenticated;
REVOKE UPDATE (senha_hash) ON public.atacado_catalogo_acessos FROM anon;
-- service_role mantém acesso total (usado pela edge function de login do portal)
GRANT SELECT, UPDATE ON public.atacado_catalogo_acessos TO service_role;
