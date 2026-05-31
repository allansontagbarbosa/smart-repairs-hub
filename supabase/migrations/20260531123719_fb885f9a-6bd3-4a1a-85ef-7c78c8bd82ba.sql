CREATE OR REPLACE FUNCTION public.atacado_dashboard_kpis(
  p_empresa_id UUID,
  p_inicio DATE,
  p_fim DATE
)
RETURNS TABLE (
  faturamento NUMERIC,
  qtd_pedidos BIGINT,
  ticket_medio NUMERIC,
  pedidos_aguardando BIGINT,
  boletos_vencidos BIGINT,
  valor_inadimplencia NUMERIC,
  clientes_ativos BIGINT,
  clientes_bloqueados BIGINT,
  novos_clientes_mes BIGINT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fat NUMERIC := 0;
  v_qtd BIGINT := 0;
BEGIN
  SELECT COALESCE(SUM(total), 0), COUNT(*) INTO v_fat, v_qtd
  FROM atacado_pedidos
  WHERE empresa_id = p_empresa_id
    AND status IN ('faturado', 'entregue')
    AND created_at::DATE BETWEEN p_inicio AND p_fim
    AND deleted_at IS NULL;

  RETURN QUERY SELECT
    v_fat,
    v_qtd,
    CASE WHEN v_qtd > 0 THEN v_fat / v_qtd ELSE 0 END,
    (SELECT COUNT(*) FROM atacado_pedidos
     WHERE empresa_id = p_empresa_id
       AND status = 'aguardando_aprovacao'
       AND deleted_at IS NULL),
    (SELECT COUNT(*) FROM atacado_pedidos_pagamentos pp
     JOIN atacado_pedidos p ON p.id = pp.pedido_id
     WHERE p.empresa_id = p_empresa_id
       AND pp.status IN ('aberto', 'atrasado')
       AND pp.vencimento < CURRENT_DATE),
    (SELECT COALESCE(SUM(pp.valor), 0) FROM atacado_pedidos_pagamentos pp
     JOIN atacado_pedidos p ON p.id = pp.pedido_id
     WHERE p.empresa_id = p_empresa_id
       AND pp.status IN ('aberto', 'atrasado')
       AND pp.vencimento < CURRENT_DATE),
    (SELECT COUNT(*) FROM atacado_clientes
     WHERE empresa_id = p_empresa_id AND status = 'ativo' AND deleted_at IS NULL),
    (SELECT COUNT(*) FROM atacado_clientes
     WHERE empresa_id = p_empresa_id AND status = 'bloqueado' AND deleted_at IS NULL),
    (SELECT COUNT(*) FROM atacado_clientes
     WHERE empresa_id = p_empresa_id
       AND created_at::DATE BETWEEN p_inicio AND p_fim
       AND deleted_at IS NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.atacado_dashboard_kpis(UUID, DATE, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.atacado_top_clientes(
  p_empresa_id UUID,
  p_inicio DATE,
  p_fim DATE,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  cliente_id UUID,
  razao_social TEXT,
  nome_fantasia TEXT,
  qtd_pedidos BIGINT,
  faturamento NUMERIC
) LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id,
    c.razao_social,
    c.nome_fantasia,
    COUNT(p.id),
    COALESCE(SUM(p.total), 0)
  FROM atacado_clientes c
  JOIN atacado_pedidos p ON p.cliente_id = c.id
  WHERE c.empresa_id = p_empresa_id
    AND p.empresa_id = p_empresa_id
    AND p.status IN ('faturado', 'entregue')
    AND p.created_at::DATE BETWEEN p_inicio AND p_fim
    AND p.deleted_at IS NULL
    AND c.deleted_at IS NULL
  GROUP BY c.id, c.razao_social, c.nome_fantasia
  ORDER BY COALESCE(SUM(p.total), 0) DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.atacado_top_clientes(UUID, DATE, DATE, INT) TO authenticated;