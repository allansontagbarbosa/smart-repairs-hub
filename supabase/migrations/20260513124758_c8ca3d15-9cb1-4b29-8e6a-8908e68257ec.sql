CREATE OR REPLACE FUNCTION public.tv_get_painel_data(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_painel record;
  v_empresa_nome text;
  v_hoje date := CURRENT_DATE;
  v_inicio_mes date := date_trunc('month', CURRENT_DATE)::date;
  v_kpis jsonb;
  v_podio jsonb;
  v_aparelhos_tecnicos jsonb;
  v_alertas jsonb;
  v_meta jsonb;
  v_top_lojistas jsonb;
BEGIN
  SELECT * INTO v_painel FROM tv_paineis
  WHERE codigo = p_codigo AND ativo = true;

  IF v_painel IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código inválido');
  END IF;

  UPDATE tv_paineis SET ultimo_acesso_em = now() WHERE id = v_painel.id;

  SELECT nome INTO v_empresa_nome FROM empresas WHERE id = v_painel.empresa_id;

  -- KPIs
  SELECT jsonb_build_object(
    'oss_hoje', (
      SELECT COUNT(*) FROM ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id
        AND status = 'entregue' AND deleted_at IS NULL
        AND data_entrega::date = v_hoje
    ),
    'aparelhos_abertos', (
      SELECT COUNT(*) FROM ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id
        AND status NOT IN ('entregue','cancelada') AND deleted_at IS NULL
    ),
    'faturamento_hoje', COALESCE((
      SELECT SUM(valor_total) FROM ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id
        AND status = 'entregue' AND deleted_at IS NULL
        AND data_entrega::date = v_hoje
    ), 0),
    'faturamento_mes', COALESCE((
      SELECT SUM(valor_total) FROM ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id
        AND status = 'entregue' AND deleted_at IS NULL
        AND data_entrega::date >= v_inicio_mes
    ), 0),
    'prontos_retirar', (
      SELECT COUNT(*) FROM ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id
        AND status = 'pronto' AND deleted_at IS NULL
    )
  ) INTO v_kpis;

  -- Pódio do mês (top 3 técnicos por OS entregues)
  SELECT jsonb_agg(jsonb_build_object(
    'nome', t.nome,
    'oss', t.qtd_oss,
    'comissao', t.total_comissao
  ) ORDER BY t.qtd_oss DESC) INTO v_podio
  FROM (
    SELECT f.nome, COUNT(o.id) AS qtd_oss,
           COALESCE(SUM(c.valor), 0) AS total_comissao
    FROM funcionarios f
    LEFT JOIN ordens_de_servico o
      ON o.funcionario_id = f.id
      AND o.status = 'entregue' AND o.deleted_at IS NULL
      AND o.data_entrega::date >= v_inicio_mes
    LEFT JOIN comissoes c
      ON c.funcionario_id = f.id
      AND c.mes_competencia = to_char(v_hoje, 'YYYY-MM')
    WHERE f.empresa_id = v_painel.empresa_id
    GROUP BY f.id, f.nome
    ORDER BY qtd_oss DESC
    LIMIT 3
  ) t;

  -- Aparelhos por técnico
  SELECT jsonb_agg(jsonb_build_object('nome', t.nome, 'qtd', t.qtd) ORDER BY t.qtd DESC)
  INTO v_aparelhos_tecnicos
  FROM (
    SELECT f.nome, COUNT(o.id) AS qtd
    FROM funcionarios f
    LEFT JOIN ordens_de_servico o
      ON o.funcionario_id = f.id
      AND o.status NOT IN ('entregue','cancelada') AND o.deleted_at IS NULL
    WHERE f.empresa_id = v_painel.empresa_id
    GROUP BY f.id, f.nome
    HAVING COUNT(o.id) > 0
    ORDER BY qtd DESC
    LIMIT 8
  ) t;

  -- Alertas
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
        AND quantidade <= quantidade_minima
    )
  ) INTO v_alertas;

  -- Meta do mês
  SELECT jsonb_build_object(
    'meta_valor', COALESCE(meta_faturamento, 0),
    'atual_valor', COALESCE((
      SELECT SUM(valor_total) FROM ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id
        AND status = 'entregue' AND deleted_at IS NULL
        AND data_entrega::date >= v_inicio_mes
    ), 0),
    'pct', CASE WHEN COALESCE(meta_faturamento, 0) > 0
      THEN LEAST(100, ROUND((COALESCE((
        SELECT SUM(valor_total) FROM ordens_de_servico
        WHERE empresa_id = v_painel.empresa_id
          AND status = 'entregue' AND deleted_at IS NULL
          AND data_entrega::date >= v_inicio_mes
      ), 0) / meta_faturamento) * 100))
      ELSE 0 END
  ) INTO v_meta
  FROM equipe_metas
  WHERE empresa_id = v_painel.empresa_id
    AND ano = EXTRACT(YEAR FROM v_hoje)::int
    AND mes = EXTRACT(MONTH FROM v_hoje)::int
  LIMIT 1;

  IF v_meta IS NULL THEN
    v_meta := jsonb_build_object('meta_valor', 0, 'atual_valor', 0, 'pct', 0);
  END IF;

  -- Top lojistas com saldo
  SELECT jsonb_agg(jsonb_build_object('nome', l.nome, 'saldo', l.saldo) ORDER BY l.saldo DESC)
  INTO v_top_lojistas
  FROM (
    SELECT c.nome, COALESCE(SUM(o.valor_total), 0) AS saldo
    FROM clientes c
    JOIN ordens_de_servico o ON o.lojista_id = c.id
    WHERE c.empresa_id = v_painel.empresa_id
      AND o.status = 'entregue' AND o.deleted_at IS NULL
    GROUP BY c.id, c.nome
    HAVING COALESCE(SUM(o.valor_total), 0) > 0
    ORDER BY saldo DESC
    LIMIT 5
  ) l;

  RETURN jsonb_build_object(
    'success', true,
    'painel', jsonb_build_object(
      'id', v_painel.id,
      'nome', v_painel.nome,
      'tema', v_painel.tema,
      'orientacao', v_painel.orientacao,
      'widgets', v_painel.widgets,
      'layout', COALESCE(v_painel.layout, '[]'::jsonb),
      'logo_url', v_painel.logo_url,
      'tamanho_fonte', COALESCE(v_painel.tamanho_fonte, 'M'),
      'intervalo_refresh', v_painel.intervalo_refresh_segundos,
      'empresa_nome', v_empresa_nome
    ),
    'dados', jsonb_build_object(
      'kpis', v_kpis,
      'podio', COALESCE(v_podio, '[]'::jsonb),
      'aparelhos_tecnicos', COALESCE(v_aparelhos_tecnicos, '[]'::jsonb),
      'alertas', v_alertas,
      'meta', v_meta,
      'top_lojistas', COALESCE(v_top_lojistas, '[]'::jsonb)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tv_get_painel_data TO anon, authenticated;