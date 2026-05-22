-- Drop assinatura antiga conflitante
DROP FUNCTION IF EXISTS public.cashback_set_taxa_categoria(uuid, text, text, numeric, bigint);

-- PARTE 1: vigência temporal
ALTER TABLE public.cashback_taxas_categoria 
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_fim date,
  ADD COLUMN IF NOT EXISTS retroativo_aplicado_em timestamptz,
  ADD COLUMN IF NOT EXISTS retroativo_qtd_os int,
  ADD COLUMN IF NOT EXISTS retroativo_valor_total_centavos bigint;

ALTER TABLE public.cashback_taxas_categoria DROP CONSTRAINT IF EXISTS chk_vigencia;
ALTER TABLE public.cashback_taxas_categoria 
  ADD CONSTRAINT chk_vigencia CHECK (
    data_inicio IS NULL OR data_fim IS NULL OR data_fim >= data_inicio
  );

CREATE INDEX IF NOT EXISTS idx_cashback_taxas_vigencia 
  ON public.cashback_taxas_categoria(cliente_id, categoria, data_inicio, data_fim) 
  WHERE ativa;

-- 2.1 calcular_cashback_os
CREATE OR REPLACE FUNCTION public.calcular_cashback_os(p_ordem_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_os record; v_tipo_servico record; v_cliente_ativo record; v_taxa record; v_config record;
  v_cliente_id uuid; v_valor_centavos bigint := 0; v_valor_os_centavos bigint;
  v_descricao_calc text; v_decomp jsonb := '{}'::jsonb;
  v_custo_peca_centavos bigint; v_custo_op_centavos bigint;
  v_comissao_centavos bigint; v_lucro_centavos bigint; v_data_referencia date;
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
  IF v_tipo_servico.id IS NULL OR v_tipo_servico.categoria IS NULL THEN
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'tipo_servico_sem_categoria'); END IF;
  v_data_referencia := COALESCE(v_os.data_conclusao::date, CURRENT_DATE);
  SELECT * INTO v_taxa FROM cashback_taxas_categoria
   WHERE cliente_id = v_cliente_id AND categoria = v_tipo_servico.categoria AND ativa
     AND (data_inicio IS NULL OR data_inicio <= v_data_referencia)
     AND (data_fim IS NULL OR data_fim >= v_data_referencia);
  IF v_taxa.id IS NULL THEN
    IF EXISTS (SELECT 1 FROM cashback_taxas_categoria
       WHERE cliente_id = v_cliente_id AND categoria = v_tipo_servico.categoria AND ativa) THEN
      RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'fora_da_vigencia',
        'categoria', v_tipo_servico.categoria, 'data_referencia', v_data_referencia);
    END IF;
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'categoria_nao_configurada',
      'categoria', v_tipo_servico.categoria);
  END IF;
  v_valor_os_centavos := FLOOR(COALESCE(v_os.valor_total, v_os.valor, 0) * 100)::bigint;
  IF v_valor_os_centavos <= 0 THEN RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'os_sem_valor'); END IF;
  IF v_taxa.tipo_taxa = 'percentual' THEN
    v_valor_centavos := FLOOR((COALESCE(v_os.valor_total, v_os.valor, 0) * v_taxa.percentual / 100) * 100)::bigint;
    v_descricao_calc := format('Cashback %s%% · categoria %s', v_taxa.percentual, v_tipo_servico.categoria);
    v_decomp := jsonb_build_object('modo', 'percentual', 'valor_os_centavos', v_valor_os_centavos,
      'percentual', v_taxa.percentual, 'cashback_centavos', v_valor_centavos);
  ELSIF v_taxa.tipo_taxa = 'valor_fixo' THEN
    IF v_valor_os_centavos < v_taxa.valor_fixo_centavos THEN
      RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'os_menor_que_valor_fixo',
        'categoria', v_tipo_servico.categoria);
    END IF;
    v_valor_centavos := v_taxa.valor_fixo_centavos;
    v_descricao_calc := format('Cashback R$ %s fixo · categoria %s',
      (v_taxa.valor_fixo_centavos::numeric / 100)::text, v_tipo_servico.categoria);
    v_decomp := jsonb_build_object('modo', 'valor_fixo', 'valor_os_centavos', v_valor_os_centavos,
      'valor_fixo_centavos', v_taxa.valor_fixo_centavos, 'cashback_centavos', v_valor_centavos);
  ELSE
    v_custo_peca_centavos := FLOOR(COALESCE(v_os.custo_pecas, 0) * 100)::bigint;
    IF v_config.custo_operacional_modo = 'desabilitado' THEN v_custo_op_centavos := 0;
    ELSE v_custo_op_centavos := COALESCE(v_config.custo_operacional_por_os_centavos, 0); END IF;
    SELECT COALESCE(SUM(valor) * 100, 0)::bigint INTO v_comissao_centavos
      FROM comissoes WHERE ordem_id = p_ordem_id AND estornada_em IS NULL;
    v_lucro_centavos := v_valor_os_centavos - v_custo_peca_centavos - v_custo_op_centavos - v_comissao_centavos;
    v_decomp := jsonb_build_object('modo', 'percentual_lucro', 'valor_os_centavos', v_valor_os_centavos,
      'custo_peca_centavos', v_custo_peca_centavos, 'custo_operacional_centavos', v_custo_op_centavos,
      'comissao_centavos', v_comissao_centavos, 'lucro_centavos', v_lucro_centavos, 'percentual', v_taxa.percentual);
    IF v_lucro_centavos <= 0 THEN
      RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'lucro_negativo_ou_zero',
        'categoria', v_tipo_servico.categoria, 'decomposicao', v_decomp);
    END IF;
    v_valor_centavos := FLOOR(v_lucro_centavos * v_taxa.percentual / 100)::bigint;
    v_descricao_calc := format('Cashback %s%% sobre lucro R$ %s · categoria %s',
      v_taxa.percentual, (v_lucro_centavos::numeric/100)::text, v_tipo_servico.categoria);
    v_decomp := v_decomp || jsonb_build_object('cashback_centavos', v_valor_centavos);
  END IF;
  v_decomp := v_decomp || jsonb_build_object(
    'vigencia_data_inicio', v_taxa.data_inicio, 'vigencia_data_fim', v_taxa.data_fim);
  RETURN jsonb_build_object('valor_centavos', v_valor_centavos, 'tipo_taxa', v_taxa.tipo_taxa,
    'percentual_aplicado', v_taxa.percentual, 'valor_fixo_aplicado_centavos', v_taxa.valor_fixo_centavos,
    'categoria', v_tipo_servico.categoria, 'tipo_servico_nome', v_tipo_servico.nome,
    'cliente_id', v_cliente_id, 'empresa_id', v_os.empresa_id, 'taxa_id', v_taxa.id,
    'descricao', v_descricao_calc, 'decomposicao', v_decomp);
