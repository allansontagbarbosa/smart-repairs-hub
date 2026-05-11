CREATE OR REPLACE FUNCTION public.criar_funcionario_rh(
  p_nome text,
  p_cpf text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_cargo text DEFAULT NULL,
  p_tipo_vinculo text DEFAULT 'clt',
  p_salario_centavos bigint DEFAULT NULL,
  p_vt_centavos bigint DEFAULT 0,
  p_va_centavos bigint DEFAULT 0,
  p_carga_horaria_semanal numeric DEFAULT NULL,
  p_data_admissao date DEFAULT NULL,
  p_valor_diaria_centavos bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_func_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  IF p_nome IS NULL OR length(trim(p_nome)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome obrigatório');
  END IF;

  IF p_cpf IS NOT NULL AND length(trim(p_cpf)) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM funcionarios
      WHERE empresa_id = v_empresa_id
        AND cpf = p_cpf
        AND deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Já existe funcionário com este CPF');
    END IF;
  END IF;

  INSERT INTO funcionarios (
    empresa_id, nome, cpf, email, telefone, cargo,
    tipo_vinculo, salario_centavos, vt_centavos, va_centavos,
    carga_horaria_semanal, data_admissao, valor_diaria_centavos,
    ativo, eh_funcionario_rh
  ) VALUES (
    v_empresa_id, p_nome, NULLIF(p_cpf, ''), NULLIF(p_email, ''),
    NULLIF(p_telefone, ''), NULLIF(p_cargo, ''),
    p_tipo_vinculo::tipo_vinculo_rh,
    p_salario_centavos, COALESCE(p_vt_centavos, 0), COALESCE(p_va_centavos, 0),
    p_carga_horaria_semanal, p_data_admissao, p_valor_diaria_centavos,
    true, true
  ) RETURNING id INTO v_func_id;

  RETURN jsonb_build_object(
    'success', true,
    'funcionario_id', v_func_id,
    'message', 'Funcionário cadastrado com sucesso'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_funcionario_rh(
  text, text, text, text, text, text,
  bigint, bigint, bigint, numeric, date, bigint
) TO authenticated;