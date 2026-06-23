CREATE OR REPLACE FUNCTION public.atacado_excluir_modelo(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid;
BEGIN
  v_emp := public.get_my_empresa_id();
  DELETE FROM public.atacado_catalogo_modelos WHERE id = p_id AND empresa_id = v_emp;
  RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_excluir_pedido(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid;
BEGIN
  v_emp := public.get_my_empresa_id();
  DELETE FROM public.atacado_pedidos WHERE id = p_id AND empresa_id = v_emp;
  RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_excluir_cliente(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_n int;
BEGIN
  v_emp := public.get_my_empresa_id();
  SELECT count(*) INTO v_n FROM public.atacado_pedidos
    WHERE cliente_id = p_id AND empresa_id = v_emp;
  IF v_n > 0 THEN
    RETURN jsonb_build_object('success', false,
      'error', format('Este cliente tem %s pedido(s). Exclua os pedidos primeiro.', v_n));
  END IF;
  DELETE FROM public.atacado_clientes WHERE id = p_id AND empresa_id = v_emp;
  RETURN jsonb_build_object('success', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.atacado_excluir_modelo(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.atacado_excluir_pedido(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.atacado_excluir_cliente(uuid) TO authenticated;