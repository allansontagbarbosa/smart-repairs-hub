CREATE OR REPLACE FUNCTION public.liberar_comissao(p_comissao_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_role text;
  v_empresa_id uuid;
  v_comissao record;
BEGIN
  SELECT pa.nome, up.empresa_id INTO v_user_role, v_empresa_id
  FROM public.user_profiles up
  LEFT JOIN public.perfis_acesso pa ON pa.id = up.perfil_id
  WHERE up.user_id = auth.uid()
  LIMIT 1;

  IF v_user_role NOT IN ('Administrador', 'Gerente', 'Financeiro') THEN
    RETURN json_build_object('success', false, 'error', 'Sem permissão para liberar comissão');
  END IF;

  SELECT * INTO v_comissao
  FROM public.comissoes
  WHERE id = p_comissao_id AND empresa_id = v_empresa_id;

  IF v_comissao IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Comissão não encontrada');
  END IF;

  IF v_comissao.estornada_em IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Comissão estornada não pode ser liberada');
  END IF;

  IF v_comissao.status::text != 'pendente' THEN
    RETURN json_build_object('success', false, 'error', 'Apenas comissões pendentes podem ser liberadas');
  END IF;

  UPDATE public.comissoes
  SET status = 'liberada'::public.status_comissao,
      updated_at = now()
  WHERE id = p_comissao_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.liberar_comissao(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.pagar_comissao(p_comissao_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_role text;
  v_empresa_id uuid;
  v_comissao record;
  v_funcionario_nome text;
BEGIN
  SELECT pa.nome, up.empresa_id INTO v_user_role, v_empresa_id
  FROM public.user_profiles up
  LEFT JOIN public.perfis_acesso pa ON pa.id = up.perfil_id
  WHERE up.user_id = auth.uid()
  LIMIT 1;

  IF v_user_role NOT IN ('Administrador', 'Gerente', 'Financeiro') THEN
    RETURN json_build_object('success', false, 'error', 'Sem permissão para pagar comissão');
  END IF;

  SELECT * INTO v_comissao
  FROM public.comissoes
  WHERE id = p_comissao_id AND empresa_id = v_empresa_id;

  IF v_comissao IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Comissão não encontrada');
  END IF;

  IF v_comissao.estornada_em IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Comissão estornada não pode ser paga');
  END IF;

  IF v_comissao.status::text NOT IN ('pendente', 'liberada') THEN
    RETURN json_build_object('success', false, 'error', 'Comissão já está paga ou em estado inválido');
  END IF;

  SELECT nome INTO v_funcionario_nome
  FROM public.funcionarios
  WHERE id = v_comissao.funcionario_id;

  UPDATE public.comissoes
  SET status = 'paga'::public.status_comissao,
      data_pagamento = now(),
      updated_at = now()
  WHERE id = p_comissao_id;

  INSERT INTO public.movimentacoes_financeiras (
    tipo, valor, descricao, ordem_id, data, empresa_id
  ) VALUES (
    'saida'::public.tipo_movimentacao,
    v_comissao.valor,
    'Comissão paga: ' || COALESCE(v_funcionario_nome, 'sem nome'),
    v_comissao.ordem_id,
    now(),
    v_empresa_id
  );

  RETURN json_build_object('success', true, 'valor_pago', v_comissao.valor);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pagar_comissao(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.pagar_comissoes_em_lote(p_comissao_ids uuid[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_resultados json[] := '{}';
  v_resultado json;
  v_total_pago numeric := 0;
  v_count_pagas int := 0;
  v_count_erros int := 0;
BEGIN
  FOREACH v_id IN ARRAY p_comissao_ids
  LOOP
    v_resultado := public.pagar_comissao(v_id);
    IF (v_resultado->>'success')::boolean THEN
      v_count_pagas := v_count_pagas + 1;
      v_total_pago := v_total_pago + COALESCE((v_resultado->>'valor_pago')::numeric, 0);
    ELSE
      v_count_erros := v_count_erros + 1;
    END IF;
    v_resultados := array_append(v_resultados, v_resultado);
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'count_pagas', v_count_pagas,
    'count_erros', v_count_erros,
    'total_pago', v_total_pago,
    'resultados', v_resultados
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pagar_comissoes_em_lote(uuid[]) TO authenticated;