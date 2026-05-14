CREATE OR REPLACE FUNCTION public.consultar_convite_publico(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_cliente RECORD;
BEGIN
  SELECT
    nome, email, convite_expira_em, status_convite,
    user_id IS NOT NULL AS ja_tem_conta
  INTO v_cliente
  FROM public.clientes
  WHERE convite_token = p_token AND deleted_at IS NULL;

  IF v_cliente.nome IS NULL THEN
    RETURN jsonb_build_object('valido', false, 'motivo', 'nao_encontrado');
  END IF;

  IF v_cliente.status_convite = 'revogado' THEN
    RETURN jsonb_build_object('valido', false, 'motivo', 'revogado');
  END IF;

  IF v_cliente.convite_expira_em < NOW() THEN
    RETURN jsonb_build_object('valido', false, 'motivo', 'expirado');
  END IF;

  RETURN jsonb_build_object(
    'valido', true,
    'nome', v_cliente.nome,
    'email_sugerido', v_cliente.email,
    'ja_tem_conta', v_cliente.ja_tem_conta,
    'expira_em', v_cliente.convite_expira_em
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consultar_convite_publico(UUID) TO anon, authenticated;