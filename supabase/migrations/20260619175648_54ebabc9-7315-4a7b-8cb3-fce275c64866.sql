
ALTER TABLE public.atacado_configuracoes
  ADD COLUMN IF NOT EXISTS catalogo_modo text NOT NULL DEFAULT 'aberto',
  ADD COLUMN IF NOT EXISTS catalogo_whatsapp text,
  ADD COLUMN IF NOT EXISTS catalogo_whatsapp_mensagem text,
  ADD COLUMN IF NOT EXISTS catalogo_preco_publico_origem text NOT NULL DEFAULT 'preco_sugerido',
  ADD COLUMN IF NOT EXISTS catalogo_tabela_preco_publica_id uuid REFERENCES public.atacado_tabelas_preco(id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='atacado_configuracoes_catalogo_modo_chk') THEN
    ALTER TABLE public.atacado_configuracoes
      ADD CONSTRAINT atacado_configuracoes_catalogo_modo_chk CHECK (catalogo_modo IN ('aberto','login'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='atacado_configuracoes_catalogo_preco_origem_chk') THEN
    ALTER TABLE public.atacado_configuracoes
      ADD CONSTRAINT atacado_configuracoes_catalogo_preco_origem_chk CHECK (catalogo_preco_publico_origem IN ('preco_sugerido','tabela'));
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.catalogo_get_config(text);
CREATE FUNCTION public.catalogo_get_config(p_slug text)
RETURNS TABLE(
  empresa_id uuid,
  catalogo_publico_ativo boolean,
  catalogo_publico_titulo text,
  catalogo_publico_descricao text,
  catalogo_modo text,
  catalogo_whatsapp text,
  catalogo_whatsapp_mensagem text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT empresa_id, catalogo_publico_ativo, catalogo_publico_titulo,
         catalogo_publico_descricao, catalogo_modo, catalogo_whatsapp,
         catalogo_whatsapp_mensagem
  FROM atacado_configuracoes
  WHERE catalogo_publico_slug = p_slug
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.catalogo_get_config(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_get_config(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.catalogo_listar_aparelhos_publico(p_slug text)
RETURNS TABLE(
  grupo_key text,
  modelo text,
  capacidade text,
  cor text,
  grade text,
  condicao text,
  quantidade bigint,
  preco_publico numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid; v_ativo boolean; v_origem text; v_tabela uuid;
BEGIN
  SELECT empresa_id, catalogo_publico_ativo, catalogo_preco_publico_origem,
         catalogo_tabela_preco_publica_id
    INTO v_empresa_id, v_ativo, v_origem, v_tabela
  FROM atacado_configuracoes
  WHERE catalogo_publico_slug = p_slug
  LIMIT 1;

  IF v_empresa_id IS NULL OR v_ativo IS NOT TRUE THEN
    RAISE EXCEPTION 'Catálogo indisponível';
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
    SELECT ap.modelo, ap.capacidade, ap.cor, ap.grade, ap.condicao,
           SUM(ap.quantidade)::bigint AS qtd,
           MAX(ap.preco_sugerido) AS preco_sug
    FROM atacado_aparelhos ap
    WHERE ap.empresa_id = v_empresa_id
      AND ap.deleted_at IS NULL
      AND ap.quantidade > 0
      AND lower(unaccent(coalesce(ap.status,''))) IN (SELECT nome_norm FROM em_estoque_nomes)
    GROUP BY ap.modelo, ap.capacidade, ap.cor, ap.grade, ap.condicao
  )
  SELECT
    md5(b.modelo || '|' || coalesce(b.capacidade,'') || '|' || coalesce(b.cor,'') || '|' || coalesce(b.grade,'') || '|' || coalesce(b.condicao,'')),
    b.modelo, b.capacidade, b.cor, b.grade, b.condicao, b.qtd,
    CASE WHEN v_origem = 'tabela' AND v_tabela IS NOT NULL THEN
      COALESCE(
        (SELECT i.preco FROM atacado_tabelas_preco_itens i
          WHERE i.tabela_preco_id = v_tabela
            AND i.modelo = b.modelo
            AND (i.capacidade = b.capacidade OR i.capacidade IS NULL)
          ORDER BY (i.capacidade = b.capacidade) DESC NULLS LAST LIMIT 1),
        b.preco_sug
      )
    ELSE b.preco_sug END
  FROM base b
  ORDER BY b.modelo, b.capacidade, b.cor;
END;
$$;
REVOKE ALL ON FUNCTION public.catalogo_listar_aparelhos_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_listar_aparelhos_publico(text) TO anon, authenticated;
