-- ━━━ A. SISTEMA DE PLANOS ━━━
CREATE TABLE IF NOT EXISTS public.planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  preco_mensal NUMERIC(10,2) NOT NULL,
  preco_anual NUMERIC(10,2),
  trial_dias INTEGER DEFAULT 14,
  destaque BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  descricao TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT ON public.planos TO anon, authenticated;
GRANT ALL ON public.planos TO service_role;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
CREATE POLICY planos_read ON public.planos FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.plano_modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES public.planos(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL CHECK (modulo IN ('assistencia', 'loja', 'atacado')),
  UNIQUE (plano_id, modulo)
);
GRANT SELECT ON public.plano_modulos TO anon, authenticated;
GRANT ALL ON public.plano_modulos TO service_role;
ALTER TABLE public.plano_modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY plano_modulos_read ON public.plano_modulos FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.empresa_plano (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  plano_id UUID NOT NULL REFERENCES public.planos(id),
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('trial', 'ativo', 'cancelado', 'inadimplente', 'pausado')),
  ciclo_billing TEXT DEFAULT 'mensal' CHECK (ciclo_billing IN ('mensal', 'anual')),
  trial_termina_em DATE,
  cancelado_em TIMESTAMPTZ,
  motivo_cancelamento TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_plano TO authenticated;
GRANT ALL ON public.empresa_plano TO service_role;
ALTER TABLE public.empresa_plano ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_plano_tenant ON public.empresa_plano FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_empresa_plano_empresa_status ON public.empresa_plano(empresa_id, status) WHERE data_fim IS NULL;

INSERT INTO public.planos (slug, nome, preco_mensal, preco_anual, destaque, ordem, descricao) VALUES
  ('assist_solo',     'Assistência Solo',  149.00, 1490.00, false, 10, 'Apenas o módulo de Assistência Técnica'),
  ('loja_solo',       'Loja Solo',         199.00, 1990.00, false, 20, 'Apenas o módulo de Loja/Varejo'),
  ('atacado_solo',    'Atacado Solo',      299.00, 2990.00, false, 30, 'Apenas o módulo Atacado B2B'),
  ('assist_loja',     'Assist + Loja',     279.00, 2790.00, true,  40, 'Combo: Assistência + Loja varejo'),
  ('loja_atacado',    'Loja + Atacado',    379.00, 3790.00, false, 50, 'Combo: Loja varejo + Atacado B2B'),
  ('assist_atacado',  'Assist + Atacado',  349.00, 3490.00, false, 60, 'Combo: Assistência + Atacado B2B'),
  ('combo_total',     'Combo Total',       499.00, 4990.00, true,  70, 'Todos os 3 módulos com visão Combo')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.plano_modulos (plano_id, modulo)
SELECT p.id, m.modulo FROM public.planos p
CROSS JOIN LATERAL (
  SELECT unnest(CASE p.slug
    WHEN 'assist_solo'    THEN ARRAY['assistencia']
    WHEN 'loja_solo'      THEN ARRAY['loja']
    WHEN 'atacado_solo'   THEN ARRAY['atacado']
    WHEN 'assist_loja'    THEN ARRAY['assistencia', 'loja']
    WHEN 'loja_atacado'   THEN ARRAY['loja', 'atacado']
    WHEN 'assist_atacado' THEN ARRAY['assistencia', 'atacado']
    WHEN 'combo_total'    THEN ARRAY['assistencia', 'loja', 'atacado']
  END) AS modulo
) m
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.empresa_tem_modulo(p_empresa_id UUID, p_modulo TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.empresa_plano ep
    JOIN public.plano_modulos pm ON pm.plano_id = ep.plano_id
    WHERE ep.empresa_id = p_empresa_id
      AND ep.data_fim IS NULL
      AND ep.status IN ('ativo', 'trial')
      AND pm.modulo = p_modulo
  );
$$;

-- ━━━ B. FEATURE FLAGS ━━━
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS modulo_atacado_ativo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS estoque_compartilhado_loja_atacado BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.empresa_plano (empresa_id, plano_id, status, ciclo_billing)
SELECT 'de4680d4-7f48-4971-bef4-8c5b64c09005'::uuid,
       (SELECT id FROM public.planos WHERE slug = 'combo_total'),
       'ativo', 'mensal'
WHERE NOT EXISTS (
  SELECT 1 FROM public.empresa_plano
  WHERE empresa_id = 'de4680d4-7f48-4971-bef4-8c5b64c09005' AND data_fim IS NULL
);

UPDATE public.empresas SET
  modulo_assistencia_ativo = true,
  modulo_loja_ativo = true,
  modulo_atacado_ativo = true
WHERE id = 'de4680d4-7f48-4971-bef4-8c5b64c09005';