END; $$;
GRANT EXECUTE ON FUNCTION public.calcular_cashback_os TO authenticated;

CREATE OR REPLACE FUNCTION public.creditar_cashback_os(p_ordem_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_calc jsonb; v_valor bigint; v_cliente_id uuid; v_empresa_id uuid;
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
  INSERT INTO cashback_saldos (cliente_id, empresa_id, saldo_centavos)
  VALUES (v_cliente_id, v_empresa_id, 0) ON CONFLICT (cliente_id) DO NOTHING;
  SELECT saldo_centavos INTO v_saldo_atual FROM cashback_saldos WHERE cliente_id = v_cliente_id;
  v_saldo_novo := v_saldo_atual + v_valor;
  INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos,
    ordem_id, percentual_aplicado, descricao, calc_decomposicao)
  VALUES (v_cliente_id, v_empresa_id, 'credito_os', v_valor, v_saldo_novo,
    p_ordem_id, v_pct, v_descricao, v_decomp) RETURNING id INTO v_mov_id;
  UPDATE cashback_saldos SET saldo_centavos = v_saldo_novo,
    total_recebido_centavos = total_recebido_centavos + v_valor,
    ultima_movimentacao_em = now(), updated_at = now() WHERE cliente_id = v_cliente_id;
  RETURN jsonb_build_object('sucesso', true, 'movimentacao_id', v_mov_id,
    'valor_centavos', v_valor, 'saldo_novo_centavos', v_saldo_novo);
END; $$;
GRANT EXECUTE ON FUNCTION public.creditar_cashback_os TO authenticated;

CREATE OR REPLACE FUNCTION public.aplicar_cashback_em_os(p_ordem_id uuid, p_valor_usar_centavos bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_os record; v_saldo record;
  v_cliente_id uuid; v_valor_os_centavos bigint; v_saldo_novo bigint; v_mov_id uuid;
BEGIN
  IF p_valor_usar_centavos <= 0 THEN RAISE EXCEPTION 'Valor deve ser positivo'; END IF;
  SELECT * INTO v_os FROM ordens_de_servico WHERE id = p_ordem_id;
  IF v_os.id IS NULL THEN RAISE EXCEPTION 'OS não encontrada'; END IF;
  IF v_os.status IN ('entregue','cancelado') THEN RAISE EXCEPTION 'OS já entregue ou cancelada'; END IF;
  v_cliente_id := v_os.lojista_id;
  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'OS sem cliente vinculado'; END IF;
  SELECT * INTO v_saldo FROM cashback_saldos WHERE cliente_id = v_cliente_id;
  IF v_saldo.cliente_id IS NULL OR v_saldo.saldo_centavos = 0 THEN RAISE EXCEPTION 'Cliente sem saldo'; END IF;
  IF p_valor_usar_centavos > v_saldo.saldo_centavos THEN
    RAISE EXCEPTION 'Saldo insuficiente (R$ %)', v_saldo.saldo_centavos::numeric/100; END IF;
  v_valor_os_centavos := FLOOR(COALESCE(v_os.valor_total, v_os.valor, 0) * 100)::bigint;
  IF p_valor_usar_centavos > v_valor_os_centavos THEN RAISE EXCEPTION 'Valor maior que total da OS'; END IF;
  v_saldo_novo := v_saldo.saldo_centavos - p_valor_usar_centavos;
  INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos,
    ordem_id, descricao, created_by_user_id)
  VALUES (v_cliente_id, v_os.empresa_id, 'debito_uso_os', p_valor_usar_centavos, v_saldo_novo, p_ordem_id,
    format('Abate em OS #%s', v_os.numero), v_user_id) RETURNING id INTO v_mov_id;
  UPDATE cashback_saldos SET saldo_centavos = v_saldo_novo,
    total_usado_centavos = total_usado_centavos + p_valor_usar_centavos,
    ultima_movimentacao_em = now(), updated_at = now() WHERE cliente_id = v_cliente_id;
  UPDATE ordens_de_servico SET valor_total = valor_total - (p_valor_usar_centavos::numeric / 100),
    observacoes = COALESCE(observacoes, '') || E'\n[Cashback: -R$ ' ||
      (p_valor_usar_centavos::numeric / 100)::text || ']' WHERE id = p_ordem_id;
  RETURN jsonb_build_object('sucesso', true, 'movimentacao_id', v_mov_id, 'saldo_novo_centavos', v_saldo_novo);
