CREATE OR REPLACE FUNCTION public.preview_cancelamento_os(p_ordem_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := public.get_my_role();
  v_empresa_id UUID := public.get_my_empresa_id();
  v_os RECORD;
  v_qtd_pecas INT := 0;
  v_total_pecas NUMERIC := 0;
  v_qtd_comissoes INT := 0;
  v_total_comissoes NUMERIC := 0;
BEGIN
  IF v_role NOT IN ('admin', 'Administrador') THEN
    RAISE EXCEPTION 'Apenas administradores podem cancelar ordens de serviço'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_os
    FROM public.ordens_de_servico
    WHERE id = p_ordem_id AND empresa_id = v_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada' USING ERRCODE = 'P0002';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(preco_unitario * quantidade), 0)
    INTO v_qtd_pecas, v_total_pecas
    FROM public.pecas_utilizadas
    WHERE ordem_id = p_ordem_id;

  SELECT COUNT(*), COALESCE(SUM(valor), 0)
    INTO v_qtd_comissoes, v_total_comissoes
    FROM public.comissoes
    WHERE ordem_id = p_ordem_id
      AND status::text <> 'estornada';

  RETURN jsonb_build_object(
    'pode_cancelar', true,
    'motivo_bloqueio', NULL,
    'status_atual', v_os.status::text,
    'numero', v_os.numero,
    'numero_formatado', v_os.numero_formatado,
    'qtd_pecas', v_qtd_pecas,
    'total_pecas', v_total_pecas,
    'qtd_comissoes', v_qtd_comissoes,
    'total_comissoes', v_total_comissoes,
    'tem_impacto_financeiro', (v_qtd_pecas > 0 OR v_qtd_comissoes > 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_os(
  p_ordem_id UUID,
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT := public.get_my_role();
  v_empresa_id UUID := public.get_my_empresa_id();
  v_user_nome TEXT;
  v_os RECORD;
  v_pecas_estornadas JSONB := '[]'::jsonb;
  v_comissoes_estornadas JSONB := '[]'::jsonb;
  v_total_pecas NUMERIC := 0;
  v_total_comissao NUMERIC := 0;
  v_qtd_pecas INT := 0;
  v_qtd_comissoes INT := 0;
BEGIN
  IF v_role NOT IN ('admin', 'Administrador') THEN
    RAISE EXCEPTION 'Apenas administradores podem cancelar ordens de serviço'
      USING ERRCODE = '42501';
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'O motivo do cancelamento deve ter pelo menos 10 caracteres'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_os
    FROM public.ordens_de_servico
    WHERE id = p_ordem_id AND empresa_id = v_empresa_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_os.status::text = 'cancelado' THEN
    RAISE EXCEPTION 'OS já está cancelada.' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(nome_exibicao, 'Usuário')
    INTO v_user_nome
    FROM public.user_profiles
    WHERE user_id = v_user_id OR id = v_user_id
    LIMIT 1;

  IF v_user_nome IS NULL THEN
    v_user_nome := 'Usuário';
  END IF;

  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'peca_id', peca_id,
      'quantidade', quantidade,
      'preco_unitario', preco_unitario,
      'valor', COALESCE(preco_unitario * quantidade, 0)
    )), '[]'::jsonb),
    COALESCE(SUM(preco_unitario * quantidade), 0),
    COUNT(*)
  INTO v_pecas_estornadas, v_total_pecas, v_qtd_pecas
  FROM public.pecas_utilizadas
  WHERE ordem_id = p_ordem_id;

  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'funcionario_id', funcionario_id,
      'valor', valor,
      'status_anterior', status::text
    )), '[]'::jsonb),
    COALESCE(SUM(valor), 0),
    COUNT(*)
  INTO v_comissoes_estornadas, v_total_comissao, v_qtd_comissoes
  FROM public.comissoes
  WHERE ordem_id = p_ordem_id AND status::text <> 'estornada';

  IF v_qtd_comissoes > 0 THEN
    UPDATE public.comissoes
       SET status = 'estornada',
           estornada_em = now(),
           estornada_por = v_user_id
     WHERE ordem_id = p_ordem_id
       AND status::text <> 'estornada';
  END IF;

  UPDATE public.ordens_de_servico
     SET status = 'cancelado',
         cancelada_em = now(),
         cancelada_por = v_user_id,
         motivo_cancelamento = p_motivo,
         impacto_cancelamento = jsonb_build_object(
           'status_anterior', v_os.status::text,
           'pecas_estornadas', v_pecas_estornadas,
           'comissoes_estornadas', v_comissoes_estornadas,
           'total_pecas', v_total_pecas,
           'total_comissao', v_total_comissao,
           'qtd_pecas', v_qtd_pecas,
           'qtd_comissoes', v_qtd_comissoes
         )
   WHERE id = p_ordem_id;

  INSERT INTO public.os_auditoria (
    empresa_id, ordem_id, acao,
    realizada_por, realizada_por_nome, realizada_por_role,
    motivo, payload
  ) VALUES (
    v_empresa_id, p_ordem_id, 'cancelamento',
    v_user_id, v_user_nome, v_role,
    p_motivo,
    jsonb_build_object(
      'status_anterior', v_os.status::text,
      'pecas_estornadas', v_pecas_estornadas,
      'comissoes_estornadas', v_comissoes_estornadas,
      'total_pecas_estornadas', v_total_pecas,
      'total_comissao_estornada', v_total_comissao
    )
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'numero', v_os.numero,
    'numero_formatado', v_os.numero_formatado,
    'pecas_estornadas', v_total_pecas,
    'comissoes_estornadas', v_total_comissao,
    'qtd_pecas', v_qtd_pecas,
    'qtd_comissoes', v_qtd_comissoes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_cancelamento_os(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_os(UUID, TEXT) TO authenticated;