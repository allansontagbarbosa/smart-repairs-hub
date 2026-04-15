
-- Add modulo column to auditoria table
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS modulo text;

-- Create index for filtering by modulo
CREATE INDEX IF NOT EXISTS idx_auditoria_modulo ON public.auditoria(modulo);
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON public.auditoria(created_at DESC);
