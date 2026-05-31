-- =========================================================================
-- SEC-01 — Isolamento de tenant
-- =========================================================================

-- ---------- Bloco 1: RLS de defesa em profundidade (idempotente) ----------
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS t
    FROM   pg_class c
    JOIN   pg_namespace n ON n.oid = c.relnamespace
    JOIN   information_schema.columns col
           ON col.table_schema = 'public'
          AND col.table_name   = c.relname
          AND col.column_name  = 'empresa_id'
    WHERE  n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', r.t);
    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON public.%I
      FOR ALL
      TO authenticated
      USING      (empresa_id = public.get_my_empresa_id())
      WITH CHECK (empresa_id = public.get_my_empresa_id())
    $p$, r.t);
  END LOOP;
END
$do$;

-- ---------- Bloco 2a: get_dashboard_summary (bug real) ----------
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_inicio timestamp with time zone DEFAULT date_trunc('month'::text, now()),
  p_fim    timestamp with time zone DEFAULT (date_trunc('month'::text, now()) + '1 mon'::interval)
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_can_see_financeiro boolean := false;
  v_user_perfil text;
  v_perm_financeiro jsonb;
  v_empresa_id uuid;
  v_period_start timestamptz := COALESCE(p_inicio, date_trunc('month', now()));
  v_period_end timestamptz := COALESCE(p_fim, COALESCE(p_inicio, date_trunc('month', now())) + interval '1 month');
  v_result json;
