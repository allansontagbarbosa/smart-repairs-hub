CREATE OR REPLACE FUNCTION public.editar_datas_os(
  p_os_id uuid,
  p_data_conclusao timestamptz DEFAULT NULL,
  p_data_entrega timestamptz DEFAULT NULL,
  p_limpar_conclusao boolean DEFAULT false,
  p_limpar_entrega boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_role text;
  v_atual record;
  v_nova_concl timestamptz;
  v_nova_entr timestamptz;
BEGIN
  v_empresa := public.get_my_empresa_id();
  v_role := public.get_my_role();

  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  IF lower(coalesce(v_role, '')) NOT IN ('admin', 'administrador', 'gerente') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para editar datas');
  END IF;

  SELECT id, status, data_entrada, data_conclusao, data_entrega INTO v_atual
    FROM ordens_de_servico
   WHERE id = p_os_id AND empresa_id = v_empresa AND deleted_at IS NULL;

  IF v_atual.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS não encontrada');
  END IF;

  IF v_atual.status = 'cancelado' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não pode editar datas de OS cancelada');
  END IF;

  v_nova_concl := CASE
    WHEN p_limpar_conclusao THEN NULL
    WHEN p_data_conclusao IS NOT NULL THEN p_data_conclusao
    ELSE v_atual.data_conclusao
  END;

  v_nova_entr := CASE
    WHEN p_limpar_entrega THEN NULL
    WHEN p_data_entrega IS NOT NULL THEN p_data_entrega
    ELSE v_atual.data_entrega
  END;

  IF v_nova_concl IS NOT NULL AND v_nova_concl > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Data de conclusão não pode ser futura');
  END IF;

  IF v_nova_entr IS NOT NULL AND v_nova_entr > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Data de entrega não pode ser futura');
  END IF;

  IF v_nova_concl IS NOT NULL AND v_atual.data_entrada IS NOT NULL AND v_nova_concl < v_atual.data_entrada THEN
    RETURN jsonb_build_object('success', false, 'error', 'Data de conclusão não pode ser anterior à entrada');
  END IF;

  IF v_nova_concl IS NOT NULL AND v_nova_entr IS NOT NULL AND v_nova_entr < v_nova_concl THEN
    RETURN jsonb_build_object('success', false, 'error', 'Data de entrega não pode ser anterior à conclusão');
  END IF;

  UPDATE ordens_de_servico
     SET data_conclusao = v_nova_concl,
         data_entrega = v_nova_entr
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
    'data_entrega', v_nova_entr
  );
END;
$$;

REVOKE ALL ON FUNCTION public.editar_datas_os(uuid, timestamptz, timestamptz, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editar_datas_os(uuid, timestamptz, timestamptz, boolean, boolean) TO authenticated;