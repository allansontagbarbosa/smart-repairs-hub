
-- =========================
-- 1) TABELAS
-- =========================
CREATE TABLE IF NOT EXISTS public.cashback_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid UNIQUE NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  notificar_cliente_ao_creditar boolean NOT NULL DEFAULT false,
  permitir_uso_100pct_os boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cashback_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN (
    'pct_global','pct_grupo','pct_cliente','valor_fixo_cliente','pct_tipo_servico'
  )),
  target_cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  target_grupo_id uuid REFERENCES public.lojista_grupos(id) ON DELETE CASCADE,
  target_tipo_servico_id uuid REFERENCES public.tipos_servico(id) ON DELETE CASCADE,
  percentual numeric CHECK (percentual IS NULL OR (percentual >= 0 AND percentual <= 100)),
  valor_fixo_centavos bigint CHECK (valor_fixo_centavos IS NULL OR valor_fixo_centavos >= 0),
  prioridade int NOT NULL DEFAULT 4,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_target_pct_global CHECK (
    tipo <> 'pct_global' OR (target_cliente_id IS NULL AND target_grupo_id IS NULL AND target_tipo_servico_id IS NULL)
  ),
  CONSTRAINT chk_target_pct_grupo CHECK (
    tipo <> 'pct_grupo' OR (target_grupo_id IS NOT NULL AND target_cliente_id IS NULL AND target_tipo_servico_id IS NULL)
  ),
  CONSTRAINT chk_target_pct_cliente CHECK (
    tipo NOT IN ('pct_cliente','valor_fixo_cliente') OR (target_cliente_id IS NOT NULL AND target_grupo_id IS NULL AND target_tipo_servico_id IS NULL)
  ),
  CONSTRAINT chk_target_pct_tipo_servico CHECK (
    tipo <> 'pct_tipo_servico' OR (target_tipo_servico_id IS NOT NULL AND target_cliente_id IS NULL AND target_grupo_id IS NULL)
  ),
  CONSTRAINT chk_valor_presente CHECK (
    (tipo IN ('pct_global','pct_grupo','pct_cliente','pct_tipo_servico') AND percentual IS NOT NULL AND valor_fixo_centavos IS NULL)
    OR (tipo = 'valor_fixo_cliente' AND valor_fixo_centavos IS NOT NULL AND percentual IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_cashback_regras_empresa_ativo ON public.cashback_regras(empresa_id, ativo) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_cashback_regras_cliente ON public.cashback_regras(target_cliente_id) WHERE target_cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cashback_regras_grupo ON public.cashback_regras(target_grupo_id) WHERE target_grupo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cashback_regras_tiposervico ON public.cashback_regras(target_tipo_servico_id) WHERE target_tipo_servico_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cashback_saldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid UNIQUE NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  saldo_centavos bigint NOT NULL DEFAULT 0 CHECK (saldo_centavos >= 0),
  total_recebido_centavos bigint NOT NULL DEFAULT 0,
  total_usado_centavos bigint NOT NULL DEFAULT 0,
  ultima_movimentacao_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cashback_saldos_empresa ON public.cashback_saldos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cashback_saldos_com_saldo ON public.cashback_saldos(empresa_id, saldo_centavos DESC) WHERE saldo_centavos > 0;

CREATE TABLE IF NOT EXISTS public.cashback_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN (
    'credito_os','debito_uso_os','credito_ajuste','debito_ajuste','debito_estorno_os'
  )),
  valor_centavos bigint NOT NULL CHECK (valor_centavos > 0),
  saldo_apos_centavos bigint NOT NULL CHECK (saldo_apos_centavos >= 0),
  ordem_id uuid REFERENCES public.ordens_de_servico(id) ON DELETE SET NULL,
  regra_id uuid REFERENCES public.cashback_regras(id) ON DELETE SET NULL,
  percentual_aplicado numeric,
  descricao text NOT NULL,
  justificativa text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cashback_mov_cliente_data ON public.cashback_movimentacoes(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cashback_mov_empresa_data ON public.cashback_movimentacoes(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cashback_mov_ordem ON public.cashback_movimentacoes(ordem_id) WHERE ordem_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cashback_mov_credito_os
  ON public.cashback_movimentacoes(ordem_id)
  WHERE tipo = 'credito_os';

-- =========================
-- 2) RLS
-- =========================
ALTER TABLE public.cashback_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashback_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashback_saldos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashback_movimentacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cashback_config_admin" ON public.cashback_config;
CREATE POLICY "cashback_config_admin" ON public.cashback_config FOR ALL TO authenticated
USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()))
WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "cashback_regras_admin" ON public.cashback_regras;
CREATE POLICY "cashback_regras_admin" ON public.cashback_regras FOR ALL TO authenticated
USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()))
WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "cashback_saldos_select" ON public.cashback_saldos;
CREATE POLICY "cashback_saldos_select" ON public.cashback_saldos FOR SELECT TO authenticated
USING (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
  OR empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "cashback_saldos_admin_write" ON public.cashback_saldos;
CREATE POLICY "cashback_saldos_admin_write" ON public.cashback_saldos FOR ALL TO authenticated
USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()))
WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "cashback_mov_select" ON public.cashback_movimentacoes;
CREATE POLICY "cashback_mov_select" ON public.cashback_movimentacoes FOR SELECT TO authenticated
USING (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
  OR empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "cashback_mov_admin_write" ON public.cashback_movimentacoes;
CREATE POLICY "cashback_mov_admin_write" ON public.cashback_movimentacoes FOR ALL TO authenticated
USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()))
WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));

