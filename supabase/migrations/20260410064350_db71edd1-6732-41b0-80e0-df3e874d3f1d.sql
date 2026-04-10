
-- Unique index on SKU (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_estoque_itens_sku_unique
  ON public.estoque_itens (sku)
  WHERE sku IS NOT NULL AND deleted_at IS NULL;

-- Function to auto-generate SKU
CREATE OR REPLACE FUNCTION public.gerar_sku_automatico()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
DECLARE
  v_next_num integer;
  v_sku text;
  v_exists boolean;
BEGIN
  -- Only generate if SKU is null or empty
  IF NEW.sku IS NULL OR trim(NEW.sku) = '' THEN
    LOOP
      -- Get next sequential number
      SELECT COALESCE(MAX(
        CASE WHEN sku ~ '^SKU-[0-9]+$'
          THEN CAST(substring(sku from 5) AS integer)
          ELSE 0
        END
      ), 0) + 1
      INTO v_next_num
      FROM public.estoque_itens
      WHERE sku ~ '^SKU-[0-9]+$';

      v_sku := 'SKU-' || lpad(v_next_num::text, 6, '0');

      -- Check uniqueness
      SELECT EXISTS (
        SELECT 1 FROM public.estoque_itens WHERE sku = v_sku AND deleted_at IS NULL
      ) INTO v_exists;

      IF NOT v_exists THEN
        NEW.sku := v_sku;
        EXIT;
      END IF;

      -- Increment and retry (safety for race conditions)
      v_next_num := v_next_num + 1;
    END LOOP;
  ELSE
    -- Validate manual SKU uniqueness
    IF EXISTS (
      SELECT 1 FROM public.estoque_itens
      WHERE sku = trim(NEW.sku) AND deleted_at IS NULL AND id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'SKU "%" já está em uso', NEW.sku;
    END IF;
    NEW.sku := trim(NEW.sku);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gerar_sku_automatico
  BEFORE INSERT OR UPDATE ON public.estoque_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_sku_automatico();
