
CREATE OR REPLACE FUNCTION public.registrar_pagamento_conta(
  p_conta_pagar_id uuid,
  p_valor_centavos bigint,
  p_forma_pagamento text,
  p_data_pagamento date DEFAULT CURRENT_DATE,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_conta record;
  v_pagamento_id uuid;
  v_movimentacao_id uuid;
  v_valor_total_centavos bigint;
  v_valor_pago_atual bigint;
  v_novo_valor_pago bigint;
  v_novo_status text;
BEGIN
  v_empresa_id := get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  IF p_valor_centavos <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor deve ser > 0');
  END IF;

  IF p_forma_pagamento NOT IN ('pix', 'dinheiro', 'cartao', 'transferencia') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forma de pagamento inválida');
  END IF;

  SELECT * INTO v_conta FROM contas_a_pagar
  WHERE id = p_conta_pagar_id AND empresa_id = v_empresa_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_conta IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta não encontrada');
  END IF;

  v_valor_total_centavos := (v_conta.valor * 100)::bigint;
  v_valor_pago_atual := COALESCE(v_conta.valor_pago_centavos, 0);
  v_novo_valor_pago := v_valor_pago_atual + p_valor_centavos;

  IF v_novo_valor_pago > v_valor_total_centavos THEN
    RETURN jsonb_build_object('success', false,
      'error', format('Pagamento ultrapassa o pendente (R$ %s)',
        ((v_valor_total_centavos - v_valor_pago_atual)/100.0)::text));
  END IF;

  IF v_novo_valor_pago >= v_valor_total_centavos THEN
    v_novo_status := 'paga';
  ELSE
    v_novo_status := 'parcial';
  END IF;

  INSERT INTO movimentacoes_financeiras (
    empresa_id, tipo, valor, data, descricao, forma_pagamento, categoria
  ) VALUES (
    v_empresa_id, 'saida', p_valor_centavos / 100.0,
    (p_data_pagamento::timestamptz),
    'Pgto: ' || v_conta.descricao ||
      CASE WHEN v_novo_status = 'parcial' THEN ' (parcial)' ELSE '' END,
    p_forma_pagamento, COALESCE(v_conta.categoria, 'Outros')
  ) RETURNING id INTO v_movimentacao_id;

  INSERT INTO contas_pagar_pagamentos (
    empresa_id, conta_pagar_id, valor_centavos, data_pagamento,
    forma_pagamento, observacao, movimentacao_id
  ) VALUES (
    v_empresa_id, p_conta_pagar_id, p_valor_centavos, p_data_pagamento,
    p_forma_pagamento::forma_pagamento_conta, p_observacao, v_movimentacao_id
  ) RETURNING id INTO v_pagamento_id;

  UPDATE contas_a_pagar SET
    valor_pago_centavos = v_novo_valor_pago,
    status = v_novo_status::status_conta,
    data_pagamento = CASE WHEN v_novo_status = 'paga' THEN p_data_pagamento ELSE data_pagamento END,
    updated_at = now()
  WHERE id = p_conta_pagar_id;

  RETURN jsonb_build_object(
    'success', true,
    'pagamento_id', v_pagamento_id,
    'movimentacao_id', v_movimentacao_id,
    'valor_pago_centavos', v_novo_valor_pago,
    'valor_restante_centavos', v_valor_total_centavos - v_novo_valor_pago,
    'novo_status', v_novo_status
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_pagamento_conta(uuid, bigint, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_conta(uuid, bigint, text, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.historico_pagamentos_conta(p_conta_pagar_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'pagamentos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'valor_centavos', p.valor_centavos,
        'data_pagamento', p.data_pagamento,
        'forma_pagamento', p.forma_pagamento,
        'observacao', p.observacao,
        'created_at', p.created_at,
        'estornado_em', p.estornado_em
      ) ORDER BY p.data_pagamento DESC, p.created_at DESC)
      FROM contas_pagar_pagamentos p
      WHERE p.conta_pagar_id = p_conta_pagar_id
        AND p.empresa_id = v_empresa_id
    ), '[]'::jsonb)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.historico_pagamentos_conta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.historico_pagamentos_conta(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.estornar_pagamento_conta(p_pagamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_pgto record;
  v_conta record;
  v_novo_valor_pago bigint;
  v_novo_status text;
BEGIN
  v_empresa_id := get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT * INTO v_pgto FROM contas_pagar_pagamentos
  WHERE id = p_pagamento_id AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF v_pgto IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pagamento não encontrado');
  END IF;

  IF v_pgto.estornado_em IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pagamento já estornado');
  END IF;

  SELECT * INTO v_conta FROM contas_a_pagar
  WHERE id = v_pgto.conta_pagar_id FOR UPDATE;

  v_novo_valor_pago := GREATEST(COALESCE(v_conta.valor_pago_centavos,0) - v_pgto.valor_centavos, 0);

  IF v_novo_valor_pago = 0 THEN
    v_novo_status := 'pendente';
  ELSIF v_novo_valor_pago < (v_conta.valor * 100)::bigint THEN
    v_novo_status := 'parcial';
  ELSE
    v_novo_status := 'paga';
  END IF;

  UPDATE contas_a_pagar SET
    valor_pago_centavos = v_novo_valor_pago,
    status = v_novo_status::status_conta,
    data_pagamento = CASE WHEN v_novo_status = 'paga' THEN data_pagamento ELSE NULL END,
    updated_at = now()
  WHERE id = v_pgto.conta_pagar_id;

  UPDATE contas_pagar_pagamentos SET
    estornado_em = now(),
    estornado_por = auth.uid()
  WHERE id = p_pagamento_id;

  IF v_pgto.movimentacao_id IS NOT NULL THEN
    UPDATE movimentacoes_financeiras
    SET estornada_em = now()
    WHERE id = v_pgto.movimentacao_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'novo_status', v_novo_status);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.estornar_pagamento_conta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estornar_pagamento_conta(uuid) TO authenticated;
