
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema='public' AND table_name='socios') THEN
    RAISE EXCEPTION 'Tabela socios não existe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='socios' 
                 AND column_name='percentual_participacao') THEN
    RAISE EXCEPTION 'Coluna socios.percentual_participacao não existe';
  END IF;
END$$;

-- 1) CAIXA DA EMPRESA
CREATE TABLE IF NOT EXISTS public.caixa_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid UNIQUE NOT NULL REFERENCES public.empresas(id),
  saldo_operacional_centavos bigint NOT NULL DEFAULT 0,
  saldo_reserva_centavos bigint NOT NULL DEFAULT 0,
  saldo_a_distribuir_centavos bigint NOT NULL DEFAULT 0,
  reserva_percentual numeric NOT NULL DEFAULT 10 CHECK (reserva_percentual BETWEEN 0 AND 100),
  reserva_meta_meses int NOT NULL DEFAULT 3 CHECK (reserva_meta_meses > 0),
  distribuir_automatico boolean NOT NULL DEFAULT true,
  dia_fechamento int NOT NULL DEFAULT 1 CHECK (dia_fechamento BETWEEN 1 AND 28),
  ultimo_fechamento_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_caixa_empresa_empresa ON public.caixa_empresa(empresa_id);

-- 2) MOVIMENTAÇÕES DO CAIXA
CREATE TABLE IF NOT EXISTS public.caixa_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  tipo text NOT NULL CHECK (tipo IN (
    'entrada_operacional','saida_operacional','transferencia_reserva',
    'uso_reserva','distribuicao_lucro','retirada_socio','ajuste_manual'
  )),
  valor_centavos bigint NOT NULL,
  afeta_operacional bigint DEFAULT 0,
  afeta_reserva bigint DEFAULT 0,
  afeta_distribuir bigint DEFAULT 0,
  descricao text NOT NULL,
  referencia_tabela text,
  referencia_id uuid,
  socio_id uuid REFERENCES public.socios(id),
  socio_movimentacao_id uuid,
  registrado_por_user_id uuid REFERENCES auth.users(id),
  aprovado_por_user_id uuid REFERENCES auth.users(id),
  data_movimentacao timestamptz NOT NULL DEFAULT now(),
  estornada_em timestamptz,
  estornada_por uuid REFERENCES auth.users(id),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_caixa_mov_empresa_data 
  ON public.caixa_movimentacoes(empresa_id, data_movimentacao DESC);
CREATE INDEX IF NOT EXISTS idx_caixa_mov_socio 
  ON public.caixa_movimentacoes(socio_id) WHERE socio_id IS NOT NULL;

-- 3) CONTAS DOS SÓCIOS
CREATE TABLE IF NOT EXISTS public.socio_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id uuid UNIQUE NOT NULL REFERENCES public.socios(id),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  saldo_centavos bigint NOT NULL DEFAULT 0,
  total_creditado_ano_centavos bigint NOT NULL DEFAULT 0,
  total_retirado_ano_centavos bigint NOT NULL DEFAULT 0,
  ultima_movimentacao_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_socio_contas_empresa ON public.socio_contas(empresa_id);

-- 4) EXTRATO DAS CONTAS DOS SÓCIOS
CREATE TABLE IF NOT EXISTS public.socio_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id uuid NOT NULL REFERENCES public.socios(id),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  tipo text NOT NULL CHECK (tipo IN (
    'credito_distribuicao','credito_adiantamento','credito_ajuste',
    'debito_pro_labore','debito_retirada','debito_ajuste'
  )),
  valor_centavos bigint NOT NULL,
  saldo_apos_centavos bigint NOT NULL,
  descricao text NOT NULL,
  mes_referencia text,
  caixa_movimentacao_id uuid REFERENCES public.caixa_movimentacoes(id),
  registrado_por_user_id uuid REFERENCES auth.users(id),
  aprovado_por_user_id uuid REFERENCES auth.users(id),
  data_movimentacao timestamptz NOT NULL DEFAULT now(),
  estornada_em timestamptz,
  estornada_por uuid REFERENCES auth.users(id),
  observacoes text,
  ata_referencia text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_socio_mov_socio_data 
  ON public.socio_movimentacoes(socio_id, data_movimentacao DESC);
