-- =====================================================================
-- BULK ACTIONS - Fase 1: status em massa + atribuir técnico em massa
-- =====================================================================

CREATE OR REPLACE FUNCTION public.bulk_atualizar_status_os(
  p_ordem_ids UUID[],
  p_novo_status status_ordem
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
  v_atualizadas INT := 0;
  v_ignoradas INT := 0;
  v_motivos JSONB := '[]'::jsonb;
  v_os RECORD;
BEGIN
  IF v_role NOT IN ('admin', 'Administrador') THEN
    RAISE EXCEPTION 'Apenas administradores podem fazer ações em massa' USING ERRCODE = '42501';
  END IF;

  IF p_novo_status::text = 'cancelado' THEN
    RAISE EXCEPTION 'Cancelamento deve usar a função cancelar_os individual' USING ERRCODE = '22023';
  END IF;

  IF p_ordem_ids IS NULL OR array_length(p_ordem_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('sucesso', true, 'atualizadas', 0, 'ignoradas', 0, 'motivos_ignoradas', '[]'::jsonb);
  END IF;

  SELECT COALESCE(nome_exibicao, 'Usuário') INTO v_user_nome
  FROM public.user_profiles
  WHERE user_id = v_user_id OR id = v_user_id
  LIMIT 1;

  FOR v_os IN
    SELECT id, numero, status FROM public.ordens_de_servico
    WHERE id = ANY(p_ordem_ids) AND empresa_id = v_empresa_id
    FOR UPDATE
  LOOP
    IF v_os.status::text = 'cancelado' THEN
      v_ignoradas := v_ignoradas + 1;
      v_motivos := v_motivos || jsonb_build_object('numero', v_os.numero, 'motivo', 'OS cancelada não pode ter status alterado');
      CONTINUE;
    END IF;

    IF v_os.status = p_novo_status THEN
      v_ignoradas := v_ignoradas + 1;
      v_motivos := v_motivos || jsonb_build_object('numero', v_os.numero, 'motivo', 'Status já era ' || p_novo_status::text);
      CONTINUE;
    END IF;

    UPDATE public.ordens_de_servico SET status = p_novo_status WHERE id = v_os.id;
    v_atualizadas := v_atualizadas + 1;
  END LOOP;

  -- Log na auditoria (uma entrada por OS afetada)
  INSERT INTO public.os_auditoria (
    empresa_id, ordem_id, acao, realizada_por, realizada_por_nome, realizada_por_role,
    motivo, payload
  )
  SELECT
    v_empresa_id, id, 'bulk_status_change', v_user_id, v_user_nome, v_role,
    'Mudança de status em massa para: ' || p_novo_status::text,
    jsonb_build_object('novo_status', p_novo_status::text, 'bulk_size', array_length(p_ordem_ids, 1))
  FROM public.ordens_de_servico
  WHERE id = ANY(p_ordem_ids) AND empresa_id = v_empresa_id AND status = p_novo_status;

  RETURN jsonb_build_object(
    'sucesso', true,
    'atualizadas', v_atualizadas,
    'ignoradas', v_ignoradas,
    'motivos_ignoradas', v_motivos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_atualizar_status_os(UUID[], status_ordem) TO authenticated;


CREATE OR REPLACE FUNCTION public.bulk_atribuir_tecnico_os(
  p_ordem_ids UUID[],
  p_funcionario_id UUID
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
  v_funcionario RECORD;
  v_atualizadas INT := 0;
  v_ignoradas INT := 0;
  v_motivos JSONB := '[]'::jsonb;
  v_os RECORD;
BEGIN
  IF v_role NOT IN ('admin', 'Administrador') THEN
    RAISE EXCEPTION 'Apenas administradores podem fazer ações em massa' USING ERRCODE = '42501';
  END IF;

  SELECT id, nome INTO v_funcionario FROM public.funcionarios
  WHERE id = p_funcionario_id AND empresa_id = v_empresa_id AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funcionário não encontrado ou inativo' USING ERRCODE = 'P0002';
  END IF;

  IF p_ordem_ids IS NULL OR array_length(p_ordem_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('sucesso', true, 'atualizadas', 0, 'ignoradas', 0, 'motivos_ignoradas', '[]'::jsonb, 'tecnico_nome', v_funcionario.nome);
  END IF;

  SELECT COALESCE(nome_exibicao, 'Usuário') INTO v_user_nome
  FROM public.user_profiles
  WHERE user_id = v_user_id OR id = v_user_id
  LIMIT 1;

  FOR v_os IN
    SELECT id, numero, status, funcionario_id FROM public.ordens_de_servico
    WHERE id = ANY(p_ordem_ids) AND empresa_id = v_empresa_id
    FOR UPDATE
  LOOP
    IF v_os.status::text = 'cancelado' THEN
      v_ignoradas := v_ignoradas + 1;
      v_motivos := v_motivos || jsonb_build_object('numero', v_os.numero, 'motivo', 'OS cancelada');
      CONTINUE;
    END IF;

    UPDATE public.ordens_de_servico SET funcionario_id = p_funcionario_id WHERE id = v_os.id;
    v_atualizadas := v_atualizadas + 1;
  END LOOP;

  INSERT INTO public.os_auditoria (
    empresa_id, ordem_id, acao, realizada_por, realizada_por_nome, realizada_por_role,
    motivo, payload
  )
  SELECT
    v_empresa_id, id, 'bulk_atribuir_tecnico', v_user_id, v_user_nome, v_role,
    'Atribuição em massa para técnico: ' || v_funcionario.nome,
    jsonb_build_object('funcionario_id', p_funcionario_id, 'funcionario_nome', v_funcionario.nome, 'bulk_size', array_length(p_ordem_ids, 1))
  FROM public.ordens_de_servico
  WHERE id = ANY(p_ordem_ids) AND empresa_id = v_empresa_id AND status::text != 'cancelado';

  RETURN jsonb_build_object(
    'sucesso', true,
    'atualizadas', v_atualizadas,
    'ignoradas', v_ignoradas,
    'motivos_ignoradas', v_motivos,
    'tecnico_nome', v_funcionario.nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_atribuir_tecnico_os(UUID[], UUID) TO authenticated;