CREATE OR REPLACE FUNCTION public.trg_estornar_cashback_on_cancelada()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_credito record;
  v_saldo bigint;
  v_saldo_novo bigint;
BEGIN
  IF NEW.status = 'cancelado' AND (OLD.status IS NULL OR OLD.status != 'cancelado') THEN
    BEGIN
      SELECT * INTO v_credito FROM cashback_movimentacoes
       WHERE ordem_id = NEW.id AND tipo = 'credito_os' LIMIT 1;
      IF v_credito.id IS NOT NULL THEN
        SELECT saldo_centavos INTO v_saldo FROM cashback_saldos
         WHERE cliente_id = v_credito.cliente_id;
        v_saldo_novo := GREATEST(v_saldo - v_credito.valor_centavos, 0);
        INSERT INTO cashback_movimentacoes (
          cliente_id, empresa_id, tipo, valor_centavos,
          saldo_apos_centavos, ordem_id, descricao
        )
        VALUES (
          v_credito.cliente_id, v_credito.empresa_id, 'debito_estorno_os',
          v_saldo - v_saldo_novo, v_saldo_novo, NEW.id,
          'Estorno automático (OS cancelada)'
        );
        UPDATE cashback_saldos
           SET saldo_centavos = v_saldo_novo,
               ultima_movimentacao_em = now(),
               updated_at = now()
         WHERE cliente_id = v_credito.cliente_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Estorno cashback falhou pra OS %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
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

  IF v_os.status IN ('entregue','cancelado') THEN
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
  RETURN jsonb_build_object(
    'sucesso', true,
    'movimentacao_id', v_mov_id,
    'valor_aplicado_centavos', p_valor_usar_centavos,
    'saldo_novo_centavos', v_saldo_novo
  );
END;
$$;