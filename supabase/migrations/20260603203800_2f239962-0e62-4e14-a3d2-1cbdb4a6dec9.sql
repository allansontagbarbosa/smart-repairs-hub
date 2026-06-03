
-- ============================================================================
-- RH-HOLERITE-01: Holerite gerencial com eventos detalhados + estrutura fiscal
-- ============================================================================

-- 1) Tabela folha_eventos: detalhamento auditável do holerite (cada linha = 1 evento)
CREATE TABLE IF NOT EXISTS public.folha_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('provento','desconto')),
  codigo text NOT NULL,
  descricao text NOT NULL,
  referencia text,
  valor_centavos bigint NOT NULL DEFAULT 0,
  ordem int NOT NULL DEFAULT 100,
  origem text,
  origem_id uuid,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, funcionario_id, competencia, codigo, origem_id)
);

CREATE INDEX IF NOT EXISTS idx_folha_eventos_func_comp ON public.folha_eventos(funcionario_id, competencia);
CREATE INDEX IF NOT EXISTS idx_folha_eventos_empresa_comp ON public.folha_eventos(empresa_id, competencia);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.folha_eventos TO authenticated;
GRANT ALL ON public.folha_eventos TO service_role;

ALTER TABLE public.folha_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY folha_eventos_select ON public.folha_eventos FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_my_empresa_id()
    AND (
      public.is_admin_user(auth.uid())
      OR public.has_permissao('rh','ver')
      OR funcionario_id IN (
        SELECT up.funcionario_id FROM public.user_profiles up
        WHERE up.user_id = auth.uid() AND up.ativo = true AND up.funcionario_id IS NOT NULL
      )
    )
  );

