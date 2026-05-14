ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS convite_email_enviado_em TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.criar_convite_cliente(
  p_cliente_id UUID,
  p_email      TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa     UUID;
  v_cliente     RECORD;
  v_email_final TEXT;
  v_novo_token  UUID;
  v_expira      TIMESTAMPTZ;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário sem empresa vinculada');
  END IF;

  SELECT id, empresa_id, nome, email, tipo_cliente, status_convite, user_id
    INTO v_cliente
  FROM public.clientes
  WHERE id = p_cliente_id AND deleted_at IS NULL;

  IF v_cliente.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;
  IF v_cliente.empresa_id <> v_empresa THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não pertence à sua empresa');
  END IF;
  IF v_cliente.tipo_cliente <> 'lojista_b2b' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Só lojistas B2B podem ser convidados');
  END IF;
  IF v_cliente.user_id IS NOT NULL OR v_cliente.status_convite = 'aceito' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente já tem acesso ativo');
  END IF;

  v_email_final := COALESCE(NULLIF(TRIM(p_email), ''), v_cliente.email);

  IF v_email_final IS NULL OR v_email_final = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email é obrigatório pra enviar convite');
  END IF;
  IF v_email_final !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email inválido');
  END IF;

  v_novo_token := gen_random_uuid();
  v_expira := NOW() + INTERVAL '7 days';

  UPDATE public.clientes
    SET email = v_email_final,
        convite_token = v_novo_token,
        convite_enviado_em = NOW(),
        convite_expira_em = v_expira,
        convite_aceito_em = NULL,
        convite_email_enviado_em = NULL,
        status_convite = 'pendente',
        updated_at = NOW()
    WHERE id = p_cliente_id;

  RETURN jsonb_build_object(
    'success', true,
    'token', v_novo_token,
    'expira_em', v_expira,
    'cliente_nome', v_cliente.nome,
    'cliente_email', v_email_final
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_convite_cliente(UUID, TEXT) TO authenticated;