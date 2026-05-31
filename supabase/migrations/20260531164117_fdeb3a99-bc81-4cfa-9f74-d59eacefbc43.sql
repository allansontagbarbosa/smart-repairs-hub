
CREATE TABLE IF NOT EXISTS public.atacado_configuracoes (
  empresa_id UUID PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  nfe_ambiente TEXT NOT NULL DEFAULT 'homologacao' CHECK (nfe_ambiente IN ('homologacao', 'producao')),
  nfe_serie TEXT DEFAULT '1',
  nfe_proximo_numero INT DEFAULT 1,
  nfe_cnae TEXT,
  nfe_cfop_padrao TEXT DEFAULT '5102',
  nfe_natureza_operacao TEXT DEFAULT 'Venda',
  nfe_certificado_uploaded BOOLEAN DEFAULT false,
  nfe_certificado_validade DATE,
  prazo_pagamento_padrao_dias INT DEFAULT 30,
  condicao_pagamento_padrao TEXT DEFAULT '30 dias',
  juros_atraso_pct NUMERIC(5,2) DEFAULT 1.00,
  multa_atraso_pct NUMERIC(5,2) DEFAULT 2.00,
  limite_credito_inicial_novo_cliente NUMERIC(12,2) DEFAULT 0,
  bloquear_automatico_se_atrasos_dias INT DEFAULT 60,
  exigir_aprovacao_pedidos_acima NUMERIC(12,2) DEFAULT 10000,
  permitir_venda_cliente_inadimplente BOOLEAN DEFAULT false,
  notificar_email_boletos_vencidos BOOLEAN DEFAULT true,
  notificar_wpp_boletos_vencidos BOOLEAN DEFAULT false,
  lembrete_vencimento_dias INT DEFAULT 3,
  catalogo_publico_ativo BOOLEAN DEFAULT false,
  catalogo_publico_slug TEXT UNIQUE,
  catalogo_publico_titulo TEXT,
  catalogo_publico_descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_configuracoes TO authenticated;
GRANT ALL ON public.atacado_configuracoes TO service_role;

ALTER TABLE public.atacado_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON public.atacado_configuracoes FOR SELECT
  USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY tenant_insert ON public.atacado_configuracoes FOR INSERT
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY tenant_update ON public.atacado_configuracoes FOR UPDATE
  USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY tenant_delete ON public.atacado_configuracoes FOR DELETE
  USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));
