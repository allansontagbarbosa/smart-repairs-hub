CREATE OR REPLACE FUNCTION public.verificar_lojista_por_email(email_input text)
RETURNS TABLE (
  existe boolean,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(email_input));
  v_tem_usuario_ativo boolean;
  v_status_lojista text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.lojista_usuarios lu
    WHERE lower(lu.email) = v_email
      AND lu.ativo = true
      AND lu.user_id IS NOT NULL
  ) INTO v_tem_usuario_ativo;

  SELECT l.status_acesso
  INTO v_status_lojista
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

  IF v_tem_usuario_ativo THEN
    RETURN QUERY SELECT true, 'ativo'::text;
  ELSIF v_status_lojista IS NOT NULL THEN
    RETURN QUERY SELECT true, v_status_lojista;
  ELSE
    RETURN QUERY SELECT false, 'nao_convidado'::text;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verificar_lojista_por_email(text) TO anon, authenticated;