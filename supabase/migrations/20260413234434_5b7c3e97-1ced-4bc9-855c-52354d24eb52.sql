CREATE TABLE public.ajustes_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_mes text NOT NULL,
  tipo text NOT NULL DEFAULT 'impostos',
  valor numeric(10,2) NOT NULL DEFAULT 0,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ajustes_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.ajustes_mensais
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_ajustes_mensais_ano_mes ON public.ajustes_mensais(ano_mes);

CREATE TRIGGER update_ajustes_mensais_updated_at
  BEFORE UPDATE ON public.ajustes_mensais
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();