ALTER TABLE public.estoque_itens
  ADD COLUMN IF NOT EXISTS codigo_barras TEXT;

CREATE INDEX IF NOT EXISTS idx_estoque_itens_codigo_barras
  ON public.estoque_itens(codigo_barras)
  WHERE codigo_barras IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_estoque_itens_sku
  ON public.estoque_itens(sku)
  WHERE sku IS NOT NULL;