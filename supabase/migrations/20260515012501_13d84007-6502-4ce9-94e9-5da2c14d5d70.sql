-- Tabela de auditoria de pagamentos
CREATE TABLE IF NOT EXISTS public.audit_pagamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id    UUID NOT NULL,
  empresa_id      UUID NOT NULL,
  acao            TEXT NOT NULL CHECK (acao IN ('editar', 'excluir')),
  user_id         UUID NOT NULL,
  valores_antes   JSONB NOT NULL,
  valores_depois  JSONB,
  motivo          TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_pagamentos_pagamento
  ON public.audit_pagamentos (pagamento_id);
CREATE INDEX IF NOT EXISTS idx_audit_pagamentos_empresa
  ON public.audit_pagamentos (empresa_id, criado_em DESC);

ALTER TABLE public.audit_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_pagamentos_select_empresa"
  ON public.audit_pagamentos FOR SELECT
  TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- RPC: editar pagamento (admin only)
CREATE OR REPLACE FUNCTION public.editar_pagamento_cliente(
  p_pagamento_id UUID,
  p_dados        JSONB,
  p_motivo       TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa        UUID;
  v_pagamento      RECORD;
  v_valores_antes  JSONB;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;
  IF NOT public.is_admin_user(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores podem editar pagamentos');
  END IF;

  SELECT * INTO v_pagamento
  FROM public.pagamentos_clientes
  WHERE id = p_pagamento_id AND deleted_at IS NULL;

  IF v_pagamento.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pagamento não encontrado');
  END IF;
  IF v_pagamento.empresa_id <> v_empresa THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pagamento não pertence à sua empresa');
  END IF;

  v_valores_antes := to_jsonb(v_pagamento);

  UPDATE public.pagamentos_clientes SET
    valor           = COALESCE((p_dados->>'valor')::NUMERIC, valor),
    data_pagamento  = COALESCE((p_dados->>'data_pagamento')::DATE, data_pagamento),
    forma_pagamento = COALESCE(p_dados->>'forma_pagamento', forma_pagamento),
    observacoes     = CASE
                        WHEN p_dados ? 'observacoes'
                          THEN NULLIF(p_dados->>'observacoes', '')
                        ELSE observacoes
                      END
  WHERE id = p_pagamento_id;

  INSERT INTO public.audit_pagamentos
    (pagamento_id, empresa_id, acao, user_id, valores_antes, valores_depois, motivo)
  VALUES
    (p_pagamento_id, v_empresa, 'editar', auth.uid(), v_valores_antes,
     (SELECT to_jsonb(p) FROM public.pagamentos_clientes p WHERE p.id = p_pagamento_id),
     NULLIF(TRIM(p_motivo), ''));

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.editar_pagamento_cliente(UUID, JSONB, TEXT) TO authenticated;

-- RPC: excluir pagamento (soft-delete, admin only)
CREATE OR REPLACE FUNCTION public.excluir_pagamento_cliente(
  p_pagamento_id UUID,
  p_motivo       TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa       UUID;
  v_pagamento     RECORD;
  v_valores_antes JSONB;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;
  IF NOT public.is_admin_user(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores podem excluir pagamentos');
  END IF;

  SELECT * INTO v_pagamento
  FROM public.pagamentos_clientes
  WHERE id = p_pagamento_id AND deleted_at IS NULL;

  IF v_pagamento.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pagamento não encontrado ou já excluído');
  END IF;
  IF v_pagamento.empresa_id <> v_empresa THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pagamento não pertence à sua empresa');
  END IF;

  v_valores_antes := to_jsonb(v_pagamento);

  UPDATE public.pagamentos_clientes SET
    deleted_at = NOW(),
    deleted_by = auth.uid()
  WHERE id = p_pagamento_id;

  INSERT INTO public.audit_pagamentos
    (pagamento_id, empresa_id, acao, user_id, valores_antes, motivo)
  VALUES
    (p_pagamento_id, v_empresa, 'excluir', auth.uid(), v_valores_antes,
     NULLIF(TRIM(p_motivo), ''));

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.excluir_pagamento_cliente(UUID, TEXT) TO authenticated;