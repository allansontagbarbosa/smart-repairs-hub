
-- 1) Tabela de recebimentos
CREATE TABLE IF NOT EXISTS public.atacado_recebimentos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id),
  pagamento_id uuid NOT NULL REFERENCES public.atacado_pedidos_pagamentos(id) ON DELETE CASCADE,
  valor        numeric NOT NULL CHECK (valor > 0),
  forma        text,
  data         date NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_recebimentos TO authenticated;
GRANT ALL ON public.atacado_recebimentos TO service_role;

ALTER TABLE public.atacado_recebimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atacado_recebimentos_empresa" ON public.atacado_recebimentos;
CREATE POLICY "atacado_recebimentos_empresa" ON public.atacado_recebimentos
  FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE INDEX IF NOT EXISTS idx_atacado_recebimentos_pagamento
  ON public.atacado_recebimentos(pagamento_id);

-- 2) Coluna de valor já pago
ALTER TABLE public.atacado_pedidos_pagamentos
  ADD COLUMN IF NOT EXISTS valor_pago numeric NOT NULL DEFAULT 0;

-- 3) Migrar parcelas já 'pago'
INSERT INTO public.atacado_recebimentos (empresa_id, pagamento_id, valor, forma, data, created_at)
SELECT ped.empresa_id, pg.id, pg.valor,
       COALESCE(pg.forma_recebido, pg.forma),
       COALESCE(pg.pago_em::date, pg.created_at::date, CURRENT_DATE),
       COALESCE(pg.pago_em, pg.created_at, now())
FROM public.atacado_pedidos_pagamentos pg
JOIN public.atacado_pedidos ped ON ped.id = pg.pedido_id
WHERE pg.status = 'pago'
  AND NOT EXISTS (SELECT 1 FROM public.atacado_recebimentos r WHERE r.pagamento_id = pg.id);

UPDATE public.atacado_pedidos_pagamentos pg
SET valor_pago = COALESCE(
  (SELECT SUM(r.valor) FROM public.atacado_recebimentos r WHERE r.pagamento_id = pg.id), 0);

-- 4) RPC receber (parcial ou total)
CREATE OR REPLACE FUNCTION public.atacado_receber_pagamento(
  p_pagamento_id uuid,
  p_valor numeric,
  p_forma text DEFAULT NULL,
  p_data date DEFAULT CURRENT_DATE
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid; v_valor numeric; v_pago numeric; v_saldo numeric; v_aplicar numeric; v_status text;
BEGIN
  v_emp := public.get_my_empresa_id();
  SELECT pg.valor, COALESCE(pg.valor_pago,0) INTO v_valor, v_pago
  FROM public.atacado_pedidos_pagamentos pg
  JOIN public.atacado_pedidos ped ON ped.id = pg.pedido_id
  WHERE pg.id = p_pagamento_id AND ped.empresa_id = v_emp;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parcela não encontrada');
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor inválido');
  END IF;
  v_saldo := v_valor - v_pago;
  IF v_saldo <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parcela já quitada');
  END IF;
  v_aplicar := LEAST(p_valor, v_saldo);

  INSERT INTO public.atacado_recebimentos (empresa_id, pagamento_id, valor, forma, data)
  VALUES (v_emp, p_pagamento_id, v_aplicar, p_forma, COALESCE(p_data, CURRENT_DATE));

  v_pago := v_pago + v_aplicar;
  v_status := CASE WHEN v_pago >= v_valor THEN 'pago'
                   WHEN v_pago > 0 THEN 'parcial' ELSE 'pendente' END;

  UPDATE public.atacado_pedidos_pagamentos SET
    valor_pago = v_pago,
    status = v_status,
    pago_em = CASE WHEN v_status = 'pago' THEN COALESCE(p_data, CURRENT_DATE)::timestamptz ELSE pago_em END,
    forma_recebido = COALESCE(p_forma, forma_recebido, forma)
  WHERE id = p_pagamento_id;

  RETURN jsonb_build_object('success', true, 'status', v_status,
                            'valor_pago', v_pago, 'saldo', v_valor - v_pago);
END; $$;

GRANT EXECUTE ON FUNCTION public.atacado_receber_pagamento(uuid, numeric, text, date) TO authenticated;

-- 5) Redefinir baixa total para usar o novo fluxo
CREATE OR REPLACE FUNCTION public.atacado_baixar_pagamento(
  p_pagamento_id uuid,
  p_forma_recebido text DEFAULT NULL,
  p_data_recebimento date DEFAULT CURRENT_DATE
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_saldo numeric;
BEGIN
  v_emp := public.get_my_empresa_id();
  SELECT (pg.valor - COALESCE(pg.valor_pago,0)) INTO v_saldo
  FROM public.atacado_pedidos_pagamentos pg
  JOIN public.atacado_pedidos ped ON ped.id = pg.pedido_id
  WHERE pg.id = p_pagamento_id AND ped.empresa_id = v_emp;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_saldo > 0 THEN
    PERFORM public.atacado_receber_pagamento(p_pagamento_id, v_saldo, p_forma_recebido, p_data_recebimento);
  END IF;
  RETURN true;
END; $$;
