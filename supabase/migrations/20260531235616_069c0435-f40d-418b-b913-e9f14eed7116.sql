
CREATE OR REPLACE FUNCTION public.contar_dados_modulo(p_modulo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_out jsonb := '{}'::jsonb;
BEGIN
  IF v_emp IS NULL THEN RETURN v_out; END IF;

  IF p_modulo = 'assistencia' THEN
    v_out := jsonb_build_object(
      'os_abertas',
      (SELECT count(*) FROM public.ordens_de_servico
        WHERE empresa_id = v_emp AND deleted_at IS NULL
          AND status::text NOT IN ('entregue','cancelado'))
    );
  ELSIF p_modulo = 'loja' THEN
    v_out := jsonb_build_object(
      'aparelhos',
      (SELECT count(*) FROM public.loja_aparelhos
        WHERE empresa_id = v_emp AND deleted_at IS NULL)
    );
  ELSIF p_modulo = 'atacado' THEN
    v_out := jsonb_build_object(
      'pedidos_abertos',
      (SELECT count(*) FROM public.atacado_pedidos
        WHERE empresa_id = v_emp AND deleted_at IS NULL
          AND status NOT IN ('entregue','cancelado'))
    );
  END IF;

  RETURN v_out;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.contar_dados_modulo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contar_dados_modulo(text) TO authenticated;


CREATE OR REPLACE FUNCTION public.alterar_plano_empresa(p_plano_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_emp     uuid := public.get_my_empresa_id();
  v_role    text := public.get_my_role();
  v_mods    text[];
  v_antes   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'nao autenticado');
  END IF;

  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'sem empresa');
  END IF;

  -- Somente Administrador (proprietário) altera plano
  IF v_role IS DISTINCT FROM 'Administrador' THEN
    RETURN jsonb_build_object('success', false, 'error', 'sem permissao para alterar plano');
  END IF;

  SELECT array_agg(modulo) INTO v_mods
  FROM   public.plano_modulos
  WHERE  plano_id = p_plano_id;

  IF v_mods IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'plano invalido');
  END IF;

  -- Liga/desliga flags. SEM DELETE em nenhum dado.
  UPDATE public.empresas SET
    modulo_assistencia_ativo = ('assistencia' = ANY(v_mods)),
    modulo_loja_ativo        = ('loja'        = ANY(v_mods)),
    modulo_atacado_ativo     = ('atacado'     = ANY(v_mods))
  WHERE id = v_emp;

  -- Encerra plano vigente
  UPDATE public.empresa_plano
     SET status   = 'encerrado',
         data_fim = CURRENT_DATE
   WHERE empresa_id = v_emp AND status = 'ativo'
   RETURNING plano_id INTO v_antes;

  -- Insere novo plano ativo
  INSERT INTO public.empresa_plano (empresa_id, plano_id, status, data_inicio)
  VALUES (v_emp, p_plano_id, 'ativo', CURRENT_DATE);

  RETURN jsonb_build_object(
    'success',        true,
    'plano_anterior', v_antes,
    'plano_novo',     p_plano_id,
    'modulos',        to_jsonb(v_mods)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.alterar_plano_empresa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alterar_plano_empresa(uuid) TO authenticated;