-- ━━━ C. TABELAS ATACADO ━━━
CREATE TABLE public.atacado_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  email TEXT,
  telefone TEXT,
  contato_principal TEXT,
  endereco TEXT, numero TEXT, complemento TEXT, bairro TEXT, cidade TEXT, uf TEXT, cep TEXT,
  limite_credito NUMERIC(12,2) DEFAULT 0,
  prazo_pagamento_padrao INTEGER DEFAULT 0,
  condicao_pagamento_padrao TEXT,
  tabela_preco_id UUID,
  vendedor_responsavel_id UUID REFERENCES public.funcionarios(id),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'bloqueado', 'inadimplente', 'inativo')),
  score INTEGER DEFAULT 3 CHECK (score BETWEEN 1 AND 5),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (empresa_id, cnpj)
);
CREATE INDEX idx_atacado_clientes_empresa ON public.atacado_clientes(empresa_id) WHERE deleted_at IS NULL;

CREATE TABLE public.atacado_tabelas_preco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  markup_padrao_pct NUMERIC(5,2) DEFAULT 15,
  ativa BOOLEAN DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.atacado_clientes
  ADD CONSTRAINT atacado_clientes_tabela_fk
  FOREIGN KEY (tabela_preco_id) REFERENCES public.atacado_tabelas_preco(id);

CREATE TABLE public.atacado_aparelhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  loja_aparelho_id UUID REFERENCES public.loja_aparelhos(id),
  modelo TEXT NOT NULL,
  capacidade TEXT,
  cor TEXT,
  imei_1 TEXT,
  imei_2 TEXT,
  condicao TEXT NOT NULL DEFAULT 'novo' CHECK (condicao IN ('novo', 'seminovo_a', 'seminovo_b', 'sucata')),
  custo NUMERIC(10,2) NOT NULL,
  preco_sugerido NUMERIC(10,2),
  quantidade INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'estoque' CHECK (status IN ('estoque', 'reservado', 'vendido', 'em_transito')),
  fornecedor_id UUID,
  nota_entrada TEXT,
  data_entrada TIMESTAMPTZ DEFAULT NOW(),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_atacado_aparelhos_empresa_status ON public.atacado_aparelhos(empresa_id, status) WHERE deleted_at IS NULL;

CREATE TABLE public.atacado_tabelas_preco_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela_preco_id UUID NOT NULL REFERENCES public.atacado_tabelas_preco(id) ON DELETE CASCADE,
  aparelho_id UUID REFERENCES public.atacado_aparelhos(id),
  modelo TEXT,
  capacidade TEXT,
  preco NUMERIC(10,2) NOT NULL,
  preco_minimo_qtd_5 NUMERIC(10,2),
  preco_minimo_qtd_10 NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS public.atacado_pedidos_numero_seq;

CREATE TABLE public.atacado_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero_pedido BIGINT NOT NULL DEFAULT nextval('public.atacado_pedidos_numero_seq'),
  cliente_id UUID NOT NULL REFERENCES public.atacado_clientes(id),
  vendedor_id UUID REFERENCES public.funcionarios(id),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'aguardando_aprovacao', 'aprovado', 'faturado', 'entregue', 'cancelado')),
  origem TEXT DEFAULT 'manual' CHECK (origem IN ('manual', 'catalogo_publico', 'whatsapp')),
  condicao_pagamento TEXT,
  observacoes TEXT,
  observacoes_internas TEXT,
  aprovado_por UUID REFERENCES public.funcionarios(id),
  aprovado_em TIMESTAMPTZ,
  faturado_em TIMESTAMPTZ,
  nfe_numero TEXT,
  nfe_chave TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (empresa_id, numero_pedido)
);
CREATE INDEX idx_atacado_pedidos_empresa_status ON public.atacado_pedidos(empresa_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_atacado_pedidos_cliente ON public.atacado_pedidos(cliente_id) WHERE deleted_at IS NULL;

CREATE TABLE public.atacado_pedidos_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.atacado_pedidos(id) ON DELETE CASCADE,
  aparelho_id UUID REFERENCES public.atacado_aparelhos(id),
  modelo TEXT NOT NULL,
  capacidade TEXT,
  cor TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(10,2) NOT NULL,
  desconto_item NUMERIC(10,2) DEFAULT 0,
  total_item NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.atacado_pedidos_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.atacado_pedidos(id) ON DELETE CASCADE,
  forma TEXT NOT NULL CHECK (forma IN ('boleto', 'pix', 'transferencia', 'cartao', 'cheque', 'dinheiro', 'credito_cliente')),
  valor NUMERIC(12,2) NOT NULL,
  vencimento DATE,
  parcela INTEGER DEFAULT 1,
  total_parcelas INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'pago', 'atrasado', 'cancelado')),
  pago_em TIMESTAMPTZ,
  forma_recebido TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_atacado_pagamentos_pedido ON public.atacado_pedidos_pagamentos(pedido_id);
CREATE INDEX idx_atacado_pagamentos_status ON public.atacado_pedidos_pagamentos(status) WHERE status IN ('aberto', 'atrasado');

