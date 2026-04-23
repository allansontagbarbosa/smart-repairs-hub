CREATE OR REPLACE FUNCTION public.editar_os_admin(
  p_ordem_id UUID,
  p_dados JSONB,
  p_pulou_fluxo BOOLEAN DEFAULT FALSE,
  p_motivo_pulo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT := public.get_my_role();
  v_empresa_id UUID := public.get_my_empresa_id();
  v_user_nome TEXT;
  v_os_antes RECORD;
  v_os_depois RECORD;
  v_diff JSONB;
  v_count_changes INT := 0;
BEGIN
  -- Permissão: apenas Administrador
  IF v_role NOT IN ('admin', 'Administrador') THEN
    RAISE EXCEPTION 'Apenas administradores podem editar OS' USING ERRCODE = '42501';
  END IF;

  -- Snapshot antes (com lock)
  SELECT * INTO v_os_antes
  FROM public.ordens_de_servico
  WHERE id = p_ordem_id AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada' USING ERRCODE = 'P0002';
  END IF;

  -- Bloquear edição de OS cancelada
  IF v_os_antes.status::text = 'cancelado' THEN
    RAISE EXCEPTION 'OS cancelada não pode ser editada' USING ERRCODE = '22023';
  END IF;

  -- Bloquear mudança de status para cancelado (deve usar cancelar_os)
  IF (p_dados ? 'status') AND (p_dados->>'status' = 'cancelado') THEN
    RAISE EXCEPTION 'Cancelamento deve usar a função cancelar_os' USING ERRCODE = '22023';
  END IF;

  -- UPDATE dinâmico
  UPDATE public.ordens_de_servico SET
    status = COALESCE(NULLIF(p_dados->>'status','')::status_ordem, status),
    valor = CASE WHEN p_dados ? 'valor' THEN NULLIF(p_dados->>'valor','')::numeric ELSE valor END,
    funcionario_id = CASE WHEN p_dados ? 'funcionario_id' THEN NULLIF(p_dados->>'funcionario_id','')::uuid ELSE funcionario_id END,
    defeito_relatado = COALESCE(p_dados->>'defeito_relatado', defeito_relatado),
    diagnostico = CASE WHEN p_dados ? 'diagnostico' THEN NULLIF(p_dados->>'diagnostico','') ELSE diagnostico END,
    servico_realizado = CASE WHEN p_dados ? 'servico_realizado' THEN NULLIF(p_dados->>'servico_realizado','') ELSE servico_realizado END,
    previsao_entrega = CASE WHEN p_dados ? 'previsao_entrega' THEN NULLIF(p_dados->>'previsao_entrega','')::timestamptz ELSE previsao_entrega END,
    observacoes = CASE WHEN p_dados ? 'observacoes' THEN NULLIF(p_dados->>'observacoes','') ELSE observacoes END,
    prioridade = COALESCE(NULLIF(p_dados->>'prioridade',''), prioridade),
    garantia_dias = CASE WHEN p_dados ? 'garantia_dias' THEN NULLIF(p_dados->>'garantia_dias','')::int ELSE garantia_dias END,
    tipo_servico_id = CASE WHEN p_dados ? 'tipo_servico_id' THEN NULLIF(p_dados->>'tipo_servico_id','')::uuid ELSE tipo_servico_id END,
    aprovacao_orcamento = COALESCE(NULLIF(p_dados->>'aprovacao_orcamento',''), aprovacao_orcamento),
    data_conclusao = CASE
      WHEN (p_dados ? 'status') AND (p_dados->>'status' = 'pronto') AND v_os_antes.status::text <> 'pronto' AND v_os_antes.data_conclusao IS NULL
        THEN now()
      ELSE data_conclusao
    END,
    data_entrega = CASE
      WHEN (p_dados ? 'status') AND (p_dados->>'status' = 'entregue') AND v_os_antes.status::text <> 'entregue' AND v_os_antes.data_entrega IS NULL
        THEN now()
      ELSE data_entrega
    END
  WHERE id = p_ordem_id
  RETURNING * INTO v_os_depois;

  -- Calcular diff
  SELECT jsonb_object_agg(key, jsonb_build_array(
    to_jsonb(v_os_antes) -> key,
    to_jsonb(v_os_depois) -> key
  ))
  INTO v_diff
  FROM jsonb_object_keys(to_jsonb(v_os_depois)) AS key
  WHERE (to_jsonb(v_os_antes) -> key) IS DISTINCT FROM (to_jsonb(v_os_depois) -> key)
    AND key NOT IN (
      'updated_at','custo_pecas','custo_total','custo_mao_de_obra',
      'valor_total','valor_total_servicos','valor_total_pecas',
      'lucro_bruto','margem_calculada','prazo_vencido'
    );

  IF v_diff IS NOT NULL THEN
    SELECT count(*) INTO v_count_changes FROM jsonb_object_keys(v_diff) AS k;
  END IF;

  -- Nome para auditoria
  SELECT COALESCE(nome_exibicao, 'Usuário') INTO v_user_nome
  FROM public.user_profiles
  WHERE user_id = v_user_id OR id = v_user_id
  LIMIT 1;
  IF v_user_nome IS NULL THEN v_user_nome := 'Usuário'; END IF;

  -- Auditoria apenas se houve mudança
  IF v_count_changes > 0 THEN
    INSERT INTO public.os_auditoria (
      empresa_id, ordem_id, acao, realizada_por, realizada_por_nome, realizada_por_role,
      motivo, payload
    ) VALUES (
      v_empresa_id, p_ordem_id,
      CASE WHEN p_pulou_fluxo THEN 'edicao_pulo_fluxo' ELSE 'edicao' END,
      v_user_id, v_user_nome, v_role,
      p_motivo_pulo,
      jsonb_build_object(
        'diff', v_diff,
        'pulou_fluxo', p_pulou_fluxo,
        'campos_alterados', (SELECT array_agg(k) FROM jsonb_object_keys(v_diff) AS k)
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'campos_alterados', v_count_changes,
    'diff', v_diff,
    'pulou_fluxo', p_pulou_fluxo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.editar_os_admin(UUID, JSONB, BOOLEAN, TEXT) TO authenticated;