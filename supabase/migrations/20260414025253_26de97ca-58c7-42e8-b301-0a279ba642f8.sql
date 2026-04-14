
CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_id UUID NOT NULL REFERENCES public.ordens_de_servico(id) ON DELETE CASCADE,
  nota INTEGER NOT NULL,
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT nota_range CHECK (nota >= 1 AND nota <= 5)
);

ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated insert avaliacoes" ON public.avaliacoes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated read avaliacoes" ON public.avaliacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anon insert avaliacoes" ON public.avaliacoes
  FOR INSERT TO anon WITH CHECK (true);
