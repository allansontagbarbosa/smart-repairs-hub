CREATE OR REPLACE FUNCTION public.calc_meta_margem_os(p_inicio date, p_fim date, p_escopo text, p_escopo_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(AVG(o.valor_total - COALESCE(o.custo_pecas, 0)), 0)
  FROM ordens_de_servico o
  WHERE o.empresa_id = public.get_my_empresa_id() AND o.deleted_at IS NULL
    AND o.data_conclusao::date BETWEEN p_inicio AND p_fim
    AND (p_escopo = 'empresa' OR (p_escopo = 'loja' AND o.loja_id = p_escopo_id));
$$;

CREATE OR REPLACE FUNCTION public.calc_meta_tempo_medio(p_inicio date, p_fim date, p_escopo text, p_escopo_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (s.concluido_em - s.iniciado_em)) / 3600.0), 0)
  FROM os_servicos s JOIN ordens_de_servico o ON o.id = s.ordem_id
  WHERE s.empresa_id = public.get_my_empresa_id() AND o.deleted_at IS NULL
    AND s.status = 'concluido' AND s.iniciado_em IS NOT NULL AND s.concluido_em IS NOT NULL
    AND s.concluido_em::date BETWEEN p_inicio AND p_fim
    AND (p_escopo = 'empresa' OR (p_escopo = 'tecnico' AND s.tecnico_id = p_escopo_id));
$$;

CREATE OR REPLACE FUNCTION public.calc_meta_retrabalho(p_inicio date, p_fim date, p_escopo text, p_escopo_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total numeric; v_retrab numeric;
BEGIN
  WITH base AS (
    SELECT s.id, o.aparelho_id, o.defeito_relatado, s.concluido_em, o.data_entrada, o.data_conclusao
    FROM os_servicos s JOIN ordens_de_servico o ON o.id = s.ordem_id
    WHERE s.empresa_id = public.get_my_empresa_id() AND o.deleted_at IS NULL
      AND s.status = 'concluido'
      AND s.concluido_em::date BETWEEN p_inicio AND p_fim
      AND (p_escopo = 'empresa' OR (p_escopo = 'tecnico' AND s.tecnico_id = p_escopo_id))
  )
  SELECT
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM base b2
      WHERE b2.id <> base.id AND b2.aparelho_id = base.aparelho_id
        AND b2.defeito_relatado = base.defeito_relatado
        AND b2.data_entrada > base.data_conclusao
        AND b2.data_entrada - base.data_conclusao < interval '30 days'
    ))::numeric,
    COUNT(*)::numeric
    INTO v_retrab, v_total
  FROM base;
  RETURN CASE WHEN v_total > 0 THEN (v_retrab / v_total) * 100 ELSE 0 END;
END;
$$;

CREATE OR REPLACE FUNCTION public.calc_meta_aprovacao_orcamento(p_inicio date, p_fim date, p_escopo text, p_escopo_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total numeric; v_aprov numeric;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE o.status NOT IN ('cancelada', 'aguardando_aprovacao'))::numeric,
    COUNT(*)::numeric
    INTO v_aprov, v_total
  FROM ordens_de_servico o
  WHERE o.empresa_id = public.get_my_empresa_id() AND o.deleted_at IS NULL
    AND o.data_entrada::date BETWEEN p_inicio AND p_fim
    AND (p_escopo = 'empresa' OR (p_escopo = 'loja' AND o.loja_id = p_escopo_id));
  RETURN CASE WHEN v_total > 0 THEN (v_aprov / v_total) * 100 ELSE 0 END;
END;
$$;

CREATE OR REPLACE FUNCTION public.calc_meta_retorno_cliente(p_inicio date, p_fim date, p_escopo text, p_escopo_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total numeric; v_retornou numeric;
BEGIN
  WITH clientes_periodo AS (
    SELECT o.cliente_id, MIN(o.data_conclusao) AS primeira_conclusao
    FROM ordens_de_servico o
    WHERE o.empresa_id = public.get_my_empresa_id() AND o.deleted_at IS NULL
      AND o.data_conclusao IS NOT NULL
      AND o.data_conclusao::date BETWEEN p_inicio AND p_fim
      AND (p_escopo = 'empresa' OR (p_escopo = 'loja' AND o.loja_id = p_escopo_id))
    GROUP BY o.cliente_id
  )
  SELECT
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM ordens_de_servico o2
      WHERE o2.cliente_id = clientes_periodo.cliente_id AND o2.deleted_at IS NULL
        AND o2.data_entrada > clientes_periodo.primeira_conclusao
        AND o2.data_entrada - clientes_periodo.primeira_conclusao < interval '30 days'
    ))::numeric,
    COUNT(*)::numeric
    INTO v_retornou, v_total
  FROM clientes_periodo;
  RETURN CASE WHEN v_total > 0 THEN (v_retornou / v_total) * 100 ELSE 0 END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calc_meta_margem_os(date, date, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_meta_tempo_medio(date, date, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_meta_retrabalho(date, date, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_meta_aprovacao_orcamento(date, date, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_meta_retorno_cliente(date, date, text, uuid) TO authenticated;