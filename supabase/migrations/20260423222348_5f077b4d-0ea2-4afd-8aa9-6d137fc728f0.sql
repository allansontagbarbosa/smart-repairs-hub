-- Tabela para registrar falhas de auditoria sem quebrar o fluxo principal
CREATE TABLE IF NOT EXISTS public.auditoria_falhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  acao text,
  modulo text,
  registro_id uuid,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  empresa_id uuid
);

ALTER TABLE public.auditoria_falhas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa isolada" ON public.auditoria_falhas;
CREATE POLICY "Empresa isolada" ON public.auditoria_falhas
  FOR ALL TO authenticated
  USING (empresa_id IS NULL OR empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id IS NULL OR empresa_id = public.get_my_empresa_id());

-- Index para consultas por data
CREATE INDEX IF NOT EXISTS idx_auditoria_falhas_created_at
  ON public.auditoria_falhas (created_at DESC);