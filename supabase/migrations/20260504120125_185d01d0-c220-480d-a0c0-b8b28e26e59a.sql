-- ─────────────────────────────────────────────────────────────────────
-- 1. Buscar OS por filtros estruturados
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ia_buscar_os(
  p_status text[] DEFAULT NULL,
  p_tecnico_id uuid DEFAULT NULL,
  p_cliente_busca text DEFAULT NULL,
  p_data_inicio timestamptz DEFAULT NULL,
  p_data_fim timestamptz DEFAULT NULL,
  p_limite int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_resultado jsonb;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT jsonb_agg(linha) INTO v_resultado FROM (
    SELECT jsonb_build_object(
      'id', o.id,
      'numero', o.numero,
      'numero_formatado', o.numero_formatado,
      'status', o.status::text,
      'cliente', c.nome,
      'aparelho', COALESCE(a.marca, '') || ' ' || COALESCE(a.modelo, ''),
      'data_entrada', o.data_entrada,
      'data_conclusao', o.data_conclusao,
      'previsao_entrega', o.previsao_entrega,
      'valor_total', o.valor_total,
      'tecnico_id', o.funcionario_id
    ) AS linha
    FROM ordens_de_servico o
    LEFT JOIN aparelhos a ON a.id = o.aparelho_id
    LEFT JOIN clientes c ON c.id = a.cliente_id
    WHERE o.empresa_id = v_empresa
      AND o.deleted_at IS NULL
      AND (p_status IS NULL OR o.status::text = ANY(p_status))
      AND (p_tecnico_id IS NULL OR o.funcionario_id = p_tecnico_id)
      AND (p_cliente_busca IS NULL OR c.nome ILIKE '%' || p_cliente_busca || '%')
      AND (p_data_inicio IS NULL OR o.data_entrada >= p_data_inicio)
      AND (p_data_fim IS NULL OR o.data_entrada <= p_data_fim)
    ORDER BY o.data_entrada DESC
    LIMIT LEAST(p_limite, 100)
  ) sub;

  RETURN jsonb_build_object('success', true, 'os', COALESCE(v_resultado, '[]'::jsonb));
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Métricas do período
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ia_metricas_periodo(
  p_inicio timestamptz,
  p_fim timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_faturamento numeric := 0;
  v_custo_pecas numeric := 0;
  v_custo_comissao numeric := 0;
  v_qtd_concluidas int := 0;
  v_qtd_recebidas int := 0;
  v_ticket numeric := 0;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT
    COALESCE(SUM(valor_total), 0),
    COALESCE(SUM(custo_pecas), 0),
    COALESCE(SUM(custo_mao_de_obra), 0),
    COUNT(*)
  INTO v_faturamento, v_custo_pecas, v_custo_comissao, v_qtd_concluidas
  FROM ordens_de_servico
  WHERE empresa_id = v_empresa
    AND deleted_at IS NULL
    AND status::text IN ('pronto', 'entregue')
    AND data_conclusao BETWEEN p_inicio AND p_fim;

  SELECT COUNT(*) INTO v_qtd_recebidas
  FROM ordens_de_servico
  WHERE empresa_id = v_empresa
    AND deleted_at IS NULL
    AND status::text <> 'cancelado'
    AND data_entrada BETWEEN p_inicio AND p_fim;

  IF v_qtd_concluidas > 0 THEN
    v_ticket := v_faturamento / v_qtd_concluidas;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'faturamento', v_faturamento,
    'custo_pecas', v_custo_pecas,
    'custo_comissao', v_custo_comissao,
    'lucro', v_faturamento - v_custo_pecas - v_custo_comissao,
    'margem_pct', CASE WHEN v_faturamento > 0
                       THEN ((v_faturamento - v_custo_pecas - v_custo_comissao) / v_faturamento * 100)
                       ELSE 0 END,
    'qtd_concluidas', v_qtd_concluidas,
    'qtd_recebidas', v_qtd_recebidas,
    'ticket_medio', v_ticket
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. OS em risco de atraso
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ia_os_em_risco_atraso()
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_resultado jsonb;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT jsonb_agg(linha) INTO v_resultado FROM (
    SELECT jsonb_build_object(
      'id', o.id,
      'numero', o.numero,
      'numero_formatado', o.numero_formatado,
      'cliente', c.nome,
      'status', o.status::text,
      'previsao_entrega', o.previsao_entrega,
      'dias_para_prazo', EXTRACT(DAY FROM (o.previsao_entrega - now())),
      'ja_atrasou', o.previsao_entrega < now()
    ) AS linha
    FROM ordens_de_servico o
    LEFT JOIN aparelhos a ON a.id = o.aparelho_id
    LEFT JOIN clientes c ON c.id = a.cliente_id
    WHERE o.empresa_id = v_empresa
      AND o.deleted_at IS NULL
      AND o.status::text NOT IN ('entregue', 'cancelado', 'pronto')
      AND o.previsao_entrega IS NOT NULL
      AND o.previsao_entrega < now() + interval '3 days'
    ORDER BY o.previsao_entrega ASC
    LIMIT 50
  ) sub;

  RETURN jsonb_build_object('success', true, 'os', COALESCE(v_resultado, '[]'::jsonb));
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Lista de compras de peças (usa estoque_itens + estoque_movimentos)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ia_lista_compras_pecas()
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_resultado jsonb;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT jsonb_agg(linha) INTO v_resultado FROM (
    WITH consumo_90d AS (
      SELECT peca_id, SUM(quantidade) AS qtd_consumida
        FROM estoque_movimentos
       WHERE empresa_id = v_empresa
         AND tipo = 'saida'
         AND created_at >= now() - interval '90 days'
       GROUP BY peca_id
    )
    SELECT jsonb_build_object(
      'id', p.id,
      'nome', COALESCE(p.nome_personalizado, p.sku, 'Item ' || p.id::text),
      'estoque_atual', p.quantidade,
      'estoque_minimo', p.quantidade_minima,
      'consumo_90d', COALESCE(c.qtd_consumida, 0),
      'media_mensal', ROUND(COALESCE(c.qtd_consumida, 0) / 3.0, 2),
      'sugestao_compra', GREATEST(
        COALESCE(p.quantidade_minima, 0) - COALESCE(p.quantidade, 0),
        CEIL((COALESCE(c.qtd_consumida, 0) / 3.0) * 1.5)
      )::int,
      'ultimo_custo', COALESCE(p.custo_unitario, p.custo_medio),
      'fornecedor', p.fornecedor,
      'urgencia', CASE
        WHEN p.quantidade <= 0 THEN 'critica'
        WHEN p.quantidade <= COALESCE(p.quantidade_minima, 0) THEN 'alta'
        ELSE 'media'
      END
    ) AS linha
    FROM estoque_itens p
    LEFT JOIN consumo_90d c ON c.peca_id = p.id
    WHERE p.empresa_id = v_empresa
      AND p.deleted_at IS NULL
      AND p.ativo = true
      AND p.tipo_item = 'peca'
      AND (
        p.quantidade <= COALESCE(p.quantidade_minima, 0)
        OR COALESCE(c.qtd_consumida, 0) > COALESCE(p.quantidade, 0) * 0.5
      )
    ORDER BY
      CASE
        WHEN p.quantidade <= 0 THEN 1
        WHEN p.quantidade <= COALESCE(p.quantidade_minima, 0) THEN 2
        ELSE 3
      END,
      COALESCE(p.nome_personalizado, p.sku)
    LIMIT 100
  ) sub;

  RETURN jsonb_build_object('success', true, 'pecas', COALESCE(v_resultado, '[]'::jsonb));
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 5. Histórico de serviço por modelo+defeito
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ia_historico_servico(
  p_modelo text DEFAULT NULL,
  p_defeito text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_resultado jsonb;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT jsonb_build_object(
    'qtd_amostras', COUNT(*),
    'preco_medio', ROUND(AVG(o.valor_total)::numeric, 2),
    'preco_min', MIN(o.valor_total),
    'preco_max', MAX(o.valor_total),
    'custo_pecas_medio', ROUND(AVG(o.custo_pecas)::numeric, 2),
    'tempo_medio_dias', ROUND(AVG(EXTRACT(DAY FROM (o.data_conclusao - o.data_entrada)))::numeric, 1)
  ) INTO v_resultado
  FROM ordens_de_servico o
  LEFT JOIN aparelhos a ON a.id = o.aparelho_id
  WHERE o.empresa_id = v_empresa
    AND o.deleted_at IS NULL
    AND o.status::text IN ('pronto', 'entregue')
    AND (p_modelo IS NULL OR (COALESCE(a.marca, '') || ' ' || COALESCE(a.modelo, '')) ILIKE '%' || p_modelo || '%')
    AND (p_defeito IS NULL OR o.defeito_relatado ILIKE '%' || p_defeito || '%');

  RETURN jsonb_build_object('success', true, 'estatisticas', v_resultado);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 6. Detalhar uma OS
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ia_detalhar_os(p_os_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_resultado jsonb;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT jsonb_build_object(
    'id', o.id,
    'numero', o.numero,
    'numero_formatado', o.numero_formatado,
    'status', o.status::text,
    'cliente', c.nome,
    'telefone', c.telefone,
    'aparelho', COALESCE(a.marca, '') || ' ' || COALESCE(a.modelo, ''),
    'imei', a.imei,
    'defeito', o.defeito_relatado,
    'diagnostico', o.diagnostico,
    'servico_realizado', o.servico_realizado,
    'data_entrada', o.data_entrada,
    'data_conclusao', o.data_conclusao,
    'data_entrega', o.data_entrega,
    'valor_total', o.valor_total,
    'custo_pecas', o.custo_pecas,
    'custo_comissao', o.custo_mao_de_obra,
    'lucro', COALESCE(o.valor_total, 0) - COALESCE(o.custo_pecas, 0) - COALESCE(o.custo_mao_de_obra, 0)
  ) INTO v_resultado
  FROM ordens_de_servico o
  LEFT JOIN aparelhos a ON a.id = o.aparelho_id
  LEFT JOIN clientes c ON c.id = a.cliente_id
  WHERE o.id = p_os_id
    AND o.empresa_id = v_empresa
    AND o.deleted_at IS NULL;

  IF v_resultado IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS não encontrada');
  END IF;

  RETURN jsonb_build_object('success', true, 'os', v_resultado);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 7. Comparar dois períodos
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ia_comparar_periodos(
  p_p1_inicio timestamptz, p_p1_fim timestamptz,
  p_p2_inicio timestamptz, p_p2_fim timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p1 jsonb;
  v_p2 jsonb;
BEGIN
  v_p1 := public.ia_metricas_periodo(p_p1_inicio, p_p1_fim);
  v_p2 := public.ia_metricas_periodo(p_p2_inicio, p_p2_fim);
  RETURN jsonb_build_object('success', true, 'periodo_1', v_p1, 'periodo_2', v_p2);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ia_buscar_os(text[], uuid, text, timestamptz, timestamptz, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ia_metricas_periodo(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ia_os_em_risco_atraso() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ia_lista_compras_pecas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ia_historico_servico(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ia_detalhar_os(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ia_comparar_periodos(timestamptz, timestamptz, timestamptz, timestamptz) TO authenticated;