-- =========================
-- 3) TRIGGER prioridade
-- =========================
CREATE OR REPLACE FUNCTION public.cashback_regras_set_prioridade()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.prioridade := CASE NEW.tipo
    WHEN 'pct_tipo_servico' THEN 1
    WHEN 'pct_cliente' THEN 2
    WHEN 'valor_fixo_cliente' THEN 2
    WHEN 'pct_grupo' THEN 3
    WHEN 'pct_global' THEN 4
  END;
  NEW.updated_at := now();
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_cashback_regras_prioridade ON public.cashback_regras;
CREATE TRIGGER trg_cashback_regras_prioridade
  BEFORE INSERT OR UPDATE ON public.cashback_regras
  FOR EACH ROW EXECUTE FUNCTION public.cashback_regras_set_prioridade();

-- =========================
-- 4) RPCs
-- =========================
CREATE OR REPLACE FUNCTION public.calcular_cashback_os(p_ordem_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_os record;
  v_cliente_id uuid;
  v_cliente record;
  v_regra record;
  v_valor_centavos bigint := 0;
  v_pct numeric := 0;
  v_base numeric;
BEGIN
  SELECT os.*, ap.cliente_id AS aparelho_cliente_id
    INTO v_os
    FROM ordens_de_servico os
    LEFT JOIN aparelhos ap ON ap.id = os.aparelho_id
   WHERE os.id = p_ordem_id;
  IF v_os.id IS NULL THEN
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'os_nao_encontrada');
  END IF;
  v_cliente_id := v_os.aparelho_cliente_id;
  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'sem_cliente');
  END IF;
  SELECT * INTO v_cliente FROM clientes WHERE id = v_cliente_id;
  IF v_cliente.id IS NULL THEN
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'cliente_nao_encontrado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cashback_config WHERE empresa_id = v_os.empresa_id AND ativo) THEN
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'cashback_desativado');
  END IF;

  -- P1: tipo_servico
  SELECT * INTO v_regra FROM cashback_regras
   WHERE empresa_id = v_os.empresa_id AND ativo
     AND tipo='pct_tipo_servico' AND target_tipo_servico_id = v_os.tipo_servico_id
   LIMIT 1;

  IF v_regra.id IS NULL THEN
    SELECT * INTO v_regra FROM cashback_regras
     WHERE empresa_id = v_os.empresa_id AND ativo
       AND tipo IN ('pct_cliente','valor_fixo_cliente')
       AND target_cliente_id = v_cliente.id
     ORDER BY tipo LIMIT 1;
  END IF;

  IF v_regra.id IS NULL AND v_cliente.grupo_id IS NOT NULL THEN
    SELECT * INTO v_regra FROM cashback_regras
     WHERE empresa_id = v_os.empresa_id AND ativo
       AND tipo='pct_grupo' AND target_grupo_id = v_cliente.grupo_id
     LIMIT 1;
  END IF;

  IF v_regra.id IS NULL THEN
    SELECT * INTO v_regra FROM cashback_regras
     WHERE empresa_id = v_os.empresa_id AND ativo AND tipo='pct_global' LIMIT 1;
  END IF;

  IF v_regra.id IS NULL THEN
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'nenhuma_regra_aplicavel');
  END IF;

  IF v_regra.tipo = 'valor_fixo_cliente' THEN
    v_valor_centavos := v_regra.valor_fixo_centavos;
    v_pct := 0;
  ELSE
    v_pct := v_regra.percentual;
    v_base := COALESCE(v_os.valor_total, v_os.valor, 0);
    v_valor_centavos := FLOOR((v_base * v_regra.percentual))::bigint; -- base em reais * pct = reais; *100 dá centavos
    v_valor_centavos := FLOOR((v_base * 100 * v_regra.percentual / 100))::bigint;
  END IF;

  RETURN jsonb_build_object(
    'valor_centavos', v_valor_centavos,
    'regra_id', v_regra.id,
    'regra_tipo', v_regra.tipo,
    'percentual_aplicado', v_pct,
    'cliente_id', v_cliente.id,
    'empresa_id', v_os.empresa_id
  );
