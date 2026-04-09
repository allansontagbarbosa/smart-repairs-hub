
CREATE TABLE public.pecas_utilizadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_id UUID NOT NULL REFERENCES public.ordens_de_servico(id) ON DELETE CASCADE,
  peca_id UUID NOT NULL REFERENCES public.estoque(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pecas_utilizadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access"
ON public.pecas_utilizadas
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
