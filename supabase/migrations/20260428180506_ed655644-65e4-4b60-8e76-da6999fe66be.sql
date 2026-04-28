CREATE OR REPLACE FUNCTION public.soltar_servico_os(p_os_servico_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_funcionario_id uuid;
  v_servico record;
BEGIN
  SELECT f.id INTO v_funcionario_id
  FROM public.funcionarios f
  JOIN public.user_profiles up ON up.funcionario_id = f.id
  WHERE up.user_id = auth.uid() AND f.deleted_at IS NULL
  LIMIT 1;

  IF v_funcionario_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não vinculado');
  END IF;

  SELECT * INTO v_servico FROM public.os_servicos WHERE id = p_os_servico_id;

  IF v_servico IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Serviço não encontrado');
  END IF;

  IF v_servico.tecnico_id != v_funcionario_id THEN
    RETURN json_build_object('success', false, 'error', 'Apenas o técnico atribuído pode soltar');
  END IF;

  IF v_servico.status::text NOT IN ('em_reparo', 'pendente') THEN
    RETURN json_build_object('success', false, 'error', 'Não é possível soltar serviço já concluído');
  END IF;

  UPDATE public.os_servicos
  SET tecnico_id = NULL,
      status = 'pendente'::public.status_servico,
      iniciado_em = NULL
  WHERE id = p_os_servico_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.soltar_servico_os(uuid) TO authenticated;