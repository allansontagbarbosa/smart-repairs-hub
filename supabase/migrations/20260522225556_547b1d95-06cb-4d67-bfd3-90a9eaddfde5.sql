
-- 3.1 calcular_cashback_os
CREATE OR REPLACE FUNCTION public.calcular_cashback_os(p_ordem_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_os record; v_tipo_servico record; v_cliente_ativo record; v_taxa record; v_config record;
  v_cliente_id uuid; v_valor_centavos bigint := 0; v_valor_os_centavos bigint;
  v_descricao_calc text; v_decomp jsonb := '{}'::jsonb;
  v_custo_peca_centavos bigint; v_custo_op_centavos bigint;
  v_comissao_centavos bigint; v_lucro_centavos bigint;
BEGIN
  SELECT * INTO v_os FROM ordens_de_servico WHERE id = p_ordem_id;
  IF v_os.id IS NULL THEN RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'os_nao_encontrada'); END IF;
  v_cliente_id := v_os.lojista_id;
  IF v_cliente_id IS NULL THEN RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'os_sem_cliente_vinculado'); END IF;
  SELECT * INTO v_config FROM cashback_config WHERE empresa_id = v_os.empresa_id;
  IF v_config.id IS NULL OR NOT v_config.ativo THEN RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'cashback_desativado_empresa'); END IF;
  SELECT * INTO v_cliente_ativo FROM cashback_clientes WHERE cliente_id = v_cliente_id AND ativo;
  IF v_cliente_ativo.id IS NULL THEN RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'cliente_nao_ativado'); END IF;
  SELECT * INTO v_tipo_servico FROM tipos_servico WHERE id = v_os.tipo_servico_id;
  IF v_tipo_servico.id IS NULL OR v_tipo_servico.categoria IS NULL THEN RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'tipo_servico_sem_categoria'); END IF;
  SELECT * INTO v_taxa FROM cashback_taxas_categoria WHERE cliente_id = v_cliente_id AND categoria = v_tipo_servico.categoria AND ativa;
  IF v_taxa.id IS NULL THEN RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'categoria_nao_configurada', 'categoria', v_tipo_servico.categoria); END IF;
  v_valor_os_centavos := FLOOR(COALESCE(v_os.valor_total, v_os.valor, 0) * 100)::bigint;
  IF v_valor_os_centavos <= 0 THEN RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'os_sem_valor'); END IF;

  IF v_taxa.tipo_taxa = 'percentual' THEN
    v_valor_centavos := FLOOR((COALESCE(v_os.valor_total, v_os.valor, 0) * v_taxa.percentual / 100) * 100)::bigint;
    v_descricao_calc := format('Cashback %s%% · categoria %s', v_taxa.percentual, v_tipo_servico.categoria);
    v_decomp := jsonb_build_object('modo','percentual','valor_os_centavos',v_valor_os_centavos,'percentual',v_taxa.percentual,'cashback_centavos',v_valor_centavos);
  ELSIF v_taxa.tipo_taxa = 'valor_fixo' THEN
    IF v_valor_os_centavos < v_taxa.valor_fixo_centavos THEN
      RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'os_menor_que_valor_fixo', 'categoria', v_tipo_servico.categoria);
    END IF;
    v_valor_centavos := v_taxa.valor_fixo_centavos;
    v_descricao_calc := format('Cashback R$ %s fixo · categoria %s', (v_taxa.valor_fixo_centavos::numeric/100)::text, v_tipo_servico.categoria);
    v_decomp := jsonb_build_object('modo','valor_fixo','valor_os_centavos',v_valor_os_centavos,'valor_fixo_centavos',v_taxa.valor_fixo_centavos,'cashback_centavos',v_valor_centavos);
  ELSE
    v_custo_peca_centavos := FLOOR(COALESCE(v_os.custo_pecas, 0) * 100)::bigint;
    IF v_config.custo_operacional_modo = 'desabilitado' THEN v_custo_op_centavos := 0;
    ELSE v_custo_op_centavos := COALESCE(v_config.custo_operacional_por_os_centavos, 0); END IF;
    SELECT COALESCE(SUM(valor)*100, 0)::bigint INTO v_comissao_centavos FROM comissoes WHERE ordem_id = p_ordem_id AND estornada_em IS NULL;
    v_lucro_centavos := v_valor_os_centavos - v_custo_peca_centavos - v_custo_op_centavos - v_comissao_centavos;
    v_decomp := jsonb_build_object('modo','percentual_lucro','valor_os_centavos',v_valor_os_centavos,'custo_peca_centavos',v_custo_peca_centavos,'custo_operacional_centavos',v_custo_op_centavos,'comissao_centavos',v_comissao_centavos,'lucro_centavos',v_lucro_centavos,'percentual',v_taxa.percentual);
    IF v_lucro_centavos <= 0 THEN
      RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'lucro_negativo_ou_zero', 'categoria', v_tipo_servico.categoria, 'decomposicao', v_decomp);
    END IF;
    v_valor_centavos := FLOOR(v_lucro_centavos * v_taxa.percentual / 100)::bigint;
    v_descricao_calc := format('Cashback %s%% sobre lucro R$ %s · categoria %s', v_taxa.percentual, (v_lucro_centavos::numeric/100)::text, v_tipo_servico.categoria);
    v_decomp := v_decomp || jsonb_build_object('cashback_centavos', v_valor_centavos);
  END IF;

  RETURN jsonb_build_object(
    'valor_centavos', v_valor_centavos, 'tipo_taxa', v_taxa.tipo_taxa,
    'percentual_aplicado', v_taxa.percentual, 'valor_fixo_aplicado_centavos', v_taxa.valor_fixo_centavos,
    'categoria', v_tipo_servico.categoria, 'tipo_servico_nome', v_tipo_servico.nome,
    'cliente_id', v_cliente_id, 'empresa_id', v_os.empresa_id, 'taxa_id', v_taxa.id,
    'descricao', v_descricao_calc, 'decomposicao', v_decomp
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.calcular_cashback_os TO authenticated;

-- 3.2 creditar_cashback_os
CREATE OR REPLACE FUNCTION public.creditar_cashback_os(p_ordem_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_calc jsonb; v_valor bigint; v_cliente_id uuid; v_empresa_id uuid;
  v_descricao text; v_pct numeric; v_decomp jsonb;
  v_saldo_atual bigint; v_saldo_novo bigint; v_mov_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM cashback_movimentacoes WHERE ordem_id = p_ordem_id AND tipo = 'credito_os') THEN
    RETURN jsonb_build_object('sucesso', false, 'motivo', 'ja_creditado');
  END IF;
  v_calc := calcular_cashback_os(p_ordem_id);
  v_valor := (v_calc->>'valor_centavos')::bigint;
  IF v_valor <= 0 THEN RETURN jsonb_build_object('sucesso', false, 'motivo', v_calc->>'motivo'); END IF;
  v_cliente_id := (v_calc->>'cliente_id')::uuid;
  v_empresa_id := (v_calc->>'empresa_id')::uuid;
  v_pct := (v_calc->>'percentual_aplicado')::numeric;
  v_descricao := v_calc->>'descricao';
  v_decomp := v_calc->'decomposicao';
  INSERT INTO cashback_saldos (cliente_id, empresa_id, saldo_centavos) VALUES (v_cliente_id, v_empresa_id, 0) ON CONFLICT (cliente_id) DO NOTHING;
  SELECT saldo_centavos INTO v_saldo_atual FROM cashback_saldos WHERE cliente_id = v_cliente_id;
  v_saldo_novo := v_saldo_atual + v_valor;
  INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos, ordem_id, percentual_aplicado, descricao, calc_decomposicao)
  VALUES (v_cliente_id, v_empresa_id, 'credito_os', v_valor, v_saldo_novo, p_ordem_id, v_pct, v_descricao, v_decomp) RETURNING id INTO v_mov_id;
  UPDATE cashback_saldos SET saldo_centavos = v_saldo_novo, total_recebido_centavos = total_recebido_centavos + v_valor, ultima_movimentacao_em = now(), updated_at = now() WHERE cliente_id = v_cliente_id;
  RETURN jsonb_build_object('sucesso', true, 'movimentacao_id', v_mov_id, 'valor_centavos', v_valor, 'saldo_novo_centavos', v_saldo_novo);
