DO $$ BEGIN
  CREATE TYPE public.status_convite_enum AS ENUM ('pendente', 'aceito', 'revogado', 'expirado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS convite_token UUID,
  ADD COLUMN IF NOT EXISTS convite_enviado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS convite_aceito_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS convite_expira_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_convite public.status_convite_enum;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_convite_token_ativo
  ON public.clientes (convite_token)
  WHERE convite_token IS NOT NULL
    AND status_convite IN ('pendente', 'aceito');

CREATE INDEX IF NOT EXISTS idx_clientes_status_convite
  ON public.clientes (empresa_id, status_convite)
  WHERE deleted_at IS NULL AND status_convite IS NOT NULL;

CREATE OR REPLACE FUNCTION public.criar_convite_cliente(p_cliente_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa UUID;
  v_cliente RECORD;
  v_novo_token UUID;
  v_expira TIMESTAMPTZ;
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

  v_novo_token := gen_random_uuid();
  v_expira := NOW() + INTERVAL '7 days';

  UPDATE public.clientes
    SET convite_token = v_novo_token,
        convite_enviado_em = NOW(),
        convite_expira_em = v_expira,
        convite_aceito_em = NULL,
        status_convite = 'pendente',
        updated_at = NOW()
    WHERE id = p_cliente_id;

  RETURN jsonb_build_object(
    'success', true,
    'token', v_novo_token,
    'expira_em', v_expira,
    'cliente_nome', v_cliente.nome,
    'cliente_email', v_cliente.email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_convite_cliente(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.revogar_convite_cliente(p_cliente_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa UUID;
  v_cliente_empresa UUID;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário sem empresa vinculada');
  END IF;

  SELECT empresa_id INTO v_cliente_empresa
  FROM public.clientes
  WHERE id = p_cliente_id AND deleted_at IS NULL;

  IF v_cliente_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;
  IF v_cliente_empresa <> v_empresa THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não pertence à sua empresa');
  END IF;

  UPDATE public.clientes
    SET status_convite = 'revogado',
        convite_token = NULL,
        user_id = NULL,
        updated_at = NOW()
    WHERE id = p_cliente_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.revogar_convite_cliente(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.aceitar_convite_cliente(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_cliente RECORD;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  SELECT id, nome, empresa_id, convite_expira_em, status_convite, user_id
    INTO v_cliente
  FROM public.clientes
  WHERE convite_token = p_token AND deleted_at IS NULL;

  IF v_cliente.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite inválido');
  END IF;
  IF v_cliente.status_convite = 'revogado' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite revogado');
  END IF;
  IF v_cliente.convite_expira_em < NOW() THEN
    UPDATE public.clientes SET status_convite = 'expirado' WHERE id = v_cliente.id;
    RETURN jsonb_build_object('success', false, 'error', 'Convite expirado');
  END IF;
  IF v_cliente.user_id IS NOT NULL AND v_cliente.user_id <> v_user THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite já vinculado a outro usuário');
  END IF;

  UPDATE public.clientes
    SET user_id = v_user,
        status_convite = 'aceito',
        convite_aceito_em = NOW(),
        updated_at = NOW()
    WHERE id = v_cliente.id;

  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', v_cliente.id,
    'cliente_nome', v_cliente.nome,
    'empresa_id', v_cliente.empresa_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.aceitar_convite_cliente(UUID) TO authenticated;