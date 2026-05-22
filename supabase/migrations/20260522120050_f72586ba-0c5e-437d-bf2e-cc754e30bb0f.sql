-- 1) get_dre_periodo: somar comissões EXTRAS de contas_a_pagar
CREATE OR REPLACE FUNCTION public.get_dre_periodo(p_inicio date, p_fim date, p_empresa_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_comissoes_auto numeric := 0;
  v_comissoes_extras numeric := 0;
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

  SELECT COALESCE(SUM(COALESCE(valor_total, valor, 0)), 0)
    INTO v_servicos_faturados
    FROM ordens_de_servico
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND status IN ('pronto', 'entregue')
      AND data_conclusao >= p_inicio
      AND data_conclusao < (p_fim + interval '1 day');

  v_outros_recebimentos := 0;
  v_receita_bruta := v_servicos_faturados;

  IF v_e_mes_completo THEN
    SELECT COALESCE(SUM(valor), 0)
      INTO v_impostos
      FROM ajustes_mensais
      WHERE empresa_id = v_empresa_id
        AND ano_mes = v_ano_mes
        AND tipo = 'impostos';
  END IF;

  v_receita_liquida := v_receita_bruta - v_impostos;

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
      INTO v_comissoes_auto
      FROM comissoes
      WHERE empresa_id = v_empresa_id
        AND mes_competencia = v_ano_mes
        AND status != 'estornada';
  ELSE
    SELECT COALESCE(SUM(c.valor), 0)
      INTO v_comissoes_auto
      FROM comissoes c
      JOIN ordens_de_servico o ON o.id = c.ordem_id
      WHERE c.empresa_id = v_empresa_id
        AND c.status != 'estornada'
        AND o.deleted_at IS NULL
        AND o.data_conclusao >= p_inicio
        AND o.data_conclusao < (p_fim + interval '1 day');
  END IF;

  -- Comissões EXTRAS lançadas em contas_a_pagar (bônus, adicional, etc.)
  SELECT COALESCE(SUM(valor), 0)
    INTO v_comissoes_extras
    FROM contas_a_pagar
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND status IN ('paga', 'pendente')
      AND categoria = 'Comissões'
      AND data_vencimento >= p_inicio
      AND data_vencimento <= p_fim;

  v_comissoes := v_comissoes_auto + v_comissoes_extras;

  SELECT COALESCE(SUM(valor_centavos)::numeric / 100, 0)
    INTO v_prejuizos
    FROM prejuizos
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND data_evento >= p_inicio
      AND data_evento <= p_fim;

  v_lucro_bruto := v_receita_liquida - v_pecas - v_comissoes - v_prejuizos;

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

  -- "outros gastos" já excluía 'Comissões' — manter
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

  v_ebitda := v_lucro_bruto - v_gastos_fixos - v_outros_gastos;

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

  SELECT COALESCE(percentual_reserva_empresa, 10)
    INTO v_reserva_pct
    FROM empresa_config
    WHERE empresa_id = v_empresa_id
    LIMIT 1;

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
      'comissoes_auto', v_comissoes_auto,
      'comissoes_extras', v_comissoes_extras,
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
$function$;

-- 2) Trigger anti-duplicação em contas_a_pagar
CREATE OR REPLACE FUNCTION public.impedir_duplicacao_comissoes_cp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes_competencia text;
  v_total_comissoes_mes numeric;
BEGIN
  IF NEW.categoria = 'Comissões'
     AND COALESCE(NEW.descricao, '') !~* 'extra|b[oô]nus|adicional'
     AND NEW.data_vencimento IS NOT NULL
     AND NEW.deleted_at IS NULL THEN

    v_mes_competencia := to_char(NEW.data_vencimento, 'YYYY-MM');

    SELECT COALESCE(SUM(valor), 0) INTO v_total_comissoes_mes
      FROM comissoes
     WHERE empresa_id = NEW.empresa_id
       AND mes_competencia = v_mes_competencia
       AND status != 'estornada';

    IF v_total_comissoes_mes > 0 THEN
      RAISE EXCEPTION
        'Não é possível criar conta a pagar de Comissões manualmente: já existem R$ % de comissões automáticas em comissoes para mes_competencia=%. Use descrição com palavra "EXTRA", "BÔNUS" ou "ADICIONAL" se for um adicional, ou estorne as comissões automáticas primeiro.',
        v_total_comissoes_mes, v_mes_competencia;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_dup_com_cp ON public.contas_a_pagar;
