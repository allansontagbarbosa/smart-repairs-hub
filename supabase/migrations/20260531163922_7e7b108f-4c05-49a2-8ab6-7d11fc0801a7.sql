
CREATE OR REPLACE FUNCTION atacado_dre(p_empresa_id UUID, p_inicio DATE, p_fim DATE)
RETURNS TABLE (
  faturamento_bruto NUMERIC, descontos NUMERIC, faturamento_liquido NUMERIC,
  custo_produtos NUMERIC, lucro_bruto NUMERIC, margem_bruta_pct NUMERIC,
  comissoes_estimadas NUMERIC, inadimplencia NUMERIC, resultado_operacional NUMERIC,
  qtd_pedidos BIGINT, ticket_medio NUMERIC
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fat_bruto NUMERIC := 0; v_desc NUMERIC := 0; v_fat_liq NUMERIC := 0;
  v_custo NUMERIC := 0; v_lucro_bruto NUMERIC := 0; v_comissoes NUMERIC := 0;
  v_inadimp NUMERIC := 0; v_qtd BIGINT := 0;
BEGIN
  SELECT COALESCE(SUM(subtotal), 0), COALESCE(SUM(desconto), 0), COUNT(*)
    INTO v_fat_bruto, v_desc, v_qtd
  FROM atacado_pedidos
  WHERE empresa_id = p_empresa_id AND status IN ('faturado', 'entregue')
    AND created_at::DATE BETWEEN p_inicio AND p_fim AND deleted_at IS NULL;
  v_fat_liq := v_fat_bruto - v_desc;

  SELECT COALESCE(SUM(i.quantidade * COALESCE(a.custo, 0)), 0) INTO v_custo
  FROM atacado_pedidos_itens i
  JOIN atacado_pedidos p ON p.id = i.pedido_id
  LEFT JOIN atacado_aparelhos a ON a.id = i.aparelho_id
  WHERE p.empresa_id = p_empresa_id AND p.status IN ('faturado', 'entregue')
    AND p.created_at::DATE BETWEEN p_inicio AND p_fim AND p.deleted_at IS NULL;
  v_lucro_bruto := v_fat_liq - v_custo;

  SELECT COALESCE(SUM(p.total * COALESCE(c.pct_padrao, 2) / 100), 0) INTO v_comissoes
  FROM atacado_pedidos p
  LEFT JOIN atacado_comissoes c ON c.vendedor_id = p.vendedor_id AND c.empresa_id = p_empresa_id AND c.ativa
  WHERE p.empresa_id = p_empresa_id AND p.status IN ('faturado', 'entregue')
    AND p.created_at::DATE BETWEEN p_inicio AND p_fim AND p.deleted_at IS NULL;

  SELECT COALESCE(SUM(pp.valor), 0) INTO v_inadimp
  FROM atacado_pedidos_pagamentos pp
  JOIN atacado_pedidos p ON p.id = pp.pedido_id
  WHERE p.empresa_id = p_empresa_id AND pp.status IN ('aberto', 'atrasado')
    AND pp.vencimento < CURRENT_DATE;

  RETURN QUERY SELECT v_fat_bruto, v_desc, v_fat_liq, v_custo, v_lucro_bruto,
    CASE WHEN v_fat_liq > 0 THEN (v_lucro_bruto / v_fat_liq) * 100 ELSE 0 END,
    v_comissoes, v_inadimp, v_lucro_bruto - v_comissoes, v_qtd,
    CASE WHEN v_qtd > 0 THEN v_fat_liq / v_qtd ELSE 0 END;
END; $$;
GRANT EXECUTE ON FUNCTION atacado_dre(UUID, DATE, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION atacado_ranking_produtos(p_empresa_id UUID, p_inicio DATE, p_fim DATE, p_limit INT DEFAULT 20)
RETURNS TABLE (modelo TEXT, capacidade TEXT, qtd_vendida BIGINT, faturamento NUMERIC, qtd_pedidos BIGINT, preco_medio NUMERIC)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.modelo, i.capacidade, SUM(i.quantidade)::BIGINT, SUM(i.total_item),
    COUNT(DISTINCT p.id)::BIGINT, AVG(i.preco_unitario)
  FROM atacado_pedidos_itens i
  JOIN atacado_pedidos p ON p.id = i.pedido_id
  WHERE p.empresa_id = p_empresa_id AND p.status IN ('faturado', 'entregue')
    AND p.created_at::DATE BETWEEN p_inicio AND p_fim AND p.deleted_at IS NULL
  GROUP BY i.modelo, i.capacidade
  ORDER BY SUM(i.total_item) DESC
  LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION atacado_ranking_produtos(UUID, DATE, DATE, INT) TO authenticated;

CREATE OR REPLACE FUNCTION atacado_giro_estoque(p_empresa_id UUID)
RETURNS TABLE (
  aparelho_id UUID, modelo TEXT, capacidade TEXT, cor TEXT,
  quantidade_atual INT, custo_unitario NUMERIC, valor_imobilizado NUMERIC,
  dias_em_estoque INT, qtd_vendida_30d BIGINT, qtd_vendida_90d BIGINT, classificacao TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.modelo, a.capacidade, a.cor, a.quantidade, a.custo,
    (a.quantidade * a.custo)::NUMERIC,
    GREATEST(0, (CURRENT_DATE - a.data_entrada::DATE))::INT,
    COALESCE((SELECT SUM(i.quantidade)::BIGINT FROM atacado_pedidos_itens i
      JOIN atacado_pedidos p ON p.id = i.pedido_id
      WHERE i.modelo = a.modelo AND (i.capacidade = a.capacidade OR (i.capacidade IS NULL AND a.capacidade IS NULL))
        AND p.empresa_id = p_empresa_id AND p.status IN ('faturado', 'entregue')
        AND p.created_at >= NOW() - INTERVAL '30 days' AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(i.quantidade)::BIGINT FROM atacado_pedidos_itens i
      JOIN atacado_pedidos p ON p.id = i.pedido_id
      WHERE i.modelo = a.modelo AND (i.capacidade = a.capacidade OR (i.capacidade IS NULL AND a.capacidade IS NULL))
        AND p.empresa_id = p_empresa_id AND p.status IN ('faturado', 'entregue')
        AND p.created_at >= NOW() - INTERVAL '90 days' AND p.deleted_at IS NULL), 0),
    CASE WHEN (CURRENT_DATE - a.data_entrada::DATE) > 90 THEN 'parado'
         WHEN (CURRENT_DATE - a.data_entrada::DATE) > 30 THEN 'lento'
         ELSE 'normal' END
  FROM atacado_aparelhos a
  WHERE a.empresa_id = p_empresa_id AND a.status = 'estoque'
    AND a.quantidade > 0 AND a.deleted_at IS NULL
  ORDER BY (a.quantidade * a.custo) DESC;
END; $$;
GRANT EXECUTE ON FUNCTION atacado_giro_estoque(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION atacado_rfm_clientes(p_empresa_id UUID)
RETURNS TABLE (
  cliente_id UUID, razao_social TEXT, nome_fantasia TEXT,
  ultima_compra DATE, dias_sem_comprar INT, qtd_pedidos_12m BIGINT,
  faturamento_12m NUMERIC, ticket_medio NUMERIC, classificacao TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.razao_social, c.nome_fantasia,
    MAX(p.created_at)::DATE,
    GREATEST(0, (CURRENT_DATE - MAX(p.created_at)::DATE))::INT,
    COUNT(p.id)::BIGINT, COALESCE(SUM(p.total), 0),
    CASE WHEN COUNT(p.id) > 0 THEN AVG(p.total) ELSE 0 END,
    CASE
      WHEN MAX(p.created_at) IS NULL THEN 'sem_compras'
      WHEN MAX(p.created_at)::DATE > CURRENT_DATE - 30 AND COUNT(p.id) >= 3 THEN 'campeao'
      WHEN MAX(p.created_at)::DATE > CURRENT_DATE - 60 AND COUNT(p.id) >= 2 THEN 'leal'
      WHEN MAX(p.created_at)::DATE > CURRENT_DATE - 90 THEN 'recente'
      WHEN MAX(p.created_at)::DATE > CURRENT_DATE - 180 THEN 'em_risco'
      ELSE 'perdido'
    END
  FROM atacado_clientes c
  LEFT JOIN atacado_pedidos p ON p.cliente_id = c.id
    AND p.status IN ('faturado', 'entregue')
    AND p.created_at >= NOW() - INTERVAL '12 months'
    AND p.deleted_at IS NULL
  WHERE c.empresa_id = p_empresa_id AND c.deleted_at IS NULL
  GROUP BY c.id, c.razao_social, c.nome_fantasia
  ORDER BY COALESCE(SUM(p.total), 0) DESC;
END; $$;
GRANT EXECUTE ON FUNCTION atacado_rfm_clientes(UUID) TO authenticated;
