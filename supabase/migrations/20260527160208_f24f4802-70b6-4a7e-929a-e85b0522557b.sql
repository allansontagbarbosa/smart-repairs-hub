CREATE OR REPLACE FUNCTION public.portal_detalhe_ordem(p_ordem_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_grupo_id uuid;
  v_cliente_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id INTO v_grupo_id
    FROM lojista_grupos
   WHERE user_id = v_user_id
     AND status_acesso = 'ativo'
     AND convite_aceito_em IS NOT NULL
   LIMIT 1;

  IF v_grupo_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT a.cliente_id INTO v_cliente_id
    FROM ordens_de_servico os
    JOIN aparelhos a ON a.id = os.aparelho_id
    JOIN clientes  c ON c.id = a.cliente_id
   WHERE os.id = p_ordem_id
     AND os.deleted_at IS NULL
     AND c.grupo_id = v_grupo_id
     AND c.deleted_at IS NULL
   LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'ordem', jsonb_build_object(
      'id',                os.id,
      'numero',            os.numero,
      'numero_formatado',  os.numero_formatado,
      'status',            os.status,
      'valor',             os.valor,
      'valor_total',       os.valor_total,
      'valor_pago',        os.valor_pago,
      'valor_pendente',    os.valor_pendente,
      'custo_pecas',       NULL,
      'data_entrada',      os.data_entrada,
      'data_entrega',      os.data_entrega,
      'data_conclusao',    os.data_conclusao,
      'previsao_entrega',  os.previsao_entrega,
      'defeito_relatado',  os.defeito_relatado,
      'diagnostico',       os.diagnostico,
      'servico_realizado', os.servico_realizado,
      'observacoes',       os.observacoes,
      'obs_cliente',       os.obs_cliente,
      'garantia_dias',     os.garantia_dias,
      'cliente',           jsonb_build_object('id', c.id, 'nome', c.nome),
      'cliente_id',        c.id,
      'cliente_nome',      c.nome,
      'aparelho', jsonb_build_object(
        'marca',      a.marca,
        'modelo',     a.modelo,
        'cor',        a.cor,
        'capacidade', a.capacidade,
        'imei',       a.imei,
        'imei2',      NULL,
        'estado_geral', NULL
      ),
      'data_aprovacao',      NULL,
      'aprovacao_orcamento', NULL,
      'motivo_reprovacao',   NULL,
      'prazo_vencido',       NULL,
      'timeline', jsonb_build_array(
        jsonb_build_object('evento', 'Entrada',    'data', os.data_entrada),
        jsonb_build_object('evento', 'Conclusão',  'data', os.data_conclusao),
        jsonb_build_object('evento', 'Entrega',    'data', os.data_entrega)
      ),
      'servicos', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id',           s.id,
            'nome',         TRIM(s.nome),
            'valor',        s.valor,
            'categoria',    s.categoria,
            'status_raw',   s.status,
            'badge',        CASE
                              WHEN s.concluido_em IS NOT NULL THEN 'concluido'
                              WHEN s.iniciado_em  IS NOT NULL THEN 'andamento'
                              ELSE 'nao_iniciado'
                            END,
            'badge_label',  CASE
                              WHEN s.concluido_em IS NOT NULL THEN 'Concluído'
                              WHEN s.iniciado_em  IS NOT NULL THEN 'Em andamento'
                              ELSE 'Não iniciado'
                            END,
            'iniciado_em',  s.iniciado_em,
            'concluido_em', s.concluido_em
          )
          ORDER BY s.created_at ASC
        ), '[]'::jsonb)
        FROM os_servicos s
        WHERE s.ordem_id = os.id
      ),
      'garantia', (
        SELECT jsonb_build_object(
          'id',             g.id,
          'data_inicio',    g.data_inicio,
          'data_fim',       g.data_fim,
          'dias_garantia',  g.dias_garantia,
          'dias_restantes', GREATEST(0, (g.data_fim - CURRENT_DATE)),
          'ativa',          (g.data_fim >= CURRENT_DATE AND g.status = 'ativa'),
          'status',         g.status,
          'observacoes',    g.observacoes
        )
          FROM garantias g
         WHERE g.ordem_id = os.id
         ORDER BY g.created_at DESC
         LIMIT 1
      )
    )
  )
  INTO v_result
  FROM ordens_de_servico os
  JOIN aparelhos a ON a.id = os.aparelho_id
  JOIN clientes  c ON c.id = a.cliente_id
  WHERE os.id = p_ordem_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.portal_detalhe_ordem(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_detalhe_ordem(uuid) TO authenticated;