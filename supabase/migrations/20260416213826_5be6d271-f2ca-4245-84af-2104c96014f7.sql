-- Adicionar campos financeiros na ordens_de_servico
ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS desconto numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sinal_pago numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pagamento_sinal text,
  ADD COLUMN IF NOT EXISTS garantia_dias integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS valor_total numeric(10,2),
  ADD COLUMN IF NOT EXISTS mao_obra_adicional numeric(10,2) NOT NULL DEFAULT 0;

-- Constraints (somente se ainda não existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ordens_desconto_nonneg') THEN
    ALTER TABLE public.ordens_de_servico ADD CONSTRAINT ordens_desconto_nonneg CHECK (desconto >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ordens_sinal_nonneg') THEN
    ALTER TABLE public.ordens_de_servico ADD CONSTRAINT ordens_sinal_nonneg CHECK (sinal_pago >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ordens_garantia_nonneg') THEN
    ALTER TABLE public.ordens_de_servico ADD CONSTRAINT ordens_garantia_nonneg CHECK (garantia_dias >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ordens_mao_obra_adicional_nonneg') THEN
    ALTER TABLE public.ordens_de_servico ADD CONSTRAINT ordens_mao_obra_adicional_nonneg CHECK (mao_obra_adicional >= 0);
  END IF;
END$$;

COMMENT ON COLUMN public.ordens_de_servico.desconto IS 'Desconto aplicado ao valor total da OS (R$).';
COMMENT ON COLUMN public.ordens_de_servico.sinal_pago IS 'Sinal pago pelo cliente na entrada (R$). Reutilizado por valor_pago em alguns lugares.';
COMMENT ON COLUMN public.ordens_de_servico.forma_pagamento_sinal IS 'Forma de pagamento do sinal: dinheiro, pix, debito, credito, outro.';
COMMENT ON COLUMN public.ordens_de_servico.garantia_dias IS 'Dias de garantia do serviço (default 90 dias - CDC art.26).';
COMMENT ON COLUMN public.ordens_de_servico.valor_total IS 'Valor total final da OS (serviços + peças + mão_obra_adicional - desconto). Snapshot no submit.';
COMMENT ON COLUMN public.ordens_de_servico.mao_obra_adicional IS 'Mão de obra adicional além dos serviços catalogados (R$).';