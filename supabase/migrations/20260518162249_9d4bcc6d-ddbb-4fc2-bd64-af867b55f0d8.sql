CREATE OR REPLACE FUNCTION public.trg_bloquear_os_duplicada_aparelho()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_os_existente RECORD;
  v_imei_aparelho TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF NEW.aparelho_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status::text IN ('entregue', 'cancelada', 'Entregue', 'Cancelada') THEN
    RETURN NEW;
  END IF;

  SELECT id, numero, status, created_at
  INTO v_os_existente
  FROM public.ordens_de_servico
  WHERE empresa_id = NEW.empresa_id
    AND aparelho_id = NEW.aparelho_id
    AND deleted_at IS NULL
    AND status::text NOT IN ('entregue', 'cancelada', 'Entregue', 'Cancelada')
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    SELECT imei INTO v_imei_aparelho
    FROM public.aparelhos
    WHERE id = NEW.aparelho_id;

    RAISE EXCEPTION 'Já existe OS aberta #% para este aparelho (IMEI %). Finalize a OS anterior antes de criar uma nova.',
      v_os_existente.numero, COALESCE(v_imei_aparelho, '—')
      USING ERRCODE = 'check_violation',
            HINT = 'OS existente: #' || v_os_existente.numero || ' (status: ' || v_os_existente.status || ')';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_os_duplicada_aparelho ON public.ordens_de_servico;
CREATE TRIGGER trg_bloquear_os_duplicada_aparelho
BEFORE INSERT ON public.ordens_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.trg_bloquear_os_duplicada_aparelho();