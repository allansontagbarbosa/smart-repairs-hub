DROP FUNCTION IF EXISTS public.portal_detalhe_ordem(uuid);

CREATE OR REPLACE FUNCTION public.portal_detalhe_ordem(p_ordem_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
  v_resultado  JSONB;
BEGIN
  SELECT c.id INTO v_cliente_id
  FROM public.clientes c
  WHERE c.user_id = auth.uid()
    AND c.tipo_cliente = 'lojista_b2b'
    AND c.deleted_at IS NULL;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'ordem', jsonb_build_object(
      'id', os.id,
      'numero', os.numero,
      'numero_formatado', os.numero_formatado,
      'status', os.status,
      'data_entrada', os.data_entrada,
      'previsao_entrega', os.previsao_entrega,
      'data_entrega', os.data_entrega,
      'data_conclusao', os.data_conclusao,
      'defeito_relatado', os.defeito_relatado,
      'diagnostico', os.diagnostico,
      'servico_realizado', os.servico_realizado,
      'observacoes', os.observacoes,
      'obs_cliente', os.obs_cliente,
      'valor_total', os.valor_total,
      'valor_pago', os.valor_pago,
      'valor_pendente', os.valor_pendente,
      'desconto', os.desconto,
      'sinal_pago', os.sinal_pago,
      'aprovacao_orcamento', os.aprovacao_orcamento,
      'orcamento_aprovado_em', os.orcamento_aprovado_em,
      'orcamento_reprovado_em', os.orcamento_reprovado_em,
      'orcamento_motivo_reprovacao', os.orcamento_motivo_reprovacao,
      'garantia_dias', os.garantia_dias,
      'prioridade', os.prioridade,
      'aparelho', jsonb_build_object(
        'id', a.id,
        'marca', a.marca,
        'modelo', a.modelo,
        'cor', a.cor,
        'capacidade', a.capacidade,
        'imei', a.imei
      )
    )
  ) INTO v_resultado
  FROM public.ordens_de_servico os
  JOIN public.aparelhos a ON a.id = os.aparelho_id
  WHERE os.id = p_ordem_id
    AND a.cliente_id = v_cliente_id
    AND os.deleted_at IS NULL;

  IF v_resultado IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ordem não encontrada');
  END IF;

  RETURN v_resultado;
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_detalhe_ordem(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_meus_aparelhos()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
  v_resultado  JSONB;
BEGIN
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE user_id = auth.uid()
    AND tipo_cliente = 'lojista_b2b'
    AND deleted_at IS NULL;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'aparelhos', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'marca', a.marca,
        'modelo', a.modelo,
        'cor', a.cor,
        'capacidade', a.capacidade,
        'imei', a.imei,
        'created_at', a.created_at,
        'qtd_oss', (
          SELECT COUNT(*) FROM public.ordens_de_servico os
          WHERE os.aparelho_id = a.id AND os.deleted_at IS NULL
        ),
        'ultima_os_em', (
          SELECT MAX(os.created_at) FROM public.ordens_de_servico os
          WHERE os.aparelho_id = a.id AND os.deleted_at IS NULL
        )
      ) ORDER BY a.created_at DESC
    ), '[]'::jsonb)
  ) INTO v_resultado
  FROM public.aparelhos a
  WHERE a.cliente_id = v_cliente_id;

  RETURN v_resultado;
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_meus_aparelhos() TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_minhas_garantias()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
  v_resultado  JSONB;
BEGIN
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE user_id = auth.uid()
    AND tipo_cliente = 'lojista_b2b'
    AND deleted_at IS NULL;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'garantias', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'ordem_id', g.ordem_id,
        'numero_os', os.numero_formatado,
        'data_inicio', g.data_inicio,
        'data_fim', g.data_fim,
        'dias_garantia', g.dias_garantia,
        'status', g.status,
        'ativa', (g.data_fim >= CURRENT_DATE AND g.status = 'ativa'),
        'dias_restantes', GREATEST(0, (g.data_fim - CURRENT_DATE)::int),
        'aparelho_marca', a.marca,
        'aparelho_modelo', a.modelo,
        'aparelho_imei', a.imei,
        'observacoes', g.observacoes
      ) ORDER BY g.data_fim DESC
    ), '[]'::jsonb)
  ) INTO v_resultado
  FROM public.garantias g
  JOIN public.ordens_de_servico os ON os.id = g.ordem_id
  JOIN public.aparelhos a ON a.id = os.aparelho_id
  WHERE a.cliente_id = v_cliente_id
    AND os.deleted_at IS NULL;

  RETURN v_resultado;
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_minhas_garantias() TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_extrato_financeiro(p_dias INT DEFAULT 90)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
  v_data_corte DATE;
  v_total_faturado NUMERIC := 0;
  v_total_pago NUMERIC := 0;
  v_saldo_devedor NUMERIC := 0;
  v_lancamentos JSONB;
