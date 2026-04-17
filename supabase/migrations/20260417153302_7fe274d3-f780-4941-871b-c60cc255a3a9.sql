-- Adiciona campos para conferência por scanner (auditoria)
ALTER TABLE public.conferencias_estoque
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'pecas',
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS total_esperado integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_conferido integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_divergencias integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS detalhes jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Constraint de tipo
DO $$ BEGIN
  ALTER TABLE public.conferencias_estoque
    ADD CONSTRAINT conferencias_estoque_tipo_check CHECK (tipo IN ('aparelhos', 'pecas'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Índice para listagem por empresa+tipo
CREATE INDEX IF NOT EXISTS idx_conferencias_estoque_empresa_tipo
  ON public.conferencias_estoque(empresa_id, tipo, created_at DESC);