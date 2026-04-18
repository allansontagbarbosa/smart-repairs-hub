CREATE OR REPLACE FUNCTION public.lojista_verificar_acesso(email_input text)
RETURNS TABLE (
  existe boolean,
  status_acesso text,
  empresa_id uuid,
  lojista_id uuid,
  user_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(email_input));
  v_lojista record;
  v_usuario_ativo record;
BEGIN
  -- Prioridade 1: linha em lojista_usuarios ativa com user_id
  SELECT lu.lojista_id, lu.user_id, lu.ativo
  INTO v_usuario_ativo
  FROM public.lojista_usuarios lu
  WHERE lower(lu.email) = v_email
    AND lu.ativo = true
    AND lu.user_id IS NOT NULL
  ORDER BY lu.created_at DESC
  LIMIT 1;

  -- Prioridade 2: melhor linha em lojistas (ativo > convidado > inativo)
  SELECT l.id, l.empresa_id, l.user_id, l.status_acesso
  INTO v_lojista
  FROM public.lojistas l
  WHERE lower(l.email) = v_email
    AND l.deleted_at IS NULL
  ORDER BY
    CASE l.status_acesso
      WHEN 'ativo' THEN 4
      WHEN 'convidado' THEN 3
      WHEN 'inativo' THEN 2
      ELSE 1
    END DESC,
    l.created_at DESC
  LIMIT 1;

  IF v_usuario_ativo.user_id IS NOT NULL THEN
    RETURN QUERY SELECT
      true,
      'ativo'::text,
      COALESCE(v_lojista.empresa_id, NULL::uuid),
      COALESCE(v_usuario_ativo.lojista_id, v_lojista.id),
      v_usuario_ativo.user_id;
    RETURN;
  END IF;

  IF v_lojista.id IS NOT NULL THEN
    RETURN QUERY SELECT
      true,
      v_lojista.status_acesso,
      v_lojista.empresa_id,
      v_lojista.id,
      v_lojista.user_id;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, 'nao_convidado'::text, NULL::uuid, NULL::uuid, NULL::uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lojista_verificar_acesso(text) TO anon, authenticated;