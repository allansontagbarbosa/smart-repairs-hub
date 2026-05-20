CREATE OR REPLACE FUNCTION public.get_painel_socio_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_socio_id uuid;
  v_meu_percentual numeric;

  v_inicio_mes date := date_trunc('month', current_date)::date;
  v_fim_mes date := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
  v_inicio_mes_passado date := date_trunc('month', current_date - interval '1 month')::date;
  v_fim_mes_passado date := (date_trunc('month', current_date) - interval '1 day')::date;
  v_fim_periodo_mp date;
  v_dias_passados int;
  v_dias_no_mes int;
  v_fator_projecao numeric;

  v_dre_parcial jsonb;
  v_dre_completo jsonb;
  v_dre_mes_passado jsonb;
  v_dre_periodo_mp jsonb;

  v_fat_prev numeric;
  v_peca_prev numeric;
  v_com_prev numeric;
  v_ll_prev numeric;
  v_distrib_prev numeric;
  v_meu_valor_prev numeric;
  v_despesas_total numeric;
  v_reserva_pct numeric;

  -- valores misturados parcial+completo
  v_receita_parcial numeric;
  v_pecas_parcial numeric;
  v_com_parcial numeric;
  v_prej_parcial numeric;
  v_gastos_fixos_compl numeric;
  v_outros_compl numeric;
  v_impostos_compl numeric;
  v_lucro_liquido_misto numeric;
  v_distribuivel_misto numeric;
  v_reserva_val_misto numeric;

  v_meu_valor_parcial numeric;
  v_meu_valor_mp numeric;
  v_meu_valor_periodo_mp numeric;

  v_fat_mp numeric;
  v_ll_mp numeric;

  v_socios_lista jsonb := '[]'::jsonb;
  v_historico jsonb := '[]'::jsonb;
  v_metas jsonb := '[]'::jsonb;
  v_funcionarios_roi jsonb := '[]'::jsonb;
  v_saude jsonb;

  v_resultado jsonb;
