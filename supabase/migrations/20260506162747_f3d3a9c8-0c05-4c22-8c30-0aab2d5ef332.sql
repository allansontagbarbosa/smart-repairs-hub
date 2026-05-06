ALTER TABLE public.contas_a_pagar
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_deleted_at
  ON public.contas_a_pagar(deleted_at)
  WHERE deleted_at IS NULL;