END; $$;
GRANT EXECUTE ON FUNCTION public.aplicar_cashback_em_os TO authenticated;

CREATE OR REPLACE FUNCTION public.ajustar_cashback_cliente(p_cliente_id uuid, p_valor_centavos bigint, p_justificativa text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_cliente record; v_saldo record; v_saldo_novo bigint; v_tipo text;
BEGIN
  IF p_valor_centavos = 0 THEN RAISE EXCEPTION 'Valor não pode ser zero'; END IF;
  IF COALESCE(trim(p_justificativa), '') = '' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id;
  IF v_cliente.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  INSERT INTO cashback_saldos (cliente_id, empresa_id, saldo_centavos)
  VALUES (p_cliente_id, v_cliente.empresa_id, 0) ON CONFLICT (cliente_id) DO NOTHING;
  SELECT * INTO v_saldo FROM cashback_saldos WHERE cliente_id = p_cliente_id;
  v_saldo_novo := v_saldo.saldo_centavos + p_valor_centavos;
  IF v_saldo_novo < 0 THEN RAISE EXCEPTION 'Saldo ficaria negativo'; END IF;
  v_tipo := CASE WHEN p_valor_centavos > 0 THEN 'credito_ajuste' ELSE 'debito_ajuste' END;
  INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos,
    descricao, justificativa, created_by_user_id)
  VALUES (p_cliente_id, v_cliente.empresa_id, v_tipo, ABS(p_valor_centavos), v_saldo_novo,
    'Ajuste manual', p_justificativa, v_user_id);
  UPDATE cashback_saldos SET saldo_centavos = v_saldo_novo,
    total_recebido_centavos = total_recebido_centavos + CASE WHEN p_valor_centavos > 0 THEN p_valor_centavos ELSE 0 END,
    total_usado_centavos = total_usado_centavos + CASE WHEN p_valor_centavos < 0 THEN ABS(p_valor_centavos) ELSE 0 END,
    ultima_movimentacao_em = now(), updated_at = now() WHERE cliente_id = p_cliente_id;
  RETURN jsonb_build_object('sucesso', true, 'saldo_novo_centavos', v_saldo_novo);
END; $$;
GRANT EXECUTE ON FUNCTION public.ajustar_cashback_cliente TO authenticated;

