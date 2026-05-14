CREATE INDEX IF NOT EXISTS idx_clientes_tipo_cliente
  ON public.clientes (empresa_id, tipo_cliente)
  WHERE deleted_at IS NULL;