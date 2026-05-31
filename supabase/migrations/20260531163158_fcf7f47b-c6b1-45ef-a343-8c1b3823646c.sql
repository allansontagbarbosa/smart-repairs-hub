
CREATE OR REPLACE FUNCTION public.atacado_performance_vendedores(
  p_empresa_id UUID,
  p_inicio DATE,
  p_fim DATE
)
RETURNS TABLE (
  vendedor_id UUID,
  nome TEXT,
  qtd_pedidos BIGINT,
  faturamento NUMERIC,
  ticket_medio NUMERIC,
  novos_clientes BIGINT,
  comissao_estimada NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH ped AS (
    SELECT vendedor_id, COUNT(*)::BIGINT AS qtd, COALESCE(SUM(total),0) AS fat
    FROM public.atacado_pedidos
    WHERE empresa_id = p_empresa_id
      AND created_at::DATE BETWEEN p_inicio AND p_fim
      AND status IN ('faturado','entregue')
      AND deleted_at IS NULL
      AND vendedor_id IS NOT NULL
    GROUP BY vendedor_id
  ),
  novos AS (
    SELECT vendedor_responsavel_id AS vendedor_id, COUNT(*)::BIGINT AS qtd
    FROM public.atacado_clientes
    WHERE empresa_id = p_empresa_id
      AND created_at::DATE BETWEEN p_inicio AND p_fim
      AND deleted_at IS NULL
      AND vendedor_responsavel_id IS NOT NULL
    GROUP BY vendedor_responsavel_id
  )
  SELECT
    f.id,
    f.nome,
    COALESCE(p.qtd, 0),
    COALESCE(p.fat, 0),
    CASE WHEN COALESCE(p.qtd,0) > 0 THEN p.fat / p.qtd ELSE 0 END,
    COALESCE(n.qtd, 0),
    COALESCE(p.fat, 0) * COALESCE(c.pct_padrao, 2) / 100
  FROM public.funcionarios f
  LEFT JOIN ped p ON p.vendedor_id = f.id
  LEFT JOIN novos n ON n.vendedor_id = f.id
  LEFT JOIN public.atacado_comissoes c
    ON c.vendedor_id = f.id AND c.empresa_id = p_empresa_id AND c.ativa
  WHERE f.empresa_id = p_empresa_id
    AND (
      EXISTS (SELECT 1 FROM public.atacado_pedidos ap WHERE ap.vendedor_id = f.id AND ap.empresa_id = p_empresa_id)
      OR EXISTS (SELECT 1 FROM public.atacado_clientes ac WHERE ac.vendedor_responsavel_id = f.id AND ac.empresa_id = p_empresa_id)
      OR EXISTS (SELECT 1 FROM public.atacado_comissoes ac2 WHERE ac2.vendedor_id = f.id AND ac2.empresa_id = p_empresa_id)
    )
  ORDER BY COALESCE(p.fat, 0) DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.atacado_performance_vendedores(UUID, DATE, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.atacado_progresso_metas(
  p_empresa_id UUID,
  p_ano INT,
  p_mes INT
)
RETURNS TABLE (
  meta_id UUID,
  tipo TEXT,
  valor_meta NUMERIC,
  valor_realizado NUMERIC,
  pct_atingido NUMERIC,
  bonus_atingir NUMERIC,
  super_bonus_acima NUMERIC,
  fechada BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inicio DATE := MAKE_DATE(p_ano, p_mes, 1);
  v_fim DATE := (v_inicio + INTERVAL '1 month')::DATE;
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.tipo,
    m.valor_meta,
    CASE m.tipo
      WHEN 'faturamento' THEN COALESCE((
        SELECT SUM(total) FROM public.atacado_pedidos
        WHERE empresa_id = p_empresa_id
          AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim
          AND status IN ('faturado','entregue') AND deleted_at IS NULL), 0)
      WHEN 'qtd_pedidos' THEN COALESCE((
        SELECT COUNT(*)::NUMERIC FROM public.atacado_pedidos
        WHERE empresa_id = p_empresa_id
          AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim
          AND status IN ('faturado','entregue') AND deleted_at IS NULL), 0)
      WHEN 'ticket_medio' THEN COALESCE((
        SELECT AVG(total) FROM public.atacado_pedidos
        WHERE empresa_id = p_empresa_id
          AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim
          AND status IN ('faturado','entregue') AND deleted_at IS NULL), 0)
      WHEN 'novos_clientes' THEN COALESCE((
        SELECT COUNT(*)::NUMERIC FROM public.atacado_clientes
        WHERE empresa_id = p_empresa_id
          AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim
          AND deleted_at IS NULL), 0)
      ELSE 0
    END AS valor_realizado,
    CASE
      WHEN COALESCE(m.valor_meta, 0) = 0 THEN 0
      ELSE (
        CASE m.tipo
          WHEN 'faturamento' THEN COALESCE((SELECT SUM(total) FROM public.atacado_pedidos WHERE empresa_id = p_empresa_id AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim AND status IN ('faturado','entregue') AND deleted_at IS NULL), 0)
          WHEN 'qtd_pedidos' THEN COALESCE((SELECT COUNT(*)::NUMERIC FROM public.atacado_pedidos WHERE empresa_id = p_empresa_id AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim AND status IN ('faturado','entregue') AND deleted_at IS NULL), 0)
          WHEN 'ticket_medio' THEN COALESCE((SELECT AVG(total) FROM public.atacado_pedidos WHERE empresa_id = p_empresa_id AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim AND status IN ('faturado','entregue') AND deleted_at IS NULL), 0)
          WHEN 'novos_clientes' THEN COALESCE((SELECT COUNT(*)::NUMERIC FROM public.atacado_clientes WHERE empresa_id = p_empresa_id AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim AND deleted_at IS NULL), 0)
          ELSE 0
        END / m.valor_meta * 100
      )
    END AS pct_atingido,
    m.bonus_atingir,
    m.super_bonus_acima,
    m.fechada
  FROM public.atacado_metas m
  WHERE m.empresa_id = p_empresa_id
    AND m.competencia_ano = p_ano
    AND m.competencia_mes = p_mes;
END;
$$;
GRANT EXECUTE ON FUNCTION public.atacado_progresso_metas(UUID, INT, INT) TO authenticated;
