
-- =============================================
-- FASE 1: NOVAS TABELAS DE CADASTRO BASE
-- =============================================

-- 1. Categorias financeiras
CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'variavel', -- 'fixa' ou 'variavel'
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.categorias_financeiras FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Centros de custo
CREATE TABLE IF NOT EXISTS public.centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.centros_custo FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Estoque categorias
CREATE TABLE IF NOT EXISTS public.estoque_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estoque_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.estoque_categorias FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Marcas
CREATE TABLE IF NOT EXISTS public.marcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marcas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.marcas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Modelos
CREATE TABLE IF NOT EXISTS public.modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca_id uuid NOT NULL REFERENCES public.marcas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  categoria_id uuid REFERENCES public.estoque_categorias(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.modelos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Tipos de serviço
CREATE TABLE IF NOT EXISTS public.tipos_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  valor_padrao numeric DEFAULT 0,
  comissao_padrao numeric DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tipos_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.tipos_servico FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Formas de pagamento
CREATE TABLE IF NOT EXISTS public.formas_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.formas_pagamento FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read formas_pagamento" ON public.formas_pagamento FOR SELECT TO anon USING (true);

-- 8. Status de ordem de serviço (configurável)
CREATE TABLE IF NOT EXISTS public.status_ordem_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text DEFAULT '#6b7280',
  ordem_exibicao integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.status_ordem_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.status_ordem_servico FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read status" ON public.status_ordem_servico FOR SELECT TO anon USING (true);

-- 9. Perfis de acesso
CREATE TABLE IF NOT EXISTS public.perfis_acesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_perfil text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.perfis_acesso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.perfis_acesso FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. Estoque itens (unificado: aparelhos, peças, acessórios)
CREATE TABLE IF NOT EXISTS public.estoque_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_item text NOT NULL DEFAULT 'peca', -- 'aparelho', 'peca', 'acessorio'
  categoria_id uuid REFERENCES public.estoque_categorias(id) ON DELETE SET NULL,
  marca_id uuid REFERENCES public.marcas(id) ON DELETE SET NULL,
  modelo_id uuid REFERENCES public.modelos(id) ON DELETE SET NULL,
  nome_personalizado text,
  cor text,
  capacidade text,
  imei_serial text,
  sku text,
  quantidade integer NOT NULL DEFAULT 0,
  quantidade_minima integer NOT NULL DEFAULT 0,
  custo_unitario numeric DEFAULT 0,
  preco_venda numeric DEFAULT 0,
  local_estoque text,
  fornecedor text,
  status text NOT NULL DEFAULT 'disponivel',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estoque_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.estoque_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- FASE 2: ALTERAR TABELAS EXISTENTES
-- =============================================

-- Clientes: adicionar documento, status, updated_at
ALTER TABLE public.clientes 
  ADD COLUMN IF NOT EXISTS documento text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Lojas: adicionar responsavel, cidade, estado
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS responsavel text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text;

-- Funcionarios: adicionar email, cargo (renomear funcao)
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS cargo text;
-- Copiar dados de funcao para cargo se existir
UPDATE public.funcionarios SET cargo = funcao WHERE cargo IS NULL AND funcao IS NOT NULL;

-- Ordens de serviço: adicionar tipo_servico_id, valor_pago, valor_pendente, forma_pagamento_id
ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS tipo_servico_id uuid REFERENCES public.tipos_servico(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valor_pago numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_pendente numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pagamento_id uuid REFERENCES public.formas_pagamento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Comissoes: adicionar tipo_comissao local e valor_base
ALTER TABLE public.comissoes
  ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'fixa',
  ADD COLUMN IF NOT EXISTS valor_base numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Contas a pagar: adicionar categoria_id, centro_custo_id, fornecedor
ALTER TABLE public.contas_a_pagar
  ADD COLUMN IF NOT EXISTS categoria_financeira_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fornecedor text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Conferencias estoque: adicionar tipo, data_inicio, data_fim
ALTER TABLE public.conferencias_estoque
  ADD COLUMN IF NOT EXISTS tipo_conferencia text DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS data_inicio timestamptz,
  ADD COLUMN IF NOT EXISTS data_fim timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Conferencia itens: adicionar estoque_item_id e status
ALTER TABLE public.conferencia_itens
  ADD COLUMN IF NOT EXISTS estoque_item_id uuid REFERENCES public.estoque_itens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pendente';

-- Historico ordens: adicionar descricao e usuario_responsavel
ALTER TABLE public.historico_ordens
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS usuario_responsavel text;

-- =============================================
-- FASE 3: ÍNDICES PARA PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_lojas_cliente_id ON public.lojas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_cliente ON public.ordens_de_servico(aparelho_id);
CREATE INDEX IF NOT EXISTS idx_ordens_loja ON public.ordens_de_servico(loja_id);
CREATE INDEX IF NOT EXISTS idx_ordens_funcionario ON public.ordens_de_servico(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_ordens_status ON public.ordens_de_servico(status);
CREATE INDEX IF NOT EXISTS idx_ordens_data_entrada ON public.ordens_de_servico(data_entrada);
CREATE INDEX IF NOT EXISTS idx_ordens_tipo_servico ON public.ordens_de_servico(tipo_servico_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_funcionario ON public.comissoes(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_ordem ON public.comissoes(ordem_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_status ON public.comissoes(status);
CREATE INDEX IF NOT EXISTS idx_contas_vencimento ON public.contas_a_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_status ON public.contas_a_pagar(status);
CREATE INDEX IF NOT EXISTS idx_contas_categoria ON public.contas_a_pagar(categoria_financeira_id);
CREATE INDEX IF NOT EXISTS idx_estoque_itens_tipo ON public.estoque_itens(tipo_item);
CREATE INDEX IF NOT EXISTS idx_estoque_itens_categoria ON public.estoque_itens(categoria_id);
CREATE INDEX IF NOT EXISTS idx_estoque_itens_marca ON public.estoque_itens(marca_id);
CREATE INDEX IF NOT EXISTS idx_estoque_itens_imei ON public.estoque_itens(imei_serial);
CREATE INDEX IF NOT EXISTS idx_estoque_itens_sku ON public.estoque_itens(sku);
CREATE INDEX IF NOT EXISTS idx_estoque_itens_status ON public.estoque_itens(status);
CREATE INDEX IF NOT EXISTS idx_modelos_marca ON public.modelos(marca_id);
CREATE INDEX IF NOT EXISTS idx_historico_ordem ON public.historico_ordens(ordem_id);
CREATE INDEX IF NOT EXISTS idx_conferencia_itens_conf ON public.conferencia_itens(conferencia_id);
CREATE INDEX IF NOT EXISTS idx_conferencia_itens_estoque ON public.conferencia_itens(estoque_item_id);

-- =============================================
-- FASE 4: TRIGGER DE UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Aplicar trigger em todas as tabelas com updated_at
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'clientes','lojas','funcionarios','tipos_servico','ordens_de_servico',
    'comissoes','contas_a_pagar','categorias_financeiras','centros_custo',
    'estoque_categorias','marcas','modelos','estoque_itens','formas_pagamento',
    'status_ordem_servico','perfis_acesso','conferencias_estoque'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', tbl);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at()', tbl);
  END LOOP;
END;
$$;
