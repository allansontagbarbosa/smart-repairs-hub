
-- ============================================================
-- PARTE 1: Função canônica get_dre_periodo
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_dre_periodo(
  p_inicio date,
  p_fim date,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_ano_mes text;
  v_e_mes_completo boolean;

  v_servicos_faturados numeric := 0;
  v_outros_recebimentos numeric := 0;
  v_receita_bruta numeric;
  v_impostos numeric := 0;
  v_receita_liquida numeric;
  v_pecas numeric := 0;
  v_comissoes numeric := 0;
  v_prejuizos numeric := 0;
  v_lucro_bruto numeric;
  v_gastos_fixos numeric := 0;
  v_outros_gastos numeric := 0;
  v_ebitda numeric;
  v_depreciacao numeric := 0;
  v_lucro_liquido numeric;
  v_margem_pct numeric;
  v_reserva_pct numeric;
  v_reserva_valor numeric;
  v_distribuivel numeric;
  v_socios jsonb := '[]'::jsonb;

  v_categorias_fixas text[] := ARRAY['Salários', 'Aluguel', 'Vale Transporte',
                                      'Vale Alimentação', 'Energia', 'Internet'];
BEGIN
  v_empresa_id := COALESCE(
    p_empresa_id,
    (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
  );

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Sem empresa');
  END IF;

  v_e_mes_completo := (
    p_inicio = date_trunc('month', p_inicio)::date
    AND p_fim = (date_trunc('month', p_inicio) + interval '1 month' - interval '1 day')::date
  );
  v_ano_mes := to_char(p_inicio, 'YYYY-MM');

  -- RECEITAS
  SELECT COALESCE(SUM(COALESCE(valor_total, valor, 0)), 0)
    INTO v_servicos_faturados
    FROM ordens_de_servico
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND status IN ('pronto', 'entregue')
      AND data_conclusao >= p_inicio
      AND data_conclusao < (p_fim + interval '1 day');

  SELECT COALESCE(SUM(valor), 0)
    INTO v_outros_recebimentos
    FROM movimentacoes_financeiras
    WHERE empresa_id = v_empresa_id
      AND tipo = 'entrada'
      AND estornada_em IS NULL
      AND ordem_id IS NULL
      AND data >= p_inicio
      AND data < (p_fim + interval '1 day');

  v_receita_bruta := v_servicos_faturados + v_outros_recebimentos;

  -- DEDUÇÕES (Impostos)
  SELECT COALESCE(SUM(valor), 0)
    INTO v_impostos
    FROM contas_a_pagar
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND status IN ('paga', 'pendente')
      AND categoria = 'Impostos'
      AND data_vencimento >= p_inicio
      AND data_vencimento <= p_fim;

  IF v_e_mes_completo THEN
    SELECT v_impostos + COALESCE(SUM(valor), 0)
      INTO v_impostos
      FROM ajustes_mensais
      WHERE empresa_id = v_empresa_id
        AND ano_mes = v_ano_mes
        AND tipo = 'impostos';
  END IF;

  v_receita_liquida := v_receita_bruta - v_impostos;

  -- CUSTOS
  SELECT COALESCE(SUM(COALESCE(custo_pecas, 0)), 0)
    INTO v_pecas
    FROM ordens_de_servico
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND status IN ('pronto', 'entregue')
      AND data_conclusao >= p_inicio
      AND data_conclusao < (p_fim + interval '1 day');

  IF v_e_mes_completo THEN
    SELECT COALESCE(SUM(valor), 0)
      INTO v_comissoes
      FROM comissoes
      WHERE empresa_id = v_empresa_id
        AND mes_competencia = v_ano_mes
        AND status != 'estornada';
  ELSE
    SELECT COALESCE(SUM(c.valor), 0)
      INTO v_comissoes
      FROM comissoes c
      JOIN ordens_de_servico o ON o.id = c.ordem_id
      WHERE c.empresa_id = v_empresa_id
        AND c.status != 'estornada'
        AND o.deleted_at IS NULL
        AND o.data_conclusao >= p_inicio
        AND o.data_conclusao < (p_fim + interval '1 day');
  END IF;

  SELECT COALESCE(SUM(valor_centavos)::numeric / 100, 0)
    INTO v_prejuizos
    FROM prejuizos
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND data_evento >= p_inicio
      AND data_evento <= p_fim;

  v_lucro_bruto := v_receita_liquida - v_pecas - v_comissoes - v_prejuizos;

  -- DESPESAS OPERACIONAIS
  SELECT COALESCE(SUM(valor), 0)
    INTO v_gastos_fixos
    FROM contas_a_pagar
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND status IN ('paga', 'pendente')
      AND categoria = ANY(v_categorias_fixas)
      AND data_vencimento >= p_inicio
      AND data_vencimento <= p_fim;

  IF v_e_mes_completo THEN
    SELECT v_gastos_fixos + COALESCE(SUM(valor), 0)
      INTO v_gastos_fixos
      FROM ajustes_mensais
      WHERE empresa_id = v_empresa_id
        AND ano_mes = v_ano_mes
        AND tipo = 'gastos_fixos';
  END IF;

  SELECT COALESCE(SUM(valor), 0)
    INTO v_outros_gastos
    FROM contas_a_pagar
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND status IN ('paga', 'pendente')
      AND NOT (categoria = ANY(v_categorias_fixas))
      AND categoria NOT IN ('Comissões', 'Prejuízos', 'Impostos')
      AND data_vencimento >= p_inicio
      AND data_vencimento <= p_fim;

  SELECT v_outros_gastos + COALESCE(SUM(valor), 0)
    INTO v_outros_gastos
    FROM movimentacoes_financeiras
    WHERE empresa_id = v_empresa_id
      AND tipo = 'saida'
      AND estornada_em IS NULL
      AND ordem_id IS NULL
      AND data >= p_inicio
      AND data < (p_fim + interval '1 day');

  v_ebitda := v_lucro_bruto - v_gastos_fixos - v_outros_gastos;

  -- RESULTADO
  IF v_e_mes_completo THEN
    SELECT COALESCE(SUM(valor), 0)
      INTO v_depreciacao
      FROM ajustes_mensais
      WHERE empresa_id = v_empresa_id
        AND ano_mes = v_ano_mes
        AND tipo = 'depreciacao';
  END IF;

  v_lucro_liquido := v_ebitda - v_depreciacao;
  v_margem_pct := CASE WHEN v_receita_bruta > 0
                       THEN v_lucro_liquido / v_receita_bruta * 100
                       ELSE 0 END;

  -- DISTRIBUIÇÃO
  SELECT COALESCE(percentual_reserva_empresa, 10)
    INTO v_reserva_pct
    FROM empresa_config
    WHERE empresa_id = v_empresa_id
    LIMIT 1;

  v_reserva_pct := COALESCE(v_reserva_pct, 10);

  IF v_lucro_liquido > 0 THEN
    v_reserva_valor := v_lucro_liquido * v_reserva_pct / 100;
    v_distribuivel := v_lucro_liquido - v_reserva_valor;
  ELSE
    v_reserva_valor := 0;
    v_distribuivel := 0;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'nome', nome,
    'percentual', percentual_participacao,
    'valor', round((v_distribuivel * percentual_participacao / 100)::numeric, 2)
  ) ORDER BY ordem), '[]'::jsonb)
    INTO v_socios
    FROM socios
    WHERE empresa_id = v_empresa_id
      AND ativo = true
      AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'sucesso', true,
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'e_mes_completo', v_e_mes_completo),
    'receitas', jsonb_build_object(
      'servicos_faturados', v_servicos_faturados,
      'outros_recebimentos', v_outros_recebimentos,
      'bruta', v_receita_bruta
    ),
    'deducoes', jsonb_build_object(
      'impostos', v_impostos,
      'liquida', v_receita_liquida
    ),
    'custos', jsonb_build_object(
      'pecas', v_pecas,
      'comissoes', v_comissoes,
      'prejuizos', v_prejuizos,
      'lucro_bruto', v_lucro_bruto
    ),
    'despesas', jsonb_build_object(
      'gastos_fixos', v_gastos_fixos,
      'outros', v_outros_gastos,
      'ebitda', v_ebitda
    ),
    'resultado', jsonb_build_object(
      'depreciacao', v_depreciacao,
      'lucro_liquido', v_lucro_liquido,
      'margem_pct', v_margem_pct
    ),
    'distribuicao', jsonb_build_object(
      'reserva_pct', v_reserva_pct,
      'reserva_valor', v_reserva_valor,
      'distribuivel', v_distribuivel,
      'socios', v_socios
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_periodo(date, date, uuid) TO authenticated;

-- ============================================================
-- PARTE 3: Refatorar get_painel_socio_v1 para usar get_dre_periodo
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_painel_socio_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  v_meu_valor_parcial numeric;
  v_meu_valor_mp numeric;
  v_meu_valor_periodo_mp numeric;

  v_fat_mp numeric;
  v_ll_mp numeric;

  v_resultado jsonb;
BEGIN
  SELECT empresa_id INTO v_empresa_id
    FROM user_profiles
    WHERE user_id = auth.uid()
    LIMIT 1;

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

  -- CHAMAR FUNÇÃO CANÔNICA
  v_dre_parcial := public.get_dre_periodo(v_inicio_mes, current_date, v_empresa_id);
  v_dre_mes_passado := public.get_dre_periodo(v_inicio_mes_passado, v_fim_mes_passado, v_empresa_id);
  v_dre_periodo_mp := public.get_dre_periodo(v_inicio_mes_passado, v_fim_periodo_mp, v_empresa_id);

  SELECT (s->>'valor')::numeric INTO v_meu_valor_parcial
    FROM jsonb_array_elements(v_dre_parcial->'distribuicao'->'socios') s
    WHERE (s->>'id')::uuid = v_socio_id;
  v_meu_valor_parcial := COALESCE(v_meu_valor_parcial, 0);

  SELECT (s->>'valor')::numeric INTO v_meu_valor_mp
    FROM jsonb_array_elements(v_dre_mes_passado->'distribuicao'->'socios') s
    WHERE (s->>'id')::uuid = v_socio_id;
  v_meu_valor_mp := COALESCE(v_meu_valor_mp, 0);

  SELECT (s->>'valor')::numeric INTO v_meu_valor_periodo_mp
    FROM jsonb_array_elements(v_dre_periodo_mp->'distribuicao'->'socios') s
    WHERE (s->>'id')::uuid = v_socio_id;
  v_meu_valor_periodo_mp := COALESCE(v_meu_valor_periodo_mp, 0);

  v_reserva_pct := (v_dre_parcial->'distribuicao'->>'reserva_pct')::numeric;
  v_fat_prev := (v_dre_parcial->'receitas'->>'bruta')::numeric * v_fator_projecao;
  v_peca_prev := (v_dre_parcial->'custos'->>'pecas')::numeric * v_fator_projecao;
  v_com_prev := (v_dre_parcial->'custos'->>'comissoes')::numeric * v_fator_projecao;
  v_despesas_total := (v_dre_parcial->'despesas'->>'gastos_fixos')::numeric
                    + (v_dre_parcial->'despesas'->>'outros')::numeric;

  v_ll_prev := v_fat_prev - v_peca_prev - v_com_prev - v_despesas_total;
  v_distrib_prev := CASE WHEN v_ll_prev > 0
                          THEN v_ll_prev * (100 - v_reserva_pct) / 100
                          ELSE 0 END;
  v_meu_valor_prev := v_distrib_prev * v_meu_percentual / 100;

  v_fat_mp := (v_dre_mes_passado->'receitas'->>'bruta')::numeric;
  v_ll_mp := (v_dre_mes_passado->'resultado'->>'lucro_liquido')::numeric;

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
      'faturamento', (v_dre_parcial->'receitas'->>'bruta')::numeric,
      'receita_servicos', (v_dre_parcial->'receitas'->>'servicos_faturados')::numeric,
      'custo_pecas', (v_dre_parcial->'custos'->>'pecas')::numeric,
      'custo_terceirizado', 0,
      'comissoes', (v_dre_parcial->'custos'->>'comissoes')::numeric,
      'despesas', v_despesas_total,
      'lucro_liquido', (v_dre_parcial->'resultado'->>'lucro_liquido')::numeric,
      'reserva_pct', v_reserva_pct,
      'reserva_val', (v_dre_parcial->'distribuicao'->>'reserva_valor')::numeric,
      'distribuivel', (v_dre_parcial->'distribuicao'->>'distribuivel')::numeric,
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
      'custo_pecas', (v_dre_mes_passado->'custos'->>'pecas')::numeric,
      'comissoes', (v_dre_mes_passado->'custos'->>'comissoes')::numeric,
      'despesas', (v_dre_mes_passado->'despesas'->>'gastos_fixos')::numeric
                + (v_dre_mes_passado->'despesas'->>'outros')::numeric,
      'lucro_liquido', v_ll_mp,
      'distribuivel', (v_dre_mes_passado->'distribuicao'->>'distribuivel')::numeric,
      'meu_valor', v_meu_valor_mp,
      'periodo_ate_dia', v_fim_periodo_mp,
      'faturamento_periodo', (v_dre_periodo_mp->'receitas'->>'bruta')::numeric,
      'lucro_liquido_periodo', (v_dre_periodo_mp->'resultado'->>'lucro_liquido')::numeric,
      'distribuivel_periodo', (v_dre_periodo_mp->'distribuicao'->>'distribuivel')::numeric,
      'meu_valor_periodo', v_meu_valor_periodo_mp
    ),
    'variacao_mes', jsonb_build_object(
      'meu_valor_pct', CASE
        WHEN v_meu_valor_periodo_mp > 0
          THEN round(((v_meu_valor_parcial - v_meu_valor_periodo_mp) / v_meu_valor_periodo_mp * 100)::numeric, 1)
        WHEN v_meu_valor_parcial > 0 THEN 100
        ELSE 0 END,
      'fechamento_pct', CASE
        WHEN v_meu_valor_mp > 0
          THEN round(((v_meu_valor_prev - v_meu_valor_mp) / v_meu_valor_mp * 100)::numeric, 1)
        WHEN v_meu_valor_prev > 0 THEN 100
        ELSE 0 END,
      'faturamento_pct', CASE
        WHEN v_fat_mp > 0
          THEN round(((v_fat_prev - v_fat_mp) / v_fat_mp * 100)::numeric, 1)
        ELSE 0 END,
      'lucro_liquido_pct', CASE
        WHEN v_ll_mp > 0
          THEN round(((v_ll_prev - v_ll_mp) / v_ll_mp * 100)::numeric, 1)
        ELSE 0 END
    )
  );

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_painel_socio_v1() TO authenticated;

