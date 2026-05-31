DROP FUNCTION IF EXISTS public.combo_dashboard_kpis(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.combo_dashboard_kpis(
  p_empresa_id UUID,
  p_inicio DATE,
  p_fim DATE
)
RETURNS TABLE (
  faturamento_assist NUMERIC,
  faturamento_loja NUMERIC,
  faturamento_atacado NUMERIC,
  qtd_os BIGINT,
  qtd_vendas_loja BIGINT,
  qtd_pedidos_atacado BIGINT,
  ticket_medio_consolidado NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fat_assist NUMERIC := 0;
  v_fat_loja NUMERIC := 0;
  v_fat_atacado NUMERIC := 0;
  v_qtd_os BIGINT := 0;
  v_qtd_vendas BIGINT := 0;
  v_qtd_pedidos BIGINT := 0;
BEGIN
  IF public.empresa_tem_modulo(p_empresa_id, 'assistencia') THEN
    SELECT COALESCE(SUM(valor_total), 0), COUNT(*) INTO v_fat_assist, v_qtd_os
    FROM public.ordens_de_servico
    WHERE empresa_id = p_empresa_id AND status = 'concluida'
      AND created_at::DATE BETWEEN p_inicio AND p_fim;
  END IF;

  IF public.empresa_tem_modulo(p_empresa_id, 'loja') THEN
    SELECT COALESCE(SUM(total), 0), COUNT(*) INTO v_fat_loja, v_qtd_vendas
    FROM public.loja_vendas
    WHERE empresa_id = p_empresa_id AND status = 'pago'
      AND created_at::DATE BETWEEN p_inicio AND p_fim
      AND deleted_at IS NULL;
  END IF;

  IF public.empresa_tem_modulo(p_empresa_id, 'atacado') THEN
    SELECT COALESCE(SUM(total), 0), COUNT(*) INTO v_fat_atacado, v_qtd_pedidos
    FROM public.atacado_pedidos
    WHERE empresa_id = p_empresa_id AND status IN ('faturado', 'entregue')
      AND created_at::DATE BETWEEN p_inicio AND p_fim
      AND deleted_at IS NULL;
  END IF;

  RETURN QUERY SELECT
    v_fat_assist,
    v_fat_loja,
    v_fat_atacado,
    v_qtd_os,
    v_qtd_vendas,
    v_qtd_pedidos,
    CASE WHEN (v_qtd_os + v_qtd_vendas + v_qtd_pedidos) > 0
         THEN (v_fat_assist + v_fat_loja + v_fat_atacado) / (v_qtd_os + v_qtd_vendas + v_qtd_pedidos)
         ELSE 0 END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.combo_dashboard_kpis(UUID, DATE, DATE) TO authenticated;