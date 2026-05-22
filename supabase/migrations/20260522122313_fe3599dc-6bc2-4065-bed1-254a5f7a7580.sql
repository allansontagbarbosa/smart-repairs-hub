-- 1) Bypass do trigger anti-duplicação para auto-sync
CREATE OR REPLACE FUNCTION public.impedir_duplicacao_comissoes_cp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mes_competencia text;
  v_total_comissoes_mes numeric;
BEGIN
  IF COALESCE(NEW.observacoes, '') ILIKE 'Auto-sincronizado%' THEN
    RETURN NEW;
  END IF;

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
$function$;

-- 2) get_dre_periodo: somar apenas extras manuais reais
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

  -- Apenas EXTRAS manuais reais (excluir os auto-sincronizados, já contados acima)
  SELECT COALESCE(SUM(valor), 0)
    INTO v_comissoes_extras
    FROM contas_a_pagar
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND status IN ('paga', 'pendente')
      AND categoria = 'Comissões'
      AND data_vencimento >= p_inicio
      AND data_vencimento <= p_fim
      AND COALESCE(observacoes, '') NOT ILIKE 'Auto-sincronizado%'
      AND COALESCE(descricao, '') ~* 'extra|b[oô]nus|adicional';

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

  SELECT COALESCE(SUM(valor), 0)
    INTO v_outros_gastos
    FROM contas_a_pagar
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND status IN ('paga', 'pendente')
      AND categoria NOT IN ('Comissões', 'Prejuízos')
      AND NOT (categoria = ANY(v_categorias_fixas))
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
  v_margem_pct := CASE WHEN v_receita_bruta > 0 THEN (v_lucro_liquido / v_receita_bruta) * 100 ELSE 0 END;

  SELECT COALESCE(reserva_pct, 10) INTO v_reserva_pct
    FROM empresas WHERE id = v_empresa_id;
  v_reserva_valor := GREATEST(v_lucro_liquido, 0) * v_reserva_pct / 100;
  v_distribuivel := GREATEST(v_lucro_liquido, 0) - v_reserva_valor;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'socio_id', s.id,
    'nome', s.nome,
    'pct', s.pct_distribuicao,
    'valor', ROUND(v_distribuivel * s.pct_distribuicao / 100, 2)
  ) ORDER BY s.ordem), '[]'::jsonb)
  INTO v_socios
  FROM socios s
  WHERE s.empresa_id = v_empresa_id AND s.ativo = true;

  RETURN jsonb_build_object(
    'sucesso', true,
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'mes_completo', v_e_mes_completo),
    'receita_bruta', v_receita_bruta,
    'servicos_faturados', v_servicos_faturados,
    'outros_recebimentos', v_outros_recebimentos,
    'impostos', v_impostos,
    'receita_liquida', v_receita_liquida,
    'pecas', v_pecas,
    'comissoes', v_comissoes,
    'comissoes_auto', v_comissoes_auto,
    'comissoes_extras', v_comissoes_extras,
    'prejuizos', v_prejuizos,
    'lucro_bruto', v_lucro_bruto,
    'gastos_fixos', v_gastos_fixos,
    'outros_gastos', v_outros_gastos,
    'ebitda', v_ebitda,
    'depreciacao', v_depreciacao,
    'lucro_liquido', v_lucro_liquido,
    'margem_pct', v_margem_pct,
    'reserva_pct', v_reserva_pct,
    'reserva_valor', v_reserva_valor,
    'distribuivel', v_distribuivel,
    'socios', v_socios
  );
END;
$function$;

-- 3) Recriar invariante (precisa DROP para mudar return type)
DROP FUNCTION IF EXISTS public.test_consistencia_financeira();
CREATE FUNCTION public.test_consistencia_financeira()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_falhas jsonb := '[]'::jsonb;
  v_dup_count int;
BEGIN
  SELECT COUNT(*) INTO v_dup_count
    FROM contas_a_pagar cp
   WHERE cp.deleted_at IS NULL
     AND cp.categoria = 'Comissões'
     AND COALESCE(cp.observacoes, '') NOT ILIKE 'Auto-sincronizado%'
     AND COALESCE(cp.descricao, '') !~* 'extra|b[oô]nus|adicional'
     AND EXISTS (
       SELECT 1 FROM comissoes c
        WHERE c.empresa_id = cp.empresa_id
          AND c.mes_competencia = to_char(cp.data_vencimento, 'YYYY-MM')
          AND c.status != 'estornada'
     );

  IF v_dup_count > 0 THEN
    v_falhas := v_falhas || jsonb_build_object(
      'teste', 'Comissões NÃO duplicadas',
      'detalhe', format('%s lançamentos manuais em contas_a_pagar coexistem com comissões automáticas', v_dup_count)
    );
  END IF;

  RETURN jsonb_build_object(
    'sucesso', jsonb_array_length(v_falhas) = 0,
    'falhas', v_falhas
  );
END;
$function$;