CREATE POLICY folha_eventos_modify ON public.folha_eventos FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','editar')))
  WITH CHECK (empresa_id = public.get_my_empresa_id() AND (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','editar')));

-- 2) Estrutura fiscal (placeholder, para evolução futura — INSS/IRRF/FGTS)
CREATE TABLE IF NOT EXISTS public.tabelas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,                          -- 'inss', 'irrf', 'fgts'
  vigencia_inicio date NOT NULL,
  vigencia_fim date,
  faixa_min numeric(12,2) NOT NULL DEFAULT 0,
  faixa_max numeric(12,2),
  aliquota numeric(6,4) NOT NULL DEFAULT 0,
  deducao numeric(12,2) NOT NULL DEFAULT 0,
  ordem int NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tabelas_fiscais TO authenticated;
GRANT ALL ON public.tabelas_fiscais TO service_role;
ALTER TABLE public.tabelas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY tabelas_fiscais_read ON public.tabelas_fiscais FOR SELECT TO authenticated USING (true);

-- 3) RPC holerite_montar: gera/atualiza eventos da competência a partir das fontes reais
CREATE OR REPLACE FUNCTION public.holerite_montar(p_funcionario_id uuid, p_competencia text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_func record;
  v_data_ini date;
  v_data_fim date;
  v_comp_ym text := p_competencia;
  v_total_comissao bigint := 0;
  v_qtd_comissoes int := 0;
  v_faltas int := 0;
  v_eventos_criados int := 0;
BEGIN
  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;
  IF NOT (public.is_admin_user(auth.uid()) OR public.has_permissao('rh','editar')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  SELECT * INTO v_func FROM funcionarios WHERE id = p_funcionario_id AND empresa_id = v_emp;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Funcionário não encontrado');
  END IF;

  v_data_ini := to_date(v_comp_ym || '-01', 'YYYY-MM-DD');
  v_data_fim := (v_data_ini + interval '1 month - 1 day')::date;

  -- Limpa eventos auto-gerados (mantém eventos manuais com origem='manual')
  DELETE FROM folha_eventos
   WHERE empresa_id = v_emp AND funcionario_id = p_funcionario_id
     AND competencia = v_data_ini
     AND (origem IS NULL OR origem <> 'manual');

  -- PROVENTO: Salário base
  IF COALESCE(v_func.salario_centavos, 0) > 0 THEN
    INSERT INTO folha_eventos(empresa_id, funcionario_id, competencia, tipo, codigo, descricao, valor_centavos, ordem, origem)
    VALUES (v_emp, p_funcionario_id, v_data_ini, 'provento', 'salario_base', 'Salário base', v_func.salario_centavos, 10, 'cadastro');
    v_eventos_criados := v_eventos_criados + 1;
  END IF;

  -- PROVENTO: Comissões (somar todas as comissões não estornadas da competência)
  SELECT COALESCE(SUM((c.valor*100)::bigint), 0), COUNT(*)
    INTO v_total_comissao, v_qtd_comissoes
  FROM comissoes c
  WHERE c.funcionario_id = p_funcionario_id
    AND c.empresa_id = v_emp
    AND c.mes_competencia = v_comp_ym
    AND c.estornada_em IS NULL;

  IF v_total_comissao > 0 THEN
    INSERT INTO folha_eventos(empresa_id, funcionario_id, competencia, tipo, codigo, descricao, referencia, valor_centavos, ordem, origem)
    VALUES (v_emp, p_funcionario_id, v_data_ini, 'provento', 'comissao', 'Comissões',
            v_qtd_comissoes || ' OS', v_total_comissao, 20, 'comissao');
    v_eventos_criados := v_eventos_criados + 1;
  END IF;

  -- PROVENTO: VT
  IF COALESCE(v_func.vt_centavos, 0) > 0 THEN
    INSERT INTO folha_eventos(empresa_id, funcionario_id, competencia, tipo, codigo, descricao, valor_centavos, ordem, origem)
    VALUES (v_emp, p_funcionario_id, v_data_ini, 'provento', 'vt', 'Vale Transporte', v_func.vt_centavos, 30, 'cadastro');
    v_eventos_criados := v_eventos_criados + 1;
  END IF;

  -- PROVENTO: VA
  IF COALESCE(v_func.va_centavos, 0) > 0 THEN
    INSERT INTO folha_eventos(empresa_id, funcionario_id, competencia, tipo, codigo, descricao, valor_centavos, ordem, origem)
    VALUES (v_emp, p_funcionario_id, v_data_ini, 'provento', 'va', 'Vale Alimentação', v_func.va_centavos, 40, 'cadastro');
    v_eventos_criados := v_eventos_criados + 1;
  END IF;

  -- PROVENTOS adicionais já lançados em funcionario_movimentacoes (bônus, hora_extra, reembolso, etc.)
  INSERT INTO folha_eventos(empresa_id, funcionario_id, competencia, tipo, codigo, descricao, valor_centavos, ordem, origem, origem_id)
  SELECT v_emp, p_funcionario_id, v_data_ini, 'provento',
         m.tipo::text,
         COALESCE(m.descricao, m.tipo::text),
         m.valor_centavos, 50, 'movimentacao', m.id
  FROM funcionario_movimentacoes m
  WHERE m.funcionario_id = p_funcionario_id
    AND m.empresa_id = v_emp
    AND m.competencia_ano_mes = v_comp_ym
    AND m.estornada_em IS NULL
    AND m.valor_centavos > 0
    AND m.tipo NOT IN ('salario','comissao','vale_transporte','vale_alimentacao')
  ON CONFLICT (empresa_id, funcionario_id, competencia, codigo, origem_id) DO NOTHING;

  -- DESCONTO: Faltas (registradas em ponto, ainda não descontadas em movimentacoes)
  SELECT COUNT(*) INTO v_faltas
  FROM funcionario_ponto_entradas
  WHERE funcionario_id = p_funcionario_id
    AND empresa_id = v_emp
    AND data BETWEEN v_data_ini AND v_data_fim
    AND falta = true
    AND COALESCE(falta_justificada, false) = false
    AND COALESCE(abonada, false) = false;

  IF v_faltas > 0 AND COALESCE(v_func.salario_centavos, 0) > 0 THEN
    INSERT INTO folha_eventos(empresa_id, funcionario_id, competencia, tipo, codigo, descricao, referencia, valor_centavos, ordem, origem)
    VALUES (v_emp, p_funcionario_id, v_data_ini, 'desconto', 'falta', 'Faltas (não justificadas)',
            v_faltas || (CASE WHEN v_faltas=1 THEN ' dia' ELSE ' dias' END),
            ((v_func.salario_centavos / 30.0) * v_faltas)::bigint, 100, 'ponto');
    v_eventos_criados := v_eventos_criados + 1;
  END IF;

  -- DESCONTOS já lançados em funcionario_movimentacoes (adiantamento, desconto_diverso, falta_descontada)
  INSERT INTO folha_eventos(empresa_id, funcionario_id, competencia, tipo, codigo, descricao, valor_centavos, ordem, origem, origem_id)
  SELECT v_emp, p_funcionario_id, v_data_ini, 'desconto',
         m.tipo::text,
         COALESCE(m.descricao, m.tipo::text),
         ABS(m.valor_centavos), 110, 'movimentacao', m.id
  FROM funcionario_movimentacoes m
  WHERE m.funcionario_id = p_funcionario_id
    AND m.empresa_id = v_emp
    AND m.competencia_ano_mes = v_comp_ym
    AND m.estornada_em IS NULL
    AND m.valor_centavos < 0
  ON CONFLICT (empresa_id, funcionario_id, competencia, codigo, origem_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'eventos_criados', v_eventos_criados,
    'competencia', v_comp_ym
  );
END;
$$;

-- 4) RPC holerite_detalhado: leitura agregada para a UI (proventos, descontos, totais, líquido)
CREATE OR REPLACE FUNCTION public.holerite_detalhado(p_funcionario_id uuid, p_competencia text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_func record;
  v_data_ini date;
  v_data_fim date;
  v_proventos bigint := 0;
  v_descontos bigint := 0;
  v_horas numeric := 0;
  v_dias int := 0;
  v_faltas int := 0;
  v_eventos jsonb;
  v_pode_ver_todos boolean;
BEGIN
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sem empresa'); END IF;

  v_pode_ver_todos := public.is_admin_user(auth.uid()) OR public.has_permissao('rh','ver');

  -- Funcionário só pode ver o próprio
  IF NOT v_pode_ver_todos THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND ativo = true AND funcionario_id = p_funcionario_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
    END IF;
  END IF;

  SELECT * INTO v_func FROM funcionarios WHERE id = p_funcionario_id AND empresa_id = v_emp;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Funcionário não encontrado'); END IF;

  v_data_ini := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_data_fim := (v_data_ini + interval '1 month - 1 day')::date;

  SELECT
    COALESCE(SUM(CASE WHEN tipo='provento' THEN valor_centavos ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo='desconto' THEN valor_centavos ELSE 0 END), 0)
  INTO v_proventos, v_descontos
  FROM folha_eventos
  WHERE empresa_id = v_emp AND funcionario_id = p_funcionario_id AND competencia = v_data_ini;

  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'tipo', tipo, 'codigo', codigo, 'descricao', descricao,
    'referencia', referencia, 'valor_centavos', valor_centavos, 'ordem', ordem,
    'origem', origem
  ) ORDER BY tipo DESC, ordem, descricao)
  INTO v_eventos
  FROM folha_eventos
  WHERE empresa_id = v_emp AND funcionario_id = p_funcionario_id AND competencia = v_data_ini;

  SELECT
    COALESCE(SUM(horas_trabalhadas), 0),
    COUNT(*) FILTER (WHERE NOT falta),
    COUNT(*) FILTER (WHERE falta)
  INTO v_horas, v_dias, v_faltas
  FROM funcionario_ponto_entradas
  WHERE funcionario_id = p_funcionario_id AND empresa_id = v_emp
    AND data BETWEEN v_data_ini AND v_data_fim;

  RETURN jsonb_build_object(
    'success', true,
    'funcionario', jsonb_build_object(
      'id', v_func.id, 'nome', v_func.nome, 'cargo', v_func.cargo,
      'tipo_vinculo', v_func.tipo_vinculo,
      'cpf', v_func.cpf, 'data_admissao', v_func.data_admissao
    ),
    'competencia', p_competencia,
    'eventos', COALESCE(v_eventos, '[]'::jsonb),
    'total_proventos_centavos', v_proventos,
    'total_descontos_centavos', v_descontos,
    'liquido_centavos', v_proventos - v_descontos,
    'horas_trabalhadas', v_horas,
    'dias_trabalhados', v_dias,
    'faltas', v_faltas
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END; $$;

GRANT EXECUTE ON FUNCTION public.holerite_montar(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.holerite_detalhado(uuid, text) TO authenticated;
