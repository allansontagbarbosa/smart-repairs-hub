
ALTER TABLE public.empresa_config
ADD COLUMN numero_socios integer DEFAULT 1,
ADD COLUMN percentual_reserva_empresa numeric(5,2) DEFAULT 10;

CREATE TABLE public.socios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.socios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
