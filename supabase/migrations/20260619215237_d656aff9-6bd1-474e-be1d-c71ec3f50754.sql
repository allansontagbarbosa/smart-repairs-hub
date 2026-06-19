CREATE OR REPLACE FUNCTION public.atacado_criar_assist_e_vincular(
  p_modelo_id uuid,
  p_nome text,
  p_valor numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_tipo uuid;
  v_nome text := nullif(trim(p_nome), '');
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'sem empresa'; END IF;
  IF v_nome IS NULL THEN RAISE EXCEPTION 'nome obrigatório'; END IF;
  IF p_modelo_id IS NULL THEN RAISE EXCEPTION 'modelo obrigatório'; END IF;

  SELECT id INTO v_tipo
  FROM public.atacado_tipos_assistencia
  WHERE empresa_id = v_emp
    AND lower(trim(nome)) = lower(v_nome)
  LIMIT 1;

  IF v_tipo IS NULL THEN
    INSERT INTO public.atacado_tipos_assistencia(empresa_id, nome, valor_padrao, ativo)
    VALUES (v_emp, v_nome, coalesce(p_valor, 0), true)
    RETURNING id INTO v_tipo;
  ELSE
    UPDATE public.atacado_tipos_assistencia SET ativo = true WHERE id = v_tipo;
  END IF;

  RETURN public.atacado_set_assist_modelo(p_modelo_id, v_tipo, coalesce(p_valor, 0));
END; $$;

GRANT EXECUTE ON FUNCTION public.atacado_criar_assist_e_vincular(uuid, text, numeric) TO authenticated;