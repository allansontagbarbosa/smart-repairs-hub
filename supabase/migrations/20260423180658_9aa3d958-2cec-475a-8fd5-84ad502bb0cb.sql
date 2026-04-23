CREATE OR REPLACE FUNCTION public.editar_os_servicos(
  p_ordem_id UUID,
  p_adicionar UUID[],
  p_remover UUID[]
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
  v_adicionados JSONB := '[]'::jsonb;
  v_removidos JSONB := '[]'::jsonb;
  v_servico_id UUID;
  v_os_servico_id UUID;
BEGIN
  IF v_role NOT IN ('admin', 'Administrador') THEN
    RAISE EXCEPTION 'Apenas administradores podem editar serviços da OS' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_os FROM public.ordens_de_servico
  WHERE id = p_ordem_id AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_os.status::text = 'cancelado' THEN
    RAISE EXCEPTION 'OS cancelada não pode ter serviços editados' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(nome_exibicao, 'Usuário') INTO v_user_nome
  FROM public.user_profiles WHERE user_id = v_user_id OR id = v_user_id LIMIT 1;

  IF p_remover IS NOT NULL AND array_length(p_remover, 1) > 0 THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id, 'servico_id', servico_id, 'nome', nome, 'valor', valor, 'comissao', comissao
    )), '[]'::jsonb)
    INTO v_removidos
    FROM public.os_servicos
    WHERE id = ANY(p_remover) AND ordem_id = p_ordem_id;

    DELETE FROM public.os_servicos
    WHERE id = ANY(p_remover) AND ordem_id = p_ordem_id;
  END IF;

  IF p_adicionar IS NOT NULL AND array_length(p_adicionar, 1) > 0 THEN
    FOREACH v_servico_id IN ARRAY p_adicionar LOOP
      INSERT INTO public.os_servicos (ordem_id, servico_id)
      VALUES (p_ordem_id, v_servico_id)
      RETURNING id INTO v_os_servico_id;

      v_adicionados := v_adicionados || jsonb_build_object(
        'id', v_os_servico_id,
        'servico_id', v_servico_id
      );
    END LOOP;
  END IF;

  IF jsonb_array_length(v_adicionados) > 0 OR jsonb_array_length(v_removidos) > 0 THEN
    INSERT INTO public.os_auditoria (
      empresa_id, ordem_id, acao, realizada_por, realizada_por_nome, realizada_por_role,
      motivo, payload
    ) VALUES (
      v_empresa_id, p_ordem_id, 'edicao_servicos',
      v_user_id, v_user_nome, v_role,
      NULL,
      jsonb_build_object(
        'adicionados', v_adicionados,
        'removidos', v_removidos,
        'qtd_adicionados', jsonb_array_length(v_adicionados),
        'qtd_removidos', jsonb_array_length(v_removidos)
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'adicionados', jsonb_array_length(v_adicionados),
    'removidos', jsonb_array_length(v_removidos)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.editar_os_servicos(UUID, UUID[], UUID[]) TO authenticated;