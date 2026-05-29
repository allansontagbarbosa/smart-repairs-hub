-- Função auxiliar (idempotente)
CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- PARTE 1: Flags
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS modulo_assistencia_ativo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS modulo_loja_ativo BOOLEAN NOT NULL DEFAULT false;

UPDATE empresas e SET modulo_assistencia_ativo = true
WHERE EXISTS (SELECT 1 FROM ordens_de_servico o WHERE o.empresa_id = e.id);

COMMENT ON COLUMN empresas.modulo_assistencia_ativo IS 'Cliente assinou módulo Assistência Técnica';
COMMENT ON COLUMN empresas.modulo_loja_ativo IS 'Cliente assinou módulo Loja (varejo de celular)';

-- PARTE 2: Tabelas loja_*
CREATE TABLE IF NOT EXISTS loja_aparelhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  modelo TEXT NOT NULL, capacidade TEXT, cor TEXT, imei_1 TEXT, imei_2 TEXT,
  condicao TEXT NOT NULL DEFAULT 'novo' CHECK (condicao IN ('novo','seminovo_a','seminovo_b','seminovo_c','sucata')),
  avaria TEXT, custo NUMERIC(10,2) NOT NULL, preco_venda NUMERIC(10,2) NOT NULL,
  preco_promocional NUMERIC(10,2), garantia_loja_meses INT DEFAULT 12, garantia_fabricante BOOLEAN DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'estoque' CHECK (status IN ('estoque','vitrine','vendido','transferido','perda')),
  origem TEXT CHECK (origem IN ('compra','trade_in','transferencia')),
  fornecedor_id UUID REFERENCES fornecedores(id), trade_in_id UUID, venda_id UUID,
  data_entrada TIMESTAMPTZ DEFAULT NOW(), data_venda TIMESTAMPTZ, observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_loja_aparelhos_empresa ON loja_aparelhos(empresa_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loja_aparelhos_status ON loja_aparelhos(empresa_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loja_aparelhos_imei ON loja_aparelhos(imei_1) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS loja_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  numero_venda BIGSERIAL UNIQUE,
  cliente_id UUID REFERENCES clientes(id),
  vendedor_id UUID REFERENCES funcionarios(id),
  subtotal NUMERIC(10,2) NOT NULL, desconto NUMERIC(10,2) DEFAULT 0,
  trade_in_valor NUMERIC(10,2) DEFAULT 0, trade_in_id UUID, total NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pago' CHECK (status IN ('pendente','pago','cancelado','estornado')),
  motivo_estorno TEXT, observacoes TEXT, nfc_e_emitida BOOLEAN DEFAULT FALSE, nfc_e_chave TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_loja_vendas_empresa ON loja_vendas(empresa_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loja_vendas_cliente ON loja_vendas(cliente_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loja_vendas_vendedor ON loja_vendas(vendedor_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS loja_vendas_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES loja_vendas(id) ON DELETE CASCADE,
  aparelho_id UUID NOT NULL REFERENCES loja_aparelhos(id),
  preco_unitario NUMERIC(10,2) NOT NULL, desconto_item NUMERIC(10,2) DEFAULT 0, total_item NUMERIC(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_loja_vendas_itens_venda ON loja_vendas_itens(venda_id);

CREATE TABLE IF NOT EXISTS loja_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES loja_vendas(id) ON DELETE CASCADE,
  forma TEXT NOT NULL CHECK (forma IN ('dinheiro','pix','cartao_debito','cartao_credito','crediario','transferencia')),
  valor NUMERIC(10,2) NOT NULL, parcelas INT DEFAULT 1, bandeira TEXT, taxa_aplicada NUMERIC(5,2),
  pix_txid TEXT, pix_qrcode TEXT, adquirente TEXT, nsu TEXT,
  status TEXT NOT NULL DEFAULT 'aprovado' CHECK (status IN ('pendente','aprovado','negado','estornado')),
  data_recebimento DATE, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loja_pagamentos_venda ON loja_pagamentos(venda_id);

CREATE TABLE IF NOT EXISTS loja_crediario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  numero_contrato TEXT UNIQUE NOT NULL,
  venda_id UUID REFERENCES loja_vendas(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  total NUMERIC(10,2) NOT NULL, entrada NUMERIC(10,2) DEFAULT 0,
  parcelas INT NOT NULL, valor_parcela NUMERIC(10,2) NOT NULL, taxa_juros NUMERIC(5,2) DEFAULT 0,
  primeiro_vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','quitado','cancelado','renegociado')),
  data_quitacao TIMESTAMPTZ, observacoes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loja_crediario_empresa ON loja_crediario(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_loja_crediario_cliente ON loja_crediario(cliente_id);

CREATE TABLE IF NOT EXISTS loja_crediario_parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crediario_id UUID NOT NULL REFERENCES loja_crediario(id) ON DELETE CASCADE,
  numero_parcela INT NOT NULL, valor NUMERIC(10,2) NOT NULL, vencimento DATE NOT NULL,
  data_pagamento DATE, valor_pago NUMERIC(10,2), multa NUMERIC(10,2) DEFAULT 0, juros NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','paga','atrasada','negociada'))
);
CREATE INDEX IF NOT EXISTS idx_loja_parcelas_crediario ON loja_crediario_parcelas(crediario_id);
CREATE INDEX IF NOT EXISTS idx_loja_parcelas_vencimento ON loja_crediario_parcelas(vencimento) WHERE status IN ('aberta','atrasada');

CREATE TABLE IF NOT EXISTS loja_trade_in (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  cliente_id UUID REFERENCES clientes(id),
  modelo TEXT NOT NULL, capacidade TEXT, cor TEXT, imei_1 TEXT, imei_2 TEXT,
  condicao TEXT NOT NULL CHECK (condicao IN ('novo','usado_a','usado_b','usado_c','sucata')),
  checklist JSONB, valor_sugerido NUMERIC(10,2) NOT NULL,
  descontos_aplicados JSONB, valor_avaliado NUMERIC(10,2) NOT NULL,
  forma_pagamento TEXT CHECK (forma_pagamento IN ('abater_venda','dinheiro','pix','credito_loja')),
  status TEXT NOT NULL DEFAULT 'avaliacao' CHECK (status IN ('avaliacao','aprovado','rejeitado','convertido_estoque')),
  aparelho_id UUID REFERENCES loja_aparelhos(id),
  venda_id UUID REFERENCES loja_vendas(id),
  observacoes TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loja_trade_in_empresa ON loja_trade_in(empresa_id, status);

CREATE TABLE IF NOT EXISTS loja_vendedor_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  funcionario_id UUID NOT NULL UNIQUE REFERENCES funcionarios(id),
  comissao_novo NUMERIC(5,2) DEFAULT 2.0, comissao_seminovo NUMERIC(5,2) DEFAULT 5.0,
  comissao_acessorio NUMERIC(5,2) DEFAULT 10.0, comissao_trade_in NUMERIC(5,2) DEFAULT 1.0,
  meta_mensal NUMERIC(10,2), bonus_meta NUMERIC(10,2), super_bonus NUMERIC(10,2),
  ativo BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loja_vendedor_empresa ON loja_vendedor_config(empresa_id) WHERE ativo;

-- GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_aparelhos TO authenticated;
GRANT ALL ON public.loja_aparelhos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_vendas TO authenticated;
GRANT ALL ON public.loja_vendas TO service_role;
GRANT USAGE, SELECT ON SEQUENCE loja_vendas_numero_venda_seq TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_vendas_itens TO authenticated;
GRANT ALL ON public.loja_vendas_itens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_pagamentos TO authenticated;
GRANT ALL ON public.loja_pagamentos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_crediario TO authenticated;
GRANT ALL ON public.loja_crediario TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_crediario_parcelas TO authenticated;
GRANT ALL ON public.loja_crediario_parcelas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_trade_in TO authenticated;
GRANT ALL ON public.loja_trade_in TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_vendedor_config TO authenticated;
GRANT ALL ON public.loja_vendedor_config TO service_role;

-- PARTE 3: RLS
ALTER TABLE loja_aparelhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE loja_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE loja_vendas_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE loja_pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE loja_crediario ENABLE ROW LEVEL SECURITY;
ALTER TABLE loja_crediario_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE loja_trade_in ENABLE ROW LEVEL SECURITY;
ALTER TABLE loja_vendedor_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loja_aparelhos_all" ON loja_aparelhos FOR ALL USING (empresa_id = get_user_empresa_id()) WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "loja_vendas_all" ON loja_vendas FOR ALL USING (empresa_id = get_user_empresa_id()) WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "loja_vendas_itens_all" ON loja_vendas_itens FOR ALL USING (EXISTS (SELECT 1 FROM loja_vendas v WHERE v.id = loja_vendas_itens.venda_id AND v.empresa_id = get_user_empresa_id()));
CREATE POLICY "loja_pagamentos_all" ON loja_pagamentos FOR ALL USING (EXISTS (SELECT 1 FROM loja_vendas v WHERE v.id = loja_pagamentos.venda_id AND v.empresa_id = get_user_empresa_id()));
CREATE POLICY "loja_crediario_all" ON loja_crediario FOR ALL USING (empresa_id = get_user_empresa_id()) WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "loja_parcelas_all" ON loja_crediario_parcelas FOR ALL USING (EXISTS (SELECT 1 FROM loja_crediario c WHERE c.id = loja_crediario_parcelas.crediario_id AND c.empresa_id = get_user_empresa_id()));
CREATE POLICY "loja_trade_in_all" ON loja_trade_in FOR ALL USING (empresa_id = get_user_empresa_id()) WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "loja_vendedor_config_all" ON loja_vendedor_config FOR ALL USING (empresa_id = get_user_empresa_id()) WITH CHECK (empresa_id = get_user_empresa_id());

-- PARTE 4: RPCs
CREATE OR REPLACE FUNCTION loja_dashboard_kpis(p_empresa_id UUID, p_inicio DATE, p_fim DATE)
RETURNS TABLE (faturamento NUMERIC, custo_total NUMERIC, lucro_bruto NUMERIC, vendas_qtd BIGINT, ticket_medio NUMERIC, margem NUMERIC)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
WITH vendas_periodo AS (
  SELECT v.id, v.total,
    (SELECT SUM(la.custo) FROM loja_vendas_itens li JOIN loja_aparelhos la ON la.id = li.aparelho_id WHERE li.venda_id = v.id) AS custo_venda
  FROM loja_vendas v
  WHERE v.empresa_id = p_empresa_id AND v.status = 'pago'
    AND v.created_at::DATE BETWEEN p_inicio AND p_fim AND v.deleted_at IS NULL
)
SELECT COALESCE(SUM(total),0)::NUMERIC, COALESCE(SUM(custo_venda),0)::NUMERIC,
  COALESCE(SUM(total)-SUM(custo_venda),0)::NUMERIC, COUNT(*)::BIGINT,
  CASE WHEN COUNT(*)>0 THEN COALESCE(SUM(total)/COUNT(*),0) ELSE 0 END::NUMERIC,
  CASE WHEN SUM(total)>0 THEN ((SUM(total)-SUM(custo_venda))/SUM(total)*100) ELSE 0 END::NUMERIC
FROM vendas_periodo;
$$;

CREATE OR REPLACE FUNCTION combo_dashboard_kpis(p_empresa_id UUID, p_inicio DATE, p_fim DATE)
RETURNS TABLE (faturamento_loja NUMERIC, faturamento_assistencia NUMERIC, faturamento_total NUMERIC, vendas_loja BIGINT, os_concluidas BIGINT)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT
  COALESCE((SELECT SUM(total) FROM loja_vendas WHERE empresa_id=p_empresa_id AND status='pago' AND created_at::DATE BETWEEN p_inicio AND p_fim AND deleted_at IS NULL),0)::NUMERIC,
  COALESCE((SELECT SUM(valor_total) FROM ordens_de_servico WHERE empresa_id=p_empresa_id AND status='entregue' AND created_at::DATE BETWEEN p_inicio AND p_fim),0)::NUMERIC,
  (COALESCE((SELECT SUM(total) FROM loja_vendas WHERE empresa_id=p_empresa_id AND status='pago' AND created_at::DATE BETWEEN p_inicio AND p_fim AND deleted_at IS NULL),0)
   + COALESCE((SELECT SUM(valor_total) FROM ordens_de_servico WHERE empresa_id=p_empresa_id AND status='entregue' AND created_at::DATE BETWEEN p_inicio AND p_fim),0))::NUMERIC,
  COALESCE((SELECT COUNT(*) FROM loja_vendas WHERE empresa_id=p_empresa_id AND status='pago' AND created_at::DATE BETWEEN p_inicio AND p_fim AND deleted_at IS NULL),0)::BIGINT,
  COALESCE((SELECT COUNT(*) FROM ordens_de_servico WHERE empresa_id=p_empresa_id AND status='entregue' AND created_at::DATE BETWEEN p_inicio AND p_fim),0)::BIGINT;
$$;

-- PARTE 5
UPDATE empresas SET modulo_loja_ativo = true WHERE id = 'de4680d4-7f48-4971-bef4-8c5b64c09005';
