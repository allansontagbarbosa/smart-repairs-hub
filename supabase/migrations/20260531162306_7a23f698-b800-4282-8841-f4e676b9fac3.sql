
CREATE TABLE IF NOT EXISTS public.atacado_cobrancas_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.atacado_clientes(id) ON DELETE CASCADE,
  pagamento_id UUID REFERENCES public.atacado_pedidos_pagamentos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('whatsapp','ligacao','email','visita','sms','observacao','acordo')),
  descricao TEXT,
  realizado_por UUID REFERENCES public.funcionarios(id),
  resultado TEXT,
  data_proxima_acao DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_cobrancas_historico TO authenticated;
GRANT ALL ON public.atacado_cobrancas_historico TO service_role;

ALTER TABLE public.atacado_cobrancas_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON public.atacado_cobrancas_historico FOR SELECT
  USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY tenant_insert ON public.atacado_cobrancas_historico FOR INSERT
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY tenant_update ON public.atacado_cobrancas_historico FOR UPDATE
  USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY tenant_delete ON public.atacado_cobrancas_historico FOR DELETE
  USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_cobranca_cliente ON public.atacado_cobrancas_historico(cliente_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.marcar_atrasados_atacado()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT;
BEGIN
  UPDATE atacado_pedidos_pagamentos
  SET status = 'atrasado'
  WHERE status = 'aberto' AND vencimento < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.quitar_pagamento_atacado(
  p_pagamento_id UUID,
  p_forma_recebido TEXT,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE atacado_pedidos_pagamentos
  SET status = 'pago',
      pago_em = NOW(),
      forma_recebido = p_forma_recebido,
      observacoes = p_observacoes
  WHERE id = p_pagamento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.atacado_financeiro_kpis(p_empresa_id UUID)
RETURNS TABLE (
  total_aberto NUMERIC,
  total_atrasado NUMERIC,
  total_pago_mes NUMERIC,
  qtd_boletos_aberto BIGINT,
  qtd_boletos_atrasado BIGINT,
  qtd_clientes_atrasados BIGINT
) LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE((SELECT SUM(pp.valor) FROM atacado_pedidos_pagamentos pp
              JOIN atacado_pedidos p ON p.id = pp.pedido_id
              WHERE p.empresa_id = p_empresa_id AND pp.status = 'aberto' AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor) FROM atacado_pedidos_pagamentos pp
              JOIN atacado_pedidos p ON p.id = pp.pedido_id
              WHERE p.empresa_id = p_empresa_id AND pp.status = 'atrasado' AND p.deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(pp.valor) FROM atacado_pedidos_pagamentos pp
              JOIN atacado_pedidos p ON p.id = pp.pedido_id
              WHERE p.empresa_id = p_empresa_id AND pp.status = 'pago'
                AND pp.pago_em >= DATE_TRUNC('month', CURRENT_DATE)
                AND p.deleted_at IS NULL), 0),
    (SELECT COUNT(*) FROM atacado_pedidos_pagamentos pp
     JOIN atacado_pedidos p ON p.id = pp.pedido_id
     WHERE p.empresa_id = p_empresa_id AND pp.status = 'aberto' AND p.deleted_at IS NULL),
    (SELECT COUNT(*) FROM atacado_pedidos_pagamentos pp
     JOIN atacado_pedidos p ON p.id = pp.pedido_id
     WHERE p.empresa_id = p_empresa_id AND pp.status = 'atrasado' AND p.deleted_at IS NULL),
    (SELECT COUNT(DISTINCT p.cliente_id) FROM atacado_pedidos_pagamentos pp
     JOIN atacado_pedidos p ON p.id = pp.pedido_id
     WHERE p.empresa_id = p_empresa_id AND pp.status = 'atrasado' AND p.deleted_at IS NULL);
$$;

CREATE OR REPLACE FUNCTION public.atacado_clientes_inadimplentes(p_empresa_id UUID)
RETURNS TABLE (
  cliente_id UUID,
  razao_social TEXT,
  nome_fantasia TEXT,
  telefone TEXT,
  total_atrasado NUMERIC,
  qtd_boletos_atrasados BIGINT,
  dias_max_atraso INT,
  ultimo_contato TIMESTAMPTZ,
  ultimo_tipo TEXT
) LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id,
    c.razao_social,
    c.nome_fantasia,
    c.telefone,
    SUM(pp.valor),
    COUNT(pp.id),
    MAX(CURRENT_DATE - pp.vencimento)::INT,
    (SELECT MAX(created_at) FROM atacado_cobrancas_historico WHERE cliente_id = c.id),
    (SELECT tipo FROM atacado_cobrancas_historico WHERE cliente_id = c.id ORDER BY created_at DESC LIMIT 1)
  FROM atacado_clientes c
  JOIN atacado_pedidos p ON p.cliente_id = c.id
  JOIN atacado_pedidos_pagamentos pp ON pp.pedido_id = p.id
  WHERE c.empresa_id = p_empresa_id
    AND pp.status = 'atrasado'
    AND p.deleted_at IS NULL
    AND c.deleted_at IS NULL
  GROUP BY c.id, c.razao_social, c.nome_fantasia, c.telefone
  ORDER BY MAX(CURRENT_DATE - pp.vencimento) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_atrasados_atacado() TO authenticated;
GRANT EXECUTE ON FUNCTION public.quitar_pagamento_atacado(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atacado_financeiro_kpis(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atacado_clientes_inadimplentes(UUID) TO authenticated;
