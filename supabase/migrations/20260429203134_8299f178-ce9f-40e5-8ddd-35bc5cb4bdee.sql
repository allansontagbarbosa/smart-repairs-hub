ALTER TABLE public.estoque_itens
  ADD COLUMN IF NOT EXISTS preco_especial numeric DEFAULT 0;