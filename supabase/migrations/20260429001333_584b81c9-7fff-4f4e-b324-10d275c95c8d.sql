ALTER TABLE public.movimentacoes_financeiras
  ADD COLUMN IF NOT EXISTS cliente_id uuid,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS forma_pagamento text;

CREATE INDEX IF NOT EXISTS idx_movimentacoes_financeiras_recebimento_cliente
  ON public.movimentacoes_financeiras (empresa_id, cliente_id, data DESC)
  WHERE categoria = 'recebimento_cliente' AND estornada_em IS NULL;

CREATE TABLE IF NOT EXISTS public.pagamentos_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  data_pagamento date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento text NOT NULL DEFAULT 'pix' CHECK (forma_pagamento IN ('pix','dinheiro','cartao_debito','cartao_credito','transferencia','boleto','outro')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_clientes_cliente
  ON public.pagamentos_clientes(cliente_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pagamentos_clientes_empresa_data
  ON public.pagamentos_clientes(empresa_id, data_pagamento DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.pagamentos_clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pagamentos_clientes_select ON public.pagamentos_clientes;
DROP POLICY IF EXISTS pagamentos_clientes_insert ON public.pagamentos_clientes;
DROP POLICY IF EXISTS pagamentos_clientes_update ON public.pagamentos_clientes;
DROP POLICY IF EXISTS pagamentos_clientes_delete ON public.pagamentos_clientes;

CREATE POLICY pagamentos_clientes_select ON public.pagamentos_clientes
  FOR SELECT
  USING (empresa_id = public.get_my_empresa_id());

CREATE POLICY pagamentos_clientes_insert ON public.pagamentos_clientes
  FOR INSERT
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE POLICY pagamentos_clientes_update ON public.pagamentos_clientes
  FOR UPDATE
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE POLICY pagamentos_clientes_delete ON public.pagamentos_clientes
  FOR DELETE
  USING (empresa_id = public.get_my_empresa_id());

CREATE OR REPLACE FUNCTION public.gerar_movimentacao_pagamento_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_nome text;
BEGIN
  SELECT nome INTO v_cliente_nome
  FROM public.clientes
  WHERE id = NEW.cliente_id;

  IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
    INSERT INTO public.movimentacoes_financeiras (
      empresa_id,
      tipo,
      valor,
      data,
      descricao,
      categoria,
      forma_pagamento,
      cliente_id
    ) VALUES (
      NEW.empresa_id,
      'entrada'::public.tipo_movimentacao,
      NEW.valor,
      NEW.data_pagamento::timestamptz,
      'Recebimento de cliente: ' || COALESCE(v_cliente_nome, NEW.cliente_id::text),
      'recebimento_cliente',
      NEW.forma_pagamento,
      NEW.cliente_id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.movimentacoes_financeiras
    WHERE empresa_id = NEW.empresa_id
      AND cliente_id = NEW.cliente_id
      AND categoria = 'recebimento_cliente'
      AND valor = NEW.valor
      AND data::date = NEW.data_pagamento
      AND estornada_em IS NULL;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pagamento_cliente_movimentacao ON public.pagamentos_clientes;

CREATE TRIGGER trg_pagamento_cliente_movimentacao
AFTER INSERT OR UPDATE OF deleted_at ON public.pagamentos_clientes
FOR EACH ROW
EXECUTE FUNCTION public.gerar_movimentacao_pagamento_cliente();

CREATE OR REPLACE FUNCTION public.get_saldo_cliente(p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_total_faturado numeric := 0;
  v_total_recebido numeric := 0;
  v_qtd_oss int := 0;
  v_qtd_pag int := 0;
  v_ultima_os date;
  v_ultimo_pag date;
BEGIN
  v_empresa := public.get_my_empresa_id();

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clientes
    WHERE id = p_cliente_id
      AND empresa_id = v_empresa
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cliente não encontrado ou sem permissão';
  END IF;

  SELECT
    COALESCE(SUM(o.valor_total), 0),
    COUNT(o.id),
    MAX(COALESCE(o.data_conclusao, o.data_entrega, o.data_entrada)::date)
  INTO v_total_faturado, v_qtd_oss, v_ultima_os
  FROM public.ordens_de_servico o
  JOIN public.aparelhos a ON a.id = o.aparelho_id
  WHERE a.cliente_id = p_cliente_id
    AND o.empresa_id = v_empresa
    AND o.deleted_at IS NULL
    AND o.status IN ('pronto','entregue');

  SELECT
    COALESCE(SUM(valor), 0),
    COUNT(id),
    MAX(data_pagamento)
  INTO v_total_recebido, v_qtd_pag, v_ultimo_pag
  FROM public.pagamentos_clientes
  WHERE cliente_id = p_cliente_id
    AND empresa_id = v_empresa
    AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'cliente_id', p_cliente_id,
    'total_faturado', v_total_faturado,
    'total_recebido', v_total_recebido,
    'saldo_devedor', v_total_faturado - v_total_recebido,
    'qtd_oss_faturadas', v_qtd_oss,
    'qtd_pagamentos', v_qtd_pag,
    'ultima_os_data', v_ultima_os,
    'ultimo_pagamento_data', v_ultimo_pag
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_saldos_clientes_resumo()
RETURNS TABLE (
  cliente_id uuid,
  nome text,
  total_faturado numeric,
  total_recebido numeric,
  saldo_devedor numeric,
  qtd_oss int,
  ultima_os_data date,
  ultimo_pagamento_data date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
BEGIN
  v_empresa := public.get_my_empresa_id();

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada';
  END IF;

  RETURN QUERY
  WITH os_por_cliente AS (
    SELECT
      a.cliente_id,
      COALESCE(SUM(o.valor_total), 0)::numeric AS total_faturado,
      COUNT(o.id)::int AS qtd_oss,
      MAX(COALESCE(o.data_conclusao, o.data_entrega, o.data_entrada)::date) AS ultima_os_data
    FROM public.ordens_de_servico o
    JOIN public.aparelhos a ON a.id = o.aparelho_id
    WHERE o.empresa_id = v_empresa
      AND o.deleted_at IS NULL
      AND o.status IN ('pronto','entregue')
    GROUP BY a.cliente_id
  ), pagamentos_por_cliente AS (
    SELECT
      p.cliente_id,
      COALESCE(SUM(p.valor), 0)::numeric AS total_recebido,
      MAX(p.data_pagamento) AS ultimo_pagamento_data
    FROM public.pagamentos_clientes p
    WHERE p.empresa_id = v_empresa
      AND p.deleted_at IS NULL
    GROUP BY p.cliente_id
  )
  SELECT
    c.id,
    c.nome,
    COALESCE(o.total_faturado, 0)::numeric,
    COALESCE(p.total_recebido, 0)::numeric,
    (COALESCE(o.total_faturado, 0) - COALESCE(p.total_recebido, 0))::numeric,
    COALESCE(o.qtd_oss, 0)::int,
    o.ultima_os_data,
    p.ultimo_pagamento_data
  FROM public.clientes c
  LEFT JOIN os_por_cliente o ON o.cliente_id = c.id
  LEFT JOIN pagamentos_por_cliente p ON p.cliente_id = c.id
  WHERE c.empresa_id = v_empresa
    AND c.deleted_at IS NULL
  ORDER BY (COALESCE(o.total_faturado, 0) - COALESCE(p.total_recebido, 0)) DESC, c.nome ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_extrato_cliente(
  p_cliente_id uuid,
  p_inicio date DEFAULT NULL,
  p_fim date DEFAULT NULL
)
RETURNS TABLE (
  data date,
  tipo text,
  referencia_id uuid,
  descricao text,
  debito numeric,
  credito numeric,
  saldo_apos numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
BEGIN
  v_empresa := public.get_my_empresa_id();

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clientes
    WHERE id = p_cliente_id
      AND empresa_id = v_empresa
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cliente não encontrado ou sem permissão';
  END IF;

  RETURN QUERY
  WITH eventos AS (
    SELECT
      COALESCE(o.data_conclusao, o.data_entrega, o.data_entrada)::date AS data_evento,
      'os'::text AS tipo,
      o.id AS referencia_id,
      'OS #' || COALESCE(o.numero_formatado, o.numero::text) || ' - ' || trim(COALESCE(a.marca, '') || ' ' || COALESCE(a.modelo, '')) AS descricao,
      COALESCE(o.valor_total, 0)::numeric AS debito,
      0::numeric AS credito,
      o.created_at
    FROM public.ordens_de_servico o
    JOIN public.aparelhos a ON a.id = o.aparelho_id
    WHERE a.cliente_id = p_cliente_id
      AND o.empresa_id = v_empresa
      AND o.deleted_at IS NULL
      AND o.status IN ('pronto','entregue')
      AND (p_inicio IS NULL OR COALESCE(o.data_conclusao, o.data_entrega, o.data_entrada)::date >= p_inicio)
      AND (p_fim IS NULL OR COALESCE(o.data_conclusao, o.data_entrega, o.data_entrada)::date <= p_fim)

    UNION ALL

    SELECT
      p.data_pagamento AS data_evento,
      'pagamento'::text AS tipo,
      p.id AS referencia_id,
      'Pagamento ' || p.forma_pagamento || COALESCE(' - ' || NULLIF(p.observacoes, ''), '') AS descricao,
      0::numeric AS debito,
      p.valor::numeric AS credito,
      p.created_at
    FROM public.pagamentos_clientes p
    WHERE p.cliente_id = p_cliente_id
      AND p.empresa_id = v_empresa
      AND p.deleted_at IS NULL
      AND (p_inicio IS NULL OR p.data_pagamento >= p_inicio)
      AND (p_fim IS NULL OR p.data_pagamento <= p_fim)
  ), ordenado AS (
    SELECT
      eventos.*,
      SUM(debito - credito) OVER (ORDER BY data_evento ASC, created_at ASC, referencia_id ASC) AS saldo_evolutivo
    FROM eventos
  )
  SELECT
    o.data_evento,
    o.tipo,
    o.referencia_id,
    o.descricao,
    o.debito,
    o.credito,
    o.saldo_evolutivo
  FROM ordenado o
  ORDER BY o.data_evento DESC, o.created_at DESC, o.referencia_id DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_pagamento_cliente(
  p_cliente_id uuid,
  p_valor numeric,
  p_forma text DEFAULT 'pix',
  p_data date DEFAULT CURRENT_DATE,
  p_obs text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_pagamento_id uuid;
  v_user uuid;
  v_saldo numeric;
BEGIN
  v_empresa := public.get_my_empresa_id();
  v_user := auth.uid();

  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário sem empresa vinculada');
  END IF;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor deve ser maior que zero');
  END IF;

  IF COALESCE(p_forma, 'pix') NOT IN ('pix','dinheiro','cartao_debito','cartao_credito','transferencia','boleto','outro') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forma de pagamento inválida');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clientes
    WHERE id = p_cliente_id
      AND empresa_id = v_empresa
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  INSERT INTO public.pagamentos_clientes (
    empresa_id,
    cliente_id,
    valor,
    data_pagamento,
    forma_pagamento,
    observacoes,
    created_by
  ) VALUES (
    v_empresa,
    p_cliente_id,
    p_valor,
    COALESCE(p_data, CURRENT_DATE),
    COALESCE(p_forma, 'pix'),
    p_obs,
    v_user
  ) RETURNING id INTO v_pagamento_id;

  SELECT (public.get_saldo_cliente(p_cliente_id)->>'saldo_devedor')::numeric INTO v_saldo;

  RETURN jsonb_build_object(
    'success', true,
    'pagamento_id', v_pagamento_id,
    'saldo_devedor_atual', v_saldo
  );
END;
$$;