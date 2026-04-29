CREATE OR REPLACE FUNCTION public.recalcular_custo_medio(p_peca_id uuid, p_quantidade_entrada numeric, p_preco_compra_unitario numeric, p_origem text, p_origem_id uuid DEFAULT NULL::uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estoque_atual NUMERIC;
  v_custo_atual NUMERIC;
  v_novo_custo NUMERIC;
  v_empresa_id UUID;
BEGIN
  SELECT quantidade, COALESCE(custo_medio, 0), empresa_id
    INTO v_estoque_atual, v_custo_atual, v_empresa_id
    FROM public.estoque_itens
    WHERE id = p_peca_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Peça % não encontrada', p_peca_id;
  END IF;

  IF (v_estoque_atual + p_quantidade_entrada) > 0 THEN
    v_novo_custo := (
      (v_estoque_atual * v_custo_atual)
      + (p_quantidade_entrada * p_preco_compra_unitario)
    ) / (v_estoque_atual + p_quantidade_entrada);
  ELSE
    v_novo_custo := p_preco_compra_unitario;
  END IF;

  UPDATE public.estoque_itens
    SET quantidade = quantidade + p_quantidade_entrada::int,
        custo_medio = v_novo_custo,
        custo_unitario = v_novo_custo,
        updated_at = now()
    WHERE id = p_peca_id;

  INSERT INTO public.estoque_movimentos (
    empresa_id,
    peca_id,
    os_id,
    pecas_utilizadas_id,
    tipo,
    quantidade,
    motivo
  ) VALUES (
    v_empresa_id,
    p_peca_id,
    NULL,
    NULL,
    'entrada_compra',
    p_quantidade_entrada,
    COALESCE('Entrada via ' || p_origem || COALESCE(' (' || p_origem_id::text || ')', ''), 'Entrada de estoque')
  );

  INSERT INTO public.historico_custo_peca (
    empresa_id, peca_id, custo_anterior, custo_novo,
    quantidade_anterior, quantidade_movimentada, preco_compra_unitario,
    origem, origem_id, registrado_por
  ) VALUES (
    v_empresa_id, p_peca_id, v_custo_atual, v_novo_custo,
    v_estoque_atual, p_quantidade_entrada, p_preco_compra_unitario,
    p_origem, p_origem_id, auth.uid()
  );

  RETURN v_novo_custo;
END;
$function$;