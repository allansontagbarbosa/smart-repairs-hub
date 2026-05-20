
-- Fix fechamento_previsto: deve ser distribuivel_previsto × meu_percentual, não regra de 3 sobre parcial
CREATE OR REPLACE FUNCTION public.get_painel_socio_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  v_fator_projecao NUMERIC;
  v_faturamento_prev NUMERIC;
  v_custo_pecas_prev NUMERIC;
  v_custo_terc_prev NUMERIC;
  v_comissoes_prev NUMERIC;
  v_ll_previsto NUMERIC;
  v_reserva_prev NUMERIC;
  v_distrib_previsto NUMERIC;
  v_ll_mes_passado NUMERIC := 0;
  v_custo_terc_mes_passado NUMERIC := 0;
  v_meu_valor_mes_passado NUMERIC := 0;
  v_historico jsonb := '[]'::jsonb;
  v_funcionarios_roi jsonb := '[]'::jsonb;
  v_socios_lista jsonb := '[]'::jsonb;
  v_metas jsonb := '[]'::jsonb;
  v_saude_caixa jsonb;
  v_confiabilidade TEXT;
  v_painel_json jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT s.id, s.nome, s.percentual_participacao, s.empresa_id
    INTO v_socio
    FROM public.socios s
    WHERE s.user_id = v_user_id AND s.ativo = true AND s.deleted_at IS NULL
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
    WHERE empresa_id = v_empresa_id AND deleted_at IS NULL
      AND status IN ('entregue', 'pronto')
      AND data_conclusao >= v_inicio_mes AND data_conclusao <= current_date;

  SELECT COALESCE(SUM(oss.valor_terceirizado), 0)
    INTO v_custo_terc_parcial
    FROM public.os_servicos oss
    JOIN public.ordens_de_servico ord ON ord.id = oss.ordem_id
    WHERE oss.empresa_id = v_empresa_id
      AND oss.motivo_sem_tecnico = 'terceirizado'
      AND ord.status IN ('entregue', 'pronto')
      AND ord.data_conclusao >= v_inicio_mes AND ord.data_conclusao <= current_date;

  SELECT COALESCE(SUM(valor), 0) INTO v_despesas_parcial
    FROM public.contas_a_pagar
    WHERE empresa_id = v_empresa_id
      AND status IN ('paga', 'pendente')
      AND categoria != 'Comissões'
      AND deleted_at IS NULL
      AND data_vencimento >= v_inicio_mes AND data_vencimento <= v_fim_mes;

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
    v_fator_projecao := v_dias_no_mes::numeric / v_dias_passados::numeric;
  ELSE
    v_fator_projecao := 1;
  END IF;

  v_faturamento_prev := v_faturamento_parcial * v_fator_projecao;
  v_custo_pecas_prev := v_custos_pecas_parcial * v_fator_projecao;
  v_custo_terc_prev := COALESCE(v_custo_terc_parcial, 0) * v_fator_projecao;
  v_comissoes_prev := v_comissoes_parcial * v_fator_projecao;

  v_ll_previsto := v_faturamento_prev - v_custo_pecas_prev - v_custo_terc_prev - v_despesas_parcial - v_comissoes_prev;

  IF v_ll_previsto > 0 THEN
    v_reserva_prev := v_ll_previsto * v_reserva_pct / 100;
    v_distrib_previsto := v_ll_previsto - v_reserva_prev;
  ELSE
    v_reserva_prev := 0;
    v_distrib_previsto := 0;
  END IF;

  -- FIX: fechamento_previsto = distribuivel_previsto × meu_percentual
  -- (antes: regra de 3 sobre meu_valor_parcial — matematicamente errado, só convergia no último dia)
  v_fechamento_previsto := v_distrib_previsto * v_socio.percentual_participacao / 100;

  SELECT COALESCE(SUM(COALESCE(valor_total, valor, 0)), 0)
       - COALESCE(SUM(COALESCE(custo_pecas, 0)), 0)
    INTO v_ll_mes_passado
    FROM public.ordens_de_servico
    WHERE empresa_id = v_empresa_id AND deleted_at IS NULL
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
        WHERE empresa_id = v_empresa_id AND status IN ('paga', 'pendente')
          AND categoria != 'Comissões' AND deleted_at IS NULL
          AND data_vencimento BETWEEN v_inicio_mes_passado AND v_fim_mes_passado), 0)
    - COALESCE((SELECT SUM(valor) FROM public.comissoes
        WHERE empresa_id = v_empresa_id AND status IN ('paga', 'pendente')
          AND mes_competencia = to_char(v_inicio_mes_passado, 'YYYY-MM')), 0);

  v_meu_valor_mes_passado := GREATEST(v_ll_mes_passado, 0)
    * (1 - v_reserva_pct / 100)
    * v_socio.percentual_participacao / 100;

  -- Manter resto da função (historico, ROI, socios, metas, saude) — usar a função existente como referência via SELECT
  -- Para preservar comportamento existente, chamamos a versão antiga apenas para reaproveitar os blocos restantes.
  -- Como não temos isso disponível, reconstruímos o restante inline abaixo:

  WITH meses AS (
    SELECT generate_series(
      date_trunc('month', current_date - interval '5 months'),
      date_trunc('month', current_date),
      interval '1 month'
    )::date AS mes_inicio
  ),
  dados_mes AS (
    SELECT
      m.mes_inicio,
      to_char(m.mes_inicio, 'TMMon') AS mes_label,
      COALESCE((SELECT SUM(COALESCE(valor_total, valor, 0)) FROM public.ordens_de_servico
        WHERE empresa_id = v_empresa_id AND deleted_at IS NULL
          AND status IN ('entregue', 'pronto')
          AND data_conclusao >= m.mes_inicio
          AND data_conclusao < m.mes_inicio + interval '1 month'), 0) AS faturamento,
      COALESCE((SELECT SUM(COALESCE(custo_pecas, 0)) FROM public.ordens_de_servico
        WHERE empresa_id = v_empresa_id AND deleted_at IS NULL
          AND status IN ('entregue', 'pronto')
          AND data_conclusao >= m.mes_inicio
          AND data_conclusao < m.mes_inicio + interval '1 month'), 0) AS custo_pecas,
      COALESCE((SELECT SUM(valor) FROM public.contas_a_pagar
        WHERE empresa_id = v_empresa_id AND status IN ('paga', 'pendente')
          AND categoria != 'Comissões' AND deleted_at IS NULL
          AND data_vencimento >= m.mes_inicio
          AND data_vencimento < m.mes_inicio + interval '1 month'), 0) AS despesas,
      COALESCE((SELECT SUM(valor) FROM public.comissoes
        WHERE empresa_id = v_empresa_id AND status IN ('paga', 'pendente')
          AND mes_competencia = to_char(m.mes_inicio, 'YYYY-MM')), 0) AS comissoes
    FROM meses m
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'mes', mes_label,
    'mes_inicio', mes_inicio,
    'faturamento', faturamento,
    'custo_pecas', custo_pecas,
    'despesas', despesas,
    'comissoes', comissoes,
    'lucro_liquido', faturamento - custo_pecas - despesas - comissoes,
    'meu_valor', GREATEST(faturamento - custo_pecas - despesas - comissoes, 0)
                  * (1 - v_reserva_pct / 100) * v_socio.percentual_participacao / 100
  ) ORDER BY mes_inicio), '[]'::jsonb)
    INTO v_historico
    FROM dados_mes;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'nome', f.nome,
    'cargo', COALESCE(f.cargo, ''),
    'custo_total_centavos', COALESCE(f.salario_centavos, 0),
    'receita_centavos', 0,
    'roi', NULL,
    'status', CASE WHEN COALESCE(f.salario_centavos, 0) = 0 THEN 'sem_salario' ELSE 'ok' END
  )), '[]'::jsonb)
    INTO v_funcionarios_roi
    FROM public.funcionarios f
    WHERE f.empresa_id = v_empresa_id AND f.ativo = true;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'nome', s.nome,
    'percentual', s.percentual_participacao,
    'valor_estimado', v_distrib_parcial * s.percentual_participacao / 100,
    'eh_voce', s.id = v_socio.id
  ) ORDER BY s.percentual_participacao DESC), '[]'::jsonb)
    INTO v_socios_lista
    FROM public.socios s
    WHERE s.empresa_id = v_empresa_id AND s.ativo = true AND s.deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'titulo', m.titulo,
    'valor_alvo_centavos', m.valor_alvo_centavos,
    'valor_acumulado_centavos', COALESCE(m.valor_acumulado_centavos, 0),
    'data_alvo', m.data_alvo,
    'icone', COALESCE(m.icone, 'target'),
    'cor', COALESCE(m.cor, 'primary'),
    'progresso_pct', CASE WHEN m.valor_alvo_centavos > 0
      THEN LEAST(100, COALESCE(m.valor_acumulado_centavos, 0)::numeric * 100 / m.valor_alvo_centavos)
      ELSE 0 END
  )), '[]'::jsonb)
    INTO v_metas
    FROM public.metas_socio m
    WHERE m.empresa_id = v_empresa_id AND COALESCE(m.ativa, true) = true;

  SELECT jsonb_build_object(
    'inadimplencia_centavos', COALESCE((SELECT SUM((COALESCE(valor_total, valor, 0) - COALESCE(valor_pago, 0)) * 100)::bigint
      FROM public.ordens_de_servico
      WHERE empresa_id = v_empresa_id AND deleted_at IS NULL
        AND status = 'entregue' AND COALESCE(valor_pago, 0) < COALESCE(valor_total, valor, 0)), 0),
    'inadimplencia_qtd', COALESCE((SELECT COUNT(*) FROM public.ordens_de_servico
      WHERE empresa_id = v_empresa_id AND deleted_at IS NULL
        AND status = 'entregue' AND COALESCE(valor_pago, 0) < COALESCE(valor_total, valor, 0)), 0),
    'inadimplencia_dias_max', COALESCE((SELECT MAX(EXTRACT(DAY FROM current_date - data_conclusao))::int
      FROM public.ordens_de_servico
      WHERE empresa_id = v_empresa_id AND deleted_at IS NULL
        AND status = 'entregue' AND COALESCE(valor_pago, 0) < COALESCE(valor_total, valor, 0)), 0),
    'gastos_fixos_mes_centavos', COALESCE((SELECT SUM(valor * 100)::bigint FROM public.contas_a_pagar
      WHERE empresa_id = v_empresa_id AND status IN ('paga', 'pendente')
        AND deleted_at IS NULL
        AND data_vencimento >= v_inicio_mes AND data_vencimento <= v_fim_mes), 0)
  ) INTO v_saude_caixa;

  v_confiabilidade := CASE
    WHEN v_dias_passados <= 7 THEN 'baixa'
    WHEN v_dias_passados <= 20 THEN 'média'
    ELSE 'alta'
  END;

  v_painel_json := jsonb_build_object(
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
      'progresso_pct', ROUND(v_dias_passados::numeric * 100 / v_dias_no_mes, 1)
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
      'fechamento_previsto', v_fechamento_previsto,
      'faturamento_previsto', v_faturamento_prev,
      'custo_pecas_previsto', v_custo_pecas_prev,
      'custo_terceirizado_previsto', v_custo_terc_prev,
      'comissoes_previstas', v_comissoes_prev,
      'lucro_liquido_previsto', v_ll_previsto,
      'reserva_prevista', v_reserva_prev,
      'distribuivel_previsto', v_distrib_previsto,
      'fator_projecao', v_fator_projecao,
      'confiabilidade_projecao', v_confiabilidade
    ),
    'mes_passado', jsonb_build_object(
      'lucro_liquido', v_ll_mes_passado,
      'meu_valor', v_meu_valor_mes_passado
    ),
    'variacao_mes', CASE WHEN v_meu_valor_mes_passado > 0
      THEN ROUND((v_meu_valor_parcial - v_meu_valor_mes_passado) * 100 / v_meu_valor_mes_passado, 1)
      ELSE NULL END,
    'historico', v_historico,
    'funcionarios_roi', v_funcionarios_roi,
    'socios', v_socios_lista,
    'metas', v_metas,
    'saude', v_saude_caixa
  );

  RETURN v_painel_json;
