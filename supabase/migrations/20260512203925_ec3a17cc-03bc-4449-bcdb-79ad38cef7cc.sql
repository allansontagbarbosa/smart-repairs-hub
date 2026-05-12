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
  v_total_centavos bigint;
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
    WHERE c.empresa_id = v_empresa_id
      AND c.estornada_em IS NULL
      AND c.status::text = 'pendente'
      AND (
        c.mes_competencia = p_competencia OR
        (c.mes_competencia IS NULL AND to_char(c.created_at, 'YYYY-MM') = p_competencia)
      )
    GROUP BY c.funcionario_id, f.nome
  LOOP
    v_total_centavos := (v_func.total_valor * 100)::bigint;
    v_total_geral := v_total_geral + v_total_centavos;
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
        AND status::text = 'pendente';
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

CREATE OR REPLACE FUNCTION public.criar_conta_pagar_prejuizo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data_vencimento date;
  v_competencia text;
  v_descricao text;
BEGIN
  v_data_vencimento := COALESCE(NEW.data_evento, CURRENT_DATE);
  v_competencia := to_char(v_data_vencimento, 'YYYY-MM');
  v_descricao := 'PREJUÍZO ' || upper(REPLACE(NEW.tipo::text, '_', ' '));
  
  IF NEW.descricao IS NOT NULL AND length(trim(NEW.descricao)) > 0 THEN
    v_descricao := v_descricao || ' - ' || NEW.descricao;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM contas_a_pagar
    WHERE empresa_id = NEW.empresa_id
      AND descricao = v_descricao
      AND mes_competencia = v_competencia
      AND deleted_at IS NULL
  ) THEN
    INSERT INTO contas_a_pagar (
      empresa_id, descricao, valor, categoria, centro_custo,
      data_vencimento, status, mes_competencia, recorrente,
      observacoes
    ) VALUES (
      NEW.empresa_id, 
      v_descricao,
      NEW.valor_centavos / 100.0,
      'Prejuízos',
      'Operacional',
      v_data_vencimento,
      'paga',
      v_competencia,
      false,
      'Prejuízo registrado automaticamente. ID: ' || NEW.id::text
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conta_pagar_prejuizo ON prejuizos;
CREATE TRIGGER trg_conta_pagar_prejuizo
  AFTER INSERT ON prejuizos
  FOR EACH ROW EXECUTE FUNCTION criar_conta_pagar_prejuizo();