BEGIN
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE user_id = auth.uid()
    AND tipo_cliente = 'lojista_b2b'
    AND deleted_at IS NULL;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  v_data_corte := CURRENT_DATE - p_dias;

  SELECT COALESCE(SUM(os.valor_total), 0) INTO v_total_faturado
  FROM public.ordens_de_servico os
  JOIN public.aparelhos a ON a.id = os.aparelho_id
  WHERE a.cliente_id = v_cliente_id
    AND os.deleted_at IS NULL
    AND os.status = 'entregue';

  SELECT COALESCE(SUM(valor), 0) INTO v_total_pago
  FROM public.pagamentos_clientes
  WHERE cliente_id = v_cliente_id
    AND deleted_at IS NULL;

  v_saldo_devedor := GREATEST(0, v_total_faturado - v_total_pago);

  SELECT jsonb_agg(linha ORDER BY data DESC) INTO v_lancamentos
  FROM (
    SELECT
      os.id::text AS id,
      'os' AS tipo,
      'debito' AS direcao,
      os.data_conclusao::date AS data,
      'OS #' || os.numero_formatado AS descricao,
      os.valor_total AS valor,
      os.numero_formatado AS referencia
    FROM public.ordens_de_servico os
    JOIN public.aparelhos a ON a.id = os.aparelho_id
    WHERE a.cliente_id = v_cliente_id
      AND os.deleted_at IS NULL
      AND os.status = 'entregue'
      AND os.data_conclusao IS NOT NULL
      AND os.data_conclusao::date >= v_data_corte
    UNION ALL
    SELECT
      pc.id::text AS id,
      'pagamento' AS tipo,
      'credito' AS direcao,
      pc.data_pagamento AS data,
      'Pagamento ' || COALESCE(pc.forma_pagamento, '') AS descricao,
      pc.valor AS valor,
      NULL AS referencia
    FROM public.pagamentos_clientes pc
    WHERE pc.cliente_id = v_cliente_id
      AND pc.deleted_at IS NULL
      AND pc.data_pagamento >= v_data_corte
  ) linha;

  RETURN jsonb_build_object(
    'success', true,
    'saldo', jsonb_build_object(
      'total_faturado', v_total_faturado,
      'total_pago', v_total_pago,
      'devedor', v_saldo_devedor
    ),
    'periodo_dias', p_dias,
    'lancamentos', COALESCE(v_lancamentos, '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_extrato_financeiro(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_atualizar_meu_perfil(p_dados JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
BEGIN
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE user_id = auth.uid()
    AND tipo_cliente = 'lojista_b2b'
    AND deleted_at IS NULL;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  UPDATE public.clientes SET
    telefone = COALESCE(p_dados->>'telefone', telefone),
    whatsapp = COALESCE(p_dados->>'whatsapp', whatsapp),
    cep = COALESCE(p_dados->>'cep', cep),
    rua = COALESCE(p_dados->>'rua', rua),
    numero_endereco = COALESCE(p_dados->>'numero_endereco', numero_endereco),
    complemento = CASE WHEN p_dados ? 'complemento' THEN NULLIF(p_dados->>'complemento','') ELSE complemento END,
    bairro = COALESCE(p_dados->>'bairro', bairro),
    cidade = COALESCE(p_dados->>'cidade', cidade),
    estado = COALESCE(p_dados->>'estado', estado),
    updated_at = NOW()
  WHERE id = v_cliente_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_atualizar_meu_perfil(JSONB) TO authenticated;