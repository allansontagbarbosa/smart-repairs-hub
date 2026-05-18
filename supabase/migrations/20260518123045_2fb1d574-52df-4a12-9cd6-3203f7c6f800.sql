BEGIN;

ALTER TABLE public.socios
  ADD COLUMN IF NOT EXISTS percentual_participacao NUMERIC(5,2) NOT NULL DEFAULT 0
  CHECK (percentual_participacao >= 0 AND percentual_participacao <= 100);

ALTER TABLE public.socios
  ADD COLUMN IF NOT EXISTS user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'socios_user_id_fkey'
  ) THEN
    ALTER TABLE public.socios
      ADD CONSTRAINT socios_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.socios
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_socios_user_id
  ON public.socios (user_id)
  WHERE user_id IS NOT NULL;

WITH socios_ativos AS (
  SELECT id, empresa_id,
         ROW_NUMBER() OVER (PARTITION BY empresa_id ORDER BY ordem, id) AS rn,
         COUNT(*) OVER (PARTITION BY empresa_id) AS total
  FROM public.socios
  WHERE ativo = TRUE
    AND COALESCE(percentual_participacao, 0) = 0
)
UPDATE public.socios s
SET percentual_participacao = CASE
  WHEN sa.rn = sa.total THEN ROUND((100.0 - (FLOOR(10000.0 / sa.total) / 100.0) * (sa.total - 1))::numeric, 2)
  ELSE ROUND((FLOOR(10000.0 / sa.total) / 100.0)::numeric, 2)
END
FROM socios_ativos sa
WHERE s.id = sa.id;

CREATE OR REPLACE FUNCTION public.get_meu_percentual_socio()
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pct NUMERIC := 0;
BEGIN
  IF v_user_id IS NULL THEN RETURN 0; END IF;
  SELECT COALESCE(percentual_participacao, 0)
  INTO v_pct
  FROM public.socios
  WHERE user_id = v_user_id
    AND ativo = TRUE
    AND deleted_at IS NULL
  LIMIT 1;
  RETURN COALESCE(v_pct, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_meu_percentual_socio() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_meu_percentual_socio() TO authenticated;

COMMIT;