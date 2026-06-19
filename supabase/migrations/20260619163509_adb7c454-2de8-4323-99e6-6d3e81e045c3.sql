
-- ===== catalogo_listar_aparelhos =====
CREATE OR REPLACE FUNCTION public.catalogo_listar_aparelhos(p_acesso_id uuid)
RETURNS TABLE(
  grupo_key text,
  modelo text,
  capacidade text,
  cor text,
  grade text,
  condicao text,
  quantidade bigint,
  preco_aplicado numeric,
  preco_5 numeric,
  preco_10 numeric,
  cliente_nome text,
  condicao_pagamento_padrao text,
  tabela_preco_id uuid
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_empresa_id uuid;
  v_tabela_id uuid;
  v_cliente_nome text;
  v_cond text;
BEGIN
  SELECT a.cliente_id, c.empresa_id, c.tabela_preco_id,
         COALESCE(c.nome_fantasia, c.razao_social), c.condicao_pagamento_padrao
    INTO v_cliente_id, v_empresa_id, v_tabela_id, v_cliente_nome, v_cond
  FROM atacado_catalogo_acessos a
  JOIN atacado_clientes c ON c.id = a.cliente_id
  WHERE a.id = p_acesso_id AND a.ativo = true
    AND c.status NOT IN ('bloqueado','inativo') AND c.deleted_at IS NULL;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Acesso inválido';
  END IF;

  RETURN QUERY
  WITH em_estoque_nomes AS (
    SELECT lower(unaccent(s.nome)) AS nome_norm
    FROM atacado_status_aparelho s
    WHERE s.empresa_id = v_empresa_id
      AND s.categoria = 'em_estoque'
      AND COALESCE(s.ativo, true) = true
  ),
  base AS (
    SELECT
      ap.modelo, ap.capacidade, ap.cor, ap.grade, ap.condicao,
      SUM(ap.quantidade)::bigint AS qtd
    FROM atacado_aparelhos ap
    WHERE ap.empresa_id = v_empresa_id
      AND ap.deleted_at IS NULL
      AND ap.quantidade > 0
      AND lower(unaccent(coalesce(ap.status,''))) IN (SELECT nome_norm FROM em_estoque_nomes)
    GROUP BY ap.modelo, ap.capacidade, ap.cor, ap.grade, ap.condicao
  )
  SELECT
    md5(b.modelo || '|' || coalesce(b.capacidade,'') || '|' || coalesce(b.cor,'') || '|' || coalesce(b.grade,'') || '|' || coalesce(b.condicao,'')) AS grupo_key,
    b.modelo, b.capacidade, b.cor, b.grade, b.condicao, b.qtd,
    COALESCE(
      (SELECT i.preco FROM atacado_tabelas_preco_itens i
        WHERE i.tabela_preco_id = v_tabela_id
          AND i.modelo = b.modelo
          AND (i.capacidade = b.capacidade OR i.capacidade IS NULL)
        ORDER BY (i.capacidade = b.capacidade) DESC NULLS LAST LIMIT 1),
      (SELECT MAX(ap2.preco_sugerido) FROM atacado_aparelhos ap2
        WHERE ap2.empresa_id = v_empresa_id AND ap2.modelo = b.modelo
          AND (ap2.capacidade = b.capacidade OR b.capacidade IS NULL))
    ) AS preco_aplicado,
    (SELECT i.preco_minimo_qtd_5 FROM atacado_tabelas_preco_itens i
      WHERE i.tabela_preco_id = v_tabela_id
        AND i.modelo = b.modelo
        AND (i.capacidade = b.capacidade OR i.capacidade IS NULL)
      ORDER BY (i.capacidade = b.capacidade) DESC NULLS LAST LIMIT 1) AS preco_5,
    (SELECT i.preco_minimo_qtd_10 FROM atacado_tabelas_preco_itens i
      WHERE i.tabela_preco_id = v_tabela_id
        AND i.modelo = b.modelo
        AND (i.capacidade = b.capacidade OR i.capacidade IS NULL)
      ORDER BY (i.capacidade = b.capacidade) DESC NULLS LAST LIMIT 1) AS preco_10,
    v_cliente_nome,
    v_cond,
    v_tabela_id
  FROM base b
  ORDER BY b.modelo, b.capacidade, b.cor;
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_listar_aparelhos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_listar_aparelhos(uuid) TO anon, authenticated;

-- ===== catalogo_listar_pedidos =====
CREATE OR REPLACE FUNCTION public.catalogo_listar_pedidos(p_acesso_id uuid)
RETURNS TABLE(
  id uuid,
  numero_pedido bigint,
  status text,
  total numeric,
  created_at timestamptz,
  observacoes text,
  nfe_numero text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
BEGIN
  SELECT a.cliente_id INTO v_cliente_id
  FROM atacado_catalogo_acessos a
  JOIN atacado_clientes c ON c.id = a.cliente_id
  WHERE a.id = p_acesso_id AND a.ativo = true
    AND c.status NOT IN ('bloqueado','inativo') AND c.deleted_at IS NULL;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Acesso inválido';
  END IF;

  RETURN QUERY
  SELECT p.id, p.numero_pedido, p.status, p.total, p.created_at,
         p.observacoes, p.nfe_numero
  FROM atacado_pedidos p
  WHERE p.cliente_id = v_cliente_id
    AND p.deleted_at IS NULL
  ORDER BY p.created_at DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_listar_pedidos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_listar_pedidos(uuid) TO anon, authenticated;