BEGIN
  SELECT empresa_id INTO v_empresa_id
    FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Sem empresa');
  END IF;

  SELECT id, percentual_participacao
    INTO v_socio_id, v_meu_percentual
    FROM socios
    WHERE user_id = auth.uid()
      AND empresa_id = v_empresa_id
      AND ativo = true
      AND deleted_at IS NULL
    LIMIT 1;

  v_meu_percentual := COALESCE(v_meu_percentual, 33.33);

  v_dias_no_mes := EXTRACT(DAY FROM v_fim_mes)::int;
  v_dias_passados := LEAST(EXTRACT(DAY FROM current_date)::int, v_dias_no_mes);
  v_fator_projecao := CASE WHEN v_dias_passados > 0
                            THEN v_dias_no_mes::numeric / v_dias_passados::numeric
                            ELSE 1 END;
  v_fim_periodo_mp := LEAST(
    (v_inicio_mes_passado + (v_dias_passados - 1) * interval '1 day')::date,
    v_fim_mes_passado
  );

  -- DRE até hoje (receita, peças, comissões variáveis crescem com OS)
  v_dre_parcial := public.get_dre_periodo(v_inicio_mes, current_date, v_empresa_id);
  -- DRE do mês inteiro (despesas fixas são conhecidas do mês todo)
  v_dre_completo := public.get_dre_periodo(v_inicio_mes, v_fim_mes, v_empresa_id);
  v_dre_mes_passado := public.get_dre_periodo(v_inicio_mes_passado, v_fim_mes_passado, v_empresa_id);
  v_dre_periodo_mp := public.get_dre_periodo(v_inicio_mes_passado, v_fim_periodo_mp, v_empresa_id);

  -- Componentes parcial
  v_receita_parcial := COALESCE((v_dre_parcial->'receitas'->>'bruta')::numeric, 0);
  v_pecas_parcial   := COALESCE((v_dre_parcial->'custos'->>'pecas')::numeric, 0);
  v_com_parcial     := COALESCE((v_dre_parcial->'custos'->>'comissoes')::numeric, 0);
  v_prej_parcial    := COALESCE((v_dre_parcial->'custos'->>'prejuizos')::numeric, 0);

  -- Componentes mês completo
  v_gastos_fixos_compl := COALESCE((v_dre_completo->'despesas'->>'gastos_fixos')::numeric, 0);
  v_outros_compl       := COALESCE((v_dre_completo->'despesas'->>'outros')::numeric, 0);
  v_impostos_compl     := COALESCE((v_dre_completo->'deducoes'->>'impostos')::numeric, 0);

  v_reserva_pct := COALESCE((v_dre_completo->'distribuicao'->>'reserva_pct')::numeric, 0);

  -- Lucro líquido misto: receita parcial - custos parciais - despesas/impostos completos
  v_lucro_liquido_misto := v_receita_parcial
                         - v_pecas_parcial
                         - v_com_parcial
                         - v_prej_parcial
                         - v_gastos_fixos_compl
                         - v_outros_compl
                         - v_impostos_compl;

  v_distribuivel_misto := GREATEST(v_lucro_liquido_misto, 0) * (100 - v_reserva_pct) / 100;
  v_reserva_val_misto  := GREATEST(v_lucro_liquido_misto, 0) * v_reserva_pct / 100;

  v_meu_valor_parcial := v_distribuivel_misto * v_meu_percentual / 100;

  v_despesas_total := v_gastos_fixos_compl + v_outros_compl + v_impostos_compl;

  -- Mês passado (igual antes)
  SELECT (s->>'valor')::numeric INTO v_meu_valor_mp
    FROM jsonb_array_elements(v_dre_mes_passado->'distribuicao'->'socios') s
    WHERE (s->>'id')::uuid = v_socio_id;
  v_meu_valor_mp := COALESCE(v_meu_valor_mp, 0);

  SELECT (s->>'valor')::numeric INTO v_meu_valor_periodo_mp
    FROM jsonb_array_elements(v_dre_periodo_mp->'distribuicao'->'socios') s
    WHERE (s->>'id')::uuid = v_socio_id;
  v_meu_valor_periodo_mp := COALESCE(v_meu_valor_periodo_mp, 0);

  -- Previsão fechamento: projeta variáveis × fator, despesas fixas ficam completas
  v_fat_prev  := v_receita_parcial * v_fator_projecao;
  v_peca_prev := v_pecas_parcial * v_fator_projecao;
  v_com_prev  := v_com_parcial * v_fator_projecao;

  v_ll_prev := v_fat_prev - v_peca_prev - v_com_prev - v_despesas_total;
  v_distrib_prev := CASE WHEN v_ll_prev > 0
                          THEN v_ll_prev * (100 - v_reserva_pct) / 100
                          ELSE 0 END;
  v_meu_valor_prev := v_distrib_prev * v_meu_percentual / 100;

  v_fat_mp := COALESCE((v_dre_mes_passado->'receitas'->>'bruta')::numeric, 0);
  v_ll_mp := COALESCE((v_dre_mes_passado->'resultado'->>'lucro_liquido')::numeric, 0);

  v_socios_lista := COALESCE(v_dre_completo->'distribuicao'->'socios', '[]'::jsonb);

  -- Histórico 6 meses
  WITH meses AS (
    SELECT
      date_trunc('month', current_date - (interval '1 month' * n))::date AS mes_inicio,
      (date_trunc('month', current_date - (interval '1 month' * n)) + interval '1 month' - interval '1 day')::date AS mes_fim
    FROM generate_series(0, 5) n
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'mes', to_char(m.mes_inicio, 'YYYY-MM'),
      'mes_inicio', m.mes_inicio,
      'mes_label', to_char(m.mes_inicio, 'Mon/YY'),
      'faturamento', COALESCE((SELECT SUM(COALESCE(valor_total, valor, 0))
        FROM ordens_de_servico
        WHERE empresa_id = v_empresa_id
          AND deleted_at IS NULL
          AND status IN ('pronto', 'entregue')
          AND data_conclusao >= m.mes_inicio
          AND data_conclusao < (m.mes_fim + interval '1 day')), 0),
      'custo_pecas', 0,
      'despesas', 0,
      'comissoes', 0,
      'lucro_liquido', 0,
      'meu_valor', CASE
        WHEN m.mes_inicio = v_inicio_mes THEN v_meu_valor_parcial
        WHEN m.mes_inicio = v_inicio_mes_passado THEN v_meu_valor_mp
        ELSE round((COALESCE((
          SELECT (v_meu_percentual / 100) * 0.9 * (
            COALESCE(SUM(COALESCE(valor_total, valor, 0)), 0)
            - COALESCE(SUM(COALESCE(custo_pecas, 0)), 0)
          )
          FROM ordens_de_servico
          WHERE empresa_id = v_empresa_id
            AND deleted_at IS NULL
            AND status IN ('pronto', 'entregue')
            AND data_conclusao >= m.mes_inicio
            AND data_conclusao < (m.mes_fim + interval '1 day')
        ), 0))::numeric, 2)
      END
    ) ORDER BY m.mes_inicio
  ), '[]'::jsonb)
  INTO v_historico
  FROM meses m;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'titulo', m.titulo,
    'valor_alvo_centavos', m.valor_alvo_centavos,
    'valor_acumulado_centavos', COALESCE(m.valor_acumulado_centavos, 0),
    'data_alvo', m.data_alvo,
    'icone', COALESCE(m.icone, '🎯'),
    'cor', COALESCE(m.cor, 'green'),
    'progresso_pct', CASE WHEN m.valor_alvo_centavos > 0
      THEN LEAST(100, COALESCE(m.valor_acumulado_centavos, 0)::numeric * 100 / m.valor_alvo_centavos)
      ELSE 0 END
  )), '[]'::jsonb)
  INTO v_metas
  FROM public.socio_metas m
  WHERE m.empresa_id = v_empresa_id
    AND COALESCE(m.ativo, true) = true;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'nome', f.nome,
    'cargo', COALESCE(f.cargo, f.funcao, ''),
    'custo_total_centavos', (COALESCE(f.salario_centavos, 0)
                          + COALESCE(f.vt_centavos, 0)
                          + COALESCE(f.va_centavos, 0))::bigint,
    'receita_centavos', (COALESCE((
      SELECT SUM(COALESCE(o.valor_total, o.valor, 0))
      FROM ordens_de_servico o
      JOIN os_servicos s ON s.ordem_id = o.id
      WHERE s.tecnico_id = f.id
        AND o.empresa_id = v_empresa_id
        AND o.deleted_at IS NULL
        AND o.status IN ('pronto', 'entregue')
        AND o.data_conclusao >= v_inicio_mes
        AND o.data_conclusao < (current_date + interval '1 day')
    ), 0) * 100)::bigint,
    'roi', NULL,
    'status', 'ok'
  )), '[]'::jsonb)
  INTO v_funcionarios_roi
  FROM funcionarios f
  WHERE f.empresa_id = v_empresa_id
    AND f.ativo = true
    AND f.deleted_at IS NULL
    AND f.eh_funcionario_rh = true;

  v_saude := jsonb_build_object(
    'gastos_fixos_mes_centavos', (v_gastos_fixos_compl * 100)::bigint,
    'inadimplencia_centavos', 0,
    'inadimplencia_qtd', 0,
    'inadimplencia_dias_max', 0
  );

  v_resultado := jsonb_build_object(
    'sucesso', true,
    'gerado_em', now(),
    'periodo', jsonb_build_object(
      'hoje', current_date,
      'inicio_mes', v_inicio_mes,
      'fim_mes', v_fim_mes,
      'dias_passados', v_dias_passados,
      'dias_no_mes', v_dias_no_mes,
      'progresso_pct', round((v_dias_passados::numeric / v_dias_no_mes * 100)::numeric)
    ),
    'socio', jsonb_build_object(
      'id', v_socio_id,
      'nome', (SELECT nome FROM socios WHERE id = v_socio_id),
      'percentual', v_meu_percentual
    ),
    'mes_atual', jsonb_build_object(
      'faturamento', v_receita_parcial,
      'receita_servicos', COALESCE((v_dre_parcial->'receitas'->>'servicos_faturados')::numeric, 0),
      'custo_pecas', v_pecas_parcial,
      'custo_terceirizado', 0,
      'comissoes', v_com_parcial,
      'despesas', v_despesas_total,
      'lucro_liquido', v_lucro_liquido_misto,
      'reserva_pct', v_reserva_pct,
      'reserva_val', v_reserva_val_misto,
      'distribuivel', v_distribuivel_misto,
      'meu_valor_parcial', v_meu_valor_parcial,
      'fechamento_previsto', v_meu_valor_prev,
      'faturamento_previsto', v_fat_prev,
      'custo_pecas_previsto', v_peca_prev,
      'custo_terceirizado_previsto', 0,
      'comissoes_previstas', v_com_prev,
      'lucro_liquido_previsto', v_ll_prev,
      'distribuivel_previsto', v_distrib_prev,
      'reserva_prevista', CASE WHEN (100 - v_reserva_pct) > 0
                               THEN v_distrib_prev * v_reserva_pct / (100 - v_reserva_pct)
                               ELSE 0 END,
      'fator_projecao', v_fator_projecao,
      'confiabilidade_projecao', CASE
        WHEN v_dias_passados <= 7 THEN 'baixa'
        WHEN v_dias_passados <= 20 THEN 'média'
        ELSE 'alta'
      END
    ),
    'mes_passado', jsonb_build_object(
      'faturamento', v_fat_mp,
      'custo_pecas', COALESCE((v_dre_mes_passado->'custos'->>'pecas')::numeric, 0),
      'comissoes', COALESCE((v_dre_mes_passado->'custos'->>'comissoes')::numeric, 0),
      'despesas', COALESCE((v_dre_mes_passado->'despesas'->>'gastos_fixos')::numeric, 0)
                + COALESCE((v_dre_mes_passado->'despesas'->>'outros')::numeric, 0),
      'lucro_liquido', v_ll_mp,
      'distribuivel', COALESCE((v_dre_mes_passado->'distribuicao'->>'distribuivel')::numeric, 0),
      'meu_valor', v_meu_valor_mp,
      'periodo_ate_dia', v_fim_periodo_mp,
      'faturamento_periodo', COALESCE((v_dre_periodo_mp->'receitas'->>'bruta')::numeric, 0),
      'lucro_liquido_periodo', COALESCE((v_dre_periodo_mp->'resultado'->>'lucro_liquido')::numeric, 0),
      'distribuivel_periodo', COALESCE((v_dre_periodo_mp->'distribuicao'->>'distribuivel')::numeric, 0),
      'meu_valor_periodo', v_meu_valor_periodo_mp
    ),
    'variacao_mes', jsonb_build_object(
      'meu_valor_pct', CASE
        WHEN v_meu_valor_periodo_mp > 0
          THEN round(((v_meu_valor_parcial - v_meu_valor_periodo_mp) / v_meu_valor_periodo_mp * 100)::numeric, 1)
        WHEN v_meu_valor_parcial > 0 THEN 100
        ELSE 0 END,
      'meu_valor_abs', v_meu_valor_parcial - v_meu_valor_periodo_mp,
      'fechamento_pct', CASE
        WHEN v_meu_valor_mp > 0
          THEN round(((v_meu_valor_prev - v_meu_valor_mp) / v_meu_valor_mp * 100)::numeric, 1)
        WHEN v_meu_valor_prev > 0 THEN 100
        ELSE 0 END,
      'fechamento_abs', v_meu_valor_prev - v_meu_valor_mp,
      'faturamento_pct', CASE
        WHEN v_fat_mp > 0
          THEN round(((v_fat_prev - v_fat_mp) / v_fat_mp * 100)::numeric, 1)
        ELSE 0 END,
      'lucro_liquido_pct', CASE
        WHEN v_ll_mp > 0
          THEN round(((v_ll_prev - v_ll_mp) / v_ll_mp * 100)::numeric, 1)
        ELSE 0 END
    ),
    'socios', v_socios_lista,
    'historico', v_historico,
    'metas', v_metas,
    'funcionarios_roi', v_funcionarios_roi,
    'saude', v_saude
  );

  RETURN v_resultado;
END;
$function$;