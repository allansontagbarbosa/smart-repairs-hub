CREATE OR REPLACE FUNCTION public.criar_prejuizo(
  p_tipo public.tipo_prejuizo,
  p_valor_centavos integer,
  p_descricao text DEFAULT NULL,
  p_observacoes text DEFAULT NULL,
  p_os_origem_id uuid DEFAULT NULL,
  p_os_retrabalho_id uuid DEFAULT NULL,
  p_data_evento date DEFAULT CURRENT_DATE,
  p_origem text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa_id uuid;
  v_prejuizo_id uuid;
  v_movimentacao_id uuid;
  v_descricao_movimentacao text;
  v_os_numero integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;
  IF p_valor_centavos IS NULL OR p_valor_centavos < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor inválido');
  END IF;
  IF p_origem NOT IN ('manual','automatico_garantia','automatico_cancelamento') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Origem inválida');
  END IF;

  SELECT empresa_id INTO v_empresa_id
  FROM public.user_profiles WHERE user_id = v_user_id LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não vinculado a empresa');
  END IF;

  IF p_os_origem_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.ordens_de_servico WHERE id = p_os_origem_id AND empresa_id = v_empresa_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'OS de origem não encontrada ou de outra empresa');
    END IF;
  END IF;

  IF p_os_retrabalho_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.ordens_de_servico WHERE id = p_os_retrabalho_id AND empresa_id = v_empresa_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'OS de retrabalho não encontrada ou de outra empresa');
    END IF;
  END IF;

  IF p_origem = 'automatico_garantia' AND p_os_retrabalho_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.prejuizos
      WHERE os_retrabalho_id = p_os_retrabalho_id AND origem = 'automatico_garantia' AND deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Já existe prejuízo automático para esta OS retrabalho');
    END IF;
  END IF;

  INSERT INTO public.prejuizos (
    empresa_id, tipo, valor_centavos, descricao, observacoes,
    os_origem_id, os_retrabalho_id, data_evento, origem,
    created_by, updated_by
  ) VALUES (
    v_empresa_id, p_tipo, p_valor_centavos, p_descricao, p_observacoes,
    p_os_origem_id, p_os_retrabalho_id, p_data_evento, p_origem,
    v_user_id, v_user_id
  ) RETURNING id INTO v_prejuizo_id;

  IF p_os_origem_id IS NOT NULL THEN
    SELECT numero INTO v_os_numero FROM public.ordens_de_servico WHERE id = p_os_origem_id;
  ELSIF p_os_retrabalho_id IS NOT NULL THEN
    SELECT numero INTO v_os_numero FROM public.ordens_de_servico WHERE id = p_os_retrabalho_id;
  END IF;

  v_descricao_movimentacao := 'Prejuízo: ' || replace(p_tipo::text, '_', ' ');
  IF v_os_numero IS NOT NULL THEN
    v_descricao_movimentacao := v_descricao_movimentacao || ' - OS #' || v_os_numero;
  END IF;
  IF p_descricao IS NOT NULL AND p_descricao <> '' THEN
    v_descricao_movimentacao := v_descricao_movimentacao || ' - ' || p_descricao;
  END IF;

  INSERT INTO public.movimentacoes_financeiras (
    empresa_id, tipo, descricao, valor, data, ordem_id, categoria
  ) VALUES (
    v_empresa_id, 'prejuizo', v_descricao_movimentacao,
    (p_valor_centavos::numeric / 100), p_data_evento,
    COALESCE(p_os_origem_id, p_os_retrabalho_id), 'prejuizo'
  ) RETURNING id INTO v_movimentacao_id;

  UPDATE public.prejuizos SET movimentacao_financeira_id = v_movimentacao_id WHERE id = v_prejuizo_id;

  RETURN jsonb_build_object(
    'success', true,
    'prejuizo_id', v_prejuizo_id,
    'movimentacao_financeira_id', v_movimentacao_id,
    'valor_centavos', p_valor_centavos,
    'tipo', p_tipo::text,
    'origem', p_origem
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_prejuizo TO authenticated;
NOTIFY pgrst, 'reload schema';