CREATE OR REPLACE FUNCTION public.calcular_cashback_os(p_ordem_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os record;
  v_tipo_servico record;
  v_cliente_ativo record;
  v_taxa record;
  v_cliente_id uuid;
  v_valor_centavos bigint := 0;
  v_valor_os_centavos bigint;
  v_descricao_calc text;
BEGIN
  SELECT * INTO v_os FROM ordens_de_servico WHERE id = p_ordem_id;
  IF v_os.id IS NULL THEN
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'os_nao_encontrada');
  END IF;

  v_cliente_id := v_os.lojista_id;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'os_sem_cliente_vinculado');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cashback_config WHERE empresa_id = v_os.empresa_id AND ativo) THEN
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'cashback_desativado_empresa');
  END IF;

  SELECT * INTO v_cliente_ativo FROM cashback_clientes
   WHERE cliente_id = v_cliente_id AND ativo;

  IF v_cliente_ativo.id IS NULL THEN
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'cliente_nao_ativado');
  END IF;

  SELECT * INTO v_tipo_servico FROM tipos_servico WHERE id = v_os.tipo_servico_id;
  IF v_tipo_servico.id IS NULL OR v_tipo_servico.categoria IS NULL THEN
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'tipo_servico_sem_categoria');
  END IF;

  SELECT * INTO v_taxa FROM cashback_taxas_categoria
   WHERE cliente_id = v_cliente_id
     AND categoria = v_tipo_servico.categoria
     AND ativa;

  IF v_taxa.id IS NULL THEN
    RETURN jsonb_build_object('valor_centavos', 0,
      'motivo', 'categoria_nao_configurada',
      'categoria', v_tipo_servico.categoria);
  END IF;

  v_valor_os_centavos := FLOOR(COALESCE(v_os.valor_total, v_os.valor, 0) * 100)::bigint;
  IF v_valor_os_centavos <= 0 THEN
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'os_sem_valor');
  END IF;

  IF v_taxa.tipo_taxa = 'percentual' THEN
    v_valor_centavos := FLOOR((COALESCE(v_os.valor_total, v_os.valor, 0) * v_taxa.percentual / 100) * 100)::bigint;
    v_descricao_calc := format('Cashback %s%% · categoria %s', v_taxa.percentual, v_tipo_servico.categoria);
  ELSE
    IF v_valor_os_centavos < v_taxa.valor_fixo_centavos THEN
      RETURN jsonb_build_object('valor_centavos', 0,
        'motivo', 'os_menor_que_valor_fixo',
        'categoria', v_tipo_servico.categoria,
        'valor_os_centavos', v_valor_os_centavos,
        'valor_fixo_centavos', v_taxa.valor_fixo_centavos);
    END IF;
    v_valor_centavos := v_taxa.valor_fixo_centavos;
    v_descricao_calc := format('Cashback R$ %s fixo · categoria %s',
                                (v_taxa.valor_fixo_centavos::numeric / 100)::text, v_tipo_servico.categoria);
  END IF;

  RETURN jsonb_build_object(
    'valor_centavos', v_valor_centavos,
    'tipo_taxa', v_taxa.tipo_taxa,
    'percentual_aplicado', v_taxa.percentual,
    'valor_fixo_aplicado_centavos', v_taxa.valor_fixo_centavos,
    'categoria', v_tipo_servico.categoria,
    'tipo_servico_nome', v_tipo_servico.nome,
    'cliente_id', v_cliente_id,
    'empresa_id', v_os.empresa_id,
    'taxa_id', v_taxa.id,
    'descricao', v_descricao_calc
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.aplicar_cashback_em_os(
  p_ordem_id uuid,
  p_valor_usar_centavos bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_os record;
  v_saldo record;
  v_cliente_id uuid;
  v_valor_os_centavos bigint;
  v_saldo_novo bigint;
  v_mov_id uuid;
BEGIN
  IF p_valor_usar_centavos <= 0 THEN
    RAISE EXCEPTION 'Valor a usar deve ser positivo';
  END IF;

  SELECT * INTO v_os FROM ordens_de_servico WHERE id = p_ordem_id;
  IF v_os.id IS NULL THEN RAISE EXCEPTION 'OS não encontrada'; END IF;
  IF v_os.status IN ('entregue','cancelada') THEN
    RAISE EXCEPTION 'OS já entregue/cancelada';
  END IF;

  v_cliente_id := v_os.lojista_id;
  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'OS sem cliente vinculado';
  END IF;

  SELECT * INTO v_saldo FROM cashback_saldos WHERE cliente_id = v_cliente_id;
  IF v_saldo.cliente_id IS NULL OR v_saldo.saldo_centavos = 0 THEN
    RAISE EXCEPTION 'Cliente sem saldo';
  END IF;

  IF p_valor_usar_centavos > v_saldo.saldo_centavos THEN
    RAISE EXCEPTION 'Saldo insuficiente (R$ %)', v_saldo.saldo_centavos::numeric/100;
  END IF;

  v_valor_os_centavos := FLOOR(COALESCE(v_os.valor_total, v_os.valor, 0) * 100)::bigint;
  IF p_valor_usar_centavos > v_valor_os_centavos THEN
    RAISE EXCEPTION 'Valor maior que total da OS (R$ %)', v_valor_os_centavos::numeric/100;
  END IF;

  v_saldo_novo := v_saldo.saldo_centavos - p_valor_usar_centavos;

  INSERT INTO cashback_movimentacoes (
    cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos,
    ordem_id, descricao, created_by_user_id
  ) VALUES (
    v_cliente_id, v_os.empresa_id, 'debito_uso_os',
    p_valor_usar_centavos, v_saldo_novo, p_ordem_id,
    format('Abate em OS #%s', v_os.numero), v_user_id
  ) RETURNING id INTO v_mov_id;

  UPDATE cashback_saldos
     SET saldo_centavos = v_saldo_novo,
         total_usado_centavos = total_usado_centavos + p_valor_usar_centavos,
         ultima_movimentacao_em = now(),
         updated_at = now()
   WHERE cliente_id = v_cliente_id;

  UPDATE ordens_de_servico
     SET valor_total = valor_total - (p_valor_usar_centavos::numeric / 100),
         observacoes = COALESCE(observacoes, '') || E'\n[Cashback aplicado: -R$ ' ||
                       (p_valor_usar_centavos::numeric / 100)::text || ']'
   WHERE id = p_ordem_id;

  RETURN jsonb_build_object('sucesso', true, 'movimentacao_id', v_mov_id,
                            'valor_aplicado_centavos', p_valor_usar_centavos,
                            'saldo_novo_centavos', v_saldo_novo);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_creditar_cashback_on_pronto()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pronto' AND (OLD.status IS NULL OR OLD.status != 'pronto') THEN
    BEGIN
      PERFORM creditar_cashback_os(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Cashback falhou pra OS %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_estornar_cashback_on_cancelada()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_credito record;
  v_saldo bigint;
  v_saldo_novo bigint;
BEGIN
  IF NEW.status = 'cancelada' AND (OLD.status IS NULL OR OLD.status != 'cancelada') THEN
    BEGIN
      SELECT * INTO v_credito FROM cashback_movimentacoes
       WHERE ordem_id = NEW.id AND tipo = 'credito_os' LIMIT 1;
      IF v_credito.id IS NOT NULL THEN
        SELECT saldo_centavos INTO v_saldo FROM cashback_saldos WHERE cliente_id = v_credito.cliente_id;
        v_saldo_novo := GREATEST(v_saldo - v_credito.valor_centavos, 0);

        INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos,
                                            saldo_apos_centavos, ordem_id, descricao)
        VALUES (v_credito.cliente_id, v_credito.empresa_id, 'debito_estorno_os',
                v_saldo - v_saldo_novo, v_saldo_novo, NEW.id,
                'Estorno automático (OS cancelada)');

        UPDATE cashback_saldos
           SET saldo_centavos = v_saldo_novo,
               ultima_movimentacao_em = now(), updated_at = now()
         WHERE cliente_id = v_credito.cliente_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Estorno cashback falhou pra OS %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cashback_recalcular_retroativo(
  p_cliente_id uuid,
  p_categoria text,
  p_mes_inicio text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_data_ini date;
  v_data_fim date;
  v_os record;
  v_calc jsonb;
  v_credito_existente record;
  v_valor_novo bigint;
  v_diferenca bigint;
  v_saldo_atual bigint;
  v_saldo_novo bigint;
  v_qtd_ajustadas int := 0;
  v_total_ajuste bigint := 0;
BEGIN
  v_data_ini := (p_mes_inicio || '-01')::date;
  v_data_fim := v_data_ini + INTERVAL '1 month';

  FOR v_os IN
    SELECT o.id AS ordem_id, o.numero, o.valor_total, o.data_conclusao
      FROM ordens_de_servico o
      JOIN tipos_servico ts ON ts.id = o.tipo_servico_id
     WHERE o.lojista_id = p_cliente_id
       AND ts.categoria = p_categoria
       AND o.status IN ('pronto','entregue')
       AND o.data_conclusao >= v_data_ini
       AND o.data_conclusao < v_data_fim
       AND o.deleted_at IS NULL
  LOOP
    v_calc := calcular_cashback_os(v_os.ordem_id);
    v_valor_novo := (v_calc->>'valor_centavos')::bigint;

    SELECT * INTO v_credito_existente FROM cashback_movimentacoes
     WHERE ordem_id = v_os.ordem_id AND tipo = 'credito_os';

    IF v_credito_existente.id IS NULL THEN
      IF v_valor_novo > 0 THEN
        SELECT saldo_centavos INTO v_saldo_atual FROM cashback_saldos WHERE cliente_id = p_cliente_id;
        v_saldo_novo := COALESCE(v_saldo_atual, 0) + v_valor_novo;

        INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos,
                                            saldo_apos_centavos, ordem_id, descricao, justificativa, created_by_user_id)
        VALUES (p_cliente_id, (SELECT empresa_id FROM clientes WHERE id = p_cliente_id),
                'credito_os', v_valor_novo, v_saldo_novo, v_os.ordem_id,
                v_calc->>'descricao',
                format('Recalculo retroativo %s · categoria %s', p_mes_inicio, p_categoria),
                v_user_id);

        UPDATE cashback_saldos
           SET saldo_centavos = v_saldo_novo,
               total_recebido_centavos = total_recebido_centavos + v_valor_novo,
               ultima_movimentacao_em = now(), updated_at = now()
         WHERE cliente_id = p_cliente_id;

        v_qtd_ajustadas := v_qtd_ajustadas + 1;
        v_total_ajuste := v_total_ajuste + v_valor_novo;
      END IF;
    ELSE
      v_diferenca := v_valor_novo - v_credito_existente.valor_centavos;
      IF v_diferenca != 0 THEN
        SELECT saldo_centavos INTO v_saldo_atual FROM cashback_saldos WHERE cliente_id = p_cliente_id;
        v_saldo_novo := v_saldo_atual + v_diferenca;

        IF v_saldo_novo < 0 THEN
          CONTINUE;
        END IF;

        INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos,
                                            saldo_apos_centavos, ordem_id, descricao, created_by_user_id)
        VALUES (p_cliente_id, v_credito_existente.empresa_id,
                CASE WHEN v_diferenca > 0 THEN 'credito_ajuste' ELSE 'debito_ajuste' END,
                ABS(v_diferenca), v_saldo_novo, v_os.ordem_id,
                format('Ajuste retroativo OS #%s · categoria %s', v_os.numero, p_categoria),
                v_user_id);

        UPDATE cashback_saldos
           SET saldo_centavos = v_saldo_novo,
               ultima_movimentacao_em = now(), updated_at = now()
         WHERE cliente_id = p_cliente_id;

        v_qtd_ajustadas := v_qtd_ajustadas + 1;
        v_total_ajuste := v_total_ajuste + v_diferenca;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'sucesso', true,
    'qtd_os_ajustadas', v_qtd_ajustadas,
    'total_ajuste_centavos', v_total_ajuste
  );
END;
$$;