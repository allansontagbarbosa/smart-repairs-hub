-- 1) Numeração deve ser única POR EMPRESA, não global
ALTER TABLE public.ordens_de_servico
  DROP CONSTRAINT IF EXISTS ordens_de_servico_numero_formatado_key;
DROP INDEX IF EXISTS public.ordens_de_servico_numero_formatado_key;

CREATE UNIQUE INDEX IF NOT EXISTS ordens_numero_formatado_empresa_key
  ON public.ordens_de_servico (empresa_id, numero_formatado)
  WHERE numero_formatado IS NOT NULL;

-- 2) Geração com trava de concorrência (advisory lock por empresa+ano)
CREATE OR REPLACE FUNCTION public.gerar_numero_formatado_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ano int;
  v_proximo int;
  v_empresa uuid;
BEGIN
  IF NEW.numero_formatado IS NOT NULL AND trim(NEW.numero_formatado) <> '' THEN
    RETURN NEW;
  END IF;

  v_ano := EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int;
  v_empresa := NEW.empresa_id;

  -- Serializa a geração por (empresa, ano) até o fim da transação
  PERFORM pg_advisory_xact_lock(
    hashtext('os_numero:' || COALESCE(v_empresa::text, 'global') || ':' || v_ano::text)
  );

  SELECT COALESCE(MAX(
    CASE WHEN split_part(numero_formatado, '-', 2) ~ '^[0-9]+$'
         THEN CAST(split_part(numero_formatado, '-', 2) AS int) END
  ), 0) + 1
  INTO v_proximo
  FROM public.ordens_de_servico
  WHERE numero_formatado LIKE v_ano::text || '-%'
    AND (
      (v_empresa IS NULL AND empresa_id IS NULL)
      OR empresa_id = v_empresa
    );

  NEW.numero_formatado := v_ano::text || '-' || LPAD(v_proximo::text, 5, '0');
  RETURN NEW;
END;
$function$;