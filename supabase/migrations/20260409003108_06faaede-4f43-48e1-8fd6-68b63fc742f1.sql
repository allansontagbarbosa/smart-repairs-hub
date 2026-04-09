
CREATE TABLE public.historico_ordens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id uuid REFERENCES public.ordens_de_servico(id) ON DELETE CASCADE NOT NULL,
  status_anterior text,
  status_novo text NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_historico_ordem ON public.historico_ordens(ordem_id);
CREATE INDEX idx_historico_created ON public.historico_ordens(created_at);

ALTER TABLE public.historico_ordens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.historico_ordens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read history" ON public.historico_ordens FOR SELECT TO anon USING (true);
