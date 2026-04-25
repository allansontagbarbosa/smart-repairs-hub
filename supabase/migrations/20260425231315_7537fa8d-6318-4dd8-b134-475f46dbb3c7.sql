CREATE OR REPLACE FUNCTION public.excluir_definitivamente_os_canceladas_lote(p_ordem_ids uuid[], p_confirmacao text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
  v_total_solicitado integer := 0;
  v_total_validas integer := 0;
  v_historico_count integer := 0;
  v_garantias_count integer := 0;
  v_mov_count integer := 0;
  v_os_count integer := 0;
  v_ordem_ids uuid[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir definitivamente OS em lote';
  END IF;

  IF coalesce(trim(p_confirmacao), '') <> 'EXCLUIR DEFINITIVAMENTE' THEN
    RAISE EXCEPTION 'Confirmação inválida';
  END IF;

  SELECT array_agg(DISTINCT id), count(DISTINCT id)
  INTO v_ordem_ids, v_total_solicitado
  FROM unnest(coalesce(p_ordem_ids, ARRAY[]::uuid[])) AS ids(id)
  WHERE id IS NOT NULL;

  IF v_total_solicitado = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos uma OS cancelada';
  END IF;

  v_empresa_id := public.get_my_empresa_id();

  SELECT count(*)
  INTO v_total_validas
  FROM public.ordens_de_servico
  WHERE id = ANY(v_ordem_ids)
    AND empresa_id = v_empresa_id
    AND status = 'cancelado'
  FOR UPDATE;

  IF v_total_validas <> v_total_solicitado THEN
    RAISE EXCEPTION 'Existem OSs inexistentes, de outra empresa ou que não estão canceladas. Revalide a seleção antes de excluir.';
  END IF;

  DELETE FROM public.historico_ordens
  WHERE ordem_id = ANY(v_ordem_ids)
    AND empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_historico_count = ROW_COUNT;

  DELETE FROM public.garantias
  WHERE ordem_id = ANY(v_ordem_ids)
    AND empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_garantias_count = ROW_COUNT;

  DELETE FROM public.movimentacoes_financeiras
  WHERE ordem_id = ANY(v_ordem_ids)
    AND empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_mov_count = ROW_COUNT;

  DELETE FROM public.ordens_de_servico
  WHERE id = ANY(v_ordem_ids)
    AND empresa_id = v_empresa_id
    AND status = 'cancelado';
  GET DIAGNOSTICS v_os_count = ROW_COUNT;

  IF v_os_count <> v_total_solicitado THEN
    RAISE EXCEPTION 'Falha ao excluir todas as OSs selecionadas';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'total_ordens', v_os_count,
    'removidos', jsonb_build_object(
      'historico_ordens', v_historico_count,
      'garantias', v_garantias_count,
      'movimentacoes_financeiras', v_mov_count,
      'ordens_de_servico', v_os_count
    )
  );
END;
$$;