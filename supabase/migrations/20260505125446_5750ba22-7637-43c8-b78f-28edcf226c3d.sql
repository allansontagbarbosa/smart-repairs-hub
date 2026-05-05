CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.is_admin_ou_gerente()
RETURNS boolean
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_norm text;
BEGIN
  v_role := public.get_my_role();
  IF v_role IS NULL THEN
    RETURN false;
  END IF;
  v_norm := lower(unaccent(v_role));
  RETURN v_norm LIKE 'admin%' OR v_norm LIKE 'gerente%';
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_ou_gerente() TO authenticated;

CREATE OR REPLACE FUNCTION public.editar_datas_os(
  p_os_id uuid,
  p_data_conclusao timestamptz DEFAULT NULL,
  p_data_entrega timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_atual record;
  v_nova_concl timestamptz;
  v_nova_entr timestamptz;
  v_novo_status text;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;
  IF NOT public.is_admin_ou_gerente() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para editar datas');
  END IF;
  SELECT id, status::text AS status, data_entrada, data_conclusao, data_entrega
    INTO v_atual
    FROM ordens_de_servico
   WHERE id = p_os_id AND empresa_id = v_empresa AND deleted_at IS NULL;
  IF v_atual.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS não encontrada');
  END IF;
  IF v_atual.status = 'cancelado' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não pode editar datas de OS cancelada');
  END IF;
  v_nova_concl := COALESCE(p_data_conclusao, v_atual.data_conclusao);
  v_nova_entr  := COALESCE(p_data_entrega,  v_atual.data_entrega);
  IF v_nova_concl IS NOT NULL AND v_nova_concl > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Data de conclusão não pode ser futura');
  END IF;
  IF v_nova_entr IS NOT NULL AND v_nova_entr > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Data de entrega não pode ser futura');
  END IF;
  IF v_nova_concl IS NOT NULL AND v_atual.data_entrada IS NOT NULL
     AND v_nova_concl < v_atual.data_entrada THEN
    RETURN jsonb_build_object('success', false, 'error', 'Data de conclusão não pode ser anterior à entrada');
  END IF;
  IF v_nova_concl IS NOT NULL AND v_nova_entr IS NOT NULL
     AND v_nova_entr < v_nova_concl THEN
    RETURN jsonb_build_object('success', false, 'error', 'Data de entrega não pode ser anterior à conclusão');
  END IF;
  v_novo_status := public.derivar_status_por_datas(v_nova_concl, v_nova_entr, v_atual.status);
  UPDATE ordens_de_servico
     SET data_conclusao = v_nova_concl,
         data_entrega   = v_nova_entr,
         status         = v_novo_status::status_ordem_servico
   WHERE id = p_os_id AND empresa_id = v_empresa;
  IF v_nova_concl IS DISTINCT FROM v_atual.data_conclusao AND v_nova_concl IS NOT NULL THEN
    UPDATE os_servicos
       SET concluido_em = v_nova_concl
     WHERE ordem_id = p_os_id
       AND status = 'concluido';
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'data_conclusao', v_nova_concl,
    'data_entrega', v_nova_entr,
    'status_anterior', v_atual.status,
    'status_novo', v_novo_status,
    'status_mudou', v_atual.status IS DISTINCT FROM v_novo_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.editar_datas_os(uuid, timestamptz, timestamptz) TO authenticated;

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
  v_atualizadas int := 0;
  v_ignoradas int := 0;
  v_status_mudou int := 0;
  r record;
  v_nova_concl timestamptz;
  v_nova_entr timestamptz;
  v_novo_status text;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;
  IF NOT public.is_admin_ou_gerente() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;
  IF p_os_ids IS NULL OR array_length(p_os_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lista vazia');
  END IF;
  IF array_length(p_os_ids, 1) > 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Limite de 200 OS por operação');
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
    SELECT id, status::text AS status, data_entrada, data_conclusao, data_entrega
      FROM ordens_de_servico
     WHERE id = ANY(p_os_ids)
       AND empresa_id = v_empresa
       AND deleted_at IS NULL
       FOR UPDATE
  LOOP
    IF r.status = 'cancelado' THEN
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END IF;
    v_nova_concl := CASE WHEN p_aplicar_conclusao THEN p_data_conclusao ELSE r.data_conclusao END;
    v_nova_entr  := CASE WHEN p_aplicar_entrega   THEN p_data_entrega   ELSE r.data_entrega END;
    IF v_nova_concl IS NOT NULL AND r.data_entrada IS NOT NULL
       AND v_nova_concl < r.data_entrada THEN
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END IF;
    IF v_nova_concl IS NOT NULL AND v_nova_entr IS NOT NULL
       AND v_nova_entr < v_nova_concl THEN
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END IF;
    v_novo_status := public.derivar_status_por_datas(v_nova_concl, v_nova_entr, r.status);
    UPDATE ordens_de_servico
       SET data_conclusao = v_nova_concl,
           data_entrega   = v_nova_entr,
           status         = v_novo_status::status_ordem_servico
     WHERE id = r.id;
    IF p_aplicar_conclusao AND v_nova_concl IS NOT NULL THEN
      UPDATE os_servicos
         SET concluido_em = v_nova_concl
       WHERE ordem_id = r.id AND status = 'concluido';
    END IF;
    IF r.status IS DISTINCT FROM v_novo_status THEN
      v_status_mudou := v_status_mudou + 1;
    END IF;
    v_atualizadas := v_atualizadas + 1;
  END LOOP;
  RETURN jsonb_build_object(
    'success', true,
    'atualizadas', v_atualizadas,
    'ignoradas', v_ignoradas,
    'status_mudou', v_status_mudou
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.editar_datas_os_em_massa(uuid[], timestamptz, timestamptz, boolean, boolean) TO authenticated;