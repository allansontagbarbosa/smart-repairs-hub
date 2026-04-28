CREATE OR REPLACE FUNCTION public.gerar_ou_atualizar_fatura_lojista(p_lojista_id uuid, p_mes text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fatura_id uuid;
  v_empresa_id uuid;
  v_empresa_usuario uuid;
  v_total_servicos numeric := 0;
  v_total_pecas numeric := 0;
BEGIN
  IF p_lojista_id IS NULL THEN
    RAISE EXCEPTION 'Lojista é obrigatório para gerar fatura';
  END IF;

  IF p_mes IS NULL OR p_mes !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'Mês de competência deve estar no formato YYYY-MM';
  END IF;

  v_empresa_usuario := public.get_my_empresa_id();

  SELECT empresa_id
    INTO v_empresa_id
    FROM public.lojistas
    WHERE id = p_lojista_id
      AND deleted_at IS NULL;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Lojista não encontrado ou sem empresa vinculada';
  END IF;

  IF v_empresa_usuario IS NULL OR v_empresa_id IS DISTINCT FROM v_empresa_usuario THEN
    RAISE EXCEPTION 'Lojista não pertence à empresa do usuário autenticado';
  END IF;

  SELECT
    COALESCE(SUM(valor_total_servicos), 0),
    COALESCE(SUM(custo_pecas), 0)
  INTO v_total_servicos, v_total_pecas
  FROM public.ordens_de_servico
  WHERE lojista_id = p_lojista_id
    AND empresa_id = v_empresa_id
    AND status::text = 'entregue'
    AND to_char(COALESCE(data_conclusao, data_entrega), 'YYYY-MM') = p_mes
    AND deleted_at IS NULL;

  INSERT INTO public.lojista_faturas (
    lojista_id,
    empresa_id,
    mes_competencia,
    total_servicos,
    total_pecas,
    total_geral
  ) VALUES (
    p_lojista_id,
    v_empresa_id,
    p_mes,
    v_total_servicos,
    v_total_pecas,
    v_total_servicos + v_total_pecas
  )
  ON CONFLICT (lojista_id, mes_competencia)
  DO UPDATE SET
    total_servicos = EXCLUDED.total_servicos,
    total_pecas = EXCLUDED.total_pecas,
    total_geral = EXCLUDED.total_geral,
    updated_at = now()
  WHERE public.lojista_faturas.status IN ('aberta', 'fechada')
  RETURNING id INTO v_fatura_id;

  IF v_fatura_id IS NULL THEN
    SELECT id INTO v_fatura_id
    FROM public.lojista_faturas
    WHERE lojista_id = p_lojista_id
      AND mes_competencia = p_mes;
  END IF;

  UPDATE public.ordens_de_servico
  SET fatura_id = v_fatura_id
  WHERE lojista_id = p_lojista_id
    AND empresa_id = v_empresa_id
    AND status::text = 'entregue'
    AND to_char(COALESCE(data_conclusao, data_entrega), 'YYYY-MM') = p_mes
    AND deleted_at IS NULL
    AND (fatura_id IS NULL OR fatura_id = v_fatura_id);

  RETURN v_fatura_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gerar_ou_atualizar_fatura_lojista(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gerar_ou_atualizar_fatura_lojista(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gerar_ou_atualizar_fatura_lojista(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.validar_mes_competencia_fatura() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validar_mes_competencia_fatura() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gerar_movimentacao_pagamento_fatura_lojista() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gerar_movimentacao_pagamento_fatura_lojista() FROM anon;