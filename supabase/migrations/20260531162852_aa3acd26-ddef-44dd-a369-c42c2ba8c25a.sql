
DROP FUNCTION IF EXISTS public.atacado_financeiro_kpis(uuid);

CREATE OR REPLACE FUNCTION public.atacado_financeiro_kpis(p_empresa_id UUID)
RETURNS TABLE (
  a_receber_total NUMERIC,
  a_receber_30d NUMERIC,
  a_receber_60d NUMERIC,
  a_receber_90d NUMERIC,
  inadimplencia_total NUMERIC,
  qtd_titulos_vencidos BIGINT,
  recebido_mes NUMERIC,
  ticket_medio_recebido NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inicio_mes DATE := DATE_TRUNC('month', CURRENT_DATE);
BEGIN
  RETURN QUERY SELECT
    COALESCE((SELECT SUM(pp.valor) FROM atacado_pedidos_pagamentos pp
              JOIN atacado_pedidos p ON p.id = pp.pedido_id
              WHERE p.empresa_id = p_empresa_id AND pp.status = 'aberto'
                AND pp.vencimento >= CURRENT_DATE
                AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor) FROM atacado_pedidos_pagamentos pp
              JOIN atacado_pedidos p ON p.id = pp.pedido_id
              WHERE p.empresa_id = p_empresa_id AND pp.status = 'aberto'
                AND pp.vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
                AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor) FROM atacado_pedidos_pagamentos pp
              JOIN atacado_pedidos p ON p.id = pp.pedido_id
              WHERE p.empresa_id = p_empresa_id AND pp.status = 'aberto'
                AND pp.vencimento BETWEEN CURRENT_DATE + 31 AND CURRENT_DATE + 60
                AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor) FROM atacado_pedidos_pagamentos pp
              JOIN atacado_pedidos p ON p.id = pp.pedido_id
              WHERE p.empresa_id = p_empresa_id AND pp.status = 'aberto'
                AND pp.vencimento BETWEEN CURRENT_DATE + 61 AND CURRENT_DATE + 90
                AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor) FROM atacado_pedidos_pagamentos pp
              JOIN atacado_pedidos p ON p.id = pp.pedido_id
              WHERE p.empresa_id = p_empresa_id AND pp.status IN ('aberto','atrasado')
                AND pp.vencimento < CURRENT_DATE
                AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT COUNT(*) FROM atacado_pedidos_pagamentos pp
              JOIN atacado_pedidos p ON p.id = pp.pedido_id
              WHERE p.empresa_id = p_empresa_id AND pp.status IN ('aberto','atrasado')
                AND pp.vencimento < CURRENT_DATE
                AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor) FROM atacado_pedidos_pagamentos pp
              JOIN atacado_pedidos p ON p.id = pp.pedido_id
              WHERE p.empresa_id = p_empresa_id AND pp.status = 'pago'
                AND pp.pago_em >= v_inicio_mes
                AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT AVG(pp.valor) FROM atacado_pedidos_pagamentos pp
              JOIN atacado_pedidos p ON p.id = pp.pedido_id
              WHERE p.empresa_id = p_empresa_id AND pp.status = 'pago'
                AND pp.pago_em >= v_inicio_mes
                AND p.deleted_at IS NULL), 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.atacado_financeiro_kpis(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.atacado_top_devedores(p_empresa_id UUID, p_limit INT DEFAULT 10)
RETURNS TABLE (
  cliente_id UUID,
  razao_social TEXT,
  nome_fantasia TEXT,
  cnpj TEXT,
  total_devido NUMERIC,
  qtd_titulos BIGINT,
  dias_atraso_max INT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.razao_social, c.nome_fantasia, c.cnpj,
    SUM(pp.valor) AS total_devido,
    COUNT(pp.id) AS qtd_titulos,
    MAX(CURRENT_DATE - pp.vencimento)::INT AS dias_atraso_max
  FROM atacado_clientes c
  JOIN atacado_pedidos p ON p.cliente_id = c.id
  JOIN atacado_pedidos_pagamentos pp ON pp.pedido_id = p.id
  WHERE c.empresa_id = p_empresa_id
    AND pp.status IN ('aberto','atrasado')
    AND pp.vencimento < CURRENT_DATE
    AND p.deleted_at IS NULL
    AND c.deleted_at IS NULL
  GROUP BY c.id, c.razao_social, c.nome_fantasia, c.cnpj
  ORDER BY total_devido DESC
  LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.atacado_top_devedores(UUID, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.atacado_baixar_pagamento(
  p_pagamento_id UUID,
  p_forma_recebido TEXT DEFAULT NULL,
  p_data_recebimento DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.atacado_pedidos_pagamentos SET
    status = 'pago',
    pago_em = p_data_recebimento::TIMESTAMPTZ,
    forma_recebido = COALESCE(p_forma_recebido, forma)
  WHERE id = p_pagamento_id;
  RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION public.atacado_baixar_pagamento(UUID, TEXT, DATE) TO authenticated;
