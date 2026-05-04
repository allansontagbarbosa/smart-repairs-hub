BEGIN;

CREATE OR REPLACE FUNCTION public.auto_concluir_servicos_da_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE')
     AND NEW.status IN ('pronto', 'entregue')
     AND (OLD.status IS DISTINCT FROM NEW.status)
  THEN
    UPDATE public.os_servicos
       SET status = 'concluido',
           concluido_em = COALESCE(concluido_em, NEW.data_conclusao, now())
     WHERE ordem_id = NEW.id
       AND status IN ('pendente', 'em_reparo')
       AND tecnico_id IS NOT NULL;
  END IF;

  IF (TG_OP = 'UPDATE')
     AND OLD.status IN ('pronto', 'entregue')
     AND NEW.status NOT IN ('pronto', 'entregue', 'cancelado')
     AND (OLD.status IS DISTINCT FROM NEW.status)
  THEN
    UPDATE public.os_servicos
       SET status = 'pendente',
           concluido_em = NULL
     WHERE ordem_id = NEW.id
       AND status = 'concluido';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_concluir_servicos_da_os ON public.ordens_de_servico;
CREATE TRIGGER trg_auto_concluir_servicos_da_os
  AFTER UPDATE OF status
  ON public.ordens_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_concluir_servicos_da_os();

DO $$
DECLARE
  r record;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT s.id, o.data_conclusao
      FROM public.os_servicos s
      JOIN public.ordens_de_servico o ON o.id = s.ordem_id
     WHERE o.status IN ('pronto', 'entregue')
       AND o.deleted_at IS NULL
       AND s.status IN ('pendente', 'em_reparo')
       AND s.tecnico_id IS NOT NULL
  LOOP
    UPDATE public.os_servicos
       SET status = 'concluido',
           concluido_em = COALESCE(r.data_conclusao, now())
     WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Backfill: % serviços marcados como concluído', v_count;
END $$;

COMMIT;