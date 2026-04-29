ALTER TABLE public.os_servicos
ADD COLUMN IF NOT EXISTS comissao numeric(12,2) DEFAULT 0;

CREATE OR REPLACE FUNCTION public.editar_os_servicos_v2(
  p_ordem_id uuid,
  p_servicos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_user uuid;
  v_role text;
  v_user_nome text;
  v_existing_ids uuid[];
  v_new_ids uuid[] := '{}'::uuid[];
  v_item jsonb;
  v_id uuid;
  v_total_valor numeric := 0;
  v_total_comissao numeric := 0;
  v_payload jsonb := COALESCE(p_servicos, '[]'::jsonb);
  v_removidos jsonb := '[]'::jsonb;
BEGIN
  v_empresa := public.get_my_empresa_id();
  v_user := auth.uid();
  v_role := public.get_my_role();

  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário sem empresa vinculada');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ordens_de_servico
    WHERE id = p_ordem_id AND empresa_id = v_empresa AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS nao encontrada');
  END IF;

  IF jsonb_typeof(v_payload) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payload de serviços inválido');
  END IF;

  SELECT array_agg(id) INTO v_existing_ids
  FROM public.os_servicos
  WHERE ordem_id = p_ordem_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_payload)
  LOOP
    v_id := NULLIF(v_item->>'id', '')::uuid;

    IF NULLIF(v_item->>'servico_id', '') IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Tipo de serviço obrigatório');
    END IF;

    IF v_id IS NULL OR NOT (v_id = ANY(COALESCE(v_existing_ids, '{}'::uuid[]))) THEN
      INSERT INTO public.os_servicos (
        ordem_id,
        servico_id,
        tecnico_id,
        nome,
        valor,
        comissao,
        categoria,
        empresa_id
      )
      SELECT
        p_ordem_id,
        ts.id,
        NULLIF(v_item->>'tecnico_id', '')::uuid,
        ts.nome,
        COALESCE(NULLIF(v_item->>'valor', '')::numeric, 0),
        COALESCE(NULLIF(v_item->>'comissao', '')::numeric, 0),
        ts.categoria,
        v_empresa
      FROM public.tipos_servico ts
      WHERE ts.id = (v_item->>'servico_id')::uuid
        AND ts.empresa_id = v_empresa
      RETURNING id INTO v_id;

      IF v_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Serviço não encontrado');
      END IF;
    ELSE
      UPDATE public.os_servicos os
      SET
        servico_id = ts.id,
        tecnico_id = NULLIF(v_item->>'tecnico_id', '')::uuid,
        nome = ts.nome,
        valor = COALESCE(NULLIF(v_item->>'valor', '')::numeric, 0),
        comissao = COALESCE(NULLIF(v_item->>'comissao', '')::numeric, 0),
        categoria = ts.categoria,
        empresa_id = v_empresa
      FROM public.tipos_servico ts
      WHERE os.id = v_id
        AND os.ordem_id = p_ordem_id
        AND ts.id = (v_item->>'servico_id')::uuid
        AND ts.empresa_id = v_empresa;
    END IF;

    v_new_ids := array_append(v_new_ids, v_id);
    v_total_valor := v_total_valor + COALESCE(NULLIF(v_item->>'valor', '')::numeric, 0);
    v_total_comissao := v_total_comissao + COALESCE(NULLIF(v_item->>'comissao', '')::numeric, 0);
  END LOOP;

  IF v_existing_ids IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'servico_id', servico_id,
      'nome', nome,
      'valor', valor,
      'comissao', comissao,
      'tecnico_id', tecnico_id
    )), '[]'::jsonb)
    INTO v_removidos
    FROM public.os_servicos
    WHERE ordem_id = p_ordem_id
      AND id = ANY(v_existing_ids)
      AND NOT (id = ANY(v_new_ids));

    DELETE FROM public.os_servicos
    WHERE ordem_id = p_ordem_id
      AND id = ANY(v_existing_ids)
      AND NOT (id = ANY(v_new_ids));
  END IF;

  UPDATE public.ordens_de_servico
  SET
    valor = v_total_valor,
    valor_total_servicos = v_total_valor,
    valor_total = v_total_valor + COALESCE(valor_total_pecas, valor_pecas, 0) + COALESCE(mao_obra_adicional, 0) - COALESCE(desconto, 0),
    valor_pendente = GREATEST(0, v_total_valor + COALESCE(valor_total_pecas, valor_pecas, 0) + COALESCE(mao_obra_adicional, 0) - COALESCE(desconto, 0) - COALESCE(sinal_pago, 0)),
    tipo_servico_id = CASE WHEN jsonb_array_length(v_payload) = 1 THEN NULLIF((v_payload->0)->>'servico_id', '')::uuid ELSE tipo_servico_id END,
    funcionario_id = CASE WHEN jsonb_array_length(v_payload) = 1 THEN NULLIF((v_payload->0)->>'tecnico_id', '')::uuid ELSE funcionario_id END
  WHERE id = p_ordem_id;

  SELECT COALESCE(nome_exibicao, 'Usuário') INTO v_user_nome
  FROM public.user_profiles
  WHERE user_id = v_user OR id = v_user
  LIMIT 1;

  INSERT INTO public.os_auditoria (
    empresa_id, ordem_id, acao, realizada_por, realizada_por_nome, realizada_por_role, motivo, payload
  ) VALUES (
    v_empresa,
    p_ordem_id,
    'edicao_servicos_v2',
    v_user,
    COALESCE(v_user_nome, 'Usuário'),
    v_role,
    NULL,
    jsonb_build_object(
      'servicos', v_payload,
      'removidos', v_removidos,
      'total_servicos', jsonb_array_length(v_payload),
      'total_valor', v_total_valor,
      'total_comissao', v_total_comissao
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'ordem_id', p_ordem_id,
    'total_servicos', jsonb_array_length(v_payload),
    'total_valor', v_total_valor,
    'total_comissao', v_total_comissao
  );
END;
$$;