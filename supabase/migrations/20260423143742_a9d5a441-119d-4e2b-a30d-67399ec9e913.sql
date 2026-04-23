-- 1) Colunas em ordens_de_servico
ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS eh_retroativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS criada_retroativamente_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS justificativa_retroativa text;

-- 2) Coluna mes_competencia em comissoes
ALTER TABLE public.comissoes
  ADD COLUMN IF NOT EXISTS mes_competencia text;

CREATE INDEX IF NOT EXISTS idx_comissoes_mes_competencia
  ON public.comissoes (mes_competencia);

-- Backfill: preencher mes_competencia das comissoes existentes a partir do created_at
UPDATE public.comissoes
   SET mes_competencia = to_char(created_at, 'YYYY-MM')
 WHERE mes_competencia IS NULL;

-- 3) RPC criar_os_com_data
CREATE OR REPLACE FUNCTION public.criar_os_com_data(
  p_dados jsonb,
  p_data_entrada timestamptz,
  p_justificativa text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- 1. Validar empresa
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada' USING ERRCODE = '42501';
  END IF;

  -- 2. Calcular se é retroativa
  v_dias_diff := GREATEST(0, EXTRACT(DAY FROM (v_data_atual - p_data_entrada))::int);
  v_eh_retroativa := p_data_entrada < (v_data_atual - INTERVAL '1 hour');

  -- 3. Validações de retroativa
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

  -- 4. Validar data não-futura
  IF p_data_entrada > (v_data_atual + INTERVAL '1 hour') THEN
    RAISE EXCEPTION 'Não é permitido cadastrar OS com data futura' USING ERRCODE = '22023';
  END IF;

  -- 5. Nome para auditoria
  SELECT COALESCE(nome_exibicao, 'Usuário')
    INTO v_user_nome
    FROM public.user_profiles
    WHERE user_id = v_user_id OR id = v_user_id
    LIMIT 1;

  IF v_user_nome IS NULL THEN
    v_user_nome := 'Usuário';
  END IF;

  -- 6. INSERT na ordens_de_servico
  -- Faz merge dinâmico do payload jsonb com os campos calculados aqui.
  -- Campos obrigatórios: aparelho_id, defeito_relatado.
  -- empresa_id, data_entrada, created_at, eh_retroativa* sempre vêm da função.
  INSERT INTO public.ordens_de_servico (
    aparelho_id,
    defeito_relatado,
    relato_cliente,
    observacoes,
    valor,
    valor_total,
    custo_pecas,
    mao_obra_adicional,
    desconto,
    sinal_pago,
    valor_pago,
    valor_pendente,
    forma_pagamento_sinal,
    garantia_dias,
    aprovacao_orcamento,
    aprovado_no_ato,
    data_aprovacao,
    tecnico,
    funcionario_id,
    obs_cliente,
    liga,
    bateria_entrada,
    estado_geral,
    imei2,
    contato_preferido,
    checklist_entrada,
    previsao_entrega,
    status,
    lojista_id,
    loja_id,
    tipo_servico_id,
    prioridade,
    -- campos controlados pela função:
    empresa_id,
    data_entrada,
    eh_retroativa,
    criada_retroativamente_por,
    justificativa_retroativa,
    created_at
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
    CASE WHEN p_dados ? 'checklist_entrada'
         THEN p_dados->'checklist_entrada'
         ELSE NULL END,
    NULLIF(p_dados->>'previsao_entrega','')::timestamptz,
    COALESCE(p_dados->>'status', 'recebido')::status_ordem,
    NULLIF(p_dados->>'lojista_id','')::uuid,
    NULLIF(p_dados->>'loja_id','')::uuid,
    NULLIF(p_dados->>'tipo_servico_id','')::uuid,
    COALESCE(p_dados->>'prioridade', 'normal'),
    v_empresa_id,
    p_data_entrada,
    v_eh_retroativa,
    CASE WHEN v_eh_retroativa THEN v_user_id ELSE NULL END,
    CASE WHEN v_eh_retroativa THEN p_justificativa ELSE NULL END,
    now()
  )
  RETURNING id, numero, numero_formatado
  INTO v_nova_os_id, v_numero, v_numero_formatado;

  -- 7. Auditoria (apenas retroativa)
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
$$;

-- 4) Atualizar trigger gerar_comissao_automatica para preencher mes_competencia
CREATE OR REPLACE FUNCTION public.gerar_comissao_automatica()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cs record;
  v_func record;
  v_valor_comissao numeric;
  v_tipo text;
  v_servico_nome text;
  v_already_exists boolean;
  v_mes_competencia text;
BEGIN
  IF NEW.status = 'pronto' AND OLD.status IS DISTINCT FROM 'pronto' AND NEW.funcionario_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.comissoes WHERE ordem_id = NEW.id
    ) INTO v_already_exists;

    IF v_already_exists THEN
      RETURN NEW;
    END IF;

    IF NEW.tipo_servico_id IS NOT NULL THEN
      SELECT nome INTO v_servico_nome FROM public.tipos_servico WHERE id = NEW.tipo_servico_id;
    END IF;

    IF NEW.tipo_servico_id IS NOT NULL THEN
      SELECT tipo_comissao, valor INTO v_cs
      FROM public.comissoes_servico
      WHERE funcionario_id = NEW.funcionario_id
        AND tipo_servico_id = NEW.tipo_servico_id;
    END IF;

    IF v_cs IS NOT NULL AND v_cs.valor > 0 THEN
      IF v_cs.tipo_comissao = 'percentual' THEN
        v_valor_comissao := COALESCE(NEW.valor, 0) * v_cs.valor / 100;
      ELSE
        v_valor_comissao := v_cs.valor;
      END IF;
      v_tipo := v_cs.tipo_comissao::text;
    ELSE
      SELECT tipo_comissao, valor_comissao INTO v_func
      FROM public.funcionarios
      WHERE id = NEW.funcionario_id AND ativo = true;

      IF NOT FOUND OR v_func.valor_comissao <= 0 THEN
        RETURN NEW;
      END IF;

      IF v_func.tipo_comissao = 'percentual' THEN
        v_valor_comissao := COALESCE(NEW.valor, 0) * v_func.valor_comissao / 100;
      ELSE
        v_valor_comissao := v_func.valor_comissao;
      END IF;
      v_tipo := v_func.tipo_comissao::text;
    END IF;

    -- Competência: data_entrada se OS retroativa, senão now() (data de conclusão real)
    v_mes_competencia := CASE
      WHEN COALESCE(NEW.eh_retroativa, false) THEN to_char(NEW.data_entrada, 'YYYY-MM')
      ELSE to_char(now(), 'YYYY-MM')
    END;

    INSERT INTO public.comissoes (
      funcionario_id, ordem_id, valor, valor_base, tipo, status,
      observacoes, mes_competencia
    )
    VALUES (
      NEW.funcionario_id,
      NEW.id,
      v_valor_comissao,
      COALESCE(NEW.valor, 0),
      v_tipo,
      'pendente',
      CASE WHEN v_servico_nome IS NOT NULL THEN 'Serviço: ' || v_servico_nome ELSE NULL END,
      v_mes_competencia
    );
  END IF;
  RETURN NEW;
END;
$function$;