CREATE OR REPLACE FUNCTION public.tv_get_painel_data(p_codigo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_painel record;
  v_empresa_nome text;
  v_empresa_cidade text;
  v_kpis jsonb;
  v_podio jsonb;
  v_meta jsonb;
  v_aparelhos jsonb;
  v_alertas jsonb;
  v_lojistas jsonb;
  v_estoque_critico jsonb;
  v_financeiro_mes jsonb;
  v_ultimas_oss jsonb;
  v_agenda_dia jsonb;
  v_contas_vencer jsonb;
  v_graf_semanal jsonb;
  v_ranking_lojistas jsonb;
  v_ticket_medio jsonb;
  v_top_defeitos jsonb;
  v_hoje date := CURRENT_DATE;
  v_inicio_mes date := date_trunc('month', CURRENT_DATE)::date;
  v_4semanas_atras date := (CURRENT_DATE - interval '28 days')::date;
  v_6meses_atras date := (CURRENT_DATE - interval '6 months')::date;
  v_user_id_admin uuid;
BEGIN
  SELECT * INTO v_painel FROM tv_paineis 
  WHERE codigo = p_codigo AND ativo = true LIMIT 1;
  
  IF v_painel IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código inválido');
  END IF;
  
  UPDATE tv_paineis SET ultimo_acesso_em = now() WHERE id = v_painel.id;
  
  SELECT nome, cidade INTO v_empresa_nome, v_empresa_cidade 
  FROM empresas WHERE id = v_painel.empresa_id;
  
  SELECT user_id INTO v_user_id_admin
  FROM user_profiles 
  WHERE empresa_id = v_painel.empresa_id 
  LIMIT 1;
  
  SELECT jsonb_build_object(
    'oss_hoje', (SELECT COUNT(*) FROM ordens_de_servico WHERE empresa_id = v_painel.empresa_id AND status = 'entregue' AND deleted_at IS NULL AND data_entrega::date = v_hoje),
    'faturamento_hoje', (SELECT COALESCE(SUM(COALESCE(valor_total, valor, 0)), 0) FROM ordens_de_servico WHERE empresa_id = v_painel.empresa_id AND status = 'entregue' AND deleted_at IS NULL AND data_entrega::date = v_hoje),
    'faturamento_mes', (SELECT COALESCE(SUM(COALESCE(valor_total, valor, 0)), 0) FROM ordens_de_servico WHERE empresa_id = v_painel.empresa_id AND status = 'entregue' AND deleted_at IS NULL AND data_entrega >= v_inicio_mes),
    'aparelhos_abertos', (SELECT COUNT(*) FROM ordens_de_servico WHERE empresa_id = v_painel.empresa_id AND status NOT IN ('entregue', 'cancelado') AND deleted_at IS NULL),
    'prontos_retirar', (SELECT COUNT(*) FROM ordens_de_servico WHERE empresa_id = v_painel.empresa_id AND status = 'pronto' AND deleted_at IS NULL)
  ) INTO v_kpis;
  
  SELECT jsonb_agg(jsonb_build_object('nome', t.nome, 'oss', t.qtd_oss, 'comissao', t.total_comissao) ORDER BY t.qtd_oss DESC) INTO v_podio
  FROM (
    SELECT f.nome, COUNT(*) as qtd_oss, SUM(c.valor) as total_comissao
    FROM comissoes c JOIN funcionarios f ON f.id = c.funcionario_id
    WHERE c.empresa_id = v_painel.empresa_id AND c.mes_competencia = to_char(v_hoje, 'YYYY-MM') AND c.estornada_em IS NULL
    GROUP BY f.id, f.nome ORDER BY qtd_oss DESC LIMIT 3
  ) t;
  
  SELECT jsonb_build_object(
    'meta_valor', 130000,
    'atual_valor', COALESCE((SELECT SUM(COALESCE(valor_total, valor, 0)) FROM ordens_de_servico WHERE empresa_id = v_painel.empresa_id AND status = 'entregue' AND deleted_at IS NULL AND data_entrega >= v_inicio_mes), 0),
    'pct', LEAST(100, (COALESCE((SELECT SUM(COALESCE(valor_total, valor, 0)) FROM ordens_de_servico WHERE empresa_id = v_painel.empresa_id AND status = 'entregue' AND deleted_at IS NULL AND data_entrega >= v_inicio_mes), 0) / 130000.0 * 100)::int)
  ) INTO v_meta;
  
  SELECT jsonb_agg(jsonb_build_object('nome', t.nome, 'qtd', t.qtd) ORDER BY t.qtd DESC) INTO v_aparelhos
  FROM (
    SELECT f.nome, COUNT(*) as qtd
    FROM ordens_de_servico os JOIN funcionarios f ON f.id = os.funcionario_id
    WHERE os.empresa_id = v_painel.empresa_id AND os.status NOT IN ('entregue', 'cancelado') AND os.deleted_at IS NULL AND os.funcionario_id IS NOT NULL
    GROUP BY f.id, f.nome ORDER BY qtd DESC LIMIT 8
  ) t;
  
  SELECT jsonb_build_object(
    'prontas_paradas', (SELECT COUNT(*) FROM ordens_de_servico WHERE empresa_id = v_painel.empresa_id AND status = 'pronto' AND deleted_at IS NULL AND updated_at < (now() - interval '7 days')),
    'aguardando_aprovacao_2dias', (SELECT COUNT(*) FROM ordens_de_servico WHERE empresa_id = v_painel.empresa_id AND status = 'aguardando_aprovacao' AND deleted_at IS NULL AND updated_at < (now() - interval '2 days')),
    'estoque_baixo', (SELECT COUNT(*) FROM estoque_itens WHERE empresa_id = v_painel.empresa_id AND ativo = true AND deleted_at IS NULL AND quantidade <= COALESCE(quantidade_minima, 0))
  ) INTO v_alertas;
  
  SELECT jsonb_agg(jsonb_build_object(
    'nome', nome, 'saldo', saldo
  ) ORDER BY saldo DESC) INTO v_lojistas
  FROM (
    SELECT 
      c.nome,
      COALESCE(stats.saldo_devedor, 0) as saldo
    FROM clientes c
    LEFT JOIN LATERAL (
      SELECT
        SUM(COALESCE(os.valor_total, os.valor, 0)) - SUM(COALESCE(os.valor_pago, 0)) as saldo_devedor
      FROM ordens_de_servico os
      WHERE (os.lojista_id = c.id OR os.loja_id = c.id)
        AND os.status = 'entregue'
        AND os.deleted_at IS NULL
        AND os.empresa_id = v_painel.empresa_id
    ) stats ON true
    WHERE c.empresa_id = v_painel.empresa_id
      AND COALESCE(stats.saldo_devedor, 0) > 0
    ORDER BY saldo DESC
    LIMIT 5
  ) t;
  
  SELECT jsonb_agg(jsonb_build_object(
    'nome', nome, 'qtd_oss', qtd_oss, 'faturamento', faturamento
  ) ORDER BY qtd_oss DESC) INTO v_ranking_lojistas
  FROM (
    SELECT 
      c.nome,
      COUNT(os.id) as qtd_oss,
      SUM(COALESCE(os.valor_total, os.valor, 0)) as faturamento
    FROM clientes c
    JOIN ordens_de_servico os ON (os.lojista_id = c.id OR os.loja_id = c.id)
    WHERE c.empresa_id = v_painel.empresa_id
      AND os.status = 'entregue'
      AND os.deleted_at IS NULL
      AND os.data_entrega >= v_inicio_mes
    GROUP BY c.id, c.nome
    HAVING COUNT(os.id) > 0
    ORDER BY qtd_oss DESC
    LIMIT 5
  ) t;
  
  SELECT jsonb_agg(jsonb_build_object(
    'nome', COALESCE(nome_personalizado, sku, 'Item sem nome'),
    'quantidade', quantidade,
    'minimo', quantidade_minima
  ) ORDER BY (quantidade::float / NULLIF(quantidade_minima, 0))) INTO v_estoque_critico
  FROM (
    SELECT nome_personalizado, sku, quantidade, quantidade_minima
    FROM estoque_itens
    WHERE empresa_id = v_painel.empresa_id AND ativo = true AND deleted_at IS NULL
      AND quantidade_minima > 0 AND quantidade <= quantidade_minima
    LIMIT 8
  ) e;
  
  SELECT jsonb_build_object(
    'receita', COALESCE((SELECT SUM(COALESCE(valor_total, valor, 0)) FROM ordens_de_servico WHERE empresa_id = v_painel.empresa_id AND status = 'entregue' AND deleted_at IS NULL AND data_entrega >= v_inicio_mes), 0),
    'custos_pecas', COALESCE((SELECT SUM(pu.custo_unitario * pu.quantidade) FROM pecas_utilizadas pu JOIN ordens_de_servico os ON os.id = pu.ordem_id WHERE os.empresa_id = v_painel.empresa_id AND os.data_entrega >= v_inicio_mes AND os.data_entrega <= CURRENT_DATE), 0),
    'despesas', COALESCE((SELECT SUM(valor) FROM contas_a_pagar WHERE empresa_id = v_painel.empresa_id AND mes_competencia = to_char(v_hoje, 'YYYY-MM') AND deleted_at IS NULL AND categoria NOT IN ('Comissões', 'Prejuízos')), 0)
  ) INTO v_financeiro_mes;
  
  SELECT jsonb_agg(jsonb_build_object(
    'numero', numero_formatado, 'tecnico', tecnico_nome, 'valor', valor_total, 'data', data_entrega
  ) ORDER BY data_entrega DESC) INTO v_ultimas_oss
  FROM (
    SELECT os.numero_formatado, f.nome as tecnico_nome, COALESCE(os.valor_total, os.valor, 0) as valor_total, os.data_entrega
    FROM ordens_de_servico os
    LEFT JOIN funcionarios f ON f.id = os.funcionario_id
    WHERE os.empresa_id = v_painel.empresa_id AND os.status = 'entregue' AND os.deleted_at IS NULL
    ORDER BY os.data_entrega DESC NULLS LAST
    LIMIT 5
  ) t;
  
  SELECT jsonb_agg(jsonb_build_object(
    'numero', numero_formatado, 'tecnico', tecnico_nome, 'previsao', previsao_entrega, 'prioridade', prioridade
  ) ORDER BY previsao_entrega ASC NULLS LAST) INTO v_agenda_dia
  FROM (
    SELECT os.numero_formatado, f.nome as tecnico_nome, os.previsao_entrega, os.prioridade
    FROM ordens_de_servico os
    LEFT JOIN funcionarios f ON f.id = os.funcionario_id
    WHERE os.empresa_id = v_painel.empresa_id 
      AND os.status NOT IN ('entregue', 'cancelado')
      AND os.deleted_at IS NULL
      AND os.previsao_entrega::date <= v_hoje
    ORDER BY os.previsao_entrega ASC NULLS LAST
    LIMIT 8
  ) t;
  
  SELECT jsonb_agg(jsonb_build_object(
    'descricao', descricao, 'valor', valor, 'vencimento', data_vencimento, 'dias', (data_vencimento::date - v_hoje)::int
  ) ORDER BY data_vencimento ASC) INTO v_contas_vencer
  FROM (
    SELECT descricao, valor, data_vencimento
    FROM contas_a_pagar
    WHERE empresa_id = v_painel.empresa_id
      AND status = 'pendente' AND deleted_at IS NULL
      AND data_vencimento >= v_hoje
      AND data_vencimento <= (v_hoje + interval '7 days')
    ORDER BY data_vencimento ASC
    LIMIT 8
  ) t;
  
  WITH semanas AS (
    SELECT 
      date_trunc('week', generate_series(v_4semanas_atras, v_hoje, '7 days'::interval))::date AS semana_inicio
  ),
  dados_semanais AS (
    SELECT 
      date_trunc('week', data_entrega)::date AS semana_inicio,
      SUM(COALESCE(valor_total, valor, 0)) AS receita,
      COUNT(*) AS qtd_oss
    FROM ordens_de_servico
    WHERE empresa_id = v_painel.empresa_id
      AND status = 'entregue' AND deleted_at IS NULL
      AND data_entrega >= v_4semanas_atras
    GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'semana', to_char(s.semana_inicio, 'DD/MM'),
    'receita', COALESCE(d.receita, 0),
    'oss', COALESCE(d.qtd_oss, 0)
  ) ORDER BY s.semana_inicio) INTO v_graf_semanal
  FROM semanas s
  LEFT JOIN dados_semanais d ON d.semana_inicio = s.semana_inicio;
  
  WITH meses AS (
    SELECT date_trunc('month', generate_series(
      date_trunc('month', v_6meses_atras),
      date_trunc('month', v_hoje),
      '1 month'::interval
    ))::date AS mes_dt
  ),
  dados_mes AS (
    SELECT 
      date_trunc('month', data_entrega)::date AS mes_dt,
      COUNT(*) AS qtd,
      AVG(COALESCE(valor_total, valor, 0))::numeric(10,2) AS ticket_medio
    FROM ordens_de_servico
    WHERE empresa_id = v_painel.empresa_id 
      AND status = 'entregue' AND deleted_at IS NULL
      AND data_entrega >= v_6meses_atras
    GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'mes', to_char(m.mes_dt, 'MM/YY'),
    'ticket', COALESCE(d.ticket_medio, 0),
    'oss', COALESCE(d.qtd, 0)
  ) ORDER BY m.mes_dt) INTO v_ticket_medio
  FROM meses m
  LEFT JOIN dados_mes d ON d.mes_dt = m.mes_dt;
  
  SELECT jsonb_agg(jsonb_build_object('defeito', defeito, 'qtd', qtd) ORDER BY qtd DESC) INTO v_top_defeitos
  FROM (
    SELECT COALESCE(NULLIF(TRIM(defeito_relatado), ''), 'Não especificado') as defeito, COUNT(*) as qtd
    FROM ordens_de_servico
    WHERE empresa_id = v_painel.empresa_id AND deleted_at IS NULL AND data_entrada >= v_inicio_mes
    GROUP BY 1
    ORDER BY qtd DESC
    LIMIT 5
  ) t;
  
  RETURN jsonb_build_object(
    'success', true,
    'painel', jsonb_build_object(
      'id', v_painel.id,
      'empresa_id', v_painel.empresa_id,
      'nome', v_painel.nome,
      'tema', v_painel.tema,
      'orientacao', v_painel.orientacao,
      'widgets', v_painel.widgets,
      'layout', v_painel.layout,
      'logo_url', v_painel.logo_url,
      'tamanho_fonte', v_painel.tamanho_fonte,
      'intervalo_refresh', v_painel.intervalo_refresh_segundos,
      'empresa_nome', v_empresa_nome,
      'empresa_cidade', v_empresa_cidade
    ),
    'dados', jsonb_build_object(
      'kpis', v_kpis,
      'podio', COALESCE(v_podio, '[]'::jsonb),
      'meta', v_meta,
      'aparelhos_tecnicos', COALESCE(v_aparelhos, '[]'::jsonb),
      'alertas', v_alertas,
      'top_lojistas', COALESCE(v_lojistas, '[]'::jsonb),
      'estoque_critico', COALESCE(v_estoque_critico, '[]'::jsonb),
      'financeiro_mes', v_financeiro_mes,
      'ultimas_oss', COALESCE(v_ultimas_oss, '[]'::jsonb),
      'agenda_dia', COALESCE(v_agenda_dia, '[]'::jsonb),
      'contas_vencer', COALESCE(v_contas_vencer, '[]'::jsonb),
      'graf_semanal', COALESCE(v_graf_semanal, '[]'::jsonb),
      'ranking_lojistas', COALESCE(v_ranking_lojistas, '[]'::jsonb),
      'ticket_medio', COALESCE(v_ticket_medio, '[]'::jsonb),
      'top_defeitos', COALESCE(v_top_defeitos, '[]'::jsonb),
      'gerado_em', now()
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;