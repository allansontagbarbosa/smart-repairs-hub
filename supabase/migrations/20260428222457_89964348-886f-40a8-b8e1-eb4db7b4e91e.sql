CREATE OR REPLACE FUNCTION public.trg_movimentacao_entrada_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status::text = 'pronto'
     AND OLD.status::text IS DISTINCT FROM 'pronto'
  THEN
    PERFORM public.gerar_movimentacao_entrada_os(NEW.id);
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.status::text = 'cancelado'
     AND OLD.status::text IS DISTINCT FROM 'cancelado'
  THEN
    DELETE FROM public.movimentacoes_financeiras
    WHERE ordem_id = NEW.id
      AND tipo = 'entrada'::public.tipo_movimentacao;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.deleted_at IS NOT NULL
     AND OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
  THEN
    DELETE FROM public.movimentacoes_financeiras
    WHERE ordem_id = NEW.id
      AND tipo = 'entrada'::public.tipo_movimentacao;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_movimentacao_entrada_os ON public.ordens_de_servico;
CREATE TRIGGER trg_movimentacao_entrada_os
AFTER UPDATE OF status, deleted_at ON public.ordens_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.trg_movimentacao_entrada_os();