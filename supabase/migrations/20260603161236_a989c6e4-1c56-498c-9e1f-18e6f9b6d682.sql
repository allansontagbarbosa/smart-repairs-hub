
-- ============================================================
-- 1) Tabela funcionario_jornada
-- ============================================================
CREATE TABLE IF NOT EXISTS public.funcionario_jornada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  dia_semana int NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=dom .. 6=sab
  ent1 time, sai1 time, ent2 time, sai2 time,
  horas_previstas numeric,  -- horas decimais (ex: 8.0, 4.0)
  folga boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, funcionario_id, dia_semana)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcionario_jornada TO authenticated;
GRANT ALL ON public.funcionario_jornada TO service_role;

ALTER TABLE public.funcionario_jornada ENABLE ROW LEVEL SECURITY;

CREATE POLICY jornada_select ON public.funcionario_jornada
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

CREATE POLICY jornada_modify ON public.funcionario_jornada
  FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE OR REPLACE FUNCTION public._touch_jornada() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_jornada ON public.funcionario_jornada;
CREATE TRIGGER trg_touch_jornada
  BEFORE UPDATE ON public.funcionario_jornada
  FOR EACH ROW EXECUTE FUNCTION public._touch_jornada();

CREATE INDEX IF NOT EXISTS idx_jornada_func ON public.funcionario_jornada(empresa_id, funcionario_id);

-- ============================================================
-- 2) is_rh() — usuário é funcionário marcado como RH ou ADM
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_rh()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.funcionarios f ON f.id = up.funcionario_id
    WHERE up.user_id = auth.uid()
      AND up.ativo = true
      AND f.empresa_id = public.get_my_empresa_id()
      AND COALESCE(f.eh_funcionario_rh, false) = true
  );
$$;

CREATE OR REPLACE FUNCTION public.meu_funcionario_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT up.funcionario_id
  FROM public.user_profiles up
  WHERE up.user_id = auth.uid()
    AND up.ativo = true
    AND up.empresa_id = public.get_my_empresa_id()
  LIMIT 1;
$$;

-- ============================================================
-- 3) CRUD da jornada (ADM/RH)
-- ============================================================
CREATE OR REPLACE FUNCTION public.jornada_listar(p_funcionario_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_jor jsonb;
BEGIN
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sem empresa'); END IF;

  -- Permite o próprio funcionário ver a própria jornada também
  IF NOT (public.eh_admin() OR public.is_rh() OR public.meu_funcionario_id() = p_funcionario_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.funcionarios WHERE id = p_funcionario_id AND empresa_id = v_emp) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Funcionário não encontrado');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'dia_semana', dia_semana,
      'ent1', ent1, 'sai1', sai1,
      'ent2', ent2, 'sai2', sai2,
      'horas_previstas', horas_previstas,
      'folga', folga
    ) ORDER BY dia_semana
  ), '[]'::jsonb) INTO v_jor
  FROM public.funcionario_jornada
  WHERE empresa_id = v_emp AND funcionario_id = p_funcionario_id;

  RETURN jsonb_build_object('success', true, 'jornada', v_jor);
END $$;

