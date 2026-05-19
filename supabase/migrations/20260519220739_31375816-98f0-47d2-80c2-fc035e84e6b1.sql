
-- ============================================================
-- PARTE 1 — gerar_folha_mensal_completa com guard por FK
-- ============================================================
CREATE OR REPLACE FUNCTION public.gerar_folha_mensal_completa(
  p_competencia text,
  p_dia_vencimento int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_func record;
  v_data_competencia date;
  v_data_vencimento date;
  v_conta_id uuid;
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
    -- SALÁRIO
    IF v_func.salario_centavos IS NOT NULL AND v_func.salario_centavos > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM funcionario_movimentacoes m
        LEFT JOIN contas_a_pagar c ON c.id = m.conta_pagar_id
        WHERE m.empresa_id = v_empresa_id
          AND m.funcionario_id = v_func.id
          AND m.competencia_ano_mes = p_competencia
          AND m.tipo::text = 'salario'
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

    -- VT
    IF v_func.vt_centavos > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM funcionario_movimentacoes m
        LEFT JOIN contas_a_pagar c ON c.id = m.conta_pagar_id
        WHERE m.empresa_id = v_empresa_id
          AND m.funcionario_id = v_func.id
          AND m.competencia_ano_mes = p_competencia
          AND m.tipo::text = 'vt'
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
          'vt', 'VT ' || p_competencia,
          v_func.vt_centavos, 'pendente', v_conta_id
        );

        v_total_vt := v_total_vt + v_func.vt_centavos;
        v_total_contas_criadas := v_total_contas_criadas + 1;
      END IF;
    END IF;

    -- VA
    IF v_func.va_centavos > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM funcionario_movimentacoes m
        LEFT JOIN contas_a_pagar c ON c.id = m.conta_pagar_id
        WHERE m.empresa_id = v_empresa_id
          AND m.funcionario_id = v_func.id
          AND m.competencia_ano_mes = p_competencia
          AND m.tipo::text = 'va'
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
          'va', 'VA ' || p_competencia,
          v_func.va_centavos, 'pendente', v_conta_id
        );

        v_total_va := v_total_va + v_func.va_centavos;
        v_total_contas_criadas := v_total_contas_criadas + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'competencia', p_competencia,
    'data_vencimento', v_data_vencimento,
    'total_salario_centavos', v_total_salario,
    'total_vt_centavos', v_total_vt,
    'total_va_centavos', v_total_va,
    'contas_criadas', v_total_contas_criadas
  );
END;
$$;

-- ============================================================
-- PARTE 2.1 — Soft delete duplicações de salário/VT/VA maio/2026
-- ============================================================
WITH dups AS (
  SELECT 
    cap.id,
    cap.created_at,
    cap.categoria,
    EXISTS (
      SELECT 1 FROM funcionario_movimentacoes m WHERE m.conta_pagar_id = cap.id
    ) AS tem_movimentacao,
    (
      SELECT f.id FROM funcionarios f
      WHERE f.empresa_id = cap.empresa_id
        AND f.deleted_at IS NULL
        AND upper(cap.descricao) ILIKE '%' || upper(f.nome) || '%'
      ORDER BY length(f.nome) DESC
      LIMIT 1
    ) AS func_inferido
  FROM contas_a_pagar cap
  WHERE cap.categoria IN ('Salários', 'Vale Transporte', 'Vale Alimentação')
    AND cap.mes_competencia = '2026-05'
    AND cap.deleted_at IS NULL
    AND cap.empresa_id = 'de4680d4-7f48-4971-bef4-8c5b64c09005'
),
ranked AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY categoria, func_inferido
      ORDER BY tem_movimentacao DESC, created_at DESC
    ) AS rn
  FROM dups
  WHERE func_inferido IS NOT NULL
)
UPDATE contas_a_pagar
SET deleted_at = now(),
    observacoes = COALESCE(observacoes, '') || E'\nSoft-deletado em fix de duplicação ' || now()::text
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ============================================================
-- PARTE 2.2 — Aluguel duplicado em 30/05 (clique duplo)
-- Mantém apenas 1 das 2 linhas idênticas de R$ 6.160,84 no dia 30
-- ============================================================
WITH aluguel_dups AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY descricao, valor, data_vencimento
      ORDER BY created_at ASC
    ) AS rn
  FROM contas_a_pagar
  WHERE categoria = 'Aluguel'
    AND data_vencimento BETWEEN '2026-05-01' AND '2026-05-31'
    AND deleted_at IS NULL
    AND empresa_id = 'de4680d4-7f48-4971-bef4-8c5b64c09005'
)
UPDATE contas_a_pagar
SET deleted_at = now(),
    observacoes = COALESCE(observacoes, '') || E'\nSoft-deletado em fix de aluguel duplicado'
