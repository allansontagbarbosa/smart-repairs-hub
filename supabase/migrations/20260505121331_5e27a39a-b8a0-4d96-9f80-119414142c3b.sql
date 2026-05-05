CREATE OR REPLACE FUNCTION public.kpi_tecnicos(
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
  v_resultado jsonb;
  v_mes_inicio text;
  v_mes_fim text;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  v_mes_inicio := to_char(p_inicio, 'YYYY-MM');
  v_mes_fim := to_char(p_fim, 'YYYY-MM');

  WITH servicos_periodo AS (
    SELECT
      s.id, s.ordem_id, s.tecnico_id, s.valor, s.iniciado_em, s.concluido_em,
      o.valor_total
    FROM os_servicos s
    JOIN ordens_de_servico o ON o.id = s.ordem_id
    WHERE s.empresa_id = v_empresa
      AND s.tecnico_id IS NOT NULL
      AND o.deleted_at IS NULL
      AND s.status = 'concluido'
      AND s.concluido_em BETWEEN p_inicio AND p_fim
  ),
  os_unicas_por_tecnico AS (
    SELECT DISTINCT tecnico_id, ordem_id, valor_total
    FROM servicos_periodo
  ),
  servicos_agg AS (
    SELECT
      sp.tecnico_id,
      COUNT(*) AS qtd_servicos,
      COUNT(DISTINCT sp.ordem_id) AS qtd_os,
      COALESCE(SUM(sp.valor), 0) AS valor_servicos,
      AVG(EXTRACT(EPOCH FROM (sp.concluido_em - sp.iniciado_em)) / 3600.0)
        FILTER (WHERE sp.iniciado_em IS NOT NULL AND sp.concluido_em IS NOT NULL)
        AS tempo_medio_horas
    FROM servicos_periodo sp
    GROUP BY sp.tecnico_id
  ),
  faturamento_agg AS (
    SELECT tecnico_id, COALESCE(SUM(valor_total), 0) AS faturamento_os
    FROM os_unicas_por_tecnico
    GROUP BY tecnico_id
  ),
  comissoes_periodo AS (
    SELECT c.funcionario_id, c.status, c.valor
    FROM comissoes c
    JOIN os_servicos s ON s.id = c.os_servico_id
    WHERE c.empresa_id = v_empresa
      AND c.estornada_em IS NULL
      AND c.status IN ('pendente', 'liberada')
      AND s.concluido_em BETWEEN p_inicio AND p_fim
    UNION ALL
    SELECT c.funcionario_id, c.status, c.valor
    FROM comissoes c
    WHERE c.empresa_id = v_empresa
      AND c.estornada_em IS NULL
      AND c.status IN ('pendente', 'liberada')
      AND c.os_servico_id IS NULL
      AND c.mes_competencia >= v_mes_inicio
      AND c.mes_competencia <= v_mes_fim
    UNION ALL
    SELECT c.funcionario_id, c.status, c.valor
    FROM comissoes c
    WHERE c.empresa_id = v_empresa
      AND c.estornada_em IS NULL
      AND c.status = 'paga'
      AND c.data_pagamento IS NOT NULL
      AND c.data_pagamento BETWEEN p_inicio AND p_fim
  ),
  com_agg AS (
    SELECT
      funcionario_id,
      COALESCE(SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END), 0) AS comissao_pendente,
      COALESCE(SUM(CASE WHEN status = 'liberada' THEN valor ELSE 0 END), 0) AS comissao_liberada,
      COALESCE(SUM(CASE WHEN status = 'paga' THEN valor ELSE 0 END), 0) AS comissao_paga
    FROM comissoes_periodo
    GROUP BY funcionario_id
  ),
  agregado AS (
    SELECT
      f.id AS funcionario_id,
      f.nome,
      COALESCE(sa.qtd_servicos, 0) AS qtd_servicos,
      COALESCE(sa.qtd_os, 0) AS qtd_os,
      COALESCE(sa.valor_servicos, 0) AS valor_servicos,
      COALESCE(sa.tempo_medio_horas, 0) AS tempo_medio_horas,
      COALESCE(fa.faturamento_os, 0) AS faturamento_os,
      COALESCE(ca.comissao_pendente, 0) AS comissao_pendente,
      COALESCE(ca.comissao_liberada, 0) AS comissao_liberada,
      COALESCE(ca.comissao_paga, 0) AS comissao_paga
    FROM funcionarios f
    LEFT JOIN servicos_agg sa ON sa.tecnico_id = f.id
    LEFT JOIN faturamento_agg fa ON fa.tecnico_id = f.id
    LEFT JOIN com_agg ca ON ca.funcionario_id = f.id
    WHERE f.empresa_id = v_empresa
      AND f.deleted_at IS NULL
      AND f.ativo = true
  )
  SELECT jsonb_agg(jsonb_build_object(
    'funcionario_id', funcionario_id,
    'nome', nome,
    'qtd_servicos', qtd_servicos,
    'qtd_os', qtd_os,
    'valor_servicos', valor_servicos,
    'faturamento_os', faturamento_os,
    'tempo_medio_horas', tempo_medio_horas,
    'comissao_pendente', comissao_pendente,
    'comissao_liberada', comissao_liberada,
    'comissao_paga', comissao_paga,
    'comissao_total_a_receber', comissao_pendente + comissao_liberada,
    'ticket_medio_os', CASE WHEN qtd_os > 0 THEN faturamento_os / qtd_os ELSE 0 END
  ) ORDER BY (comissao_pendente + comissao_liberada) DESC, qtd_servicos DESC)
  INTO v_resultado
  FROM agregado;

  RETURN jsonb_build_object('success', true, 'tecnicos', COALESCE(v_resultado, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.kpi_tecnicos(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kpi_tecnicos(timestamptz, timestamptz) TO authenticated;


CREATE OR REPLACE FUNCTION public.comissoes_tecnico_periodo(
  p_funcionario_id uuid,
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
  v_mes_inicio text;
  v_mes_fim text;
  v_lista jsonb;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM funcionarios
    WHERE id = p_funcionario_id AND empresa_id = v_empresa AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Técnico não encontrado');
  END IF;

  v_mes_inicio := to_char(p_inicio, 'YYYY-MM');
  v_mes_fim := to_char(p_fim, 'YYYY-MM');

  WITH base AS (
    SELECT c.id AS comissao_id, c.valor, c.status, c.mes_competencia, c.data_pagamento, c.created_at,
           c.ordem_id, c.os_servico_id
    FROM comissoes c
    JOIN os_servicos s ON s.id = c.os_servico_id
    WHERE c.funcionario_id = p_funcionario_id
      AND c.empresa_id = v_empresa
      AND c.estornada_em IS NULL
      AND c.status IN ('pendente', 'liberada')
      AND s.concluido_em BETWEEN p_inicio AND p_fim
    UNION ALL
    SELECT c.id, c.valor, c.status, c.mes_competencia, c.data_pagamento, c.created_at,
           c.ordem_id, c.os_servico_id
    FROM comissoes c
    WHERE c.funcionario_id = p_funcionario_id
      AND c.empresa_id = v_empresa
      AND c.estornada_em IS NULL
      AND c.status IN ('pendente', 'liberada')
      AND c.os_servico_id IS NULL
      AND c.mes_competencia >= v_mes_inicio
      AND c.mes_competencia <= v_mes_fim
    UNION ALL
    SELECT c.id, c.valor, c.status, c.mes_competencia, c.data_pagamento, c.created_at,
           c.ordem_id, c.os_servico_id
    FROM comissoes c
    WHERE c.funcionario_id = p_funcionario_id
      AND c.empresa_id = v_empresa
      AND c.estornada_em IS NULL
      AND c.status = 'paga'
      AND c.data_pagamento IS NOT NULL
      AND c.data_pagamento BETWEEN p_inicio AND p_fim
  )
  SELECT jsonb_agg(jsonb_build_object(
    'comissao_id', b.comissao_id,
    'valor', b.valor,
    'status', b.status,
    'mes_competencia', b.mes_competencia,
    'data_pagamento', b.data_pagamento,
    'created_at', b.created_at,
    'os_numero', o.numero,
    'os_numero_formatado', o.numero_formatado,
    'servico_nome', os_s.nome,
    'aparelho', COALESCE(a.marca, '') || ' ' || COALESCE(a.modelo, ''),
    'cliente_nome', cl.nome
  ) ORDER BY b.created_at DESC)
  INTO v_lista
  FROM base b
  LEFT JOIN ordens_de_servico o ON o.id = b.ordem_id
  LEFT JOIN os_servicos os_s ON os_s.id = b.os_servico_id
  LEFT JOIN aparelhos a ON a.id = o.aparelho_id
  LEFT JOIN clientes cl ON cl.id = a.cliente_id;

  RETURN jsonb_build_object('success', true, 'comissoes', COALESCE(v_lista, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.comissoes_tecnico_periodo(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comissoes_tecnico_periodo(uuid, timestamptz, timestamptz) TO authenticated;