-- ============================================================
-- PARTE 5: Teste de consistência cross-page
-- ============================================================
CREATE OR REPLACE FUNCTION public.test_consistencia_financeira()
RETURNS TABLE (teste text, resultado text, detalhes jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio date := date_trunc('month', current_date)::date;
  v_fim date := current_date;
  v_dre jsonb;
  v_painel jsonb;
  v_tol numeric := 0.5;
BEGIN
  v_dre := public.get_dre_periodo(v_inicio, v_fim);
  v_painel := public.get_painel_socio_v1();

  RETURN QUERY SELECT
    'Faturamento Painel = DRE'::text,
    CASE WHEN abs(
      (v_painel->'mes_atual'->>'faturamento')::numeric -
      (v_dre->'receitas'->>'bruta')::numeric
    ) < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object(
      'painel', v_painel->'mes_atual'->>'faturamento',
      'dre', v_dre->'receitas'->>'bruta'
    );

  RETURN QUERY SELECT
    'Custo peças Painel = DRE'::text,
    CASE WHEN abs(
      (v_painel->'mes_atual'->>'custo_pecas')::numeric -
      (v_dre->'custos'->>'pecas')::numeric
    ) < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object(
      'painel', v_painel->'mes_atual'->>'custo_pecas',
      'dre', v_dre->'custos'->>'pecas'
    );

  RETURN QUERY SELECT
    'Comissões Painel = DRE'::text,
    CASE WHEN abs(
      (v_painel->'mes_atual'->>'comissoes')::numeric -
      (v_dre->'custos'->>'comissoes')::numeric
    ) < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object(
      'painel', v_painel->'mes_atual'->>'comissoes',
      'dre', v_dre->'custos'->>'comissoes'
    );

  RETURN QUERY SELECT
    'Lucro líquido Painel = DRE'::text,
    CASE WHEN abs(
      (v_painel->'mes_atual'->>'lucro_liquido')::numeric -
      (v_dre->'resultado'->>'lucro_liquido')::numeric
    ) < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object(
      'painel', v_painel->'mes_atual'->>'lucro_liquido',
      'dre', v_dre->'resultado'->>'lucro_liquido'
    );

  RETURN QUERY SELECT
    'Distribuível Painel = DRE'::text,
    CASE WHEN abs(
      (v_painel->'mes_atual'->>'distribuivel')::numeric -
      (v_dre->'distribuicao'->>'distribuivel')::numeric
    ) < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object(
      'painel', v_painel->'mes_atual'->>'distribuivel',
      'dre', v_dre->'distribuicao'->>'distribuivel'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_consistencia_financeira() TO authenticated;