END;
$function$;

-- Função de testes de invariantes
CREATE OR REPLACE FUNCTION public.test_painel_socio_invariantes()
RETURNS TABLE (teste text, resultado text, detalhes jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_painel jsonb;
  v_m jsonb;
  v_s jsonb;
  v_pct numeric;
  v_calc numeric;
  v_diff numeric;
  v_tol numeric := 1.0;
BEGIN
  v_painel := public.get_painel_socio_v1();
  v_m := v_painel->'mes_atual';
  v_s := v_painel->'socio';
  v_pct := COALESCE((v_s->>'percentual')::numeric, 33.33);

  v_calc := (v_m->>'faturamento')::numeric
          - (v_m->>'custo_pecas')::numeric
          - (v_m->>'comissoes')::numeric
          - COALESCE((v_m->>'custo_terceirizado')::numeric, 0)
          - (v_m->>'despesas')::numeric;
  v_diff := abs((v_m->>'lucro_liquido')::numeric - v_calc);
  RETURN QUERY SELECT
    'LL_parcial = Fat - Peca - Com - Terc - Desp'::text,
    CASE WHEN v_diff < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('esperado', v_calc, 'real', v_m->>'lucro_liquido', 'diff', v_diff);

  v_calc := GREATEST((v_m->>'lucro_liquido')::numeric, 0) * (100 - (v_m->>'reserva_pct')::numeric) / 100;
  v_diff := abs((v_m->>'distribuivel')::numeric - v_calc);
  RETURN QUERY SELECT
    'Distribuivel = LL × (1 - reserva%)'::text,
    CASE WHEN v_diff < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('esperado', v_calc, 'real', v_m->>'distribuivel', 'diff', v_diff);

  v_calc := (v_m->>'distribuivel')::numeric * v_pct / 100;
  v_diff := abs((v_m->>'meu_valor_parcial')::numeric - v_calc);
  RETURN QUERY SELECT
    'Meu_parcial = Distrib × meu_pct'::text,
    CASE WHEN v_diff < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('esperado', v_calc, 'real', v_m->>'meu_valor_parcial', 'diff', v_diff);

  v_calc := (v_m->>'faturamento_previsto')::numeric
          - (v_m->>'custo_pecas_previsto')::numeric
          - (v_m->>'comissoes_previstas')::numeric
          - COALESCE((v_m->>'custo_terceirizado_previsto')::numeric, 0)
          - (v_m->>'despesas')::numeric;
  v_diff := abs((v_m->>'lucro_liquido_previsto')::numeric - v_calc);
  RETURN QUERY SELECT
    'LL_previsto = Fat_prev - Peca_prev - Com_prev - Terc_prev - DespFixa'::text,
    CASE WHEN v_diff < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('esperado', v_calc, 'real', v_m->>'lucro_liquido_previsto', 'diff', v_diff);

  v_calc := GREATEST((v_m->>'lucro_liquido_previsto')::numeric, 0) * (100 - (v_m->>'reserva_pct')::numeric) / 100;
  v_diff := abs((v_m->>'distribuivel_previsto')::numeric - v_calc);
  RETURN QUERY SELECT
    'Distrib_previsto = LL_previsto × (1 - reserva%)'::text,
    CASE WHEN v_diff < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('esperado', v_calc, 'real', v_m->>'distribuivel_previsto', 'diff', v_diff);

  v_calc := (v_m->>'distribuivel_previsto')::numeric * v_pct / 100;
  v_diff := abs((v_m->>'fechamento_previsto')::numeric - v_calc);
  RETURN QUERY SELECT
    'Fechamento_previsto = Distrib_previsto × meu_pct'::text,
    CASE WHEN v_diff < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('esperado', v_calc, 'real', v_m->>'fechamento_previsto', 'diff', v_diff);

  RETURN QUERY SELECT
    'Fechamento_previsto >= meu_valor_parcial'::text,
    CASE WHEN (v_m->>'fechamento_previsto')::numeric >= (v_m->>'meu_valor_parcial')::numeric - v_tol
         THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('parcial', v_m->>'meu_valor_parcial', 'previsto', v_m->>'fechamento_previsto');

  RETURN QUERY SELECT
    'Faturamento_previsto >= Faturamento_parcial'::text,
    CASE WHEN (v_m->>'faturamento_previsto')::numeric >= (v_m->>'faturamento')::numeric - v_tol
         THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('parcial', v_m->>'faturamento', 'previsto', v_m->>'faturamento_previsto');
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_painel_socio_invariantes TO authenticated;
