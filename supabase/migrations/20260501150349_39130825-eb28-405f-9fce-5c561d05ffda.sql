DROP FUNCTION IF EXISTS public.get_dashboard_summary(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_inicio timestamptz DEFAULT date_trunc('month', now()),
  p_fim timestamptz DEFAULT date_trunc('month', now()) + interval '1 month'
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_can_see_financeiro boolean := false;
  v_user_perfil text;
  v_perm_financeiro jsonb;
  v_empresa_id uuid;
  v_period_start timestamptz := COALESCE(p_inicio, date_trunc('month', now()));
  v_period_end timestamptz := COALESCE(p_fim, COALESCE(p_inicio, date_trunc('month', now())) + interval '1 month');
  v_result json;
BEGIN
  SELECT pa.nome_perfil, pa.permissoes, up.empresa_id
  INTO v_user_perfil, v_perm_financeiro, v_empresa_id
  FROM public.user_profiles up
  LEFT JOIN public.perfis_acesso pa ON pa.id = up.perfil_id
  WHERE (up.user_id = auth.uid() OR up.id = auth.uid())
    AND up.ativo = true
  ORDER BY up.created_at ASC
  LIMIT 1;

  IF v_user_perfil IN ('admin', 'Administrador', 'Gerente', 'Financeiro') THEN
    v_can_see_financeiro := true;
  ELSIF v_perm_financeiro IS NOT NULL THEN
    v_can_see_financeiro := COALESCE(
      (v_perm_financeiro->'financeiro'->>'ver')::boolean,
      false
    );
  END IF;

  SELECT json_build_object(
    'ordens', (
      SELECT COALESCE(json_agg(row_to_json(o)), '[]'::json)
      FROM (
        SELECT
          os.id,
          os.numero,
          os.status,
          os.data_entrada,
          os.data_conclusao,
          os.previsao_entrega,
          CASE WHEN v_can_see_financeiro THEN os.valor ELSE NULL END AS valor,
          CASE WHEN v_can_see_financeiro THEN os.valor_total ELSE NULL END AS valor_total,
          CASE WHEN v_can_see_financeiro THEN os.custo_pecas ELSE NULL END AS custo_pecas,
          os.loja_id,
          json_build_object(
            'marca', a.marca,
            'modelo', a.modelo,
            'imei', a.imei,
            'clientes', json_build_object(
              'nome', c.nome,
              'telefone', c.telefone
            )
          ) AS aparelhos
        FROM ordens_de_servico os
        LEFT JOIN aparelhos a ON a.id = os.aparelho_id
        LEFT JOIN clientes c ON c.id = a.cliente_id
        WHERE os.deleted_at IS NULL
          AND os.status::text <> 'cancelado'
        ORDER BY os.data_entrada DESC
      ) o
    ),
    'estoque_baixo', (
      SELECT count(*)
      FROM estoque_itens
      WHERE deleted_at IS NULL
        AND quantidade_minima > 0
        AND quantidade <= quantidade_minima
    ),
    'contas_pendentes', CASE WHEN v_can_see_financeiro THEN (
      SELECT COALESCE(json_agg(row_to_json(cp)), '[]'::json)
      FROM contas_a_pagar cp
      WHERE cp.status = 'pendente'
    ) ELSE '[]'::json END,
    'comissoes_pendentes', CASE WHEN v_can_see_financeiro THEN (
      SELECT COALESCE(json_agg(row_to_json(co)), '[]'::json)
      FROM comissoes co
      WHERE co.status = 'pendente'
        AND co.estornada_em IS NULL
    ) ELSE '[]'::json END,
    'comissoes_periodo_total', CASE WHEN v_can_see_financeiro THEN (
      SELECT COALESCE(SUM(co.valor), 0)
      FROM comissoes co
      WHERE (v_empresa_id IS NULL OR co.empresa_id = v_empresa_id)
        AND co.estornada_em IS NULL
        AND co.status::text IN ('pendente', 'liberada', 'paga')
        AND co.created_at >= v_period_start
        AND co.created_at < v_period_end
    ) ELSE NULL END,
    'comissoes_periodo_a_pagar', CASE WHEN v_can_see_financeiro THEN (
      SELECT COALESCE(SUM(co.valor), 0)
      FROM comissoes co
      WHERE (v_empresa_id IS NULL OR co.empresa_id = v_empresa_id)
        AND co.estornada_em IS NULL
        AND co.status::text IN ('pendente', 'liberada')
        AND co.created_at >= v_period_start
        AND co.created_at < v_period_end
    ) ELSE NULL END,
    'lojas', (
      SELECT COALESCE(json_agg(row_to_json(l)), '[]'::json)
      FROM lojas l
      WHERE l.ativo = true
    ),
    'can_see_financeiro', v_can_see_financeiro
  ) INTO v_result;

  RETURN v_result;
END;
$function$;