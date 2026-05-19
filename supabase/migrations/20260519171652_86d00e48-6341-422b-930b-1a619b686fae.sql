CREATE OR REPLACE FUNCTION public.get_painel_socio_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_despesas_parcial NUMERIC := 0;
  v_comissoes_parcial NUMERIC := 0;
  v_ll_parcial NUMERIC;
  v_reserva_parcial NUMERIC;
  v_distrib_parcial NUMERIC;
  v_meu_valor_parcial NUMERIC;
  v_fechamento_previsto NUMERIC;
  v_ll_mes_passado NUMERIC := 0;
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

  SELECT COALESCE(SUM(valor), 0) INTO v_despesas_parcial
    FROM public.contas_a_pagar
    WHERE empresa_id = v_empresa_id
      AND status = 'paga'
      AND data_pagamento >= v_inicio_mes AND data_pagamento <= current_date;

  SELECT COALESCE(SUM(valor), 0) INTO v_comissoes_parcial
    FROM public.comissoes
    WHERE empresa_id = v_empresa_id
      AND status = 'paga'
      AND data_pagamento >= v_inicio_mes AND data_pagamento <= current_date;

  v_ll_parcial := v_faturamento_parcial - v_custos_pecas_parcial - v_despesas_parcial - v_comissoes_parcial;
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

  v_ll_mes_passado := v_ll_mes_passado
    - COALESCE((SELECT SUM(valor) FROM public.contas_a_pagar
        WHERE empresa_id = v_empresa_id AND status = 'paga'
          AND data_pagamento BETWEEN v_inicio_mes_passado AND v_fim_mes_passado), 0)
    - COALESCE((SELECT SUM(valor) FROM public.comissoes
        WHERE empresa_id = v_empresa_id AND status = 'paga'
          AND data_pagamento BETWEEN v_inicio_mes_passado AND v_fim_mes_passado), 0);

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
  desp AS (
    SELECT date_trunc('month', data_pagamento)::date AS mes,
           SUM(valor) AS despesas
      FROM public.contas_a_pagar
      WHERE empresa_id = v_empresa_id
        AND status = 'paga'
        AND data_pagamento >= current_date - interval '6 months'
      GROUP BY 1
  ),
  com AS (
    SELECT date_trunc('month', data_pagamento)::date AS mes,
           SUM(valor) AS comissoes
      FROM public.comissoes
      WHERE empresa_id = v_empresa_id
        AND status = 'paga'
        AND data_pagamento >= current_date - interval '6 months'
      GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
      'mes', to_char(m.mes_inicio, 'Mon/YY'),
      'mes_inicio', m.mes_inicio,
      'faturamento', COALESCE(f.faturamento, 0),
      'custo_pecas', COALESCE(f.custo_pecas, 0),
      'despesas', COALESCE(d.despesas, 0),
      'comissoes', COALESCE(c.comissoes, 0),
      'lucro_liquido', GREATEST(COALESCE(f.faturamento, 0) - COALESCE(f.custo_pecas, 0) - COALESCE(d.despesas, 0) - COALESCE(c.comissoes, 0), 0),
      'meu_valor', GREATEST(COALESCE(f.faturamento, 0) - COALESCE(f.custo_pecas, 0) - COALESCE(d.despesas, 0) - COALESCE(c.comissoes, 0), 0)
                   * (1 - v_reserva_pct / 100) * v_socio.percentual_participacao / 100
    ) ORDER BY m.mes_inicio)
    INTO v_historico
    FROM meses m
    LEFT JOIN fat f ON f.mes = m.mes_inicio
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
    AND f.eh_funcionario_rh = true;

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
          AND data_vencimento < current_date
      ), 0) * 100)::bigint,
    'gastos_fixos_mes_centavos', ROUND(COALESCE((
        SELECT AVG(soma) FROM (
          SELECT date_trunc('month', data_pagamento) AS mes, SUM(valor) AS soma
            FROM public.contas_a_pagar
            WHERE empresa_id = v_empresa_id
              AND status = 'paga'
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
      'custo_pecas', v_custos_pecas_parcial,
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
$$;