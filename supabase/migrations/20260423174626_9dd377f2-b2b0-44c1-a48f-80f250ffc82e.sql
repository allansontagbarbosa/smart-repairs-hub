-- Passo 2: Adicionar coluna localizacao em ordens_de_servico
ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS localizacao TEXT;

COMMENT ON COLUMN public.ordens_de_servico.localizacao IS
  'Localização física do aparelho na oficina (ex: "gaveta 3", "bancada azul"). Texto livre, opcional.';

-- Passo 3: Atualizar criar_os_com_data para persistir localizacao
CREATE OR REPLACE FUNCTION public.criar_os_com_data(p_dados jsonb, p_data_entrada timestamp with time zone, p_justificativa text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text := public.get_my_role();
  v_empresa_id uuid := public.get_my_empresa_id();
  v_user_nome text;
  v_eh_retroativa boolean;
  v_dias_diff int;
  v_nova_os_id uuid;
  v_data_atual timestamptz := now();
  v_numero int;
  v_numero_formatado text;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada' USING ERRCODE = '42501';
  END IF;

  v_dias_diff := GREATEST(0, EXTRACT(DAY FROM (v_data_atual - p_data_entrada))::int);
  v_eh_retroativa := p_data_entrada < (v_data_atual - INTERVAL '1 hour');

  IF v_eh_retroativa THEN
    IF v_role NOT IN ('admin', 'Administrador') THEN
      RAISE EXCEPTION 'Apenas administradores podem cadastrar OS com data retroativa. Selecione a data atual ou peça ao administrador.'
        USING ERRCODE = '42501';
    END IF;
    IF v_dias_diff > 30 THEN
      RAISE EXCEPTION 'Data retroativa máxima permitida é 30 dias atrás. A data informada está há % dias.', v_dias_diff
        USING ERRCODE = '22023';
    END IF;
    IF p_justificativa IS NULL OR length(trim(p_justificativa)) < 10 THEN
      RAISE EXCEPTION 'Justificativa do cadastro retroativo é obrigatória (mínimo 10 caracteres)'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_data_entrada > (v_data_atual + INTERVAL '1 hour') THEN
    RAISE EXCEPTION 'Não é permitido cadastrar OS com data futura' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(nome_exibicao, 'Usuário')
    INTO v_user_nome
    FROM public.user_profiles
    WHERE user_id = v_user_id OR id = v_user_id
    LIMIT 1;
  IF v_user_nome IS NULL THEN v_user_nome := 'Usuário'; END IF;

  INSERT INTO public.ordens_de_servico (
    aparelho_id, defeito_relatado, relato_cliente, observacoes,
    valor, valor_total, custo_pecas, mao_obra_adicional, desconto, sinal_pago,
    valor_pago, valor_pendente, forma_pagamento_sinal, garantia_dias,
    aprovacao_orcamento, aprovado_no_ato, data_aprovacao,
    tecnico, funcionario_id, obs_cliente,
    liga, bateria_entrada, estado_geral, imei2, contato_preferido,
    checklist_entrada, previsao_entrega, status,
    lojista_id, loja_id, tipo_servico_id, prioridade,
    localizacao,
    empresa_id, data_entrada, eh_retroativa,
    criada_retroativamente_por, justificativa_retroativa, created_at
  ) VALUES (
    (p_dados->>'aparelho_id')::uuid,
    p_dados->>'defeito_relatado',
    p_dados->>'relato_cliente',
    p_dados->>'observacoes',
    NULLIF(p_dados->>'valor','')::numeric,
    NULLIF(p_dados->>'valor_total','')::numeric,
    COALESCE(NULLIF(p_dados->>'custo_pecas','')::numeric, 0),
    COALESCE(NULLIF(p_dados->>'mao_obra_adicional','')::numeric, 0),
    COALESCE(NULLIF(p_dados->>'desconto','')::numeric, 0),
    COALESCE(NULLIF(p_dados->>'sinal_pago','')::numeric, 0),
    COALESCE(NULLIF(p_dados->>'valor_pago','')::numeric, 0),
    COALESCE(NULLIF(p_dados->>'valor_pendente','')::numeric, 0),
    p_dados->>'forma_pagamento_sinal',
    COALESCE(NULLIF(p_dados->>'garantia_dias','')::int, 90),
    COALESCE(p_dados->>'aprovacao_orcamento', 'pendente'),
    COALESCE((p_dados->>'aprovado_no_ato')::boolean, false),
    NULLIF(p_dados->>'data_aprovacao','')::timestamptz,
    p_dados->>'tecnico',
    NULLIF(p_dados->>'funcionario_id','')::uuid,
    p_dados->>'obs_cliente',
    COALESCE(p_dados->>'liga', 'sim'),
    NULLIF(p_dados->>'bateria_entrada','')::int,
    p_dados->>'estado_geral',
    p_dados->>'imei2',
    COALESCE(p_dados->>'contato_preferido', 'whatsapp'),
    CASE WHEN p_dados ? 'checklist_entrada' THEN p_dados->'checklist_entrada' ELSE NULL END,
    NULLIF(p_dados->>'previsao_entrega','')::timestamptz,
    COALESCE(p_dados->>'status', 'recebido')::status_ordem,
    NULLIF(p_dados->>'lojista_id','')::uuid,
    NULLIF(p_dados->>'loja_id','')::uuid,
    NULLIF(p_dados->>'tipo_servico_id','')::uuid,
    COALESCE(p_dados->>'prioridade', 'normal'),
    NULLIF(p_dados->>'localizacao',''),
    v_empresa_id,
    p_data_entrada,
    v_eh_retroativa,
    CASE WHEN v_eh_retroativa THEN v_user_id ELSE NULL END,
    CASE WHEN v_eh_retroativa THEN p_justificativa ELSE NULL END,
    now()
  )
  RETURNING id, numero, numero_formatado
  INTO v_nova_os_id, v_numero, v_numero_formatado;

  IF v_eh_retroativa THEN
    INSERT INTO public.os_auditoria (
      empresa_id, ordem_id, acao,
      realizada_por, realizada_por_nome, realizada_por_role,
      motivo, payload
    ) VALUES (
      v_empresa_id, v_nova_os_id, 'cadastro_retroativo',
      v_user_id, v_user_nome, v_role,
      p_justificativa,
      jsonb_build_object(
        'data_entrada_informada', p_data_entrada,
        'created_at_real', v_data_atual,
        'dias_retroativos', v_dias_diff,
        'mes_competencia', to_char(p_data_entrada, 'YYYY-MM')
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'os_id', v_nova_os_id,
    'numero', v_numero,
    'numero_formatado', v_numero_formatado,
    'eh_retroativa', v_eh_retroativa,
    'dias_retroativos', v_dias_diff,
    'mes_competencia', to_char(p_data_entrada, 'YYYY-MM')
  );
END;
$function$;

-- Passo 4: Expandir editar_os_admin para aceitar TODOS os novos campos
CREATE OR REPLACE FUNCTION public.editar_os_admin(p_ordem_id uuid, p_dados jsonb, p_pulou_fluxo boolean DEFAULT false, p_motivo_pulo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF v_role NOT IN ('admin', 'Administrador') THEN
    RAISE EXCEPTION 'Apenas administradores podem editar OS' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_os_antes
  FROM public.ordens_de_servico
  WHERE id = p_ordem_id AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_os_antes.status::text = 'cancelado' THEN
    RAISE EXCEPTION 'OS cancelada não pode ser editada' USING ERRCODE = '22023';
  END IF;

  IF (p_dados ? 'status') AND (p_dados->>'status' = 'cancelado') THEN
    RAISE EXCEPTION 'Cancelamento deve usar a função cancelar_os' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ordens_de_servico SET
    status = COALESCE(NULLIF(p_dados->>'status','')::status_ordem, status),

    -- Diagnóstico/relato/observações
    defeito_relatado = COALESCE(p_dados->>'defeito_relatado', defeito_relatado),
    diagnostico = CASE WHEN p_dados ? 'diagnostico' THEN NULLIF(p_dados->>'diagnostico','') ELSE diagnostico END,
    servico_realizado = CASE WHEN p_dados ? 'servico_realizado' THEN NULLIF(p_dados->>'servico_realizado','') ELSE servico_realizado END,
    relato_cliente = CASE WHEN p_dados ? 'relato_cliente' THEN NULLIF(p_dados->>'relato_cliente','') ELSE relato_cliente END,
    obs_cliente = CASE WHEN p_dados ? 'obs_cliente' THEN NULLIF(p_dados->>'obs_cliente','') ELSE obs_cliente END,
    observacoes = CASE WHEN p_dados ? 'observacoes' THEN NULLIF(p_dados->>'observacoes','') ELSE observacoes END,

    -- Operacional
    funcionario_id = CASE WHEN p_dados ? 'funcionario_id' THEN NULLIF(p_dados->>'funcionario_id','')::uuid ELSE funcionario_id END,
    previsao_entrega = CASE WHEN p_dados ? 'previsao_entrega' THEN NULLIF(p_dados->>'previsao_entrega','')::timestamptz ELSE previsao_entrega END,
    prioridade = COALESCE(NULLIF(p_dados->>'prioridade',''), prioridade),
    localizacao = CASE WHEN p_dados ? 'localizacao' THEN NULLIF(p_dados->>'localizacao','') ELSE localizacao END,
    lojista_id = CASE WHEN p_dados ? 'lojista_id' THEN NULLIF(p_dados->>'lojista_id','')::uuid ELSE lojista_id END,
    contato_preferido = COALESCE(NULLIF(p_dados->>'contato_preferido',''), contato_preferido),

    -- Financeiro
    valor = CASE WHEN p_dados ? 'valor' THEN NULLIF(p_dados->>'valor','')::numeric ELSE valor END,
    mao_obra_adicional = COALESCE(NULLIF(p_dados->>'mao_obra_adicional','')::numeric, mao_obra_adicional),
    desconto = COALESCE(NULLIF(p_dados->>'desconto','')::numeric, desconto),
    sinal_pago = COALESCE(NULLIF(p_dados->>'sinal_pago','')::numeric, sinal_pago),
    forma_pagamento_sinal = CASE WHEN p_dados ? 'forma_pagamento_sinal' THEN NULLIF(p_dados->>'forma_pagamento_sinal','') ELSE forma_pagamento_sinal END,
    garantia_dias = COALESCE(NULLIF(p_dados->>'garantia_dias','')::int, garantia_dias),
    aprovacao_orcamento = COALESCE(NULLIF(p_dados->>'aprovacao_orcamento',''), aprovacao_orcamento),
    aprovado_no_ato = COALESCE((p_dados->>'aprovado_no_ato')::boolean, aprovado_no_ato),
    tipo_servico_id = CASE WHEN p_dados ? 'tipo_servico_id' THEN NULLIF(p_dados->>'tipo_servico_id','')::uuid ELSE tipo_servico_id END,

    -- Estado entrada
    liga = CASE WHEN p_dados ? 'liga' THEN NULLIF(p_dados->>'liga','') ELSE liga END,
    bateria_entrada = CASE WHEN p_dados ? 'bateria_entrada' THEN NULLIF(p_dados->>'bateria_entrada','')::int ELSE bateria_entrada END,
    estado_geral = CASE WHEN p_dados ? 'estado_geral' THEN NULLIF(p_dados->>'estado_geral','') ELSE estado_geral END,
    checklist_entrada = CASE WHEN p_dados ? 'checklist_entrada' THEN p_dados->'checklist_entrada' ELSE checklist_entrada END,

    -- Datas automáticas por mudança de status
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

  SELECT COALESCE(nome_exibicao, 'Usuário') INTO v_user_nome
  FROM public.user_profiles
  WHERE user_id = v_user_id OR id = v_user_id
  LIMIT 1;
  IF v_user_nome IS NULL THEN v_user_nome := 'Usuário'; END IF;

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
$function$;

GRANT EXECUTE ON FUNCTION public.editar_os_admin(UUID, JSONB, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_os_com_data(JSONB, TIMESTAMPTZ, TEXT) TO authenticated;