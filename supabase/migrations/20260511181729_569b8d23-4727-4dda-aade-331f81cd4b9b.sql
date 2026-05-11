-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE tipo_vinculo_rh AS ENUM ('clt', 'pj', 'mei', 'diarista', 'freelancer', 'estagiario', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_movimentacao_func AS ENUM (
    'salario', 'comissao', 'vale_transporte', 'vale_alimentacao',
    'hora_extra', 'falta_descontada', 'bonus', 'adiantamento',
    'reembolso', 'desconto_diverso', 'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_movimentacao_func AS ENUM ('pendente', 'pago', 'estornado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE acao_hora_excedente AS ENUM ('pendente_decisao', 'pago_como_extra', 'mantido_em_banco', 'compensado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Expand funcionarios
ALTER TABLE funcionarios 
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS tipo_vinculo tipo_vinculo_rh DEFAULT 'clt',
  ADD COLUMN IF NOT EXISTS salario_centavos bigint,
  ADD COLUMN IF NOT EXISTS valor_diaria_centavos bigint,
  ADD COLUMN IF NOT EXISTS vt_centavos bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS va_centavos bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carga_horaria_semanal numeric,
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS agencia text,
  ADD COLUMN IF NOT EXISTS conta_bancaria text,
  ADD COLUMN IF NOT EXISTS chave_pix text,
  ADD COLUMN IF NOT EXISTS observacoes_rh text,
  ADD COLUMN IF NOT EXISTS data_demissao date;

CREATE INDEX IF NOT EXISTS idx_funcionarios_empresa_ativo 
  ON funcionarios(empresa_id, ativo) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_funcionarios_cpf_empresa
  ON funcionarios(empresa_id, cpf) WHERE cpf IS NOT NULL AND deleted_at IS NULL;

-- 2. PONTO
CREATE TABLE IF NOT EXISTS funcionario_ponto_entradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  data date NOT NULL,
  hora_entrada time,
  hora_saida_almoco time,
  hora_volta_almoco time,
  hora_saida time,
  horas_trabalhadas numeric DEFAULT 0,
  falta boolean DEFAULT false,
  falta_justificada boolean DEFAULT false,
  atestado_medico boolean DEFAULT false,
  abonada boolean DEFAULT false,
  justificativa text,
  importacao_id uuid,
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (funcionario_id, data)
);

CREATE INDEX IF NOT EXISTS idx_ponto_empresa_data ON funcionario_ponto_entradas(empresa_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_ponto_func_data ON funcionario_ponto_entradas(funcionario_id, data DESC);

CREATE OR REPLACE FUNCTION calcular_horas_trabalhadas()
RETURNS TRIGGER AS $$
DECLARE
  v_trabalho numeric := 0;
  v_almoco numeric := 0;
BEGIN
  IF NEW.falta THEN
    NEW.horas_trabalhadas := 0;
    RETURN NEW;
  END IF;
  IF NEW.hora_entrada IS NOT NULL AND NEW.hora_saida IS NOT NULL THEN
    v_trabalho := EXTRACT(EPOCH FROM (NEW.hora_saida - NEW.hora_entrada)) / 3600;
    IF NEW.hora_saida_almoco IS NOT NULL AND NEW.hora_volta_almoco IS NOT NULL THEN
      v_almoco := EXTRACT(EPOCH FROM (NEW.hora_volta_almoco - NEW.hora_saida_almoco)) / 3600;
    END IF;
    NEW.horas_trabalhadas := GREATEST(0, v_trabalho - v_almoco);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_calcular_horas ON funcionario_ponto_entradas;
CREATE TRIGGER trg_calcular_horas 
  BEFORE INSERT OR UPDATE ON funcionario_ponto_entradas
  FOR EACH ROW EXECUTE FUNCTION calcular_horas_trabalhadas();

-- 3. MOVIMENTAÇÕES
CREATE TABLE IF NOT EXISTS funcionario_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  competencia_ano_mes text NOT NULL,
  tipo tipo_movimentacao_func NOT NULL,
  descricao text,
  valor_centavos bigint NOT NULL,
  status status_movimentacao_func DEFAULT 'pendente',
  data_pagamento date,
  forma_pagamento text,
  conta_pagar_id uuid REFERENCES contas_a_pagar(id),
  ponto_entrada_id uuid REFERENCES funcionario_ponto_entradas(id),
  comissao_id uuid REFERENCES comissoes(id),
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  estornada_em timestamptz,
  motivo_estorno text
);

CREATE INDEX IF NOT EXISTS idx_movs_func_competencia 
  ON funcionario_movimentacoes(funcionario_id, competencia_ano_mes) 
  WHERE estornada_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_movs_empresa_status 
  ON funcionario_movimentacoes(empresa_id, status) 
  WHERE estornada_em IS NULL;

-- 4. IMPORTS
CREATE TABLE IF NOT EXISTS funcionario_importacoes_ponto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  arquivo_nome text NOT NULL,
  mes_referencia text,
  status text NOT NULL DEFAULT 'processando',
  linhas_total int DEFAULT 0,
  linhas_processadas int DEFAULT 0,
  linhas_erro int DEFAULT 0,
  erros jsonb DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  concluido_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_imports_empresa 
  ON funcionario_importacoes_ponto(empresa_id, created_at DESC);

-- 5. RLS
ALTER TABLE funcionario_ponto_entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE funcionario_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE funcionario_importacoes_ponto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ponto_empresa_isolada ON funcionario_ponto_entradas;
CREATE POLICY ponto_empresa_isolada ON funcionario_ponto_entradas
  FOR ALL TO authenticated
  USING (empresa_id = get_my_empresa_id())
  WITH CHECK (empresa_id = get_my_empresa_id());

DROP POLICY IF EXISTS movs_empresa_isolada ON funcionario_movimentacoes;
CREATE POLICY movs_empresa_isolada ON funcionario_movimentacoes
  FOR ALL TO authenticated
  USING (empresa_id = get_my_empresa_id())
  WITH CHECK (empresa_id = get_my_empresa_id());

DROP POLICY IF EXISTS imports_empresa_isolada ON funcionario_importacoes_ponto;
CREATE POLICY imports_empresa_isolada ON funcionario_importacoes_ponto
  FOR ALL TO authenticated
  USING (empresa_id = get_my_empresa_id())
  WITH CHECK (empresa_id = get_my_empresa_id());

-- 6. RPC: registrar_falta
CREATE OR REPLACE FUNCTION public.registrar_falta(
  p_funcionario_id uuid,
  p_data date,
  p_falta_justificada boolean DEFAULT false,
  p_atestado_medico boolean DEFAULT false,
  p_abonada boolean DEFAULT false,
  p_justificativa text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_func record;
  v_ponto_id uuid;
  v_desconto bigint := 0;
  v_competencia text;
  v_deve_descontar boolean := false;
BEGIN
  v_empresa_id := get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT * INTO v_func FROM funcionarios 
  WHERE id = p_funcionario_id AND empresa_id = v_empresa_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Funcionário não encontrado');
  END IF;

  INSERT INTO funcionario_ponto_entradas (
    empresa_id, funcionario_id, data, falta, 
    falta_justificada, atestado_medico, abonada, justificativa, created_by
  ) VALUES (
    v_empresa_id, p_funcionario_id, p_data, true,
    p_falta_justificada, p_atestado_medico, p_abonada, p_justificativa, auth.uid()
  )
  ON CONFLICT (funcionario_id, data) DO UPDATE SET
    falta = true,
    falta_justificada = EXCLUDED.falta_justificada,
    atestado_medico = EXCLUDED.atestado_medico,
    abonada = EXCLUDED.abonada,
    justificativa = EXCLUDED.justificativa,
    updated_at = now()
  RETURNING id INTO v_ponto_id;

  IF v_func.tipo_vinculo = 'clt' 
     AND v_func.salario_centavos IS NOT NULL 
     AND v_func.salario_centavos > 0
     AND NOT p_atestado_medico 
     AND NOT p_abonada 
  THEN
    v_deve_descontar := true;
    v_desconto := v_func.salario_centavos / 30;
  END IF;

  IF v_deve_descontar THEN
    v_competencia := to_char(p_data, 'YYYY-MM');
    INSERT INTO funcionario_movimentacoes (
      empresa_id, funcionario_id, data, competencia_ano_mes,
      tipo, descricao, valor_centavos, status,
      ponto_entrada_id, created_by
    ) VALUES (
      v_empresa_id, p_funcionario_id, p_data, v_competencia,
      'falta_descontada', 
      'Falta em ' || to_char(p_data, 'DD/MM/YYYY') || 
        CASE WHEN p_falta_justificada THEN ' (justificada mas não abonada)' ELSE ' (não justificada)' END,
      -v_desconto, 'pendente',
      v_ponto_id, auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'ponto_id', v_ponto_id,
    'desconto_aplicado', v_deve_descontar,
    'valor_desconto_centavos', v_desconto
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 7. RPC: gerar_folha_mensal
CREATE OR REPLACE FUNCTION public.gerar_folha_mensal(p_competencia text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_func record;
  v_data date;
  v_lancados int := 0;
  v_total_vt bigint := 0;
  v_total_va bigint := 0;
  v_total_salario bigint := 0;
BEGIN
  v_empresa_id := get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  v_data := to_date(p_competencia || '-01', 'YYYY-MM-DD');

  FOR v_func IN 
    SELECT * FROM funcionarios 
    WHERE empresa_id = v_empresa_id AND ativo = true AND deleted_at IS NULL
  LOOP
    IF v_func.tipo_vinculo = 'clt' 
       AND v_func.salario_centavos IS NOT NULL 
       AND v_func.salario_centavos > 0
       AND NOT EXISTS (
         SELECT 1 FROM funcionario_movimentacoes 
         WHERE funcionario_id = v_func.id 
           AND competencia_ano_mes = p_competencia
           AND tipo = 'salario'
           AND estornada_em IS NULL
       )
    THEN
      INSERT INTO funcionario_movimentacoes (
        empresa_id, funcionario_id, data, competencia_ano_mes,
        tipo, descricao, valor_centavos, status, created_by
      ) VALUES (
        v_empresa_id, v_func.id, v_data, p_competencia,
        'salario', 'Salário ' || p_competencia, 
        v_func.salario_centavos, 'pendente', auth.uid()
      );
      v_total_salario := v_total_salario + v_func.salario_centavos;
      v_lancados := v_lancados + 1;
    END IF;

    IF v_func.vt_centavos > 0 AND NOT EXISTS (
      SELECT 1 FROM funcionario_movimentacoes 
      WHERE funcionario_id = v_func.id 
        AND competencia_ano_mes = p_competencia
        AND tipo = 'vale_transporte'
        AND estornada_em IS NULL
    ) THEN
      INSERT INTO funcionario_movimentacoes (
        empresa_id, funcionario_id, data, competencia_ano_mes,
        tipo, descricao, valor_centavos, status, created_by
      ) VALUES (
        v_empresa_id, v_func.id, v_data, p_competencia,
        'vale_transporte', 'VT ' || p_competencia, 
        v_func.vt_centavos, 'pendente', auth.uid()
      );
      v_total_vt := v_total_vt + v_func.vt_centavos;
    END IF;

    IF v_func.va_centavos > 0 AND NOT EXISTS (
      SELECT 1 FROM funcionario_movimentacoes 
      WHERE funcionario_id = v_func.id 
        AND competencia_ano_mes = p_competencia
        AND tipo = 'vale_alimentacao'
        AND estornada_em IS NULL
    ) THEN
      INSERT INTO funcionario_movimentacoes (
        empresa_id, funcionario_id, data, competencia_ano_mes,
        tipo, descricao, valor_centavos, status, created_by
      ) VALUES (
        v_empresa_id, v_func.id, v_data, p_competencia,
        'vale_alimentacao', 'VA ' || p_competencia, 
        v_func.va_centavos, 'pendente', auth.uid()
      );
      v_total_va := v_total_va + v_func.va_centavos;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'competencia', p_competencia,
    'funcionarios_processados', v_lancados,
    'total_salarios_centavos', v_total_salario,
    'total_vt_centavos', v_total_vt,
    'total_va_centavos', v_total_va
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 8. RPC: extrato_funcionario
CREATE OR REPLACE FUNCTION public.extrato_funcionario(
  p_funcionario_id uuid,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_resultado jsonb;
  v_total_devo bigint := 0;
  v_total_pago bigint := 0;
BEGIN
  v_empresa_id := get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT 
    COALESCE(SUM(valor_centavos) FILTER (WHERE status = 'pendente'), 0),
    COALESCE(SUM(valor_centavos) FILTER (WHERE status = 'pago'), 0)
  INTO v_total_devo, v_total_pago
  FROM funcionario_movimentacoes
  WHERE funcionario_id = p_funcionario_id
    AND empresa_id = v_empresa_id
    AND estornada_em IS NULL
    AND (p_data_inicio IS NULL OR data >= p_data_inicio)
    AND (p_data_fim IS NULL OR data <= p_data_fim);

  SELECT jsonb_build_object(
    'success', true,
    'total_pendente_centavos', v_total_devo,
    'total_pago_centavos', v_total_pago,
    'saldo_a_pagar_centavos', v_total_devo,
    'movimentacoes', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'data', m.data,
        'competencia', m.competencia_ano_mes,
        'tipo', m.tipo,
        'descricao', m.descricao,
        'valor_centavos', m.valor_centavos,
        'status', m.status,
        'data_pagamento', m.data_pagamento,
        'observacoes', m.observacoes
      ) ORDER BY m.data DESC, m.created_at DESC
    ), '[]'::jsonb)
  ) INTO v_resultado
  FROM funcionario_movimentacoes m
  WHERE m.funcionario_id = p_funcionario_id
    AND m.empresa_id = v_empresa_id
    AND m.estornada_em IS NULL
    AND (p_data_inicio IS NULL OR m.data >= p_data_inicio)
    AND (p_data_fim IS NULL OR m.data <= p_data_fim);

  RETURN v_resultado;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 9. RPC: holerite_funcionario
CREATE OR REPLACE FUNCTION public.holerite_funcionario(
  p_funcionario_id uuid,
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
  v_data_ini date;
  v_data_fim date;
  v_proventos bigint := 0;
  v_descontos bigint := 0;
  v_horas_trab numeric := 0;
  v_dias_trab int := 0;
  v_faltas int := 0;
BEGIN
  v_empresa_id := get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT * INTO v_func FROM funcionarios
  WHERE id = p_funcionario_id AND empresa_id = v_empresa_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Funcionário não encontrado');
  END IF;

  v_data_ini := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_data_fim := (v_data_ini + interval '1 month - 1 day')::date;

  SELECT COALESCE(SUM(valor_centavos), 0) INTO v_proventos
  FROM funcionario_movimentacoes
  WHERE funcionario_id = p_funcionario_id
    AND empresa_id = v_empresa_id
    AND competencia_ano_mes = p_competencia
    AND valor_centavos > 0
    AND estornada_em IS NULL;

  SELECT COALESCE(SUM(ABS(valor_centavos)), 0) INTO v_descontos
  FROM funcionario_movimentacoes
  WHERE funcionario_id = p_funcionario_id
    AND empresa_id = v_empresa_id
    AND competencia_ano_mes = p_competencia
    AND valor_centavos < 0
    AND estornada_em IS NULL;

  SELECT 
    COALESCE(SUM(horas_trabalhadas), 0),
    COUNT(*) FILTER (WHERE NOT falta),
    COUNT(*) FILTER (WHERE falta)
  INTO v_horas_trab, v_dias_trab, v_faltas
  FROM funcionario_ponto_entradas
  WHERE funcionario_id = p_funcionario_id
    AND empresa_id = v_empresa_id
    AND data BETWEEN v_data_ini AND v_data_fim;

  RETURN jsonb_build_object(
    'success', true,
    'funcionario', jsonb_build_object(
      'id', v_func.id,
      'nome', v_func.nome,
      'cargo', v_func.cargo,
      'tipo_vinculo', v_func.tipo_vinculo
    ),
    'competencia', p_competencia,
    'total_proventos_centavos', v_proventos,
    'total_descontos_centavos', v_descontos,
    'liquido_centavos', v_proventos - v_descontos,
    'horas_trabalhadas', v_horas_trab,
    'dias_trabalhados', v_dias_trab,
    'faltas', v_faltas,
    'movimentacoes', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'tipo', m.tipo,
          'descricao', m.descricao,
          'valor_centavos', m.valor_centavos,
          'status', m.status,
          'data', m.data
        ) ORDER BY m.tipo, m.data
      )
      FROM funcionario_movimentacoes m
      WHERE m.funcionario_id = p_funcionario_id
        AND m.competencia_ano_mes = p_competencia
        AND m.estornada_em IS NULL
    ), '[]'::jsonb)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 10. RPC: calcular_banco_horas
CREATE OR REPLACE FUNCTION public.calcular_banco_horas(
  p_funcionario_id uuid,
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
  v_data_ini date;
  v_data_fim date;
  v_horas_trab numeric := 0;
  v_dias_uteis int := 0;
  v_horas_esperadas numeric := 0;
  v_saldo numeric := 0;
BEGIN
  v_empresa_id := get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT * INTO v_func FROM funcionarios
  WHERE id = p_funcionario_id AND empresa_id = v_empresa_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Funcionário não encontrado');
  END IF;

  v_data_ini := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_data_fim := (v_data_ini + interval '1 month - 1 day')::date;

  SELECT COALESCE(SUM(horas_trabalhadas), 0) INTO v_horas_trab
  FROM funcionario_ponto_entradas
  WHERE funcionario_id = p_funcionario_id
    AND empresa_id = v_empresa_id
    AND data BETWEEN v_data_ini AND v_data_fim;

  SELECT COUNT(*) INTO v_dias_uteis
  FROM generate_series(v_data_ini, v_data_fim, '1 day') d
  WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5;

  IF v_func.carga_horaria_semanal IS NOT NULL THEN
    v_horas_esperadas := (v_func.carga_horaria_semanal / 5.0) * v_dias_uteis;
  END IF;

  v_saldo := v_horas_trab - v_horas_esperadas;

  RETURN jsonb_build_object(
    'success', true,
    'competencia', p_competencia,
    'horas_esperadas', v_horas_esperadas,
    'horas_trabalhadas', v_horas_trab,
    'saldo_horas', v_saldo,
    'tem_excedente', v_saldo > 0,
    'tem_devedoras', v_saldo < 0
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 11. RPC: aplicar_acao_banco_horas
CREATE OR REPLACE FUNCTION public.aplicar_acao_banco_horas(
  p_funcionario_id uuid,
  p_competencia text,
  p_horas numeric,
  p_acao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_func record;
  v_valor_hora bigint;
  v_valor_extra bigint;
  v_data date;
BEGIN
  v_empresa_id := get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT * INTO v_func FROM funcionarios
  WHERE id = p_funcionario_id AND empresa_id = v_empresa_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Funcionário não encontrado');
  END IF;

  IF p_acao = 'manter_banco' THEN
    RETURN jsonb_build_object('success', true, 'acao', 'manter_banco', 'horas_acumuladas', p_horas);
  END IF;

  IF p_acao = 'pagar_extra' THEN
    IF v_func.salario_centavos IS NULL OR v_func.carga_horaria_semanal IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Funcionário sem salário ou carga horária');
    END IF;
    
    v_valor_hora := (v_func.salario_centavos / (v_func.carga_horaria_semanal * 4.33))::bigint;
    v_valor_extra := (v_valor_hora * 1.5 * p_horas)::bigint;
    v_data := to_date(p_competencia || '-01', 'YYYY-MM-DD');
    
    INSERT INTO funcionario_movimentacoes (
      empresa_id, funcionario_id, data, competencia_ano_mes,
      tipo, descricao, valor_centavos, status, created_by
    ) VALUES (
      v_empresa_id, p_funcionario_id, v_data, p_competencia,
      'hora_extra', 
      'Horas extras ' || p_competencia || ' (' || p_horas || 'h)',
      v_valor_extra, 'pendente', auth.uid()
    );
    
    RETURN jsonb_build_object('success', true, 'acao', 'pagar_extra', 'horas', p_horas, 'valor_centavos', v_valor_extra);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Ação inválida');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 12. RPC: pagar_movimentacoes
CREATE OR REPLACE FUNCTION public.pagar_movimentacoes(
  p_movimentacao_ids uuid[],
  p_forma_pagamento text DEFAULT 'transferencia',
  p_criar_conta_pagar boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_total bigint := 0;
  v_funcs uuid[];
  v_count int := 0;
BEGIN
  v_empresa_id := get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  UPDATE funcionario_movimentacoes
  SET status = 'pago',
      data_pagamento = CURRENT_DATE,
      forma_pagamento = p_forma_pagamento
  WHERE id = ANY(p_movimentacao_ids)
    AND empresa_id = v_empresa_id
    AND status = 'pendente';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  SELECT 
    COALESCE(SUM(valor_centavos), 0),
    array_agg(DISTINCT funcionario_id)
  INTO v_total, v_funcs
  FROM funcionario_movimentacoes
  WHERE id = ANY(p_movimentacao_ids)
    AND empresa_id = v_empresa_id;

  RETURN jsonb_build_object(
    'success', true,
    'movimentacoes_pagas', v_count,
    'total_centavos', v_total,
    'funcionarios_afetados', array_length(v_funcs, 1)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 13. RPC: listar_funcionarios_rh
CREATE OR REPLACE FUNCTION public.listar_funcionarios_rh()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := get_my_empresa_id();
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
      WHERE f.empresa_id = v_empresa_id AND f.deleted_at IS NULL
    ), '[]'::jsonb)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 14. RPC: importar_ponto_planilha
CREATE OR REPLACE FUNCTION public.importar_ponto_planilha(
  p_arquivo_nome text,
  p_mes_referencia text,
  p_entradas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_importacao_id uuid;
  v_entrada jsonb;
  v_func_id uuid;
  v_processadas int := 0;
  v_erros int := 0;
  v_erros_arr jsonb := '[]'::jsonb;
  v_total int;
BEGIN
  v_empresa_id := get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  v_total := jsonb_array_length(p_entradas);

  INSERT INTO funcionario_importacoes_ponto (
    empresa_id, arquivo_nome, mes_referencia, status, linhas_total, created_by
  ) VALUES (
    v_empresa_id, p_arquivo_nome, p_mes_referencia, 'processando', v_total, auth.uid()
  ) RETURNING id INTO v_importacao_id;

  FOR v_entrada IN SELECT * FROM jsonb_array_elements(p_entradas)
  LOOP
    BEGIN
      v_func_id := (v_entrada->>'funcionario_id')::uuid;
      
      IF NOT EXISTS (
        SELECT 1 FROM funcionarios 
        WHERE id = v_func_id AND empresa_id = v_empresa_id AND deleted_at IS NULL
      ) THEN
        v_erros := v_erros + 1;
        v_erros_arr := v_erros_arr || jsonb_build_object(
          'entrada', v_entrada,
          'erro', 'Funcionário não encontrado ou não pertence à empresa'
        );
        CONTINUE;
      END IF;

      INSERT INTO funcionario_ponto_entradas (
        empresa_id, funcionario_id, data,
        hora_entrada, hora_saida_almoco, hora_volta_almoco, hora_saida,
        importacao_id, created_by
      ) VALUES (
        v_empresa_id, v_func_id, 
        (v_entrada->>'data')::date,
        NULLIF(v_entrada->>'hora_entrada', '')::time,
        NULLIF(v_entrada->>'hora_saida_almoco', '')::time,
        NULLIF(v_entrada->>'hora_volta_almoco', '')::time,
        NULLIF(v_entrada->>'hora_saida', '')::time,
        v_importacao_id, auth.uid()
      )
      ON CONFLICT (funcionario_id, data) DO UPDATE SET
        hora_entrada = COALESCE(EXCLUDED.hora_entrada, funcionario_ponto_entradas.hora_entrada),
        hora_saida_almoco = COALESCE(EXCLUDED.hora_saida_almoco, funcionario_ponto_entradas.hora_saida_almoco),
        hora_volta_almoco = COALESCE(EXCLUDED.hora_volta_almoco, funcionario_ponto_entradas.hora_volta_almoco),
        hora_saida = COALESCE(EXCLUDED.hora_saida, funcionario_ponto_entradas.hora_saida),
        importacao_id = EXCLUDED.importacao_id,
        updated_at = now();

      v_processadas := v_processadas + 1;
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      v_erros_arr := v_erros_arr || jsonb_build_object('entrada', v_entrada, 'erro', SQLERRM);
    END;
  END LOOP;

  UPDATE funcionario_importacoes_ponto
  SET status = 'concluido',
      linhas_processadas = v_processadas,
      linhas_erro = v_erros,
      erros = v_erros_arr,
      concluido_at = now()
  WHERE id = v_importacao_id;

  RETURN jsonb_build_object(
    'success', true,
    'importacao_id', v_importacao_id,
    'linhas_total', v_total,
    'linhas_processadas', v_processadas,
    'linhas_erro', v_erros,
    'erros', v_erros_arr
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- GRANTS
GRANT EXECUTE ON FUNCTION public.registrar_falta(uuid, date, boolean, boolean, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_folha_mensal(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extrato_funcionario(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.holerite_funcionario(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_banco_horas(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_acao_banco_horas(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pagar_movimentacoes(uuid[], text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_funcionarios_rh() TO authenticated;
GRANT EXECUTE ON FUNCTION public.importar_ponto_planilha(text, text, jsonb) TO authenticated;