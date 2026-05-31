
CREATE OR REPLACE FUNCTION public.aprovar_pedido_atacado(
  p_pedido_id UUID,
  p_aprovador_funcionario_id UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status TEXT;
  v_item RECORD;
BEGIN
  SELECT status INTO v_status FROM atacado_pedidos WHERE id = p_pedido_id;
  IF v_status NOT IN ('aguardando_aprovacao', 'rascunho') THEN
    RAISE EXCEPTION 'Pedido não pode ser aprovado nesse status (%)', v_status;
  END IF;

  UPDATE atacado_pedidos
  SET status = 'aprovado',
      aprovado_por = p_aprovador_funcionario_id,
      aprovado_em = NOW(),
      updated_at = NOW()
  WHERE id = p_pedido_id;

  FOR v_item IN
    SELECT aparelho_id, quantidade FROM atacado_pedidos_itens
    WHERE pedido_id = p_pedido_id AND aparelho_id IS NOT NULL
  LOOP
    UPDATE atacado_aparelhos
    SET quantidade = GREATEST(0, quantidade - v_item.quantidade),
        status = CASE WHEN quantidade - v_item.quantidade <= 0 THEN 'vendido' ELSE status END
    WHERE id = v_item.aparelho_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.faturar_pedido_atacado(
  p_pedido_id UUID,
  p_nfe_numero TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status TEXT;
  v_numero_gerado TEXT;
BEGIN
  SELECT status INTO v_status FROM atacado_pedidos WHERE id = p_pedido_id;
  IF v_status != 'aprovado' THEN
    RAISE EXCEPTION 'Apenas pedidos aprovados podem ser faturados';
  END IF;

  v_numero_gerado := COALESCE(p_nfe_numero, 'NFE-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0'));

  UPDATE atacado_pedidos
  SET status = 'faturado',
      faturado_em = NOW(),
      nfe_numero = v_numero_gerado,
      nfe_chave = '00000000000000000000000000000000000000000000',
      updated_at = NOW()
  WHERE id = p_pedido_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_entregue_pedido_atacado(p_pedido_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE atacado_pedidos
  SET status = 'entregue', updated_at = NOW()
  WHERE id = p_pedido_id AND status = 'faturado';
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_pedido_atacado(
  p_pedido_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status TEXT;
  v_item RECORD;
BEGIN
  SELECT status INTO v_status FROM atacado_pedidos WHERE id = p_pedido_id;
  IF v_status IN ('entregue', 'cancelado') THEN
    RAISE EXCEPTION 'Pedido não pode ser cancelado nesse status (%)', v_status;
  END IF;

  IF v_status IN ('aprovado', 'faturado') THEN
    FOR v_item IN
      SELECT aparelho_id, quantidade FROM atacado_pedidos_itens
      WHERE pedido_id = p_pedido_id AND aparelho_id IS NOT NULL
    LOOP
      UPDATE atacado_aparelhos
      SET quantidade = quantidade + v_item.quantidade,
          status = CASE WHEN status = 'vendido' THEN 'estoque' ELSE status END
      WHERE id = v_item.aparelho_id;
    END LOOP;
  END IF;

  UPDATE atacado_pedidos_pagamentos
  SET status = 'cancelado'
  WHERE pedido_id = p_pedido_id AND status IN ('aberto', 'atrasado');

  UPDATE atacado_pedidos
  SET status = 'cancelado',
      observacoes_internas = COALESCE(observacoes_internas, '') ||
        E'\n[CANCELADO ' || NOW()::TEXT || '] ' || COALESCE(p_motivo, 'Sem motivo informado'),
      updated_at = NOW()
  WHERE id = p_pedido_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprovar_pedido_atacado(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.faturar_pedido_atacado(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_entregue_pedido_atacado(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido_atacado(UUID, TEXT) TO authenticated;
