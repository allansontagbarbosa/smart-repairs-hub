
-- 1) FIX portal_dashboard_lojista
CREATE OR REPLACE FUNCTION public.portal_dashboard_lojista()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_grupo_id uuid;
  v_grupo_nome text;
  v_cliente_ids uuid[];
  v_aparelho_ids uuid[];
  v_faturado numeric := 0;
  v_pago numeric := 0;
  v_devedor numeric := 0;
  v_total_ordens int := 0;
  v_entregues int := 0;
  v_canceladas int := 0;
  v_garantias int := 0;
  v_ultimas jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT lg.id, lg.nome INTO v_grupo_id, v_grupo_nome
    FROM lojista_grupos lg
   WHERE lg.user_id = v_user_id
     AND lg.status_acesso = 'ativo'
     AND lg.convite_aceito_em IS NOT NULL
   LIMIT 1;

  IF v_grupo_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_cliente_ids
    FROM clientes WHERE grupo_id = v_grupo_id AND deleted_at IS NULL;

  IF array_length(v_cliente_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'cliente_id', v_grupo_id, 'cliente_nome', v_grupo_nome,
      'grupo_id', v_grupo_id, 'grupo_nome', v_grupo_nome,
      'saldo', jsonb_build_object('faturado', 0, 'pago', 0, 'devedor', 0),
      'ordens', jsonb_build_object('total', 0, 'entregues', 0, 'canceladas', 0),
      'garantias_ativas', 0,
      'ultimas_ordens', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_aparelho_ids
    FROM aparelhos WHERE cliente_id = ANY(v_cliente_ids);

  SELECT COALESCE(SUM(COALESCE(valor_total, 0)), 0) INTO v_faturado
    FROM ordens_de_servico
   WHERE aparelho_id = ANY(v_aparelho_ids)
     AND deleted_at IS NULL
     AND status = 'entregue'::status_ordem;

  SELECT COALESCE(SUM(COALESCE(valor, 0)), 0) INTO v_pago
    FROM pagamentos_clientes
   WHERE cliente_id = ANY(v_cliente_ids) AND deleted_at IS NULL;

  v_devedor := GREATEST(v_faturado - v_pago, 0);

  SELECT
    COUNT(*) FILTER (WHERE status <> 'cancelado'::status_ordem),
    COUNT(*) FILTER (WHERE status = 'entregue'::status_ordem),
    COUNT(*) FILTER (WHERE status = 'cancelado'::status_ordem)
    INTO v_total_ordens, v_entregues, v_canceladas
    FROM ordens_de_servico
   WHERE aparelho_id = ANY(v_aparelho_ids) AND deleted_at IS NULL;

  SELECT COUNT(DISTINCT g.id) INTO v_garantias
    FROM garantias g
    JOIN ordens_de_servico os ON os.id = g.ordem_id
   WHERE os.aparelho_id = ANY(v_aparelho_ids)
     AND os.deleted_at IS NULL
     AND os.status = 'entregue'::status_ordem
     AND g.status = 'ativa'
     AND g.data_fim >= CURRENT_DATE;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_ultimas
  FROM (
    SELECT os.id, os.numero, os.status, os.valor_total AS valor,
           os.data_entrada, os.defeito_relatado, a.marca, a.modelo
      FROM ordens_de_servico os
      LEFT JOIN aparelhos a ON a.id = os.aparelho_id
     WHERE os.aparelho_id = ANY(v_aparelho_ids) AND os.deleted_at IS NULL
     ORDER BY os.data_entrada DESC LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', v_grupo_id, 'cliente_nome', v_grupo_nome,
    'grupo_id', v_grupo_id, 'grupo_nome', v_grupo_nome,
    'saldo', jsonb_build_object('faturado', v_faturado, 'pago', v_pago, 'devedor', v_devedor),
    'ordens', jsonb_build_object('total', v_total_ordens, 'entregues', v_entregues, 'canceladas', v_canceladas),
    'garantias_ativas', v_garantias,
    'ultimas_ordens', v_ultimas
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_dashboard_lojista() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_dashboard_lojista() TO authenticated;

-- 2) NOVA portal_minhas_ordens
CREATE OR REPLACE FUNCTION public.portal_minhas_ordens(
  p_status text DEFAULT NULL,
  p_limit  int  DEFAULT 50,
  p_offset int  DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_grupo_id uuid;
  v_cliente_ids uuid[];
  v_aparelho_ids uuid[];
  v_total int := 0;
  v_ordens jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id INTO v_grupo_id FROM lojista_grupos
   WHERE user_id = v_user_id AND status_acesso='ativo' AND convite_aceito_em IS NOT NULL
   LIMIT 1;

  IF v_grupo_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_cliente_ids
    FROM clientes WHERE grupo_id = v_grupo_id AND deleted_at IS NULL;

  IF array_length(v_cliente_ids,1) IS NULL THEN
    RETURN jsonb_build_object('success', true, 'ordens', '[]'::jsonb, 'total', 0);
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_aparelho_ids
    FROM aparelhos WHERE cliente_id = ANY(v_cliente_ids);

  SELECT COUNT(*) INTO v_total
    FROM ordens_de_servico os
   WHERE os.aparelho_id = ANY(v_aparelho_ids)
     AND os.deleted_at IS NULL
     AND (p_status IS NULL OR os.status::text = p_status);

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_ordens
  FROM (
    SELECT
      os.id,
      os.numero,
      'OS-' || lpad(os.numero::text, 6, '0') AS numero_formatado,
      os.status::text AS status,
      COALESCE(os.valor_total, 0) AS valor_total,
      os.data_entrada,
      os.data_conclusao,
      os.data_entrega,
      jsonb_build_object('marca', a.marca, 'modelo', a.modelo, 'imei', a.imei) AS aparelho,
      c.nome AS cliente_nome
      FROM ordens_de_servico os
      LEFT JOIN aparelhos a ON a.id = os.aparelho_id
      LEFT JOIN clientes  c ON c.id = a.cliente_id
     WHERE os.aparelho_id = ANY(v_aparelho_ids)
       AND os.deleted_at IS NULL
       AND (p_status IS NULL OR os.status::text = p_status)
     ORDER BY os.data_entrada DESC
     LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0)
  ) t;

  RETURN jsonb_build_object('success', true, 'ordens', v_ordens, 'total', v_total);
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_minhas_ordens(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_minhas_ordens(text, int, int) TO authenticated;

-- 3) NOVA portal_minhas_faturas
CREATE OR REPLACE FUNCTION public.portal_minhas_faturas(
  p_limit  int DEFAULT 100,
  p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_grupo_id uuid;
  v_cliente_ids uuid[];
  v_aparelho_ids uuid[];
  v_faturado numeric := 0;
  v_pago numeric := 0;
  v_faturas jsonb := '[]'::jsonb;
  v_pagamentos jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id INTO v_grupo_id FROM lojista_grupos
   WHERE user_id = v_user_id AND status_acesso='ativo' AND convite_aceito_em IS NOT NULL
   LIMIT 1;

  IF v_grupo_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_cliente_ids
    FROM clientes WHERE grupo_id = v_grupo_id AND deleted_at IS NULL;

  IF array_length(v_cliente_ids,1) IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'resumo', jsonb_build_object('total_faturado',0,'total_pago',0,'devedor',0),
      'faturas', '[]'::jsonb, 'pagamentos', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_aparelho_ids
    FROM aparelhos WHERE cliente_id = ANY(v_cliente_ids);

  SELECT COALESCE(SUM(COALESCE(valor_total,0)),0) INTO v_faturado
    FROM ordens_de_servico
   WHERE aparelho_id = ANY(v_aparelho_ids)
     AND deleted_at IS NULL
     AND status = 'entregue'::status_ordem;

  SELECT COALESCE(SUM(COALESCE(valor,0)),0) INTO v_pago
    FROM pagamentos_clientes
   WHERE cliente_id = ANY(v_cliente_ids) AND deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_faturas
  FROM (
    SELECT
      os.id,
      os.numero,
      'OS-' || lpad(os.numero::text, 6, '0') AS numero_formatado,
      COALESCE(os.valor_total,0)  AS valor_total,
      COALESCE(os.valor_pago,0)   AS valor_pago,
      COALESCE(os.valor_pendente, GREATEST(COALESCE(os.valor_total,0)-COALESCE(os.valor_pago,0),0)) AS valor_pendente,
      os.data_entrega,
      os.data_conclusao,
      c.nome AS cliente_nome,
      jsonb_build_object('marca', a.marca, 'modelo', a.modelo, 'imei', a.imei) AS aparelho
      FROM ordens_de_servico os
      LEFT JOIN aparelhos a ON a.id = os.aparelho_id
      LEFT JOIN clientes  c ON c.id = a.cliente_id
     WHERE os.aparelho_id = ANY(v_aparelho_ids)
       AND os.deleted_at IS NULL
       AND os.status = 'entregue'::status_ordem
     ORDER BY COALESCE(os.data_entrega, os.data_conclusao, os.data_entrada) DESC
     LIMIT GREATEST(p_limit,0) OFFSET GREATEST(p_offset,0)
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb) INTO v_pagamentos
  FROM (
    SELECT pc.id, pc.cliente_id, c.nome AS cliente_nome,
           pc.valor,
           pc.data_pagamento,
           pc.forma_pagamento,
           pc.created_at
      FROM pagamentos_clientes pc
      LEFT JOIN clientes c ON c.id = pc.cliente_id
     WHERE pc.cliente_id = ANY(v_cliente_ids) AND pc.deleted_at IS NULL
     ORDER BY pc.data_pagamento DESC NULLS LAST, pc.created_at DESC
     LIMIT 200
  ) p;

  RETURN jsonb_build_object(
    'success', true,
    'resumo', jsonb_build_object(
      'total_faturado', v_faturado,
      'total_pago',     v_pago,
      'devedor',        GREATEST(v_faturado - v_pago, 0)
    ),
    'faturas', v_faturas,
    'pagamentos', v_pagamentos
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_minhas_faturas(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_minhas_faturas(int, int) TO authenticated;
