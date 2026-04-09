
-- 1. Add new status values to status_ordem enum
ALTER TYPE public.status_ordem ADD VALUE IF NOT EXISTS 'aprovado' AFTER 'aguardando_aprovacao';
ALTER TYPE public.status_ordem ADD VALUE IF NOT EXISTS 'aguardando_peca' AFTER 'em_reparo';

-- 2. Create lojas table
CREATE TABLE public.lojas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.lojas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read lojas" ON public.lojas FOR SELECT TO anon USING (true);

-- 3. Create funcionarios table
CREATE TYPE public.tipo_comissao AS ENUM ('fixa', 'percentual');

CREATE TABLE public.funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  funcao TEXT,
  telefone TEXT,
  tipo_comissao public.tipo_comissao NOT NULL DEFAULT 'fixa',
  valor_comissao NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.funcionarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Create comissoes table
CREATE TYPE public.status_comissao AS ENUM ('pendente', 'liberada', 'paga');

CREATE TABLE public.comissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  ordem_id UUID REFERENCES public.ordens_de_servico(id) ON DELETE SET NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  status public.status_comissao NOT NULL DEFAULT 'pendente',
  data_pagamento TIMESTAMP WITH TIME ZONE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.comissoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Create contas_a_pagar table
CREATE TYPE public.status_conta AS ENUM ('pendente', 'paga', 'vencida', 'cancelada');

CREATE TABLE public.contas_a_pagar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'outros',
  centro_custo TEXT,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status public.status_conta NOT NULL DEFAULT 'pendente',
  recorrente BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.contas_a_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.contas_a_pagar FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Create categorias_sistema table (flexible lookups)
CREATE TABLE public.categorias_sistema (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (tipo, nome)
);
ALTER TABLE public.categorias_sistema ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.categorias_sistema FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Create conferencias_estoque table
CREATE TYPE public.status_conferencia AS ENUM ('em_andamento', 'finalizada');

CREATE TABLE public.conferencias_estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responsavel TEXT NOT NULL,
  status public.status_conferencia NOT NULL DEFAULT 'em_andamento',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.conferencias_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.conferencias_estoque FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Create conferencia_itens table
CREATE TABLE public.conferencia_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conferencia_id UUID NOT NULL REFERENCES public.conferencias_estoque(id) ON DELETE CASCADE,
  item_tipo TEXT NOT NULL,
  item_id UUID,
  item_nome TEXT NOT NULL,
  quantidade_esperada INTEGER NOT NULL DEFAULT 0,
  quantidade_contada INTEGER NOT NULL DEFAULT 0,
  divergencia INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.conferencia_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.conferencia_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. Add loja_id and funcionario_id to ordens_de_servico
ALTER TABLE public.ordens_de_servico
  ADD COLUMN loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  ADD COLUMN funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL;

-- 10. Seed default categorias_sistema
INSERT INTO public.categorias_sistema (tipo, nome) VALUES
  ('categoria_financeira', 'Aluguel'),
  ('categoria_financeira', 'Energia'),
  ('categoria_financeira', 'Água'),
  ('categoria_financeira', 'Internet'),
  ('categoria_financeira', 'Salários'),
  ('categoria_financeira', 'Comissões'),
  ('categoria_financeira', 'Compra de peças'),
  ('categoria_financeira', 'Marketing'),
  ('categoria_financeira', 'Impostos'),
  ('categoria_financeira', 'Serviços terceirizados'),
  ('categoria_financeira', 'Outros'),
  ('forma_pagamento', 'Dinheiro'),
  ('forma_pagamento', 'PIX'),
  ('forma_pagamento', 'Cartão de crédito'),
  ('forma_pagamento', 'Cartão de débito'),
  ('forma_pagamento', 'Transferência'),
  ('forma_pagamento', 'Boleto'),
  ('centro_custo', 'Operacional'),
  ('centro_custo', 'Administrativo'),
  ('centro_custo', 'Comercial');
