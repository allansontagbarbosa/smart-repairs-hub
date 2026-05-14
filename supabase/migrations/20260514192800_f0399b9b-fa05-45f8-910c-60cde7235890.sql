CREATE OR REPLACE FUNCTION public.atualizar_cliente(
  p_cliente_id UUID,
  p_dados JSONB
) RETURNS JSONB
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

  UPDATE public.clientes SET
    nome              = COALESCE(NULLIF(p_dados->>'nome', ''),               nome),
    email             = NULLIF(p_dados->>'email', ''),
    telefone          = COALESCE(NULLIF(p_dados->>'telefone', ''),           telefone),
    whatsapp          = NULLIF(p_dados->>'whatsapp', ''),
    cpf               = NULLIF(p_dados->>'cpf', ''),
    documento         = NULLIF(p_dados->>'documento', ''),
    data_nascimento   = CASE
                          WHEN p_dados ? 'data_nascimento'
                            THEN NULLIF(p_dados->>'data_nascimento', '')::DATE
                          ELSE data_nascimento
                        END,
    cep               = NULLIF(p_dados->>'cep', ''),
    rua               = NULLIF(p_dados->>'rua', ''),
    numero_endereco   = NULLIF(p_dados->>'numero_endereco', ''),
    complemento       = NULLIF(p_dados->>'complemento', ''),
    bairro            = NULLIF(p_dados->>'bairro', ''),
    cidade            = NULLIF(p_dados->>'cidade', ''),
    estado            = NULLIF(p_dados->>'estado', ''),
    observacoes       = NULLIF(p_dados->>'observacoes', ''),
    updated_at        = NOW()
  WHERE id = p_cliente_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_cliente(UUID, JSONB) TO authenticated;