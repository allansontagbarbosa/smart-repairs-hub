CREATE OR REPLACE FUNCTION public.alterar_plano_empresa(p_plano_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_emp   uuid;
  v_role  text;
  v_mods  text[];
  v_antes uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'nao autenticado');
  END IF;

  SELECT empresa_id, role INTO v_emp, v_role
  FROM   public.user_profiles
  WHERE  (user_id = v_uid OR id = v_uid) AND empresa_id IS NOT NULL
  LIMIT  1;

  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'sem empresa');
  END IF;

  IF v_role NOT IN ('administrador','owner','proprietario') THEN
    RETURN jsonb_build_object('success', false, 'error', 'sem permissao para alterar plano');
  END IF;

  SELECT array_agg(modulo) INTO v_mods
  FROM   public.plano_modulos
  WHERE  plano_id = p_plano_id;

  IF v_mods IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'plano invalido');
  END IF;

  UPDATE public.empresas SET
    modulo_assistencia_ativo = ('assistencia' = ANY(v_mods)),
    modulo_loja_ativo        = ('loja'        = ANY(v_mods)),
    modulo_atacado_ativo     = ('atacado'     = ANY(v_mods))
  WHERE id = v_emp;

  UPDATE public.empresa_plano
     SET status              = 'cancelado',
         data_fim            = CURRENT_DATE,
         cancelado_em        = now(),
         motivo_cancelamento = 'troca_de_plano'
   WHERE empresa_id = v_emp AND status = 'ativo'
   RETURNING plano_id INTO v_antes;

  INSERT INTO public.empresa_plano (empresa_id, plano_id, status, data_inicio)
  VALUES (v_emp, p_plano_id, 'ativo', CURRENT_DATE);

  RETURN jsonb_build_object('success', true,
    'plano_anterior', v_antes,
    'plano_novo',     p_plano_id,
    'modulos',        to_jsonb(v_mods));
END;
$$;