CREATE OR REPLACE FUNCTION public.cashback_ativar_cliente(p_cliente_id uuid, p_ativar boolean DEFAULT true, p_observacoes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_cliente record;
BEGIN
  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id;
  IF v_cliente.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  INSERT INTO cashback_clientes (cliente_id, empresa_id, ativo, observacoes, ativado_por_user_id)
  VALUES (p_cliente_id, v_cliente.empresa_id, p_ativar, p_observacoes, v_user_id)
  ON CONFLICT (cliente_id) DO UPDATE
    SET ativo = EXCLUDED.ativo,
        observacoes = COALESCE(EXCLUDED.observacoes, cashback_clientes.observacoes),
        desativado_em = CASE WHEN EXCLUDED.ativo THEN NULL ELSE now() END,
        updated_at = now();
  INSERT INTO cashback_audit_log (empresa_id, cliente_id, acao, user_id)
  VALUES (v_cliente.empresa_id, p_cliente_id,
    CASE WHEN p_ativar THEN 'ativou_cliente' ELSE 'desativou_cliente' END, v_user_id);
  RETURN jsonb_build_object('sucesso', true, 'ativo', p_ativar);
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_ativar_cliente TO authenticated;

CREATE OR REPLACE FUNCTION public.cashback_set_taxa_categoria(
  p_cliente_id uuid, p_categoria text, p_tipo_taxa text,
  p_percentual numeric DEFAULT NULL, p_valor_fixo_centavos bigint DEFAULT NULL,
  p_data_inicio date DEFAULT NULL, p_data_fim date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_cliente record; v_existente record;
BEGIN
  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id;
  IF v_cliente.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  IF p_tipo_taxa NOT IN ('percentual','valor_fixo','percentual_lucro','remover') THEN
    RAISE EXCEPTION 'tipo_taxa inválido'; END IF;
  IF p_data_inicio IS NOT NULL AND p_data_fim IS NOT NULL AND p_data_fim < p_data_inicio THEN
    RAISE EXCEPTION 'data_fim (%) deve ser >= data_inicio (%)', p_data_fim, p_data_inicio; END IF;
  SELECT * INTO v_existente FROM cashback_taxas_categoria
    WHERE cliente_id = p_cliente_id AND categoria = p_categoria;
  IF p_tipo_taxa = 'remover' THEN
    IF v_existente.id IS NULL THEN RETURN jsonb_build_object('sucesso', true, 'acao', 'nada_a_remover'); END IF;
    DELETE FROM cashback_taxas_categoria WHERE cliente_id = p_cliente_id AND categoria = p_categoria;
    INSERT INTO cashback_audit_log (empresa_id, cliente_id, acao, categoria,
      tipo_taxa_anterior, valor_anterior, user_id)
    VALUES (v_cliente.empresa_id, p_cliente_id, 'removeu_taxa', p_categoria,
      v_existente.tipo_taxa,
      COALESCE(v_existente.percentual, v_existente.valor_fixo_centavos::numeric / 100), v_user_id);
    RETURN jsonb_build_object('sucesso', true, 'acao', 'removida');
  END IF;
  INSERT INTO cashback_clientes (cliente_id, empresa_id, ativo, ativado_por_user_id)
  VALUES (p_cliente_id, v_cliente.empresa_id, true, v_user_id)
  ON CONFLICT (cliente_id) DO UPDATE SET ativo = true, updated_at = now();
  IF p_tipo_taxa IN ('percentual','percentual_lucro') THEN
    IF p_percentual IS NULL OR p_percentual <= 0 OR p_percentual > 100 THEN
      RAISE EXCEPTION 'Percentual deve estar entre 0.01 e 100'; END IF;
    INSERT INTO cashback_taxas_categoria (cliente_id, empresa_id, categoria, tipo_taxa,
      percentual, valor_fixo_centavos, data_inicio, data_fim)
    VALUES (p_cliente_id, v_cliente.empresa_id, p_categoria, p_tipo_taxa,
      p_percentual, NULL, p_data_inicio, p_data_fim)
    ON CONFLICT (cliente_id, categoria) DO UPDATE
      SET tipo_taxa = EXCLUDED.tipo_taxa, percentual = EXCLUDED.percentual,
          valor_fixo_centavos = NULL, data_inicio = EXCLUDED.data_inicio,
          data_fim = EXCLUDED.data_fim, ativa = true, updated_at = now();
  ELSE
    IF p_valor_fixo_centavos IS NULL OR p_valor_fixo_centavos <= 0 THEN
      RAISE EXCEPTION 'Valor fixo deve ser positivo'; END IF;
    INSERT INTO cashback_taxas_categoria (cliente_id, empresa_id, categoria, tipo_taxa,
      percentual, valor_fixo_centavos, data_inicio, data_fim)
    VALUES (p_cliente_id, v_cliente.empresa_id, p_categoria, 'valor_fixo',
      NULL, p_valor_fixo_centavos, p_data_inicio, p_data_fim)
    ON CONFLICT (cliente_id, categoria) DO UPDATE
      SET tipo_taxa = 'valor_fixo', percentual = NULL,
          valor_fixo_centavos = EXCLUDED.valor_fixo_centavos,
          data_inicio = EXCLUDED.data_inicio, data_fim = EXCLUDED.data_fim,
          ativa = true, updated_at = now();
  END IF;
  INSERT INTO cashback_audit_log (empresa_id, cliente_id, acao, categoria,
    tipo_taxa_anterior, tipo_taxa_novo, valor_anterior, valor_novo, user_id, justificativa)
  VALUES (v_cliente.empresa_id, p_cliente_id,
    CASE WHEN v_existente.id IS NULL THEN 'set_taxa' ELSE 'editou_taxa' END,
    p_categoria, v_existente.tipo_taxa, p_tipo_taxa,
    CASE WHEN v_existente.tipo_taxa = 'percentual' THEN v_existente.percentual
         WHEN v_existente.tipo_taxa = 'valor_fixo' THEN (v_existente.valor_fixo_centavos::numeric / 100)
         WHEN v_existente.tipo_taxa = 'percentual_lucro' THEN v_existente.percentual ELSE NULL END,
    CASE WHEN p_tipo_taxa IN ('percentual','percentual_lucro') THEN p_percentual
         ELSE (p_valor_fixo_centavos::numeric / 100) END, v_user_id,
    CASE WHEN p_data_inicio IS NOT NULL OR p_data_fim IS NOT NULL
         THEN format('vigência: %s a %s', COALESCE(p_data_inicio::text,'∞'), COALESCE(p_data_fim::text,'∞'))
         ELSE NULL END);
  RETURN jsonb_build_object('sucesso', true,
    'acao', CASE WHEN v_existente.id IS NULL THEN 'criada' ELSE 'atualizada' END,
    'categoria', p_categoria, 'tipo_taxa', p_tipo_taxa,
    'data_inicio', p_data_inicio, 'data_fim', p_data_fim);
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_set_taxa_categoria TO authenticated;

CREATE OR REPLACE FUNCTION public.cashback_set_custo_operacional_manual(
  p_valor_centavos bigint, p_modo text DEFAULT 'manual')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_empresa_id uuid;
BEGIN
  IF p_modo NOT IN ('manual','automatico','desabilitado') THEN RAISE EXCEPTION 'Modo inválido'; END IF;
  IF p_modo = 'manual' AND (p_valor_centavos IS NULL OR p_valor_centavos < 0) THEN
    RAISE EXCEPTION 'Valor deve ser >= 0'; END IF;
  SELECT empresa_id INTO v_empresa_id FROM user_profiles WHERE user_id = v_user_id LIMIT 1;
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa'; END IF;
  UPDATE cashback_config
    SET custo_operacional_modo = p_modo,
        custo_operacional_por_os_centavos = CASE 
          WHEN p_modo = 'desabilitado' THEN 0
          WHEN p_modo = 'manual' THEN p_valor_centavos
          ELSE custo_operacional_por_os_centavos END,
        custo_operacional_atualizado_em = now(),
        custo_operacional_atualizado_por_user_id = v_user_id,
        updated_at = now() WHERE empresa_id = v_empresa_id;
  INSERT INTO cashback_audit_log (empresa_id, acao, valor_novo, user_id, justificativa)
  VALUES (v_empresa_id, 'set_custo_operacional', (p_valor_centavos::numeric / 100), v_user_id,
    format('Modo=%s', p_modo));
  IF p_modo = 'automatico' THEN PERFORM cashback_recalcular_custo_operacional(); END IF;
  RETURN jsonb_build_object('sucesso', true, 'modo', p_modo);
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_set_custo_operacional_manual TO authenticated;

CREATE OR REPLACE FUNCTION public.cashback_recalcular_credito_os(p_ordem_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_credito record; v_calc jsonb; v_valor_novo bigint; v_diferenca bigint;
  v_saldo_atual bigint; v_saldo_novo bigint;
BEGIN
  SELECT * INTO v_credito FROM cashback_movimentacoes
    WHERE ordem_id = p_ordem_id AND tipo = 'credito_os' LIMIT 1;
  IF v_credito.id IS NULL THEN RETURN jsonb_build_object('sucesso', false, 'motivo', 'sem_credito_original'); END IF;
  v_calc := calcular_cashback_os(p_ordem_id);
  v_valor_novo := (v_calc->>'valor_centavos')::bigint;
  v_diferenca := v_valor_novo - v_credito.valor_centavos;
  IF v_diferenca = 0 THEN RETURN jsonb_build_object('sucesso', true, 'sem_mudanca', true); END IF;
  SELECT saldo_centavos INTO v_saldo_atual FROM cashback_saldos WHERE cliente_id = v_credito.cliente_id;
  v_saldo_novo := v_saldo_atual + v_diferenca;
  IF v_saldo_novo < 0 THEN
    INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos,
      saldo_apos_centavos, ordem_id, descricao, justificativa, calc_decomposicao)
    VALUES (v_credito.cliente_id, v_credito.empresa_id, 'debito_ajuste',
      ABS(v_diferenca), 0, p_ordem_id, 'Recalculo (saldo ficaria negativo)',
      format('Diferenca R$ %s nao cobrada', (ABS(v_diferenca)::numeric/100)::text),
      v_calc->'decomposicao');
    UPDATE cashback_saldos SET saldo_centavos = 0,
      total_usado_centavos = total_usado_centavos + v_saldo_atual,
      ultima_movimentacao_em = now(), updated_at = now() WHERE cliente_id = v_credito.cliente_id;
    RETURN jsonb_build_object('sucesso', true, 'parcial', true);
  END IF;
  INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos,
    saldo_apos_centavos, ordem_id, descricao, calc_decomposicao)
  VALUES (v_credito.cliente_id, v_credito.empresa_id,
    CASE WHEN v_diferenca > 0 THEN 'credito_ajuste' ELSE 'debito_ajuste' END,
    ABS(v_diferenca), v_saldo_novo, p_ordem_id, 'Recalculo automático', v_calc->'decomposicao');
  UPDATE cashback_saldos SET saldo_centavos = v_saldo_novo,
    total_recebido_centavos = total_recebido_centavos + CASE WHEN v_diferenca > 0 THEN v_diferenca ELSE 0 END,
    total_usado_centavos = total_usado_centavos + CASE WHEN v_diferenca < 0 THEN ABS(v_diferenca) ELSE 0 END,
    ultima_movimentacao_em = now(), updated_at = now() WHERE cliente_id = v_credito.cliente_id;
  RETURN jsonb_build_object('sucesso', true, 'diferenca_centavos', v_diferenca);
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_recalcular_credito_os TO authenticated;

CREATE OR REPLACE FUNCTION public.cashback_get_cliente_config(p_cliente_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cliente record; v_ativacao record; v_saldo record; v_categorias jsonb;
BEGIN
  SELECT c.*, g.nome AS grupo_nome INTO v_cliente
    FROM clientes c LEFT JOIN lojista_grupos g ON g.id = c.grupo_id
    WHERE c.id = p_cliente_id;
  IF v_cliente.id IS NULL THEN RETURN jsonb_build_object('erro', 'cliente_nao_encontrado'); END IF;
  SELECT * INTO v_ativacao FROM cashback_clientes WHERE cliente_id = p_cliente_id;
  SELECT jsonb_agg(jsonb_build_object(
    'categoria', cat.categoria, 'qtd_tipos_servico', cat.qtd,
    'tem_taxa', t.id IS NOT NULL, 'tipo_taxa', t.tipo_taxa,
    'percentual', t.percentual, 'valor_fixo_centavos', t.valor_fixo_centavos,
    'data_inicio', t.data_inicio, 'data_fim', t.data_fim,
    'retroativo_aplicado_em', t.retroativo_aplicado_em,
    'retroativo_qtd_os', t.retroativo_qtd_os,
    'retroativo_valor_total_centavos', t.retroativo_valor_total_centavos
  ) ORDER BY cat.categoria) INTO v_categorias
  FROM (
    SELECT COALESCE(categoria, 'sem_categoria') AS categoria, COUNT(*) AS qtd
    FROM tipos_servico WHERE empresa_id = v_cliente.empresa_id AND ativo GROUP BY 1
  ) cat
  LEFT JOIN cashback_taxas_categoria t
    ON t.cliente_id = p_cliente_id AND t.categoria = cat.categoria AND t.ativa;
  SELECT * INTO v_saldo FROM cashback_saldos WHERE cliente_id = p_cliente_id;
  RETURN jsonb_build_object(
    'cliente', jsonb_build_object('id', v_cliente.id, 'nome', v_cliente.nome,
      'tipo_cliente', v_cliente.tipo_cliente, 'grupo_nome', v_cliente.grupo_nome),
    'ativacao', CASE WHEN v_ativacao.id IS NULL
      THEN jsonb_build_object('ativo', false, 'nunca_ativado', true)
      ELSE jsonb_build_object('ativo', v_ativacao.ativo, 'observacoes', v_ativacao.observacoes) END,
    'categorias', COALESCE(v_categorias, '[]'::jsonb),
    'saldo', jsonb_build_object(
      'centavos', COALESCE(v_saldo.saldo_centavos, 0),
      'total_recebido_centavos', COALESCE(v_saldo.total_recebido_centavos, 0),
      'total_usado_centavos', COALESCE(v_saldo.total_usado_centavos, 0)));
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_get_cliente_config TO authenticated;

CREATE OR REPLACE FUNCTION public.cashback_preview_retroativo(p_cliente_id uuid, p_categoria text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_taxa record;
  v_inicio_mes date := date_trunc('month', CURRENT_DATE)::date;
  v_fim_mes date := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date;
  v_data_inicio_efetiva date; v_data_fim_efetiva date;
  v_os record; v_calc jsonb;
  v_qtd_elegiveis int := 0; v_qtd_ja_creditadas int := 0; v_qtd_pulariam int := 0;
  v_valor_total bigint := 0; v_amostra jsonb := '[]'::jsonb; v_ja_credito_existe boolean;
BEGIN
  SELECT * INTO v_taxa FROM cashback_taxas_categoria
    WHERE cliente_id = p_cliente_id AND categoria = p_categoria AND ativa;
  IF v_taxa.id IS NULL THEN RETURN jsonb_build_object('erro', 'taxa_nao_configurada'); END IF;
  v_data_inicio_efetiva := GREATEST(COALESCE(v_taxa.data_inicio, v_inicio_mes), v_inicio_mes);
  v_data_fim_efetiva := LEAST(COALESCE(v_taxa.data_fim, v_fim_mes), v_fim_mes);
  FOR v_os IN
    SELECT o.id, o.numero, o.valor_total, o.data_conclusao
      FROM ordens_de_servico o
      JOIN tipos_servico ts ON ts.id = o.tipo_servico_id
     WHERE o.lojista_id = p_cliente_id AND ts.categoria = p_categoria
       AND o.status IN ('pronto','entregue')
       AND o.data_conclusao::date >= v_data_inicio_efetiva
       AND o.data_conclusao::date <= v_data_fim_efetiva
       AND o.deleted_at IS NULL
  LOOP
    SELECT EXISTS (SELECT 1 FROM cashback_movimentacoes
      WHERE ordem_id = v_os.id AND tipo = 'credito_os') INTO v_ja_credito_existe;
    IF v_ja_credito_existe THEN
      v_qtd_ja_creditadas := v_qtd_ja_creditadas + 1;
    ELSE
      v_calc := calcular_cashback_os(v_os.id);
      IF (v_calc->>'valor_centavos')::bigint > 0 THEN
        v_qtd_elegiveis := v_qtd_elegiveis + 1;
        v_valor_total := v_valor_total + (v_calc->>'valor_centavos')::bigint;
        IF v_qtd_elegiveis <= 5 THEN
          v_amostra := v_amostra || jsonb_build_object(
            'numero', v_os.numero, 'data_conclusao', v_os.data_conclusao,
            'valor_total', v_os.valor_total,
            'cashback_centavos', (v_calc->>'valor_centavos')::bigint);
        END IF;
      ELSE v_qtd_pulariam := v_qtd_pulariam + 1; END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('sucesso', true, 'cliente_id', p_cliente_id, 'categoria', p_categoria,
    'data_inicio_efetiva', v_data_inicio_efetiva, 'data_fim_efetiva', v_data_fim_efetiva,
    'qtd_os_elegiveis', v_qtd_elegiveis, 'qtd_os_ja_creditadas', v_qtd_ja_creditadas,
    'qtd_os_que_pulariam', v_qtd_pulariam, 'valor_total_centavos', v_valor_total,
    'amostra_primeiras_5', v_amostra);
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_preview_retroativo TO authenticated;

CREATE OR REPLACE FUNCTION public.cashback_aplicar_retroativo(
  p_cliente_id uuid, p_categoria text, p_confirmacao boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_taxa record;
  v_inicio_mes date := date_trunc('month', CURRENT_DATE)::date;
  v_fim_mes date := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date;
  v_data_inicio_efetiva date; v_data_fim_efetiva date;
  v_os record; v_credito_resultado jsonb;
  v_qtd_creditadas int := 0; v_valor_total bigint := 0;
BEGIN
  IF NOT p_confirmacao THEN
    RAISE EXCEPTION 'Confirmacao obrigatoria. Chame cashback_preview_retroativo primeiro e passe p_confirmacao=true';
  END IF;
  SELECT * INTO v_taxa FROM cashback_taxas_categoria
    WHERE cliente_id = p_cliente_id AND categoria = p_categoria AND ativa;
  IF v_taxa.id IS NULL THEN RAISE EXCEPTION 'Taxa nao configurada'; END IF;
  v_data_inicio_efetiva := GREATEST(COALESCE(v_taxa.data_inicio, v_inicio_mes), v_inicio_mes);
  v_data_fim_efetiva := LEAST(COALESCE(v_taxa.data_fim, v_fim_mes), v_fim_mes);
  FOR v_os IN
    SELECT o.id FROM ordens_de_servico o
      JOIN tipos_servico ts ON ts.id = o.tipo_servico_id
     WHERE o.lojista_id = p_cliente_id AND ts.categoria = p_categoria
       AND o.status IN ('pronto','entregue')
       AND o.data_conclusao::date >= v_data_inicio_efetiva
       AND o.data_conclusao::date <= v_data_fim_efetiva
       AND o.deleted_at IS NULL
  LOOP
    v_credito_resultado := creditar_cashback_os(v_os.id);
    IF (v_credito_resultado->>'sucesso')::boolean THEN
      v_qtd_creditadas := v_qtd_creditadas + 1;
      v_valor_total := v_valor_total + (v_credito_resultado->>'valor_centavos')::bigint;
    END IF;
  END LOOP;
  UPDATE cashback_taxas_categoria SET retroativo_aplicado_em = now(),
    retroativo_qtd_os = v_qtd_creditadas, retroativo_valor_total_centavos = v_valor_total
    WHERE id = v_taxa.id;
  INSERT INTO cashback_audit_log (empresa_id, cliente_id, acao, categoria,
    valor_novo, user_id, justificativa)
  VALUES ((SELECT empresa_id FROM clientes WHERE id = p_cliente_id), p_cliente_id,
    'aplicou_retroativo', p_categoria, v_valor_total::numeric / 100, v_user_id,
    format('Retroativo aplicado: %s OS, R$ %s, periodo %s a %s',
      v_qtd_creditadas, (v_valor_total::numeric/100)::text,
      v_data_inicio_efetiva, v_data_fim_efetiva));
  RETURN jsonb_build_object('sucesso', true, 'qtd_os_creditadas', v_qtd_creditadas,
    'valor_total_centavos', v_valor_total,
    'periodo_inicio', v_data_inicio_efetiva, 'periodo_fim', v_data_fim_efetiva);
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_aplicar_retroativo TO authenticated;

-- TRIGGERS
CREATE OR REPLACE FUNCTION public.trg_bloquear_os_lucro_negativo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_calc jsonb; v_taxa_lucro_existe boolean; v_tipo_servico_cat text;
BEGIN
  IF NEW.status != 'pronto' OR (OLD.status IS NOT NULL AND OLD.status = 'pronto') THEN RETURN NEW; END IF;
  IF NEW.lojista_id IS NULL THEN RETURN NEW; END IF;
  BEGIN
    SELECT EXISTS (SELECT 1 FROM cashback_taxas_categoria
       WHERE cliente_id = NEW.lojista_id AND tipo_taxa = 'percentual_lucro' AND ativa
    ) INTO v_taxa_lucro_existe;
    IF NOT v_taxa_lucro_existe THEN RETURN NEW; END IF;
    SELECT categoria INTO v_tipo_servico_cat FROM tipos_servico WHERE id = NEW.tipo_servico_id;
    IF v_tipo_servico_cat IS NULL THEN RETURN NEW; END IF;
    IF NOT EXISTS (SELECT 1 FROM cashback_taxas_categoria
       WHERE cliente_id = NEW.lojista_id AND categoria = v_tipo_servico_cat
         AND tipo_taxa = 'percentual_lucro' AND ativa) THEN RETURN NEW; END IF;
    v_calc := calcular_cashback_os(NEW.id);
    IF v_calc->>'motivo' = 'lucro_negativo_ou_zero' THEN
      RAISE EXCEPTION 'OS bloqueada: lucro negativo. Decomposicao: %', v_calc->'decomposicao'
        USING ERRCODE = 'check_violation';
    END IF;
  EXCEPTION 
    WHEN check_violation THEN RAISE;
    WHEN OTHERS THEN RAISE WARNING 'trg_bloquear falhou OS %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_os_bloquear_lucro_negativo ON public.ordens_de_servico;
CREATE TRIGGER trg_os_bloquear_lucro_negativo
  BEFORE UPDATE OF status ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_bloquear_os_lucro_negativo();

CREATE OR REPLACE FUNCTION public.trg_creditar_cashback_on_pronto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pronto' AND (OLD.status IS NULL OR OLD.status != 'pronto') THEN
    BEGIN PERFORM creditar_cashback_os(NEW.id);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'creditar falhou OS %: %', NEW.id, SQLERRM; END;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_os_creditar_cashback ON public.ordens_de_servico;
CREATE TRIGGER trg_os_creditar_cashback
  AFTER UPDATE OF status ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_creditar_cashback_on_pronto();

CREATE OR REPLACE FUNCTION public.trg_estornar_cashback_on_cancelada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_credito record; v_saldo bigint; v_saldo_novo bigint;
BEGIN
  IF NEW.status = 'cancelado' AND (OLD.status IS NULL OR OLD.status != 'cancelado') THEN
    BEGIN
      SELECT * INTO v_credito FROM cashback_movimentacoes
        WHERE ordem_id = NEW.id AND tipo = 'credito_os' LIMIT 1;
      IF v_credito.id IS NOT NULL THEN
        SELECT saldo_centavos INTO v_saldo FROM cashback_saldos WHERE cliente_id = v_credito.cliente_id;
        v_saldo_novo := GREATEST(v_saldo - v_credito.valor_centavos, 0);
        INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos,
          saldo_apos_centavos, ordem_id, descricao)
        VALUES (v_credito.cliente_id, v_credito.empresa_id, 'debito_estorno_os',
          v_saldo - v_saldo_novo, v_saldo_novo, NEW.id, 'Estorno automático (OS cancelada)');
        UPDATE cashback_saldos SET saldo_centavos = v_saldo_novo,
          ultima_movimentacao_em = now(), updated_at = now()
          WHERE cliente_id = v_credito.cliente_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Estorno falhou OS %: %', NEW.id, SQLERRM; END;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_os_estornar_cashback ON public.ordens_de_servico;
CREATE TRIGGER trg_os_estornar_cashback
  AFTER UPDATE OF status ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_estornar_cashback_on_cancelada();

CREATE OR REPLACE FUNCTION public.trg_recalcular_cashback_on_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.custo_pecas IS DISTINCT FROM NEW.custo_pecas 
     OR OLD.valor_total IS DISTINCT FROM NEW.valor_total THEN
    BEGIN
      IF EXISTS (SELECT 1 FROM cashback_movimentacoes WHERE ordem_id = NEW.id AND tipo = 'credito_os') THEN
        PERFORM cashback_recalcular_credito_os(NEW.id);
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Recalculo falhou: %', SQLERRM; END;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_os_recalcular_cashback ON public.ordens_de_servico;
CREATE TRIGGER trg_os_recalcular_cashback
  AFTER UPDATE OF custo_pecas, valor_total ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_cashback_on_change();

CREATE OR REPLACE FUNCTION public.trg_recalcular_cashback_on_comissao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ordem_id uuid;
BEGIN
  v_ordem_id := COALESCE(NEW.ordem_id, OLD.ordem_id);
  IF v_ordem_id IS NOT NULL THEN
    BEGIN
      IF EXISTS (SELECT 1 FROM cashback_movimentacoes WHERE ordem_id = v_ordem_id AND tipo = 'credito_os') THEN
        PERFORM cashback_recalcular_credito_os(v_ordem_id);
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Recalculo comissao falhou: %', SQLERRM; END;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS trg_comissao_recalcular_cashback ON public.comissoes;
CREATE TRIGGER trg_comissao_recalcular_cashback
  AFTER INSERT OR UPDATE OR DELETE ON public.comissoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_cashback_on_comissao();