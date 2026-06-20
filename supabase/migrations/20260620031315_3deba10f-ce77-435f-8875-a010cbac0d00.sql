CREATE OR REPLACE FUNCTION public.catalogo_criar_oferta(
  p_slug text,
  p_modelo text,
  p_capacidade text,
  p_cor text,
  p_grade text,
  p_condicao text,
  p_aparelho_id uuid,
  p_quantidade int,
  p_valor numeric,
  p_nome text,
  p_contato text,
  p_mensagem text DEFAULT NULL
) RETURNS TABLE(oferta_id uuid, token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_empresa uuid; v_ativo boolean; v_modo text; v_id uuid; v_token uuid;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF coalesce(trim(p_nome),'') = '' OR coalesce(trim(p_contato),'') = '' THEN
    RAISE EXCEPTION 'Nome e contato obrigatórios';
  END IF;

  SELECT empresa_id, catalogo_publico_ativo, catalogo_modo
    INTO v_empresa, v_ativo, v_modo
  FROM atacado_configuracoes WHERE catalogo_publico_slug = p_slug LIMIT 1;

  IF v_empresa IS NULL OR v_ativo IS NOT TRUE THEN
    RAISE EXCEPTION 'Catálogo indisponível';
  END IF;

  INSERT INTO atacado_ofertas (
    empresa_id, catalogo_slug, aparelho_id, modelo, capacidade, cor, grade, condicao,
    quantidade, valor_oferta, cliente_nome, cliente_contato, mensagem, status
  ) VALUES (
    v_empresa, p_slug, p_aparelho_id, p_modelo, p_capacidade, p_cor, p_grade, p_condicao,
    p_quantidade, p_valor, left(trim(p_nome),120), left(trim(p_contato),120),
    nullif(left(trim(coalesce(p_mensagem,'')),500),''), 'pendente'
  )
  RETURNING id, atacado_ofertas.token INTO v_id, v_token;

  INSERT INTO atacado_ofertas_rounds (oferta_id, autor, valor, mensagem)
  VALUES (v_id, 'cliente', p_valor, nullif(left(trim(coalesce(p_mensagem,'')),500),''));

  RETURN QUERY SELECT v_id, v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_criar_oferta(text,text,text,text,text,text,uuid,int,numeric,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_criar_oferta(text,text,text,text,text,text,uuid,int,numeric,text,text,text) TO anon, authenticated;