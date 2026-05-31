CREATE OR REPLACE FUNCTION public.registrar_pedido_atacado(
  p_empresa_id UUID,
  p_cliente_id UUID,
  p_vendedor_id UUID,
  p_itens JSONB,
  p_pagamentos JSONB,
  p_desconto NUMERIC DEFAULT 0,
  p_condicao_pagamento TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS TABLE (pedido_id UUID, numero_pedido BIGINT, status TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_id UUID;
  v_numero BIGINT;
  v_subtotal NUMERIC := 0;
  v_total NUMERIC;
  v_total_pagamentos NUMERIC := 0;
  v_item JSONB;
  v_pag JSONB;
  v_limite NUMERIC;
  v_em_aberto NUMERIC;
  v_status TEXT;
  v_aparelho_id UUID;
  v_qtd_pedida INT;
  v_qtd_disponivel INT;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_subtotal := v_subtotal +
      (((v_item->>'preco_unitario')::NUMERIC - COALESCE((v_item->>'desconto_item')::NUMERIC, 0))
       * (v_item->>'quantidade')::INT);
  END LOOP;

  v_total := v_subtotal - COALESCE(p_desconto, 0);

  FOR v_pag IN SELECT * FROM jsonb_array_elements(p_pagamentos) LOOP
    v_total_pagamentos := v_total_pagamentos + (v_pag->>'valor')::NUMERIC;
  END LOOP;

  IF ABS(v_total_pagamentos - v_total) > 0.01 THEN
    RAISE EXCEPTION 'Soma pagamentos (%) != total (%)', v_total_pagamentos, v_total;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_aparelho_id := NULLIF(v_item->>'aparelho_id', '')::UUID;
    v_qtd_pedida := (v_item->>'quantidade')::INT;
    IF v_aparelho_id IS NOT NULL THEN
      SELECT quantidade INTO v_qtd_disponivel
      FROM atacado_aparelhos
      WHERE id = v_aparelho_id AND empresa_id = p_empresa_id AND deleted_at IS NULL;

      IF v_qtd_disponivel IS NULL OR v_qtd_disponivel < v_qtd_pedida THEN
        RAISE EXCEPTION 'Estoque insuficiente para item % (disponivel: %, pedido: %)',
          v_aparelho_id, COALESCE(v_qtd_disponivel, 0), v_qtd_pedida;
      END IF;
    END IF;
  END LOOP;

  SELECT limite_credito INTO v_limite FROM atacado_clientes
  WHERE id = p_cliente_id AND empresa_id = p_empresa_id;

  SELECT COALESCE(SUM(pp.valor), 0) INTO v_em_aberto
  FROM atacado_pedidos_pagamentos pp
  JOIN atacado_pedidos p ON p.id = pp.pedido_id
  WHERE p.cliente_id = p_cliente_id
    AND p.empresa_id = p_empresa_id
    AND pp.status IN ('aberto', 'atrasado');

  IF v_limite > 0 AND (v_em_aberto + v_total) > v_limite THEN
    v_status := 'aguardando_aprovacao';
  ELSE
    v_status := 'aprovado';
  END IF;

  INSERT INTO atacado_pedidos (
    empresa_id, cliente_id, vendedor_id, subtotal, desconto, total,
    status, condicao_pagamento, observacoes, origem
  ) VALUES (
    p_empresa_id, p_cliente_id, p_vendedor_id, v_subtotal, COALESCE(p_desconto, 0), v_total,
    v_status, p_condicao_pagamento, p_observacoes, 'manual'
  )
  RETURNING id, numero_pedido INTO v_pedido_id, v_numero;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_aparelho_id := NULLIF(v_item->>'aparelho_id', '')::UUID;
    v_qtd_pedida := (v_item->>'quantidade')::INT;

    INSERT INTO atacado_pedidos_itens (
      pedido_id, aparelho_id, modelo, capacidade, cor,
      quantidade, preco_unitario, desconto_item, total_item
    ) VALUES (
      v_pedido_id, v_aparelho_id,
      v_item->>'modelo', v_item->>'capacidade', v_item->>'cor',
      v_qtd_pedida,
      (v_item->>'preco_unitario')::NUMERIC,
      COALESCE((v_item->>'desconto_item')::NUMERIC, 0),
      ((v_item->>'preco_unitario')::NUMERIC - COALESCE((v_item->>'desconto_item')::NUMERIC, 0)) * v_qtd_pedida
    );

    IF v_aparelho_id IS NOT NULL AND v_status = 'aprovado' THEN
      UPDATE atacado_aparelhos
      SET quantidade = quantidade - v_qtd_pedida,
          updated_at = NOW()
      WHERE id = v_aparelho_id;
    END IF;
  END LOOP;

  FOR v_pag IN SELECT * FROM jsonb_array_elements(p_pagamentos) LOOP
    INSERT INTO atacado_pedidos_pagamentos (
      pedido_id, forma, valor, vencimento, parcela, total_parcelas, status
    ) VALUES (
      v_pedido_id,
      v_pag->>'forma',
      (v_pag->>'valor')::NUMERIC,
      (v_pag->>'vencimento')::DATE,
      COALESCE((v_pag->>'parcela')::INT, 1),
      COALESCE((v_pag->>'total_parcelas')::INT, 1),
      'aberto'
    );
  END LOOP;

  RETURN QUERY SELECT v_pedido_id, v_numero, v_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_pedido_atacado TO authenticated;