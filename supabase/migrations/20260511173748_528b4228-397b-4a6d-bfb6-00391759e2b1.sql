CREATE OR REPLACE FUNCTION public.prejuizos_por_tecnico(
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_resultado jsonb;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM user_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário sem empresa');
  END IF;

  WITH prej_com_tecnico AS (
    SELECT
      p.id AS prejuizo_id,
      p.tipo,
      p.valor_centavos,
      p.data_evento,
      p.os_origem_id,
      (SELECT oss.tecnico_id
       FROM os_servicos oss
       WHERE oss.ordem_id = p.os_origem_id
         AND oss.tecnico_id IS NOT NULL
       ORDER BY oss.created_at ASC
       LIMIT 1) AS tecnico_id
    FROM prejuizos p
    WHERE p.empresa_id = v_empresa_id
      AND p.deleted_at IS NULL
      AND (p_data_inicio IS NULL OR p.data_evento >= p_data_inicio)
      AND (p_data_fim IS NULL OR p.data_evento <= p_data_fim)
  ),
  agrupado AS (
    SELECT
      pct.tecnico_id,
      f.nome AS tecnico_nome,
      COUNT(*) AS qtd_prejuizos,
      SUM(pct.valor_centavos) AS total_centavos,
      COUNT(*) FILTER (WHERE pct.tipo IN ('garantia','peca_danificada','cancelamento_com_peca')) AS qtd_operacionais,
      COUNT(*) FILTER (WHERE pct.tipo IN ('cliente_sumiu','fraude_chargeback','furto_extravio','outro')) AS qtd_nao_operacionais
    FROM prej_com_tecnico pct
    LEFT JOIN funcionarios f ON f.id = pct.tecnico_id
    WHERE pct.tecnico_id IS NOT NULL
    GROUP BY pct.tecnico_id, f.nome
  )
  SELECT jsonb_build_object(
    'success', true,
    'tecnicos', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'tecnico_id', tecnico_id,
          'tecnico_nome', COALESCE(tecnico_nome, 'Sem técnico'),
          'qtd_prejuizos', qtd_prejuizos,
          'total_centavos', total_centavos,
          'qtd_operacionais', qtd_operacionais,
          'qtd_nao_operacionais', qtd_nao_operacionais
        ) ORDER BY total_centavos DESC
      ),
      '[]'::jsonb
    )
  ) INTO v_resultado
  FROM agrupado;

  RETURN v_resultado;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.prejuizos_por_tecnico(date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.prejuizos_evolucao_mensal(
  p_meses int DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_resultado jsonb;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM user_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário sem empresa');
  END IF;

  WITH meses AS (
    SELECT
      to_char(date_trunc('month', CURRENT_DATE) - (n || ' months')::interval, 'YYYY-MM') AS ano_mes,
      (date_trunc('month', CURRENT_DATE) - (n || ' months')::interval)::date AS inicio,
      (date_trunc('month', CURRENT_DATE) - (n || ' months')::interval + interval '1 month - 1 day')::date AS fim
    FROM generate_series(0, p_meses - 1) AS n
  ),
  prej_por_mes AS (
    SELECT
      m.ano_mes,
      m.inicio,
      m.fim,
      COALESCE(SUM(p.valor_centavos) FILTER (WHERE p.tipo IN ('garantia','peca_danificada','cancelamento_com_peca')), 0) AS operacional_centavos,
      COALESCE(SUM(p.valor_centavos) FILTER (WHERE p.tipo IN ('cliente_sumiu','fraude_chargeback','furto_extravio','outro')), 0) AS nao_operacional_centavos,
      COALESCE(COUNT(p.id), 0) AS qtd
    FROM meses m
    LEFT JOIN prejuizos p ON p.empresa_id = v_empresa_id
      AND p.deleted_at IS NULL
      AND p.data_evento >= m.inicio
      AND p.data_evento <= m.fim
    GROUP BY m.ano_mes, m.inicio, m.fim
  )
  SELECT jsonb_build_object(
    'success', true,
    'meses', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'ano_mes', ano_mes,
          'operacional_centavos', operacional_centavos,
          'nao_operacional_centavos', nao_operacional_centavos,
          'total_centavos', operacional_centavos + nao_operacional_centavos,
          'qtd', qtd
        ) ORDER BY ano_mes ASC
      ),
      '[]'::jsonb
    )
  ) INTO v_resultado
  FROM prej_por_mes;

  RETURN v_resultado;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.prejuizos_evolucao_mensal(int) TO authenticated;