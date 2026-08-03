-- 1. Unique index needed by admin.processar_evento_assinatura ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS assinaturas_stripe_subscription_key
  ON admin.assinaturas (stripe_subscription_id);

-- 2. Rewrite calc_meta_retorno_cliente (ordens_de_servico has no cliente_id; client comes via aparelhos)
CREATE OR REPLACE FUNCTION public.calc_meta_retorno_cliente(p_inicio date, p_fim date, p_escopo text, p_escopo_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_total numeric; v_retornou numeric;
BEGIN
  WITH clientes_periodo AS (
    SELECT a.cliente_id AS cliente_id, MIN(o.data_conclusao) AS primeira_conclusao
    FROM ordens_de_servico o
    JOIN aparelhos a ON a.id = o.aparelho_id
    WHERE o.empresa_id = public.get_my_empresa_id() AND o.deleted_at IS NULL
      AND o.data_conclusao IS NOT NULL
      AND a.cliente_id IS NOT NULL
      AND o.data_conclusao::date BETWEEN p_inicio AND p_fim
      AND (p_escopo = 'empresa' OR (p_escopo = 'loja' AND o.loja_id = p_escopo_id))
    GROUP BY a.cliente_id
  )
  SELECT
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM ordens_de_servico o2
      JOIN aparelhos a2 ON a2.id = o2.aparelho_id
      WHERE a2.cliente_id = clientes_periodo.cliente_id AND o2.deleted_at IS NULL
        AND o2.data_entrada > clientes_periodo.primeira_conclusao
        AND o2.data_entrada - clientes_periodo.primeira_conclusao < interval '30 days'
    ))::numeric,
    COUNT(*)::numeric
    INTO v_retornou, v_total
  FROM clientes_periodo;
  RETURN CASE WHEN v_total > 0 THEN (v_retornou / v_total) * 100 ELSE 0 END;
END;
$function$;

-- 3. Targeted textual fixes on the remaining broken functions
DO $mig$
DECLARE
  r record;
  d text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public','calc_meta_aprovacao_orcamento', '''cancelada''', '''cancelado'''),
    ('public','combo_dashboard_kpis', 'status = ''concluida''', 'status IN (''pronto'',''entregue'')'),
    ('public','listar_prejuizos', 'u_created.nome,', 'u_created.nome_exibicao,'),
    ('public','processar_notificacoes_diarias', 'o.data_pronto', 'o.data_conclusao'),
    ('public','pagar_movimentacoes', E'\n         SET status = ''pago'',', E'\n         SET status = ''paga'','),
    ('public','pagar_movimentacoes', 'AND status <> ''pago''', 'AND status <> ''paga'''),
    ('public','revogar_usuario', 'auth.refresh_tokens WHERE user_id = v_profile.user_id', 'auth.refresh_tokens WHERE user_id = v_profile.user_id::text'),
    ('public','rh_fin_reconciliar', 'public.is_adm()', 'public.is_adm_ou_socio()'),
    ('public','coletar_dados_backup', 'FROM fornecedores WHERE empresa_id = p_empresa_id AND deleted_at IS NULL', 'FROM fornecedores WHERE empresa_id = p_empresa_id'),
    ('public','catalogo_login', 'WHERE acesso_id = v_acesso.id', 'WHERE atacado_catalogo_credenciais.acesso_id = v_acesso.id'),
    ('public','gerar_folha_mensal_completa', 'm.tipo::text = ''vt''', 'm.tipo::text = ''vale_transporte'''),
    ('public','gerar_folha_mensal_completa', 'm.tipo::text = ''va''', 'm.tipo::text = ''vale_alimentacao'''),
    ('public','gerar_folha_mensal_completa', '''vt'', ''VT ''', '''vale_transporte'', ''VT '''),
    ('public','gerar_folha_mensal_completa', '''va'', ''VA ''', '''vale_alimentacao'', ''VA '''),
    ('public','fechar_mes_distribuicao', '(%.2f%%)', '(%s%%)'),
    ('public','fechar_mes_distribuicao', '%.2f%% sobre', '%s%% sobre'),
    ('public','ia_agregar_aparelhos_periodo', 'extensions.unaccent(', 'public.unaccent('),
    ('public','ia_top_defeitos_periodo', 'extensions.unaccent(', 'public.unaccent('),
    ('public','atacado_performance_vendedores', E'\nBEGIN\n  p_empresa_id', E'\n#variable_conflict use_column\nBEGIN\n  p_empresa_id')
  ) AS t(sch, fn, frm, rep) LOOP
    FOR d IN
      SELECT pg_get_functiondef(p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = r.sch AND p.proname = r.fn AND p.prokind = 'f'
    LOOP
      IF position(r.frm in d) = 0 THEN
        RAISE EXCEPTION 'padrao nao encontrado em %.%: %', r.sch, r.fn, r.frm;
      END IF;
      EXECUTE replace(d, r.frm, r.rep);
    END LOOP;
  END LOOP;
END $mig$;