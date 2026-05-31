
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.catalogo_get_config(p_slug TEXT)
RETURNS TABLE (
  empresa_id UUID,
  catalogo_publico_ativo BOOLEAN,
  catalogo_publico_titulo TEXT,
  catalogo_publico_descricao TEXT
) LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id, catalogo_publico_ativo, catalogo_publico_titulo, catalogo_publico_descricao
  FROM atacado_configuracoes
  WHERE catalogo_publico_slug = p_slug
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.catalogo_get_config(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.catalogo_login(p_slug TEXT, p_email TEXT, p_senha TEXT)
RETURNS TABLE (
  acesso_id UUID, cliente_id UUID, cliente_nome TEXT, empresa_id UUID, token TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_acesso atacado_catalogo_acessos%ROWTYPE;
  v_cliente atacado_clientes%ROWTYPE;
  v_empresa_id UUID;
BEGIN
  SELECT ac.empresa_id INTO v_empresa_id
  FROM atacado_configuracoes ac
  WHERE ac.catalogo_publico_slug = p_slug AND ac.catalogo_publico_ativo = true;

  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Catálogo não encontrado ou desativado'; END IF;

  SELECT * INTO v_acesso FROM atacado_catalogo_acessos
  WHERE email_login = LOWER(p_email) AND ativo = true;

  IF v_acesso.id IS NULL THEN RAISE EXCEPTION 'E-mail não cadastrado'; END IF;
  IF v_acesso.senha_hash IS NULL THEN RAISE EXCEPTION 'Senha não configurada'; END IF;

  SELECT * INTO v_cliente FROM atacado_clientes
  WHERE id = v_acesso.cliente_id AND empresa_id = v_empresa_id
    AND status NOT IN ('bloqueado', 'inativo') AND deleted_at IS NULL;

  IF v_cliente.id IS NULL THEN RAISE EXCEPTION 'Acesso bloqueado. Contate o fornecedor.'; END IF;
  IF v_acesso.senha_hash <> crypt(p_senha, v_acesso.senha_hash) THEN
    RAISE EXCEPTION 'Senha incorreta';
  END IF;

  UPDATE atacado_catalogo_acessos SET ultimo_login = NOW() WHERE id = v_acesso.id;

  RETURN QUERY SELECT v_acesso.id, v_cliente.id,
    COALESCE(v_cliente.nome_fantasia, v_cliente.razao_social),
    v_empresa_id,
    encode(gen_random_bytes(32), 'hex');
END; $$;
GRANT EXECUTE ON FUNCTION public.catalogo_login(TEXT, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.catalogo_criar_pedido(
  p_acesso_id UUID, p_itens JSONB, p_observacoes TEXT DEFAULT NULL
) RETURNS TABLE (pedido_id UUID, numero_pedido BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente_id UUID; v_empresa_id UUID;
  v_subtotal NUMERIC := 0; v_pedido_id UUID; v_numero BIGINT; v_item JSONB;
BEGIN
  SELECT a.cliente_id, c.empresa_id INTO v_cliente_id, v_empresa_id
  FROM atacado_catalogo_acessos a
  JOIN atacado_clientes c ON c.id = a.cliente_id
  WHERE a.id = p_acesso_id AND a.ativo = true
    AND c.status NOT IN ('bloqueado', 'inativo') AND c.deleted_at IS NULL;

  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Acesso inválido'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_subtotal := v_subtotal + (v_item->>'total_item')::NUMERIC;
  END LOOP;

  INSERT INTO atacado_pedidos (empresa_id, cliente_id, subtotal, total, status, observacoes, origem)
  VALUES (v_empresa_id, v_cliente_id, v_subtotal, v_subtotal,
          'aguardando_aprovacao', p_observacoes, 'catalogo_publico')
  RETURNING id, atacado_pedidos.numero_pedido INTO v_pedido_id, v_numero;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    INSERT INTO atacado_pedidos_itens (
      pedido_id, aparelho_id, modelo, capacidade, cor,
      quantidade, preco_unitario, total_item
    ) VALUES (
      v_pedido_id, NULLIF(v_item->>'aparelho_id','')::UUID,
      v_item->>'modelo', v_item->>'capacidade', v_item->>'cor',
      (v_item->>'quantidade')::INT,
      (v_item->>'preco_unitario')::NUMERIC,
      (v_item->>'total_item')::NUMERIC
    );
  END LOOP;

  RETURN QUERY SELECT v_pedido_id, v_numero;
END; $$;
GRANT EXECUTE ON FUNCTION public.catalogo_criar_pedido(UUID, JSONB, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.catalogo_setar_senha(
  p_cliente_id UUID, p_email TEXT, p_senha TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_acesso_id UUID; v_hash TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM atacado_clientes c
    JOIN user_profiles up ON up.empresa_id = c.empresa_id
    WHERE c.id = p_cliente_id AND up.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  v_hash := crypt(p_senha, gen_salt('bf'));

  INSERT INTO atacado_catalogo_acessos (cliente_id, email_login, senha_hash, ativo)
  VALUES (p_cliente_id, LOWER(p_email), v_hash, true)
  ON CONFLICT (email_login) DO UPDATE SET
    senha_hash = EXCLUDED.senha_hash, ativo = true, cliente_id = EXCLUDED.cliente_id
  RETURNING id INTO v_acesso_id;

  RETURN v_acesso_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.catalogo_setar_senha(UUID, TEXT, TEXT) TO authenticated;
