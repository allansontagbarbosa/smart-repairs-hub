-- Add 'garantia' value to status_ordem enum (if not present)
ALTER TYPE public.status_ordem ADD VALUE IF NOT EXISTS 'garantia';

-- Track when parts were ordered (for "pedido em DD/MM" display)
ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS pecas_pedido_em date;