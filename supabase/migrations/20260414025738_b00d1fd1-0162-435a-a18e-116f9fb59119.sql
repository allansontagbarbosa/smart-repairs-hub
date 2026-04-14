
CREATE TABLE IF NOT EXISTS public.garantias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_id UUID NOT NULL REFERENCES public.ordens_de_servico(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  dias_garantia INTEGER NOT NULL DEFAULT 90,
  status TEXT NOT NULL DEFAULT 'ativa',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.garantias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access garantias" ON public.garantias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon read garantias" ON public.garantias
  FOR SELECT TO anon USING (true);

ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS retrabalho BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS os_origem_id UUID REFERENCES public.ordens_de_servico(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.gerar_garantia_entrega()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'entregue' AND OLD.status IS DISTINCT FROM 'entregue' THEN
    INSERT INTO public.garantias (ordem_id, data_inicio, data_fim, dias_garantia)
    VALUES (NEW.id, CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', 90)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_garantia_entrega
AFTER UPDATE ON public.ordens_de_servico
FOR EACH ROW EXECUTE FUNCTION public.gerar_garantia_entrega();
