CREATE OR REPLACE FUNCTION public.editar_datas_os_em_massa(
  p_os_ids uuid[],
  p_data_conclusao timestamptz DEFAULT NULL,
  p_data_entrega timestamptz DEFAULT NULL,
  p_aplicar_conclusao boolean DEFAULT false,
  p_aplicar_entrega boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_role text;
  v_ignoradas int := 0;
  v_atualizadas int := 0;
  r record;
BEGIN
  v_empresa := public.get_my_empresa_id();
  v_role := public.get_my_role();

  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  IF v_role NOT IN ('admin', 'gerente') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  IF p_os_ids IS NULL OR array_length(p_os_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lista vazia');
  END IF;

  IF NOT (p_aplicar_conclusao OR p_aplicar_entrega) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhum campo selecionado para aplicar');
  END IF;

  IF p_aplicar_conclusao AND p_data_conclusao > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conclusão não pode ser futura');
  END IF;

  IF p_aplicar_entrega AND p_data_entrega > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrega não pode ser futura');
  END IF;

  IF p_aplicar_conclusao AND p_aplicar_entrega
     AND p_data_entrega < p_data_conclusao THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrega não pode ser anterior à conclusão');
  END IF;

  FOR r IN
    SELECT id, status, data_entrada, data_conclusao, data_entrega
      FROM ordens_de_servico
     WHERE id = ANY(p_os_ids)
       AND empresa_id = v_empresa
       AND deleted_at IS NULL
  LOOP
    IF r.status = 'cancelado' THEN
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END IF;

    IF p_aplicar_conclusao AND r.data_entrada IS NOT NULL AND p_data_conclusao < r.data_entrada THEN
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END IF;

    UPDATE ordens_de_servico
       SET data_conclusao = CASE WHEN p_aplicar_conclusao THEN p_data_conclusao ELSE data_conclusao END,
           data_entrega   = CASE WHEN p_aplicar_entrega   THEN p_data_entrega   ELSE data_entrega END
     WHERE id = r.id;

    IF p_aplicar_conclusao THEN
      UPDATE os_servicos
         SET concluido_em = p_data_conclusao
       WHERE ordem_id = r.id AND status = 'concluido';
    END IF;

    v_atualizadas := v_atualizadas + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'atualizadas', v_atualizadas,
    'ignoradas', v_ignoradas
  );
END;
$$;