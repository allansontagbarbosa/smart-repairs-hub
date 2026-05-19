CREATE TABLE IF NOT EXISTS public.socio_insights_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '6 hours'),
  insights_json JSONB NOT NULL,
  prompt_hash TEXT,
  tokens_input INT,
  tokens_output INT
);

CREATE INDEX IF NOT EXISTS idx_socio_insights_user_validos
  ON public.socio_insights_cache(user_id, expira_em);

ALTER TABLE public.socio_insights_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insights_proprio_select" ON public.socio_insights_cache;
CREATE POLICY "insights_proprio_select"
  ON public.socio_insights_cache
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());