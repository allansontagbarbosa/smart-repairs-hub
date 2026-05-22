CREATE OR REPLACE FUNCTION public.test_consistencia_financeira()
 RETURNS TABLE(teste text, resultado text, detalhes jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inicio date := date_trunc('month', current_date)::date;
  v_fim date := current_date;
  v_empresa_id uuid;
  v_dre jsonb;
  v_painel jsonb;
  v_tol numeric := 0.5;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_empresa_id IS NULL THEN
    SELECT empresa_id INTO v_empresa_id FROM socios WHERE deleted_at IS NULL AND ativo = true LIMIT 1;
  END IF;

  v_dre := public.get_dre_periodo(v_inicio, v_fim, v_empresa_id);
  v_painel := public.get_painel_socio_v1();

  RETURN QUERY SELECT 'Faturamento Painel = DRE'::text,
    CASE WHEN abs((v_painel->'mes_atual'->>'faturamento')::numeric - (v_dre->'receitas'->>'bruta')::numeric) < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('painel', v_painel->'mes_atual'->>'faturamento', 'dre', v_dre->'receitas'->>'bruta');

  RETURN QUERY SELECT 'Custo peças Painel = DRE'::text,
    CASE WHEN abs((v_painel->'mes_atual'->>'custo_pecas')::numeric - (v_dre->'custos'->>'pecas')::numeric) < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('painel', v_painel->'mes_atual'->>'custo_pecas', 'dre', v_dre->'custos'->>'pecas');

  RETURN QUERY SELECT 'Comissões Painel = DRE'::text,
    CASE WHEN abs((v_painel->'mes_atual'->>'comissoes')::numeric - (v_dre->'custos'->>'comissoes')::numeric) < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('painel', v_painel->'mes_atual'->>'comissoes', 'dre', v_dre->'custos'->>'comissoes');

  RETURN QUERY SELECT 'Lucro líquido Painel = DRE'::text,
    CASE WHEN abs((v_painel->'mes_atual'->>'lucro_liquido')::numeric - (v_dre->'resultado'->>'lucro_liquido')::numeric) < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('painel', v_painel->'mes_atual'->>'lucro_liquido', 'dre', v_dre->'resultado'->>'lucro_liquido');

  RETURN QUERY SELECT 'Distribuível Painel = DRE'::text,
    CASE WHEN abs((v_painel->'mes_atual'->>'distribuivel')::numeric - (v_dre->'distribuicao'->>'distribuivel')::numeric) < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('painel', v_painel->'mes_atual'->>'distribuivel', 'dre', v_dre->'distribuicao'->>'distribuivel');

  RETURN QUERY
  WITH cp_por_mes AS (
    SELECT to_char(cp.data_vencimento, 'YYYY-MM') AS mes,
           SUM(cp.valor) AS cp_total
      FROM contas_a_pagar cp
     WHERE cp.empresa_id = v_empresa_id
       AND cp.categoria = 'Comissões'
       AND cp.deleted_at IS NULL
       AND COALESCE(cp.descricao,'') !~* 'extra|b[oô]nus|adicional'
     GROUP BY 1
  ),
  com_por_mes AS (
    SELECT mes_competencia AS mes, COALESCE(SUM(valor),0) AS com_total
      FROM comissoes
     WHERE empresa_id = v_empresa_id
       AND status != 'estornada'
     GROUP BY 1
  ),
  dup AS (
    SELECT cp.mes, cp.cp_total, c.com_total
      FROM cp_por_mes cp
      JOIN com_por_mes c ON c.mes = cp.mes
     WHERE c.com_total > 0
  )
  SELECT 'Comissões NÃO duplicadas cp vs comissoes'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('detalhes', COALESCE(jsonb_agg(jsonb_build_object(
      'mes', mes, 'cp', cp_total, 'comissoes_auto', com_total)), '[]'::jsonb))
  FROM dup;
END;
$function$;