-- RPC: marcar_os_pagas_em_massa
-- Marca várias OS como pagas (valor_pago = valor_total, valor_pendente = 0)
-- restrito à empresa do usuário autenticado.

CREATE OR REPLACE FUNCTION public.marcar_os_pagas_em_massa(
  p_os_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_atualizadas int;
BEGIN
  v_empresa := public.get_my_empresa_id();

  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário sem empresa vinculada');
  END IF;

  IF p_os_ids IS NULL OR array_length(p_os_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lista de OS vazia');
  END IF;

  UPDATE public.ordens_de_servico
     SET valor_pago = COALESCE(valor_total, valor, 0),
         valor_pendente = 0,
         updated_at = now()
   WHERE id = ANY(p_os_ids)
     AND empresa_id = v_empresa
     AND deleted_at IS NULL
     AND COALESCE(valor_pago, 0) < COALESCE(valor_total, valor, 0);

  GET DIAGNOSTICS v_atualizadas = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'atualizadas', v_atualizadas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_os_pagas_em_massa(uuid[]) TO authenticated;