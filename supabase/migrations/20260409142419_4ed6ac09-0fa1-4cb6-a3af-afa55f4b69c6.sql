
-- =============================================
-- FASE 2.1: CONSTRAINTS DE UNICIDADE
-- =============================================

-- IMEI/Serial único quando preenchido
CREATE UNIQUE INDEX IF NOT EXISTS idx_estoque_itens_imei_unique 
  ON public.estoque_itens (imei_serial) 
  WHERE imei_serial IS NOT NULL AND imei_serial != '';

-- SKU único quando preenchido
CREATE UNIQUE INDEX IF NOT EXISTS idx_estoque_itens_sku_unique 
  ON public.estoque_itens (sku) 
  WHERE sku IS NOT NULL AND sku != '';

-- Nomes únicos em tabelas de cadastro
ALTER TABLE public.marcas ADD CONSTRAINT marcas_nome_unique UNIQUE (nome);
ALTER TABLE public.centros_custo ADD CONSTRAINT centros_custo_nome_unique UNIQUE (nome);
ALTER TABLE public.formas_pagamento ADD CONSTRAINT formas_pagamento_nome_unique UNIQUE (nome);
ALTER TABLE public.status_ordem_servico ADD CONSTRAINT status_os_nome_unique UNIQUE (nome);
ALTER TABLE public.perfis_acesso ADD CONSTRAINT perfis_acesso_nome_unique UNIQUE (nome_perfil);
ALTER TABLE public.categorias_financeiras ADD CONSTRAINT cat_fin_nome_tipo_unique UNIQUE (nome, tipo);
ALTER TABLE public.estoque_categorias ADD CONSTRAINT estoque_cat_nome_unique UNIQUE (nome);

-- =============================================
-- FASE 2.2: CAMPOS PARA FUTURO (soft delete, auditoria, prioridade, aprovação)
-- =============================================

-- Ordens de serviço: campos de gestão
ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS aprovacao_orcamento text DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS data_aprovacao timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_reprovacao text,
  ADD COLUMN IF NOT EXISTS prazo_vencido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS updated_by text;

-- Soft delete em tabelas principais
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.funcionarios ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.estoque_itens ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.contas_a_pagar ADD COLUMN IF NOT EXISTS created_by text;

-- Índices para soft delete
CREATE INDEX IF NOT EXISTS idx_clientes_deleted ON public.clientes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_lojas_deleted ON public.lojas(deleted_at);
CREATE INDEX IF NOT EXISTS idx_funcionarios_deleted ON public.funcionarios(deleted_at);
CREATE INDEX IF NOT EXISTS idx_ordens_deleted ON public.ordens_de_servico(deleted_at);
CREATE INDEX IF NOT EXISTS idx_estoque_itens_deleted ON public.estoque_itens(deleted_at);

-- Índices para dashboard/relatórios
CREATE INDEX IF NOT EXISTS idx_ordens_prioridade ON public.ordens_de_servico(prioridade);
CREATE INDEX IF NOT EXISTS idx_ordens_aprovacao ON public.ordens_de_servico(aprovacao_orcamento);
CREATE INDEX IF NOT EXISTS idx_ordens_prazo_vencido ON public.ordens_de_servico(prazo_vencido);
CREATE INDEX IF NOT EXISTS idx_contas_categoria_fin ON public.contas_a_pagar(categoria_financeira_id);
CREATE INDEX IF NOT EXISTS idx_contas_centro_custo ON public.contas_a_pagar(centro_custo_id);

-- =============================================
-- FASE 2.3: USER_PROFILES (vincula auth.users a perfis e funcionários)
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  perfil_id uuid REFERENCES public.perfis_acesso(id) ON DELETE SET NULL,
  funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  nome_exibicao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.user_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated insert profile" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.user_profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- =============================================
-- FASE 2.4: TRIGGER - VALIDAR LOJA PERTENCE AO CLIENTE
-- =============================================

CREATE OR REPLACE FUNCTION public.validar_loja_cliente_ordem()
RETURNS TRIGGER AS $$
DECLARE
  v_cliente_id uuid;
  v_loja_cliente_id uuid;
BEGIN
  -- Se não tem loja, não valida
  IF NEW.loja_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar cliente do aparelho
  SELECT a.cliente_id INTO v_cliente_id
  FROM public.aparelhos a
  WHERE a.id = NEW.aparelho_id;

  -- Buscar cliente da loja
  SELECT l.cliente_id INTO v_loja_cliente_id
  FROM public.lojas l
  WHERE l.id = NEW.loja_id;

  -- Validar
  IF v_cliente_id IS DISTINCT FROM v_loja_cliente_id THEN
    RAISE EXCEPTION 'A loja selecionada não pertence ao cliente desta ordem';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_validar_loja_cliente ON public.ordens_de_servico;
CREATE TRIGGER trg_validar_loja_cliente
  BEFORE INSERT OR UPDATE ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.validar_loja_cliente_ordem();

-- =============================================
-- FASE 2.5: TRIGGER - ATUALIZAR PRAZO_VENCIDO AUTOMATICAMENTE
-- =============================================

CREATE OR REPLACE FUNCTION public.atualizar_prazo_vencido()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.previsao_entrega IS NOT NULL 
     AND NEW.previsao_entrega < now() 
     AND NEW.status NOT IN ('pronto', 'entregue') THEN
    NEW.prazo_vencido = true;
  ELSE
    NEW.prazo_vencido = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_prazo_vencido ON public.ordens_de_servico;
CREATE TRIGGER trg_prazo_vencido
  BEFORE INSERT OR UPDATE ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_prazo_vencido();

-- =============================================
-- FASE 2.6: ATUALIZAR DADOS INICIAIS
-- =============================================

-- Atualizar centros de custo (deletar antigos e inserir novos)
DELETE FROM public.centros_custo;
INSERT INTO public.centros_custo (nome, descricao) VALUES
  ('Assistência técnica', 'Custos da operação técnica'),
  ('Administrativo', 'Custos administrativos gerais'),
  ('Estoque', 'Custos de compra e armazenamento'),
  ('Financeiro', 'Custos do setor financeiro'),
  ('Comercial', 'Custos comerciais e vendas');

-- Atualizar categorias de estoque
DELETE FROM public.estoque_categorias;
INSERT INTO public.estoque_categorias (nome, descricao) VALUES
  ('Celular', 'Aparelhos celulares completos'),
  ('Tela', 'Telas e displays'),
  ('Câmera', 'Câmeras e módulos fotográficos'),
  ('Bateria', 'Baterias'),
  ('Tampa', 'Tampas traseiras e carcaças'),
  ('Conector', 'Conectores de carga e fones'),
  ('Face ID', 'Módulos de Face ID e sensores'),
  ('Placa', 'Placas e componentes eletrônicos'),
  ('Acessório', 'Acessórios diversos'),
  ('Outros', 'Itens sem categoria específica');

-- Adicionar perfis faltantes
INSERT INTO public.perfis_acesso (nome_perfil, descricao)
VALUES 
  ('Estoque', 'Acesso ao controle de estoque'),
  ('Cliente portal', 'Acesso ao portal do cliente')
ON CONFLICT (nome_perfil) DO NOTHING;
