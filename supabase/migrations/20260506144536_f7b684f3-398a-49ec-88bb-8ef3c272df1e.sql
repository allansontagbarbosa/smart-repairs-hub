
CREATE OR REPLACE FUNCTION public.unaccent_lower(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(translate(
    coalesce(txt, ''),
    'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN'
  ));
$$;

CREATE OR REPLACE FUNCTION public.buscar_ordens_servico(
  p_empresa_id uuid,
  p_tokens text[] DEFAULT ARRAY[]::text[],
  p_os_prefix text DEFAULT NULL,
  p_imei_prefix text DEFAULT NULL,
  p_tel_prefix text DEFAULT NULL,
  p_cliente_prefix text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 500
)
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      o.id,
      o.numero,
      o.numero_formatado,
      o.defeito_relatado,
      o.status,
      a.imei,
      a.marca,
      a.modelo,
      a.cor,
      c.nome AS cliente_nome,
      c.telefone,
      c.whatsapp,
      c.email,
      c.cpf,
      c.documento,
      (
        SELECT string_agg(coalesce(f.nome,''), ' ')
        FROM os_servicos os
        LEFT JOIN funcionarios f ON f.id = os.tecnico_id
        WHERE os.ordem_id = o.id
      ) AS tecnicos_concat
    FROM ordens_de_servico o
    JOIN aparelhos a ON a.id = o.aparelho_id
    JOIN clientes c ON c.id = a.cliente_id
    WHERE o.empresa_id = p_empresa_id
      AND o.deleted_at IS NULL
  ),
  filtered AS (
    SELECT * FROM base b
    WHERE
      (p_os_prefix IS NULL OR
        b.numero::text ILIKE p_os_prefix || '%' OR
        regexp_replace(coalesce(b.numero_formatado,''), '\D', '', 'g')
          ILIKE '%' || regexp_replace(p_os_prefix, '\D', '', 'g') || '%')
      AND (p_imei_prefix IS NULL OR
        regexp_replace(coalesce(b.imei,''), '\D', '', 'g')
          ILIKE '%' || regexp_replace(p_imei_prefix, '\D', '', 'g') || '%')
      AND (p_tel_prefix IS NULL OR
        regexp_replace(coalesce(b.telefone,'') || coalesce(b.whatsapp,''), '\D', '', 'g')
          ILIKE '%' || regexp_replace(p_tel_prefix, '\D', '', 'g') || '%')
      AND (p_cliente_prefix IS NULL OR
        public.unaccent_lower(b.cliente_nome) ILIKE
          '%' || public.unaccent_lower(p_cliente_prefix) || '%')
      AND (p_status IS NULL OR b.status::text = p_status)
  )
  SELECT f.id FROM filtered f
  WHERE
    coalesce(cardinality(p_tokens), 0) = 0
    OR (
      SELECT bool_and(
        public.unaccent_lower(f.cliente_nome) LIKE '%' || norm.tok_norm || '%'
        OR public.unaccent_lower(coalesce(f.marca,'') || ' ' || coalesce(f.modelo,'') || ' ' || coalesce(f.cor,'')) LIKE '%' || norm.tok_norm || '%'
        OR public.unaccent_lower(coalesce(f.defeito_relatado,'')) LIKE '%' || norm.tok_norm || '%'
        OR public.unaccent_lower(coalesce(f.tecnicos_concat,'')) LIKE '%' || norm.tok_norm || '%'
        OR public.unaccent_lower(coalesce(f.email,'')) LIKE '%' || norm.tok_norm || '%'
        OR (length(norm.tok_digits) > 0 AND f.numero::text LIKE '%' || norm.tok_digits || '%')
        OR (length(norm.tok_digits) > 0 AND regexp_replace(coalesce(f.numero_formatado,''), '\D', '', 'g') LIKE '%' || norm.tok_digits || '%')
        OR (length(norm.tok_digits) >= 4 AND regexp_replace(coalesce(f.imei,''), '\D', '', 'g') LIKE '%' || norm.tok_digits || '%')
        OR (length(norm.tok_digits) >= 4 AND regexp_replace(coalesce(f.telefone,'') || coalesce(f.whatsapp,''), '\D', '', 'g') LIKE '%' || norm.tok_digits || '%')
        OR (length(norm.tok_digits) >= 4 AND regexp_replace(coalesce(f.cpf,'') || coalesce(f.documento,''), '\D', '', 'g') LIKE '%' || norm.tok_digits || '%')
      )
      FROM unnest(p_tokens) AS t(token),
      LATERAL (SELECT public.unaccent_lower(t.token) AS tok_norm,
                      regexp_replace(t.token, '\D', '', 'g') AS tok_digits) AS norm
    )
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_ordens_servico(uuid, text[], text, text, text, text, text, int) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_clientes_nome_unaccent ON public.clientes (public.unaccent_lower(nome));
CREATE INDEX IF NOT EXISTS idx_aparelhos_imei_digits ON public.aparelhos ((regexp_replace(coalesce(imei,''), '\D', '', 'g')));
CREATE INDEX IF NOT EXISTS idx_clientes_telefone_digits ON public.clientes ((regexp_replace(coalesce(telefone,'') || coalesce(whatsapp,''), '\D', '', 'g')));
