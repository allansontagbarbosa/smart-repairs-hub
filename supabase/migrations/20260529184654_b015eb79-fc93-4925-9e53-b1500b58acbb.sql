DROP FUNCTION IF EXISTS combo_dashboard_kpis(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION combo_dashboard_kpis(
  p_empresa_id UUID,
  p_inicio DATE,
  p_fim DATE
)
RETURNS TABLE (
  faturamento_loja NUMERIC,
  vendas_loja_qtd BIGINT,
  ticket_loja NUMERIC,
  faturamento_assist NUMERIC,
  os_assist_qtd BIGINT,
  ticket_assist NUMERIC,
  faturamento_total NUMERIC,
  transacoes_total BIGINT,
  faturamento_loja_anterior NUMERIC,
  faturamento_assist_anterior NUMERIC,
  variacao_loja_pct NUMERIC,
  variacao_assist_pct NUMERIC
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dias_periodo INT;
  v_inicio_anterior DATE;
  v_fim_anterior DATE;
  v_loja_atual NUMERIC := 0;
  v_assist_atual NUMERIC := 0;
  v_loja_anterior NUMERIC := 0;
  v_assist_anterior NUMERIC := 0;
  v_loja_qtd BIGINT := 0;
  v_assist_qtd BIGINT := 0;
BEGIN
  v_dias_periodo := (p_fim - p_inicio) + 1;
  v_inicio_anterior := (p_inicio - INTERVAL '1 month')::DATE;
  v_fim_anterior := (v_inicio_anterior + (v_dias_periodo - 1) * INTERVAL '1 day')::DATE;

  SELECT COALESCE(SUM(total), 0), COUNT(*) INTO v_loja_atual, v_loja_qtd
  FROM loja_vendas
  WHERE empresa_id = p_empresa_id AND status = 'pago'
    AND created_at::DATE BETWEEN p_inicio AND p_fim
    AND deleted_at IS NULL;

  SELECT COALESCE(SUM(valor_total), 0), COUNT(*) INTO v_assist_atual, v_assist_qtd
  FROM ordens_de_servico
  WHERE empresa_id = p_empresa_id AND status = 'entregue'
    AND created_at::DATE BETWEEN p_inicio AND p_fim;

  SELECT COALESCE(SUM(total), 0) INTO v_loja_anterior
  FROM loja_vendas
  WHERE empresa_id = p_empresa_id AND status = 'pago'
    AND created_at::DATE BETWEEN v_inicio_anterior AND v_fim_anterior
    AND deleted_at IS NULL;

  SELECT COALESCE(SUM(valor_total), 0) INTO v_assist_anterior
  FROM ordens_de_servico
  WHERE empresa_id = p_empresa_id AND status = 'entregue'
    AND created_at::DATE BETWEEN v_inicio_anterior AND v_fim_anterior;

  RETURN QUERY SELECT
    v_loja_atual,
    v_loja_qtd,
    CASE WHEN v_loja_qtd > 0 THEN v_loja_atual / v_loja_qtd ELSE 0 END,
    v_assist_atual,
    v_assist_qtd,
    CASE WHEN v_assist_qtd > 0 THEN v_assist_atual / v_assist_qtd ELSE 0 END,
    v_loja_atual + v_assist_atual,
    v_loja_qtd + v_assist_qtd,
    v_loja_anterior,
    v_assist_anterior,
    CASE WHEN v_loja_anterior > 0 THEN ((v_loja_atual - v_loja_anterior) / v_loja_anterior) * 100 ELSE 0 END,
    CASE WHEN v_assist_anterior > 0 THEN ((v_assist_atual - v_assist_anterior) / v_assist_anterior) * 100 ELSE 0 END;
END;
$$;

GRANT EXECUTE ON FUNCTION combo_dashboard_kpis(UUID, DATE, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION combo_serie_diaria(
  p_empresa_id UUID,
  p_inicio DATE,
  p_fim DATE
)
RETURNS TABLE (
  dia DATE,
  faturamento_loja NUMERIC,
  faturamento_assist NUMERIC,
  total NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH dias AS (
    SELECT generate_series(p_inicio, p_fim, '1 day'::INTERVAL)::DATE AS dia
  ),
  loja AS (
    SELECT created_at::DATE AS dia, SUM(total) AS valor
    FROM loja_vendas
    WHERE empresa_id = p_empresa_id AND status = 'pago' AND deleted_at IS NULL
      AND created_at::DATE BETWEEN p_inicio AND p_fim
    GROUP BY created_at::DATE
  ),
  assist AS (
    SELECT created_at::DATE AS dia, SUM(valor_total) AS valor
    FROM ordens_de_servico
    WHERE empresa_id = p_empresa_id AND status = 'entregue'
      AND created_at::DATE BETWEEN p_inicio AND p_fim
    GROUP BY created_at::DATE
  )
  SELECT
    d.dia,
    COALESCE(l.valor, 0)::NUMERIC AS faturamento_loja,
    COALESCE(a.valor, 0)::NUMERIC AS faturamento_assist,
    (COALESCE(l.valor, 0) + COALESCE(a.valor, 0))::NUMERIC AS total
  FROM dias d
  LEFT JOIN loja l ON l.dia = d.dia
  LEFT JOIN assist a ON a.dia = d.dia
  ORDER BY d.dia;
$$;

GRANT EXECUTE ON FUNCTION combo_serie_diaria(UUID, DATE, DATE) TO authenticated;