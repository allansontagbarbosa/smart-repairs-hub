
-- BANCADAS
CREATE OR REPLACE FUNCTION public.get_dashboard_bancadas()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_empresa UUID; v_resultado JSONB;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;
  SELECT jsonb_build_object(
    'success', true,
    'data', COALESCE(jsonb_agg(b ORDER BY b.qtd_total DESC), '[]'::jsonb)
  ) INTO v_resultado
  FROM (
    SELECT
      f.id AS funcionario_id, f.nome AS nome,
      COUNT(os.id) AS qtd_total,
      COUNT(*) FILTER (WHERE public.os_status_mapear_legado(os.status::text) = 'recebido') AS qtd_recebido,
      COUNT(*) FILTER (WHERE public.os_status_mapear_legado(os.status::text) = 'em_analise') AS qtd_em_analise,
      COUNT(*) FILTER (WHERE public.os_status_mapear_legado(os.status::text) = 'aprovacao') AS qtd_aprovacao,
      COUNT(*) FILTER (WHERE public.os_status_mapear_legado(os.status::text) = 'em_reparo') AS qtd_em_reparo,
      COUNT(*) FILTER (WHERE public.os_status_mapear_legado(os.status::text) = 'aguardando_peca') AS qtd_aguardando_peca
    FROM public.funcionarios f
    LEFT JOIN public.ordens_de_servico os
      ON os.tecnico_responsavel_id = f.id
      AND os.empresa_id = v_empresa
      AND os.deleted_at IS NULL
      AND public.os_status_em_casa(os.status::text) = TRUE
    WHERE f.empresa_id = v_empresa AND f.ativo = TRUE
    GROUP BY f.id, f.nome
  ) b;
  RETURN v_resultado;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END; $$;

-- CONTADORES
CREATE OR REPLACE FUNCTION public.get_dashboard_contadores_status()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_empresa UUID; v_resultado JSONB;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;
  SELECT jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'recebido',        COUNT(*) FILTER (WHERE public.os_status_mapear_legado(status::text) = 'recebido'),
      'em_analise',      COUNT(*) FILTER (WHERE public.os_status_mapear_legado(status::text) = 'em_analise'),
      'aprovacao',       COUNT(*) FILTER (WHERE public.os_status_mapear_legado(status::text) = 'aprovacao'),
      'em_reparo',       COUNT(*) FILTER (WHERE public.os_status_mapear_legado(status::text) = 'em_reparo'),
      'aguardando_peca', COUNT(*) FILTER (WHERE public.os_status_mapear_legado(status::text) = 'aguardando_peca'),
      'pronto',          COUNT(*) FILTER (WHERE public.os_status_mapear_legado(status::text) = 'pronto'),
      'entregue_hoje',   COUNT(*) FILTER (WHERE public.os_status_mapear_legado(status::text) = 'entregue' AND DATE(updated_at) = CURRENT_DATE),
      'total_em_casa',   COUNT(*) FILTER (WHERE public.os_status_em_casa(status::text) = TRUE)
    )
  ) INTO v_resultado
  FROM public.ordens_de_servico
  WHERE empresa_id = v_empresa AND deleted_at IS NULL;
  RETURN v_resultado;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END; $$;

-- CAIXA HOJE
CREATE OR REPLACE FUNCTION public.get_dashboard_caixa_hoje()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_empresa UUID; v_resultado JSONB;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;
  SELECT jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'entrada_hoje', COALESCE(SUM(valor_total), 0),
      'qtd_os_pagas', COUNT(*)
    )
  ) INTO v_resultado
  FROM public.ordens_de_servico
  WHERE empresa_id = v_empresa
    AND deleted_at IS NULL
    AND public.os_status_mapear_legado(status::text) = 'paga'
    AND DATE(updated_at) = CURRENT_DATE;
  RETURN v_resultado;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END; $$;

