
-- 0) Extensions
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) Permitir categoria em_assistencia no catálogo
ALTER TABLE public.atacado_status_aparelho
  DROP CONSTRAINT IF EXISTS atacado_status_aparelho_categoria_check;
ALTER TABLE public.atacado_status_aparelho
  ADD CONSTRAINT atacado_status_aparelho_categoria_check
  CHECK (categoria = ANY (ARRAY['em_estoque','reservado','vendido','em_transito','em_assistencia','outro']));

-- 2) Canonizar status já gravados nos aparelhos (case/acento/espaço insensitive)
UPDATE public.atacado_aparelhos
   SET status = 'assistencia'
 WHERE lower(public.unaccent(btrim(status))) IN ('assistencia','em assistencia','na assistencia','assist');

UPDATE public.atacado_aparelhos
   SET status = 'no transporte'
 WHERE lower(public.unaccent(btrim(status))) IN ('no transporte','em transito','em transporte','transporte','transito');

UPDATE public.atacado_aparelhos
   SET status = 'estoque'
 WHERE lower(public.unaccent(btrim(status))) IN ('estoque','em estoque','stoque','disponivel');

UPDATE public.atacado_aparelhos
   SET status = 'vendido'
 WHERE lower(public.unaccent(btrim(status))) IN ('vendido','baixado','entregue');

UPDATE public.atacado_aparelhos
   SET status = 'reservado'
 WHERE lower(public.unaccent(btrim(status))) IN ('reservado','separado','aguardando');

-- 3) Catálogo: canonizar nome existente e categoria correspondente.
--    Estratégia: deduplicar por (empresa_id, normalizado) — manter o primeiro e remover os demais.
WITH norm AS (
  SELECT id, empresa_id,
         lower(public.unaccent(btrim(regexp_replace(nome, '\s+', ' ', 'g')))) AS k,
         created_at
    FROM public.atacado_status_aparelho
),
ranked AS (
  SELECT id, empresa_id, k,
         row_number() OVER (PARTITION BY empresa_id, k ORDER BY created_at NULLS LAST, id) AS rn
    FROM norm
)
DELETE FROM public.atacado_status_aparelho s
 USING ranked r
 WHERE s.id = r.id AND r.rn > 1;

-- Renomear/normalizar nome do remanescente e ajustar categoria para os conhecidos
UPDATE public.atacado_status_aparelho
   SET nome = 'assistencia', categoria = 'em_assistencia'
 WHERE lower(public.unaccent(btrim(nome))) IN ('assistencia','em assistencia','na assistencia','assist');

UPDATE public.atacado_status_aparelho
   SET nome = 'no transporte', categoria = 'em_transito'
 WHERE lower(public.unaccent(btrim(nome))) IN ('no transporte','em transito','em transporte','transporte','transito');

UPDATE public.atacado_status_aparelho
   SET nome = 'estoque', categoria = 'em_estoque'
 WHERE lower(public.unaccent(btrim(nome))) IN ('estoque','em estoque','stoque','disponivel');

UPDATE public.atacado_status_aparelho
   SET nome = 'vendido', categoria = 'vendido'
 WHERE lower(public.unaccent(btrim(nome))) IN ('vendido','baixado','entregue');

UPDATE public.atacado_status_aparelho
   SET nome = 'reservado', categoria = 'reservado'
 WHERE lower(public.unaccent(btrim(nome))) IN ('reservado','separado','aguardando');

-- 4) Coluna normalizada + índice único por empresa (impede duplicado no banco).
--    unaccent não é IMMUTABLE no schema padrão; usamos uma função IMMUTABLE wrapper.
CREATE OR REPLACE FUNCTION public.atacado_status_norm(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT lower(public.unaccent(btrim(regexp_replace(coalesce(p,''), '\s+', ' ', 'g'))));
$$;

ALTER TABLE public.atacado_status_aparelho
  ADD COLUMN IF NOT EXISTS nome_normalizado text
  GENERATED ALWAYS AS (public.atacado_status_norm(nome)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS uq_atacado_status_norm
  ON public.atacado_status_aparelho (empresa_id, nome_normalizado);

-- 5) RPC de cadastro: aceitar em_assistencia + reuso por normalizado.
DROP FUNCTION IF EXISTS public.atacado_add_status(text, text);
CREATE OR REPLACE FUNCTION public.atacado_add_status(
  p_nome text,
  p_cor text DEFAULT '#888',
  p_categoria text DEFAULT 'em_estoque'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_id uuid;
  v_ord int;
  v_n text := public.atacado_norm_text(p_nome);
  v_k text := public.atacado_status_norm(p_nome);
  v_cat text := COALESCE(NULLIF(p_categoria,''),'em_estoque');
BEGIN
  IF v_emp IS NULL OR v_n IS NULL THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  IF v_cat NOT IN ('em_estoque','reservado','vendido','em_transito','em_assistencia','outro') THEN
    v_cat := 'em_estoque';
  END IF;

  -- Reusar se já existe por normalizado (ignora caixa/acento/espaços)
  SELECT id INTO v_id FROM public.atacado_status_aparelho
   WHERE empresa_id = v_emp AND nome_normalizado = v_k;

  IF v_id IS NULL THEN
    SELECT coalesce(max(ordem),0)+1 INTO v_ord FROM public.atacado_status_aparelho WHERE empresa_id=v_emp;
    INSERT INTO public.atacado_status_aparelho(empresa_id, nome, cor, ordem, categoria)
      VALUES (v_emp, v_n, p_cor, v_ord, v_cat)
      RETURNING id INTO v_id;
  ELSE
    -- mantém o nome canônico existente; só atualiza categoria se ainda for 'outro'
    UPDATE public.atacado_status_aparelho
       SET categoria = v_cat
     WHERE id = v_id AND (categoria IS NULL OR categoria = 'outro');
  END IF;

  RETURN v_id;
END;
$$;

-- 6) RPC de sugestão por similaridade (pg_trgm)
CREATE OR REPLACE FUNCTION public.atacado_status_buscar_similar(
  p_nome text,
  p_min_sim real DEFAULT 0.6
)
RETURNS TABLE(id uuid, nome text, categoria text, similaridade real, is_exato boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT s.id, s.nome, s.categoria, s.nome_normalizado,
           public.atacado_status_norm(p_nome) AS k
      FROM public.atacado_status_aparelho s
     WHERE s.empresa_id = public.get_my_empresa_id()
  )
  SELECT id, nome, categoria,
         similarity(nome_normalizado, k) AS similaridade,
         (nome_normalizado = k) AS is_exato
    FROM base
   WHERE nome_normalizado = k
      OR similarity(nome_normalizado, k) >= p_min_sim
   ORDER BY (nome_normalizado = k) DESC, similarity(nome_normalizado, k) DESC
   LIMIT 5;
$$;
