CREATE OR REPLACE FUNCTION public.trg_gerar_prejuizo_retrabalho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_custo_pecas integer;
  v_descricao text;
  v_descricao_movimentacao text;
  v_movimentacao_id uuid;
  v_prejuizo_id uuid;
  v_os_origem_numero integer;
BEGIN
  IF NEW.retrabalho IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.status::text != 'entregue' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = 'entregue' THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.prejuizos
    WHERE os_retrabalho_id = NEW.id AND origem = 'automatico_garantia' AND deleted_at IS NULL
  ) THEN RETURN NEW; END IF;

  SELECT COALESCE(ROUND(SUM(custo_unitario * quantidade) * 100)::integer, 0)
  INTO v_custo_pecas
  FROM public.pecas_utilizadas WHERE ordem_id = NEW.id;

  IF v_custo_pecas = 0 THEN RETURN NEW; END IF;

  IF NEW.os_origem_id IS NOT NULL THEN
    SELECT numero INTO v_os_origem_numero FROM public.ordens_de_servico WHERE id = NEW.os_origem_id;
  END IF;

  v_descricao := 'Garantia automática: peças usadas na OS #' || NEW.numero;
  IF v_os_origem_numero IS NOT NULL THEN
    v_descricao := v_descricao || ' (origem: OS #' || v_os_origem_numero || ')';
  END IF;

  v_descricao_movimentacao := 'Prejuízo: garantia - OS #' || NEW.numero;
  IF v_os_origem_numero IS NOT NULL THEN
    v_descricao_movimentacao := v_descricao_movimentacao || ' (origem: OS #' || v_os_origem_numero || ')';
  END IF;

  INSERT INTO public.prejuizos (
    empresa_id, tipo, valor_centavos, descricao,
    os_origem_id, os_retrabalho_id, data_evento, origem, created_by, updated_by
  ) VALUES (
    NEW.empresa_id, 'garantia', v_custo_pecas, v_descricao,
    NEW.os_origem_id, NEW.id,
    COALESCE(NEW.data_conclusao::date, CURRENT_DATE),
    'automatico_garantia', NEW.updated_by, NEW.updated_by
  ) RETURNING id INTO v_prejuizo_id;

  INSERT INTO public.movimentacoes_financeiras (
    empresa_id, tipo, descricao, valor, data, ordem_id, categoria
  ) VALUES (
    NEW.empresa_id, 'prejuizo', v_descricao_movimentacao,
    (v_custo_pecas::numeric / 100),
    COALESCE(NEW.data_conclusao::date, CURRENT_DATE),
    NEW.id, 'prejuizo'
  ) RETURNING id INTO v_movimentacao_id;

  UPDATE public.prejuizos SET movimentacao_financeira_id = v_movimentacao_id WHERE id = v_prejuizo_id;

  RAISE NOTICE 'Prejuízo automático gerado: % (R$ %)', v_prejuizo_id, (v_custo_pecas::numeric / 100);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[trg_gerar_prejuizo_retrabalho] erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prejuizo_automatico_retrabalho ON public.ordens_de_servico;
CREATE TRIGGER prejuizo_automatico_retrabalho
  AFTER UPDATE OF status ON public.ordens_de_servico
  FOR EACH ROW
  WHEN (NEW.retrabalho = true AND NEW.status::text = 'entregue' AND (OLD.status::text != 'entregue' OR OLD.retrabalho IS NOT TRUE))
  EXECUTE FUNCTION public.trg_gerar_prejuizo_retrabalho();

NOTIFY pgrst, 'reload schema';