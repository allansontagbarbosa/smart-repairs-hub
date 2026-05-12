
CREATE OR REPLACE FUNCTION public.garantir_mes_competencia_comissao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data_entrega date;
  v_data_competencia text;
BEGIN
  SELECT data_entrega INTO v_data_entrega
  FROM ordens_de_servico WHERE id = NEW.ordem_id;

  IF v_data_entrega IS NOT NULL THEN
    v_data_competencia := to_char(v_data_entrega, 'YYYY-MM');
  ELSE
    v_data_competencia := to_char(CURRENT_DATE, 'YYYY-MM');
  END IF;

  NEW.mes_competencia := v_data_competencia;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_garantir_mes_competencia_comissao ON comissoes;
CREATE TRIGGER trg_garantir_mes_competencia_comissao
  BEFORE INSERT ON comissoes
  FOR EACH ROW EXECUTE FUNCTION garantir_mes_competencia_comissao();

CREATE OR REPLACE FUNCTION public.consolidar_comissoes_em_contas_pagar(
  p_competencia text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_func record;
  v_data_competencia date;
  v_data_vencimento date;
  v_conta_existente_id uuid;
  v_descricao text;
  v_count_novas int := 0;
  v_count_atualizadas int := 0;
  v_total_geral bigint := 0;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  v_data_competencia := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_data_vencimento := (v_data_competencia + interval '1 month' - interval '1 day')::date;

  FOR v_func IN
    SELECT
      c.funcionario_id,
      f.nome AS func_nome,
      SUM(c.valor) AS total_valor,
      COUNT(*) AS qtd_comissoes
    FROM comissoes c
    JOIN funcionarios f ON f.id = c.funcionario_id
    JOIN ordens_de_servico os ON os.id = c.ordem_id
    WHERE c.empresa_id = v_empresa_id
      AND c.estornada_em IS NULL
      AND c.status = 'pendente'
      AND os.deleted_at IS NULL
      AND to_char(os.data_entrega, 'YYYY-MM') = p_competencia
    GROUP BY c.funcionario_id, f.nome
  LOOP
    v_total_geral := v_total_geral + (v_func.total_valor * 100)::bigint;
    v_descricao := 'COMISSÕES ' || upper(v_func.func_nome) || ' - ' || p_competencia;

    SELECT id INTO v_conta_existente_id
    FROM contas_a_pagar
    WHERE empresa_id = v_empresa_id
      AND mes_competencia = p_competencia
      AND descricao = v_descricao
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_conta_existente_id IS NOT NULL THEN
      UPDATE contas_a_pagar SET
        valor = v_func.total_valor,
        updated_at = now()
      WHERE id = v_conta_existente_id
        AND status = 'pendente';
      v_count_atualizadas := v_count_atualizadas + 1;
    ELSE
      INSERT INTO contas_a_pagar (
        empresa_id, descricao, valor, categoria, centro_custo,
        data_vencimento, status, mes_competencia, recorrente
      ) VALUES (
        v_empresa_id, v_descricao, v_func.total_valor,
        'Comissões', 'Administrativo',
        v_data_vencimento, 'pendente', p_competencia, false
      );
      v_count_novas := v_count_novas + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'competencia', p_competencia,
    'contas_novas', v_count_novas,
    'contas_atualizadas', v_count_atualizadas,
    'total_centavos', v_total_geral,
    'total_reais', (v_total_geral / 100.0)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.consolidar_comissoes_em_contas_pagar(text) TO authenticated;
