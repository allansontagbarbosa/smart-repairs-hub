
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS tipo_organizacao text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS qtd_funcionarios text;

CREATE OR REPLACE FUNCTION public.onboarding_criar_empresa(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_empresa_id uuid;
  v_modulos    text[];
  v_plano_id   uuid;
  v_existing   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'nao autenticado');
  END IF;

  SELECT empresa_id INTO v_existing
  FROM   public.user_profiles
  WHERE  (user_id = v_uid OR id = v_uid) AND empresa_id IS NOT NULL
  LIMIT  1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'usuario ja possui empresa',
                              'empresa_id', v_existing);
  END IF;

  v_modulos := ARRAY(SELECT jsonb_array_elements_text(p_payload->'modulos'));

  IF array_length(v_modulos, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'selecione ao menos um modulo');
  END IF;

  INSERT INTO public.empresas (
    nome, cnpj, cidade, estado, tipo_organizacao, qtd_funcionarios,
    modulo_assistencia_ativo, modulo_loja_ativo, modulo_atacado_ativo,
    owner_id
  ) VALUES (
    p_payload->>'nome',
    p_payload->>'cnpj',
    p_payload->>'cidade',
    p_payload->>'uf',
    ARRAY(SELECT jsonb_array_elements_text(p_payload->'tipo_organizacao')),
    p_payload->>'qtd_funcionarios',
    'assistencia' = ANY(v_modulos),
    'loja'        = ANY(v_modulos),
    'atacado'     = ANY(v_modulos),
    v_uid
  ) RETURNING id INTO v_empresa_id;

  SELECT p.id INTO v_plano_id
  FROM   public.planos p
  WHERE  (
           SELECT array_agg(pm.modulo ORDER BY pm.modulo)
           FROM   public.plano_modulos pm
           WHERE  pm.plano_id = p.id
         ) = (SELECT array_agg(m ORDER BY m) FROM unnest(v_modulos) m)
  LIMIT 1;

  IF v_plano_id IS NOT NULL THEN
    INSERT INTO public.empresa_plano (empresa_id, plano_id, status, data_inicio)
    VALUES (v_empresa_id, v_plano_id, 'ativo', CURRENT_DATE);
  END IF;

  -- vincula usuário: tenta UPDATE; se não existir, INSERT
  UPDATE public.user_profiles
     SET empresa_id = v_empresa_id
   WHERE (user_id = v_uid OR id = v_uid);

  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (user_id, empresa_id, ativo)
    VALUES (v_uid, v_empresa_id, true);
  END IF;

  RETURN jsonb_build_object('success', true,
                            'empresa_id', v_empresa_id,
                            'plano_id',   v_plano_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.onboarding_criar_empresa(jsonb) TO authenticated;
