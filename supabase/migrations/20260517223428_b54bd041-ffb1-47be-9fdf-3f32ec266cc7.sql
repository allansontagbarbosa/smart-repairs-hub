BEGIN;

CREATE OR REPLACE FUNCTION public.get_tecnico_kpis_avancado(
  p_funcionario_id UUID,
  p_ano INTEGER DEFAULT NULL,
  p_mes INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa UUID;
  v_ano INTEGER := COALESCE(p_ano, EXTRACT(YEAR FROM now())::INT);
  v_mes INTEGER := COALESCE(p_mes, EXTRACT(MONTH FROM now())::INT);
  v_inicio TIMESTAMPTZ;
  v_fim TIMESTAMPTZ;
  v_inicio_date DATE;
  v_fim_date DATE;
  v_qtd_concluidas INT := 0;
  v_qtd_concluidas_hoje INT := 0;
  v_qtd_concluidas_mes_passado INT := 0;
  v_tempo_medio_min INT := 0;
  v_taxa_retrabalho NUMERIC := 0;
  v_sequencia_dias INT := 0;
  v_meta_qtd_os NUMERIC;
  v_meta_faturamento NUMERIC;
  v_meta JSONB := NULL;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  v_inicio := make_date(v_ano, v_mes, 1)::timestamptz;
  v_fim := (v_inicio + INTERVAL '1 month');
  v_inicio_date := v_inicio::date;
  v_fim_date := (v_fim - INTERVAL '1 day')::date;

  SELECT COUNT(*) INTO v_qtd_concluidas
  FROM public.os_servicos
  WHERE tecnico_id = p_funcionario_id
    AND empresa_id = v_empresa
    AND status = 'concluido'
    AND concluido_em >= v_inicio
    AND concluido_em < v_fim;

  SELECT COUNT(*) INTO v_qtd_concluidas_hoje
  FROM public.os_servicos
  WHERE tecnico_id = p_funcionario_id
    AND empresa_id = v_empresa
    AND status = 'concluido'
    AND concluido_em >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')
    AND concluido_em <  date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 day';

  SELECT COUNT(*) INTO v_qtd_concluidas_mes_passado
  FROM public.os_servicos
  WHERE tecnico_id = p_funcionario_id
    AND empresa_id = v_empresa
    AND status = 'concluido'
    AND concluido_em >= (v_inicio - INTERVAL '1 month')
    AND concluido_em <  v_inicio;

  SELECT COALESCE(
    AVG(EXTRACT(EPOCH FROM (concluido_em - iniciado_em)) / 60)::INT, 0
  ) INTO v_tempo_medio_min
  FROM public.os_servicos
  WHERE tecnico_id = p_funcionario_id
    AND empresa_id = v_empresa
    AND status = 'concluido'
    AND iniciado_em IS NOT NULL
    AND concluido_em IS NOT NULL
    AND concluido_em >= v_inicio
    AND concluido_em < v_fim;

  SELECT COALESCE(
    100.0 * COUNT(*) FILTER (WHERE retrabalhou = TRUE) / NULLIF(COUNT(*), 0)
  , 0)::NUMERIC(5,2)
  INTO v_taxa_retrabalho
  FROM (
    SELECT
      os.id,
      (SELECT COUNT(*) FROM public.os_status_historico h
        WHERE h.os_id = os.id
          AND public.os_status_mapear_legado(h.status_novo) = 'em_reparo'
      ) > 1 AS retrabalhou
    FROM public.ordens_de_servico os
    WHERE os.empresa_id = v_empresa
      AND os.tecnico_responsavel_id = p_funcionario_id
      AND os.deleted_at IS NULL
      AND os.created_at >= v_inicio
      AND os.created_at < v_fim
  ) sub;

  WITH dias_com_os AS (
    SELECT DISTINCT date_trunc('day', concluido_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia
    FROM public.os_servicos
    WHERE tecnico_id = p_funcionario_id
      AND empresa_id = v_empresa
      AND status = 'concluido'
      AND concluido_em >= (now() - INTERVAL '90 days')
  ),
  seq AS (
    SELECT dia, dia - (ROW_NUMBER() OVER (ORDER BY dia))::INT AS grupo
    FROM dias_com_os
  )
  SELECT COALESCE(MAX(qtd), 0) INTO v_sequencia_dias
  FROM (
    SELECT COUNT(*) AS qtd, MAX(dia) AS ultimo_dia
    FROM seq
    GROUP BY grupo
    HAVING MAX(dia) >= (CURRENT_DATE - INTERVAL '1 day')
  ) atual;

  SELECT valor_alvo INTO v_meta_qtd_os
  FROM public.metas
  WHERE escopo = 'tecnico'
    AND escopo_id = p_funcionario_id
    AND empresa_id = v_empresa
    AND deleted_at IS NULL
    AND status = 'ativa'
    AND metrica = 'qtd_os'
    AND periodo_inicio <= v_fim_date
    AND periodo_fim   >= v_inicio_date
  ORDER BY periodo_inicio DESC
  LIMIT 1;

  SELECT valor_alvo INTO v_meta_faturamento
  FROM public.metas
  WHERE escopo = 'tecnico'
    AND escopo_id = p_funcionario_id
    AND empresa_id = v_empresa
    AND deleted_at IS NULL
    AND status = 'ativa'
    AND metrica = 'faturamento'
    AND periodo_inicio <= v_fim_date
    AND periodo_fim   >= v_inicio_date
  ORDER BY periodo_inicio DESC
  LIMIT 1;

  IF v_meta_qtd_os IS NOT NULL OR v_meta_faturamento IS NOT NULL THEN
    v_meta := jsonb_build_object(
      'meta_qtd_os', COALESCE(v_meta_qtd_os, 0)::INT,
      'meta_faturamento', COALESCE(v_meta_faturamento, 0)::NUMERIC
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'qtd_concluidas', v_qtd_concluidas,
      'qtd_concluidas_hoje', v_qtd_concluidas_hoje,
      'qtd_concluidas_mes_passado', v_qtd_concluidas_mes_passado,
      'variacao_pct_vs_mes_passado',
        CASE WHEN v_qtd_concluidas_mes_passado = 0 THEN NULL
        ELSE ((v_qtd_concluidas - v_qtd_concluidas_mes_passado)::NUMERIC
              / v_qtd_concluidas_mes_passado * 100)::NUMERIC(6,2)
        END,
      'tempo_medio_min', v_tempo_medio_min,
      'taxa_retrabalho_pct', v_taxa_retrabalho,
      'sequencia_dias', v_sequencia_dias,
      'meta', v_meta
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.get_tecnico_kpis_avancado(UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tecnico_kpis_avancado(UUID, INTEGER, INTEGER) TO authenticated;

COMMIT;