CREATE TABLE IF NOT EXISTS public.recebimentos_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  data_pagamento date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento text NOT NULL DEFAULT 'pix'
    CHECK (forma_pagamento IN ('pix','dinheiro','transferencia','cartao_credito','cartao_debito','boleto','cheque','outro')),
  observacoes text,
  movimentacao_financeira_id uuid REFERENCES public.movimentacoes_financeiras(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_recebimentos_cliente
  ON public.recebimentos_clientes(cliente_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_recebimentos_empresa
  ON public.recebimentos_clientes(empresa_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_recebimentos_data
  ON public.recebimentos_clientes(data_pagamento DESC);

ALTER TABLE public.recebimentos_clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rec_cli_select_empresa ON public.recebimentos_clientes;
DROP POLICY IF EXISTS rec_cli_insert_empresa ON public.recebimentos_clientes;
DROP POLICY IF EXISTS rec_cli_update_empresa ON public.recebimentos_clientes;
DROP POLICY IF EXISTS rec_cli_delete_empresa ON public.recebimentos_clientes;

CREATE POLICY rec_cli_select_empresa ON public.recebimentos_clientes
  FOR SELECT USING (empresa_id = public.get_my_empresa_id());

CREATE POLICY rec_cli_insert_empresa ON public.recebimentos_clientes
  FOR INSERT WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE POLICY rec_cli_update_empresa ON public.recebimentos_clientes
  FOR UPDATE USING (empresa_id = public.get_my_empresa_id());

CREATE POLICY rec_cli_delete_empresa ON public.recebimentos_clientes
  FOR DELETE USING (empresa_id = public.get_my_empresa_id());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_recebimentos_clientes_updated_at'
      AND tgrelid = 'public.recebimentos_clientes'::regclass
  ) THEN
    CREATE TRIGGER trg_recebimentos_clientes_updated_at
    BEFORE UPDATE ON public.recebimentos_clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_updated_at();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.saldo_devedor_cliente(p_cliente_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.get_my_empresa_id();
  v_faturado numeric;
  v_recebido numeric;
BEGIN
  SELECT COALESCE(SUM(COALESCE(o.valor_total, 0)), 0)
  INTO v_faturado
  FROM public.ordens_de_servico o
  JOIN public.aparelhos a ON a.id = o.aparelho_id
  WHERE a.cliente_id = p_cliente_id
    AND o.empresa_id = v_empresa
    AND o.deleted_at IS NULL
    AND o.status IN ('pronto', 'entregue');

  SELECT COALESCE(SUM(valor), 0)
  INTO v_recebido
  FROM public.recebimentos_clientes
  WHERE cliente_id = p_cliente_id
    AND empresa_id = v_empresa
    AND deleted_at IS NULL;

  RETURN v_faturado - v_recebido;
END;
$$;

CREATE OR REPLACE FUNCTION public.extrato_cliente(
  p_cliente_id uuid,
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL
)
RETURNS TABLE (
  tipo text,
  referencia_id uuid,
  referencia_numero text,
  descricao text,
  valor numeric,
  data timestamptz,
  saldo_apos numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.get_my_empresa_id();
BEGIN
  RETURN QUERY
  WITH eventos AS (
    SELECT
      'os'::text AS tipo,
      o.id AS referencia_id,
      o.numero_formatado AS referencia_numero,
      COALESCE(NULLIF(trim(concat_ws(' ', a.marca, a.modelo)), ''), 'OS #' || COALESCE(o.numero_formatado, o.numero::text)) AS descricao,
      COALESCE(o.valor_total, 0)::numeric AS valor,
      COALESCE(o.data_conclusao, o.created_at) AS data
    FROM public.ordens_de_servico o
    JOIN public.aparelhos a ON a.id = o.aparelho_id
    WHERE a.cliente_id = p_cliente_id
      AND o.empresa_id = v_empresa
      AND o.deleted_at IS NULL
      AND o.status IN ('pronto', 'entregue')
      AND (p_inicio IS NULL OR COALESCE(o.data_conclusao, o.created_at) >= p_inicio)
      AND (p_fim IS NULL OR COALESCE(o.data_conclusao, o.created_at) < p_fim)

    UNION ALL

    SELECT
      'pagamento'::text AS tipo,
      r.id AS referencia_id,
      NULL::text AS referencia_numero,
      'Pagamento ' || r.forma_pagamento || COALESCE(' — ' || NULLIF(r.observacoes, ''), '') AS descricao,
      (-r.valor)::numeric AS valor,
      r.data_pagamento::timestamptz AS data
    FROM public.recebimentos_clientes r
    WHERE r.cliente_id = p_cliente_id
      AND r.empresa_id = v_empresa
      AND r.deleted_at IS NULL
      AND (p_inicio IS NULL OR r.data_pagamento::timestamptz >= p_inicio)
      AND (p_fim IS NULL OR r.data_pagamento::timestamptz < p_fim)
  )
  SELECT
    e.tipo,
    e.referencia_id,
    e.referencia_numero,
    e.descricao,
    e.valor,
    e.data,
    SUM(e.valor) OVER (ORDER BY e.data, e.tipo, e.referencia_id ROWS UNBOUNDED PRECEDING) AS saldo_apos
  FROM eventos e
  ORDER BY e.data, e.tipo, e.referencia_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_recebimento_cliente(
  p_cliente_id uuid,
  p_valor numeric,
  p_forma_pagamento text DEFAULT 'pix',
  p_data_pagamento date DEFAULT CURRENT_DATE,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.get_my_empresa_id();
  v_user uuid := auth.uid();
  v_recebimento_id uuid;
  v_movimentacao_id uuid;
  v_cliente_nome text;
BEGIN
  IF p_valor <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor deve ser maior que zero');
  END IF;

  IF p_forma_pagamento NOT IN ('pix','dinheiro','transferencia','cartao_credito','cartao_debito','boleto','cheque','outro') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forma de pagamento inválida');
  END IF;

  SELECT nome
  INTO v_cliente_nome
  FROM public.clientes
  WHERE id = p_cliente_id
    AND empresa_id = v_empresa
    AND deleted_at IS NULL;

  IF v_cliente_nome IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  INSERT INTO public.recebimentos_clientes (
    empresa_id,
    cliente_id,
    valor,
    forma_pagamento,
    data_pagamento,
    observacoes,
    created_by
  ) VALUES (
    v_empresa,
    p_cliente_id,
    p_valor,
    p_forma_pagamento,
    p_data_pagamento,
    p_observacoes,
    v_user
  )
  RETURNING id INTO v_recebimento_id;

  INSERT INTO public.movimentacoes_financeiras (
    empresa_id,
    tipo,
    valor,
    descricao,
    data
  ) VALUES (
    v_empresa,
    'entrada'::public.tipo_movimentacao,
    p_valor,
    'Recebimento — ' || v_cliente_nome || COALESCE(' (' || NULLIF(p_observacoes, '') || ')', ''),
    p_data_pagamento::timestamptz
  )
  RETURNING id INTO v_movimentacao_id;

  UPDATE public.recebimentos_clientes
  SET movimentacao_financeira_id = v_movimentacao_id
  WHERE id = v_recebimento_id;

  RETURN jsonb_build_object(
    'success', true,
    'recebimento_id', v_recebimento_id,
    'movimentacao_id', v_movimentacao_id,
    'novo_saldo', public.saldo_devedor_cliente(p_cliente_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.estornar_recebimento_cliente(p_recebimento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.get_my_empresa_id();
  v_mov_id uuid;
  v_cliente_id uuid;
BEGIN
  SELECT movimentacao_financeira_id, cliente_id
  INTO v_mov_id, v_cliente_id
  FROM public.recebimentos_clientes
  WHERE id = p_recebimento_id
    AND empresa_id = v_empresa
    AND deleted_at IS NULL;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recebimento não encontrado');
  END IF;

  UPDATE public.recebimentos_clientes
  SET deleted_at = now()
  WHERE id = p_recebimento_id;

  IF v_mov_id IS NOT NULL THEN
    DELETE FROM public.movimentacoes_financeiras
    WHERE id = v_mov_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'novo_saldo', public.saldo_devedor_cliente(v_cliente_id)
  );
END;
$$;