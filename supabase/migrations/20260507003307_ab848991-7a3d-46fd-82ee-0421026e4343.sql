CREATE OR REPLACE FUNCTION public.calcular_progresso_meta(p_meta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_meta record;
  v_atual numeric := 0;
  v_pct numeric := 0;
  v_status text;
  v_escopo text;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;
  SELECT * INTO v_meta FROM metas
  WHERE id = p_meta_id AND empresa_id = v_empresa AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Meta não encontrada');
  END IF;
  v_escopo := v_meta.escopo::text;
  v_atual := CASE v_meta.metrica
    WHEN 'faturamento' THEN public.calc_meta_faturamento(v_meta.periodo_inicio, v_meta.periodo_fim, v_escopo, v_meta.escopo_id)
    WHEN 'qtd_os' THEN public.calc_meta_qtd_os(v_meta.periodo_inicio, v_meta.periodo_fim, v_escopo, v_meta.escopo_id)
    WHEN 'qtd_servicos' THEN public.calc_meta_qtd_servicos(v_meta.periodo_inicio, v_meta.periodo_fim, v_escopo, v_meta.escopo_id)
    WHEN 'ticket_medio' THEN public.calc_meta_ticket_medio(v_meta.periodo_inicio, v_meta.periodo_fim, v_escopo, v_meta.escopo_id)
    WHEN 'comissao_paga' THEN public.calc_meta_comissao_paga(v_meta.periodo_inicio, v_meta.periodo_fim, v_escopo, v_meta.escopo_id)
    WHEN 'margem_os' THEN public.calc_meta_margem_os(v_meta.periodo_inicio, v_meta.periodo_fim, v_escopo, v_meta.escopo_id)
    WHEN 'tempo_medio_horas' THEN public.calc_meta_tempo_medio(v_meta.periodo_inicio, v_meta.periodo_fim, v_escopo, v_meta.escopo_id)
    WHEN 'retrabalho_taxa' THEN public.calc_meta_retrabalho(v_meta.periodo_inicio, v_meta.periodo_fim, v_escopo, v_meta.escopo_id)
    WHEN 'aprovacao_orcamento_taxa' THEN public.calc_meta_aprovacao_orcamento(v_meta.periodo_inicio, v_meta.periodo_fim, v_escopo, v_meta.escopo_id)
    WHEN 'retorno_cliente_30d' THEN public.calc_meta_retorno_cliente(v_meta.periodo_inicio, v_meta.periodo_fim, v_escopo, v_meta.escopo_id)
    ELSE 0
  END;
  v_pct := CASE WHEN v_meta.valor_alvo > 0 THEN (v_atual / v_meta.valor_alvo) * 100 ELSE 0 END;
  v_status := CASE
    WHEN v_meta.sentido = 'maior' AND v_pct >= 100 THEN 'verde'
    WHEN v_meta.sentido = 'maior' AND v_pct >= v_meta.threshold_alerta THEN 'amarelo'
    WHEN v_meta.sentido = 'maior' AND v_pct >= v_meta.threshold_atencao THEN 'cinza'
    WHEN v_meta.sentido = 'maior' AND CURRENT_DATE > v_meta.periodo_fim THEN 'vermelho'
    WHEN v_meta.sentido = 'menor' AND v_atual <= v_meta.valor_alvo THEN 'verde'
    WHEN v_meta.sentido = 'menor' AND v_atual <= v_meta.valor_alvo * 1.2 THEN 'amarelo'
    WHEN v_meta.sentido = 'menor' AND CURRENT_DATE > v_meta.periodo_fim THEN 'vermelho'
    ELSE 'cinza'
  END;
  UPDATE metas SET valor_atual = v_atual WHERE id = p_meta_id;
  RETURN jsonb_build_object(
    'success', true,
    'meta_id', p_meta_id,
    'valor_atual', v_atual,
    'valor_alvo', v_meta.valor_alvo,
    'percentual', v_pct,
    'status_visual', v_status,
    'periodo_inicio', v_meta.periodo_inicio,
    'periodo_fim', v_meta.periodo_fim,
    'dias_restantes', GREATEST(0, v_meta.periodo_fim - CURRENT_DATE),
    'sentido', v_meta.sentido,
    'metrica', v_meta.metrica
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcular_progresso_meta(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_metas_com_progresso(p_status text DEFAULT 'ativa')
RETURNS jsonb
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_resultado jsonb;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'nome', m.nome,
      'descricao', m.descricao,
      'metrica', m.metrica,
      'sentido', m.sentido,
      'periodo_inicio', m.periodo_inicio,
      'periodo_fim', m.periodo_fim,
      'escopo', m.escopo,
      'escopo_id', m.escopo_id,
      'valor_alvo', m.valor_alvo,
      'valor_atual', m.valor_atual,
      'threshold_atencao', m.threshold_atencao,
      'threshold_alerta', m.threshold_alerta,
      'status', m.status,
      'created_at', m.created_at,
      'progresso', public.calcular_progresso_meta(m.id)
    ) ORDER BY m.periodo_fim ASC
  ) INTO v_resultado
  FROM metas m
  WHERE m.empresa_id = v_empresa AND m.deleted_at IS NULL
    AND (p_status IS NULL OR m.status::text = p_status);
  RETURN jsonb_build_object('success', true, 'metas', COALESCE(v_resultado, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_metas_com_progresso(text) TO authenticated;