WHERE id IN (SELECT id FROM aluguel_dups WHERE rn > 1);

-- ============================================================
-- PARTE 3 — get_painel_socio_v1: não contar comissões 2x e ignorar deleted_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_painel_socio_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_empresa_id UUID;
  v_socio RECORD;
  v_reserva_pct NUMERIC;
  v_inicio_mes DATE := date_trunc('month', current_date)::date;
  v_fim_mes DATE := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
  v_inicio_mes_passado DATE := date_trunc('month', current_date - interval '1 month')::date;
  v_fim_mes_passado DATE := (date_trunc('month', current_date) - interval '1 day')::date;
  v_dias_passados INT;
  v_dias_no_mes INT;
  v_faturamento_parcial NUMERIC := 0;
  v_custos_pecas_parcial NUMERIC := 0;
  v_custo_terc_parcial NUMERIC := 0;
  v_despesas_parcial NUMERIC := 0;
  v_comissoes_parcial NUMERIC := 0;
  v_ll_parcial NUMERIC;
  v_reserva_parcial NUMERIC;
  v_distrib_parcial NUMERIC;
  v_meu_valor_parcial NUMERIC;
  v_fechamento_previsto NUMERIC;
  v_ll_mes_passado NUMERIC := 0;
  v_custo_terc_mes_passado NUMERIC := 0;
  v_meu_valor_mes_passado NUMERIC := 0;
  v_historico jsonb := '[]'::jsonb;
  v_funcionarios_roi jsonb := '[]'::jsonb;
  v_socios_lista jsonb := '[]'::jsonb;
  v_metas jsonb := '[]'::jsonb;
  v_saude_caixa jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT s.id, s.nome, s.percentual_participacao, s.empresa_id
    INTO v_socio
    FROM public.socios s
    WHERE s.user_id = v_user_id
      AND s.ativo = true
      AND s.deleted_at IS NULL
    LIMIT 1;

  IF v_socio.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_socio', 'message', 'Usuário não é sócio cadastrado');
  END IF;

  v_empresa_id := v_socio.empresa_id;

  SELECT COALESCE(percentual_reserva_empresa, 20) INTO v_reserva_pct
    FROM public.empresa_config WHERE empresa_id = v_empresa_id LIMIT 1;
  v_reserva_pct := COALESCE(v_reserva_pct, 20);

  v_dias_no_mes := EXTRACT(DAY FROM v_fim_mes)::int;
  v_dias_passados := LEAST(EXTRACT(DAY FROM current_date)::int, v_dias_no_mes);

  SELECT COALESCE(SUM(COALESCE(valor_total, valor, 0)), 0),
         COALESCE(SUM(COALESCE(custo_pecas, 0)), 0)
    INTO v_faturamento_parcial, v_custos_pecas_parcial
    FROM public.ordens_de_servico
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND status IN ('entregue', 'pronto')
      AND data_conclusao >= v_inicio_mes AND data_conclusao <= current_date;

  SELECT COALESCE(SUM(oss.valor_terceirizado), 0)
    INTO v_custo_terc_parcial
    FROM public.os_servicos oss
    JOIN public.ordens_de_servico ord ON ord.id = oss.ordem_id
    WHERE oss.empresa_id = v_empresa_id
      AND oss.motivo_sem_tecnico = 'terceirizado'
      AND ord.status IN ('entregue', 'pronto')
      AND ord.data_conclusao >= v_inicio_mes
      AND ord.data_conclusao <= current_date;

  SELECT COALESCE(SUM(valor), 0) INTO v_despesas_parcial
    FROM public.contas_a_pagar
    WHERE empresa_id = v_empresa_id
      AND status IN ('paga', 'pendente')
      AND categoria != 'Comissões'
      AND deleted_at IS NULL
      AND data_vencimento >= v_inicio_mes
      AND data_vencimento <= v_fim_mes;

  SELECT COALESCE(SUM(valor), 0) INTO v_comissoes_parcial
    FROM public.comissoes
    WHERE empresa_id = v_empresa_id
      AND status IN ('paga', 'pendente')
      AND mes_competencia = to_char(current_date, 'YYYY-MM');

  v_ll_parcial := v_faturamento_parcial - v_custos_pecas_parcial - v_custo_terc_parcial - v_despesas_parcial - v_comissoes_parcial;
  v_reserva_parcial := CASE WHEN v_ll_parcial > 0 THEN v_ll_parcial * v_reserva_pct / 100 ELSE 0 END;
  v_distrib_parcial := CASE WHEN v_ll_parcial > 0 THEN v_ll_parcial - v_reserva_parcial ELSE 0 END;
  v_meu_valor_parcial := v_distrib_parcial * v_socio.percentual_participacao / 100;

  IF v_dias_passados > 0 THEN
    v_fechamento_previsto := v_meu_valor_parcial * v_dias_no_mes / v_dias_passados;
  ELSE
    v_fechamento_previsto := 0;
  END IF;

  SELECT COALESCE(SUM(COALESCE(valor_total, valor, 0)), 0)
       - COALESCE(SUM(COALESCE(custo_pecas, 0)), 0)
    INTO v_ll_mes_passado
    FROM public.ordens_de_servico
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND status IN ('entregue', 'pronto')
      AND data_conclusao >= v_inicio_mes_passado AND data_conclusao <= v_fim_mes_passado;

  SELECT COALESCE(SUM(oss.valor_terceirizado), 0)
    INTO v_custo_terc_mes_passado
    FROM public.os_servicos oss
    JOIN public.ordens_de_servico ord ON ord.id = oss.ordem_id
    WHERE oss.empresa_id = v_empresa_id
      AND oss.motivo_sem_tecnico = 'terceirizado'
      AND ord.status IN ('entregue', 'pronto')
      AND ord.data_conclusao BETWEEN v_inicio_mes_passado AND v_fim_mes_passado;

  v_ll_mes_passado := v_ll_mes_passado
    - v_custo_terc_mes_passado
    - COALESCE((SELECT SUM(valor) FROM public.contas_a_pagar
        WHERE empresa_id = v_empresa_id
          AND status IN ('paga', 'pendente')
          AND categoria != 'Comissões'
          AND deleted_at IS NULL
          AND data_vencimento BETWEEN v_inicio_mes_passado AND v_fim_mes_passado), 0)
    - COALESCE((SELECT SUM(valor) FROM public.comissoes
        WHERE empresa_id = v_empresa_id AND status IN ('paga', 'pendente')
          AND mes_competencia = to_char(v_inicio_mes_passado, 'YYYY-MM')), 0);

  v_meu_valor_mes_passado := GREATEST(v_ll_mes_passado, 0)
    * (1 - v_reserva_pct / 100)
    * v_socio.percentual_participacao / 100;

  WITH meses AS (
    SELECT generate_series(
      date_trunc('month', current_date - interval '5 months'),
      date_trunc('month', current_date),
      interval '1 month'
    )::date AS mes_inicio
  ),
  fat AS (
    SELECT date_trunc('month', data_conclusao)::date AS mes,
           SUM(COALESCE(valor_total, valor, 0)) AS faturamento,
           SUM(COALESCE(custo_pecas, 0)) AS custo_pecas
      FROM public.ordens_de_servico
      WHERE empresa_id = v_empresa_id
        AND deleted_at IS NULL
        AND status IN ('entregue', 'pronto')
        AND data_conclusao >= current_date - interval '6 months'
      GROUP BY 1
  ),
  terc AS (
    SELECT date_trunc('month', ord.data_conclusao)::date AS mes,
           SUM(oss.valor_terceirizado) AS custo_terc
      FROM public.os_servicos oss
      JOIN public.ordens_de_servico ord ON ord.id = oss.ordem_id
      WHERE oss.empresa_id = v_empresa_id
        AND oss.motivo_sem_tecnico = 'terceirizado'
        AND ord.status IN ('entregue', 'pronto')
        AND ord.data_conclusao >= current_date - interval '6 months'
      GROUP BY 1
  ),
  desp AS (
    SELECT date_trunc('month', data_vencimento)::date AS mes,
           SUM(valor) AS despesas
      FROM public.contas_a_pagar
      WHERE empresa_id = v_empresa_id
        AND status IN ('paga', 'pendente')
        AND categoria != 'Comissões'
        AND deleted_at IS NULL
        AND data_vencimento >= current_date - interval '6 months'
      GROUP BY 1
  ),
  com AS (
    SELECT (mes_competencia || '-01')::date AS mes,
           SUM(valor) AS comissoes
      FROM public.comissoes
      WHERE empresa_id = v_empresa_id
        AND status IN ('paga', 'pendente')
        AND mes_competencia >= to_char(current_date - interval '6 months', 'YYYY-MM')
      GROUP BY mes_competencia
  )
  SELECT jsonb_agg(jsonb_build_object(
      'mes', to_char(m.mes_inicio, 'Mon/YY'),
      'mes_inicio', m.mes_inicio,
      'faturamento', COALESCE(f.faturamento, 0),
      'custo_pecas', COALESCE(f.custo_pecas, 0),
      'custo_terceirizado', COALESCE(t.custo_terc, 0),
      'despesas', COALESCE(d.despesas, 0),
      'comissoes', COALESCE(c.comissoes, 0),
      'lucro_liquido', GREATEST(COALESCE(f.faturamento, 0) - COALESCE(f.custo_pecas, 0) - COALESCE(t.custo_terc, 0) - COALESCE(d.despesas, 0) - COALESCE(c.comissoes, 0), 0),
      'meu_valor', GREATEST(COALESCE(f.faturamento, 0) - COALESCE(f.custo_pecas, 0) - COALESCE(t.custo_terc, 0) - COALESCE(d.despesas, 0) - COALESCE(c.comissoes, 0), 0)
                   * (1 - v_reserva_pct / 100) * v_socio.percentual_participacao / 100
    ) ORDER BY m.mes_inicio)
    INTO v_historico
    FROM meses m
    LEFT JOIN fat f ON f.mes = m.mes_inicio
    LEFT JOIN terc t ON t.mes = m.mes_inicio
    LEFT JOIN desp d ON d.mes = m.mes_inicio
    LEFT JOIN com c ON c.mes = m.mes_inicio;

  WITH receita_func AS (
    SELECT oss.tecnico_id AS func_id,
           SUM(COALESCE(oss.valor, 0)) AS receita
      FROM public.os_servicos oss
      JOIN public.ordens_de_servico ord ON ord.id = oss.ordem_id
      WHERE oss.empresa_id = v_empresa_id
        AND oss.tecnico_id IS NOT NULL
        AND oss.status::text = 'concluido'
        AND ord.data_conclusao >= v_inicio_mes_passado
      GROUP BY oss.tecnico_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', f.id,
      'nome', f.nome,
      'cargo', COALESCE(f.cargo, '—'),
      'custo_total_centavos',
        COALESCE(f.salario_centavos, 0) + COALESCE(f.vt_centavos, 0) + COALESCE(f.va_centavos, 0),
      'receita_centavos', ROUND(COALESCE(rf.receita, 0) * 100)::bigint,
      'roi', CASE
        WHEN COALESCE(f.salario_centavos, 0) = 0 THEN NULL
        ELSE ROUND((COALESCE(rf.receita, 0) * 100)
                   / NULLIF((COALESCE(f.salario_centavos, 0) + COALESCE(f.vt_centavos, 0) + COALESCE(f.va_centavos, 0)), 0)::numeric, 2)
      END,
      'status', CASE
        WHEN COALESCE(f.salario_centavos, 0) = 0 THEN 'sem_salario'
        WHEN COALESCE(rf.receita, 0) = 0 THEN 'prejuizo'
        WHEN (COALESCE(rf.receita, 0) * 100) / NULLIF((COALESCE(f.salario_centavos, 0) + COALESCE(f.vt_centavos, 0) + COALESCE(f.va_centavos, 0)), 0)::numeric < 1 THEN 'prejuizo'
        WHEN (COALESCE(rf.receita, 0) * 100) / NULLIF((COALESCE(f.salario_centavos, 0) + COALESCE(f.vt_centavos, 0) + COALESCE(f.va_centavos, 0)), 0)::numeric < 2 THEN 'atencao'
        WHEN (COALESCE(rf.receita, 0) * 100) / NULLIF((COALESCE(f.salario_centavos, 0) + COALESCE(f.vt_centavos, 0) + COALESCE(f.va_centavos, 0)), 0)::numeric < 4 THEN 'ok'
        ELSE 'estrela'
      END
    ) ORDER BY COALESCE(rf.receita, 0) DESC
  )
  INTO v_funcionarios_roi
  FROM public.funcionarios f
  LEFT JOIN receita_func rf ON rf.func_id = f.id
  WHERE f.empresa_id = v_empresa_id
    AND f.ativo = true
    AND f.deleted_at IS NULL
    AND f.eh_funcionario_rh = true
    AND (
      LOWER(f.cargo) LIKE '%tec%'
      OR LOWER(f.cargo) LIKE '%téc%'
    )
    AND LOWER(COALESCE(f.nome, '')) NOT LIKE '%teste%'
    AND LOWER(COALESCE(f.nome, '')) NOT LIKE '%qa%';

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'nome', s.nome,
      'percentual', s.percentual_participacao,
      'valor_estimado', v_distrib_parcial * s.percentual_participacao / 100,
      'eh_voce', (s.user_id = v_user_id)
    ) ORDER BY s.percentual_participacao DESC
  )
  INTO v_socios_lista
  FROM public.socios s
  WHERE s.empresa_id = v_empresa_id
    AND s.ativo = true
    AND s.deleted_at IS NULL;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'titulo', m.titulo,
      'valor_alvo_centavos', m.valor_alvo_centavos,
      'valor_acumulado_centavos', m.valor_acumulado_centavos,
      'data_alvo', m.data_alvo,
      'icone', m.icone,
      'cor', m.cor,
      'progresso_pct', LEAST(ROUND(m.valor_acumulado_centavos::numeric / m.valor_alvo_centavos * 100), 100)
    ) ORDER BY m.created_at
  )
  INTO v_metas
  FROM public.socio_metas m
  WHERE m.user_id = v_user_id AND m.ativo = true;

  v_saude_caixa := jsonb_build_object(
    'inadimplencia_centavos', ROUND(COALESCE((
        SELECT SUM(valor) FROM public.contas_a_pagar
        WHERE empresa_id = v_empresa_id
          AND status != 'paga'
          AND deleted_at IS NULL
          AND data_vencimento < current_date
      ), 0) * 100)::bigint,
    'inadimplencia_qtd', COALESCE((
        SELECT COUNT(*) FROM public.contas_a_pagar
        WHERE empresa_id = v_empresa_id
          AND status != 'paga'
          AND deleted_at IS NULL
          AND data_vencimento < current_date
      ), 0),
    'inadimplencia_dias_max', COALESCE((
        SELECT MAX(current_date - data_vencimento) FROM public.contas_a_pagar
        WHERE empresa_id = v_empresa_id
          AND status != 'paga'
          AND deleted_at IS NULL
          AND data_vencimento < current_date
      ), 0),
    'gastos_fixos_mes_centavos', ROUND(COALESCE((
        SELECT AVG(soma) FROM (
          SELECT date_trunc('month', data_pagamento) AS mes, SUM(valor) AS soma
            FROM public.contas_a_pagar
            WHERE empresa_id = v_empresa_id
              AND status = 'paga'
              AND deleted_at IS NULL
              AND data_pagamento >= current_date - interval '3 months'
            GROUP BY 1
        ) sub
      ), 0) * 100)::bigint
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'gerado_em', now(),
    'socio', jsonb_build_object(
      'id', v_socio.id,
      'nome', v_socio.nome,
      'percentual', v_socio.percentual_participacao
    ),
    'periodo', jsonb_build_object(
      'inicio_mes', v_inicio_mes,
      'fim_mes', v_fim_mes,
      'hoje', current_date,
      'dias_passados', v_dias_passados,
      'dias_no_mes', v_dias_no_mes,
      'progresso_pct', ROUND(v_dias_passados::numeric / v_dias_no_mes * 100)
    ),
    'mes_atual', jsonb_build_object(
      'faturamento', v_faturamento_parcial,
      'receita_servicos', v_faturamento_parcial - v_custos_pecas_parcial,
      'custo_pecas', v_custos_pecas_parcial,
      'custo_terceirizado', v_custo_terc_parcial,
      'despesas', v_despesas_parcial,
      'comissoes', v_comissoes_parcial,
      'lucro_liquido', v_ll_parcial,
      'reserva_pct', v_reserva_pct,
      'reserva_val', v_reserva_parcial,
      'distribuivel', v_distrib_parcial,
      'meu_valor_parcial', v_meu_valor_parcial,
      'fechamento_previsto', v_fechamento_previsto
    ),
    'mes_passado', jsonb_build_object(
      'lucro_liquido', v_ll_mes_passado,
      'meu_valor', v_meu_valor_mes_passado
    ),
    'variacao_mes', CASE
      WHEN v_meu_valor_mes_passado > 0
        THEN ROUND(((v_fechamento_previsto - v_meu_valor_mes_passado) / v_meu_valor_mes_passado * 100)::numeric, 1)
      ELSE NULL
    END,
    'historico', COALESCE(v_historico, '[]'::jsonb),
    'funcionarios_roi', COALESCE(v_funcionarios_roi, '[]'::jsonb),
    'socios', COALESCE(v_socios_lista, '[]'::jsonb),
    'metas', COALESCE(v_metas, '[]'::jsonb),
    'saude', v_saude_caixa
  );
END;
$function$;

-- ============================================================
-- PARTE 4 — Ressincronizar comissões em contas_a_pagar
-- ============================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT funcionario_id, mes_competencia
      FROM public.comissoes
      WHERE empresa_id = 'de4680d4-7f48-4971-bef4-8c5b64c09005'
        AND mes_competencia >= '2026-04'
  LOOP
    PERFORM public.sync_comissao_contas_a_pagar(r.funcionario_id, r.mes_competencia);
  END LOOP;
END$$;
