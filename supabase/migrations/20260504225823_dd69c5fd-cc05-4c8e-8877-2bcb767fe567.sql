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
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  WITH servicos_periodo AS (
    SELECT s.id, s.ordem_id, s.tecnico_id, s.valor, o.valor_total
      FROM os_servicos s
      JOIN ordens_de_servico o ON o.id = s.ordem_id
     WHERE s.empresa_id = v_empresa
       AND s.tecnico_id IS NOT NULL
       AND o.deleted_at IS NULL
       AND s.status = 'concluido'
       AND s.concluido_em BETWEEN p_inicio AND p_fim
  ),
  comissoes_periodo AS (
    SELECT c.funcionario_id, c.status, c.valor, c.data_pagamento
      FROM comissoes c
     WHERE c.empresa_id = v_empresa
       AND c.estornada_em IS NULL
       AND (
         (c.status IN ('pendente', 'liberada'))
         OR (c.status = 'paga' AND c.data_pagamento BETWEEN p_inicio AND p_fim)
       )
  ),
  serv_agg AS (
    SELECT tecnico_id,
           COUNT(*) AS qtd_servicos,
           COUNT(DISTINCT ordem_id) AS qtd_os,
           COALESCE(SUM(valor), 0) AS valor_servicos,
           COALESCE(SUM(DISTINCT valor_total), 0) AS faturamento_os
      FROM servicos_periodo
     GROUP BY tecnico_id
  ),
  com_agg AS (
    SELECT funcionario_id,
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
      COALESCE(sa.faturamento_os, 0) AS faturamento_os,
      COALESCE(ca.comissao_pendente, 0) AS comissao_pendente,
      COALESCE(ca.comissao_liberada, 0) AS comissao_liberada,
      COALESCE(ca.comissao_paga, 0) AS comissao_paga
    FROM funcionarios f
    LEFT JOIN serv_agg sa ON sa.tecnico_id = f.id
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