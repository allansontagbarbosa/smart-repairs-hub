
-- TRIGGER 1: bloquear OS pra 'pronto' se lucro negativo (só com regra percentual_lucro)
CREATE OR REPLACE FUNCTION public.trg_bloquear_os_lucro_negativo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_calc jsonb; v_taxa_lucro_existe boolean; v_tipo_servico_cat text;
BEGIN
  IF NEW.status != 'pronto' OR (OLD.status IS NOT NULL AND OLD.status = 'pronto') THEN RETURN NEW; END IF;
  IF NEW.lojista_id IS NULL THEN RETURN NEW; END IF;
  BEGIN
    SELECT EXISTS (SELECT 1 FROM cashback_taxas_categoria WHERE cliente_id = NEW.lojista_id AND tipo_taxa = 'percentual_lucro' AND ativa) INTO v_taxa_lucro_existe;
    IF NOT v_taxa_lucro_existe THEN RETURN NEW; END IF;
    SELECT categoria INTO v_tipo_servico_cat FROM tipos_servico WHERE id = NEW.tipo_servico_id;
    IF v_tipo_servico_cat IS NULL THEN RETURN NEW; END IF;
    IF NOT EXISTS (SELECT 1 FROM cashback_taxas_categoria WHERE cliente_id = NEW.lojista_id AND categoria = v_tipo_servico_cat AND tipo_taxa = 'percentual_lucro' AND ativa) THEN
      RETURN NEW;
    END IF;
    v_calc := calcular_cashback_os(NEW.id);
    IF v_calc->>'motivo' = 'lucro_negativo_ou_zero' THEN
      RAISE EXCEPTION 'OS bloqueada: lucro negativo ou zero. Cliente tem cashback por lucro ativo. Decomposição: %', v_calc->'decomposicao' USING ERRCODE = 'check_violation';
    END IF;
  EXCEPTION
    WHEN check_violation THEN RAISE;
    WHEN OTHERS THEN RAISE WARNING 'trg_bloquear_os_lucro_negativo falhou pra OS %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_os_bloquear_lucro_negativo ON public.ordens_de_servico;
CREATE TRIGGER trg_os_bloquear_lucro_negativo
  BEFORE UPDATE OF status ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_bloquear_os_lucro_negativo();

-- TRIGGER 2: creditar cashback quando status='pronto'
CREATE OR REPLACE FUNCTION public.trg_creditar_cashback_on_pronto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pronto' AND (OLD.status IS NULL OR OLD.status != 'pronto') THEN
    BEGIN PERFORM creditar_cashback_os(NEW.id);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'creditar_cashback_os falhou pra OS %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_os_creditar_cashback ON public.ordens_de_servico;
CREATE TRIGGER trg_os_creditar_cashback
  AFTER UPDATE OF status ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_creditar_cashback_on_pronto();

-- TRIGGER 3: estornar cashback ao CANCELADO (masculino)
CREATE OR REPLACE FUNCTION public.trg_estornar_cashback_on_cancelada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_credito record; v_saldo bigint; v_saldo_novo bigint;
BEGIN
  IF NEW.status = 'cancelado' AND (OLD.status IS NULL OR OLD.status != 'cancelado') THEN
    BEGIN
      SELECT * INTO v_credito FROM cashback_movimentacoes WHERE ordem_id = NEW.id AND tipo = 'credito_os' LIMIT 1;
      IF v_credito.id IS NOT NULL THEN
        SELECT saldo_centavos INTO v_saldo FROM cashback_saldos WHERE cliente_id = v_credito.cliente_id;
        v_saldo_novo := GREATEST(v_saldo - v_credito.valor_centavos, 0);
        INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos, ordem_id, descricao)
        VALUES (v_credito.cliente_id, v_credito.empresa_id, 'debito_estorno_os', v_saldo - v_saldo_novo, v_saldo_novo, NEW.id, 'Estorno automático (OS cancelada)');
        UPDATE cashback_saldos SET saldo_centavos = v_saldo_novo, ultima_movimentacao_em = now(), updated_at = now() WHERE cliente_id = v_credito.cliente_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Estorno cashback falhou pra OS %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_os_estornar_cashback ON public.ordens_de_servico;
CREATE TRIGGER trg_os_estornar_cashback
  AFTER UPDATE OF status ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_estornar_cashback_on_cancelada();

-- TRIGGER 4: recalcular cashback quando custo_pecas/valor_total mudar
CREATE OR REPLACE FUNCTION public.trg_recalcular_cashback_on_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.custo_pecas IS DISTINCT FROM NEW.custo_pecas OR OLD.valor_total IS DISTINCT FROM NEW.valor_total THEN
    BEGIN
      IF EXISTS (SELECT 1 FROM cashback_movimentacoes WHERE ordem_id = NEW.id AND tipo = 'credito_os') THEN
        PERFORM cashback_recalcular_credito_os(NEW.id);
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Recalculo cashback falhou pra OS %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_os_recalcular_cashback ON public.ordens_de_servico;
CREATE TRIGGER trg_os_recalcular_cashback
  AFTER UPDATE OF custo_pecas, valor_total ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_cashback_on_change();

-- TRIGGER 5: recalcular cashback quando comissoes mudarem
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
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Recalculo cashback (comissao) falhou: %', SQLERRM;
    END;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_comissao_recalcular_cashback ON public.comissoes;
CREATE TRIGGER trg_comissao_recalcular_cashback
  AFTER INSERT OR UPDATE OR DELETE ON public.comissoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_cashback_on_comissao();
