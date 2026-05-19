CREATE OR REPLACE FUNCTION public.gerar_folha_mensal_completa(p_competencia text, p_dia_vencimento integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_func record;
  v_data_competencia date;
  v_data_vencimento date;
  v_conta_id uuid;
  v_count_lancados int := 0;
  v_total_salario bigint := 0;
  v_total_vt bigint := 0;
  v_total_va bigint := 0;
  v_total_contas_criadas int := 0;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  v_data_competencia := to_date(p_competencia || '-01', 'YYYY-MM-DD');

  IF p_dia_vencimento IS NOT NULL THEN
    v_data_vencimento := (v_data_competencia + interval '1 month'
                           + (p_dia_vencimento - 1) * interval '1 day')::date;
  ELSE
    v_data_vencimento := (v_data_competencia + interval '1 month' - interval '1 day')::date;
  END IF;

  FOR v_func IN
    SELECT * FROM funcionarios
    WHERE empresa_id = v_empresa_id
      AND ativo = true
      AND deleted_at IS NULL
      AND eh_funcionario_rh = true
  LOOP
    -- SALÁRIO: guard via FK em funcionario_movimentacoes (robusto, ignora variação de descrição)
    IF v_func.salario_centavos IS NOT NULL AND v_func.salario_centavos > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM funcionario_movimentacoes m
        LEFT JOIN contas_a_pagar c ON c.id = m.conta_pagar_id
        WHERE m.empresa_id = v_empresa_id
          AND m.funcionario_id = v_func.id
          AND m.competencia_ano_mes = p_competencia
          AND m.tipo = 'salario'
          AND m.estornada_em IS NULL
          AND (c.id IS NULL OR c.deleted_at IS NULL)
      ) THEN
        INSERT INTO contas_a_pagar (
          empresa_id, descricao, valor, categoria, centro_custo,
          data_vencimento, status, mes_competencia, recorrente
        ) VALUES (
          v_empresa_id, 'SALÁRIO ' || upper(v_func.nome),
          v_func.salario_centavos / 100.0, 'Salários', 'Administrativo',
          v_data_vencimento, 'pendente', p_competencia, true
        ) RETURNING id INTO v_conta_id;

        INSERT INTO funcionario_movimentacoes (
          empresa_id, funcionario_id, data, competencia_ano_mes,
          tipo, descricao, valor_centavos, status, conta_pagar_id
        ) VALUES (
          v_empresa_id, v_func.id, v_data_competencia, p_competencia,
          'salario', 'Salário ' || p_competencia,
          v_func.salario_centavos, 'pendente', v_conta_id
        );

        v_total_salario := v_total_salario + v_func.salario_centavos;
        v_total_contas_criadas := v_total_contas_criadas + 1;
      END IF;
    END IF;

    -- VT: mesmo padrão
    IF v_func.vt_centavos > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM funcionario_movimentacoes m
        LEFT JOIN contas_a_pagar c ON c.id = m.conta_pagar_id
        WHERE m.empresa_id = v_empresa_id
          AND m.funcionario_id = v_func.id
          AND m.competencia_ano_mes = p_competencia
          AND m.tipo = 'vale_transporte'
          AND m.estornada_em IS NULL
          AND (c.id IS NULL OR c.deleted_at IS NULL)
      ) THEN
        INSERT INTO contas_a_pagar (
          empresa_id, descricao, valor, categoria, centro_custo,
          data_vencimento, status, mes_competencia, recorrente
        ) VALUES (
          v_empresa_id, 'VT ' || upper(v_func.nome),
          v_func.vt_centavos / 100.0, 'Vale Transporte', 'Administrativo',
          v_data_vencimento, 'pendente', p_competencia, true
        ) RETURNING id INTO v_conta_id;

        INSERT INTO funcionario_movimentacoes (
          empresa_id, funcionario_id, data, competencia_ano_mes,
          tipo, descricao, valor_centavos, status, conta_pagar_id
        ) VALUES (
          v_empresa_id, v_func.id, v_data_competencia, p_competencia,
          'vale_transporte', 'VT ' || p_competencia,
          v_func.vt_centavos, 'pendente', v_conta_id
        );

        v_total_vt := v_total_vt + v_func.vt_centavos;
        v_total_contas_criadas := v_total_contas_criadas + 1;
      END IF;
    END IF;

    -- VA: mesmo padrão
    IF v_func.va_centavos > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM funcionario_movimentacoes m
        LEFT JOIN contas_a_pagar c ON c.id = m.conta_pagar_id
        WHERE m.empresa_id = v_empresa_id
          AND m.funcionario_id = v_func.id
          AND m.competencia_ano_mes = p_competencia
          AND m.tipo = 'vale_alimentacao'
          AND m.estornada_em IS NULL
          AND (c.id IS NULL OR c.deleted_at IS NULL)
      ) THEN
        INSERT INTO contas_a_pagar (
          empresa_id, descricao, valor, categoria, centro_custo,
          data_vencimento, status, mes_competencia, recorrente
        ) VALUES (
          v_empresa_id, 'VA ' || upper(v_func.nome),
          v_func.va_centavos / 100.0, 'Vale Alimentação', 'Administrativo',
          v_data_vencimento, 'pendente', p_competencia, true
        ) RETURNING id INTO v_conta_id;

        INSERT INTO funcionario_movimentacoes (
          empresa_id, funcionario_id, data, competencia_ano_mes,
          tipo, descricao, valor_centavos, status, conta_pagar_id
        ) VALUES (
          v_empresa_id, v_func.id, v_data_competencia, p_competencia,
          'vale_alimentacao', 'VA ' || p_competencia,
          v_func.va_centavos, 'pendente', v_conta_id
        );

        v_total_va := v_total_va + v_func.va_centavos;
        v_total_contas_criadas := v_total_contas_criadas + 1;
      END IF;
    END IF;

    v_count_lancados := v_count_lancados + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'competencia', p_competencia,
    'data_vencimento', v_data_vencimento,
    'funcionarios_processados', v_count_lancados,
    'contas_criadas', v_total_contas_criadas,
    'total_salarios_centavos', v_total_salario,
    'total_vt_centavos', v_total_vt,
    'total_va_centavos', v_total_va,
    'total_geral_centavos', v_total_salario + v_total_vt + v_total_va
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;