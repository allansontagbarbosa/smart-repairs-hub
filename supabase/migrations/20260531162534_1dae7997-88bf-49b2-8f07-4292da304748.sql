
CREATE TABLE IF NOT EXISTS public.atacado_pedidos_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.atacado_pedidos(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  motivo TEXT,
  usuario_id UUID,
  funcionario_id UUID REFERENCES public.funcionarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT ON public.atacado_pedidos_historico TO authenticated;
GRANT ALL ON public.atacado_pedidos_historico TO service_role;

ALTER TABLE public.atacado_pedidos_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_via_pedido ON public.atacado_pedidos_historico;
CREATE POLICY tenant_via_pedido ON public.atacado_pedidos_historico
FOR ALL TO authenticated
USING (
  pedido_id IN (
    SELECT p.id FROM public.atacado_pedidos p
    WHERE p.empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  pedido_id IN (
    SELECT p.id FROM public.atacado_pedidos p
    WHERE p.empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid())
  )
);

CREATE INDEX IF NOT EXISTS idx_atacado_pedidos_historico_pedido ON public.atacado_pedidos_historico(pedido_id, created_at DESC);

-- RPC unificado de mudança de status
CREATE OR REPLACE FUNCTION public.atacado_mudar_status_pedido(
  p_pedido_id UUID,
  p_novo_status TEXT,
  p_motivo TEXT DEFAULT NULL,
  p_nfe_numero TEXT DEFAULT NULL,
  p_nfe_chave TEXT DEFAULT NULL
)
RETURNS TABLE (sucesso BOOLEAN, status_anterior TEXT, status_novo TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status_atual TEXT;
  v_empresa_id UUID;
  v_funcionario_id UUID;
BEGIN
  SELECT status, empresa_id INTO v_status_atual, v_empresa_id
  FROM public.atacado_pedidos WHERE id = p_pedido_id;

  IF v_status_atual IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  SELECT funcionario_id INTO v_funcionario_id
  FROM public.user_profiles WHERE user_id = auth.uid();

  IF v_status_atual = 'cancelado' AND p_novo_status NOT IN ('rascunho','aprovado') THEN
    RAISE EXCEPTION 'Pedido cancelado só pode voltar para rascunho ou ser reaprovado';
  END IF;

  UPDATE public.atacado_pedidos SET
    status = p_novo_status,
    aprovado_em = CASE WHEN p_novo_status = 'aprovado' AND aprovado_em IS NULL THEN NOW() ELSE aprovado_em END,
    aprovado_por = CASE WHEN p_novo_status = 'aprovado' AND aprovado_por IS NULL THEN v_funcionario_id ELSE aprovado_por END,
    faturado_em = CASE WHEN p_novo_status = 'faturado' AND faturado_em IS NULL THEN NOW() ELSE faturado_em END,
    nfe_numero = COALESCE(p_nfe_numero, nfe_numero),
    nfe_chave = COALESCE(p_nfe_chave, nfe_chave),
    updated_at = NOW()
  WHERE id = p_pedido_id;

  IF v_status_atual = 'aguardando_aprovacao' AND p_novo_status = 'aprovado' THEN
    UPDATE public.atacado_aparelhos a
    SET quantidade = GREATEST(0, a.quantidade - i.quantidade),
        status = CASE WHEN a.quantidade - i.quantidade <= 0 THEN 'vendido' ELSE a.status END
    FROM public.atacado_pedidos_itens i
    WHERE i.pedido_id = p_pedido_id AND i.aparelho_id = a.id;
  END IF;

  IF v_status_atual IN ('aprovado','faturado') AND p_novo_status = 'cancelado' THEN
    UPDATE public.atacado_aparelhos a
    SET quantidade = a.quantidade + i.quantidade,
        status = CASE WHEN a.status = 'vendido' THEN 'estoque' ELSE a.status END
    FROM public.atacado_pedidos_itens i
    WHERE i.pedido_id = p_pedido_id AND i.aparelho_id = a.id;

    UPDATE public.atacado_pedidos_pagamentos SET status = 'cancelado'
    WHERE pedido_id = p_pedido_id AND status IN ('aberto','atrasado');
  END IF;

  INSERT INTO public.atacado_pedidos_historico (pedido_id, status_anterior, status_novo, motivo, usuario_id, funcionario_id)
  VALUES (p_pedido_id, v_status_atual, p_novo_status, p_motivo, auth.uid(), v_funcionario_id);

  RETURN QUERY SELECT TRUE, v_status_atual, p_novo_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.atacado_mudar_status_pedido(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
