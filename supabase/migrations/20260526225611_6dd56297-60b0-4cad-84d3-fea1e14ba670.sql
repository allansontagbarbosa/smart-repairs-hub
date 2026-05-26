
CREATE OR REPLACE FUNCTION public.portal_dashboard_lojista()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT lg.id, lg.nome
    INTO v_grupo_id, v_grupo_nome
    FROM lojista_grupos lg
   WHERE lg.user_id = v_user_id
     AND lg.status_acesso = 'ativo'
     AND lg.convite_aceito_em IS NOT NULL
   LIMIT 1;

  IF v_grupo_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_cliente_ids
    FROM clientes
   WHERE grupo_id = v_grupo_id
     AND deleted_at IS NULL;

  IF array_length(v_cliente_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'cliente_id', v_grupo_id,
      'cliente_nome', v_grupo_nome,
      'grupo_id', v_grupo_id,
      'grupo_nome', v_grupo_nome,
      'saldo', jsonb_build_object('faturado', 0, 'pago', 0, 'devedor', 0),
      'ordens', jsonb_build_object('total', 0, 'entregues', 0, 'canceladas', 0),
      'garantias_ativas', 0,
      'ultimas_ordens', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_aparelho_ids
    FROM aparelhos
   WHERE cliente_id = ANY(v_cliente_ids);

  SELECT COALESCE(SUM(COALESCE(valor, 0)), 0)
    INTO v_faturado
    FROM ordens_de_servico
   WHERE aparelho_id = ANY(v_aparelho_ids)
     AND deleted_at IS NULL
     AND status <> 'cancelado'::status_ordem;

  SELECT COALESCE(SUM(COALESCE(valor, 0)), 0)
    INTO v_pago
    FROM pagamentos_clientes
   WHERE cliente_id = ANY(v_cliente_ids)
     AND deleted_at IS NULL;

  v_devedor := GREATEST(v_faturado - v_pago, 0);

  SELECT
    COUNT(*) FILTER (WHERE status <> 'cancelado'::status_ordem),
    COUNT(*) FILTER (WHERE status = 'entregue'::status_ordem),
    COUNT(*) FILTER (WHERE status = 'cancelado'::status_ordem)
    INTO v_total_ordens, v_entregues, v_canceladas
    FROM ordens_de_servico
   WHERE aparelho_id = ANY(v_aparelho_ids)
     AND deleted_at IS NULL;

  SELECT COUNT(*)
    INTO v_garantias
    FROM garantias g
    JOIN ordens_de_servico os ON os.id = g.ordem_id
   WHERE os.aparelho_id = ANY(v_aparelho_ids)
     AND g.data_fim >= CURRENT_DATE;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_ultimas
  FROM (
    SELECT os.id, os.numero, os.status, os.valor, os.data_entrada,
           os.defeito_relatado,
           a.marca, a.modelo
      FROM ordens_de_servico os
      LEFT JOIN aparelhos a ON a.id = os.aparelho_id
     WHERE os.aparelho_id = ANY(v_aparelho_ids)
       AND os.deleted_at IS NULL
     ORDER BY os.data_entrada DESC
     LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', v_grupo_id,
    'cliente_nome', v_grupo_nome,
    'grupo_id', v_grupo_id,
    'grupo_nome', v_grupo_nome,
    'saldo', jsonb_build_object('faturado', v_faturado, 'pago', v_pago, 'devedor', v_devedor),
    'ordens', jsonb_build_object('total', v_total_ordens, 'entregues', v_entregues, 'canceladas', v_canceladas),
    'garantias_ativas', v_garantias,
    'ultimas_ordens', v_ultimas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.portal_dashboard_lojista() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_dashboard_lojista() TO authenticated;
