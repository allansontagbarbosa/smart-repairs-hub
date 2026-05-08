CREATE OR REPLACE FUNCTION public.listar_prejuizos(
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_tipo public.tipo_prejuizo DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa_id uuid;
  v_total integer;
  v_lista jsonb;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado'); END IF;
  SELECT empresa_id INTO v_empresa_id FROM public.user_profiles WHERE user_id = v_user_id LIMIT 1;
  IF v_empresa_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Empresa não encontrada'); END IF;

  SELECT COUNT(*) INTO v_total FROM public.prejuizos p
  WHERE p.empresa_id = v_empresa_id AND p.deleted_at IS NULL
    AND (p_data_inicio IS NULL OR p.data_evento >= p_data_inicio)
    AND (p_data_fim IS NULL OR p.data_evento <= p_data_fim)
    AND (p_tipo IS NULL OR p.tipo = p_tipo)
    AND (p_origem IS NULL OR p.origem = p_origem);

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'tipo', p.tipo::text,
      'tipo_label', CASE p.tipo
        WHEN 'garantia' THEN 'Garantia'
        WHEN 'peca_danificada' THEN 'Peça danificada'
        WHEN 'cliente_sumiu' THEN 'Cliente sumiu'
        WHEN 'fraude_chargeback' THEN 'Fraude/Chargeback'
        WHEN 'furto_extravio' THEN 'Furto/Extravio'
        WHEN 'cancelamento_com_peca' THEN 'Cancelamento com peça'
        ELSE 'Outro' END,
      'valor_centavos', p.valor_centavos,
      'descricao', p.descricao,
      'observacoes', p.observacoes,
      'data_evento', p.data_evento,
      'origem', p.origem,
      'created_at', p.created_at,
      'created_by_nome', u_created.nome,
      'os_origem', CASE WHEN os_orig.id IS NOT NULL THEN
        jsonb_build_object('id', os_orig.id, 'numero', os_orig.numero, 'numero_formatado', os_orig.numero_formatado)
        ELSE NULL END,
      'os_retrabalho', CASE WHEN os_retrab.id IS NOT NULL THEN
        jsonb_build_object('id', os_retrab.id, 'numero', os_retrab.numero, 'numero_formatado', os_retrab.numero_formatado)
        ELSE NULL END,
      'movimentacao_financeira_id', p.movimentacao_financeira_id
    ) ORDER BY p.data_evento DESC, p.created_at DESC
  ) INTO v_lista
  FROM (
    SELECT * FROM public.prejuizos
    WHERE empresa_id = v_empresa_id AND deleted_at IS NULL
      AND (p_data_inicio IS NULL OR data_evento >= p_data_inicio)
      AND (p_data_fim IS NULL OR data_evento <= p_data_fim)
      AND (p_tipo IS NULL OR tipo = p_tipo)
      AND (p_origem IS NULL OR origem = p_origem)
    ORDER BY data_evento DESC, created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) p
  LEFT JOIN public.ordens_de_servico os_orig ON os_orig.id = p.os_origem_id
  LEFT JOIN public.ordens_de_servico os_retrab ON os_retrab.id = p.os_retrabalho_id
  LEFT JOIN public.user_profiles u_created ON u_created.user_id = p.created_by;

  RETURN jsonb_build_object('success', true, 'total', v_total, 'limit', p_limit, 'offset', p_offset,
    'prejuizos', COALESCE(v_lista, '[]'::jsonb));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END $$;

CREATE OR REPLACE FUNCTION public.prejuizos_resumo_periodo(
  p_data_inicio date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  p_data_fim date DEFAULT CURRENT_DATE
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa_id uuid;
  v_total_centavos bigint; v_qtd integer;
  v_total_centavos_anterior bigint; v_qtd_anterior integer;
  v_dias integer; v_periodo_anterior_inicio date; v_periodo_anterior_fim date;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado'); END IF;
  SELECT empresa_id INTO v_empresa_id FROM public.user_profiles WHERE user_id = v_user_id LIMIT 1;
  IF v_empresa_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Empresa não encontrada'); END IF;

  SELECT COALESCE(SUM(valor_centavos), 0), COUNT(*) INTO v_total_centavos, v_qtd
  FROM public.prejuizos
  WHERE empresa_id = v_empresa_id AND deleted_at IS NULL
    AND data_evento BETWEEN p_data_inicio AND p_data_fim;

  v_dias := (p_data_fim - p_data_inicio) + 1;
  v_periodo_anterior_fim := p_data_inicio - 1;
  v_periodo_anterior_inicio := v_periodo_anterior_fim - v_dias + 1;

  SELECT COALESCE(SUM(valor_centavos), 0), COUNT(*) INTO v_total_centavos_anterior, v_qtd_anterior
  FROM public.prejuizos
  WHERE empresa_id = v_empresa_id AND deleted_at IS NULL
    AND data_evento BETWEEN v_periodo_anterior_inicio AND v_periodo_anterior_fim;

  RETURN jsonb_build_object(
    'success', true,
    'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim, 'total_centavos', v_total_centavos, 'qtd', v_qtd),
    'periodo_anterior', jsonb_build_object('inicio', v_periodo_anterior_inicio, 'fim', v_periodo_anterior_fim, 'total_centavos', v_total_centavos_anterior, 'qtd', v_qtd_anterior),
    'variacao_pct', CASE WHEN v_total_centavos_anterior > 0 THEN
      ROUND(((v_total_centavos - v_total_centavos_anterior)::numeric / v_total_centavos_anterior) * 100, 2)
      ELSE NULL END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END $$;

CREATE OR REPLACE FUNCTION public.prejuizos_por_tipo(
  p_data_inicio date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  p_data_fim date DEFAULT CURRENT_DATE
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa_id uuid;
  v_resultado jsonb;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado'); END IF;
  SELECT empresa_id INTO v_empresa_id FROM public.user_profiles WHERE user_id = v_user_id LIMIT 1;
  IF v_empresa_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Empresa não encontrada'); END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'tipo', tipo::text,
      'tipo_label', CASE tipo
        WHEN 'garantia' THEN 'Garantia'
        WHEN 'peca_danificada' THEN 'Peça danificada'
        WHEN 'cliente_sumiu' THEN 'Cliente sumiu'
        WHEN 'fraude_chargeback' THEN 'Fraude/Chargeback'
        WHEN 'furto_extravio' THEN 'Furto/Extravio'
        WHEN 'cancelamento_com_peca' THEN 'Cancelamento com peça'
        ELSE 'Outro' END,
      'qtd', qtd,
      'total_centavos', total_centavos
    ) ORDER BY total_centavos DESC
  ) INTO v_resultado
  FROM (
    SELECT tipo, COUNT(*) AS qtd, SUM(valor_centavos) AS total_centavos
    FROM public.prejuizos
    WHERE empresa_id = v_empresa_id AND deleted_at IS NULL
      AND data_evento BETWEEN p_data_inicio AND p_data_fim
    GROUP BY tipo
  ) t;

  RETURN jsonb_build_object('success', true, 'periodo_inicio', p_data_inicio, 'periodo_fim', p_data_fim,
    'tipos', COALESCE(v_resultado, '[]'::jsonb));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END $$;

GRANT EXECUTE ON FUNCTION public.listar_prejuizos TO authenticated;
GRANT EXECUTE ON FUNCTION public.prejuizos_resumo_periodo TO authenticated;
GRANT EXECUTE ON FUNCTION public.prejuizos_por_tipo TO authenticated;
NOTIFY pgrst, 'reload schema';