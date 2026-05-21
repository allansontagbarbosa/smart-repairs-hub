CREATE OR REPLACE FUNCTION public.get_painel_socio_v1(p_meses_historico int DEFAULT 6)
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
  v_inicio_ano date := date_trunc('year', current_date)::date;
  v_fim_periodo_mp date;
  v_dias_passados int;
  v_dias_no_mes int;
  v_fator_projecao numeric;
  v_meses int := GREATEST(1, LEAST(COALESCE(p_meses_historico, 6), 60));
  v_dre_parcial jsonb; v_dre_completo jsonb; v_dre_mes_passado jsonb; v_dre_periodo_mp jsonb; v_dre_ano jsonb;
  v_fat_parcial numeric; v_peca_parcial numeric; v_com_parcial numeric; v_despesas_parcial numeric;
  v_ll_parcial numeric; v_distrib_parcial numeric; v_reserva_pct numeric; v_reserva_val_parcial numeric;
  v_meu_valor_parcial numeric;
  v_fat_prev numeric; v_peca_prev numeric; v_com_prev numeric; v_despesas_completo numeric;
  v_ll_prev numeric; v_distrib_prev numeric; v_meu_valor_prev numeric;
  v_meu_valor_mp numeric; v_meu_valor_periodo_mp numeric; v_fat_mp numeric; v_ll_mp numeric;
  v_gastos_fixos_compl numeric;
  v_socios_lista jsonb := '[]'::jsonb;
  v_historico jsonb := '[]'::jsonb;
  v_metas jsonb := '[]'::jsonb;
  v_funcionarios_roi jsonb := '[]'::jsonb;
  v_saude jsonb;
  v_caixa numeric := 0; v_capital_giro numeric := 0; v_dias_runway int := 0; v_pagar_30d numeric := 0;
  v_resultado jsonb;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_empresa_id IS NULL THEN
    SELECT empresa_id INTO v_empresa_id FROM socios WHERE deleted_at IS NULL AND ativo = true LIMIT 1;
  END IF;
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Sem empresa');
  END IF;

  SELECT id, percentual_participacao INTO v_socio_id, v_meu_percentual
    FROM socios WHERE user_id = auth.uid() AND empresa_id = v_empresa_id AND ativo = true AND deleted_at IS NULL LIMIT 1;
  IF v_socio_id IS NULL THEN
    SELECT id, percentual_participacao INTO v_socio_id, v_meu_percentual
      FROM socios WHERE empresa_id = v_empresa_id AND ativo = true AND deleted_at IS NULL LIMIT 1;
  END IF;
  v_meu_percentual := COALESCE(v_meu_percentual, 33.33);

  v_dias_no_mes := EXTRACT(DAY FROM v_fim_mes)::int;
  v_dias_passados := LEAST(EXTRACT(DAY FROM current_date)::int, v_dias_no_mes);
  v_fator_projecao := CASE WHEN v_dias_passados > 0 THEN v_dias_no_mes::numeric / v_dias_passados::numeric ELSE 1 END;
  v_fim_periodo_mp := LEAST((v_inicio_mes_passado + (v_dias_passados - 1) * interval '1 day')::date, v_fim_mes_passado);

  v_dre_parcial     := public.get_dre_periodo(v_inicio_mes, current_date, v_empresa_id);
  v_dre_completo    := public.get_dre_periodo(v_inicio_mes, v_fim_mes, v_empresa_id);
  v_dre_mes_passado := public.get_dre_periodo(v_inicio_mes_passado, v_fim_mes_passado, v_empresa_id);
  v_dre_periodo_mp  := public.get_dre_periodo(v_inicio_mes_passado, v_fim_periodo_mp, v_empresa_id);
  v_dre_ano         := public.get_dre_periodo(v_inicio_ano, current_date, v_empresa_id);

  v_fat_parcial := COALESCE((v_dre_parcial->'receitas'->>'bruta')::numeric, 0);
  v_peca_parcial := COALESCE((v_dre_parcial->'custos'->>'pecas')::numeric, 0);
  v_com_parcial := COALESCE((v_dre_parcial->'custos'->>'comissoes')::numeric, 0);
  v_despesas_parcial := COALESCE((v_dre_parcial->'despesas'->>'gastos_fixos')::numeric, 0)
                      + COALESCE((v_dre_parcial->'despesas'->>'outros')::numeric, 0)
                      + COALESCE((v_dre_parcial->'deducoes'->>'impostos')::numeric, 0);
  v_ll_parcial := COALESCE((v_dre_parcial->'resultado'->>'lucro_liquido')::numeric, 0);
  v_distrib_parcial := COALESCE((v_dre_parcial->'distribuicao'->>'distribuivel')::numeric, 0);
  v_reserva_pct := COALESCE((v_dre_parcial->'distribuicao'->>'reserva_pct')::numeric, 0);
  v_reserva_val_parcial := COALESCE((v_dre_parcial->'distribuicao'->>'reserva_valor')::numeric, 0);

  SELECT (s->>'valor')::numeric INTO v_meu_valor_parcial
    FROM jsonb_array_elements(v_dre_parcial->'distribuicao'->'socios') s
    WHERE (s->>'id')::uuid = v_socio_id;
  v_meu_valor_parcial := COALESCE(v_meu_valor_parcial, v_distrib_parcial * v_meu_percentual / 100);

  SELECT (s->>'valor')::numeric INTO v_meu_valor_mp
    FROM jsonb_array_elements(v_dre_mes_passado->'distribuicao'->'socios') s
    WHERE (s->>'id')::uuid = v_socio_id;
  v_meu_valor_mp := COALESCE(v_meu_valor_mp, 0);

  SELECT (s->>'valor')::numeric INTO v_meu_valor_periodo_mp
    FROM jsonb_array_elements(v_dre_periodo_mp->'distribuicao'->'socios') s
    WHERE (s->>'id')::uuid = v_socio_id;
  v_meu_valor_periodo_mp := COALESCE(v_meu_valor_periodo_mp, 0);

  v_gastos_fixos_compl := COALESCE((v_dre_completo->'despesas'->>'gastos_fixos')::numeric, 0);
  v_despesas_completo := v_gastos_fixos_compl
                       + COALESCE((v_dre_completo->'despesas'->>'outros')::numeric, 0)
                       + COALESCE((v_dre_completo->'deducoes'->>'impostos')::numeric, 0);

  v_fat_prev  := v_fat_parcial * v_fator_projecao;
  v_peca_prev := v_peca_parcial * v_fator_projecao;
  v_com_prev  := v_com_parcial * v_fator_projecao;
  v_ll_prev   := v_fat_prev - v_peca_prev - v_com_prev - v_despesas_completo;
  v_distrib_prev := CASE WHEN v_ll_prev > 0 THEN v_ll_prev * (100 - v_reserva_pct) / 100 ELSE 0 END;
  v_meu_valor_prev := v_distrib_prev * v_meu_percentual / 100;

  v_fat_mp := COALESCE((v_dre_mes_passado->'receitas'->>'bruta')::numeric, 0);
  v_ll_mp  := COALESCE((v_dre_mes_passado->'resultado'->>'lucro_liquido')::numeric, 0);

  WITH base AS (
    SELECT (s->>'id')::uuid AS id, s->>'nome' AS nome,
           (s->>'percentual')::numeric AS percentual, (s->>'valor')::numeric AS valor
    FROM jsonb_array_elements(COALESCE(v_dre_parcial->'distribuicao'->'socios','[]'::jsonb)) s
  ),
  mp AS (
    SELECT (s->>'id')::uuid AS id, (s->>'valor')::numeric AS valor_mp
    FROM jsonb_array_elements(COALESCE(v_dre_mes_passado->'distribuicao'->'socios','[]'::jsonb)) s
  ),
  ytd AS (
    SELECT (s->>'id')::uuid AS id, (s->>'valor')::numeric AS valor_ytd
    FROM jsonb_array_elements(COALESCE(v_dre_ano->'distribuicao'->'socios','[]'::jsonb)) s
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id, 'nome', b.nome, 'percentual', b.percentual,
    'valor', b.valor, 'valor_estimado', b.valor,
    'valor_mes_passado', COALESCE(mp.valor_mp, 0),
    'valor_ano_acumulado', COALESCE(ytd.valor_ytd, 0),
    'variacao_pct', CASE
      WHEN COALESCE(mp.valor_mp, 0) > 0 THEN round(((b.valor - mp.valor_mp) / mp.valor_mp * 100)::numeric, 1)
      WHEN b.valor > 0 THEN 100 ELSE 0 END,
    'eh_voce', b.id = v_socio_id
  )), '[]'::jsonb)
  INTO v_socios_lista
  FROM base b LEFT JOIN mp ON mp.id = b.id LEFT JOIN ytd ON ytd.id = b.id;

  WITH meses AS (
    SELECT date_trunc('month', current_date - (interval '1 month' * n))::date AS mes_inicio,
           (date_trunc('month', current_date - (interval '1 month' * n)) + interval '1 month' - interval '1 day')::date AS mes_fim
    FROM generate_series(0, v_meses - 1) n
  ),
  dre_mes AS (
    SELECT m.mes_inicio, m.mes_fim,
      CASE WHEN m.mes_inicio = v_inicio_mes THEN public.get_dre_periodo(m.mes_inicio, current_date, v_empresa_id)
           ELSE public.get_dre_periodo(m.mes_inicio, m.mes_fim, v_empresa_id) END AS dre
    FROM meses m
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'mes', to_char(d.mes_inicio, 'YYYY-MM'),
    'mes_inicio', d.mes_inicio,
    'mes_label', to_char(d.mes_inicio, 'Mon/YY'),
    'faturamento', COALESCE((d.dre->'receitas'->>'bruta')::numeric, 0),
    'custo_pecas', COALESCE((d.dre->'custos'->>'pecas')::numeric, 0),
    'comissoes',   COALESCE((d.dre->'custos'->>'comissoes')::numeric, 0),
    'despesas',    COALESCE((d.dre->'despesas'->>'gastos_fixos')::numeric, 0)
                 + COALESCE((d.dre->'despesas'->>'outros')::numeric, 0)
                 + COALESCE((d.dre->'deducoes'->>'impostos')::numeric, 0),
    'lucro_liquido', COALESCE((d.dre->'resultado'->>'lucro_liquido')::numeric, 0),
    'meu_valor', COALESCE((
      SELECT (s->>'valor')::numeric FROM jsonb_array_elements(d.dre->'distribuicao'->'socios') s
      WHERE (s->>'id')::uuid = v_socio_id), 0)
  ) ORDER BY d.mes_inicio), '[]'::jsonb)
  INTO v_historico FROM dre_mes d;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'titulo', m.titulo,
    'valor_alvo_centavos', m.valor_alvo_centavos,
    'valor_acumulado_centavos', COALESCE(m.valor_acumulado_centavos, 0),
    'data_alvo', m.data_alvo,
    'icone', COALESCE(m.icone, '🎯'),
    'cor', COALESCE(m.cor, 'green'),
    'progresso_pct', CASE WHEN m.valor_alvo_centavos > 0
      THEN LEAST(100, COALESCE(m.valor_acumulado_centavos, 0)::numeric * 100 / m.valor_alvo_centavos)
      ELSE 0 END
  )), '[]'::jsonb) INTO v_metas
  FROM public.socio_metas m
  WHERE m.empresa_id = v_empresa_id AND COALESCE(m.ativo, true) = true;

  WITH funcs AS (
    SELECT f.id, f.nome, COALESCE(f.cargo, f.funcao, '') AS cargo,
      (COALESCE(f.salario_centavos,0)+COALESCE(f.vt_centavos,0)+COALESCE(f.va_centavos,0))::bigint AS custo_centavos,
      (COALESCE((
        SELECT SUM(COALESCE(o.valor_total, o.valor, 0))
        FROM ordens_de_servico o JOIN os_servicos s ON s.ordem_id = o.id
        WHERE s.tecnico_id = f.id AND o.empresa_id = v_empresa_id AND o.deleted_at IS NULL
          AND o.status IN ('pronto','entregue')
          AND o.data_conclusao >= (current_date - interval '60 days')
          AND o.data_conclusao < (current_date + interval '1 day')
      ), 0) * 100)::bigint AS receita_centavos
    FROM funcionarios f
    WHERE f.empresa_id = v_empresa_id AND f.ativo = true AND f.deleted_at IS NULL
      AND f.eh_funcionario_rh = true
      AND COALESCE(f.nome, '') NOT ILIKE '%teste%'
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'nome', nome, 'cargo', cargo,
    'custo_total_centavos', custo_centavos, 'receita_centavos', receita_centavos,
    'roi', CASE WHEN custo_centavos > 0 THEN round((receita_centavos::numeric / custo_centavos)::numeric, 2) ELSE NULL END,
    'status', CASE
      WHEN custo_centavos = 0 THEN 'sem_salario'
      WHEN receita_centavos = 0 THEN 'prejuizo'
      WHEN receita_centavos::numeric / custo_centavos >= 5 THEN 'estrela'
      WHEN receita_centavos::numeric / custo_centavos >= 2 THEN 'ok'
      WHEN receita_centavos::numeric / custo_centavos >= 1 THEN 'atencao'
      ELSE 'prejuizo' END
  ) ORDER BY (CASE WHEN custo_centavos > 0 THEN receita_centavos::numeric / custo_centavos ELSE -1 END) DESC), '[]'::jsonb)
  INTO v_funcionarios_roi FROM funcs;

  SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END),0)
       - COALESCE(SUM(CASE WHEN tipo IN ('saida','prejuizo') THEN valor ELSE 0 END),0)
  INTO v_caixa FROM movimentacoes_financeiras
  WHERE empresa_id = v_empresa_id AND data >= v_inicio_ano AND estornada_em IS NULL;

  SELECT COALESCE(SUM(valor), 0) INTO v_pagar_30d
  FROM contas_a_pagar
  WHERE empresa_id = v_empresa_id AND deleted_at IS NULL
    AND status IN ('pendente','parcial')
    AND data_vencimento BETWEEN current_date AND current_date + interval '30 days';

  v_capital_giro := v_caixa - v_pagar_30d;
  v_dias_runway := CASE WHEN v_gastos_fixos_compl > 0
    THEN GREATEST(0, FLOOR(v_caixa / (v_gastos_fixos_compl / 30.0))::int) ELSE 0 END;

  v_saude := jsonb_build_object(
    'gastos_fixos_mes_centavos', (v_gastos_fixos_compl * 100)::bigint,
    'inadimplencia_centavos', 0, 'inadimplencia_qtd', 0, 'inadimplencia_dias_max', 0,
    'saldo_caixa_centavos', (v_caixa * 100)::bigint,
    'dias_runway', v_dias_runway,
    'capital_giro_centavos', (v_capital_giro * 100)::bigint
  );

  v_resultado := jsonb_build_object(
    'sucesso', true, 'gerado_em', now(),
    'periodo', jsonb_build_object(
      'hoje', current_date, 'inicio_mes', v_inicio_mes, 'fim_mes', v_fim_mes,
      'dias_passados', v_dias_passados, 'dias_no_mes', v_dias_no_mes,
      'progresso_pct', round((v_dias_passados::numeric / v_dias_no_mes * 100)::numeric),
      'meses_historico', v_meses
    ),
    'socio', jsonb_build_object('id', v_socio_id, 'nome', (SELECT nome FROM socios WHERE id = v_socio_id), 'percentual', v_meu_percentual),
    'mes_atual', jsonb_build_object(
      'faturamento', v_fat_parcial,
      'receita_servicos', COALESCE((v_dre_parcial->'receitas'->>'servicos_faturados')::numeric, 0),
      'custo_pecas', v_peca_parcial, 'custo_terceirizado', 0,
      'comissoes', v_com_parcial, 'despesas', v_despesas_parcial,
      'lucro_liquido', v_ll_parcial, 'reserva_pct', v_reserva_pct,
      'reserva_val', v_reserva_val_parcial, 'distribuivel', v_distrib_parcial,
      'meu_valor_parcial', v_meu_valor_parcial, 'fechamento_previsto', v_meu_valor_prev,
      'faturamento_previsto', v_fat_prev, 'custo_pecas_previsto', v_peca_prev,
      'custo_terceirizado_previsto', 0, 'comissoes_previstas', v_com_prev,
      'lucro_liquido_previsto', v_ll_prev, 'distribuivel_previsto', v_distrib_prev,
      'reserva_prevista', CASE WHEN (100 - v_reserva_pct) > 0 THEN v_distrib_prev * v_reserva_pct / (100 - v_reserva_pct) ELSE 0 END,
      'fator_projecao', v_fator_projecao,
      'confiabilidade_projecao', CASE WHEN v_dias_passados <= 7 THEN 'baixa' WHEN v_dias_passados <= 20 THEN 'média' ELSE 'alta' END
    ),
    'mes_passado', jsonb_build_object(
      'faturamento', v_fat_mp,
      'custo_pecas', COALESCE((v_dre_mes_passado->'custos'->>'pecas')::numeric, 0),
      'comissoes', COALESCE((v_dre_mes_passado->'custos'->>'comissoes')::numeric, 0),
      'despesas', COALESCE((v_dre_mes_passado->'despesas'->>'gastos_fixos')::numeric, 0)
                + COALESCE((v_dre_mes_passado->'despesas'->>'outros')::numeric, 0),
      'lucro_liquido', v_ll_mp,
      'distribuivel', COALESCE((v_dre_mes_passado->'distribuicao'->>'distribuivel')::numeric, 0),
      'meu_valor', v_meu_valor_mp, 'periodo_ate_dia', v_fim_periodo_mp,
      'faturamento_periodo', COALESCE((v_dre_periodo_mp->'receitas'->>'bruta')::numeric, 0),
      'lucro_liquido_periodo', COALESCE((v_dre_periodo_mp->'resultado'->>'lucro_liquido')::numeric, 0),
      'distribuivel_periodo', COALESCE((v_dre_periodo_mp->'distribuicao'->>'distribuivel')::numeric, 0),
      'meu_valor_periodo', v_meu_valor_periodo_mp
    ),
    'variacao_mes', jsonb_build_object(
      'meu_valor_pct', CASE WHEN v_meu_valor_periodo_mp > 0 THEN round(((v_meu_valor_parcial - v_meu_valor_periodo_mp) / v_meu_valor_periodo_mp * 100)::numeric, 1) WHEN v_meu_valor_parcial > 0 THEN 100 ELSE 0 END,
      'meu_valor_abs', v_meu_valor_parcial - v_meu_valor_periodo_mp,
      'fechamento_pct', CASE WHEN v_meu_valor_mp > 0 THEN round(((v_meu_valor_prev - v_meu_valor_mp) / v_meu_valor_mp * 100)::numeric, 1) WHEN v_meu_valor_prev > 0 THEN 100 ELSE 0 END,
      'fechamento_abs', v_meu_valor_prev - v_meu_valor_mp,
      'faturamento_pct', CASE WHEN v_fat_mp > 0 THEN round(((v_fat_prev - v_fat_mp) / v_fat_mp * 100)::numeric, 1) ELSE 0 END,
      'lucro_liquido_pct', CASE WHEN v_ll_mp > 0 THEN round(((v_ll_prev - v_ll_mp) / v_ll_mp * 100)::numeric, 1) ELSE 0 END
    ),
    'socios', v_socios_lista, 'historico', v_historico, 'metas', v_metas,
    'funcionarios_roi', v_funcionarios_roi, 'saude', v_saude
  );

  RETURN v_resultado;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_alertas_socio()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_alertas jsonb := '[]'::jsonb;
  v_qtd int; v_total numeric;
  v_inicio_mes date := date_trunc('month', current_date)::date;
  v_inicio_mes_passado date := date_trunc('month', current_date - interval '1 month')::date;
  v_fim_mes_passado date := (date_trunc('month', current_date) - interval '1 day')::date;
  v_ll_atual numeric; v_ll_passado numeric; v_var_margem numeric;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_empresa_id IS NULL THEN
    SELECT empresa_id INTO v_empresa_id FROM socios WHERE deleted_at IS NULL AND ativo LIMIT 1;
  END IF;
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'alertas', '[]'::jsonb);
  END IF;

  SELECT COUNT(*), COALESCE(SUM(valor), 0) INTO v_qtd, v_total
  FROM contas_a_pagar
  WHERE empresa_id = v_empresa_id AND deleted_at IS NULL
    AND status IN ('pendente','parcial')
    AND data_vencimento BETWEEN current_date AND current_date + interval '7 days';
  IF v_qtd > 0 THEN
    v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
      'tipo', 'contas_vencendo', 'severidade', 'aviso', 'icone', '⚠️',
      'titulo', format('%s contas vencendo em 7 dias', v_qtd),
      'mensagem', format('Total a pagar: R$ %s', to_char(v_total, 'FM999G999G990D00')),
      'valor', v_total
    ));
  END IF;

  SELECT COUNT(*), COALESCE(SUM(valor), 0) INTO v_qtd, v_total
  FROM contas_a_pagar
  WHERE empresa_id = v_empresa_id AND deleted_at IS NULL
    AND status IN ('pendente','parcial','vencida')
    AND data_vencimento < current_date;
  IF v_qtd > 0 THEN
    v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
      'tipo', 'contas_vencidas', 'severidade', 'critico', 'icone', '🚨',
      'titulo', format('%s contas em atraso', v_qtd),
      'mensagem', format('Total vencido: R$ %s', to_char(v_total, 'FM999G999G990D00')),
      'valor', v_total
    ));
  END IF;

  v_ll_atual := COALESCE((public.get_dre_periodo(v_inicio_mes, current_date, v_empresa_id)->'resultado'->>'lucro_liquido')::numeric, 0);
  v_ll_passado := COALESCE((public.get_dre_periodo(v_inicio_mes_passado, v_fim_mes_passado, v_empresa_id)->'resultado'->>'lucro_liquido')::numeric, 0);
  IF v_ll_passado > 0 AND v_ll_atual < v_ll_passado * 0.9 THEN
    v_var_margem := round(((v_ll_atual - v_ll_passado) / v_ll_passado * 100)::numeric, 1);
    v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
      'tipo', 'margem_caindo', 'severidade', 'aviso', 'icone', '📉',
      'titulo', format('Lucro %s%% vs mês passado', v_var_margem),
      'mensagem', 'Margem caindo, reveja despesas e captação',
      'valor', v_ll_atual - v_ll_passado
    ));
  END IF;

  RETURN jsonb_build_object('sucesso', true, 'alertas', v_alertas);
END;
$function$;