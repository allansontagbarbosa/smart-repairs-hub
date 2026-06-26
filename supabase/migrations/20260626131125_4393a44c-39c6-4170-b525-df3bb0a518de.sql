CREATE OR REPLACE FUNCTION public.atacado_pedidos_dashboard(
  p_empresa_id uuid,
  p_inicio date,
  p_fim date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_empresa uuid;
  v_dias int;
  v_prev_inicio date;
  v_prev_fim date;
  v_today date := CURRENT_DATE;
  v_result jsonb;

  v_fat_bruto numeric := 0;
  v_desc numeric := 0;
  v_fat_liq numeric := 0;
  v_qtd_pedidos int := 0;
  v_ticket numeric := 0;
  v_unidades int := 0;
  v_custo numeric := 0;
  v_lucro numeric := 0;
  v_margem numeric := 0;
  v_markup numeric := 0;
  v_qtd_cancelados int := 0;
  v_taxa_cancel numeric := 0;

  v_p_fat_bruto numeric := 0;
  v_p_fat_liq numeric := 0;
  v_p_qtd_pedidos int := 0;
  v_p_ticket numeric := 0;
  v_p_custo numeric := 0;
  v_p_lucro numeric := 0;
  v_p_margem numeric := 0;

  v_a_receber numeric := 0;
  v_vencido numeric := 0;
  v_recebido numeric := 0;
  v_a_vencer_7 numeric := 0;
  v_a_vencer_30 numeric := 0;
  v_inadimp_pct numeric := 0;

  v_funil jsonb;
BEGIN
  v_my_empresa := public.get_my_empresa_id();
  IF v_my_empresa IS NULL OR v_my_empresa <> p_empresa_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_dias := GREATEST(1, (p_fim - p_inicio) + 1);
  v_prev_fim := p_inicio - 1;
  v_prev_inicio := v_prev_fim - (v_dias - 1);

  -- ===== PERÍODO ATUAL: vendas =====
  SELECT
    COALESCE(SUM(CASE WHEN p.status <> 'cancelado' THEN p.subtotal ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN p.status <> 'cancelado' THEN p.desconto ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN p.status <> 'cancelado' THEN p.total ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE p.status <> 'cancelado'),
    COUNT(*) FILTER (WHERE p.status = 'cancelado')
  INTO v_fat_bruto, v_desc, v_fat_liq, v_qtd_pedidos, v_qtd_cancelados
  FROM public.atacado_pedidos p
  WHERE p.empresa_id = p_empresa_id
    AND p.deleted_at IS NULL
    AND p.created_at::date BETWEEN p_inicio AND p_fim;

  -- itens (unidades) e custo
  SELECT
    COALESCE(SUM(i.quantidade), 0),
    COALESCE(SUM(i.quantidade * COALESCE(ap.custo, 0)), 0)
  INTO v_unidades, v_custo
  FROM public.atacado_pedidos_itens i
  JOIN public.atacado_pedidos p ON p.id = i.pedido_id
  LEFT JOIN public.atacado_aparelhos ap ON ap.id = i.aparelho_id
  WHERE p.empresa_id = p_empresa_id
    AND p.deleted_at IS NULL
    AND p.status <> 'cancelado'
    AND p.created_at::date BETWEEN p_inicio AND p_fim;

  v_ticket := CASE WHEN v_qtd_pedidos > 0 THEN v_fat_liq / v_qtd_pedidos ELSE 0 END;
  v_lucro := v_fat_liq - v_custo;
  v_margem := CASE WHEN v_fat_liq > 0 THEN (v_lucro / v_fat_liq) * 100 ELSE 0 END;
  v_markup := CASE WHEN v_custo > 0 THEN (v_lucro / v_custo) * 100 ELSE 0 END;
  v_taxa_cancel := CASE
    WHEN (v_qtd_pedidos + v_qtd_cancelados) > 0
    THEN (v_qtd_cancelados::numeric / (v_qtd_pedidos + v_qtd_cancelados)) * 100
    ELSE 0 END;

  -- ===== PERÍODO ANTERIOR =====
  SELECT
    COALESCE(SUM(CASE WHEN p.status <> 'cancelado' THEN p.subtotal ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN p.status <> 'cancelado' THEN p.total ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE p.status <> 'cancelado')
  INTO v_p_fat_bruto, v_p_fat_liq, v_p_qtd_pedidos
  FROM public.atacado_pedidos p
  WHERE p.empresa_id = p_empresa_id
    AND p.deleted_at IS NULL
    AND p.created_at::date BETWEEN v_prev_inicio AND v_prev_fim;

  SELECT COALESCE(SUM(i.quantidade * COALESCE(ap.custo, 0)), 0)
  INTO v_p_custo
  FROM public.atacado_pedidos_itens i
  JOIN public.atacado_pedidos p ON p.id = i.pedido_id
  LEFT JOIN public.atacado_aparelhos ap ON ap.id = i.aparelho_id
  WHERE p.empresa_id = p_empresa_id
    AND p.deleted_at IS NULL
    AND p.status <> 'cancelado'
    AND p.created_at::date BETWEEN v_prev_inicio AND v_prev_fim;

  v_p_lucro := v_p_fat_liq - v_p_custo;
  v_p_ticket := CASE WHEN v_p_qtd_pedidos > 0 THEN v_p_fat_liq / v_p_qtd_pedidos ELSE 0 END;
  v_p_margem := CASE WHEN v_p_fat_liq > 0 THEN (v_p_lucro / v_p_fat_liq) * 100 ELSE 0 END;

  -- ===== RECEBÍVEIS (escopo: pedidos criados no período) =====
  WITH pags AS (
    SELECT pg.valor, COALESCE(pg.valor_pago, 0) AS valor_pago,
           pg.vencimento, pg.status
    FROM public.atacado_pedidos_pagamentos pg
    JOIN public.atacado_pedidos p ON p.id = pg.pedido_id
    WHERE p.empresa_id = p_empresa_id
      AND p.deleted_at IS NULL
      AND p.status <> 'cancelado'
      AND p.created_at::date BETWEEN p_inicio AND p_fim
  ),
  abertos AS (
    SELECT vencimento, GREATEST(valor - valor_pago, 0) AS saldo
    FROM pags WHERE status <> 'pago' AND status <> 'cancelado'
  )
  SELECT
    COALESCE(SUM(saldo), 0),
    COALESCE(SUM(CASE WHEN vencimento < v_today THEN saldo ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN vencimento BETWEEN v_today AND v_today + 7 THEN saldo ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN vencimento BETWEEN v_today AND v_today + 30 THEN saldo ELSE 0 END), 0)
  INTO v_a_receber, v_vencido, v_a_vencer_7, v_a_vencer_30
  FROM abertos;

  SELECT COALESCE(SUM(r.valor), 0)
  INTO v_recebido
  FROM public.atacado_recebimentos r
  JOIN public.atacado_pedidos_pagamentos pg ON pg.id = r.pagamento_id
  JOIN public.atacado_pedidos p ON p.id = pg.pedido_id
  WHERE r.empresa_id = p_empresa_id
    AND p.deleted_at IS NULL
    AND r.data BETWEEN p_inicio AND p_fim;

  v_inadimp_pct := CASE WHEN v_a_receber > 0 THEN (v_vencido / v_a_receber) * 100 ELSE 0 END;

  -- ===== FUNIL =====
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'status', status, 'qtd', qtd, 'valor', valor
         ) ORDER BY status), '[]'::jsonb)
  INTO v_funil
  FROM (
    SELECT p.status, COUNT(*) AS qtd, COALESCE(SUM(p.total), 0) AS valor
    FROM public.atacado_pedidos p
    WHERE p.empresa_id = p_empresa_id
      AND p.deleted_at IS NULL
      AND p.created_at::date BETWEEN p_inicio AND p_fim
    GROUP BY p.status
  ) s;

  v_result := jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
    'periodo_anterior', jsonb_build_object('inicio', v_prev_inicio, 'fim', v_prev_fim),
    'vendas', jsonb_build_object(
      'faturamento_bruto', v_fat_bruto,
      'descontos', v_desc,
      'faturamento_liquido', v_fat_liq,
      'qtd_pedidos', v_qtd_pedidos,
      'ticket_medio', v_ticket,
      'unidades', v_unidades,
      'qtd_cancelados', v_qtd_cancelados,
      'taxa_cancelamento_pct', v_taxa_cancel
    ),
    'vendas_prev', jsonb_build_object(
      'faturamento_bruto', v_p_fat_bruto,
      'faturamento_liquido', v_p_fat_liq,
      'qtd_pedidos', v_p_qtd_pedidos,
      'ticket_medio', v_p_ticket
    ),
    'rentabilidade', jsonb_build_object(
      'custo_total', v_custo,
      'lucro_bruto', v_lucro,
      'margem_pct', v_margem,
      'markup_pct', v_markup,
      'lucro_medio_pedido', CASE WHEN v_qtd_pedidos > 0 THEN v_lucro / v_qtd_pedidos ELSE 0 END
    ),
    'rentabilidade_prev', jsonb_build_object(
      'lucro_bruto', v_p_lucro,
      'margem_pct', v_p_margem
    ),
    'recebiveis', jsonb_build_object(
      'a_receber', v_a_receber,
      'vencido', v_vencido,
      'recebido_periodo', v_recebido,
      'a_vencer_7', v_a_vencer_7,
      'a_vencer_30', v_a_vencer_30,
      'inadimplencia_pct', v_inadimp_pct
    ),
    'funil', v_funil
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.atacado_pedidos_dashboard(uuid, date, date) TO authenticated;