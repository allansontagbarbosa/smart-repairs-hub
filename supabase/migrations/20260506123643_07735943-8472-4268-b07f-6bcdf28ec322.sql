BEGIN;

-- ===========================================================
-- 1) ia_agregar_aparelhos_periodo: agora suporta MATCH EXATO
-- ===========================================================
DROP FUNCTION IF EXISTS public.ia_agregar_aparelhos_periodo(timestamptz, timestamptz, text, text, text, int);
DROP FUNCTION IF EXISTS public.ia_agregar_aparelhos_periodo(timestamptz, timestamptz, text, text, text, boolean, int);

CREATE OR REPLACE FUNCTION public.ia_agregar_aparelhos_periodo(
  p_data_inicio timestamptz DEFAULT NULL,
  p_data_fim timestamptz DEFAULT NULL,
  p_cliente_busca text DEFAULT NULL,
  p_marca_busca text DEFAULT NULL,
  p_modelo_busca text DEFAULT NULL,
  p_modelo_exato boolean DEFAULT false,
  p_limite int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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
      AND (
        p_cliente_busca IS NULL
        OR lower(extensions.unaccent(cl.nome)) LIKE '%' || lower(extensions.unaccent(p_cliente_busca)) || '%'
      )
      AND (
        p_marca_busca IS NULL
        OR lower(extensions.unaccent(a.marca)) LIKE '%' || lower(extensions.unaccent(p_marca_busca)) || '%'
      )
      AND (
        p_modelo_busca IS NULL
        OR (
          CASE
            WHEN p_modelo_exato
              THEN lower(extensions.unaccent(a.modelo)) = lower(extensions.unaccent(p_modelo_busca))
            ELSE
              lower(extensions.unaccent(a.modelo)) LIKE '%' || lower(extensions.unaccent(p_modelo_busca)) || '%'
          END
        )
      )
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
    'modo_modelo', CASE WHEN p_modelo_exato THEN 'exato' ELSE 'parcial' END,
    'filtros_aplicados', jsonb_build_object(
      'data_inicio', p_data_inicio,
      'data_fim', p_data_fim,
      'cliente_busca', p_cliente_busca,
      'marca_busca', p_marca_busca,
      'modelo_busca', p_modelo_busca,
      'modelo_exato', p_modelo_exato
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ia_agregar_aparelhos_periodo(timestamptz, timestamptz, text, text, text, boolean, int) TO authenticated;

-- ===========================================================
-- 2) ia_top_defeitos_periodo: reescrita com normalização e categorização
-- ===========================================================
DROP FUNCTION IF EXISTS public.ia_top_defeitos_periodo(timestamptz, timestamptz, text, text, int);

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
SET search_path = public, extensions, pg_temp
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
      o.id AS ordem_id,
      o.defeito_relatado AS texto_original,
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
      AND (p_marca_busca IS NULL OR lower(extensions.unaccent(a.marca)) LIKE '%' || lower(extensions.unaccent(p_marca_busca)) || '%')
      AND (p_modelo_busca IS NULL OR lower(extensions.unaccent(a.modelo)) LIKE '%' || lower(extensions.unaccent(p_modelo_busca)) || '%')
  ),
  partes AS (
    SELECT
      ordem_id,
      texto_original,
      marca,
      modelo,
      trim(unnest(string_to_array(texto_original, ';'))) AS parte_raw
    FROM base
  ),
  partes_validas AS (
    SELECT * FROM partes WHERE parte_raw <> ''
  ),
  normalizadas AS (
    SELECT
      ordem_id,
      texto_original,
      marca,
      modelo,
      parte_raw,
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(extensions.unaccent(parte_raw)),
            '\s+', ' ', 'g'
          ),
          '\s*\d+\s*(pm|pro max|pro|plus|mini|max|p|prom)?\s*$',
          '',
          'gi'
        ),
        '\s+$', '', 'g'
      ) AS parte_norm
    FROM partes_validas
  ),
  categorizadas AS (
    SELECT
      ordem_id,
      texto_original,
      marca,
      modelo,
      parte_raw,
      parte_norm,
      CASE
        WHEN parte_norm LIKE '%bateria%' THEN 'BATERIA'
        WHEN parte_norm LIKE '%tela%' OR parte_norm LIKE '%display%' OR parte_norm LIKE '%lcd%' THEN 'TELA'
        WHEN parte_norm LIKE '%vidro%' THEN 'VIDRO'
        WHEN parte_norm LIKE '%tampa%' OR parte_norm LIKE '%traseira%' THEN 'TAMPA TRASEIRA'
        WHEN parte_norm LIKE '%camera%' OR parte_norm LIKE '%cam %' OR parte_norm = 'cam' THEN 'CÂMERA'
        WHEN parte_norm LIKE '%polimento%' OR parte_norm LIKE '%polir%' THEN 'POLIMENTO'
        WHEN parte_norm LIKE '%vibra%' THEN 'VIBRACALL'
        WHEN parte_norm LIKE '%falante%' OR parte_norm LIKE '%alto-falante%' THEN 'FALANTE'
        WHEN parte_norm LIKE '%placa%' OR parte_norm LIKE '%motherboard%' OR parte_norm LIKE '%logic%' THEN 'PLACA'
        WHEN parte_norm LIKE '%conector%' OR parte_norm LIKE '%carregador%' OR parte_norm LIKE '%dock%' THEN 'CONECTOR/CARREGADOR'
        WHEN parte_norm LIKE '%choque%' THEN 'CHOQUE'
        WHEN parte_norm LIKE '%mau uso%' OR parte_norm LIKE '%trinco%' OR parte_norm LIKE '%laudo%' THEN 'LAUDO/MAU USO'
        WHEN parte_norm LIKE '%face%' OR parte_norm LIKE '%biometria%' OR parte_norm LIKE '%touch id%' THEN 'BIOMETRIA'
        WHEN parte_norm LIKE '%botao%' OR parte_norm LIKE '%power%' OR parte_norm LIKE '%volume%' THEN 'BOTÕES'
        WHEN parte_norm LIKE '%nao liga%' OR parte_norm LIKE '%morto%' OR parte_norm LIKE '%sem imagem%' THEN 'NÃO LIGA'
        WHEN parte_norm LIKE '%agua%' OR parte_norm LIKE '%molhou%' OR parte_norm LIKE '%piscina%' THEN 'CONTATO COM ÁGUA'
        ELSE 'OUTROS'
      END AS categoria
    FROM normalizadas
  ),
  contagens AS (
    SELECT
      categoria,
      COUNT(*) AS quantidade,
      COUNT(DISTINCT ordem_id) AS os_distintas,
      (array_agg(DISTINCT parte_raw ORDER BY parte_raw))[1:3] AS exemplos_textos
    FROM categorizadas
    GROUP BY categoria
  ),
  stats AS (
    SELECT
      (SELECT COUNT(DISTINCT ordem_id) FROM base) AS total_os,
      (SELECT COUNT(*) FROM categorizadas) AS total_partes,
      (SELECT COUNT(*) FROM categorizadas WHERE categoria = 'OUTROS') AS qtd_outros
  )
  SELECT
    jsonb_build_object(
      'defeitos', (
        SELECT jsonb_agg(jsonb_build_object(
          'categoria', categoria,
          'quantidade', quantidade,
          'os_distintas', os_distintas,
          'exemplos', exemplos_textos
        ) ORDER BY quantidade DESC)
        FROM (SELECT * FROM contagens ORDER BY quantidade DESC LIMIT p_limite) t
      ),
      'total_os_periodo', (SELECT total_os FROM stats),
      'total_itens_relatados', (SELECT total_partes FROM stats),
      'qualidade_dos_dados', jsonb_build_object(
        'avisar_usuario', true,
        'qtd_categoria_outros', (SELECT qtd_outros FROM stats),
        'observacao',
          'Os defeitos vêm do campo "defeito_relatado" que aceita texto livre. ' ||
          'Categorias macro foram derivadas via heurística (palavras-chave). ' ||
          'IMPORTANTE: muitos registros guardam o SERVIÇO/PEÇA TROCADA em vez do problema do cliente ' ||
          '(ex: "TROCA DE BATERIA 11" é a solução, não o defeito). ' ||
          'Resultados são úteis pra padrões mas não substituem análise manual.'
      )
    )
  INTO v_resultado;

  RETURN jsonb_build_object('success', true) || v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ia_top_defeitos_periodo(timestamptz, timestamptz, text, text, int) TO authenticated;

COMMIT;