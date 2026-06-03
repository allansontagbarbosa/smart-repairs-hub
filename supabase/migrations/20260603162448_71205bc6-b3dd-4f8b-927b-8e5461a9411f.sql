-- RH-FIN-INTEGRA-01: pagar funcionário no RH gera/baixa saída no Financeiro (status único, idempotente)

-- Helper: garante uma conta_a_pagar vinculada à movimentação (cria retroativa se faltar)
CREATE OR REPLACE FUNCTION public._rh_garantir_conta(p_mov_id uuid, p_data_pag date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_mov record;
  v_func_nome text;
  v_conta uuid;
  v_cat text;
  v_desc text;
BEGIN
  SELECT * INTO v_mov FROM funcionario_movimentacoes WHERE id = p_mov_id;
  IF v_mov IS NULL THEN RETURN NULL; END IF;
  IF v_mov.conta_pagar_id IS NOT NULL THEN RETURN v_mov.conta_pagar_id; END IF;

  SELECT nome INTO v_func_nome FROM funcionarios WHERE id = v_mov.funcionario_id;

  v_cat := CASE v_mov.tipo::text
    WHEN 'salario' THEN 'Salários'
    WHEN 'vale_transporte' THEN 'Vale Transporte'
    WHEN 'vt' THEN 'Vale Transporte'
    WHEN 'vale_alimentacao' THEN 'Vale Alimentação'
    WHEN 'va' THEN 'Vale Alimentação'
    WHEN 'comissao' THEN 'Comissões'
    WHEN 'hora_extra' THEN 'Salários'
    WHEN 'bonus' THEN 'Salários'
    WHEN 'adiantamento' THEN 'Salários'
    WHEN 'reembolso' THEN 'Reembolsos'
    ELSE 'Pessoal'
  END;

  v_desc := upper(coalesce(v_mov.tipo::text,'PAGAMENTO')) || ' ' || upper(coalesce(v_func_nome,'FUNCIONÁRIO'));

  INSERT INTO contas_a_pagar (
    empresa_id, descricao, valor, categoria, centro_custo,
    data_vencimento, status, mes_competencia, recorrente
  ) VALUES (
    v_mov.empresa_id, v_desc, v_mov.valor_centavos / 100.0, v_cat, 'Administrativo',
    p_data_pag, 'pendente', v_mov.competencia_ano_mes, false
  ) RETURNING id INTO v_conta;

  UPDATE funcionario_movimentacoes SET conta_pagar_id = v_conta WHERE id = p_mov_id;
  RETURN v_conta;
END;$$;

-- Substitui pagar_movimentacoes: agora também marca conta_a_pagar como paga
CREATE OR REPLACE FUNCTION public.pagar_movimentacoes(
  p_movimentacao_ids uuid[],
  p_forma_pagamento text DEFAULT 'transferencia',
  p_criar_conta_pagar boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_emp uuid := get_my_empresa_id();
  v_total bigint := 0;
  v_count int := 0;
  v_contas int := 0;
  v_mov record;
  v_conta_id uuid;
  v_hoje date := CURRENT_DATE;
BEGIN
  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;
  IF NOT (public.is_rh()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão (apenas ADM/RH)');
  END IF;

  FOR v_mov IN
    SELECT * FROM funcionario_movimentacoes
    WHERE id = ANY(p_movimentacao_ids)
      AND empresa_id = v_emp
      AND status = 'pendente'
      AND estornada_em IS NULL
    FOR UPDATE
  LOOP
    -- Garante conta vinculada (cria retroativa se faltar)
    v_conta_id := COALESCE(v_mov.conta_pagar_id, public._rh_garantir_conta(v_mov.id, v_hoje));

    -- Baixa a movimentação
    UPDATE funcionario_movimentacoes
       SET status = 'pago',
           data_pagamento = v_hoje,
           forma_pagamento = p_forma_pagamento
     WHERE id = v_mov.id;

    -- Baixa a conta no Financeiro (se ainda pendente)
    IF v_conta_id IS NOT NULL THEN
      UPDATE contas_a_pagar
         SET status = 'pago',
             data_pagamento = v_hoje,
             valor_pago_centavos = (valor * 100)::bigint,
             updated_at = now()
       WHERE id = v_conta_id
         AND empresa_id = v_emp
         AND deleted_at IS NULL
         AND status <> 'pago';
      v_contas := v_contas + 1;
    END IF;

    v_count := v_count + 1;
    v_total := v_total + v_mov.valor_centavos;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'movimentacoes_pagas', v_count,
    'contas_baixadas', v_contas,
    'total_centavos', v_total
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;$$;

-- Estornar pagamento: reverte os dois lados
CREATE OR REPLACE FUNCTION public.estornar_pagamento_funcionario(
  p_movimentacao_id uuid,
  p_motivo text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_emp uuid := get_my_empresa_id();
  v_mov record;
BEGIN
  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;
  IF NOT (public.is_rh()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão (apenas ADM/RH)');
  END IF;

  SELECT * INTO v_mov FROM funcionario_movimentacoes
   WHERE id = p_movimentacao_id AND empresa_id = v_emp FOR UPDATE;
  IF v_mov IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Movimentação não encontrada');
  END IF;
  IF v_mov.status::text <> 'pago' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Movimentação não está paga');
  END IF;

  UPDATE funcionario_movimentacoes
     SET status = 'pendente',
         data_pagamento = NULL,
         forma_pagamento = NULL,
         estornada_em = now(),
         motivo_estorno = p_motivo
   WHERE id = p_movimentacao_id;

  IF v_mov.conta_pagar_id IS NOT NULL THEN
    UPDATE contas_a_pagar
       SET status = 'pendente',
           data_pagamento = NULL,
           valor_pago_centavos = 0,
           updated_at = now()
     WHERE id = v_mov.conta_pagar_id
       AND empresa_id = v_emp;
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;$$;

GRANT EXECUTE ON FUNCTION public.pagar_movimentacoes(uuid[], text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estornar_pagamento_funcionario(uuid, text) TO authenticated;