END; $$;
GRANT EXECUTE ON FUNCTION public.creditar_cashback_os TO authenticated;

-- 3.3 aplicar_cashback_em_os
CREATE OR REPLACE FUNCTION public.aplicar_cashback_em_os(p_ordem_id uuid, p_valor_usar_centavos bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_os record; v_saldo record;
  v_cliente_id uuid; v_valor_os_centavos bigint; v_saldo_novo bigint; v_mov_id uuid;
BEGIN
  IF p_valor_usar_centavos <= 0 THEN RAISE EXCEPTION 'Valor a usar deve ser positivo'; END IF;
  SELECT * INTO v_os FROM ordens_de_servico WHERE id = p_ordem_id;
  IF v_os.id IS NULL THEN RAISE EXCEPTION 'OS não encontrada'; END IF;
  IF v_os.status IN ('entregue','cancelado') THEN RAISE EXCEPTION 'OS já entregue ou cancelada'; END IF;
  v_cliente_id := v_os.lojista_id;
  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'OS sem cliente vinculado'; END IF;
  SELECT * INTO v_saldo FROM cashback_saldos WHERE cliente_id = v_cliente_id;
  IF v_saldo.cliente_id IS NULL OR v_saldo.saldo_centavos = 0 THEN RAISE EXCEPTION 'Cliente sem saldo'; END IF;
  IF p_valor_usar_centavos > v_saldo.saldo_centavos THEN RAISE EXCEPTION 'Saldo insuficiente (R$ %)', v_saldo.saldo_centavos::numeric/100; END IF;
  v_valor_os_centavos := FLOOR(COALESCE(v_os.valor_total, v_os.valor, 0) * 100)::bigint;
  IF p_valor_usar_centavos > v_valor_os_centavos THEN RAISE EXCEPTION 'Valor maior que total da OS (R$ %)', v_valor_os_centavos::numeric/100; END IF;
  v_saldo_novo := v_saldo.saldo_centavos - p_valor_usar_centavos;
  INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos, ordem_id, descricao, created_by_user_id)
  VALUES (v_cliente_id, v_os.empresa_id, 'debito_uso_os', p_valor_usar_centavos, v_saldo_novo, p_ordem_id, format('Abate em OS #%s', v_os.numero), v_user_id) RETURNING id INTO v_mov_id;
  UPDATE cashback_saldos SET saldo_centavos = v_saldo_novo, total_usado_centavos = total_usado_centavos + p_valor_usar_centavos, ultima_movimentacao_em = now(), updated_at = now() WHERE cliente_id = v_cliente_id;
  UPDATE ordens_de_servico SET valor_total = valor_total - (p_valor_usar_centavos::numeric / 100),
         observacoes = COALESCE(observacoes, '') || E'\n[Cashback aplicado: -R$ ' || (p_valor_usar_centavos::numeric / 100)::text || ']'
   WHERE id = p_ordem_id;
  RETURN jsonb_build_object('sucesso', true, 'movimentacao_id', v_mov_id, 'valor_aplicado_centavos', p_valor_usar_centavos, 'saldo_novo_centavos', v_saldo_novo);
