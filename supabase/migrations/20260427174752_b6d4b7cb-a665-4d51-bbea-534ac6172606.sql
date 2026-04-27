ALTER TABLE public.estoque_itens
ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_estoque_itens_ativo
ON public.estoque_itens (ativo);