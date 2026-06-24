ALTER TABLE public.atacado_pedidos_pagamentos
  DROP CONSTRAINT IF EXISTS atacado_pedidos_pagamentos_status_check;
ALTER TABLE public.atacado_pedidos_pagamentos
  ADD CONSTRAINT atacado_pedidos_pagamentos_status_check
  CHECK (status IN ('aberto','parcial','pago','atrasado','cancelado'));

CREATE OR REPLACE FUNCTION public.atacado_receber_pagamento(
  p_pagamento_id uuid,
  p_valor numeric,
  p_forma text DEFAULT NULL,
  p_data date DEFAULT CURRENT_DATE
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid; v_valor numeric; v_pago numeric; v_saldo numeric; v_aplicar numeric; v_status text;
BEGIN
  v_emp := public.get_my_empresa_id();
  SELECT pg.valor, COALESCE(pg.valor_pago,0) INTO v_valor, v_pago
  FROM public.atacado_pedidos_pagamentos pg
  JOIN public.atacado_pedidos ped ON ped.id = pg.pedido_id
  WHERE pg.id = p_pagamento_id AND ped.empresa_id = v_emp;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parcela não encontrada');
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor inválido');
  END IF;
  v_saldo := v_valor - v_pago;
  IF v_saldo <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parcela já quitada');
  END IF;
  v_aplicar := LEAST(p_valor, v_saldo);

  INSERT INTO public.atacado_recebimentos (empresa_id, pagamento_id, valor, forma, data)
  VALUES (v_emp, p_pagamento_id, v_aplicar, p_forma, COALESCE(p_data, CURRENT_DATE));

  v_pago := v_pago + v_aplicar;
  v_status := CASE WHEN v_pago >= v_valor THEN 'pago'
                   WHEN v_pago > 0 THEN 'parcial' ELSE 'aberto' END;

  UPDATE public.atacado_pedidos_pagamentos SET
    valor_pago = v_pago,
    status = v_status,
    pago_em = CASE WHEN v_status = 'pago' THEN COALESCE(p_data, CURRENT_DATE)::timestamptz ELSE pago_em END,
    forma_recebido = COALESCE(p_forma, forma_recebido, forma)
  WHERE id = p_pagamento_id;

  RETURN jsonb_build_object('success', true, 'status', v_status,
                            'valor_pago', v_pago, 'saldo', v_valor - v_pago);
END; $$;

GRANT EXECUTE ON FUNCTION public.atacado_receber_pagamento(uuid, numeric, text, date) TO authenticated;