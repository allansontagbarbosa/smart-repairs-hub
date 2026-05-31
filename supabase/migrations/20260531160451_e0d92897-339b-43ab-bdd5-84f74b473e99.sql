DROP FUNCTION IF EXISTS public.registrar_pedido_atacado(UUID, UUID, UUID, JSONB, JSONB, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.registrar_pedido_atacado(JSONB);

CREATE OR REPLACE FUNCTION public.registrar_pedido_atacado(p_payload JSONB)
RETURNS TABLE (pedido_id UUID, numero_pedido BIGINT, status_final TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_cliente_id UUID;
  v_vendedor_id UUID;
  v_pedido_id UUID;
  v_numero BIGINT;
  v_subtotal NUMERIC := 0;
  v_desconto NUMERIC := 0;
  v_total NUMERIC := 0;
  v_status TEXT := 'aprovado';
  v_limite NUMERIC := 0;
  v_em_aberto NUMERIC := 0;
  v_item JSONB;
  v_pagamento JSONB;
BEGIN
  v_empresa_id := (p_payload->>'empresa_id')::UUID;
  v_cliente_id := (p_payload->>'cliente_id')::UUID;
  v_vendedor_id := NULLIF(p_payload->>'vendedor_id', '')::UUID;
  v_subtotal := COALESCE((p_payload->>'subtotal')::NUMERIC, 0);
  v_desconto := COALESCE((p_payload->>'desconto')::NUMERIC, 0);
  v_total := v_subtotal - v_desconto;

  IF NOT EXISTS (
    SELECT 1 FROM atacado_clientes
    WHERE id = v_cliente_id AND empresa_id = v_empresa_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cliente inválido';
  END IF;

  IF EXISTS (SELECT 1 FROM atacado_clientes WHERE id = v_cliente_id AND status = 'bloqueado') THEN
    RAISE EXCEPTION 'Cliente está BLOQUEADO. Desbloqueie antes de criar pedido.';
  END IF;

  SELECT COALESCE(v_total, 0) + COALESCE((
    SELECT SUM(pp.valor)
    FROM atacado_pedidos_pagamentos pp
    JOIN atacado_pedidos p ON p.id = pp.pedido_id
    WHERE p.cliente_id = v_cliente_id
      AND pp.status IN ('aberto', 'atrasado')
      AND p.deleted_at IS NULL
  ), 0)
  INTO v_em_aberto;

  SELECT limite_credito INTO v_limite FROM atacado_clientes WHERE id = v_cliente_id;

  IF v_limite > 0 AND v_em_aberto > v_limite THEN
    v_status := 'aguardando_aprovacao';
  END IF;

  IF EXISTS (SELECT 1 FROM atacado_clientes WHERE id = v_cliente_id AND status = 'inadimplente') THEN
    v_status := 'aguardando_aprovacao';
  END IF;

  INSERT INTO atacado_pedidos (
    empresa_id, cliente_id, vendedor_id, subtotal, desconto, total, status,
    condicao_pagamento, observacoes, origem
  ) VALUES (
    v_empresa_id, v_cliente_id, v_vendedor_id, v_subtotal, v_desconto, v_total, v_status,
    p_payload->>'condicao_pagamento',
    p_payload->>'observacoes',
    COALESCE(p_payload->>'origem', 'manual')
  )
  RETURNING id, numero_pedido INTO v_pedido_id, v_numero;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'itens')
  LOOP
    INSERT INTO atacado_pedidos_itens (
      pedido_id, aparelho_id, modelo, capacidade, cor,
      quantidade, preco_unitario, desconto_item, total_item
    ) VALUES (
      v_pedido_id,
      NULLIF(v_item->>'aparelho_id', '')::UUID,
      v_item->>'modelo',
      v_item->>'capacidade',
      v_item->>'cor',
      (v_item->>'quantidade')::INT,
      (v_item->>'preco_unitario')::NUMERIC,
      COALESCE((v_item->>'desconto_item')::NUMERIC, 0),
      (v_item->>'total_item')::NUMERIC
    );

    IF (v_item->>'aparelho_id') IS NOT NULL AND v_status = 'aprovado' THEN
      UPDATE atacado_aparelhos
      SET quantidade = GREATEST(0, quantidade - (v_item->>'quantidade')::INT),
          status = CASE
            WHEN quantidade - (v_item->>'quantidade')::INT <= 0 THEN 'vendido'
            ELSE status
          END
      WHERE id = (v_item->>'aparelho_id')::UUID;
    END IF;
  END LOOP;

  FOR v_pagamento IN SELECT * FROM jsonb_array_elements(p_payload->'pagamentos')
  LOOP
    INSERT INTO atacado_pedidos_pagamentos (
      pedido_id, forma, valor, vencimento, parcela, total_parcelas, status
    ) VALUES (
      v_pedido_id,
      v_pagamento->>'forma',
      (v_pagamento->>'valor')::NUMERIC,
      NULLIF(v_pagamento->>'vencimento', '')::DATE,
      COALESCE((v_pagamento->>'parcela')::INT, 1),
      COALESCE((v_pagamento->>'total_parcelas')::INT, 1),
      'aberto'
    );
  END LOOP;

  RETURN QUERY SELECT v_pedido_id, v_numero, v_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_pedido_atacado(JSONB) TO authenticated;