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

  SELECT jsonb_agg(jsonb_build_object(
    'comissao_id', c.id,
    'valor', c.valor,
    'status', c.status,
    'mes_competencia', c.mes_competencia,
    'data_pagamento', c.data_pagamento,
    'created_at', c.created_at,
    'os_numero', o.numero,
    'os_numero_formatado', o.numero_formatado,
    'servico_nome', os.nome,
    'aparelho', COALESCE(a.marca, '') || ' ' || COALESCE(a.modelo, ''),
    'cliente_nome', cl.nome
  ) ORDER BY c.created_at DESC)
  INTO v_lista
  FROM comissoes c
  LEFT JOIN ordens_de_servico o ON o.id = c.ordem_id
  LEFT JOIN os_servicos os ON os.id = c.os_servico_id
  LEFT JOIN aparelhos a ON a.id = o.aparelho_id
  LEFT JOIN clientes cl ON cl.id = a.cliente_id
  WHERE c.funcionario_id = p_funcionario_id
    AND c.empresa_id = v_empresa
    AND c.estornada_em IS NULL
    AND (
      (c.status IN ('pendente', 'liberada')
        AND c.mes_competencia >= v_mes_inicio
        AND c.mes_competencia <= v_mes_fim)
      OR
      (c.status = 'paga'
        AND c.data_pagamento IS NOT NULL
        AND c.data_pagamento BETWEEN p_inicio AND p_fim)
    );

  RETURN jsonb_build_object('success', true, 'comissoes', COALESCE(v_lista, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.comissoes_tecnico_periodo(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comissoes_tecnico_periodo(uuid, timestamptz, timestamptz) TO authenticated;