CREATE TRIGGER trg_impedir_dup_com_cp
  BEFORE INSERT OR UPDATE ON public.contas_a_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.impedir_duplicacao_comissoes_cp();

-- 3) Teste de invariante: sem duplicação cp x comissoes
CREATE OR REPLACE FUNCTION public.test_consistencia_financeira()
 RETURNS TABLE(teste text, resultado text, detalhes jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inicio date := date_trunc('month', current_date)::date;
  v_fim date := current_date;
  v_empresa_id uuid;
  v_dre jsonb;
  v_painel jsonb;
  v_tol numeric := 0.5;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_empresa_id IS NULL THEN
    SELECT empresa_id INTO v_empresa_id FROM socios WHERE deleted_at IS NULL AND ativo = true LIMIT 1;
  END IF;

  v_dre := public.get_dre_periodo(v_inicio, v_fim, v_empresa_id);
  v_painel := public.get_painel_socio_v1();

  RETURN QUERY SELECT 'Faturamento Painel = DRE'::text,
    CASE WHEN abs((v_painel->'mes_atual'->>'faturamento')::numeric - (v_dre->'receitas'->>'bruta')::numeric) < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('painel', v_painel->'mes_atual'->>'faturamento', 'dre', v_dre->'receitas'->>'bruta');

  RETURN QUERY SELECT 'Custo peças Painel = DRE'::text,
    CASE WHEN abs((v_painel->'mes_atual'->>'custo_pecas')::numeric - (v_dre->'custos'->>'pecas')::numeric) < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('painel', v_painel->'mes_atual'->>'custo_pecas', 'dre', v_dre->'custos'->>'pecas');

  RETURN QUERY SELECT 'Comissões Painel = DRE'::text,
    CASE WHEN abs((v_painel->'mes_atual'->>'comissoes')::numeric - (v_dre->'custos'->>'comissoes')::numeric) < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('painel', v_painel->'mes_atual'->>'comissoes', 'dre', v_dre->'custos'->>'comissoes');

  RETURN QUERY SELECT 'Lucro líquido Painel = DRE'::text,
    CASE WHEN abs((v_painel->'mes_atual'->>'lucro_liquido')::numeric - (v_dre->'resultado'->>'lucro_liquido')::numeric) < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('painel', v_painel->'mes_atual'->>'lucro_liquido', 'dre', v_dre->'resultado'->>'lucro_liquido');

  RETURN QUERY SELECT 'Distribuível Painel = DRE'::text,
    CASE WHEN abs((v_painel->'mes_atual'->>'distribuivel')::numeric - (v_dre->'distribuicao'->>'distribuivel')::numeric) < v_tol THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('painel', v_painel->'mes_atual'->>'distribuivel', 'dre', v_dre->'distribuicao'->>'distribuivel');

  -- NOVO: comissões não duplicadas (cp normais x comissoes automáticas)
  RETURN QUERY
  WITH dup AS (
    SELECT to_char(cp.data_vencimento, 'YYYY-MM') AS mes,
           SUM(cp.valor) AS cp_total,
           (SELECT COALESCE(SUM(valor),0) FROM comissoes
             WHERE mes_competencia = to_char(cp.data_vencimento, 'YYYY-MM')
               AND empresa_id = v_empresa_id
               AND status != 'estornada') AS com_total
    FROM contas_a_pagar cp
    WHERE cp.empresa_id = v_empresa_id
      AND cp.categoria = 'Comissões'
      AND cp.deleted_at IS NULL
      AND COALESCE(cp.descricao,'') !~* 'extra|b[oô]nus|adicional'
    GROUP BY 1
    HAVING (SELECT COALESCE(SUM(valor),0) FROM comissoes
             WHERE mes_competencia = to_char(cp.data_vencimento, 'YYYY-MM')
               AND empresa_id = v_empresa_id
               AND status != 'estornada') > 0
  )
  SELECT 'Comissões NÃO duplicadas cp vs comissoes'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('detalhes', COALESCE(jsonb_agg(jsonb_build_object(
      'mes', mes, 'cp', cp_total, 'comissoes_auto', com_total)), '[]'::jsonb))
  FROM dup;
END;
$function$;