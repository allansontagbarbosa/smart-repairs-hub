CREATE OR REPLACE FUNCTION public.ia_validar_proposta_status(
  p_os_id uuid,
  p_novo_status text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_atual record;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'Sem empresa');
  END IF;

  SELECT id, status::text AS status, numero, numero_formatado, valor_total
    INTO v_atual
    FROM ordens_de_servico
   WHERE id = p_os_id AND empresa_id = v_empresa AND deleted_at IS NULL;

  IF v_atual.id IS NULL THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'OS não encontrada');
  END IF;

  IF p_novo_status NOT IN ('recebido','em_analise','em_reparo','aguardando_aprovacao','aguardando_peca','pronto','entregue','cancelado') THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'Status inválido');
  END IF;

  RETURN jsonb_build_object(
    'valido', true,
    'os_id', v_atual.id,
    'os_numero', v_atual.numero,
    'os_numero_formatado', v_atual.numero_formatado,
    'status_atual', v_atual.status,
    'status_novo', p_novo_status,
    'valor_total', v_atual.valor_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ia_preview_acao_em_massa(
  p_filtro jsonb,
  p_acao text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_status text[];
  v_entregue_ha_min int;
  v_tecnico_id uuid;
  v_total_count int;
  v_resultado jsonb;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  IF p_acao NOT IN ('marcar_paga', 'atribuir_tecnico', 'mudar_status') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ação não permitida');
  END IF;

  v_status := ARRAY(SELECT jsonb_array_elements_text(p_filtro->'status'));
  v_entregue_ha_min := NULLIF(p_filtro->>'entregue_ha_dias_min','')::int;
  v_tecnico_id := NULLIF(p_filtro->>'tecnico_id', '')::uuid;

  WITH filtradas AS (
    SELECT o.id, o.numero, o.numero_formatado, o.status::text AS status, o.valor_total, o.aparelho_id, o.created_at
      FROM ordens_de_servico o
     WHERE o.empresa_id = v_empresa
       AND o.deleted_at IS NULL
       AND (COALESCE(array_length(v_status, 1),0) = 0 OR o.status::text = ANY(v_status))
       AND (v_entregue_ha_min IS NULL OR o.data_entrega <= now() - (v_entregue_ha_min || ' days')::interval)
       AND (v_tecnico_id IS NULL OR o.funcionario_id = v_tecnico_id)
     ORDER BY o.created_at DESC
  )
  SELECT
    (SELECT COUNT(*)::int FROM filtradas),
    jsonb_build_object(
      'qtd', LEAST((SELECT COUNT(*) FROM filtradas)::int, 200),
      'qtd_total_encontrada', (SELECT COUNT(*)::int FROM filtradas),
      'excede_limite', (SELECT COUNT(*) FROM filtradas) > 200,
      'ids', COALESCE((
        SELECT jsonb_agg(id) FROM (SELECT id FROM filtradas LIMIT 200) sub
      ), '[]'::jsonb),
      'amostra', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', f.id,
          'numero', f.numero,
          'numero_formatado', f.numero_formatado,
          'cliente', c.nome,
          'status', f.status,
          'valor', f.valor_total
        ))
        FROM (SELECT * FROM filtradas LIMIT 10) f
        LEFT JOIN aparelhos a ON a.id = f.aparelho_id
        LEFT JOIN clientes c ON c.id = a.cliente_id
      ), '[]'::jsonb)
    )
  INTO v_total_count, v_resultado;

  RETURN jsonb_build_object('success', true, 'preview', v_resultado);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ia_validar_proposta_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ia_preview_acao_em_massa(jsonb, text) TO authenticated;