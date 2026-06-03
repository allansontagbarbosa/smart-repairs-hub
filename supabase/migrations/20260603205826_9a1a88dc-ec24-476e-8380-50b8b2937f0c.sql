
-- RH-CADASTRO-CONTABIL-01: campos contábeis e dependentes

-- Bloco 1: novos campos em funcionarios (só os que faltam)
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS estado_civil text,
  ADD COLUMN IF NOT EXISTS genero text,
  ADD COLUMN IF NOT EXISTS nome_mae text,
  ADD COLUMN IF NOT EXISTS pis_pasep text,
  ADD COLUMN IF NOT EXISTS ctps_numero text,
  ADD COLUMN IF NOT EXISTS ctps_serie text,
  ADD COLUMN IF NOT EXISTS ctps_uf text,
  ADD COLUMN IF NOT EXISTS cbo text,
  ADD COLUMN IF NOT EXISTS centro_custo text,
  ADD COLUMN IF NOT EXISTS tipo_conta text,
  ADD COLUMN IF NOT EXISTS pix_tipo text;

-- Bloco 2: tabela de dependentes
CREATE TABLE IF NOT EXISTS public.funcionario_dependentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  nome text NOT NULL,
  data_nascimento date,
  parentesco text,
  cpf text,
  conta_irrf boolean NOT NULL DEFAULT true,
  conta_salario_familia boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcionario_dependentes TO authenticated;
GRANT ALL ON public.funcionario_dependentes TO service_role;

ALTER TABLE public.funcionario_dependentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dependentes_select ON public.funcionario_dependentes;
DROP POLICY IF EXISTS dependentes_modify ON public.funcionario_dependentes;

CREATE POLICY dependentes_select ON public.funcionario_dependentes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id() AND public.is_rh());

CREATE POLICY dependentes_modify ON public.funcionario_dependentes
  FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id() AND public.is_rh())
  WITH CHECK (empresa_id = public.get_my_empresa_id() AND public.is_rh());

CREATE INDEX IF NOT EXISTS idx_dep_func ON public.funcionario_dependentes(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_dep_emp ON public.funcionario_dependentes(empresa_id);

-- trigger updated_at
CREATE OR REPLACE FUNCTION public._dep_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_dep_touch ON public.funcionario_dependentes;
CREATE TRIGGER trg_dep_touch BEFORE UPDATE ON public.funcionario_dependentes
  FOR EACH ROW EXECUTE FUNCTION public._dep_touch();
