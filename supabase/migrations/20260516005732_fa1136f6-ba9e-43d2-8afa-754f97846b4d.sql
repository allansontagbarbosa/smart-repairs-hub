
BEGIN;

CREATE TABLE IF NOT EXISTS public.metas_tecnico_mensais (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL,
  funcionario_id  UUID NOT NULL,
  ano             INTEGER NOT NULL CHECK (ano BETWEEN 2020 AND 2100),
  mes             INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  meta_qtd_os     INTEGER NULL CHECK (meta_qtd_os IS NULL OR meta_qtd_os > 0),
  meta_faturamento NUMERIC(12,2) NULL CHECK (meta_faturamento IS NULL OR meta_faturamento > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NULL,
  UNIQUE (empresa_id, funcionario_id, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_metas_empresa_periodo
  ON public.metas_tecnico_mensais(empresa_id, ano, mes);

ALTER TABLE public.metas_tecnico_mensais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "metas_select" ON public.metas_tecnico_mensais;
CREATE POLICY "metas_select" ON public.metas_tecnico_mensais FOR SELECT
  USING (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "metas_insert" ON public.metas_tecnico_mensais;
CREATE POLICY "metas_insert" ON public.metas_tecnico_mensais FOR INSERT
  WITH CHECK (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "metas_update" ON public.metas_tecnico_mensais;
CREATE POLICY "metas_update" ON public.metas_tecnico_mensais FOR UPDATE
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- 2. BANCADAS
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
      COUNT(*) FILTER (WHERE public.os_status_mapear_legado(os.status) = 'recebido') AS qtd_recebido,
      COUNT(*) FILTER (WHERE public.os_status_mapear_legado(os.status) = 'em_analise') AS qtd_em_analise,
      COUNT(*) FILTER (WHERE public.os_status_mapear_legado(os.status) = 'aprovacao') AS qtd_aprovacao,
      COUNT(*) FILTER (WHERE public.os_status_mapear_legado(os.status) = 'em_reparo') AS qtd_em_reparo,
      COUNT(*) FILTER (WHERE public.os_status_mapear_legado(os.status) = 'aguardando_peca') AS qtd_aguardando_peca
    FROM public.funcionarios f
    LEFT JOIN public.ordens_de_servico os
      ON os.tecnico_responsavel_id = f.id
      AND os.empresa_id = v_empresa
      AND os.deleted_at IS NULL
      AND public.os_status_em_casa(os.status) = TRUE
    WHERE f.empresa_id = v_empresa AND f.ativo = TRUE
    GROUP BY f.id, f.nome
  ) b;
  RETURN v_resultado;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END; $$;
REVOKE ALL ON FUNCTION public.get_dashboard_bancadas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_bancadas() TO authenticated;

-- 3. CONTADORES
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
      'recebido',        COUNT(*) FILTER (WHERE public.os_status_mapear_legado(status) = 'recebido'),
      'em_analise',      COUNT(*) FILTER (WHERE public.os_status_mapear_legado(status) = 'em_analise'),
      'aprovacao',       COUNT(*) FILTER (WHERE public.os_status_mapear_legado(status) = 'aprovacao'),
      'em_reparo',       COUNT(*) FILTER (WHERE public.os_status_mapear_legado(status) = 'em_reparo'),
      'aguardando_peca', COUNT(*) FILTER (WHERE public.os_status_mapear_legado(status) = 'aguardando_peca'),
      'pronto',          COUNT(*) FILTER (WHERE public.os_status_mapear_legado(status) = 'pronto'),
      'entregue_hoje',   COUNT(*) FILTER (WHERE public.os_status_mapear_legado(status) = 'entregue' AND DATE(updated_at) = CURRENT_DATE),
      'total_em_casa',   COUNT(*) FILTER (WHERE public.os_status_em_casa(status) = TRUE)
    )
  ) INTO v_resultado
  FROM public.ordens_de_servico
  WHERE empresa_id = v_empresa AND deleted_at IS NULL;
  RETURN v_resultado;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END; $$;
REVOKE ALL ON FUNCTION public.get_dashboard_contadores_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_contadores_status() TO authenticated;

-- 4. CAIXA HOJE
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
    AND public.os_status_mapear_legado(status) = 'paga'
    AND DATE(updated_at) = CURRENT_DATE;
  RETURN v_resultado;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END; $$;
REVOKE ALL ON FUNCTION public.get_dashboard_caixa_hoje() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_caixa_hoje() TO authenticated;

-- 5. LUCRO DO MES (comissao vem da tabela comissoes)
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
    AND public.os_status_reconhece_receita(status) = TRUE
    AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', CURRENT_DATE);

  SELECT COALESCE(SUM(c.valor), 0)
  INTO v_custo_comissao
  FROM public.comissoes c
  JOIN public.ordens_de_servico os ON os.id = c.ordem_id
  WHERE c.empresa_id = v_empresa
    AND os.deleted_at IS NULL
    AND public.os_status_reconhece_receita(os.status) = TRUE
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
REVOKE ALL ON FUNCTION public.get_dashboard_lucro_mes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_lucro_mes() TO authenticated;

-- 6. ESTOQUE RESUMO (usa estoque_itens)
CREATE OR REPLACE FUNCTION public.get_dashboard_estoque_resumo()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_empresa UUID;
  v_total INTEGER := 0;
  v_zeradas INTEGER := 0;
  v_baixas INTEGER := 0;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE COALESCE(quantidade, 0) <= 0),
    COUNT(*) FILTER (WHERE quantidade_minima > 0 AND quantidade <= quantidade_minima)
  INTO v_total, v_zeradas, v_baixas
  FROM public.estoque_itens
  WHERE empresa_id = v_empresa
    AND deleted_at IS NULL
    AND tipo_item = 'peca'
    AND ativo = TRUE;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'total_pecas', v_total,
      'zeradas', v_zeradas,
      'estoque_baixo', v_baixas
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END; $$;
REVOKE ALL ON FUNCTION public.get_dashboard_estoque_resumo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_estoque_resumo() TO authenticated;

-- 7. RANKING MES
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
      AND public.os_status_reconhece_receita(os.status) = TRUE
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
REVOKE ALL ON FUNCTION public.get_dashboard_ranking_mes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_ranking_mes() TO authenticated;

-- 8. CONSOLIDADA
CREATE OR REPLACE FUNCTION public.get_dashboard_operacional()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'bancadas',     public.get_dashboard_bancadas()->'data',
      'contadores',   public.get_dashboard_contadores_status()->'data',
      'caixa_hoje',   public.get_dashboard_caixa_hoje()->'data',
      'lucro_mes',    public.get_dashboard_lucro_mes()->'data',
      'estoque',      public.get_dashboard_estoque_resumo()->'data',
      'ranking',      public.get_dashboard_ranking_mes()->'data',
      'atualizado_em', now()
    )
  );
END; $$;
REVOKE ALL ON FUNCTION public.get_dashboard_operacional() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_operacional() TO authenticated;

COMMIT;
