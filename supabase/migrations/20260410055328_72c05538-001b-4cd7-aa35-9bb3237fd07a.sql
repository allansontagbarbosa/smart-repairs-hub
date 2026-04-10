
-- Add relational columns to contas_a_pagar
ALTER TABLE public.contas_a_pagar
  ADD COLUMN IF NOT EXISTS loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ordem_servico_id uuid REFERENCES public.ordens_de_servico(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contas_loja ON public.contas_a_pagar(loja_id);
CREATE INDEX IF NOT EXISTS idx_contas_ordem ON public.contas_a_pagar(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_contas_fornecedor ON public.contas_a_pagar(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_contas_vencimento_status ON public.contas_a_pagar(data_vencimento, status);
