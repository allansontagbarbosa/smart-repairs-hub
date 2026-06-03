CREATE OR REPLACE FUNCTION public.prejuizos_por_tecnico(p_data_inicio date DEFAULT NULL::date, p_data_fim date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      COALESCE(p.valor_centavos, 0) AS valor_centavos,
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
      COALESCE(f.nome, 'Sem técnico') AS tecnico_nome,
      COUNT(*) AS qtd_prejuizos,
      COALESCE(SUM(pct.valor_centavos), 0) AS total_centavos,
      COUNT(*) FILTER (WHERE pct.tipo IN ('garantia','peca_danificada','cancelamento_com_peca')) AS qtd_operacionais,
      COUNT(*) FILTER (WHERE pct.tipo IN ('cliente_sumiu','fraude_chargeback','furto_extravio','outro')) AS qtd_nao_operacionais
    FROM prej_com_tecnico pct
    LEFT JOIN funcionarios f ON f.id = pct.tecnico_id
    GROUP BY pct.tecnico_id, f.nome
  )
  SELECT jsonb_build_object(
    'success', true,
    'tecnicos', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'tecnico_id', COALESCE(tecnico_id::text, 'sem-tecnico'),
          'tecnico_nome', tecnico_nome,
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
$function$;