ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS checklist_entrada jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS obs_cliente text;