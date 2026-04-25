CREATE OR REPLACE FUNCTION public.preview_exclusao_os_cancelada(p_ordem_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_os record;
  v_historico_count integer := 0;
  v_garantias_count integer := 0;
  v_mov_count integer := 0;
  v_mov_total numeric := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem validar exclusão definitiva de OS';
  END IF;

  v_empresa_id := public.get_my_empresa_id();

  SELECT
    os.id,
    os.numero,
    os.numero_formatado,
    os.status,
    os.data_entrada,
    os.cancelada_em,
    os.deleted_at,
    os.valor,
    os.empresa_id,
    c.nome AS cliente_nome,
    a.marca AS aparelho_marca,
    a.modelo AS aparelho_modelo,
    a.imei AS aparelho_imei
  INTO v_os
  FROM public.ordens_de_servico os
  LEFT JOIN public.aparelhos a ON a.id = os.aparelho_id
  LEFT JOIN public.clientes c ON c.id = a.cliente_id
  WHERE os.id = p_ordem_id
    AND os.empresa_id = v_empresa_id;

  IF v_os.id IS NULL THEN
    RAISE EXCEPTION 'OS não encontrada para esta empresa';
  END IF;

  IF v_os.status <> 'cancelado' THEN
    RAISE EXCEPTION 'Somente OS canceladas podem ser excluídas definitivamente';
  END IF;

  SELECT count(*) INTO v_historico_count
  FROM public.historico_ordens
  WHERE ordem_id = p_ordem_id
    AND empresa_id = v_empresa_id;

  SELECT count(*) INTO v_garantias_count
  FROM public.garantias
  WHERE ordem_id = p_ordem_id
    AND empresa_id = v_empresa_id;

  SELECT count(*), coalesce(sum(valor), 0) INTO v_mov_count, v_mov_total
  FROM public.movimentacoes_financeiras
  WHERE ordem_id = p_ordem_id
    AND empresa_id = v_empresa_id;

  RETURN jsonb_build_object(
    'can_delete', true,
    'ordem', jsonb_build_object(
      'id', v_os.id,
      'numero', v_os.numero,
      'numero_formatado', v_os.numero_formatado,
      'status', v_os.status,
      'data_entrada', v_os.data_entrada,
      'cancelada_em', v_os.cancelada_em,
      'deleted_at', v_os.deleted_at,
      'valor', v_os.valor,
      'cliente_nome', v_os.cliente_nome,
      'aparelho', trim(concat_ws(' ', v_os.aparelho_marca, v_os.aparelho_modelo)),
      'imei', v_os.aparelho_imei
    ),
    'dependencias', jsonb_build_object(
      'historico_ordens', v_historico_count,
      'garantias', v_garantias_count,
      'movimentacoes_financeiras', v_mov_count,
      'total_movimentacoes_financeiras', v_mov_total
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.excluir_definitivamente_os_cancelada(p_ordem_id uuid, p_confirmacao text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_os record;
  v_historico_count integer := 0;
  v_garantias_count integer := 0;
  v_mov_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir definitivamente OS';
  END IF;

  IF coalesce(trim(p_confirmacao), '') <> 'EXCLUIR DEFINITIVAMENTE' THEN
    RAISE EXCEPTION 'Confirmação inválida';
  END IF;

  v_empresa_id := public.get_my_empresa_id();

  SELECT id, numero, numero_formatado, status, empresa_id
  INTO v_os
  FROM public.ordens_de_servico
  WHERE id = p_ordem_id
    AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF v_os.id IS NULL THEN
    RAISE EXCEPTION 'OS não encontrada para esta empresa';
  END IF;

  IF v_os.status <> 'cancelado' THEN
    RAISE EXCEPTION 'Somente OS canceladas podem ser excluídas definitivamente';
  END IF;

  DELETE FROM public.historico_ordens
  WHERE ordem_id = p_ordem_id
    AND empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_historico_count = ROW_COUNT;

  DELETE FROM public.garantias
  WHERE ordem_id = p_ordem_id
    AND empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_garantias_count = ROW_COUNT;

  DELETE FROM public.movimentacoes_financeiras
  WHERE ordem_id = p_ordem_id
    AND empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_mov_count = ROW_COUNT;

  DELETE FROM public.ordens_de_servico
  WHERE id = p_ordem_id
    AND empresa_id = v_empresa_id
    AND status = 'cancelado';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Falha ao excluir a OS cancelada';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'ordem_id', p_ordem_id,
    'numero', v_os.numero,
    'numero_formatado', v_os.numero_formatado,
    'removidos', jsonb_build_object(
      'historico_ordens', v_historico_count,
      'garantias', v_garantias_count,
      'movimentacoes_financeiras', v_mov_count,
      'ordens_de_servico', 1
    )
  );
END;
$$;