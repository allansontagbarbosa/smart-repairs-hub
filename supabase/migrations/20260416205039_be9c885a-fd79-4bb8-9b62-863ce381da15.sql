-- Tabela cores
CREATE TABLE public.cores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  hex text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa isolada" ON public.cores
  FOR ALL TO authenticated
  USING ((empresa_id = get_my_empresa_id()) OR (empresa_id IS NULL))
  WITH CHECK (empresa_id = get_my_empresa_id());

CREATE TRIGGER set_empresa_cores
  BEFORE INSERT ON public.cores
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

CREATE TRIGGER updated_at_cores
  BEFORE UPDATE ON public.cores
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Tabela capacidades
CREATE TABLE public.capacidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.capacidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa isolada" ON public.capacidades
  FOR ALL TO authenticated
  USING ((empresa_id = get_my_empresa_id()) OR (empresa_id IS NULL))
  WITH CHECK (empresa_id = get_my_empresa_id());

CREATE TRIGGER set_empresa_capacidades
  BEFORE INSERT ON public.capacidades
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

CREATE TRIGGER updated_at_capacidades
  BEFORE UPDATE ON public.capacidades
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- FKs opcionais em aparelhos
ALTER TABLE public.aparelhos
  ADD COLUMN cor_id uuid REFERENCES public.cores(id) ON DELETE SET NULL,
  ADD COLUMN capacidade_id uuid REFERENCES public.capacidades(id) ON DELETE SET NULL,
  ADD COLUMN marca_id uuid REFERENCES public.marcas(id) ON DELETE SET NULL,
  ADD COLUMN modelo_id uuid REFERENCES public.modelos(id) ON DELETE SET NULL;

-- Seeds globais (empresa_id NULL = visíveis a todas as empresas)
INSERT INTO public.cores (nome, empresa_id) VALUES
  ('Preto', NULL), ('Branco', NULL), ('Azul', NULL), ('Vermelho', NULL),
  ('Verde', NULL), ('Roxo', NULL), ('Dourado', NULL), ('Prata', NULL),
  ('Grafite', NULL), ('Titânio Natural', NULL), ('Titânio Azul', NULL),
  ('Titânio Preto', NULL), ('Titânio Branco', NULL);

INSERT INTO public.capacidades (nome, ordem, empresa_id) VALUES
  ('64GB', 1, NULL), ('128GB', 2, NULL), ('256GB', 3, NULL),
  ('512GB', 4, NULL), ('1TB', 5, NULL), ('2TB', 6, NULL);