END; $$;
GRANT EXECUTE ON FUNCTION public.aplicar_cashback_em_os TO authenticated;

-- 3.4 cashback_ativar_cliente
CREATE OR REPLACE FUNCTION public.cashback_ativar_cliente(p_cliente_id uuid, p_ativar boolean DEFAULT true, p_observacoes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_cliente record; v_existente record;
BEGIN
  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id;
  IF v_cliente.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  SELECT * INTO v_existente FROM cashback_clientes WHERE cliente_id = p_cliente_id;
  IF v_existente.id IS NULL THEN
    INSERT INTO cashback_clientes (cliente_id, empresa_id, ativo, observacoes, ativado_por_user_id)
    VALUES (p_cliente_id, v_cliente.empresa_id, p_ativar, p_observacoes, v_user_id);
  ELSE
    UPDATE cashback_clientes SET ativo = p_ativar, observacoes = COALESCE(p_observacoes, observacoes),
      desativado_em = CASE WHEN p_ativar THEN NULL ELSE now() END, updated_at = now()
     WHERE cliente_id = p_cliente_id;
  END IF;
  INSERT INTO cashback_audit_log (empresa_id, cliente_id, acao, user_id)
  VALUES (v_cliente.empresa_id, p_cliente_id, CASE WHEN p_ativar THEN 'ativou_cliente' ELSE 'desativou_cliente' END, v_user_id);
  RETURN jsonb_build_object('sucesso', true, 'cliente_id', p_cliente_id, 'ativo', p_ativar);
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_ativar_cliente TO authenticated;

-- 3.5 cashback_set_taxa_categoria
CREATE OR REPLACE FUNCTION public.cashback_set_taxa_categoria(
  p_cliente_id uuid, p_categoria text, p_tipo_taxa text,
  p_percentual numeric DEFAULT NULL, p_valor_fixo_centavos bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_cliente record; v_existente record;
BEGIN
  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id;
  IF v_cliente.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  IF p_tipo_taxa NOT IN ('percentual','valor_fixo','percentual_lucro','remover') THEN RAISE EXCEPTION 'tipo_taxa inválido'; END IF;
  SELECT * INTO v_existente FROM cashback_taxas_categoria WHERE cliente_id = p_cliente_id AND categoria = p_categoria;
  IF p_tipo_taxa = 'remover' THEN
    IF v_existente.id IS NULL THEN RETURN jsonb_build_object('sucesso', true, 'acao', 'nada_a_remover'); END IF;
    DELETE FROM cashback_taxas_categoria WHERE cliente_id = p_cliente_id AND categoria = p_categoria;
    INSERT INTO cashback_audit_log (empresa_id, cliente_id, acao, categoria, tipo_taxa_anterior, valor_anterior, user_id)
    VALUES (v_cliente.empresa_id, p_cliente_id, 'removeu_taxa', p_categoria, v_existente.tipo_taxa,
            COALESCE(v_existente.percentual, v_existente.valor_fixo_centavos::numeric / 100), v_user_id);
    RETURN jsonb_build_object('sucesso', true, 'acao', 'removida');
  END IF;
  INSERT INTO cashback_clientes (cliente_id, empresa_id, ativo, ativado_por_user_id)
  VALUES (p_cliente_id, v_cliente.empresa_id, true, v_user_id)
  ON CONFLICT (cliente_id) DO UPDATE SET ativo = true, updated_at = now();
  IF p_tipo_taxa IN ('percentual','percentual_lucro') THEN
    IF p_percentual IS NULL OR p_percentual <= 0 OR p_percentual > 100 THEN RAISE EXCEPTION 'Percentual deve estar entre 0.01 e 100'; END IF;
    INSERT INTO cashback_taxas_categoria (cliente_id, empresa_id, categoria, tipo_taxa, percentual, valor_fixo_centavos)
    VALUES (p_cliente_id, v_cliente.empresa_id, p_categoria, p_tipo_taxa, p_percentual, NULL)
    ON CONFLICT (cliente_id, categoria) DO UPDATE SET tipo_taxa = EXCLUDED.tipo_taxa, percentual = EXCLUDED.percentual, valor_fixo_centavos = NULL, ativa = true, updated_at = now();
  ELSE
    IF p_valor_fixo_centavos IS NULL OR p_valor_fixo_centavos <= 0 THEN RAISE EXCEPTION 'Valor fixo deve ser positivo'; END IF;
    INSERT INTO cashback_taxas_categoria (cliente_id, empresa_id, categoria, tipo_taxa, percentual, valor_fixo_centavos)
    VALUES (p_cliente_id, v_cliente.empresa_id, p_categoria, 'valor_fixo', NULL, p_valor_fixo_centavos)
    ON CONFLICT (cliente_id, categoria) DO UPDATE SET tipo_taxa = 'valor_fixo', percentual = NULL, valor_fixo_centavos = EXCLUDED.valor_fixo_centavos, ativa = true, updated_at = now();
  END IF;
  INSERT INTO cashback_audit_log (empresa_id, cliente_id, acao, categoria, tipo_taxa_anterior, tipo_taxa_novo, valor_anterior, valor_novo, user_id)
  VALUES (v_cliente.empresa_id, p_cliente_id,
    CASE WHEN v_existente.id IS NULL THEN 'set_taxa' ELSE 'editou_taxa' END, p_categoria, v_existente.tipo_taxa, p_tipo_taxa,
    CASE WHEN v_existente.tipo_taxa = 'percentual' THEN v_existente.percentual
         WHEN v_existente.tipo_taxa = 'valor_fixo' THEN (v_existente.valor_fixo_centavos::numeric / 100)
         WHEN v_existente.tipo_taxa = 'percentual_lucro' THEN v_existente.percentual ELSE NULL END,
    CASE WHEN p_tipo_taxa IN ('percentual','percentual_lucro') THEN p_percentual ELSE (p_valor_fixo_centavos::numeric / 100) END, v_user_id);
  RETURN jsonb_build_object('sucesso', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_set_taxa_categoria TO authenticated;

-- 3.6 cashback_recalcular_custo_operacional
CREATE OR REPLACE FUNCTION public.cashback_recalcular_custo_operacional()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_empresa_id uuid;
  v_inicio_mes_anterior date; v_fim_mes_anterior date;
  v_custos_fixos numeric; v_qtd_os int; v_custo_por_os_centavos bigint; v_decomp jsonb;
BEGIN
  v_inicio_mes_anterior := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
  v_fim_mes_anterior := date_trunc('month', CURRENT_DATE)::date;
  FOR v_empresa_id IN SELECT empresa_id FROM cashback_config LOOP
    SELECT COALESCE(SUM(valor), 0) INTO v_custos_fixos FROM contas_a_pagar
     WHERE empresa_id = v_empresa_id AND deleted_at IS NULL
       AND data_vencimento >= v_inicio_mes_anterior AND data_vencimento < v_fim_mes_anterior
       AND COALESCE(categoria, '') NOT IN ('Comissões','Peças','Impostos','Prejuízos');
    SELECT COUNT(*) INTO v_qtd_os FROM ordens_de_servico
     WHERE empresa_id = v_empresa_id AND deleted_at IS NULL AND status IN ('pronto','entregue')
       AND data_conclusao >= v_inicio_mes_anterior AND data_conclusao < v_fim_mes_anterior;
    IF v_qtd_os > 0 THEN v_custo_por_os_centavos := FLOOR((v_custos_fixos * 100) / v_qtd_os)::bigint;
    ELSE v_custo_por_os_centavos := 0; END IF;
    v_decomp := jsonb_build_object('mes_referencia', to_char(v_inicio_mes_anterior, 'YYYY-MM'),
      'custos_fixos_centavos', (v_custos_fixos * 100)::bigint, 'qtd_os_concluidas', v_qtd_os,
      'custo_por_os_centavos', v_custo_por_os_centavos, 'calculado_em', now());
    UPDATE cashback_config SET
      custo_operacional_por_os_centavos = CASE WHEN custo_operacional_modo = 'manual' THEN custo_operacional_por_os_centavos ELSE v_custo_por_os_centavos END,
      custo_operacional_atualizado_em = now(), custo_operacional_atualizado_por_user_id = v_user_id,
      custo_operacional_calculo_decomposicao = v_decomp, updated_at = now()
     WHERE empresa_id = v_empresa_id;
  END LOOP;
  RETURN jsonb_build_object('sucesso', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_recalcular_custo_operacional TO authenticated;

-- 3.7 cashback_set_custo_operacional_manual
CREATE OR REPLACE FUNCTION public.cashback_set_custo_operacional_manual(p_valor_centavos bigint, p_modo text DEFAULT 'manual')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_empresa_id uuid;
BEGIN
  IF p_modo NOT IN ('manual','automatico','desabilitado') THEN RAISE EXCEPTION 'Modo inválido'; END IF;
  IF p_modo = 'manual' AND (p_valor_centavos IS NULL OR p_valor_centavos < 0) THEN RAISE EXCEPTION 'Valor deve ser >= 0'; END IF;
  SELECT empresa_id INTO v_empresa_id FROM user_profiles WHERE user_id = v_user_id LIMIT 1;
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa'; END IF;
  UPDATE cashback_config SET custo_operacional_modo = p_modo,
    custo_operacional_por_os_centavos = CASE WHEN p_modo = 'desabilitado' THEN 0 WHEN p_modo = 'manual' THEN p_valor_centavos ELSE custo_operacional_por_os_centavos END,
    custo_operacional_atualizado_em = now(), custo_operacional_atualizado_por_user_id = v_user_id, updated_at = now()
   WHERE empresa_id = v_empresa_id;
  INSERT INTO cashback_audit_log (empresa_id, acao, valor_novo, user_id, justificativa)
  VALUES (v_empresa_id, 'set_custo_operacional', (p_valor_centavos::numeric / 100), v_user_id, format('Modo=%s', p_modo));
  IF p_modo = 'automatico' THEN PERFORM cashback_recalcular_custo_operacional(); END IF;
  RETURN jsonb_build_object('sucesso', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_set_custo_operacional_manual TO authenticated;

-- 3.8 cashback_recalcular_credito_os
CREATE OR REPLACE FUNCTION public.cashback_recalcular_credito_os(p_ordem_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_credito_existente record; v_calc jsonb; v_valor_novo bigint; v_diferenca bigint; v_saldo_atual bigint; v_saldo_novo bigint;
BEGIN
  SELECT * INTO v_credito_existente FROM cashback_movimentacoes WHERE ordem_id = p_ordem_id AND tipo = 'credito_os' LIMIT 1;
  IF v_credito_existente.id IS NULL THEN RETURN jsonb_build_object('sucesso', false, 'motivo', 'sem_credito_original'); END IF;
  v_calc := calcular_cashback_os(p_ordem_id);
  v_valor_novo := (v_calc->>'valor_centavos')::bigint;
  v_diferenca := v_valor_novo - v_credito_existente.valor_centavos;
  IF v_diferenca = 0 THEN RETURN jsonb_build_object('sucesso', true, 'sem_mudanca', true); END IF;
  SELECT saldo_centavos INTO v_saldo_atual FROM cashback_saldos WHERE cliente_id = v_credito_existente.cliente_id;
  v_saldo_novo := v_saldo_atual + v_diferenca;
  IF v_saldo_novo < 0 THEN
    INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos, ordem_id, descricao, justificativa, calc_decomposicao)
    VALUES (v_credito_existente.cliente_id, v_credito_existente.empresa_id, 'debito_ajuste', ABS(v_diferenca), 0, p_ordem_id,
      'Recalculo retroativo (cliente ja usou saldo)', format('Diferenca R$ %s nao cobrada', (ABS(v_diferenca)::numeric/100)::text), v_calc->'decomposicao');
    UPDATE cashback_saldos SET saldo_centavos = 0, total_usado_centavos = total_usado_centavos + v_saldo_atual, ultima_movimentacao_em = now(), updated_at = now()
     WHERE cliente_id = v_credito_existente.cliente_id;
    RETURN jsonb_build_object('sucesso', true, 'parcial', true);
  END IF;
  INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos, ordem_id, descricao, calc_decomposicao)
  VALUES (v_credito_existente.cliente_id, v_credito_existente.empresa_id,
    CASE WHEN v_diferenca > 0 THEN 'credito_ajuste' ELSE 'debito_ajuste' END,
    ABS(v_diferenca), v_saldo_novo, p_ordem_id, 'Recalculo automático (custo/comissão da OS mudou)', v_calc->'decomposicao');
  UPDATE cashback_saldos SET saldo_centavos = v_saldo_novo,
    total_recebido_centavos = total_recebido_centavos + CASE WHEN v_diferenca > 0 THEN v_diferenca ELSE 0 END,
    total_usado_centavos = total_usado_centavos + CASE WHEN v_diferenca < 0 THEN ABS(v_diferenca) ELSE 0 END,
    ultima_movimentacao_em = now(), updated_at = now()
   WHERE cliente_id = v_credito_existente.cliente_id;
  RETURN jsonb_build_object('sucesso', true, 'diferenca_centavos', v_diferenca);
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_recalcular_credito_os TO authenticated;

-- 3.9 ajustar_cashback_cliente
CREATE OR REPLACE FUNCTION public.ajustar_cashback_cliente(p_cliente_id uuid, p_valor_centavos bigint, p_justificativa text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_cliente record; v_saldo record; v_saldo_novo bigint; v_tipo text;
BEGIN
  IF p_valor_centavos = 0 THEN RAISE EXCEPTION 'Valor não pode ser zero'; END IF;
  IF COALESCE(trim(p_justificativa), '') = '' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id;
  IF v_cliente.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  INSERT INTO cashback_saldos (cliente_id, empresa_id, saldo_centavos) VALUES (p_cliente_id, v_cliente.empresa_id, 0) ON CONFLICT (cliente_id) DO NOTHING;
  SELECT * INTO v_saldo FROM cashback_saldos WHERE cliente_id = p_cliente_id;
  v_saldo_novo := v_saldo.saldo_centavos + p_valor_centavos;
  IF v_saldo_novo < 0 THEN RAISE EXCEPTION 'Saldo ficaria negativo'; END IF;
  v_tipo := CASE WHEN p_valor_centavos > 0 THEN 'credito_ajuste' ELSE 'debito_ajuste' END;
  INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos, descricao, justificativa, created_by_user_id)
  VALUES (p_cliente_id, v_cliente.empresa_id, v_tipo, ABS(p_valor_centavos), v_saldo_novo, 'Ajuste manual', p_justificativa, v_user_id);
  UPDATE cashback_saldos SET saldo_centavos = v_saldo_novo,
    total_recebido_centavos = total_recebido_centavos + CASE WHEN p_valor_centavos > 0 THEN p_valor_centavos ELSE 0 END,
    total_usado_centavos = total_usado_centavos + CASE WHEN p_valor_centavos < 0 THEN ABS(p_valor_centavos) ELSE 0 END,
    ultima_movimentacao_em = now(), updated_at = now()
   WHERE cliente_id = p_cliente_id;
  RETURN jsonb_build_object('sucesso', true, 'saldo_novo_centavos', v_saldo_novo);
END; $$;
GRANT EXECUTE ON FUNCTION public.ajustar_cashback_cliente TO authenticated;

-- 3.10 cashback_get_cliente_config
CREATE OR REPLACE FUNCTION public.cashback_get_cliente_config(p_cliente_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cliente record; v_ativacao record; v_saldo record; v_categorias jsonb;
BEGIN
  SELECT c.*, g.nome AS grupo_nome INTO v_cliente FROM clientes c LEFT JOIN lojista_grupos g ON g.id = c.grupo_id WHERE c.id = p_cliente_id;
  IF v_cliente.id IS NULL THEN RETURN jsonb_build_object('erro', 'cliente_nao_encontrado'); END IF;
  SELECT * INTO v_ativacao FROM cashback_clientes WHERE cliente_id = p_cliente_id;
  SELECT jsonb_agg(jsonb_build_object('categoria', cat.categoria, 'qtd_tipos_servico', cat.qtd,
    'tem_taxa', t.id IS NOT NULL, 'tipo_taxa', t.tipo_taxa, 'percentual', t.percentual, 'valor_fixo_centavos', t.valor_fixo_centavos) ORDER BY cat.categoria)
    INTO v_categorias
    FROM (SELECT COALESCE(categoria, 'sem_categoria') AS categoria, COUNT(*) AS qtd FROM tipos_servico WHERE empresa_id = v_cliente.empresa_id AND ativo GROUP BY 1) cat
    LEFT JOIN cashback_taxas_categoria t ON t.cliente_id = p_cliente_id AND t.categoria = cat.categoria AND t.ativa;
  SELECT * INTO v_saldo FROM cashback_saldos WHERE cliente_id = p_cliente_id;
  RETURN jsonb_build_object(
    'cliente', jsonb_build_object('id', v_cliente.id, 'nome', v_cliente.nome, 'tipo_cliente', v_cliente.tipo_cliente, 'grupo_nome', v_cliente.grupo_nome),
    'ativacao', CASE WHEN v_ativacao.id IS NULL THEN jsonb_build_object('ativo', false, 'nunca_ativado', true) ELSE jsonb_build_object('ativo', v_ativacao.ativo, 'observacoes', v_ativacao.observacoes) END,
    'categorias', COALESCE(v_categorias, '[]'::jsonb),
    'saldo', jsonb_build_object('centavos', COALESCE(v_saldo.saldo_centavos, 0), 'total_recebido_centavos', COALESCE(v_saldo.total_recebido_centavos, 0), 'total_usado_centavos', COALESCE(v_saldo.total_usado_centavos, 0)));
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_get_cliente_config TO authenticated;

-- 3.11 get_cashback_empresa_dashboard
CREATE OR REPLACE FUNCTION public.get_cashback_empresa_dashboard()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_empresa_id uuid; v_config record;
  v_saldo_total bigint; v_creditado_mes bigint; v_usado_mes bigint; v_qtd_ativos int;
  v_clientes_ativos jsonb; v_movs_recentes jsonb;
  v_mes_inicio date := date_trunc('month', CURRENT_DATE);
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM user_profiles WHERE user_id = v_user_id LIMIT 1;
  IF v_empresa_id IS NULL THEN RETURN jsonb_build_object('erro', 'usuario_sem_empresa'); END IF;
  SELECT * INTO v_config FROM cashback_config WHERE empresa_id = v_empresa_id;
  SELECT COALESCE(SUM(saldo_centavos), 0) INTO v_saldo_total FROM cashback_saldos WHERE empresa_id = v_empresa_id;
  SELECT COALESCE(SUM(valor_centavos), 0) INTO v_creditado_mes FROM cashback_movimentacoes WHERE empresa_id = v_empresa_id AND tipo = 'credito_os' AND created_at >= v_mes_inicio;
  SELECT COALESCE(SUM(valor_centavos), 0) INTO v_usado_mes FROM cashback_movimentacoes WHERE empresa_id = v_empresa_id AND tipo = 'debito_uso_os' AND created_at >= v_mes_inicio;
  SELECT COUNT(*) INTO v_qtd_ativos FROM cashback_clientes WHERE empresa_id = v_empresa_id AND ativo;
  SELECT jsonb_agg(jsonb_build_object(
    'cliente_id', ca.cliente_id, 'nome', c.nome, 'tipo_cliente', c.tipo_cliente, 'grupo_nome', g.nome, 'ativo', ca.ativo,
    'saldo_centavos', COALESCE(s.saldo_centavos, 0),
    'qtd_categorias', (SELECT COUNT(*) FROM cashback_taxas_categoria WHERE cliente_id = ca.cliente_id AND ativa),
    'taxas_resumo', (SELECT string_agg(categoria || ' ' ||
        CASE WHEN tipo_taxa = 'percentual' THEN percentual::text || '%'
             WHEN tipo_taxa = 'valor_fixo' THEN 'R$' || (valor_fixo_centavos::numeric / 100)::text
             WHEN tipo_taxa = 'percentual_lucro' THEN percentual::text || '% lucro' END,
        ', ' ORDER BY categoria) FROM cashback_taxas_categoria WHERE cliente_id = ca.cliente_id AND ativa LIMIT 5)
  ) ORDER BY COALESCE(s.saldo_centavos, 0) DESC) INTO v_clientes_ativos
    FROM cashback_clientes ca
    JOIN clientes c ON c.id = ca.cliente_id
    LEFT JOIN lojista_grupos g ON g.id = c.grupo_id
    LEFT JOIN cashback_saldos s ON s.cliente_id = ca.cliente_id
   WHERE ca.empresa_id = v_empresa_id;
  SELECT jsonb_agg(jsonb_build_object('id', m.id, 'created_at', m.created_at, 'tipo', m.tipo,
    'cliente_nome', c.nome, 'valor_centavos', m.valor_centavos, 'saldo_apos_centavos', m.saldo_apos_centavos,
    'ordem_numero', os.numero, 'percentual_aplicado', m.percentual_aplicado, 'descricao', m.descricao,
    'calc_decomposicao', m.calc_decomposicao) ORDER BY m.created_at DESC) INTO v_movs_recentes
    FROM (SELECT * FROM cashback_movimentacoes WHERE empresa_id = v_empresa_id ORDER BY created_at DESC LIMIT 20) m
    JOIN clientes c ON c.id = m.cliente_id
    LEFT JOIN ordens_de_servico os ON os.id = m.ordem_id;
  RETURN jsonb_build_object('sucesso', true,
    'saldo_total_devido_centavos', v_saldo_total, 'qtd_clientes_ativos', v_qtd_ativos,
    'creditado_mes_centavos', v_creditado_mes, 'usado_mes_centavos', v_usado_mes,
    'clientes_ativos', COALESCE(v_clientes_ativos, '[]'::jsonb),
    'movimentacoes_recentes', COALESCE(v_movs_recentes, '[]'::jsonb),
    'custo_operacional', jsonb_build_object(
      'valor_centavos', COALESCE(v_config.custo_operacional_por_os_centavos, 0),
      'modo', COALESCE(v_config.custo_operacional_modo, 'automatico'),
      'atualizado_em', v_config.custo_operacional_atualizado_em,
      'decomposicao', v_config.custo_operacional_calculo_decomposicao));
END; $$;
GRANT EXECUTE ON FUNCTION public.get_cashback_empresa_dashboard TO authenticated;

-- 3.12 get_meu_cashback
CREATE OR REPLACE FUNCTION public.get_meu_cashback()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_cliente record; v_ativacao record; v_saldo record;
  v_taxas jsonb; v_extrato jsonb; v_recebido_mes bigint; v_usado_mes bigint;
  v_mes_inicio date := date_trunc('month', CURRENT_DATE);
BEGIN
  SELECT * INTO v_cliente FROM clientes WHERE user_id = v_user_id LIMIT 1;
  IF v_cliente.id IS NULL THEN RETURN jsonb_build_object('erro', 'cliente_nao_encontrado'); END IF;
  SELECT * INTO v_ativacao FROM cashback_clientes WHERE cliente_id = v_cliente.id;
  SELECT * INTO v_saldo FROM cashback_saldos WHERE cliente_id = v_cliente.id;
  SELECT jsonb_agg(jsonb_build_object('categoria', categoria, 'tipo_taxa', tipo_taxa,
    'percentual', percentual, 'valor_fixo_centavos', valor_fixo_centavos,
    'display', CASE WHEN tipo_taxa = 'percentual' THEN percentual::text || '%'
                    WHEN tipo_taxa = 'valor_fixo' THEN 'R$ ' || (valor_fixo_centavos::numeric/100)::text || ' fixo'
                    WHEN tipo_taxa = 'percentual_lucro' THEN percentual::text || '% do lucro' END
  ) ORDER BY categoria) INTO v_taxas FROM cashback_taxas_categoria WHERE cliente_id = v_cliente.id AND ativa;
  SELECT COALESCE(SUM(valor_centavos), 0) INTO v_recebido_mes FROM cashback_movimentacoes
   WHERE cliente_id = v_cliente.id AND tipo IN ('credito_os','credito_ajuste') AND created_at >= v_mes_inicio;
  SELECT COALESCE(SUM(valor_centavos), 0) INTO v_usado_mes FROM cashback_movimentacoes
   WHERE cliente_id = v_cliente.id AND tipo IN ('debito_uso_os','debito_ajuste','debito_estorno_os') AND created_at >= v_mes_inicio;
  SELECT jsonb_agg(jsonb_build_object('id', m.id, 'created_at', m.created_at, 'tipo', m.tipo,
    'valor_centavos', m.valor_centavos, 'saldo_apos_centavos', m.saldo_apos_centavos,
    'ordem_numero', os.numero, 'descricao', m.descricao,
    'percentual_aplicado', m.percentual_aplicado, 'calc_decomposicao', m.calc_decomposicao
  ) ORDER BY m.created_at DESC) INTO v_extrato
    FROM (SELECT * FROM cashback_movimentacoes WHERE cliente_id = v_cliente.id ORDER BY created_at DESC LIMIT 30) m
    LEFT JOIN ordens_de_servico os ON os.id = m.ordem_id;
  RETURN jsonb_build_object('cliente', jsonb_build_object('id', v_cliente.id, 'nome', v_cliente.nome),
    'ativo', COALESCE(v_ativacao.ativo, false), 'saldo_centavos', COALESCE(v_saldo.saldo_centavos, 0),
    'total_recebido_centavos', COALESCE(v_saldo.total_recebido_centavos, 0),
    'total_usado_centavos', COALESCE(v_saldo.total_usado_centavos, 0),
    'recebido_mes_centavos', v_recebido_mes, 'usado_mes_centavos', v_usado_mes,
    'taxas_por_categoria', COALESCE(v_taxas, '[]'::jsonb), 'extrato', COALESCE(v_extrato, '[]'::jsonb));
END; $$;
GRANT EXECUTE ON FUNCTION public.get_meu_cashback TO authenticated;

-- Inicializa custo operacional
SELECT cashback_recalcular_custo_operacional();
