
CREATE OR REPLACE FUNCTION public.portal_minhas_garantias()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_grupo_id uuid;
  v_cliente_ids uuid[];
  v_aparelho_ids uuid[];
  v_garantias jsonb := '[]'::jsonb;
  v_ativas int := 0;
  v_expirando int := 0;
  v_expiradas int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id INTO v_grupo_id
    FROM lojista_grupos
   WHERE user_id = v_user_id
     AND status_acesso = 'ativo'
     AND convite_aceito_em IS NOT NULL
   LIMIT 1;

  IF v_grupo_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_cliente_ids
    FROM clientes WHERE grupo_id = v_grupo_id AND deleted_at IS NULL;

  IF array_length(v_cliente_ids,1) IS NULL THEN
    RETURN jsonb_build_object('success', true, 'garantias', '[]'::jsonb,
      'resumo', jsonb_build_object('total_ativas',0,'expirando_30d',0,'ja_expiradas',0));
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_aparelho_ids
    FROM aparelhos WHERE cliente_id = ANY(v_cliente_ids);

  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', g.id,
      'ordem_id', g.ordem_id,
      'ordem_numero', os.numero_formatado,
      'data_inicio', g.data_inicio,
      'data_fim', g.data_fim,
      'dias_garantia', g.dias_garantia,
      'status', g.status,
      'ativa', (g.status='ativa' AND g.data_fim >= CURRENT_DATE),
      'dias_restantes', (g.data_fim - CURRENT_DATE)::int,
      'aparelho', jsonb_build_object('marca', a.marca, 'modelo', a.modelo, 'imei', a.imei),
      'cliente_nome', c.nome,
      'observacoes', g.observacoes
    ) ORDER BY g.data_fim DESC), '[]'::jsonb),
    COUNT(*) FILTER (WHERE g.status='ativa' AND g.data_fim >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE g.status='ativa' AND g.data_fim >= CURRENT_DATE AND g.data_fim < CURRENT_DATE + 30),
    COUNT(*) FILTER (WHERE g.data_fim < CURRENT_DATE OR g.status <> 'ativa')
  INTO v_garantias, v_ativas, v_expirando, v_expiradas
  FROM garantias g
  JOIN ordens_de_servico os ON os.id = g.ordem_id
  JOIN aparelhos a ON a.id = os.aparelho_id
  JOIN clientes c ON c.id = a.cliente_id
  WHERE os.aparelho_id = ANY(v_aparelho_ids)
    AND os.deleted_at IS NULL
    AND os.status = 'entregue'::status_ordem;

  RETURN jsonb_build_object(
    'success', true,
    'garantias', v_garantias,
    'resumo', jsonb_build_object(
      'total_ativas', v_ativas,
      'expirando_30d', v_expirando,
      'ja_expiradas', v_expiradas
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.portal_minhas_garantias() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_minhas_garantias() TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_extrato_financeiro(p_dias integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_grupo_id uuid;
  v_cliente_ids uuid[];
  v_aparelho_ids uuid[];
  v_data_corte date := CURRENT_DATE - COALESCE(p_dias, 90);
  v_faturado numeric := 0;
  v_pago numeric := 0;
  v_movimentos jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id INTO v_grupo_id
    FROM lojista_grupos
   WHERE user_id = v_user_id
     AND status_acesso = 'ativo'
     AND convite_aceito_em IS NOT NULL
   LIMIT 1;

  IF v_grupo_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_cliente_ids
    FROM clientes WHERE grupo_id = v_grupo_id AND deleted_at IS NULL;

  IF array_length(v_cliente_ids,1) IS NULL THEN
    RETURN jsonb_build_object('success', true,
      'resumo', jsonb_build_object('faturado',0,'pago',0,'devedor',0),
      'periodo_dias', p_dias, 'movimentos', '[]'::jsonb);
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_aparelho_ids
    FROM aparelhos WHERE cliente_id = ANY(v_cliente_ids);

  SELECT COALESCE(SUM(COALESCE(valor_total,0)),0) INTO v_faturado
    FROM ordens_de_servico
   WHERE aparelho_id = ANY(v_aparelho_ids)
     AND deleted_at IS NULL
     AND status = 'entregue'::status_ordem;

  SELECT COALESCE(SUM(COALESCE(valor,0)),0) INTO v_pago
    FROM pagamentos_clientes
   WHERE cliente_id = ANY(v_cliente_ids) AND deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(linha ORDER BY data DESC, tipo), '[]'::jsonb) INTO v_movimentos
  FROM (
    SELECT 'fatura'::text AS tipo,
           os.data_conclusao::date AS data,
           os.valor_total AS valor,
           'OS #' || os.numero_formatado AS descricao,
           os.numero_formatado AS ordem_numero,
           NULL::text AS forma_pagamento,
           c.nome AS cliente_nome
      FROM ordens_de_servico os
      JOIN aparelhos a ON a.id = os.aparelho_id
      JOIN clientes c ON c.id = a.cliente_id
     WHERE os.aparelho_id = ANY(v_aparelho_ids)
       AND os.deleted_at IS NULL
       AND os.status = 'entregue'::status_ordem
       AND os.data_conclusao IS NOT NULL
       AND os.data_conclusao::date >= v_data_corte
    UNION ALL
    SELECT 'pagamento'::text,
           pc.data_pagamento,
           pc.valor,
           'Pagamento ' || COALESCE(pc.forma_pagamento,''),
           NULL,
           pc.forma_pagamento,
           c.nome
      FROM pagamentos_clientes pc
      JOIN clientes c ON c.id = pc.cliente_id
     WHERE pc.cliente_id = ANY(v_cliente_ids)
       AND pc.deleted_at IS NULL
       AND pc.data_pagamento >= v_data_corte
  ) linha;

  RETURN jsonb_build_object(
    'success', true,
    'resumo', jsonb_build_object(
      'faturado', v_faturado,
      'pago', v_pago,
      'devedor', GREATEST(v_faturado - v_pago, 0)
    ),
    'periodo_dias', p_dias,
    'movimentos', v_movimentos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.portal_extrato_financeiro(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_extrato_financeiro(integer) TO authenticated;
