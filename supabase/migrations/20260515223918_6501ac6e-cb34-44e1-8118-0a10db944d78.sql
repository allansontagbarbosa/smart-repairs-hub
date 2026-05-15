
-- ============================================================
-- 1. criar_os_com_data_v2 — OS pode nascer só com cliente + descrição
-- ============================================================
CREATE OR REPLACE FUNCTION public.criar_os_com_data_v2(
  p_cliente_id UUID,
  p_aparelho TEXT,
  p_defeito_relatado TEXT,
  p_data_entrada TIMESTAMPTZ DEFAULT now(),
  p_observacoes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_empresa_id UUID := public.get_my_empresa_id();
  v_role       TEXT := public.get_my_role();
  v_aparelho_id UUID;
  v_os_id       UUID;
  v_numero      INT;
  v_numero_fmt  TEXT;
  v_marca       TEXT;
  v_modelo      TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário sem empresa vinculada');
  END IF;
  IF v_role NOT IN ('Administrador','Gerente','Financeiro','Atendimento','Técnico') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil sem permissão para criar OS');
  END IF;
  IF p_cliente_id IS NULL OR p_aparelho IS NULL OR length(trim(p_aparelho)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'cliente_id e aparelho são obrigatórios');
  END IF;

  -- valida cliente da empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.clientes
    WHERE id = p_cliente_id AND empresa_id = v_empresa_id AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado nesta empresa');
  END IF;

  -- divide texto em marca/modelo (primeira palavra = marca, resto = modelo)
  v_marca  := split_part(trim(p_aparelho), ' ', 1);
  v_modelo := NULLIF(trim(substring(trim(p_aparelho) FROM length(v_marca) + 1)), '');
  IF v_modelo IS NULL THEN v_modelo := v_marca; END IF;

  INSERT INTO public.aparelhos (cliente_id, marca, modelo, empresa_id)
  VALUES (p_cliente_id, v_marca, v_modelo, v_empresa_id)
  RETURNING id INTO v_aparelho_id;

  INSERT INTO public.ordens_de_servico (
    aparelho_id, defeito_relatado, observacoes,
    status, data_entrada, empresa_id
  ) VALUES (
    v_aparelho_id, p_defeito_relatado, p_observacoes,
    'recebido'::status_ordem, COALESCE(p_data_entrada, now()), v_empresa_id
  )
  RETURNING id, numero, numero_formatado
  INTO v_os_id, v_numero, v_numero_fmt;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'id', v_os_id,
      'numero', v_numero,
      'numero_formatado', v_numero_fmt,
      'aparelho_id', v_aparelho_id
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.criar_os_com_data_v2(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_os_com_data_v2(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

-- ============================================================
-- 2. atualizar_status_os — transição com permissão (histórico via trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.atualizar_status_os(
  p_os_id UUID,
  p_novo_status TEXT,
  p_observacao TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_empresa_id UUID := public.get_my_empresa_id();
  v_role       TEXT := public.get_my_role();
  v_funcionario_id UUID;
  v_os_funcionario UUID;
  v_status_atual TEXT;
  v_admin_roles TEXT[] := ARRAY['Administrador','Gerente','Financeiro'];
  v_atendimento_status TEXT[] := ARRAY['recebido','aprovado','entregue','cancelado'];
  v_tecnico_status     TEXT[] := ARRAY['em_analise','aguardando_aprovacao','em_reparo','aguardando_peca','pronto'];
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário sem empresa vinculada');
  END IF;

  -- valida enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'status_ordem' AND e.enumlabel = p_novo_status
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', format('Status inválido: %s', p_novo_status));
  END IF;

  -- pega OS
  SELECT status::text, funcionario_id
    INTO v_status_atual, v_os_funcionario
  FROM public.ordens_de_servico
  WHERE id = p_os_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;

  IF v_status_atual IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS não encontrada');
  END IF;
  IF v_status_atual = p_novo_status THEN
    RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('os_id', p_os_id, 'status', p_novo_status, 'noop', true));
  END IF;

  -- funcionario do usuário (se houver)
  SELECT funcionario_id INTO v_funcionario_id
  FROM public.user_profiles
  WHERE (user_id = v_user_id OR id = v_user_id) AND ativo = true
  LIMIT 1;

  -- matriz de permissão
  IF v_role = ANY (v_admin_roles) THEN
    NULL; -- libera tudo
  ELSIF v_role = 'Atendimento' THEN
    IF NOT (p_novo_status = ANY (v_atendimento_status)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Atendimento não pode mover para esse status');
    END IF;
  ELSIF v_role = 'Técnico' THEN
    IF v_funcionario_id IS NULL OR v_os_funcionario IS NULL OR v_os_funcionario <> v_funcionario_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Técnico só pode mover OS atribuída a ele');
    END IF;
    IF NOT (p_novo_status = ANY (v_tecnico_status)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Técnico não pode mover para esse status');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Perfil sem permissão');
  END IF;

  UPDATE public.ordens_de_servico
  SET status     = p_novo_status::status_ordem,
      updated_at = now()
  WHERE id = p_os_id;

  -- garante observação no histórico (trigger já registra a linha)
  IF p_observacao IS NOT NULL THEN
    UPDATE public.os_status_historico
    SET observacao = p_observacao
    WHERE id = (
      SELECT id FROM public.os_status_historico
      WHERE os_id = p_os_id ORDER BY mudado_em DESC LIMIT 1
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object('os_id', p_os_id, 'status_anterior', v_status_atual, 'status_novo', p_novo_status)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_status_os(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atualizar_status_os(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 3. atribuir_tecnico_os — aceita funcionario_id OU user_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.atribuir_tecnico_os(
  p_os_id UUID,
  p_tecnico_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_empresa_id UUID := public.get_my_empresa_id();
  v_role       TEXT := public.get_my_role();
  v_funcionario_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário sem empresa vinculada');
  END IF;
  IF v_role NOT IN ('Administrador','Gerente','Financeiro','Atendimento','Técnico') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil sem permissão');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ordens_de_servico
    WHERE id = p_os_id AND empresa_id = v_empresa_id AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS não encontrada');
  END IF;

  -- tenta como funcionario.id direto
  SELECT id INTO v_funcionario_id
  FROM public.funcionarios
  WHERE id = p_tecnico_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;

  -- se não achou, tenta como user_id via user_profiles
  IF v_funcionario_id IS NULL THEN
    SELECT up.funcionario_id INTO v_funcionario_id
    FROM public.user_profiles up
    JOIN public.funcionarios f ON f.id = up.funcionario_id
    WHERE (up.user_id = p_tecnico_id OR up.id = p_tecnico_id)
      AND up.ativo = true
      AND f.empresa_id = v_empresa_id
      AND f.deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_funcionario_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Técnico/funcionário não encontrado nesta empresa');
  END IF;

  UPDATE public.ordens_de_servico
  SET funcionario_id = v_funcionario_id,
      updated_at     = now()
  WHERE id = p_os_id;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object('os_id', p_os_id, 'funcionario_id', v_funcionario_id)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.atribuir_tecnico_os(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atribuir_tecnico_os(UUID, UUID) TO authenticated;