BEGIN
  SELECT pa.nome_perfil, pa.permissoes, up.empresa_id
  INTO v_user_perfil, v_perm_financeiro, v_empresa_id
  FROM public.user_profiles up
  LEFT JOIN public.perfis_acesso pa ON pa.id = up.perfil_id
  WHERE (up.user_id = auth.uid() OR up.id = auth.uid())
    AND up.ativo = true
  ORDER BY up.created_at ASC
  LIMIT 1;

  IF v_user_perfil IN ('admin', 'Administrador', 'Gerente', 'Financeiro') THEN
    v_can_see_financeiro := true;
  ELSIF v_perm_financeiro IS NOT NULL THEN
    v_can_see_financeiro := COALESCE(
      (v_perm_financeiro->'financeiro'->>'ver')::boolean,
      false
    );
  END IF;

  SELECT json_build_object(
    'ordens', (
      SELECT COALESCE(json_agg(row_to_json(o)), '[]'::json)
      FROM (
        SELECT
          os.id, os.numero, os.status, os.data_entrada, os.data_conclusao, os.previsao_entrega,
          CASE WHEN v_can_see_financeiro THEN os.valor ELSE NULL END AS valor,
          CASE WHEN v_can_see_financeiro THEN os.valor_total ELSE NULL END AS valor_total,
          CASE WHEN v_can_see_financeiro THEN os.custo_pecas ELSE NULL END AS custo_pecas,
          os.loja_id,
          json_build_object(
            'marca', a.marca, 'modelo', a.modelo, 'imei', a.imei,
            'clientes', json_build_object('nome', c.nome, 'telefone', c.telefone)
          ) AS aparelhos
        FROM ordens_de_servico os
        LEFT JOIN aparelhos a ON a.id = os.aparelho_id
        LEFT JOIN clientes c ON c.id = a.cliente_id
        WHERE os.deleted_at IS NULL
          AND os.empresa_id = v_empresa_id
          AND os.status::text <> 'cancelado'
        ORDER BY os.data_entrada DESC
      ) o
    ),
    'estoque_baixo', (
      SELECT count(*)
      FROM estoque_itens
      WHERE deleted_at IS NULL
        AND empresa_id = v_empresa_id
        AND quantidade_minima > 0
        AND quantidade <= quantidade_minima
    ),
    'contas_pendentes', CASE WHEN v_can_see_financeiro THEN (
      SELECT COALESCE(json_agg(row_to_json(cp)), '[]'::json)
      FROM contas_a_pagar cp
      WHERE cp.status = 'pendente'
        AND cp.empresa_id = v_empresa_id
    ) ELSE '[]'::json END,
    'comissoes_pendentes', CASE WHEN v_can_see_financeiro THEN (
      SELECT COALESCE(json_agg(row_to_json(co)), '[]'::json)
      FROM comissoes co
      WHERE co.status = 'pendente'
        AND co.estornada_em IS NULL
        AND co.empresa_id = v_empresa_id
    ) ELSE '[]'::json END,
    'comissoes_periodo_total', CASE WHEN v_can_see_financeiro THEN (
      SELECT COALESCE(SUM(co.valor), 0)
      FROM comissoes co
      JOIN ordens_de_servico os ON os.id = co.ordem_id
      WHERE (v_empresa_id IS NULL OR co.empresa_id = v_empresa_id)
        AND co.estornada_em IS NULL
        AND co.status::text IN ('pendente', 'liberada', 'paga')
        AND os.deleted_at IS NULL
        AND os.status::text IN ('pronto', 'entregue')
        AND os.data_conclusao IS NOT NULL
        AND os.data_conclusao >= v_period_start
        AND os.data_conclusao < v_period_end
    ) ELSE NULL END,
    'comissoes_periodo_a_pagar', CASE WHEN v_can_see_financeiro THEN (
      SELECT COALESCE(SUM(co.valor), 0)
      FROM comissoes co
      JOIN ordens_de_servico os ON os.id = co.ordem_id
      WHERE (v_empresa_id IS NULL OR co.empresa_id = v_empresa_id)
        AND co.estornada_em IS NULL
        AND co.status::text IN ('pendente', 'liberada')
        AND os.deleted_at IS NULL
        AND os.status::text IN ('pronto', 'entregue')
        AND os.data_conclusao IS NOT NULL
        AND os.data_conclusao >= v_period_start
        AND os.data_conclusao < v_period_end
    ) ELSE NULL END,
    'lojas', (
      SELECT COALESCE(json_agg(row_to_json(l)), '[]'::json)
      FROM lojas l
      WHERE l.ativo = true
        AND l.empresa_id = v_empresa_id
    ),
    'can_see_financeiro', v_can_see_financeiro
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- ---------- Bloco 2b: blindar contra IDOR (sobrescrita do parâmetro) ----------
-- Funções plpgsql: prepend `p_empresa_id := public.get_my_empresa_id();`
-- Funções sql: substituem `p_empresa_id` por `public.get_my_empresa_id()` no body.

-- ===== plpgsql =====

CREATE OR REPLACE FUNCTION public.atacado_dashboard_kpis(p_empresa_id uuid, p_inicio date, p_fim date)
RETURNS TABLE(faturamento numeric, qtd_pedidos bigint, ticket_medio numeric, pedidos_aguardando bigint, boletos_vencidos bigint, valor_inadimplencia numeric, clientes_ativos bigint, clientes_bloqueados bigint, novos_clientes_mes bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_fat NUMERIC := 0;
  v_qtd BIGINT := 0;
BEGIN
  p_empresa_id := public.get_my_empresa_id();
  SELECT COALESCE(SUM(total), 0), COUNT(*) INTO v_fat, v_qtd
  FROM atacado_pedidos
  WHERE empresa_id = p_empresa_id
    AND status IN ('faturado', 'entregue')
    AND created_at::DATE BETWEEN p_inicio AND p_fim
    AND deleted_at IS NULL;

  RETURN QUERY SELECT
    v_fat, v_qtd,
    CASE WHEN v_qtd > 0 THEN v_fat / v_qtd ELSE 0 END,
    (SELECT COUNT(*) FROM atacado_pedidos WHERE empresa_id = p_empresa_id AND status = 'aguardando_aprovacao' AND deleted_at IS NULL),
    (SELECT COUNT(*) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status IN ('aberto', 'atrasado') AND pp.vencimento < CURRENT_DATE),
    (SELECT COALESCE(SUM(pp.valor), 0) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status IN ('aberto', 'atrasado') AND pp.vencimento < CURRENT_DATE),
    (SELECT COUNT(*) FROM atacado_clientes WHERE empresa_id = p_empresa_id AND status = 'ativo' AND deleted_at IS NULL),
    (SELECT COUNT(*) FROM atacado_clientes WHERE empresa_id = p_empresa_id AND status = 'bloqueado' AND deleted_at IS NULL),
    (SELECT COUNT(*) FROM atacado_clientes WHERE empresa_id = p_empresa_id AND created_at::DATE BETWEEN p_inicio AND p_fim AND deleted_at IS NULL);
END;
$function$;

CREATE OR REPLACE FUNCTION public.atacado_dre(p_empresa_id uuid, p_inicio date, p_fim date)
RETURNS TABLE(faturamento_bruto numeric, descontos numeric, faturamento_liquido numeric, custo_produtos numeric, lucro_bruto numeric, margem_bruta_pct numeric, comissoes_estimadas numeric, inadimplencia numeric, resultado_operacional numeric, qtd_pedidos bigint, ticket_medio numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_fat_bruto NUMERIC := 0; v_desc NUMERIC := 0; v_fat_liq NUMERIC := 0;
  v_custo NUMERIC := 0; v_lucro_bruto NUMERIC := 0; v_comissoes NUMERIC := 0;
  v_inadimp NUMERIC := 0; v_qtd BIGINT := 0;
BEGIN
  p_empresa_id := public.get_my_empresa_id();
  SELECT COALESCE(SUM(subtotal), 0), COALESCE(SUM(desconto), 0), COUNT(*)
    INTO v_fat_bruto, v_desc, v_qtd
  FROM atacado_pedidos
  WHERE empresa_id = p_empresa_id AND status IN ('faturado', 'entregue')
    AND created_at::DATE BETWEEN p_inicio AND p_fim AND deleted_at IS NULL;
  v_fat_liq := v_fat_bruto - v_desc;

  SELECT COALESCE(SUM(i.quantidade * COALESCE(a.custo, 0)), 0) INTO v_custo
  FROM atacado_pedidos_itens i
  JOIN atacado_pedidos p ON p.id = i.pedido_id
  LEFT JOIN atacado_aparelhos a ON a.id = i.aparelho_id
  WHERE p.empresa_id = p_empresa_id AND p.status IN ('faturado', 'entregue')
    AND p.created_at::DATE BETWEEN p_inicio AND p_fim AND p.deleted_at IS NULL;
  v_lucro_bruto := v_fat_liq - v_custo;

  SELECT COALESCE(SUM(p.total * COALESCE(c.pct_padrao, 2) / 100), 0) INTO v_comissoes
  FROM atacado_pedidos p
  LEFT JOIN atacado_comissoes c ON c.vendedor_id = p.vendedor_id AND c.empresa_id = p_empresa_id AND c.ativa
  WHERE p.empresa_id = p_empresa_id AND p.status IN ('faturado', 'entregue')
    AND p.created_at::DATE BETWEEN p_inicio AND p_fim AND p.deleted_at IS NULL;

  SELECT COALESCE(SUM(pp.valor), 0) INTO v_inadimp
  FROM atacado_pedidos_pagamentos pp
  JOIN atacado_pedidos p ON p.id = pp.pedido_id
  WHERE p.empresa_id = p_empresa_id AND pp.status IN ('aberto', 'atrasado')
    AND pp.vencimento < CURRENT_DATE;

  RETURN QUERY SELECT v_fat_bruto, v_desc, v_fat_liq, v_custo, v_lucro_bruto,
    CASE WHEN v_fat_liq > 0 THEN (v_lucro_bruto / v_fat_liq) * 100 ELSE 0 END,
    v_comissoes, v_inadimp, v_lucro_bruto - v_comissoes, v_qtd,
    CASE WHEN v_qtd > 0 THEN v_fat_liq / v_qtd ELSE 0 END;
END; $function$;

CREATE OR REPLACE FUNCTION public.atacado_financeiro_kpis(p_empresa_id uuid)
RETURNS TABLE(a_receber_total numeric, a_receber_30d numeric, a_receber_60d numeric, a_receber_90d numeric, inadimplencia_total numeric, qtd_titulos_vencidos bigint, recebido_mes numeric, ticket_medio_recebido numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_inicio_mes DATE := DATE_TRUNC('month', CURRENT_DATE);
BEGIN
  p_empresa_id := public.get_my_empresa_id();
  RETURN QUERY SELECT
    COALESCE((SELECT SUM(pp.valor) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status = 'aberto' AND pp.vencimento >= CURRENT_DATE AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status = 'aberto' AND pp.vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status = 'aberto' AND pp.vencimento BETWEEN CURRENT_DATE + 31 AND CURRENT_DATE + 60 AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status = 'aberto' AND pp.vencimento BETWEEN CURRENT_DATE + 61 AND CURRENT_DATE + 90 AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status IN ('aberto','atrasado') AND pp.vencimento < CURRENT_DATE AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT COUNT(*) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status IN ('aberto','atrasado') AND pp.vencimento < CURRENT_DATE AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status = 'pago' AND pp.pago_em >= v_inicio_mes AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT AVG(pp.valor) FROM atacado_pedidos_pagamentos pp JOIN atacado_pedidos p ON p.id = pp.pedido_id WHERE p.empresa_id = p_empresa_id AND pp.status = 'pago' AND pp.pago_em >= v_inicio_mes AND p.deleted_at IS NULL), 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.atacado_giro_estoque(p_empresa_id uuid)
RETURNS TABLE(aparelho_id uuid, modelo text, capacidade text, cor text, quantidade_atual integer, custo_unitario numeric, valor_imobilizado numeric, dias_em_estoque integer, qtd_vendida_30d bigint, qtd_vendida_90d bigint, classificacao text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  p_empresa_id := public.get_my_empresa_id();
  RETURN QUERY
  SELECT a.id, a.modelo, a.capacidade, a.cor, a.quantidade, a.custo,
    (a.quantidade * a.custo)::NUMERIC,
    GREATEST(0, (CURRENT_DATE - a.data_entrada::DATE))::INT,
    COALESCE((SELECT SUM(i.quantidade)::BIGINT FROM atacado_pedidos_itens i JOIN atacado_pedidos p ON p.id = i.pedido_id WHERE i.modelo = a.modelo AND (i.capacidade = a.capacidade OR (i.capacidade IS NULL AND a.capacidade IS NULL)) AND p.empresa_id = p_empresa_id AND p.status IN ('faturado', 'entregue') AND p.created_at >= NOW() - INTERVAL '30 days' AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(i.quantidade)::BIGINT FROM atacado_pedidos_itens i JOIN atacado_pedidos p ON p.id = i.pedido_id WHERE i.modelo = a.modelo AND (i.capacidade = a.capacidade OR (i.capacidade IS NULL AND a.capacidade IS NULL)) AND p.empresa_id = p_empresa_id AND p.status IN ('faturado', 'entregue') AND p.created_at >= NOW() - INTERVAL '90 days' AND p.deleted_at IS NULL), 0),
    CASE WHEN (CURRENT_DATE - a.data_entrada::DATE) > 90 THEN 'parado'
         WHEN (CURRENT_DATE - a.data_entrada::DATE) > 30 THEN 'lento'
         ELSE 'normal' END
  FROM atacado_aparelhos a
  WHERE a.empresa_id = p_empresa_id AND a.status = 'estoque'
    AND a.quantidade > 0 AND a.deleted_at IS NULL
  ORDER BY (a.quantidade * a.custo) DESC;
END; $function$;

CREATE OR REPLACE FUNCTION public.atacado_performance_vendedores(p_empresa_id uuid, p_inicio date, p_fim date)
RETURNS TABLE(vendedor_id uuid, nome text, qtd_pedidos bigint, faturamento numeric, ticket_medio numeric, novos_clientes bigint, comissao_estimada numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  p_empresa_id := public.get_my_empresa_id();
  RETURN QUERY
  WITH ped AS (
    SELECT vendedor_id, COUNT(*)::BIGINT AS qtd, COALESCE(SUM(total),0) AS fat
    FROM public.atacado_pedidos
    WHERE empresa_id = p_empresa_id
      AND created_at::DATE BETWEEN p_inicio AND p_fim
      AND status IN ('faturado','entregue')
      AND deleted_at IS NULL
      AND vendedor_id IS NOT NULL
    GROUP BY vendedor_id
  ),
  novos AS (
    SELECT vendedor_responsavel_id AS vendedor_id, COUNT(*)::BIGINT AS qtd
    FROM public.atacado_clientes
    WHERE empresa_id = p_empresa_id
      AND created_at::DATE BETWEEN p_inicio AND p_fim
      AND deleted_at IS NULL
      AND vendedor_responsavel_id IS NOT NULL
    GROUP BY vendedor_responsavel_id
  )
  SELECT
    f.id, f.nome,
    COALESCE(p.qtd, 0), COALESCE(p.fat, 0),
    CASE WHEN COALESCE(p.qtd,0) > 0 THEN p.fat / p.qtd ELSE 0 END,
    COALESCE(n.qtd, 0),
    COALESCE(p.fat, 0) * COALESCE(c.pct_padrao, 2) / 100
  FROM public.funcionarios f
  LEFT JOIN ped p ON p.vendedor_id = f.id
  LEFT JOIN novos n ON n.vendedor_id = f.id
  LEFT JOIN public.atacado_comissoes c
    ON c.vendedor_id = f.id AND c.empresa_id = p_empresa_id AND c.ativa
  WHERE f.empresa_id = p_empresa_id
    AND (
      EXISTS (SELECT 1 FROM public.atacado_pedidos ap WHERE ap.vendedor_id = f.id AND ap.empresa_id = p_empresa_id)
      OR EXISTS (SELECT 1 FROM public.atacado_clientes ac WHERE ac.vendedor_responsavel_id = f.id AND ac.empresa_id = p_empresa_id)
      OR EXISTS (SELECT 1 FROM public.atacado_comissoes ac2 WHERE ac2.vendedor_id = f.id AND ac2.empresa_id = p_empresa_id)
    )
  ORDER BY COALESCE(p.fat, 0) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atacado_progresso_metas(p_empresa_id uuid, p_ano integer, p_mes integer)
RETURNS TABLE(meta_id uuid, tipo text, valor_meta numeric, valor_realizado numeric, pct_atingido numeric, bonus_atingir numeric, super_bonus_acima numeric, fechada boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_inicio DATE := MAKE_DATE(p_ano, p_mes, 1);
  v_fim DATE := (v_inicio + INTERVAL '1 month')::DATE;
BEGIN
  p_empresa_id := public.get_my_empresa_id();
  RETURN QUERY
  SELECT
    m.id, m.tipo, m.valor_meta,
    CASE m.tipo
      WHEN 'faturamento' THEN COALESCE((SELECT SUM(total) FROM public.atacado_pedidos WHERE empresa_id = p_empresa_id AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim AND status IN ('faturado','entregue') AND deleted_at IS NULL), 0)
      WHEN 'qtd_pedidos' THEN COALESCE((SELECT COUNT(*)::NUMERIC FROM public.atacado_pedidos WHERE empresa_id = p_empresa_id AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim AND status IN ('faturado','entregue') AND deleted_at IS NULL), 0)
      WHEN 'ticket_medio' THEN COALESCE((SELECT AVG(total) FROM public.atacado_pedidos WHERE empresa_id = p_empresa_id AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim AND status IN ('faturado','entregue') AND deleted_at IS NULL), 0)
      WHEN 'novos_clientes' THEN COALESCE((SELECT COUNT(*)::NUMERIC FROM public.atacado_clientes WHERE empresa_id = p_empresa_id AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim AND deleted_at IS NULL), 0)
      ELSE 0
    END AS valor_realizado,
    CASE
      WHEN COALESCE(m.valor_meta, 0) = 0 THEN 0
      ELSE (
        CASE m.tipo
          WHEN 'faturamento' THEN COALESCE((SELECT SUM(total) FROM public.atacado_pedidos WHERE empresa_id = p_empresa_id AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim AND status IN ('faturado','entregue') AND deleted_at IS NULL), 0)
          WHEN 'qtd_pedidos' THEN COALESCE((SELECT COUNT(*)::NUMERIC FROM public.atacado_pedidos WHERE empresa_id = p_empresa_id AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim AND status IN ('faturado','entregue') AND deleted_at IS NULL), 0)
          WHEN 'ticket_medio' THEN COALESCE((SELECT AVG(total) FROM public.atacado_pedidos WHERE empresa_id = p_empresa_id AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim AND status IN ('faturado','entregue') AND deleted_at IS NULL), 0)
          WHEN 'novos_clientes' THEN COALESCE((SELECT COUNT(*)::NUMERIC FROM public.atacado_clientes WHERE empresa_id = p_empresa_id AND created_at::DATE >= v_inicio AND created_at::DATE < v_fim AND deleted_at IS NULL), 0)
          ELSE 0
        END / m.valor_meta * 100
      )
    END AS pct_atingido,
    m.bonus_atingir, m.super_bonus_acima, m.fechada
  FROM public.atacado_metas m
  WHERE m.empresa_id = p_empresa_id
    AND m.competencia_ano = p_ano
    AND m.competencia_mes = p_mes;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atacado_rfm_clientes(p_empresa_id uuid)
RETURNS TABLE(cliente_id uuid, razao_social text, nome_fantasia text, ultima_compra date, dias_sem_comprar integer, qtd_pedidos_12m bigint, faturamento_12m numeric, ticket_medio numeric, classificacao text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  p_empresa_id := public.get_my_empresa_id();
  RETURN QUERY
  SELECT c.id, c.razao_social, c.nome_fantasia,
    MAX(p.created_at)::DATE,
    GREATEST(0, (CURRENT_DATE - MAX(p.created_at)::DATE))::INT,
    COUNT(p.id)::BIGINT, COALESCE(SUM(p.total), 0),
    CASE WHEN COUNT(p.id) > 0 THEN AVG(p.total) ELSE 0 END,
    CASE
      WHEN MAX(p.created_at) IS NULL THEN 'sem_compras'
      WHEN MAX(p.created_at)::DATE > CURRENT_DATE - 30 AND COUNT(p.id) >= 3 THEN 'campeao'
      WHEN MAX(p.created_at)::DATE > CURRENT_DATE - 60 AND COUNT(p.id) >= 2 THEN 'leal'
      WHEN MAX(p.created_at)::DATE > CURRENT_DATE - 90 THEN 'recente'
      WHEN MAX(p.created_at)::DATE > CURRENT_DATE - 180 THEN 'em_risco'
      ELSE 'perdido'
    END
  FROM atacado_clientes c
  LEFT JOIN atacado_pedidos p ON p.cliente_id = c.id
    AND p.status IN ('faturado', 'entregue')
    AND p.created_at >= NOW() - INTERVAL '12 months'
    AND p.deleted_at IS NULL
  WHERE c.empresa_id = p_empresa_id AND c.deleted_at IS NULL
  GROUP BY c.id, c.razao_social, c.nome_fantasia
  ORDER BY COALESCE(SUM(p.total), 0) DESC;
END; $function$;

CREATE OR REPLACE FUNCTION public.combo_dashboard_kpis(p_empresa_id uuid, p_inicio date, p_fim date)
RETURNS TABLE(faturamento_assist numeric, faturamento_loja numeric, faturamento_atacado numeric, qtd_os bigint, qtd_vendas_loja bigint, qtd_pedidos_atacado bigint, ticket_medio_consolidado numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_fat_assist NUMERIC := 0;
  v_fat_loja NUMERIC := 0;
  v_fat_atacado NUMERIC := 0;
  v_qtd_os BIGINT := 0;
  v_qtd_vendas BIGINT := 0;
  v_qtd_pedidos BIGINT := 0;
BEGIN
  p_empresa_id := public.get_my_empresa_id();
  IF public.empresa_tem_modulo(p_empresa_id, 'assistencia') THEN
    SELECT COALESCE(SUM(valor_total), 0), COUNT(*) INTO v_fat_assist, v_qtd_os
    FROM public.ordens_de_servico
    WHERE empresa_id = p_empresa_id AND status = 'concluida'
      AND created_at::DATE BETWEEN p_inicio AND p_fim;
  END IF;

  IF public.empresa_tem_modulo(p_empresa_id, 'loja') THEN
    SELECT COALESCE(SUM(total), 0), COUNT(*) INTO v_fat_loja, v_qtd_vendas
    FROM public.loja_vendas
    WHERE empresa_id = p_empresa_id AND status = 'pago'
      AND created_at::DATE BETWEEN p_inicio AND p_fim
      AND deleted_at IS NULL;
  END IF;

  IF public.empresa_tem_modulo(p_empresa_id, 'atacado') THEN
    SELECT COALESCE(SUM(total), 0), COUNT(*) INTO v_fat_atacado, v_qtd_pedidos
    FROM public.atacado_pedidos
    WHERE empresa_id = p_empresa_id AND status IN ('faturado', 'entregue')
      AND created_at::DATE BETWEEN p_inicio AND p_fim
      AND deleted_at IS NULL;
  END IF;

  RETURN QUERY SELECT
    v_fat_assist, v_fat_loja, v_fat_atacado,
    v_qtd_os, v_qtd_vendas, v_qtd_pedidos,
    CASE WHEN (v_qtd_os + v_qtd_vendas + v_qtd_pedidos) > 0
         THEN (v_fat_assist + v_fat_loja + v_fat_atacado) / (v_qtd_os + v_qtd_vendas + v_qtd_pedidos)
         ELSE 0 END;
END;
$function$;

-- ===== sql (substituem p_empresa_id por get_my_empresa_id() no body) =====

CREATE OR REPLACE FUNCTION public.atacado_clientes_inadimplentes(p_empresa_id uuid)
RETURNS TABLE(cliente_id uuid, razao_social text, nome_fantasia text, telefone text, total_atrasado numeric, qtd_boletos_atrasados bigint, dias_max_atraso integer, ultimo_contato timestamp with time zone, ultimo_tipo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    c.id, c.razao_social, c.nome_fantasia, c.telefone,
    SUM(pp.valor),
    COUNT(pp.id),
    MAX(CURRENT_DATE - pp.vencimento)::INT,
    (SELECT MAX(created_at) FROM atacado_cobrancas_historico WHERE cliente_id = c.id),
    (SELECT tipo FROM atacado_cobrancas_historico WHERE cliente_id = c.id ORDER BY created_at DESC LIMIT 1)
  FROM atacado_clientes c
  JOIN atacado_pedidos p ON p.cliente_id = c.id
  JOIN atacado_pedidos_pagamentos pp ON pp.pedido_id = p.id
  WHERE c.empresa_id = public.get_my_empresa_id()
    AND pp.status = 'atrasado'
    AND p.deleted_at IS NULL
    AND c.deleted_at IS NULL
  GROUP BY c.id, c.razao_social, c.nome_fantasia, c.telefone
  ORDER BY MAX(CURRENT_DATE - pp.vencimento) DESC;
$function$;

CREATE OR REPLACE FUNCTION public.atacado_ranking_produtos(p_empresa_id uuid, p_inicio date, p_fim date, p_limit integer DEFAULT 20)
RETURNS TABLE(modelo text, capacidade text, qtd_vendida bigint, faturamento numeric, qtd_pedidos bigint, preco_medio numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT i.modelo, i.capacidade, SUM(i.quantidade)::BIGINT, SUM(i.total_item),
    COUNT(DISTINCT p.id)::BIGINT, AVG(i.preco_unitario)
  FROM atacado_pedidos_itens i
  JOIN atacado_pedidos p ON p.id = i.pedido_id
  WHERE p.empresa_id = public.get_my_empresa_id() AND p.status IN ('faturado', 'entregue')
    AND p.created_at::DATE BETWEEN p_inicio AND p_fim AND p.deleted_at IS NULL
  GROUP BY i.modelo, i.capacidade
  ORDER BY SUM(i.total_item) DESC
  LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.atacado_top_clientes(p_empresa_id uuid, p_inicio date, p_fim date, p_limit integer DEFAULT 5)
RETURNS TABLE(cliente_id uuid, razao_social text, nome_fantasia text, qtd_pedidos bigint, faturamento numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    c.id, c.razao_social, c.nome_fantasia,
    COUNT(p.id), COALESCE(SUM(p.total), 0)
  FROM atacado_clientes c
  JOIN atacado_pedidos p ON p.cliente_id = c.id
  WHERE c.empresa_id = public.get_my_empresa_id()
    AND p.empresa_id = public.get_my_empresa_id()
    AND p.status IN ('faturado', 'entregue')
    AND p.created_at::DATE BETWEEN p_inicio AND p_fim
    AND p.deleted_at IS NULL
    AND c.deleted_at IS NULL
  GROUP BY c.id, c.razao_social, c.nome_fantasia
  ORDER BY COALESCE(SUM(p.total), 0) DESC
  LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.atacado_top_devedores(p_empresa_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE(cliente_id uuid, razao_social text, nome_fantasia text, cnpj text, total_devido numeric, qtd_titulos bigint, dias_atraso_max integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.razao_social, c.nome_fantasia, c.cnpj,
    SUM(pp.valor) AS total_devido,
    COUNT(pp.id) AS qtd_titulos,
    MAX(CURRENT_DATE - pp.vencimento)::INT AS dias_atraso_max
  FROM atacado_clientes c
  JOIN atacado_pedidos p ON p.cliente_id = c.id
  JOIN atacado_pedidos_pagamentos pp ON pp.pedido_id = p.id
  WHERE c.empresa_id = public.get_my_empresa_id()
    AND pp.status IN ('aberto','atrasado')
    AND pp.vencimento < CURRENT_DATE
    AND p.deleted_at IS NULL
    AND c.deleted_at IS NULL
  GROUP BY c.id, c.razao_social, c.nome_fantasia, c.cnpj
  ORDER BY total_devido DESC
  LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.combo_serie_diaria(p_empresa_id uuid, p_inicio date, p_fim date)
RETURNS TABLE(dia date, faturamento_loja numeric, faturamento_assist numeric, total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH dias AS (
    SELECT generate_series(p_inicio, p_fim, '1 day'::INTERVAL)::DATE AS dia
  ),
  loja AS (
    SELECT created_at::DATE AS dia, SUM(total) AS valor
    FROM loja_vendas
    WHERE empresa_id = public.get_my_empresa_id() AND status = 'pago' AND deleted_at IS NULL
      AND created_at::DATE BETWEEN p_inicio AND p_fim
    GROUP BY created_at::DATE
  ),
  assist AS (
    SELECT created_at::DATE AS dia, SUM(valor_total) AS valor
    FROM ordens_de_servico
    WHERE empresa_id = public.get_my_empresa_id() AND status = 'entregue'
      AND created_at::DATE BETWEEN p_inicio AND p_fim
    GROUP BY created_at::DATE
  )
  SELECT
    d.dia,
    COALESCE(l.valor, 0)::NUMERIC AS faturamento_loja,
    COALESCE(a.valor, 0)::NUMERIC AS faturamento_assist,
    (COALESCE(l.valor, 0) + COALESCE(a.valor, 0))::NUMERIC AS total
  FROM dias d
  LEFT JOIN loja l ON l.dia = d.dia
  LEFT JOIN assist a ON a.dia = d.dia
  ORDER BY d.dia;
$function$;

CREATE OR REPLACE FUNCTION public.loja_dashboard_kpis(p_empresa_id uuid, p_inicio date, p_fim date)
RETURNS TABLE(faturamento numeric, custo_total numeric, lucro_bruto numeric, vendas_qtd bigint, ticket_medio numeric, margem numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH vendas_periodo AS (
  SELECT v.id, v.total,
    (SELECT SUM(la.custo) FROM loja_vendas_itens li JOIN loja_aparelhos la ON la.id = li.aparelho_id WHERE li.venda_id = v.id) AS custo_venda
  FROM loja_vendas v
  WHERE v.empresa_id = public.get_my_empresa_id() AND v.status = 'pago'
    AND v.created_at::DATE BETWEEN p_inicio AND p_fim AND v.deleted_at IS NULL
)
SELECT COALESCE(SUM(total),0)::NUMERIC, COALESCE(SUM(custo_venda),0)::NUMERIC,
  COALESCE(SUM(total)-SUM(custo_venda),0)::NUMERIC, COUNT(*)::BIGINT,
  CASE WHEN COUNT(*)>0 THEN COALESCE(SUM(total)/COUNT(*),0) ELSE 0 END::NUMERIC,
  CASE WHEN SUM(total)>0 THEN ((SUM(total)-SUM(custo_venda))/SUM(total)*100) ELSE 0 END::NUMERIC
FROM vendas_periodo;
$function$;