-- LUCRO MES
CREATE OR REPLACE FUNCTION public.get_dashboard_lucro_mes()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_empresa UUID;
  v_receita NUMERIC := 0;
  v_custo_pecas NUMERIC := 0;
  v_custo_comissao NUMERIC := 0;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT
    COALESCE(SUM(valor_total), 0),
    COALESCE(SUM(COALESCE(custo_pecas, 0)), 0)
  INTO v_receita, v_custo_pecas
  FROM public.ordens_de_servico
  WHERE empresa_id = v_empresa
    AND deleted_at IS NULL
    AND public.os_status_reconhece_receita(status::text) = TRUE
    AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', CURRENT_DATE);

  SELECT COALESCE(SUM(c.valor), 0)
  INTO v_custo_comissao
  FROM public.comissoes c
  JOIN public.ordens_de_servico os ON os.id = c.ordem_id
  WHERE c.empresa_id = v_empresa
    AND os.deleted_at IS NULL
    AND public.os_status_reconhece_receita(os.status::text) = TRUE
    AND DATE_TRUNC('month', os.updated_at) = DATE_TRUNC('month', CURRENT_DATE);

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'regime', 'competencia',
      'receita', v_receita,
      'custo_pecas', v_custo_pecas,
      'custo_comissao', v_custo_comissao,
      'lucro', v_receita - v_custo_pecas - v_custo_comissao,
      'margem_pct', CASE WHEN v_receita > 0
        THEN ROUND(((v_receita - v_custo_pecas - v_custo_comissao) / v_receita * 100)::NUMERIC, 1)
        ELSE 0 END
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END; $$;

-- RANKING MES
CREATE OR REPLACE FUNCTION public.get_dashboard_ranking_mes()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_empresa UUID; v_resultado JSONB;
  v_ano INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_mes INTEGER := EXTRACT(MONTH FROM CURRENT_DATE);
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  WITH desempenho AS (
    SELECT
      f.id AS funcionario_id, f.nome AS nome,
      COUNT(os.id) AS qtd_concluidas,
      COALESCE(SUM(os.valor_total), 0) AS faturamento,
      m.meta_qtd_os, m.meta_faturamento
    FROM public.funcionarios f
    LEFT JOIN public.ordens_de_servico os
      ON os.tecnico_responsavel_id = f.id
      AND os.empresa_id = v_empresa
      AND os.deleted_at IS NULL
      AND public.os_status_reconhece_receita(os.status::text) = TRUE
      AND DATE_TRUNC('month', os.updated_at) = DATE_TRUNC('month', CURRENT_DATE)
    LEFT JOIN public.metas_tecnico_mensais m
      ON m.funcionario_id = f.id AND m.empresa_id = v_empresa
      AND m.ano = v_ano AND m.mes = v_mes
    WHERE f.empresa_id = v_empresa AND f.ativo = TRUE
    GROUP BY f.id, f.nome, m.meta_qtd_os, m.meta_faturamento
  )
  SELECT jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'mes', v_mes, 'ano', v_ano,
      'tecnicos', COALESCE(jsonb_agg(
        jsonb_build_object(
          'funcionario_id', funcionario_id,
          'nome', nome,
          'qtd_concluidas', qtd_concluidas,
          'faturamento', faturamento,
          'meta_qtd', meta_qtd_os,
          'meta_faturamento', meta_faturamento,
          'pct_qtd', CASE WHEN meta_qtd_os IS NOT NULL AND meta_qtd_os > 0
            THEN ROUND((qtd_concluidas::NUMERIC / meta_qtd_os * 100), 1) ELSE NULL END,
          'pct_faturamento', CASE WHEN meta_faturamento IS NOT NULL AND meta_faturamento > 0
            THEN ROUND((faturamento / meta_faturamento * 100)::NUMERIC, 1) ELSE NULL END
        )
        ORDER BY qtd_concluidas DESC, faturamento DESC
      ), '[]'::jsonb)
    )
  ) INTO v_resultado
  FROM desempenho;

  RETURN v_resultado;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END; $$;
