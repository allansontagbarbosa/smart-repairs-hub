
-- Adicionar coluna numero_formatado com reset anual
ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS numero_formatado text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_ordens_numero_formatado ON public.ordens_de_servico(numero_formatado);

-- Função para gerar numero_formatado: {ANO}-{SEQ_5_DIGITOS}, reset por ano
CREATE OR REPLACE FUNCTION public.gerar_numero_formatado_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Sequencial por (empresa, ano). Se empresa_id NULL, sequencial global do ano.
  SELECT COALESCE(MAX(
    CAST(split_part(numero_formatado, '-', 2) AS int)
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
$$;

-- Trigger BEFORE INSERT (precisa rodar APÓS set_empresa_id que define empresa_id)
DROP TRIGGER IF EXISTS trg_numero_formatado_os ON public.ordens_de_servico;
CREATE TRIGGER trg_numero_formatado_os
BEFORE INSERT ON public.ordens_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.gerar_numero_formatado_os();

-- Popular OSs existentes em ordem cronológica, agrupando por (empresa, ano)
DO $$
DECLARE
  r record;
  v_seq int;
  v_ultima_chave text := '';
  v_chave_atual text;
BEGIN
  FOR r IN
    SELECT id, empresa_id, EXTRACT(YEAR FROM created_at)::int AS ano, created_at
    FROM public.ordens_de_servico
    WHERE numero_formatado IS NULL
    ORDER BY empresa_id NULLS FIRST, EXTRACT(YEAR FROM created_at), created_at
  LOOP
    v_chave_atual := COALESCE(r.empresa_id::text, 'null') || '|' || r.ano::text;
    IF v_chave_atual <> v_ultima_chave THEN
      v_seq := 1;
      v_ultima_chave := v_chave_atual;
    ELSE
      v_seq := v_seq + 1;
    END IF;
    UPDATE public.ordens_de_servico
       SET numero_formatado = r.ano::text || '-' || LPAD(v_seq::text, 5, '0')
     WHERE id = r.id;
  END LOOP;
END $$;