CREATE INDEX IF NOT EXISTS idx_socio_mov_mes 
  ON public.socio_movimentacoes(empresa_id, mes_referencia) 
  WHERE mes_referencia IS NOT NULL;

-- 5) DISTRIBUIÇÕES MENSAIS
CREATE TABLE IF NOT EXISTS public.distribuicoes_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  mes_referencia text NOT NULL,
  lucro_liquido_centavos bigint NOT NULL,
  reserva_percentual_aplicado numeric NOT NULL,
  reserva_valor_centavos bigint NOT NULL,
  distribuivel_centavos bigint NOT NULL,
  status text NOT NULL DEFAULT 'projecao' CHECK (status IN ('projecao','fechado','revisao')),
  fechado_em timestamptz,
  fechado_por uuid REFERENCES auth.users(id),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, mes_referencia)
);
CREATE INDEX IF NOT EXISTS idx_distrib_empresa_mes 
  ON public.distribuicoes_mensais(empresa_id, mes_referencia DESC);

-- RLS
ALTER TABLE public.caixa_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixa_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.socio_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.socio_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribuicoes_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa vê seu caixa" ON public.caixa_empresa
FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin gerencia caixa empresa" ON public.caixa_empresa
FOR ALL USING (empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Empresa vê movs caixa" ON public.caixa_movimentacoes
FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin gerencia movs caixa" ON public.caixa_movimentacoes
FOR ALL USING (empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Sócio vê sua conta + admin vê todas" ON public.socio_contas
FOR SELECT USING (
  socio_id IN (SELECT id FROM socios WHERE user_id = auth.uid())
  OR empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Admin gerencia contas sócios" ON public.socio_contas
FOR ALL USING (empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Sócio vê seu extrato + admin vê todos" ON public.socio_movimentacoes
FOR SELECT USING (
  socio_id IN (SELECT id FROM socios WHERE user_id = auth.uid())
  OR empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Admin gerencia extrato sócios" ON public.socio_movimentacoes
FOR ALL USING (empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Empresa vê distribuições" ON public.distribuicoes_mensais
FOR SELECT USING (empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin gerencia distribuições" ON public.distribuicoes_mensais
FOR ALL USING (empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid()));

-- Inicialização
INSERT INTO public.caixa_empresa (empresa_id, saldo_operacional_centavos, saldo_reserva_centavos, saldo_a_distribuir_centavos)
SELECT id, 0, 0, 0 FROM public.empresas
ON CONFLICT (empresa_id) DO NOTHING;

INSERT INTO public.socio_contas (socio_id, empresa_id, saldo_centavos)
SELECT s.id, s.empresa_id, 0
FROM public.socios s
WHERE s.deleted_at IS NULL
ON CONFLICT (socio_id) DO NOTHING;

-- RPCs
CREATE OR REPLACE FUNCTION public.get_conta_socio(p_socio_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_socio_id uuid := p_socio_id;
  v_conta record;
  v_socio record;
  v_extrato jsonb;
BEGIN
  IF v_socio_id IS NULL THEN
    SELECT id INTO v_socio_id FROM socios WHERE user_id = v_user_id AND deleted_at IS NULL LIMIT 1;
  END IF;
  IF v_socio_id IS NULL THEN
    RETURN jsonb_build_object('erro', 'sócio não encontrado');
  END IF;
  SELECT id, nome, percentual_participacao, user_id, empresa_id
    INTO v_socio FROM socios WHERE id = v_socio_id;
  SELECT * INTO v_conta FROM socio_contas WHERE socio_id = v_socio_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'tipo', m.tipo, 'valor_centavos', m.valor_centavos,
    'saldo_apos_centavos', m.saldo_apos_centavos, 'descricao', m.descricao,
    'mes_referencia', m.mes_referencia, 'data', m.data_movimentacao,
    'ata_referencia', m.ata_referencia, 'estornada', m.estornada_em IS NOT NULL
  )), '[]'::jsonb) INTO v_extrato
    FROM (SELECT * FROM socio_movimentacoes WHERE socio_id = v_socio_id 
          ORDER BY data_movimentacao DESC LIMIT 30) m;
  RETURN jsonb_build_object(
    'socio', jsonb_build_object(
      'id', v_socio.id, 'nome', v_socio.nome,
      'percentual', v_socio.percentual_participacao,
      'eh_voce', v_socio.user_id = v_user_id
    ),
    'conta', jsonb_build_object(
      'saldo_centavos', COALESCE(v_conta.saldo_centavos, 0),
      'total_creditado_ano_centavos', COALESCE(v_conta.total_creditado_ano_centavos, 0),
      'total_retirado_ano_centavos', COALESCE(v_conta.total_retirado_ano_centavos, 0),
      'ultima_movimentacao_em', v_conta.ultima_movimentacao_em
    ),
    'extrato', v_extrato
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_conta_socio TO authenticated;

CREATE OR REPLACE FUNCTION public.get_caixa_empresa_completo()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa_id uuid;
  v_caixa record;
  v_socios jsonb;
  v_gastos_fixos_centavos bigint;
  v_reserva_meta_centavos bigint;
  v_dias_runway int;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM user_profiles WHERE user_id = v_user_id LIMIT 1;
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('erro', 'usuário sem empresa');
  END IF;
  SELECT * INTO v_caixa FROM caixa_empresa WHERE empresa_id = v_empresa_id;
  SELECT COALESCE(SUM(valor) / 3 * 100, 0)::bigint INTO v_gastos_fixos_centavos
    FROM contas_a_pagar
    WHERE empresa_id = v_empresa_id AND status = 'paga'
      AND data_pagamento >= CURRENT_DATE - INTERVAL '3 months'
      AND COALESCE(categoria, '') NOT IN ('Peças','Comissões')
      AND deleted_at IS NULL;
  v_reserva_meta_centavos := v_gastos_fixos_centavos * v_caixa.reserva_meta_meses;
  v_dias_runway := CASE WHEN v_gastos_fixos_centavos > 0 
    THEN (v_caixa.saldo_operacional_centavos * 30 / v_gastos_fixos_centavos)::int
    ELSE 999 END;
  SELECT jsonb_agg(jsonb_build_object(
    'id', s.id, 'nome', s.nome, 'percentual', s.percentual_participacao,
    'user_id', s.user_id, 'eh_voce', s.user_id = v_user_id,
    'saldo_centavos', COALESCE(sc.saldo_centavos, 0),
    'total_creditado_ano_centavos', COALESCE(sc.total_creditado_ano_centavos, 0),
    'total_retirado_ano_centavos', COALESCE(sc.total_retirado_ano_centavos, 0)
  ) ORDER BY s.ordem) INTO v_socios
    FROM socios s LEFT JOIN socio_contas sc ON sc.socio_id = s.id
    WHERE s.empresa_id = v_empresa_id AND s.deleted_at IS NULL AND s.ativo = true;
  RETURN jsonb_build_object(
    'sucesso', true,
    'caixa', jsonb_build_object(
      'saldo_operacional_centavos', v_caixa.saldo_operacional_centavos,
      'saldo_reserva_centavos', v_caixa.saldo_reserva_centavos,
      'saldo_a_distribuir_centavos', v_caixa.saldo_a_distribuir_centavos,
      'reserva_percentual', v_caixa.reserva_percentual,
      'reserva_meta_centavos', v_reserva_meta_centavos,
      'reserva_meta_meses', v_caixa.reserva_meta_meses,
      'reserva_progresso_pct', CASE WHEN v_reserva_meta_centavos > 0 
        THEN ROUND((v_caixa.saldo_reserva_centavos::numeric / v_reserva_meta_centavos) * 100, 2)
        ELSE 0 END,
      'dias_runway', v_dias_runway,
      'gastos_fixos_centavos', v_gastos_fixos_centavos,
      'ultimo_fechamento_em', v_caixa.ultimo_fechamento_em
    ),
    'socios', COALESCE(v_socios, '[]'::jsonb),
    'gerado_em', now()
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_caixa_empresa_completo TO authenticated;

CREATE OR REPLACE FUNCTION public.fechar_mes_distribuicao(p_mes_referencia text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa_id uuid;
  v_caixa record;
  v_distribuicao_id uuid;
  v_lucro_centavos bigint;
  v_reserva_centavos bigint;
  v_distribuivel_centavos bigint;
  v_socio record;
  v_valor_socio_centavos bigint;
  v_caixa_mov_id uuid;
  v_socio_mov_id uuid;
  v_saldo_novo bigint;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM user_profiles WHERE user_id = v_user_id LIMIT 1;
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'usuário sem empresa'; END IF;
  IF EXISTS (SELECT 1 FROM distribuicoes_mensais 
             WHERE empresa_id = v_empresa_id AND mes_referencia = p_mes_referencia 
               AND status = 'fechado') THEN
    RAISE EXCEPTION 'Mês % já foi fechado', p_mes_referencia;
  END IF;
  SELECT * INTO v_caixa FROM caixa_empresa WHERE empresa_id = v_empresa_id;
  WITH 
    fat AS (SELECT COALESCE(SUM(valor_total), 0) AS valor FROM ordens_de_servico
      WHERE empresa_id = v_empresa_id AND status IN ('pronto','entregue')
        AND data_conclusao >= (p_mes_referencia || '-01')::date
        AND data_conclusao < (p_mes_referencia || '-01')::date + INTERVAL '1 month'
        AND deleted_at IS NULL),
    pecas AS (SELECT COALESCE(SUM(custo_pecas), 0) AS valor FROM ordens_de_servico
      WHERE empresa_id = v_empresa_id AND status IN ('pronto','entregue')
        AND data_conclusao >= (p_mes_referencia || '-01')::date
        AND data_conclusao < (p_mes_referencia || '-01')::date + INTERVAL '1 month'
        AND deleted_at IS NULL),
    com AS (SELECT COALESCE(SUM(valor), 0) AS valor FROM comissoes
      WHERE empresa_id = v_empresa_id AND mes_competencia = p_mes_referencia
        AND estornada_em IS NULL),
    desp AS (SELECT COALESCE(SUM(valor), 0) AS valor FROM contas_a_pagar
      WHERE empresa_id = v_empresa_id
        AND data_vencimento >= (p_mes_referencia || '-01')::date
        AND data_vencimento < (p_mes_referencia || '-01')::date + INTERVAL '1 month'
        AND COALESCE(categoria, '') NOT IN ('Impostos','Peças','Comissões')
        AND deleted_at IS NULL)
  SELECT ((fat.valor - pecas.valor - com.valor - desp.valor) * 100)::bigint
    INTO v_lucro_centavos FROM fat, pecas, com, desp;
  IF v_lucro_centavos <= 0 THEN
    RAISE EXCEPTION 'Lucro líquido de % é zero ou negativo (R$ %). Não há distribuição.', 
                    p_mes_referencia, v_lucro_centavos::numeric / 100;
  END IF;
  v_reserva_centavos := (v_lucro_centavos * v_caixa.reserva_percentual / 100)::bigint;
  v_distribuivel_centavos := v_lucro_centavos - v_reserva_centavos;
  INSERT INTO distribuicoes_mensais (
    empresa_id, mes_referencia, lucro_liquido_centavos,
    reserva_percentual_aplicado, reserva_valor_centavos, distribuivel_centavos,
    status, fechado_em, fechado_por
  ) VALUES (
    v_empresa_id, p_mes_referencia, v_lucro_centavos,
    v_caixa.reserva_percentual, v_reserva_centavos, v_distribuivel_centavos,
    'fechado', now(), v_user_id
  ) RETURNING id INTO v_distribuicao_id;
  INSERT INTO caixa_movimentacoes (
    empresa_id, tipo, valor_centavos, afeta_operacional, afeta_reserva, afeta_distribuir,
    descricao, registrado_por_user_id
  ) VALUES (
    v_empresa_id, 'transferencia_reserva', v_reserva_centavos, 0, v_reserva_centavos, 0,
    format('Reserva de %s%% sobre lucro de R$ %s — %s', 
           v_caixa.reserva_percentual, (v_lucro_centavos::numeric / 100), p_mes_referencia),
    v_user_id
  );
  UPDATE caixa_empresa 
  SET saldo_reserva_centavos = saldo_reserva_centavos + v_reserva_centavos, updated_at = now()
  WHERE empresa_id = v_empresa_id;
  FOR v_socio IN (
    SELECT s.*, sc.saldo_centavos AS saldo_atual FROM socios s
    JOIN socio_contas sc ON sc.socio_id = s.id
    WHERE s.empresa_id = v_empresa_id AND s.deleted_at IS NULL AND s.ativo = true
    ORDER BY s.ordem
  ) LOOP
    v_valor_socio_centavos := (v_distribuivel_centavos * v_socio.percentual_participacao / 100)::bigint;
    v_saldo_novo := v_socio.saldo_atual + v_valor_socio_centavos;
    INSERT INTO caixa_movimentacoes (
      empresa_id, tipo, valor_centavos, afeta_operacional, afeta_distribuir,
      descricao, socio_id, registrado_por_user_id
    ) VALUES (
      v_empresa_id, 'distribuicao_lucro', v_valor_socio_centavos, 0, v_valor_socio_centavos,
      format('Distribuição %s — %s (%.2f%%)', p_mes_referencia, v_socio.nome, v_socio.percentual_participacao),
      v_socio.id, v_user_id
    ) RETURNING id INTO v_caixa_mov_id;
    INSERT INTO socio_movimentacoes (
      socio_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos,
      descricao, mes_referencia, caixa_movimentacao_id,
      registrado_por_user_id, aprovado_por_user_id
    ) VALUES (
      v_socio.id, v_empresa_id, 'credito_distribuicao', v_valor_socio_centavos, v_saldo_novo,
      format('Distribuição de lucro %s — %.2f%% sobre R$ %s', 
             p_mes_referencia, v_socio.percentual_participacao,
             (v_distribuivel_centavos::numeric / 100)),
      p_mes_referencia, v_caixa_mov_id, v_user_id, v_user_id
    ) RETURNING id INTO v_socio_mov_id;
    UPDATE socio_contas
    SET saldo_centavos = v_saldo_novo,
        total_creditado_ano_centavos = total_creditado_ano_centavos + v_valor_socio_centavos,
        ultima_movimentacao_em = now(), updated_at = now()
    WHERE socio_id = v_socio.id;
    UPDATE caixa_movimentacoes SET socio_movimentacao_id = v_socio_mov_id WHERE id = v_caixa_mov_id;
  END LOOP;
  UPDATE caixa_empresa SET ultimo_fechamento_em = now() WHERE empresa_id = v_empresa_id;
  RETURN jsonb_build_object(
    'sucesso', true, 'distribuicao_id', v_distribuicao_id, 'mes', p_mes_referencia,
    'lucro_liquido_centavos', v_lucro_centavos, 'reserva_centavos', v_reserva_centavos,
    'distribuivel_centavos', v_distribuivel_centavos
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.fechar_mes_distribuicao TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_retirada_socio(
  p_socio_id uuid, p_valor_centavos bigint, p_tipo text,
  p_descricao text, p_ata_referencia text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_socio record;
  v_conta record;
  v_caixa record;
  v_saldo_novo_socio bigint;
  v_caixa_mov_id uuid;
  v_socio_mov_id uuid;
BEGIN
  IF p_valor_centavos <= 0 THEN RAISE EXCEPTION 'Valor deve ser positivo'; END IF;
  IF p_tipo NOT IN ('debito_pro_labore','debito_retirada','debito_ajuste') THEN
    RAISE EXCEPTION 'Tipo inválido: %', p_tipo;
  END IF;
  SELECT * INTO v_socio FROM socios WHERE id = p_socio_id AND deleted_at IS NULL;
  IF v_socio.id IS NULL THEN RAISE EXCEPTION 'Sócio não encontrado'; END IF;
  SELECT * INTO v_conta FROM socio_contas WHERE socio_id = p_socio_id;
  SELECT * INTO v_caixa FROM caixa_empresa WHERE empresa_id = v_socio.empresa_id;
  IF v_socio.user_id != v_user_id THEN
    IF NOT EXISTS (SELECT 1 FROM user_profiles 
                   WHERE user_id = v_user_id AND empresa_id = v_socio.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão';
    END IF;
  END IF;
  IF v_conta.saldo_centavos < p_valor_centavos THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %, solicitado: R$ %',
                    v_conta.saldo_centavos::numeric / 100, p_valor_centavos::numeric / 100;
  END IF;
  IF v_caixa.saldo_operacional_centavos < p_valor_centavos THEN
    RAISE EXCEPTION 'Caixa operacional insuficiente. Disponível: R$ %, necessário: R$ %',
                    v_caixa.saldo_operacional_centavos::numeric / 100,
                    p_valor_centavos::numeric / 100;
  END IF;
  v_saldo_novo_socio := v_conta.saldo_centavos - p_valor_centavos;
  INSERT INTO caixa_movimentacoes (
    empresa_id, tipo, valor_centavos, afeta_operacional, afeta_reserva, afeta_distribuir,
    descricao, socio_id, registrado_por_user_id, aprovado_por_user_id
  ) VALUES (
    v_socio.empresa_id, 'retirada_socio', p_valor_centavos, -p_valor_centavos, 0, 0,
    format('Retirada %s — %s', 
           CASE WHEN p_tipo = 'debito_pro_labore' THEN 'pró-labore' ELSE 'extraordinária' END,
           v_socio.nome),
    p_socio_id, v_user_id, v_user_id
  ) RETURNING id INTO v_caixa_mov_id;
  INSERT INTO socio_movimentacoes (
    socio_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos,
    descricao, caixa_movimentacao_id, registrado_por_user_id, aprovado_por_user_id, ata_referencia
  ) VALUES (
    p_socio_id, v_socio.empresa_id, p_tipo, p_valor_centavos, v_saldo_novo_socio,
    p_descricao, v_caixa_mov_id, v_user_id, v_user_id, p_ata_referencia
  ) RETURNING id INTO v_socio_mov_id;
  UPDATE socio_contas
  SET saldo_centavos = v_saldo_novo_socio,
      total_retirado_ano_centavos = total_retirado_ano_centavos + p_valor_centavos,
      ultima_movimentacao_em = now(), updated_at = now()
  WHERE socio_id = p_socio_id;
  UPDATE caixa_empresa
  SET saldo_operacional_centavos = saldo_operacional_centavos - p_valor_centavos, updated_at = now()
  WHERE empresa_id = v_socio.empresa_id;
  UPDATE caixa_movimentacoes SET socio_movimentacao_id = v_socio_mov_id WHERE id = v_caixa_mov_id;
  RETURN jsonb_build_object(
    'sucesso', true, 'socio_movimentacao_id', v_socio_mov_id,
    'caixa_movimentacao_id', v_caixa_mov_id,
    'saldo_socio_novo_centavos', v_saldo_novo_socio,
    'saldo_caixa_novo_centavos', v_caixa.saldo_operacional_centavos - p_valor_centavos
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.registrar_retirada_socio TO authenticated;
