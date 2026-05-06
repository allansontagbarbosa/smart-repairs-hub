BEGIN;

CREATE OR REPLACE FUNCTION public.ia_agregar_aparelhos_periodo(
  p_data_inicio timestamptz DEFAULT NULL,
  p_data_fim timestamptz DEFAULT NULL,
  p_cliente_busca text DEFAULT NULL,
  p_marca_busca text DEFAULT NULL,
  p_modelo_busca text DEFAULT NULL,
  p_limite int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa uuid;
  v_resultado jsonb;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  WITH base AS (
    SELECT
      a.marca,
      a.modelo,
      cl.nome AS cliente_nome,
      cl.id AS cliente_id,
      o.id AS ordem_id
    FROM public.ordens_de_servico o
    JOIN public.aparelhos a ON a.id = o.aparelho_id
    JOIN public.clientes cl ON cl.id = a.cliente_id
    WHERE o.empresa_id = v_empresa
      AND o.deleted_at IS NULL
      AND (p_data_inicio IS NULL OR o.data_entrada >= p_data_inicio)
      AND (p_data_fim IS NULL OR o.data_entrada <= p_data_fim)
      AND (p_cliente_busca IS NULL OR lower(unaccent(cl.nome)) LIKE '%' || lower(unaccent(p_cliente_busca)) || '%')
      AND (p_marca_busca IS NULL OR lower(unaccent(a.marca)) LIKE '%' || lower(unaccent(p_marca_busca)) || '%')
      AND (p_modelo_busca IS NULL OR lower(unaccent(a.modelo)) LIKE '%' || lower(unaccent(p_modelo_busca)) || '%')
  )
  SELECT jsonb_agg(grupo ORDER BY (grupo->>'qtd_os')::int DESC)
  INTO v_resultado
  FROM (
    SELECT jsonb_build_object(
      'marca', marca,
      'modelo', modelo,
      'qtd_os', COUNT(*),
      'qtd_clientes_distintos', COUNT(DISTINCT cliente_id),
      'principais_clientes', (
        SELECT jsonb_agg(jsonb_build_object('nome', cn.nome, 'qtd', cn.qtd) ORDER BY cn.qtd DESC)
        FROM (
          SELECT cliente_nome AS nome, COUNT(*) AS qtd
          FROM base b2
          WHERE b2.marca = b.marca AND b2.modelo = b.modelo
          GROUP BY cliente_nome
          ORDER BY 2 DESC
          LIMIT 5
        ) cn
      )
    ) AS grupo
    FROM base b
    GROUP BY marca, modelo
    ORDER BY COUNT(*) DESC
    LIMIT p_limite
  ) sub;

  RETURN jsonb_build_object(
    'success', true,
    'aparelhos', COALESCE(v_resultado, '[]'::jsonb),
    'filtros_aplicados', jsonb_build_object(
      'data_inicio', p_data_inicio,
      'data_fim', p_data_fim,
      'cliente_busca', p_cliente_busca,
      'marca_busca', p_marca_busca,
      'modelo_busca', p_modelo_busca
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ia_agregar_aparelhos_periodo(timestamptz, timestamptz, text, text, text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.ia_top_defeitos_periodo(
  p_data_inicio timestamptz DEFAULT NULL,
  p_data_fim timestamptz DEFAULT NULL,
  p_marca_busca text DEFAULT NULL,
  p_modelo_busca text DEFAULT NULL,
  p_limite int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa uuid;
  v_resultado jsonb;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  WITH base AS (
    SELECT
      o.id,
      lower(unaccent(COALESCE(o.defeito_relatado, ''))) AS defeito_norm,
      o.defeito_relatado AS defeito_original,
      a.marca,
      a.modelo
    FROM public.ordens_de_servico o
    JOIN public.aparelhos a ON a.id = o.aparelho_id
    WHERE o.empresa_id = v_empresa
      AND o.deleted_at IS NULL
      AND o.defeito_relatado IS NOT NULL
      AND length(trim(o.defeito_relatado)) > 0
      AND (p_data_inicio IS NULL OR o.data_entrada >= p_data_inicio)
      AND (p_data_fim IS NULL OR o.data_entrada <= p_data_fim)
      AND (p_marca_busca IS NULL OR lower(unaccent(a.marca)) LIKE '%' || lower(unaccent(p_marca_busca)) || '%')
      AND (p_modelo_busca IS NULL OR lower(unaccent(a.modelo)) LIKE '%' || lower(unaccent(p_modelo_busca)) || '%')
  ),
  agrupado AS (
    SELECT
      array_to_string(
        (string_to_array(regexp_replace(defeito_norm, '[^a-z0-9 ]', ' ', 'g'), ' '))[1:3],
        ' '
      ) AS chave,
      COUNT(*) AS qtd,
      (array_agg(defeito_original ORDER BY length(defeito_original) ASC))[1] AS exemplo
    FROM base
    GROUP BY chave
    HAVING array_to_string(
      (string_to_array(regexp_replace(defeito_norm, '[^a-z0-9 ]', ' ', 'g'), ' '))[1:3],
      ' '
    ) <> ''
  )
  SELECT jsonb_agg(jsonb_build_object(
    'defeito_chave', chave,
    'exemplo_relatado', exemplo,
    'quantidade', qtd
  ) ORDER BY qtd DESC)
  INTO v_resultado
  FROM (SELECT * FROM agrupado ORDER BY qtd DESC LIMIT p_limite) t;

  RETURN jsonb_build_object(
    'success', true,
    'defeitos', COALESCE(v_resultado, '[]'::jsonb),
    'observacao', 'Defeitos agrupados pelas primeiras 3 palavras normalizadas (sem acento, lowercase). Útil pra padrões mas não substitui análise manual.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ia_top_defeitos_periodo(timestamptz, timestamptz, text, text, int) TO authenticated;

COMMIT;