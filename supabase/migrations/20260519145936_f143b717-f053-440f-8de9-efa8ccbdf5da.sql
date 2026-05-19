ALTER TABLE public.os_servicos
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_servicos_updated_at ON public.os_servicos;
CREATE TRIGGER trg_os_servicos_updated_at
  BEFORE UPDATE ON public.os_servicos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();