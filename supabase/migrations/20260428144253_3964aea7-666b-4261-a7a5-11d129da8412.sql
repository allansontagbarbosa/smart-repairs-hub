-- ============================================================

-- TRIGGER 1: validar entrega de OS — bloqueia se não tem serviço

-- ============================================================

DROP TRIGGER IF EXISTS trg_validar_entrega_os_before_status ON public.ordens_de_servico;

CREATE OR REPLACE FUNCTION public.validar_entrega_os()

RETURNS trigger

LANGUAGE plpgsql

AS $$

BEGIN

  IF NEW.status = 'entregue' AND OLD.status IS DISTINCT FROM 'entregue' THEN

    IF NOT EXISTS (SELECT 1 FROM public.os_servicos WHERE ordem_id = NEW.id) THEN

      RAISE EXCEPTION 'OS deve ter pelo menos um serviço vinculado antes de ser entregue';

    END IF;

  END IF;

  RETURN NEW;

END;

$$;

CREATE TRIGGER trg_validar_entrega_os_before_status

BEFORE UPDATE OF status ON public.ordens_de_servico

FOR EACH ROW

EXECUTE FUNCTION public.validar_entrega_os();

-- ============================================================

-- TRIGGER 2: gerar comissão + financeiro quando OS vira entregue

-- ============================================================

DROP TRIGGER IF EXISTS trg_ordens_status_entrega_financeiro_comissao ON public.ordens_de_servico;

CREATE TRIGGER trg_ordens_status_entrega_financeiro_comissao

AFTER UPDATE OF status ON public.ordens_de_servico

FOR EACH ROW

EXECUTE FUNCTION public.gerar_comissao_automatica();

-- ============================================================

-- TRIGGER 3: recalcular totais da OS quando os_servicos muda

-- ============================================================

DROP TRIGGER IF EXISTS trg_os_servicos_recalcular_totais ON public.os_servicos;

CREATE OR REPLACE FUNCTION public.os_servicos_after_change()

RETURNS trigger

LANGUAGE plpgsql

AS $$

DECLARE

  v_ordem_id uuid;

BEGIN

  v_ordem_id := COALESCE(NEW.ordem_id, OLD.ordem_id);

  IF v_ordem_id IS NOT NULL THEN

    PERFORM public.recalcular_totais_os(v_ordem_id);

  END IF;

  RETURN COALESCE(NEW, OLD);

END;

$$;

CREATE TRIGGER trg_os_servicos_recalcular_totais

AFTER INSERT OR UPDATE OR DELETE ON public.os_servicos

FOR EACH ROW

EXECUTE FUNCTION public.os_servicos_after_change();

-- ============================================================

-- TRIGGER 4: baixa de estoque + recálculo quando peça é usada

-- ============================================================

DROP TRIGGER IF EXISTS trg_pecas_utilizadas_baixa_estoque_recalcular_ins ON public.pecas_utilizadas;

CREATE OR REPLACE FUNCTION public.pecas_utilizadas_after_insert()

RETURNS trigger

LANGUAGE plpgsql

AS $$

BEGIN

  -- Baixa estoque

  UPDATE public.estoque_itens 

  SET quantidade = quantidade - NEW.quantidade

  WHERE id = NEW.peca_id;

  

  -- Recalcula totais da OS

  PERFORM public.recalcular_totais_os(NEW.ordem_id);

  

  RETURN NEW;

END;

$$;

CREATE TRIGGER trg_pecas_utilizadas_baixa_estoque_recalcular_ins

AFTER INSERT ON public.pecas_utilizadas

FOR EACH ROW

EXECUTE FUNCTION public.pecas_utilizadas_after_insert();

-- ============================================================

-- TRIGGER 5: devolver estoque + recálculo quando peça é removida

-- ============================================================

DROP TRIGGER IF EXISTS trg_pecas_utilizadas_devolver_estoque_recalcular_del ON public.pecas_utilizadas;

CREATE OR REPLACE FUNCTION public.pecas_utilizadas_after_delete()

RETURNS trigger

LANGUAGE plpgsql

AS $$

BEGIN

  -- Devolve ao estoque

  UPDATE public.estoque_itens 

  SET quantidade = quantidade + OLD.quantidade

  WHERE id = OLD.peca_id;

  

  -- Recalcula totais da OS

  PERFORM public.recalcular_totais_os(OLD.ordem_id);

  

  RETURN OLD;

END;

$$;

CREATE TRIGGER trg_pecas_utilizadas_devolver_estoque_recalcular_del

AFTER DELETE ON public.pecas_utilizadas

FOR EACH ROW

EXECUTE FUNCTION public.pecas_utilizadas_after_delete();

-- ============================================================

-- TRIGGER 6: recalcular lucro_bruto quando valor_total/custo_pecas muda

-- ============================================================

DROP TRIGGER IF EXISTS trg_ordens_recalcular_totais_valores ON public.ordens_de_servico;

CREATE OR REPLACE FUNCTION public.ordens_servico_recalcular_self()

RETURNS trigger

LANGUAGE plpgsql

AS $$

BEGIN

  IF NEW.valor_total IS DISTINCT FROM OLD.valor_total OR NEW.custo_pecas IS DISTINCT FROM OLD.custo_pecas OR NEW.desconto IS DISTINCT FROM OLD.desconto THEN

    PERFORM public.recalcular_totais_os(NEW.id);

  END IF;

  RETURN NEW;

END;

$$;

CREATE TRIGGER trg_ordens_recalcular_totais_valores

AFTER UPDATE OF valor_total, custo_pecas, desconto ON public.ordens_de_servico

FOR EACH ROW

EXECUTE FUNCTION public.ordens_servico_recalcular_self();

-- ============================================================

-- VERIFICAÇÃO FINAL — bloqueia migration se triggers não foram criados

-- ============================================================

DO $$

DECLARE

  v_count integer;

  v_trigger_names text;

BEGIN

  SELECT COUNT(*), STRING_AGG(trigger_name, ', ')

  INTO v_count, v_trigger_names

  FROM information_schema.triggers

  WHERE trigger_schema = 'public'

    AND trigger_name IN (

      'trg_validar_entrega_os_before_status',

      'trg_ordens_status_entrega_financeiro_comissao',

      'trg_os_servicos_recalcular_totais',

      'trg_pecas_utilizadas_baixa_estoque_recalcular_ins',

      'trg_pecas_utilizadas_devolver_estoque_recalcular_del',

      'trg_ordens_recalcular_totais_valores'

    );

  

  IF v_count < 6 THEN

    RAISE EXCEPTION 'FALHA: apenas % triggers criados de 6 esperados. Triggers atuais: %', v_count, COALESCE(v_trigger_names, 'NENHUM');

  END IF;

  

  RAISE NOTICE 'SUCESSO: % triggers criados: %', v_count, v_trigger_names;

END;

$$;