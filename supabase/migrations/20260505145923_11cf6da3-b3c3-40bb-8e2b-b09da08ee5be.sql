-- 1) revogar_usuario
CREATE OR REPLACE FUNCTION public.revogar_usuario(p_user_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_empresa uuid;
  v_profile record;
  v_caller_user_id uuid;
BEGIN
  v_empresa := public.get_my_empresa_id();
  v_caller_user_id := auth.uid();

  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  IF NOT public.is_admin_ou_gerente() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  SELECT id, user_id, funcionario_id, nome_exibicao, ativo
    INTO v_profile
    FROM public.user_profiles
   WHERE id = p_user_profile_id AND empresa_id = v_empresa;

  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;

  IF v_profile.user_id = v_caller_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você não pode revogar seu próprio acesso');
  END IF;

  UPDATE public.user_profiles SET ativo = false
   WHERE id = p_user_profile_id AND empresa_id = v_empresa;

  IF v_profile.funcionario_id IS NOT NULL THEN
    UPDATE public.funcionarios
       SET ativo = false, deleted_at = COALESCE(deleted_at, now())
     WHERE id = v_profile.funcionario_id AND empresa_id = v_empresa;
  END IF;

  IF v_profile.user_id IS NOT NULL THEN
    DELETE FROM auth.sessions WHERE user_id = v_profile.user_id;
    DELETE FROM auth.refresh_tokens WHERE user_id = v_profile.user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile_inativado', true,
    'funcionario_inativado', v_profile.funcionario_id IS NOT NULL,
    'sessoes_revogadas', v_profile.user_id IS NOT NULL,
    'nome', v_profile.nome_exibicao
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.revogar_usuario(uuid) TO authenticated;

-- 2) reativar_usuario
CREATE OR REPLACE FUNCTION public.reativar_usuario(p_user_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_profile record;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;
  IF NOT public.is_admin_ou_gerente() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  SELECT id, funcionario_id, nome_exibicao
    INTO v_profile
    FROM public.user_profiles
   WHERE id = p_user_profile_id AND empresa_id = v_empresa;

  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;

  UPDATE public.user_profiles SET ativo = true WHERE id = p_user_profile_id AND empresa_id = v_empresa;

  IF v_profile.funcionario_id IS NOT NULL THEN
    UPDATE public.funcionarios
       SET ativo = true, deleted_at = NULL
     WHERE id = v_profile.funcionario_id AND empresa_id = v_empresa;
  END IF;

  RETURN jsonb_build_object('success', true, 'nome', v_profile.nome_exibicao);
END;
$$;
GRANT EXECUTE ON FUNCTION public.reativar_usuario(uuid) TO authenticated;

-- 3) atualizar_user_profile
CREATE OR REPLACE FUNCTION public.atualizar_user_profile(
  p_user_profile_id uuid,
  p_perfil_id uuid DEFAULT NULL,
  p_ativo boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_caller_user_id uuid;
  v_profile record;
BEGIN
  v_empresa := public.get_my_empresa_id();
  v_caller_user_id := auth.uid();

  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;
  IF NOT public.is_admin_ou_gerente() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  SELECT id, user_id, perfil_id, ativo INTO v_profile
    FROM public.user_profiles
   WHERE id = p_user_profile_id AND empresa_id = v_empresa;

  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;

  IF v_profile.user_id = v_caller_user_id THEN
    IF p_perfil_id IS NOT NULL AND p_perfil_id IS DISTINCT FROM v_profile.perfil_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Não pode alterar próprio perfil');
    END IF;
    IF p_ativo IS NOT NULL AND p_ativo = false THEN
      RETURN jsonb_build_object('success', false, 'error', 'Não pode desativar a si mesmo');
    END IF;
  END IF;

  IF p_perfil_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.perfis_acesso
    WHERE id = p_perfil_id AND empresa_id = v_empresa AND ativo = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil inválido');
  END IF;

  UPDATE public.user_profiles
     SET perfil_id = COALESCE(p_perfil_id, perfil_id),
         ativo = COALESCE(p_ativo, ativo)
   WHERE id = p_user_profile_id AND empresa_id = v_empresa;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.atualizar_user_profile(uuid, uuid, boolean) TO authenticated;

-- 4) salvar_perfil_acesso
CREATE OR REPLACE FUNCTION public.salvar_perfil_acesso(
  p_perfil_id uuid DEFAULT NULL,
  p_nome_perfil text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_permissoes jsonb DEFAULT '{}'::jsonb,
  p_ativo boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_perfil record;
  v_id uuid;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;
  IF NOT public.is_admin_ou_gerente() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;
  IF p_nome_perfil IS NULL OR length(trim(p_nome_perfil)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome do perfil obrigatório');
  END IF;

  IF p_perfil_id IS NULL THEN
    INSERT INTO public.perfis_acesso (empresa_id, nome_perfil, descricao, permissoes, ativo)
    VALUES (v_empresa, p_nome_perfil, p_descricao, p_permissoes, p_ativo)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('success', true, 'perfil_id', v_id, 'criado', true);
  ELSE
    SELECT id INTO v_perfil
      FROM public.perfis_acesso
     WHERE id = p_perfil_id AND empresa_id = v_empresa;
    IF v_perfil.id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Perfil não encontrado');
    END IF;

    IF p_ativo = false THEN
      IF (SELECT COUNT(*) FROM public.perfis_acesso
          WHERE empresa_id = v_empresa
            AND id <> p_perfil_id
            AND ativo = true
            AND (permissoes->>'configuracoes')::boolean = true) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Não é possível desativar o último perfil com Configurações');
      END IF;
    END IF;

    UPDATE public.perfis_acesso
       SET nome_perfil = p_nome_perfil,
           descricao = p_descricao,
           permissoes = p_permissoes,
           ativo = p_ativo
     WHERE id = p_perfil_id AND empresa_id = v_empresa;
    RETURN jsonb_build_object('success', true, 'perfil_id', p_perfil_id, 'atualizado', true);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.salvar_perfil_acesso(uuid, text, text, jsonb, boolean) TO authenticated;

-- 5) get_my_permissoes
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.get_my_permissoes()
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_nome text;
  v_perms jsonb;
  v_role_norm text;
  v_is_admin boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('logado', false, 'is_admin', false, 'permissoes', '{}'::jsonb);
  END IF;

  SELECT pa.nome_perfil, pa.permissoes
    INTO v_nome, v_perms
    FROM public.user_profiles up
    LEFT JOIN public.perfis_acesso pa ON pa.id = up.perfil_id
   WHERE (up.user_id = v_uid OR up.id = v_uid)
     AND up.ativo = true
   ORDER BY up.created_at ASC
   LIMIT 1;

  v_role_norm := lower(public.unaccent(COALESCE(v_nome, '')));
  v_is_admin := v_role_norm LIKE 'admin%';

  RETURN jsonb_build_object(
    'logado', true,
    'is_admin', v_is_admin,
    'is_gerente', v_role_norm LIKE 'gerente%',
    'role', COALESCE(v_nome, 'sem_perfil'),
    'permissoes', COALESCE(v_perms, '{}'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_permissoes() TO authenticated;