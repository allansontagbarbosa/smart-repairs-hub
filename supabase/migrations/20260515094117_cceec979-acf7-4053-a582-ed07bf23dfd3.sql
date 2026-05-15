CREATE OR REPLACE FUNCTION public.portal_dashboard_lojista()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
  v_cliente_nome TEXT;
  v_total_faturado NUMERIC := 0;
  v_total_pago NUMERIC := 0;
  v_saldo_devedor NUMERIC := 0;
  v_qtd_entregues INT := 0;
  v_qtd_canceladas INT := 0;
  v_qtd_total INT := 0;
  v_qtd_garantia_ativa INT := 0;
  v_ultimas JSONB;
BEGIN
  SELECT id, nome INTO v_cliente_id, v_cliente_nome
  FROM public.clientes
  WHERE user_id = auth.uid()
    AND tipo_cliente = 'lojista_b2b'
    AND deleted_at IS NULL;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT COALESCE(SUM(os.valor_total), 0) INTO v_total_faturado
  FROM public.ordens_de_servico os
  JOIN public.aparelhos a ON a.id = os.aparelho_id
  WHERE a.cliente_id = v_cliente_id
    AND os.deleted_at IS NULL
    AND os.status = 'entregue';

  SELECT COALESCE(SUM(valor), 0) INTO v_total_pago
  FROM public.pagamentos_clientes
  WHERE cliente_id = v_cliente_id
    AND deleted_at IS NULL;

  v_saldo_devedor := GREATEST(0, v_total_faturado - v_total_pago);

  SELECT
    COUNT(*) FILTER (WHERE os.status = 'entregue'),
    COUNT(*) FILTER (WHERE os.status = 'cancelado'),
    COUNT(*)
  INTO v_qtd_entregues, v_qtd_canceladas, v_qtd_total
  FROM public.ordens_de_servico os
  JOIN public.aparelhos a ON a.id = os.aparelho_id
  WHERE a.cliente_id = v_cliente_id
    AND os.deleted_at IS NULL;

  SELECT COUNT(*) INTO v_qtd_garantia_ativa
  FROM public.garantias g
  JOIN public.ordens_de_servico os ON os.id = g.ordem_id
  JOIN public.aparelhos a ON a.id = os.aparelho_id
  WHERE a.cliente_id = v_cliente_id
    AND g.status = 'ativa'
    AND g.data_fim >= CURRENT_DATE
    AND os.deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(linha ORDER BY ordenacao DESC), '[]'::jsonb) INTO v_ultimas
  FROM (
    SELECT
      jsonb_build_object(
        'id', os.id,
        'numero', os.numero,
        'numero_formatado', os.numero_formatado,
        'status', os.status,
        'valor_total', os.valor_total,
        'data_entrada', os.data_entrada,
        'data_conclusao', os.data_conclusao,
        'data_entrega', os.data_entrega,
        'aparelho', jsonb_build_object(
          'marca', a.marca,
          'modelo', a.modelo,
          'imei', a.imei
        )
      ) AS linha,
      COALESCE(os.data_conclusao, os.data_entrada, os.created_at) AS ordenacao
    FROM public.ordens_de_servico os
    JOIN public.aparelhos a ON a.id = os.aparelho_id
    WHERE a.cliente_id = v_cliente_id
      AND os.deleted_at IS NULL
    ORDER BY ordenacao DESC
    LIMIT 5
  ) sub;

  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', v_cliente_id,
    'cliente_nome', v_cliente_nome,
    'saldo', jsonb_build_object(
      'total_faturado', v_total_faturado,
      'total_pago', v_total_pago,
      'devedor', v_saldo_devedor
    ),
    'ordens', jsonb_build_object(
      'total', v_qtd_total,
      'entregues', v_qtd_entregues,
      'canceladas', v_qtd_canceladas
    ),
    'garantias_ativas', v_qtd_garantia_ativa,
    'ultimas_ordens', v_ultimas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_dashboard_lojista() TO authenticated;