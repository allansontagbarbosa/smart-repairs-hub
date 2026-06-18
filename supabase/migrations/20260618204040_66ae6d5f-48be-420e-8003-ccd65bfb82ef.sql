
ALTER TABLE public.atacado_aparelhos
  ADD COLUMN IF NOT EXISTS data_compra timestamptz;

UPDATE public.atacado_aparelhos a
SET data_compra = COALESCE(
  (SELECT i.data_compra FROM public.atacado_invoices i WHERE i.id = a.invoice_id),
  a.data_entrada,
  a.created_at
)
WHERE a.data_compra IS NULL;
