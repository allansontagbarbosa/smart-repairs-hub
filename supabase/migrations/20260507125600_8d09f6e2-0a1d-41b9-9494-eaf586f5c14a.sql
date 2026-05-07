CREATE OR REPLACE FUNCTION admin.kpis_dashboard()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = admin, public AS $$
DECLARE
  v_mrr_atual int; v_mrr_anterior int; v_clientes_pagantes int;
  v_em_trial int; v_trial_vence_semana int;
  v_novos_30d int; v_churn_30d int; v_churn_taxa numeric; v_ticket_medio numeric;
BEGIN
  IF NOT admin.is_staff() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  SELECT COALESCE(SUM(mrr_centavos), 0) INTO v_mrr_atual
  FROM admin.assinaturas WHERE status = 'ativa';

  SELECT COALESCE(SUM(e.valor_centavos), 0) INTO v_mrr_anterior
  FROM admin.eventos_billing e
  WHERE e.tipo = 'fatura_paga'
    AND e.criado_em >= date_trunc('month', CURRENT_DATE - interval '1 month')
    AND e.criado_em < date_trunc('month', CURRENT_DATE);

  SELECT COUNT(*) INTO v_clientes_pagantes FROM admin.assinaturas WHERE status = 'ativa';

  SELECT COUNT(*), COUNT(*) FILTER (WHERE trial_termina_em <= now() + interval '7 days')
    INTO v_em_trial, v_trial_vence_semana
  FROM admin.assinaturas WHERE status = 'trial';

  SELECT COUNT(*) INTO v_novos_30d
  FROM admin.assinaturas WHERE status = 'ativa' AND ativada_em >= now() - interval '30 days';

  SELECT COUNT(*) INTO v_churn_30d
  FROM admin.assinaturas WHERE status = 'cancelada' AND cancelada_em >= now() - interval '30 days';

  v_churn_taxa := CASE WHEN v_clientes_pagantes + v_churn_30d > 0
    THEN (v_churn_30d::numeric / (v_clientes_pagantes + v_churn_30d)) * 100
    ELSE 0 END;

  SELECT CASE WHEN COUNT(*) > 0 THEN AVG(mrr_centavos) ELSE 0 END INTO v_ticket_medio
  FROM admin.assinaturas WHERE status = 'ativa';

  RETURN jsonb_build_object(
    'success', true,
    'mrr_centavos', v_mrr_atual,
    'mrr_anterior_centavos', v_mrr_anterior,
    'arr_centavos', v_mrr_atual * 12,
    'clientes_pagantes', v_clientes_pagantes,
    'novos_30d', v_novos_30d,
    'churn_30d', v_churn_30d,
    'churn_taxa_pct', round(v_churn_taxa, 1),
    'em_trial', v_em_trial,
    'trial_vence_semana', v_trial_vence_semana,
    'ticket_medio_centavos', round(v_ticket_medio)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION admin.kpis_dashboard() TO authenticated;

CREATE OR REPLACE FUNCTION admin.mrr_serie_12m()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = admin AS $$
DECLARE v_resultado jsonb;
BEGIN
  IF NOT admin.is_staff() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  WITH meses AS (
    SELECT generate_series(
      date_trunc('month', CURRENT_DATE - interval '11 months'),
      date_trunc('month', CURRENT_DATE),
      interval '1 month'
    )::date AS mes
  ),
  receita_por_mes AS (
    SELECT date_trunc('month', e.criado_em)::date AS mes, COALESCE(SUM(e.valor_centavos), 0) AS receita
    FROM admin.eventos_billing e
    WHERE e.tipo = 'fatura_paga' AND e.criado_em >= CURRENT_DATE - interval '12 months'
    GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'mes', to_char(m.mes, 'YYYY-MM'),
    'mes_label', to_char(m.mes, 'TMMon'),
    'mrr_centavos', COALESCE(r.receita, 0)
  ) ORDER BY m.mes) INTO v_resultado
  FROM meses m LEFT JOIN receita_por_mes r ON r.mes = m.mes;

  RETURN jsonb_build_object('success', true, 'serie', COALESCE(v_resultado, '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION admin.mrr_serie_12m() TO authenticated;

CREATE OR REPLACE FUNCTION admin.atividade_recente(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = admin, public AS $$
DECLARE v_resultado jsonb;
BEGIN
  IF NOT admin.is_staff() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'tipo', e.tipo,
    'empresa_id', e.empresa_id,
    'empresa_nome', emp.nome,
    'valor_centavos', e.valor_centavos,
    'payload', e.payload,
    'criado_em', e.criado_em
  ) ORDER BY e.criado_em DESC) INTO v_resultado
  FROM (
    SELECT * FROM admin.eventos_billing ORDER BY criado_em DESC LIMIT p_limit
  ) e
  LEFT JOIN public.empresas emp ON emp.id = e.empresa_id;

  RETURN jsonb_build_object('success', true, 'eventos', COALESCE(v_resultado, '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION admin.atividade_recente(int) TO authenticated;