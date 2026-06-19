
-- ============================================================
-- 1) Tabela de imagens padronizadas por modelo/cor
-- ============================================================
CREATE TABLE public.atacado_catalogo_imagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  modelo text NOT NULL,
  cor text NULL,
  imagem_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- unique por (empresa, modelo, cor) — cor null tratado via índice parcial
CREATE UNIQUE INDEX uq_catalogo_imagens_modelo_cor
  ON public.atacado_catalogo_imagens (empresa_id, modelo, cor)
  WHERE cor IS NOT NULL;
CREATE UNIQUE INDEX uq_catalogo_imagens_modelo_default
  ON public.atacado_catalogo_imagens (empresa_id, modelo)
  WHERE cor IS NULL;

CREATE INDEX idx_catalogo_imagens_empresa ON public.atacado_catalogo_imagens(empresa_id, modelo);

-- ============================================================
-- 2) Grants + RLS (vendedor da empresa gerencia; nada anon)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_catalogo_imagens TO authenticated;
GRANT ALL ON public.atacado_catalogo_imagens TO service_role;

ALTER TABLE public.atacado_catalogo_imagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "img_select_empresa" ON public.atacado_catalogo_imagens
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

CREATE POLICY "img_insert_empresa" ON public.atacado_catalogo_imagens
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE POLICY "img_update_empresa" ON public.atacado_catalogo_imagens
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE POLICY "img_delete_empresa" ON public.atacado_catalogo_imagens
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- trigger updated_at
CREATE TRIGGER trg_catalogo_imagens_updated_at
  BEFORE UPDATE ON public.atacado_catalogo_imagens
  FOR EACH ROW EXECUTE FUNCTION public.tg_atacado_ofertas_updated_at();

-- ============================================================
-- 3) Atualiza RPC pública para devolver imagem_url
-- ============================================================
DROP FUNCTION IF EXISTS public.catalogo_listar_aparelhos_publico(text);

CREATE OR REPLACE FUNCTION public.catalogo_listar_aparelhos_publico(p_slug text)
RETURNS TABLE(
  grupo_key text,
  modelo text,
  capacidade text,
  cor text,
  grade text,
  condicao text,
  quantidade bigint,
  preco_publico numeric,
  imagem_url text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
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
    ELSE b.preco_sug END,
    -- match por modelo+cor com fallback pro modelo (cor IS NULL)
    COALESCE(
      (SELECT img.imagem_url FROM atacado_catalogo_imagens img
        WHERE img.empresa_id = v_empresa_id
          AND img.modelo = b.modelo
          AND img.cor IS NOT DISTINCT FROM b.cor
        LIMIT 1),
      (SELECT img.imagem_url FROM atacado_catalogo_imagens img
        WHERE img.empresa_id = v_empresa_id
          AND img.modelo = b.modelo
          AND img.cor IS NULL
        LIMIT 1)
    )
  FROM base b
  ORDER BY b.modelo, b.capacidade, b.cor;
END;
$function$;

REVOKE ALL ON FUNCTION public.catalogo_listar_aparelhos_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_listar_aparelhos_publico(text) TO anon, authenticated;
