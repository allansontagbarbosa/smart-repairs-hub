DROP FUNCTION IF EXISTS public.get_extrato_cliente(uuid, date, date);

CREATE OR REPLACE FUNCTION public.get_extrato_cliente(
  p_cliente_id uuid,
  p_inicio date DEFAULT NULL::date,
  p_fim date DEFAULT NULL::date
)
RETURNS TABLE(
  data date,
  tipo text,
  referencia_id uuid,
  descricao text,
  imei text,
  modelo_aparelho text,
  servicos_realizados text,
  debito numeric,
  credito numeric,
  saldo_apos numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      'os'::text AS tipo_evento,
      o.id AS ref_id,
      'OS #' || COALESCE(o.numero_formatado, o.numero::text) AS desc_evento,
      NULLIF(a.imei, '')::text AS imei_evento,
      NULLIF(concat_ws(' - ', NULLIF(trim(concat_ws(' ', a.marca, a.modelo)), ''), NULLIF(a.cor, ''), NULLIF(a.capacidade, '')), '')::text AS modelo_evento,
      NULLIF(servicos.servicos_realizados, '')::text AS servicos_evento,
      COALESCE(o.valor_total, 0)::numeric AS valor_debito,
      0::numeric AS valor_credito,
      o.created_at AS criado_em
    FROM public.ordens_de_servico o
    JOIN public.aparelhos a ON a.id = o.aparelho_id
    LEFT JOIN LATERAL (
      SELECT string_agg(DISTINCT COALESCE(ts.nome, os.nome), ', ' ORDER BY COALESCE(ts.nome, os.nome)) AS servicos_realizados
      FROM public.os_servicos os
      LEFT JOIN public.tipos_servico ts ON ts.id = os.servico_id
      WHERE os.ordem_id = o.id
        AND COALESCE(ts.nome, os.nome) IS NOT NULL
    ) servicos ON true
    WHERE a.cliente_id = p_cliente_id
      AND o.empresa_id = v_empresa
      AND o.deleted_at IS NULL
      AND o.status IN ('pronto','entregue')
      AND (p_inicio IS NULL OR COALESCE(o.data_conclusao, o.data_entrega, o.data_entrada)::date >= p_inicio)
      AND (p_fim IS NULL OR COALESCE(o.data_conclusao, o.data_entrega, o.data_entrada)::date <= p_fim)

    UNION ALL

    SELECT
      p.data_pagamento AS data_evento,
      'pagamento'::text AS tipo_evento,
      p.id AS ref_id,
      'Pagamento ' || p.forma_pagamento || COALESCE(' - ' || NULLIF(p.observacoes, ''), '') AS desc_evento,
      NULL::text AS imei_evento,
      NULL::text AS modelo_evento,
      NULL::text AS servicos_evento,
      0::numeric AS valor_debito,
      p.valor::numeric AS valor_credito,
      p.created_at AS criado_em
    FROM public.pagamentos_clientes p
    WHERE p.cliente_id = p_cliente_id
      AND p.empresa_id = v_empresa
      AND p.deleted_at IS NULL
      AND (p_inicio IS NULL OR p.data_pagamento >= p_inicio)
      AND (p_fim IS NULL OR p.data_pagamento <= p_fim)
  ), ordenado AS (
    SELECT
      e.*,
      SUM(e.valor_debito - e.valor_credito) OVER (ORDER BY e.data_evento ASC, e.criado_em ASC, e.ref_id ASC) AS saldo_evolutivo
    FROM eventos e
  )
  SELECT
    o.data_evento,
    o.tipo_evento,
    o.ref_id,
    o.desc_evento,
    o.imei_evento,
    o.modelo_evento,
    o.servicos_evento,
    o.valor_debito,
    o.valor_credito,
    o.saldo_evolutivo
  FROM ordenado o
  ORDER BY o.data_evento DESC, o.criado_em DESC, o.ref_id DESC;
END;
$function$;