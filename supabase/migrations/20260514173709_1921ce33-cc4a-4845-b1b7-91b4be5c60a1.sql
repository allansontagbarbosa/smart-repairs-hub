-- Portal B2B Fase 3A: backend RPCs do portal lojista

-- 0. Colunas para rastrear aprovação/reprovação (orcamento_aprovado_em já existe)
ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS orcamento_reprovado_em      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS orcamento_motivo_reprovacao TEXT,
  ADD COLUMN IF NOT EXISTS orcamento_decidido_por_user UUID;

-- 1. Helper: cliente_lojista do auth.uid()
CREATE OR REPLACE FUNCTION public.get_my_cliente_lojista()
RETURNS TABLE(cliente_id UUID, empresa_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.empresa_id
  FROM public.clientes c
  WHERE c.user_id = auth.uid()
    AND c.tipo_cliente = 'lojista_b2b'
    AND c.status_convite = 'aceito'
    AND c.deleted_at IS NULL
  LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_cliente_lojista() TO authenticated;

-- 2. Dashboard
CREATE OR REPLACE FUNCTION public.portal_dashboard_lojista()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cli RECORD;
  v_nome TEXT;
  v_total_faturado NUMERIC;
  v_total_pago NUMERIC;
  v_saldo NUMERIC;
  v_aguardando INT;
  v_andamento INT;
  v_pronta INT;
  v_ultimas JSONB;
BEGIN
  SELECT * INTO v_cli FROM public.get_my_cliente_lojista();
  IF v_cli.cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT nome INTO v_nome FROM public.clientes WHERE id = v_cli.cliente_id;

  SELECT
    COALESCE(SUM(os.valor_total) FILTER (WHERE os.status = 'entregue'), 0),
    COALESCE(SUM(os.valor_pago)  FILTER (WHERE os.status = 'entregue'), 0)
  INTO v_total_faturado, v_total_pago
  FROM public.ordens_de_servico os
  JOIN public.aparelhos a ON a.id = os.aparelho_id
  WHERE a.cliente_id = v_cli.cliente_id
    AND os.empresa_id = v_cli.empresa_id
    AND os.deleted_at IS NULL;

  v_saldo := v_total_faturado - v_total_pago;

  SELECT
    COUNT(*) FILTER (WHERE os.orcamento_aprovado_em IS NULL
                       AND os.orcamento_reprovado_em IS NULL
                       AND os.status NOT IN ('entregue','cancelado')),
    COUNT(*) FILTER (WHERE os.status IN ('em_reparo','aguardando_peca','em_analise','aprovado')),
    COUNT(*) FILTER (WHERE os.status = 'pronto')
  INTO v_aguardando, v_andamento, v_pronta
  FROM public.ordens_de_servico os
  JOIN public.aparelhos a ON a.id = os.aparelho_id
  WHERE a.cliente_id = v_cli.cliente_id
    AND os.empresa_id = v_cli.empresa_id
    AND os.deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.data_entrada DESC), '[]'::jsonb)
  INTO v_ultimas
  FROM (
    SELECT
      os.id, os.numero, os.status, os.valor_total, os.data_entrada,
      a.modelo AS aparelho_modelo,
      (os.orcamento_aprovado_em IS NULL AND os.orcamento_reprovado_em IS NULL
        AND os.status NOT IN ('entregue','cancelado')) AS aguardando_aprovacao
    FROM public.ordens_de_servico os
    JOIN public.aparelhos a ON a.id = os.aparelho_id
    WHERE a.cliente_id = v_cli.cliente_id
      AND os.empresa_id = v_cli.empresa_id
      AND os.deleted_at IS NULL
    ORDER BY os.data_entrada DESC
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'success', true,
    'cliente_nome', v_nome,
    'saldo_devedor', v_saldo,
    'total_faturado', v_total_faturado,
    'total_pago', v_total_pago,
    'qtd_aguardando_aprovacao', v_aguardando,
    'qtd_em_andamento', v_andamento,
    'qtd_pronta_para_retirar', v_pronta,
    'ultimas_oss', v_ultimas
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_dashboard_lojista() TO authenticated;

-- 3. Listar ordens
CREATE OR REPLACE FUNCTION public.portal_listar_ordens(p_status_filter TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cli RECORD;
  v_oss JSONB;
BEGIN
  SELECT * INTO v_cli FROM public.get_my_cliente_lojista();
  IF v_cli.cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.data_entrada DESC), '[]'::jsonb)
  INTO v_oss
  FROM (
    SELECT
      os.id, os.numero, os.status, os.valor_total, os.valor_pago,
      os.data_entrada, os.previsao_entrega,
      a.modelo AS aparelho_modelo,
      (os.orcamento_aprovado_em IS NULL AND os.orcamento_reprovado_em IS NULL
        AND os.status NOT IN ('entregue','cancelado')) AS aguardando_aprovacao,
      (os.orcamento_aprovado_em IS NOT NULL) AS orcamento_aprovado,
      (os.orcamento_reprovado_em IS NOT NULL) AS orcamento_reprovado
    FROM public.ordens_de_servico os
    JOIN public.aparelhos a ON a.id = os.aparelho_id
    WHERE a.cliente_id = v_cli.cliente_id
      AND os.empresa_id = v_cli.empresa_id
      AND os.deleted_at IS NULL
      AND (
        p_status_filter IS NULL
        OR p_status_filter = 'todas'
        OR (p_status_filter = 'aguardando_aprovacao'
              AND os.orcamento_aprovado_em IS NULL
              AND os.orcamento_reprovado_em IS NULL
              AND os.status NOT IN ('entregue','cancelado'))
        OR (p_status_filter = 'em_andamento'
              AND os.status IN ('em_reparo','aguardando_peca','em_analise','aprovado'))
        OR os.status::text = p_status_filter
      )
  ) t;

  RETURN jsonb_build_object('success', true, 'ordens', v_oss);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_listar_ordens(TEXT) TO authenticated;

