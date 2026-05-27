CREATE OR REPLACE FUNCTION public.fechar_mes(p_mes text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_socio_atual    record;
  v_empresa_id     uuid;
  v_painel         jsonb;
  v_historico      jsonb;
  v_mes_data       jsonb;
  v_faturamento    numeric;
  v_despesas       numeric;
  v_custo_pecas    numeric;
  v_comissoes      numeric;
  v_lucro_liquido  numeric;
  v_reserva_pct    numeric := 10;
  v_reserva_val    numeric;
  v_distribuivel   numeric;
  v_mes_inicio     date;
  v_mes_fim        date;
  v_fechamento_id  uuid;
  v_socio          record;
  v_credito_socio  numeric;
  v_creditos       jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT s.* INTO v_socio_atual
    FROM socios s
   WHERE s.user_id = v_user_id AND s.ativo = true AND s.deleted_at IS NULL
   LIMIT 1;

  IF v_socio_atual.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas sócios podem fechar o mês');
  END IF;

  v_empresa_id := v_socio_atual.empresa_id;

  IF p_mes !~ '^\d{4}-\d{2}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Formato de mês inválido. Use YYYY-MM');
  END IF;

  v_mes_inicio := (p_mes || '-01')::date;
  v_mes_fim    := (v_mes_inicio + INTERVAL '1 month' - INTERVAL '1 day')::date;

  IF v_mes_inicio > CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível fechar um mês futuro');
  END IF;

  IF EXISTS (SELECT 1 FROM fechamentos_mensais WHERE empresa_id = v_empresa_id AND mes = p_mes) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mês ' || p_mes || ' já está fechado. Use reabrir_mes() antes.');
  END IF;

  v_painel := public.get_painel_socio_v1();

  IF NOT (v_painel ? 'historico') THEN
    RETURN jsonb_build_object('success', false, 'error', 'get_painel_socio_v1 não retornou histórico');
  END IF;

  v_historico := v_painel -> 'historico';

  SELECT elem INTO v_mes_data
    FROM jsonb_array_elements(v_historico) elem
   WHERE elem->>'mes' = p_mes
   LIMIT 1;

  IF v_mes_data IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Mês ' || p_mes || ' fora da janela de histórico (últimos 6 meses). Sem dados pra fechar.'
    );
  END IF;

  v_faturamento   := COALESCE((v_mes_data->>'faturamento')::numeric, 0);
  v_despesas      := COALESCE((v_mes_data->>'despesas')::numeric, 0);
  v_custo_pecas   := COALESCE((v_mes_data->>'custo_pecas')::numeric, 0);
  v_comissoes     := COALESCE((v_mes_data->>'comissoes')::numeric, 0);
  v_lucro_liquido := COALESCE((v_mes_data->>'lucro_liquido')::numeric, 0);

  v_reserva_pct := COALESCE(((v_painel->'mes_atual')->>'reserva_pct')::numeric, 10);
  v_reserva_val := ROUND(GREATEST(v_lucro_liquido, 0) * v_reserva_pct / 100, 2);
  v_distribuivel := GREATEST(v_lucro_liquido, 0) - v_reserva_val;

  IF v_lucro_liquido <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Mês ' || p_mes || ' tem lucro líquido ' ||
               CASE WHEN v_lucro_liquido < 0 THEN 'negativo (R$ ' ELSE 'zero (R$ ' END ||
               to_char(v_lucro_liquido, 'FM999G999G990D00') || '). Nada a distribuir.'
    );
  END IF;

  INSERT INTO fechamentos_mensais (
    empresa_id, mes, faturamento, despesas, custo_pecas, comissoes,
    lucro_liquido, reserva_pct, reserva_val, distribuivel, fechado_por
  ) VALUES (
    v_empresa_id, p_mes, v_faturamento, v_despesas, v_custo_pecas, v_comissoes,
    v_lucro_liquido, v_reserva_pct, v_reserva_val, v_distribuivel, v_user_id
  )
  RETURNING id INTO v_fechamento_id;

  FOR v_socio IN
    SELECT id, nome, percentual_participacao
      FROM socios
     WHERE empresa_id = v_empresa_id AND ativo = true AND deleted_at IS NULL
     ORDER BY ordem NULLS LAST, nome
  LOOP
    v_credito_socio := ROUND(v_distribuivel * v_socio.percentual_participacao / 100, 2);
    IF v_credito_socio > 0 THEN
      INSERT INTO extrato_socio (
        empresa_id, socio_id, tipo, valor, descricao, data_movimento, mes_ref, fechamento_id, criado_por
      ) VALUES (
        v_empresa_id, v_socio.id, 'credito_fechamento', v_credito_socio,
        'Distribuição de lucro · ' || p_mes,
        v_mes_fim, p_mes, v_fechamento_id, v_user_id
      );
      v_creditos := v_creditos || jsonb_build_object(
        'socio_id', v_socio.id, 'nome', v_socio.nome,
        'percentual', v_socio.percentual_participacao,
        'valor', v_credito_socio
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'fechamento_id', v_fechamento_id,
    'mes', p_mes,
    'faturamento',  v_faturamento,
    'despesas',     v_despesas,
    'custo_pecas',  v_custo_pecas,
    'comissoes',    v_comissoes,
    'lucro_liquido', v_lucro_liquido,
    'reserva_val',  v_reserva_val,
    'distribuivel', v_distribuivel,
    'creditos', v_creditos,
    'fonte', 'get_painel_socio_v1.historico'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fechar_mes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fechar_mes(text) TO authenticated;