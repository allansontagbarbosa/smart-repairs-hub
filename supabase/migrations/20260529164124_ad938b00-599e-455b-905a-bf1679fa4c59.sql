
CREATE TABLE public.loja_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  nome TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  data_nascimento DATE,
  telefone TEXT,
  email TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  renda NUMERIC(10,2),
  limite_credito NUMERIC(10,2),
  score_interno INTEGER NOT NULL DEFAULT 3 CHECK (score_interno BETWEEN 1 AND 5),
  tag TEXT NOT NULL DEFAULT 'novo' CHECK (tag IN ('vip','regular','novo','problema','blacklist')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_loja_clientes_empresa ON public.loja_clientes(empresa_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_loja_clientes_cpf ON public.loja_clientes(cpf) WHERE deleted_at IS NULL;
CREATE INDEX idx_loja_clientes_tag ON public.loja_clientes(empresa_id, tag) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_clientes TO authenticated;
GRANT ALL ON public.loja_clientes TO service_role;

ALTER TABLE public.loja_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loja_clientes_all" ON public.loja_clientes
  FOR ALL TO authenticated
  USING (empresa_id = get_user_empresa_id())
  WITH CHECK (empresa_id = get_user_empresa_id());

CREATE TRIGGER set_loja_clientes_updated_at
  BEFORE UPDATE ON public.loja_clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.loja_metas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  funcionario_id UUID REFERENCES public.funcionarios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('faturamento','quantidade','margem')),
  competencia_ano INTEGER NOT NULL,
  competencia_mes INTEGER NOT NULL CHECK (competencia_mes BETWEEN 1 AND 12),
  valor_meta NUMERIC(12,2) NOT NULL,
  valor_realizado NUMERIC(12,2),
  bonus_pago NUMERIC(10,2),
  fechada BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, funcionario_id, tipo, competencia_ano, competencia_mes)
);

CREATE INDEX idx_loja_metas_empresa ON public.loja_metas(empresa_id, competencia_ano DESC, competencia_mes DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_metas TO authenticated;
GRANT ALL ON public.loja_metas TO service_role;

ALTER TABLE public.loja_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loja_metas_all" ON public.loja_metas
  FOR ALL TO authenticated
  USING (empresa_id = get_user_empresa_id())
  WITH CHECK (empresa_id = get_user_empresa_id());

CREATE TRIGGER set_loja_metas_updated_at
  BEFORE UPDATE ON public.loja_metas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