-- 4. Detalhe (sem peças, custos, comissões, lucro)
CREATE OR REPLACE FUNCTION public.portal_detalhe_ordem(p_os_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cli RECORD;
  v_os RECORD;
  v_aparelho RECORD;
  v_servicos JSONB;
  v_status_orc TEXT;
BEGIN
  SELECT * INTO v_cli FROM public.get_my_cliente_lojista();
  IF v_cli.cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT os.* INTO v_os
  FROM public.ordens_de_servico os
  JOIN public.aparelhos a ON a.id = os.aparelho_id
  WHERE os.id = p_os_id
    AND a.cliente_id = v_cli.cliente_id
    AND os.empresa_id = v_cli.empresa_id
    AND os.deleted_at IS NULL;

  IF v_os.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS não encontrada');
  END IF;

  SELECT modelo, marca, imei INTO v_aparelho
  FROM public.aparelhos WHERE id = v_os.aparelho_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('descricao', s.nome, 'valor', s.valor)), '[]'::jsonb)
  INTO v_servicos
  FROM public.os_servicos s
  WHERE s.ordem_id = v_os.id;

  v_status_orc := CASE
    WHEN v_os.orcamento_aprovado_em  IS NOT NULL THEN 'aprovado'
    WHEN v_os.orcamento_reprovado_em IS NOT NULL THEN 'reprovado'
    WHEN v_os.status IN ('entregue','cancelado') THEN 'finalizado'
    ELSE 'pendente'
  END;

  RETURN jsonb_build_object(
    'success', true,
    'os', jsonb_build_object(
      'id', v_os.id,
      'numero', v_os.numero,
      'status', v_os.status,
      'valor_total', v_os.valor_total,
      'valor_pago', v_os.valor_pago,
      'saldo', COALESCE(v_os.valor_total,0) - COALESCE(v_os.valor_pago, 0),
      'data_entrada', v_os.data_entrada,
      'previsao_entrega', v_os.previsao_entrega,
      'defeito_relatado', v_os.defeito_relatado,
      'aparelho', jsonb_build_object(
        'modelo', v_aparelho.modelo,
        'marca', v_aparelho.marca,
        'imei', v_aparelho.imei
      ),
      'servicos', v_servicos,
      'orcamento', jsonb_build_object(
        'status', v_status_orc,
        'aprovado_em', v_os.orcamento_aprovado_em,
        'reprovado_em', v_os.orcamento_reprovado_em,
        'motivo_reprovacao', v_os.orcamento_motivo_reprovacao
      )
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_detalhe_ordem(UUID) TO authenticated;

-- 5. Aprovar
CREATE OR REPLACE FUNCTION public.portal_aprovar_orcamento(p_os_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cli RECORD;
  v_os RECORD;
BEGIN
  SELECT * INTO v_cli FROM public.get_my_cliente_lojista();
  IF v_cli.cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT os.* INTO v_os
  FROM public.ordens_de_servico os
  JOIN public.aparelhos a ON a.id = os.aparelho_id
  WHERE os.id = p_os_id
    AND a.cliente_id = v_cli.cliente_id
    AND os.empresa_id = v_cli.empresa_id
    AND os.deleted_at IS NULL;

  IF v_os.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS não encontrada');
  END IF;
  IF v_os.orcamento_aprovado_em IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Já estava aprovado');
  END IF;
  IF v_os.orcamento_reprovado_em IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orçamento já foi reprovado');
  END IF;
  IF v_os.status IN ('entregue','cancelado') THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS já finalizada');
  END IF;

  UPDATE public.ordens_de_servico
    SET orcamento_aprovado_em = NOW(),
        orcamento_decidido_por_user = auth.uid(),
        orcamento_motivo_reprovacao = NULL,
        updated_at = NOW()
    WHERE id = p_os_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_aprovar_orcamento(UUID) TO authenticated;

-- 6. Reprovar
CREATE OR REPLACE FUNCTION public.portal_reprovar_orcamento(p_os_id UUID, p_motivo TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cli RECORD;
  v_os RECORD;
BEGIN
  SELECT * INTO v_cli FROM public.get_my_cliente_lojista();
  IF v_cli.cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT os.* INTO v_os
  FROM public.ordens_de_servico os
  JOIN public.aparelhos a ON a.id = os.aparelho_id
  WHERE os.id = p_os_id
    AND a.cliente_id = v_cli.cliente_id
    AND os.empresa_id = v_cli.empresa_id
    AND os.deleted_at IS NULL;

  IF v_os.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS não encontrada');
  END IF;
  IF v_os.orcamento_reprovado_em IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Já estava reprovado');
  END IF;
  IF v_os.orcamento_aprovado_em IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orçamento já foi aprovado');
  END IF;
  IF v_os.status IN ('entregue','cancelado') THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS já finalizada');
  END IF;

  UPDATE public.ordens_de_servico
    SET orcamento_reprovado_em = NOW(),
        orcamento_motivo_reprovacao = NULLIF(TRIM(p_motivo), ''),
        orcamento_decidido_por_user = auth.uid(),
        updated_at = NOW()
    WHERE id = p_os_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_reprovar_orcamento(UUID, TEXT) TO authenticated;