END;$$;
GRANT EXECUTE ON FUNCTION public.calcular_cashback_os(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.creditar_cashback_os(p_ordem_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_calc jsonb;
  v_valor bigint;
  v_cliente_id uuid;
  v_empresa_id uuid;
  v_regra_id uuid;
  v_pct numeric;
  v_saldo_atual bigint;
  v_saldo_novo bigint;
  v_mov_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM cashback_movimentacoes WHERE ordem_id = p_ordem_id AND tipo='credito_os') THEN
    RETURN jsonb_build_object('sucesso', false, 'motivo','ja_creditado');
  END IF;
  v_calc := calcular_cashback_os(p_ordem_id);
  v_valor := (v_calc->>'valor_centavos')::bigint;
  IF v_valor <= 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'motivo', v_calc->>'motivo');
  END IF;
  v_cliente_id := (v_calc->>'cliente_id')::uuid;
  v_empresa_id := (v_calc->>'empresa_id')::uuid;
  v_regra_id   := (v_calc->>'regra_id')::uuid;
  v_pct        := (v_calc->>'percentual_aplicado')::numeric;

  INSERT INTO cashback_saldos(cliente_id, empresa_id, saldo_centavos)
  VALUES (v_cliente_id, v_empresa_id, 0)
  ON CONFLICT (cliente_id) DO NOTHING;

  SELECT saldo_centavos INTO v_saldo_atual FROM cashback_saldos WHERE cliente_id = v_cliente_id;
  v_saldo_novo := v_saldo_atual + v_valor;

  INSERT INTO cashback_movimentacoes(
    cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos,
    ordem_id, regra_id, percentual_aplicado, descricao
  ) VALUES (
    v_cliente_id, v_empresa_id, 'credito_os', v_valor, v_saldo_novo,
    p_ordem_id, v_regra_id, v_pct,
    format('Cashback %s sobre OS', CASE WHEN v_pct > 0 THEN v_pct::text || '%' ELSE 'fixo' END)
  ) RETURNING id INTO v_mov_id;

  UPDATE cashback_saldos
     SET saldo_centavos = v_saldo_novo,
         total_recebido_centavos = total_recebido_centavos + v_valor,
         ultima_movimentacao_em = now(),
         updated_at = now()
   WHERE cliente_id = v_cliente_id;

  RETURN jsonb_build_object('sucesso', true, 'movimentacao_id', v_mov_id, 'valor_centavos', v_valor, 'saldo_novo_centavos', v_saldo_novo);
