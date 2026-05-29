CREATE OR REPLACE FUNCTION public.registrar_venda_loja(
  p_empresa_id UUID,
  p_cliente_id UUID,
  p_vendedor_id UUID,
  p_itens JSONB,
  p_pagamentos JSONB,
  p_desconto NUMERIC DEFAULT 0,
  p_trade_in_id UUID DEFAULT NULL,
  p_trade_in_valor NUMERIC DEFAULT 0,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS TABLE (venda_id UUID, numero_venda BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda_id UUID;
  v_numero BIGINT;
  v_subtotal NUMERIC := 0;
  v_total NUMERIC;
  v_total_pagamentos NUMERIC := 0;
  v_item JSONB;
  v_pagamento JSONB;
  v_aparelho_id UUID;
  v_preco NUMERIC;
  v_desconto_item NUMERIC;
  v_total_item NUMERIC;
  v_crediario_id UUID;
  v_crediario_pagamento JSONB := NULL;
  v_parcelas INT;
  v_valor_parcela NUMERIC;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_subtotal := v_subtotal +
      (COALESCE((v_item->>'preco_unitario')::NUMERIC, 0) - COALESCE((v_item->>'desconto_item')::NUMERIC, 0));
  END LOOP;

  v_total := v_subtotal - COALESCE(p_desconto, 0) - COALESCE(p_trade_in_valor, 0);

  FOR v_pagamento IN SELECT * FROM jsonb_array_elements(p_pagamentos) LOOP
    v_total_pagamentos := v_total_pagamentos + (v_pagamento->>'valor')::NUMERIC;
    IF (v_pagamento->>'forma') = 'crediario' THEN
      v_crediario_pagamento := v_pagamento;
    END IF;
  END LOOP;

  IF ABS(v_total_pagamentos - v_total) > 0.01 THEN
    RAISE EXCEPTION 'Soma dos pagamentos (%) diferente do total da venda (%)', v_total_pagamentos, v_total;
  END IF;

  INSERT INTO loja_vendas (
    empresa_id, cliente_id, vendedor_id, subtotal, desconto,
    trade_in_valor, trade_in_id, total, status, observacoes
  ) VALUES (
    p_empresa_id, p_cliente_id, p_vendedor_id, v_subtotal, COALESCE(p_desconto, 0),
    COALESCE(p_trade_in_valor, 0), p_trade_in_id, v_total, 'pago', p_observacoes
  )
  RETURNING id, loja_vendas.numero_venda INTO v_venda_id, v_numero;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_aparelho_id := (v_item->>'aparelho_id')::UUID;
    v_preco := (v_item->>'preco_unitario')::NUMERIC;
    v_desconto_item := COALESCE((v_item->>'desconto_item')::NUMERIC, 0);
    v_total_item := v_preco - v_desconto_item;

    IF NOT EXISTS (
      SELECT 1 FROM loja_aparelhos
      WHERE id = v_aparelho_id AND empresa_id = p_empresa_id
        AND status IN ('estoque','vitrine') AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Aparelho % não está disponível para venda', v_aparelho_id;
    END IF;

    INSERT INTO loja_vendas_itens (venda_id, aparelho_id, preco_unitario, desconto_item, total_item)
    VALUES (v_venda_id, v_aparelho_id, v_preco, v_desconto_item, v_total_item);

    UPDATE loja_aparelhos
    SET status = 'vendido',
        venda_id = v_venda_id,
        data_venda = NOW(),
        updated_at = NOW()
    WHERE id = v_aparelho_id;
  END LOOP;

  FOR v_pagamento IN SELECT * FROM jsonb_array_elements(p_pagamentos) LOOP
    INSERT INTO loja_pagamentos (
      venda_id, forma, valor, parcelas, bandeira, taxa_aplicada, status
    ) VALUES (
      v_venda_id,
      v_pagamento->>'forma',
      (v_pagamento->>'valor')::NUMERIC,
      COALESCE((v_pagamento->>'parcelas')::INT, 1),
      v_pagamento->>'bandeira',
      (v_pagamento->>'taxa_aplicada')::NUMERIC,
      'aprovado'
    );
  END LOOP;

  IF v_crediario_pagamento IS NOT NULL AND p_cliente_id IS NOT NULL THEN
    v_parcelas := COALESCE((v_crediario_pagamento->>'parcelas')::INT, 1);
    v_valor_parcela := (v_crediario_pagamento->>'valor')::NUMERIC / v_parcelas;

    INSERT INTO loja_crediario (
      empresa_id, numero_contrato, venda_id, cliente_id,
      total, entrada, parcelas, valor_parcela, taxa_juros,
      primeiro_vencimento, status
    ) VALUES (
      p_empresa_id,
      'CR-' || LPAD(v_numero::TEXT, 6, '0'),
      v_venda_id,
      p_cliente_id,
      (v_crediario_pagamento->>'valor')::NUMERIC,
      COALESCE((v_crediario_pagamento->>'entrada')::NUMERIC, 0),
      v_parcelas,
      v_valor_parcela,
      COALESCE((v_crediario_pagamento->>'taxa_juros')::NUMERIC, 0),
      (NOW() + INTERVAL '30 days')::DATE,
      'aberto'
    )
    RETURNING id INTO v_crediario_id;

    FOR i IN 1..v_parcelas LOOP
      INSERT INTO loja_crediario_parcelas (
        crediario_id, numero_parcela, valor, vencimento, status
      ) VALUES (
        v_crediario_id, i, v_valor_parcela,
        (NOW() + (i * INTERVAL '30 days'))::DATE,
        'aberta'
      );
    END LOOP;
  END IF;

  IF p_trade_in_id IS NOT NULL THEN
    UPDATE loja_trade_in
    SET status = 'convertido_estoque',
        venda_id = v_venda_id,
        updated_at = NOW()
    WHERE id = p_trade_in_id AND empresa_id = p_empresa_id;
  END IF;

  RETURN QUERY SELECT v_venda_id, v_numero;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_venda_loja(UUID, UUID, UUID, JSONB, JSONB, NUMERIC, UUID, NUMERIC, TEXT) TO authenticated;