CREATE OR REPLACE FUNCTION public.jornada_salvar(p_funcionario_id uuid, p_jornada jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_item jsonb;
  v_dia int;
  v_ent1 time; v_sai1 time; v_ent2 time; v_sai2 time;
  v_horas numeric; v_folga boolean;
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Sem empresa'; END IF;
  IF NOT (public.eh_admin() OR public.is_rh()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.funcionarios WHERE id = p_funcionario_id AND empresa_id = v_emp) THEN
    RAISE EXCEPTION 'Funcionário não encontrado';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_jornada, '[]'::jsonb))
  LOOP
    v_dia := (v_item->>'dia_semana')::int;
    v_folga := COALESCE((v_item->>'folga')::boolean, false);
    v_ent1 := NULLIF(v_item->>'ent1','')::time;
    v_sai1 := NULLIF(v_item->>'sai1','')::time;
    v_ent2 := NULLIF(v_item->>'ent2','')::time;
    v_sai2 := NULLIF(v_item->>'sai2','')::time;

    IF v_folga THEN
      v_horas := 0;
      v_ent1 := NULL; v_sai1 := NULL; v_ent2 := NULL; v_sai2 := NULL;
    ELSE
      -- calcula horas previstas a partir dos períodos (se nada, 0)
      v_horas := 0;
      IF v_ent1 IS NOT NULL AND v_sai1 IS NOT NULL THEN
        v_horas := v_horas + EXTRACT(EPOCH FROM (v_sai1 - v_ent1))/3600.0;
      END IF;
      IF v_ent2 IS NOT NULL AND v_sai2 IS NOT NULL THEN
        v_horas := v_horas + EXTRACT(EPOCH FROM (v_sai2 - v_ent2))/3600.0;
      END IF;
      IF (v_item ? 'horas_previstas') AND v_item->>'horas_previstas' IS NOT NULL AND v_item->>'horas_previstas' <> '' THEN
        v_horas := (v_item->>'horas_previstas')::numeric;
      END IF;
    END IF;

    INSERT INTO public.funcionario_jornada
      (empresa_id, funcionario_id, dia_semana, ent1, sai1, ent2, sai2, horas_previstas, folga)
    VALUES (v_emp, p_funcionario_id, v_dia, v_ent1, v_sai1, v_ent2, v_sai2, v_horas, v_folga)
    ON CONFLICT (empresa_id, funcionario_id, dia_semana) DO UPDATE
    SET ent1 = EXCLUDED.ent1, sai1 = EXCLUDED.sai1,
        ent2 = EXCLUDED.ent2, sai2 = EXCLUDED.sai2,
        horas_previstas = EXCLUDED.horas_previstas,
        folga = EXCLUDED.folga,
        updated_at = now();
  END LOOP;

  RETURN jsonb_build_object('success', true);
END $$;

