CREATE OR REPLACE FUNCTION public.gerar_fatura_cliente(p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa  uuid := public.get_my_empresa_id();
  v_pago     numeric;
  v_faturado numeric;
  v_itens    jsonb;
  v_quitados jsonb;
  v_cliente  jsonb;
BEGIN
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário sem empresa vinculada');
  END IF;

  PERFORM 1 FROM clientes c
   WHERE c.id = p_cliente_id AND c.empresa_id = v_empresa AND c.deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado nesta empresa');
  END IF;

  SELECT jsonb_build_object('id', c.id, 'nome', c.nome)
    INTO v_cliente FROM clientes c WHERE c.id = p_cliente_id;

  SELECT COALESCE(SUM(pc.valor), 0) INTO v_pago
    FROM pagamentos_clientes pc
   WHERE pc.cliente_id = p_cliente_id AND pc.deleted_at IS NULL;

  WITH os_fat AS (
    SELECT os.id,
           os.numero_formatado AS numero,
           os.valor_total,
           COALESCE(os.data_conclusao, os.data_entrega, os.data_entrada)::date AS data_ref,
           NULLIF(trim(coalesce(a.marca,'') || ' ' || coalesce(a.modelo,'')), '') AS aparelho,
           (SELECT string_agg(s.nome, ' + ')
              FROM os_servicos s
             WHERE s.ordem_id = os.id) AS servico
      FROM ordens_de_servico os
      JOIN aparelhos a ON a.id = os.aparelho_id
     WHERE a.cliente_id = p_cliente_id
       AND os.deleted_at IS NULL
       AND os.status IN ('entregue'::status_ordem, 'pronto'::status_ordem)
  ),
  ordenado AS (
    SELECT *,
           COALESCE(SUM(valor_total) OVER (
             ORDER BY data_ref, id
             ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS acum_antes
      FROM os_fat
  ),
  calc AS (
    SELECT *,
      CASE
        WHEN v_pago >= acum_antes + valor_total THEN 0
        WHEN v_pago <= acum_antes              THEN valor_total
        ELSE (acum_antes + valor_total) - v_pago
      END AS saldo_aberto
      FROM ordenado
  )
  SELECT
    COALESCE(SUM(valor_total), 0),
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'os_id', id, 'numero', numero, 'aparelho', aparelho, 'servico', servico,
        'data', data_ref, 'valor_original', valor_total, 'saldo_aberto', saldo_aberto,
        'parcial', (saldo_aberto > 0 AND saldo_aberto < valor_total)
      ) ORDER BY data_ref, id
    ) FILTER (WHERE saldo_aberto > 0), '[]'::jsonb),
    COALESCE(jsonb_agg(numero ORDER BY data_ref, id)
             FILTER (WHERE saldo_aberto = 0), '[]'::jsonb)
  INTO v_faturado, v_itens, v_quitados
  FROM calc;

  RETURN jsonb_build_object(
    'success', true,
    'cliente', v_cliente,
    'resumo', jsonb_build_object(
      'faturado', v_faturado,
      'pago',     LEAST(v_pago, v_faturado),
      'devedor',  GREATEST(v_faturado - v_pago, 0)
    ),
    'itens', v_itens,
    'quitados', jsonb_build_object(
      'quantidade', jsonb_array_length(v_quitados),
      'numeros',    v_quitados
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_fatura_cliente(uuid) TO authenticated;