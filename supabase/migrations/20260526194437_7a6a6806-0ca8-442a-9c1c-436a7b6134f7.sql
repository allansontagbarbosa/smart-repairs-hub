
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_resetar_senha_lojista(
  p_email_lojista text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_perfil text;
  v_lojista_user_id uuid;
  v_nova_senha text;
  v_empresa_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  SELECT pa.nome_perfil, up.empresa_id
    INTO v_perfil, v_empresa_id
    FROM public.user_profiles up
    JOIN public.perfis_acesso pa ON pa.id = up.perfil_id
   WHERE up.user_id = v_user_id;

  IF v_perfil IS DISTINCT FROM 'Administrador' THEN
    RAISE EXCEPTION 'Apenas Administrador pode resetar senhas';
  END IF;

  SELECT id INTO v_lojista_user_id
    FROM auth.users
   WHERE email = lower(trim(p_email_lojista))
   LIMIT 1;

  IF v_lojista_user_id IS NULL THEN
    RAISE EXCEPTION 'Lojista nao encontrado pelo email informado';
  END IF;

  -- Confirmar que e mesmo um lojista (existe em lojista_grupos)
  IF NOT EXISTS (SELECT 1 FROM public.lojista_grupos WHERE user_id = v_lojista_user_id) THEN
    RAISE EXCEPTION 'Usuario nao e um lojista cadastrado';
  END IF;

  v_nova_senha := substring(md5(random()::text || clock_timestamp()::text), 1, 10);

  UPDATE auth.users
     SET encrypted_password = extensions.crypt(v_nova_senha, extensions.gen_salt('bf')),
         email_confirmed_at = COALESCE(email_confirmed_at, now()),
         updated_at = now()
   WHERE id = v_lojista_user_id;

  BEGIN
    INSERT INTO public.cashback_audit_log (empresa_id, acao, user_id, justificativa)
    VALUES (v_empresa_id, 'reset_senha_lojista', v_user_id,
            format('Admin resetou senha do lojista %s', p_email_lojista));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'sucesso', true,
    'email', p_email_lojista,
    'senha_temporaria', v_nova_senha,
    'aviso', 'Senha temporaria gerada. Passe pro lojista e peca para trocar no primeiro acesso.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resetar_senha_lojista(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resetar_senha_lojista(text) TO authenticated;
