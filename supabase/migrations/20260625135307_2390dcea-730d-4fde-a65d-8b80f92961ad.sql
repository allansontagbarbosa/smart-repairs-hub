
CREATE OR REPLACE FUNCTION public.atacado_financeiro_kpis(p_empresa_id uuid)
RETURNS TABLE(a_receber_total numeric, a_receber_30d numeric, a_receber_60d numeric, a_receber_90d numeric, inadimplencia_total numeric, qtd_titulos_vencidos bigint, recebido_mes numeric, ticket_medio_recebido numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_inicio_mes DATE := DATE_TRUNC('month', CURRENT_DATE);
BEGIN
  p_empresa_id := public.get_my_empresa_id();
  RETURN QUERY SELECT
    COALESCE((SELECT SUM(pp.valor - COALESCE(pp.valor_pago,0)) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status IN ('aberto','parcial') AND pp.vencimento >= CURRENT_DATE AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor - COALESCE(pp.valor_pago,0)) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status IN ('aberto','parcial') AND pp.vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor - COALESCE(pp.valor_pago,0)) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status IN ('aberto','parcial') AND pp.vencimento BETWEEN CURRENT_DATE + 31 AND CURRENT_DATE + 60 AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor - COALESCE(pp.valor_pago,0)) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status IN ('aberto','parcial') AND pp.vencimento BETWEEN CURRENT_DATE + 61 AND CURRENT_DATE + 90 AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor - COALESCE(pp.valor_pago,0)) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status IN ('aberto','parcial','atrasado') AND pp.vencimento < CURRENT_DATE AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT COUNT(*) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status IN ('aberto','parcial','atrasado') AND pp.vencimento < CURRENT_DATE AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(r.valor) FROM atacado_recebimentos r JOIN atacado_pedidos_pagamentos pp ON pp.id = r.pagamento_id JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND r.data >= v_inicio_mes AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT AVG(r.valor) FROM atacado_recebimentos r JOIN atacado_pedidos_pagamentos pp ON pp.id = r.pagamento_id JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND r.data >= v_inicio_mes AND p.deleted_at IS NULL), 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.atacado_top_devedores(p_empresa_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE(cliente_id uuid, razao_social text, nome_fantasia text, cnpj text, total_devido numeric, qtd_titulos bigint, dias_atraso_max integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.razao_social, c.nome_fantasia, c.cnpj,
    SUM(pp.valor - COALESCE(pp.valor_pago,0)) AS total_devido,
    COUNT(pp.id) AS qtd_titulos,
    MAX(CURRENT_DATE - pp.vencimento)::INT AS dias_atraso_max
  FROM atacado_clientes c
  JOIN atacado_pedidos p ON p.cliente_id = c.id
  JOIN atacado_pedidos_pagamentos pp ON pp.pedido_id = p.id
  WHERE c.empresa_id = public.get_my_empresa_id()
    AND pp.status IN ('aberto','parcial','atrasado')
    AND pp.vencimento < CURRENT_DATE
    AND p.deleted_at IS NULL
    AND c.deleted_at IS NULL
  GROUP BY c.id, c.razao_social, c.nome_fantasia, c.cnpj
  ORDER BY total_devido DESC
  LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.atacado_dre(p_empresa_id uuid, p_inicio date, p_fim date)
RETURNS TABLE(faturamento_bruto numeric, descontos numeric, faturamento_liquido numeric, custo_produtos numeric, lucro_bruto numeric, margem_bruta_pct numeric, comissoes_estimadas numeric, inadimplencia numeric, resultado_operacional numeric, qtd_pedidos bigint, ticket_medio numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_fat_bruto NUMERIC := 0; v_desc NUMERIC := 0; v_fat_liq NUMERIC := 0;
  v_custo NUMERIC := 0; v_lucro_bruto NUMERIC := 0; v_comissoes NUMERIC := 0;
  v_inadimp NUMERIC := 0; v_qtd BIGINT := 0;
BEGIN
  p_empresa_id := public.get_my_empresa_id();
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

  SELECT COALESCE(SUM(pp.valor - COALESCE(pp.valor_pago,0)), 0) INTO v_inadimp
  FROM atacado_pedidos_pagamentos pp
  JOIN atacado_pedidos p ON p.id = pp.pedido_id
  WHERE p.empresa_id = p_empresa_id AND pp.status IN ('aberto','parcial','atrasado')
    AND pp.vencimento < CURRENT_DATE
    AND p.deleted_at IS NULL;

  RETURN QUERY SELECT v_fat_bruto, v_desc, v_fat_liq, v_custo, v_lucro_bruto,
    CASE WHEN v_fat_liq > 0 THEN (v_lucro_bruto / v_fat_liq) * 100 ELSE 0 END,
    v_comissoes, v_inadimp, v_lucro_bruto - v_comissoes, v_qtd,
    CASE WHEN v_qtd > 0 THEN v_fat_liq / v_qtd ELSE 0 END;
END; $function$;

DROP INDEX IF EXISTS public.idx_atacado_pagamentos_status;
CREATE INDEX idx_atacado_pagamentos_status
  ON public.atacado_pedidos_pagamentos(status)
  WHERE status IN ('aberto','parcial','atrasado');