CREATE TABLE public.atacado_metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia_ano INTEGER NOT NULL,
  competencia_mes INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('faturamento', 'qtd_pedidos', 'ticket_medio', 'novos_clientes')),
  valor_meta NUMERIC(12,2) NOT NULL,
  bonus_atingir NUMERIC(10,2),
  super_bonus_acima NUMERIC(10,2),
  super_bonus_pct NUMERIC(5,2) DEFAULT 110,
  fechada BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, competencia_ano, competencia_mes, tipo)
);

CREATE TABLE public.atacado_comissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  vendedor_id UUID NOT NULL REFERENCES public.funcionarios(id),
  pct_padrao NUMERIC(5,2) NOT NULL DEFAULT 2,
  pct_acima_meta NUMERIC(5,2),
  pct_cliente_novo NUMERIC(5,2),
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, vendedor_id)
);

CREATE TABLE public.atacado_catalogo_acessos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.atacado_clientes(id) ON DELETE CASCADE,
  email_login TEXT NOT NULL,
  senha_hash TEXT,
  ativo BOOLEAN DEFAULT true,
  ultimo_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (email_login)
);

-- ━━━ GRANTS atacado_* ━━━
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'atacado_%'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END$$;

-- ━━━ D. RLS atacado_* ━━━
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'atacado_%'
    AND tablename NOT IN ('atacado_pedidos_itens','atacado_pedidos_pagamentos','atacado_tabelas_preco_itens','atacado_catalogo_acessos')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_all ON public.%I FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()))', t);
  END LOOP;
END$$;

ALTER TABLE public.atacado_pedidos_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_pedido ON public.atacado_pedidos_itens FOR ALL USING (
  pedido_id IN (SELECT id FROM public.atacado_pedidos WHERE empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()))
);

ALTER TABLE public.atacado_pedidos_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_pedido_pag ON public.atacado_pedidos_pagamentos FOR ALL USING (
  pedido_id IN (SELECT id FROM public.atacado_pedidos WHERE empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()))
);

ALTER TABLE public.atacado_tabelas_preco_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_tabela ON public.atacado_tabelas_preco_itens FOR ALL USING (
  tabela_preco_id IN (SELECT id FROM public.atacado_tabelas_preco WHERE empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()))
);

ALTER TABLE public.atacado_catalogo_acessos ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_via_cliente ON public.atacado_catalogo_acessos FOR ALL USING (
  cliente_id IN (SELECT id FROM public.atacado_clientes WHERE empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()))
);

-- ━━━ E. PERMISSÕES (merge no JSONB existente) ━━━
UPDATE public.perfis_acesso SET
  permissoes = permissoes || jsonb_build_object(
    'atacado_dashboard',     jsonb_build_object('ver', true, 'editar', true),
    'atacado_pedidos',       jsonb_build_object('ver', true, 'editar', true, 'aprovar', true),
    'atacado_clientes',      jsonb_build_object('ver', true, 'editar', true),
    'atacado_aparelhos',     jsonb_build_object('ver', true, 'editar', true),
    'atacado_tabelas_preco', jsonb_build_object('ver', true, 'editar', true),
    'atacado_vendedores',    jsonb_build_object('ver', true, 'editar', true),
    'atacado_metas',         jsonb_build_object('ver', true, 'editar', true),
    'atacado_financeiro',    jsonb_build_object('ver', true, 'editar', true),
    'atacado_cobranca',      jsonb_build_object('ver', true, 'editar', true),
    'atacado_relatorios',    jsonb_build_object('ver', true),
    'atacado_configuracoes', jsonb_build_object('ver', true, 'editar', true),
    'ver_combo',             jsonb_build_object('ver', true)
  )
WHERE nome_perfil = 'Administrador';

UPDATE public.perfis_acesso SET
  permissoes = permissoes || jsonb_build_object(
    'atacado_dashboard',     jsonb_build_object('ver', true, 'editar', false),
    'atacado_pedidos',       jsonb_build_object('ver', true, 'editar', true, 'aprovar', false),
    'atacado_clientes',      jsonb_build_object('ver', true, 'editar', true),
    'atacado_aparelhos',     jsonb_build_object('ver', true, 'editar', true),
    'atacado_tabelas_preco', jsonb_build_object('ver', true, 'editar', false),
    'atacado_vendedores',    jsonb_build_object('ver', true, 'editar', false),
    'atacado_metas',         jsonb_build_object('ver', true, 'editar', false),
    'atacado_financeiro',    jsonb_build_object('ver', true, 'editar', false),
    'atacado_cobranca',      jsonb_build_object('ver', true, 'editar', true),
    'atacado_relatorios',    jsonb_build_object('ver', true),
    'atacado_configuracoes', jsonb_build_object('ver', false, 'editar', false),
    'ver_combo',             jsonb_build_object('ver', true)
  )
WHERE nome_perfil = 'Gerente';