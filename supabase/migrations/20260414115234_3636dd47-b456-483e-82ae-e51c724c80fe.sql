
ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS gastos_fixos_mensais NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depreciacao_mensal NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impostos_mensal NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outros_gastos NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dias_garantia INTEGER DEFAULT 90;

-- Ensure at least one config record exists
INSERT INTO public.empresa_config (id, nome)
SELECT gen_random_uuid(), 'Minha Empresa'
WHERE NOT EXISTS (SELECT 1 FROM public.empresa_config);
