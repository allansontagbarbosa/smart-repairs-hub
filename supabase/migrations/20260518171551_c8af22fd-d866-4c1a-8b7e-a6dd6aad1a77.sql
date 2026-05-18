CREATE OR REPLACE FUNCTION public.has_permissao(
  p_modulo TEXT,
  p_acao TEXT DEFAULT 'ver'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_perms JSONB;
  v_modulo_value JSONB;
  v_is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  v_perms := public.get_my_permissoes();

  v_is_admin := COALESCE((v_perms->>'is_admin')::boolean, FALSE);
  IF v_is_admin THEN
    RETURN TRUE;
  END IF;

  IF v_perms IS NULL OR v_perms->'permissoes' IS NULL THEN
    RETURN FALSE;
  END IF;

  v_modulo_value := v_perms->'permissoes'->p_modulo;

  IF jsonb_typeof(v_modulo_value) = 'boolean' THEN
    RETURN COALESCE((v_modulo_value)::boolean, FALSE);
  END IF;

  IF jsonb_typeof(v_modulo_value) = 'object' THEN
    RETURN COALESCE((v_modulo_value->>p_acao)::boolean, FALSE);
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.has_permissao(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permissao(TEXT, TEXT) TO authenticated;