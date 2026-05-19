
CREATE OR REPLACE FUNCTION public.listar_funcionarios_rh()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'funcionarios', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'nome', f.nome,
          'cpf', f.cpf,
          'email', f.email,
          'telefone', f.telefone,
          'cargo', f.cargo,
          'tipo_vinculo', f.tipo_vinculo,
          'salario_centavos', f.salario_centavos,
          'vt_centavos', f.vt_centavos,
          'va_centavos', f.va_centavos,
          'carga_horaria_semanal', f.carga_horaria_semanal,
          'data_admissao', f.data_admissao,
          'data_demissao', f.data_demissao,
          'ativo', f.ativo,
          'eh_funcionario_rh', f.eh_funcionario_rh,
          'endereco', f.endereco,
          'numero', f.numero,
          'complemento', f.complemento,
          'bairro', f.bairro,
          'cep', f.cep,
          'cidade', f.cidade,
          'estado', f.estado,
          'especialidade', f.especialidade,
          'pendente_pagamento_centavos', COALESCE((
            SELECT SUM(valor_centavos)
            FROM funcionario_movimentacoes m
            WHERE m.funcionario_id = f.id
              AND m.status = 'pendente'
              AND m.estornada_em IS NULL
          ), 0)
        ) ORDER BY f.nome
      )
      FROM funcionarios f
      WHERE f.empresa_id = v_empresa_id
        AND f.deleted_at IS NULL
        AND f.eh_funcionario_rh = true
    ), '[]'::jsonb)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
