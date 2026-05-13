CREATE OR REPLACE FUNCTION public.tv_get_painel_data(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_painel record;
  v_empresa_nome text;
  v_kpis jsonb;
  v_podio jsonb;
  v_meta jsonb;
  v_aparelhos jsonb;
  v_alertas jsonb;
  v_lojistas jsonb;
  v_hoje date := CURRENT_DATE;
  v_inicio_mes date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  SELECT * INTO v_painel FROM tv_paineis 
  WHERE codigo = p_codigo AND ativo = true LIMIT 1;
  
  IF v_painel IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código inválido');
  END IF;
  
  UPDATE tv_paineis SET ultimo_acesso_em = now() WHERE id = v_painel.id;
  
  SELECT nome INTO v_empresa_nome FROM empresas WHERE id = v_painel.empresa_id;
  
  SELECT jsonb_build_object(
    'oss_hoje', (
      SELECT COUNT(*) FROM ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id 
        AND status = 'entregue' AND deleted_at IS NULL
        AND data_entrega::date = v_hoje
    ),
    'faturamento_hoje', (
      SELECT COALESCE(SUM(COALESCE(valor_total, valor, 0)), 0) FROM ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id 
        AND status = 'entregue' AND deleted_at IS NULL
        AND data_entrega::date = v_hoje
    ),
    'faturamento_mes', (
      SELECT COALESCE(SUM(COALESCE(valor_total, valor, 0)), 0) FROM ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id 
        AND status = 'entregue' AND deleted_at IS NULL
        AND data_entrega >= v_inicio_mes
    ),
    'aparelhos_abertos', (
      SELECT COUNT(*) FROM ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id 
        AND status NOT IN ('entregue', 'cancelado') AND deleted_at IS NULL
    ),
    'prontos_retirar', (
      SELECT COUNT(*) FROM ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id 
        AND status = 'pronto' AND deleted_at IS NULL
    )
  ) INTO v_kpis;
  
  SELECT jsonb_agg(jsonb_build_object(
    'nome', t.nome,
    'oss', t.qtd_oss,
    'comissao', t.total_comissao
  ) ORDER BY t.qtd_oss DESC) INTO v_podio
  FROM (
    SELECT 
      f.nome,
      COUNT(*) as qtd_oss,
      SUM(c.valor) as total_comissao
    FROM comissoes c
    JOIN funcionarios f ON f.id = c.funcionario_id
    WHERE c.empresa_id = v_painel.empresa_id
      AND c.mes_competencia = to_char(v_hoje, 'YYYY-MM')
      AND c.estornada_em IS NULL
    GROUP BY f.id, f.nome
    ORDER BY qtd_oss DESC
    LIMIT 3
  ) t;
  
  SELECT jsonb_build_object(
    'meta_valor', 130000,
    'atual_valor', COALESCE((
      SELECT SUM(COALESCE(valor_total, valor, 0)) FROM ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id 
        AND status = 'entregue' AND deleted_at IS NULL
        AND data_entrega >= v_inicio_mes
    ), 0),
    'pct', LEAST(100, (COALESCE((
      SELECT SUM(COALESCE(valor_total, valor, 0)) FROM ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id 
        AND status = 'entregue' AND deleted_at IS NULL
        AND data_entrega >= v_inicio_mes
    ), 0) / 130000.0 * 100)::int)
  ) INTO v_meta;
  
  SELECT jsonb_agg(jsonb_build_object(
    'nome', t.nome,
    'qtd', t.qtd
  ) ORDER BY t.qtd DESC) INTO v_aparelhos
  FROM (
    SELECT 
      f.nome,
      COUNT(*) as qtd
    FROM ordens_de_servico os
    JOIN funcionarios f ON f.id = os.funcionario_id
    WHERE os.empresa_id = v_painel.empresa_id
      AND os.status NOT IN ('entregue', 'cancelado')
      AND os.deleted_at IS NULL
      AND os.funcionario_id IS NOT NULL
    GROUP BY f.id, f.nome
    ORDER BY qtd DESC
    LIMIT 8
  ) t;
  
  SELECT jsonb_build_object(
    'prontas_paradas', (
      SELECT COUNT(*) FROM ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id
        AND status = 'pronto' AND deleted_at IS NULL
        AND updated_at < (now() - interval '7 days')
    ),
    'aguardando_aprovacao_2dias', (
      SELECT COUNT(*) FROM ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id
        AND status = 'aguardando_aprovacao' AND deleted_at IS NULL
        AND updated_at < (now() - interval '2 days')
    ),
    'estoque_baixo', (
      SELECT COUNT(*) FROM estoque_itens
      WHERE empresa_id = v_painel.empresa_id
        AND ativo = true AND deleted_at IS NULL
        AND quantidade <= COALESCE(quantidade_minima, 0)
    )
  ) INTO v_alertas;
  
  SELECT jsonb_agg(jsonb_build_object(
    'nome', t.nome,
    'saldo', t.saldo
  ) ORDER BY t.saldo DESC) INTO v_lojistas
  FROM (
    SELECT 
      c.nome,
      SUM(COALESCE(os.valor_total, os.valor, 0) - COALESCE(os.valor_pago, 0)) as saldo
    FROM clientes c
    JOIN ordens_de_servico os ON os.lojista_id = c.id
    WHERE c.empresa_id = v_painel.empresa_id
      AND os.status = 'entregue'
      AND COALESCE(os.valor_pago, 0) < COALESCE(os.valor_total, os.valor, 0)
      AND os.deleted_at IS NULL
    GROUP BY c.id, c.nome
    HAVING SUM(COALESCE(os.valor_total, os.valor, 0) - COALESCE(os.valor_pago, 0)) > 0
    ORDER BY saldo DESC
    LIMIT 5
  ) t;
  
  RETURN jsonb_build_object(
    'success', true,
    'painel', jsonb_build_object(
      'id', v_painel.id,
      'nome', v_painel.nome,
      'tema', v_painel.tema,
      'orientacao', v_painel.orientacao,
      'widgets', v_painel.widgets,
      'intervalo_refresh', v_painel.intervalo_refresh_segundos,
      'empresa_nome', v_empresa_nome
    ),
    'dados', jsonb_build_object(
      'kpis', v_kpis,
      'podio', COALESCE(v_podio, '[]'::jsonb),
      'meta', v_meta,
      'aparelhos_tecnicos', COALESCE(v_aparelhos, '[]'::jsonb),
      'alertas', v_alertas,
      'top_lojistas', COALESCE(v_lojistas, '[]'::jsonb),
      'gerado_em', now()
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tv_get_painel_data(text) TO anon, authenticated;