-- ============================================================
-- 4) Recalcula calcular_banco_horas usando jornada (com fallback)
--    Retorna também breakdown 'dias' para espelho de ponto.
-- ============================================================
CREATE OR REPLACE FUNCTION public.calcular_banco_horas(p_funcionario_id uuid, p_competencia text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_empresa_id uuid;
  v_func record;
  v_data_ini date;
  v_data_fim date;
  v_horas_trab numeric := 0;
  v_horas_esp  numeric := 0;
  v_saldo numeric := 0;
  v_tem_jornada boolean;
  v_dias jsonb := '[]'::jsonb;
  v_d date;
  v_dow int;
  v_jor record;
  v_prev_dia numeric;
  v_trab_dia numeric;
  v_pt record;
BEGIN
  v_empresa_id := public.get_my_empresa_id();
  IF v_empresa_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sem empresa'); END IF;

  SELECT * INTO v_func FROM public.funcionarios
   WHERE id = p_funcionario_id AND empresa_id = v_empresa_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Funcionário não encontrado'); END IF;

  v_data_ini := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_data_fim := (v_data_ini + interval '1 month - 1 day')::date;

  SELECT EXISTS (
    SELECT 1 FROM public.funcionario_jornada
    WHERE empresa_id = v_empresa_id AND funcionario_id = p_funcionario_id
  ) INTO v_tem_jornada;

  IF v_tem_jornada THEN
    -- loop por dia
    FOR v_d IN SELECT (v_data_ini + g)::date FROM generate_series(0, (v_data_fim - v_data_ini)) g
    LOOP
      v_dow := EXTRACT(DOW FROM v_d)::int;
      v_prev_dia := 0;
      v_trab_dia := 0;

      SELECT * INTO v_jor FROM public.funcionario_jornada
       WHERE empresa_id = v_empresa_id AND funcionario_id = p_funcionario_id AND dia_semana = v_dow;
      IF FOUND AND NOT v_jor.folga THEN
        v_prev_dia := COALESCE(v_jor.horas_previstas, 0);
      END IF;

      SELECT COALESCE(SUM(horas_trabalhadas), 0) INTO v_trab_dia
        FROM public.funcionario_ponto_entradas
       WHERE empresa_id = v_empresa_id AND funcionario_id = p_funcionario_id AND data = v_d;

      v_horas_esp  := v_horas_esp  + v_prev_dia;
      v_horas_trab := v_horas_trab + v_trab_dia;

      -- só registra dias relevantes (com previsto ou com batida)
      IF v_prev_dia > 0 OR v_trab_dia > 0 THEN
        v_dias := v_dias || jsonb_build_object(
          'data', v_d,
          'dia_semana', v_dow,
          'previsto', v_prev_dia,
          'trabalhado', v_trab_dia,
          'saldo', v_trab_dia - v_prev_dia,
          'folga', COALESCE(v_jor.folga, false)
        );
      END IF;
    END LOOP;
  ELSE
    -- fallback: comportamento antigo, baseado em carga_horaria_semanal
    SELECT COALESCE(SUM(horas_trabalhadas), 0) INTO v_horas_trab
      FROM public.funcionario_ponto_entradas
     WHERE funcionario_id = p_funcionario_id
       AND empresa_id = v_empresa_id
       AND data BETWEEN v_data_ini AND v_data_fim;

    IF v_func.carga_horaria_semanal IS NOT NULL THEN
      v_horas_esp := (v_func.carga_horaria_semanal / 5.0) *
        (SELECT COUNT(*) FROM generate_series(v_data_ini, v_data_fim, '1 day') d
          WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5);
    END IF;

    -- breakdown simples por dia com batida
    FOR v_pt IN
      SELECT data, COALESCE(SUM(horas_trabalhadas),0) AS trab
        FROM public.funcionario_ponto_entradas
       WHERE empresa_id = v_empresa_id AND funcionario_id = p_funcionario_id
         AND data BETWEEN v_data_ini AND v_data_fim
       GROUP BY data ORDER BY data
    LOOP
      v_dias := v_dias || jsonb_build_object(
        'data', v_pt.data,
        'dia_semana', EXTRACT(DOW FROM v_pt.data)::int,
        'previsto', NULL,
        'trabalhado', v_pt.trab,
        'saldo', NULL,
        'folga', false
      );
    END LOOP;
  END IF;

  v_saldo := v_horas_trab - v_horas_esp;

  RETURN jsonb_build_object(
    'success', true,
    'competencia', p_competencia,
    'tem_jornada', v_tem_jornada,
    'horas_esperadas', v_horas_esp,
    'horas_trabalhadas', v_horas_trab,
    'saldo_horas', v_saldo,
    'tem_excedente', v_saldo > 0,
    'tem_devedoras', v_saldo < 0,
    'dias', v_dias
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END $$;

-- ============================================================
-- 5) Funções "meu_" para o funcionário logado
-- ============================================================
CREATE OR REPLACE FUNCTION public.meu_banco_horas(p_competencia text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_func uuid;
BEGIN
  v_func := public.meu_funcionario_id();
  IF v_func IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Não é funcionário'); END IF;
  RETURN public.calcular_banco_horas(v_func, p_competencia);
END $$;

CREATE OR REPLACE FUNCTION public.meu_espelho_ponto(p_competencia text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_func uuid;
  v_emp uuid := public.get_my_empresa_id();
  v_ini date;
  v_fim date;
  v_batidas jsonb;
BEGIN
  v_func := public.meu_funcionario_id();
  IF v_func IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Não é funcionário'); END IF;

  v_ini := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim := (v_ini + interval '1 month - 1 day')::date;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'data', data,
    'hora_entrada', hora_entrada,
    'hora_saida_almoco', hora_saida_almoco,
    'hora_volta_almoco', hora_volta_almoco,
    'hora_saida', hora_saida,
    'horas_trabalhadas', horas_trabalhadas,
    'falta', falta
  ) ORDER BY data), '[]'::jsonb) INTO v_batidas
  FROM public.funcionario_ponto_entradas
  WHERE empresa_id = v_emp AND funcionario_id = v_func
    AND data BETWEEN v_ini AND v_fim;

  RETURN jsonb_build_object(
    'success', true,
    'batidas', v_batidas,
    'banco', public.calcular_banco_horas(v_func, p_competencia)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.is_rh() TO authenticated;
GRANT EXECUTE ON FUNCTION public.meu_funcionario_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.jornada_listar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.jornada_salvar(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.meu_banco_horas(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.meu_espelho_ponto(text) TO authenticated;
