DROP INDEX IF EXISTS public.idx_aparelhos_imei_unique;
CREATE UNIQUE INDEX idx_aparelhos_imei_cliente_unique
  ON public.aparelhos (empresa_id, imei, cliente_id)
  WHERE imei IS NOT NULL AND imei <> '';