END;$$;
GRANT EXECUTE ON FUNCTION public.creditar_cashback_os(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.aplicar_cashback_em_os(p_ordem_id uuid, p_valor_usar_centavos bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_os record;
  v_cliente_id uuid;
  v_saldo record;
  v_valor_os_centavos bigint;
  v_saldo_novo bigint;
  v_mov_id uuid;
BEGIN
  IF p_valor_usar_centavos <= 0 THEN RAISE EXCEPTION 'Valor a usar deve ser positivo'; END IF;
  SELECT os.*, ap.cliente_id AS aparelho_cliente_id INTO v_os
    FROM ordens_de_servico os LEFT JOIN aparelhos ap ON ap.id = os.aparelho_id
   WHERE os.id = p_ordem_id;
  IF v_os.id IS NULL THEN RAISE EXCEPTION 'OS não encontrada'; END IF;
  IF v_os.status::text IN ('entregue','cancelada') THEN RAISE EXCEPTION 'OS já entregue ou cancelada'; END IF;
  v_cliente_id := v_os.aparelho_cliente_id;
  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'OS sem cliente'; END IF;

  SELECT * INTO v_saldo FROM cashback_saldos WHERE cliente_id = v_cliente_id;
  IF v_saldo.cliente_id IS NULL OR v_saldo.saldo_centavos = 0 THEN RAISE EXCEPTION 'Cliente sem saldo de cashback'; END IF;
  IF p_valor_usar_centavos > v_saldo.saldo_centavos THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  v_valor_os_centavos := FLOOR(COALESCE(v_os.valor_total, v_os.valor, 0) * 100)::bigint;
  IF p_valor_usar_centavos > v_valor_os_centavos THEN RAISE EXCEPTION 'Valor maior que valor da OS'; END IF;

  v_saldo_novo := v_saldo.saldo_centavos - p_valor_usar_centavos;

  INSERT INTO cashback_movimentacoes(
    cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos,
    ordem_id, descricao, created_by_user_id
  ) VALUES (
    v_cliente_id, v_os.empresa_id, 'debito_uso_os', p_valor_usar_centavos, v_saldo_novo,
    p_ordem_id, format('Abate em OS #%s', v_os.numero), v_user_id
  ) RETURNING id INTO v_mov_id;

  UPDATE cashback_saldos
     SET saldo_centavos = v_saldo_novo,
         total_usado_centavos = total_usado_centavos + p_valor_usar_centavos,
         ultima_movimentacao_em = now(), updated_at = now()
   WHERE cliente_id = v_cliente_id;

  UPDATE ordens_de_servico
     SET valor_total = COALESCE(valor_total,0) - (p_valor_usar_centavos::numeric/100),
         observacoes = COALESCE(observacoes,'') || E'\n[Cashback aplicado: -R$ ' || (p_valor_usar_centavos::numeric/100)::text || ']'
   WHERE id = p_ordem_id;

  RETURN jsonb_build_object('sucesso', true, 'movimentacao_id', v_mov_id, 'valor_aplicado_centavos', p_valor_usar_centavos, 'saldo_novo_centavos', v_saldo_novo);
END;$$;
GRANT EXECUTE ON FUNCTION public.aplicar_cashback_em_os(uuid, bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.ajustar_cashback_cliente(p_cliente_id uuid, p_valor_centavos bigint, p_justificativa text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cliente record;
  v_saldo record;
  v_saldo_novo bigint;
  v_tipo text;
  v_mov_id uuid;
BEGIN
  IF p_valor_centavos = 0 THEN RAISE EXCEPTION 'Valor não pode ser zero'; END IF;
  IF COALESCE(trim(p_justificativa),'') = '' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id;
  IF v_cliente.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;

  INSERT INTO cashback_saldos(cliente_id, empresa_id, saldo_centavos)
  VALUES (p_cliente_id, v_cliente.empresa_id, 0)
  ON CONFLICT (cliente_id) DO NOTHING;

  SELECT * INTO v_saldo FROM cashback_saldos WHERE cliente_id = p_cliente_id;
  v_saldo_novo := v_saldo.saldo_centavos + p_valor_centavos;
  IF v_saldo_novo < 0 THEN RAISE EXCEPTION 'Saldo ficaria negativo'; END IF;

  v_tipo := CASE WHEN p_valor_centavos > 0 THEN 'credito_ajuste' ELSE 'debito_ajuste' END;

  INSERT INTO cashback_movimentacoes(
    cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos,
    descricao, justificativa, created_by_user_id
  ) VALUES (
    p_cliente_id, v_cliente.empresa_id, v_tipo, ABS(p_valor_centavos), v_saldo_novo,
    'Ajuste manual', p_justificativa, v_user_id
  ) RETURNING id INTO v_mov_id;

  UPDATE cashback_saldos
     SET saldo_centavos = v_saldo_novo,
         total_recebido_centavos = total_recebido_centavos + CASE WHEN p_valor_centavos > 0 THEN p_valor_centavos ELSE 0 END,
         total_usado_centavos    = total_usado_centavos    + CASE WHEN p_valor_centavos < 0 THEN ABS(p_valor_centavos) ELSE 0 END,
         ultima_movimentacao_em = now(), updated_at = now()
   WHERE cliente_id = p_cliente_id;

  RETURN jsonb_build_object('sucesso', true, 'saldo_novo_centavos', v_saldo_novo, 'movimentacao_id', v_mov_id);
END;$$;
GRANT EXECUTE ON FUNCTION public.ajustar_cashback_cliente(uuid, bigint, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_cashback_empresa_dashboard()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa_id uuid;
  v_saldo_total bigint; v_clientes_com_saldo int;
  v_cred_mes bigint; v_qtd_cred int;
  v_usado_mes bigint; v_qtd_usado int;
  v_top jsonb; v_movs jsonb;
  v_mes_inicio date := date_trunc('month', CURRENT_DATE)::date;
  v_config record;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM user_profiles WHERE user_id = v_user_id LIMIT 1;
  IF v_empresa_id IS NULL THEN RETURN jsonb_build_object('erro','usuario_sem_empresa'); END IF;

  SELECT * INTO v_config FROM cashback_config WHERE empresa_id = v_empresa_id;

  SELECT COALESCE(SUM(saldo_centavos),0), COUNT(*) FILTER (WHERE saldo_centavos > 0)
    INTO v_saldo_total, v_clientes_com_saldo FROM cashback_saldos WHERE empresa_id = v_empresa_id;

  SELECT COALESCE(SUM(valor_centavos),0), COUNT(*) INTO v_cred_mes, v_qtd_cred
    FROM cashback_movimentacoes WHERE empresa_id = v_empresa_id AND tipo='credito_os' AND created_at >= v_mes_inicio;

  SELECT COALESCE(SUM(valor_centavos),0), COUNT(*) INTO v_usado_mes, v_qtd_usado
    FROM cashback_movimentacoes WHERE empresa_id = v_empresa_id AND tipo='debito_uso_os' AND created_at >= v_mes_inicio;

  SELECT jsonb_agg(jsonb_build_object(
    'cliente_id', s.cliente_id, 'nome', c.nome, 'tipo_cliente', c.tipo_cliente,
    'grupo_nome', g.nome, 'saldo_centavos', s.saldo_centavos,
    'total_recebido_centavos', s.total_recebido_centavos,
    'total_usado_centavos', s.total_usado_centavos
  ) ORDER BY s.saldo_centavos DESC)
  INTO v_top
  FROM (SELECT * FROM cashback_saldos WHERE empresa_id = v_empresa_id AND saldo_centavos > 0
        ORDER BY saldo_centavos DESC LIMIT 10) s
  JOIN clientes c ON c.id = s.cliente_id
  LEFT JOIN lojista_grupos g ON g.id = c.grupo_id;

  SELECT jsonb_agg(jsonb_build_object(
    'id', m.id, 'created_at', m.created_at, 'tipo', m.tipo,
    'cliente_nome', c.nome, 'valor_centavos', m.valor_centavos,
    'saldo_apos_centavos', m.saldo_apos_centavos,
    'ordem_numero', os.numero, 'percentual_aplicado', m.percentual_aplicado,
    'descricao', m.descricao
  ) ORDER BY m.created_at DESC)
  INTO v_movs
  FROM (SELECT * FROM cashback_movimentacoes WHERE empresa_id = v_empresa_id
        ORDER BY created_at DESC LIMIT 20) m
  JOIN clientes c ON c.id = m.cliente_id
  LEFT JOIN ordens_de_servico os ON os.id = m.ordem_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'ativo', COALESCE(v_config.ativo, false),
    'saldo_total_devido_centavos', v_saldo_total,
    'qtd_clientes_com_saldo', v_clientes_com_saldo,
    'creditado_mes_centavos', v_cred_mes,
    'qtd_os_creditadas_mes', v_qtd_cred,
    'usado_mes_centavos', v_usado_mes,
    'qtd_os_usaram_mes', v_qtd_usado,
    'top_clientes', COALESCE(v_top,'[]'::jsonb),
    'movimentacoes_recentes', COALESCE(v_movs,'[]'::jsonb),
    'gerado_em', now()
  );
END;$$;
GRANT EXECUTE ON FUNCTION public.get_cashback_empresa_dashboard() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_meu_cashback()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cliente record; v_saldo record; v_regra record; v_extrato jsonb;
  v_rec_mes bigint; v_uso_mes bigint;
  v_mes_inicio date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  SELECT * INTO v_cliente FROM clientes WHERE user_id = v_user_id LIMIT 1;
  IF v_cliente.id IS NULL THEN RETURN jsonb_build_object('erro','cliente_nao_encontrado'); END IF;

  SELECT * INTO v_saldo FROM cashback_saldos WHERE cliente_id = v_cliente.id;

  SELECT * INTO v_regra FROM cashback_regras
   WHERE empresa_id = v_cliente.empresa_id AND ativo
     AND ((tipo IN ('pct_cliente','valor_fixo_cliente') AND target_cliente_id = v_cliente.id)
       OR (tipo='pct_grupo' AND target_grupo_id = v_cliente.grupo_id)
       OR (tipo='pct_global'))
   ORDER BY prioridade LIMIT 1;

  SELECT COALESCE(SUM(valor_centavos),0) INTO v_rec_mes FROM cashback_movimentacoes
   WHERE cliente_id = v_cliente.id AND tipo IN ('credito_os','credito_ajuste') AND created_at >= v_mes_inicio;
  SELECT COALESCE(SUM(valor_centavos),0) INTO v_uso_mes FROM cashback_movimentacoes
   WHERE cliente_id = v_cliente.id AND tipo IN ('debito_uso_os','debito_ajuste','debito_estorno_os') AND created_at >= v_mes_inicio;

  SELECT jsonb_agg(jsonb_build_object(
    'id', m.id, 'created_at', m.created_at, 'tipo', m.tipo,
    'valor_centavos', m.valor_centavos, 'saldo_apos_centavos', m.saldo_apos_centavos,
    'ordem_numero', os.numero, 'descricao', m.descricao
  ) ORDER BY m.created_at DESC) INTO v_extrato
  FROM (SELECT * FROM cashback_movimentacoes WHERE cliente_id = v_cliente.id
        ORDER BY created_at DESC LIMIT 30) m
  LEFT JOIN ordens_de_servico os ON os.id = m.ordem_id;

  RETURN jsonb_build_object(
    'cliente', jsonb_build_object('id', v_cliente.id, 'nome', v_cliente.nome, 'tipo_cliente', v_cliente.tipo_cliente),
    'saldo_centavos', COALESCE(v_saldo.saldo_centavos, 0),
    'total_recebido_centavos', COALESCE(v_saldo.total_recebido_centavos, 0),
    'total_usado_centavos', COALESCE(v_saldo.total_usado_centavos, 0),
    'recebido_mes_centavos', v_rec_mes,
    'usado_mes_centavos', v_uso_mes,
    'regra_ativa', CASE WHEN v_regra.id IS NULL THEN NULL ELSE jsonb_build_object(
      'tipo', v_regra.tipo, 'percentual', v_regra.percentual, 'valor_fixo_centavos', v_regra.valor_fixo_centavos
    ) END,
    'extrato', COALESCE(v_extrato,'[]'::jsonb)
  );
END;$$;
GRANT EXECUTE ON FUNCTION public.get_meu_cashback() TO authenticated;

-- =========================
-- 5) TRIGGERS automáticos
-- =========================
CREATE OR REPLACE FUNCTION public.trg_creditar_cashback_on_pronto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status::text = 'pronto' AND (OLD.status IS NULL OR OLD.status::text <> 'pronto') THEN
    PERFORM creditar_cashback_os(NEW.id);
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_os_creditar_cashback ON public.ordens_de_servico;
CREATE TRIGGER trg_os_creditar_cashback
  AFTER UPDATE OF status ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_creditar_cashback_on_pronto();

CREATE OR REPLACE FUNCTION public.trg_estornar_cashback_on_cancelada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cred record; v_saldo bigint; v_saldo_novo bigint; v_estorno bigint;
BEGIN
  IF NEW.status::text = 'cancelada' AND (OLD.status IS NULL OR OLD.status::text <> 'cancelada') THEN
    SELECT * INTO v_cred FROM cashback_movimentacoes WHERE ordem_id = NEW.id AND tipo='credito_os' LIMIT 1;
    IF v_cred.id IS NOT NULL THEN
      SELECT saldo_centavos INTO v_saldo FROM cashback_saldos WHERE cliente_id = v_cred.cliente_id;
      v_saldo_novo := GREATEST(v_saldo - v_cred.valor_centavos, 0);
      v_estorno := v_saldo - v_saldo_novo;
      IF v_estorno > 0 THEN
        INSERT INTO cashback_movimentacoes(
          cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos,
          ordem_id, descricao, justificativa
        ) VALUES (
          v_cred.cliente_id, v_cred.empresa_id, 'debito_estorno_os',
          v_estorno, v_saldo_novo, NEW.id, 'Estorno automático (OS cancelada)',
          CASE WHEN v_saldo < v_cred.valor_centavos
               THEN format('Estorno parcial: saldo R$ %s, crédito original R$ %s',
                           v_saldo::numeric/100, v_cred.valor_centavos::numeric/100)
               ELSE NULL END
        );
        UPDATE cashback_saldos
           SET saldo_centavos = v_saldo_novo,
               total_usado_centavos = total_usado_centavos + v_estorno,
               ultima_movimentacao_em = now(), updated_at = now()
         WHERE cliente_id = v_cred.cliente_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_os_estornar_cashback ON public.ordens_de_servico;
CREATE TRIGGER trg_os_estornar_cashback
  AFTER UPDATE OF status ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_estornar_cashback_on_cancelada();

-- =========================
-- 6) Inicializar config por empresa
-- =========================
INSERT INTO cashback_config (empresa_id, ativo)
SELECT id, false FROM empresas
ON CONFLICT (empresa_id) DO NOTHING;
