-- 1) TABELAS
CREATE TABLE IF NOT EXISTS public.fechamentos_mensais (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  mes           text NOT NULL,
  faturamento   numeric(14,2) NOT NULL DEFAULT 0,
  despesas      numeric(14,2) NOT NULL DEFAULT 0,
  custo_pecas   numeric(14,2) NOT NULL DEFAULT 0,
  comissoes     numeric(14,2) NOT NULL DEFAULT 0,
  lucro_liquido numeric(14,2) NOT NULL DEFAULT 0,
  reserva_pct   numeric(5,2)  NOT NULL DEFAULT 10,
  reserva_val   numeric(14,2) NOT NULL DEFAULT 0,
  distribuivel  numeric(14,2) NOT NULL DEFAULT 0,
  fechado_em    timestamptz   NOT NULL DEFAULT now(),
  fechado_por   uuid          REFERENCES auth.users(id),
  observacoes   text,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT fechamentos_empresa_mes_unique UNIQUE (empresa_id, mes)
);
CREATE INDEX IF NOT EXISTS idx_fechamentos_empresa_mes ON public.fechamentos_mensais(empresa_id, mes);

GRANT SELECT ON public.fechamentos_mensais TO authenticated;
GRANT ALL ON public.fechamentos_mensais TO service_role;

CREATE TABLE IF NOT EXISTS public.retiradas_socios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  socio_id        uuid NOT NULL REFERENCES public.socios(id) ON DELETE RESTRICT,
  valor           numeric(14,2) NOT NULL CHECK (valor > 0),
  data_retirada   date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento text NOT NULL DEFAULT 'PIX',
  descricao       text,
  status          text NOT NULL DEFAULT 'efetivada',
  criado_por      uuid REFERENCES auth.users(id),
  cancelado_por   uuid REFERENCES auth.users(id),
  cancelado_em    timestamptz,
  motivo_cancelamento text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retiradas_empresa_socio ON public.retiradas_socios(empresa_id, socio_id);
CREATE INDEX IF NOT EXISTS idx_retiradas_data ON public.retiradas_socios(data_retirada DESC);

GRANT SELECT ON public.retiradas_socios TO authenticated;
GRANT ALL ON public.retiradas_socios TO service_role;

CREATE TABLE IF NOT EXISTS public.extrato_socio (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  socio_id        uuid NOT NULL REFERENCES public.socios(id) ON DELETE RESTRICT,
  tipo            text NOT NULL CHECK (tipo IN ('credito_fechamento','debito_retirada','estorno_fechamento','estorno_retirada','pro_labore','ajuste')),
  valor           numeric(14,2) NOT NULL,
  descricao       text NOT NULL,
  data_movimento  date NOT NULL DEFAULT CURRENT_DATE,
  mes_ref         text,
  fechamento_id   uuid REFERENCES public.fechamentos_mensais(id) ON DELETE CASCADE,
  retirada_id     uuid REFERENCES public.retiradas_socios(id) ON DELETE CASCADE,
  criado_por      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_extrato_socio ON public.extrato_socio(socio_id, data_movimento DESC);
CREATE INDEX IF NOT EXISTS idx_extrato_empresa ON public.extrato_socio(empresa_id, data_movimento DESC);
CREATE INDEX IF NOT EXISTS idx_extrato_fechamento ON public.extrato_socio(fechamento_id);
CREATE INDEX IF NOT EXISTS idx_extrato_retirada ON public.extrato_socio(retirada_id);

GRANT SELECT ON public.extrato_socio TO authenticated;
GRANT ALL ON public.extrato_socio TO service_role;

-- 2) RLS
ALTER TABLE public.fechamentos_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retiradas_socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extrato_socio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "socio_ve_propria_empresa_fechamentos" ON public.fechamentos_mensais;
CREATE POLICY "socio_ve_propria_empresa_fechamentos" ON public.fechamentos_mensais
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM socios WHERE user_id = auth.uid() AND ativo = true AND deleted_at IS NULL));

DROP POLICY IF EXISTS "socio_ve_propria_empresa_retiradas" ON public.retiradas_socios;
CREATE POLICY "socio_ve_propria_empresa_retiradas" ON public.retiradas_socios
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM socios WHERE user_id = auth.uid() AND ativo = true AND deleted_at IS NULL));

DROP POLICY IF EXISTS "socio_ve_propria_empresa_extrato" ON public.extrato_socio;
CREATE POLICY "socio_ve_propria_empresa_extrato" ON public.extrato_socio
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM socios WHERE user_id = auth.uid() AND ativo = true AND deleted_at IS NULL));

-- 3) Helper
CREATE OR REPLACE FUNCTION public._socio_da_empresa(p_empresa_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM socios
  WHERE user_id = auth.uid() AND empresa_id = p_empresa_id AND ativo = true AND deleted_at IS NULL
  LIMIT 1;
$$;

-- 4) fechar_mes
CREATE OR REPLACE FUNCTION public.fechar_mes(p_mes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_socio_atual    record;
  v_empresa_id     uuid;
  v_mes_inicio     date;
  v_mes_fim        date;
  v_faturamento    numeric := 0;
  v_despesas       numeric := 0;
  v_custo_pecas    numeric := 0;
  v_comissoes      numeric := 0;
  v_lucro_liquido  numeric;
  v_reserva_pct    numeric := 10;
  v_reserva_val    numeric;
  v_distribuivel   numeric;
  v_fechamento_id  uuid;
  v_socio          record;
  v_credito_socio  numeric;
  v_creditos       jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  SELECT s.* INTO v_socio_atual FROM socios s
   WHERE s.user_id = v_user_id AND s.ativo = true AND s.deleted_at IS NULL LIMIT 1;
  IF v_socio_atual.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas sócios podem fechar o mês');
  END IF;
  v_empresa_id := v_socio_atual.empresa_id;
  IF p_mes !~ '^\d{4}-\d{2}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Formato de mês inválido. Use YYYY-MM');
  END IF;
  v_mes_inicio := (p_mes || '-01')::date;
  v_mes_fim    := (v_mes_inicio + INTERVAL '1 month' - INTERVAL '1 day')::date;
  IF v_mes_inicio > CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível fechar um mês futuro');
  END IF;
  IF EXISTS (SELECT 1 FROM fechamentos_mensais WHERE empresa_id = v_empresa_id AND mes = p_mes) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mês ' || p_mes || ' já está fechado. Use reabrir_mes() antes.');
  END IF;

  SELECT COALESCE(SUM(COALESCE(os.valor_total, 0)), 0) INTO v_faturamento
    FROM ordens_de_servico os
   WHERE os.empresa_id = v_empresa_id AND os.deleted_at IS NULL
     AND os.status IN ('entregue'::status_ordem, 'pronto'::status_ordem)
     AND COALESCE(os.data_conclusao, os.data_entrega, os.data_entrada)::date BETWEEN v_mes_inicio AND v_mes_fim;

  SELECT COALESCE(SUM(pu.quantidade * COALESCE(pu.custo_unitario, 0)), 0) INTO v_custo_pecas
    FROM pecas_utilizadas pu
    JOIN ordens_de_servico os ON os.id = pu.ordem_id
   WHERE pu.empresa_id = v_empresa_id AND os.deleted_at IS NULL
     AND os.status IN ('entregue'::status_ordem, 'pronto'::status_ordem)
     AND COALESCE(os.data_conclusao, os.data_entrega, os.data_entrada)::date BETWEEN v_mes_inicio AND v_mes_fim;

  SELECT COALESCE(SUM(COALESCE(oss.comissao, 0)), 0) INTO v_comissoes
    FROM os_servicos oss
    JOIN ordens_de_servico os ON os.id = oss.ordem_id
   WHERE oss.empresa_id = v_empresa_id AND os.deleted_at IS NULL
     AND oss.status = 'concluido'
     AND COALESCE(oss.concluido_em::date, os.data_entrada::date) BETWEEN v_mes_inicio AND v_mes_fim;

  v_despesas := 0;
  v_lucro_liquido := v_faturamento - (v_custo_pecas + v_comissoes + v_despesas);
  v_reserva_val   := ROUND(v_lucro_liquido * v_reserva_pct / 100, 2);
  v_distribuivel  := v_lucro_liquido - v_reserva_val;
  IF v_lucro_liquido < 0 THEN
    v_reserva_val  := 0;
    v_distribuivel := 0;
  END IF;

  INSERT INTO fechamentos_mensais (
    empresa_id, mes, faturamento, despesas, custo_pecas, comissoes,
    lucro_liquido, reserva_pct, reserva_val, distribuivel, fechado_por
  ) VALUES (
    v_empresa_id, p_mes, v_faturamento, v_despesas, v_custo_pecas, v_comissoes,
    v_lucro_liquido, v_reserva_pct, v_reserva_val, v_distribuivel, v_user_id
  ) RETURNING id INTO v_fechamento_id;

  FOR v_socio IN
    SELECT id, nome, percentual_participacao FROM socios
     WHERE empresa_id = v_empresa_id AND ativo = true AND deleted_at IS NULL
     ORDER BY ordem NULLS LAST, nome
  LOOP
    v_credito_socio := ROUND(v_distribuivel * v_socio.percentual_participacao / 100, 2);
    IF v_credito_socio > 0 THEN
      INSERT INTO extrato_socio (
        empresa_id, socio_id, tipo, valor, descricao, data_movimento, mes_ref, fechamento_id, criado_por
      ) VALUES (
        v_empresa_id, v_socio.id, 'credito_fechamento', v_credito_socio,
        'Distribuição de lucro · ' || p_mes,
        v_mes_fim, p_mes, v_fechamento_id, v_user_id
      );
      v_creditos := v_creditos || jsonb_build_object(
        'socio_id', v_socio.id, 'nome', v_socio.nome,
        'percentual', v_socio.percentual_participacao, 'valor', v_credito_socio
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 'fechamento_id', v_fechamento_id, 'mes', p_mes,
    'lucro_liquido', v_lucro_liquido, 'reserva_val', v_reserva_val,
    'distribuivel', v_distribuivel, 'creditos', v_creditos
  );
END;
$$;
REVOKE ALL ON FUNCTION public.fechar_mes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fechar_mes(text) TO authenticated;

-- 5) reabrir_mes
CREATE OR REPLACE FUNCTION public.reabrir_mes(p_mes text, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_empresa_id uuid;
  v_fechamento record;
  v_retiradas_apos int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  SELECT empresa_id INTO v_empresa_id FROM socios
   WHERE user_id = v_user_id AND ativo = true AND deleted_at IS NULL LIMIT 1;
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas sócios podem reabrir o mês');
  END IF;
  SELECT * INTO v_fechamento FROM fechamentos_mensais
   WHERE empresa_id = v_empresa_id AND mes = p_mes LIMIT 1;
  IF v_fechamento.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mês ' || p_mes || ' não está fechado');
  END IF;
  SELECT COUNT(*) INTO v_retiradas_apos FROM retiradas_socios
   WHERE empresa_id = v_empresa_id AND status = 'efetivada'
     AND created_at > v_fechamento.fechado_em;
  IF v_retiradas_apos > 0 THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Não é possível reabrir: existem ' || v_retiradas_apos || ' retirada(s) feita(s) após o fechamento. Cancele essas retiradas antes.');
  END IF;
  DELETE FROM fechamentos_mensais WHERE id = v_fechamento.id;
  RETURN jsonb_build_object('success', true, 'mes', p_mes,
    'fechamento_id_removido', v_fechamento.id, 'motivo', p_motivo);
END;
$$;
REVOKE ALL ON FUNCTION public.reabrir_mes(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reabrir_mes(text, text) TO authenticated;

-- 6) criar_retirada
CREATE OR REPLACE FUNCTION public.criar_retirada(
  p_valor numeric, p_descricao text DEFAULT NULL, p_data_retirada date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_socio       record;
  v_saldo_atual numeric;
  v_retirada_id uuid;
  v_data        date := COALESCE(p_data_retirada, CURRENT_DATE);
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor da retirada deve ser maior que zero');
  END IF;
  SELECT * INTO v_socio FROM socios
   WHERE user_id = v_user_id AND ativo = true AND deleted_at IS NULL LIMIT 1;
  IF v_socio.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não é sócio ativo');
  END IF;
  SELECT COALESCE(SUM(valor), 0) INTO v_saldo_atual FROM extrato_socio WHERE socio_id = v_socio.id;
  IF p_valor > v_saldo_atual THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Saldo insuficiente. Disponível: R$ ' || to_char(v_saldo_atual, 'FM999G999G990D00'),
      'saldo_atual', v_saldo_atual);
  END IF;
  INSERT INTO retiradas_socios (
    empresa_id, socio_id, valor, data_retirada, forma_pagamento, descricao, criado_por
  ) VALUES (
    v_socio.empresa_id, v_socio.id, p_valor, v_data, 'PIX', p_descricao, v_user_id
  ) RETURNING id INTO v_retirada_id;
  INSERT INTO extrato_socio (
    empresa_id, socio_id, tipo, valor, descricao, data_movimento, retirada_id, criado_por
  ) VALUES (
    v_socio.empresa_id, v_socio.id, 'debito_retirada', -p_valor,
    COALESCE(p_descricao, 'Retirada via PIX'), v_data, v_retirada_id, v_user_id
  );
  RETURN jsonb_build_object('success', true, 'retirada_id', v_retirada_id,
    'valor', p_valor, 'saldo_apos', v_saldo_atual - p_valor);
END;
$$;
REVOKE ALL ON FUNCTION public.criar_retirada(numeric, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_retirada(numeric, text, date) TO authenticated;

-- 7) cancelar_retirada
CREATE OR REPLACE FUNCTION public.cancelar_retirada(p_retirada_id uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_socio_id  uuid;
  v_retirada  record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  SELECT id INTO v_socio_id FROM socios
   WHERE user_id = v_user_id AND ativo = true AND deleted_at IS NULL LIMIT 1;
  IF v_socio_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não é sócio');
  END IF;
  SELECT * INTO v_retirada FROM retiradas_socios WHERE id = p_retirada_id;
  IF v_retirada.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retirada não encontrada');
  END IF;
  IF v_retirada.socio_id <> v_socio_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Só o próprio sócio pode cancelar sua retirada');
  END IF;
  IF v_retirada.status = 'cancelada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retirada já está cancelada');
  END IF;
  UPDATE retiradas_socios SET
    status = 'cancelada', cancelado_por = v_user_id, cancelado_em = now(),
    motivo_cancelamento = p_motivo, updated_at = now()
  WHERE id = p_retirada_id;
  INSERT INTO extrato_socio (
    empresa_id, socio_id, tipo, valor, descricao, retirada_id, criado_por
  ) VALUES (
    v_retirada.empresa_id, v_retirada.socio_id, 'estorno_retirada', v_retirada.valor,
    'Estorno da retirada · ' || COALESCE(p_motivo, 'sem motivo'),
    p_retirada_id, v_user_id
  );
  RETURN jsonb_build_object('success', true, 'retirada_id', p_retirada_id);
END;
$$;
REVOKE ALL ON FUNCTION public.cancelar_retirada(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_retirada(uuid, text) TO authenticated;

-- 8) get_extrato_socio
CREATE OR REPLACE FUNCTION public.get_extrato_socio(p_filtro text DEFAULT 'todos')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_socio_id  uuid;
  v_saldo     numeric := 0;
  v_lista     jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  SELECT id INTO v_socio_id FROM socios
   WHERE user_id = v_user_id AND ativo = true AND deleted_at IS NULL LIMIT 1;
  IF v_socio_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'movimentos', '[]'::jsonb, 'saldo', 0);
  END IF;
  SELECT COALESCE(SUM(valor), 0) INTO v_saldo FROM extrato_socio WHERE socio_id = v_socio_id;
  WITH ordenados AS (
    SELECT e.*,
           SUM(e.valor) OVER (ORDER BY e.data_movimento, e.created_at) AS saldo_apos
      FROM extrato_socio e
     WHERE e.socio_id = v_socio_id
       AND (
         p_filtro = 'todos'
         OR (p_filtro = 'creditos'   AND e.valor > 0)
         OR (p_filtro = 'debitos'    AND e.valor < 0)
         OR (p_filtro = 'pro_labore' AND e.tipo  = 'pro_labore')
       )
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id, 'tipo', tipo, 'valor', valor, 'descricao', descricao,
      'data_movimento', data_movimento, 'mes_ref', mes_ref,
      'fechamento_id', fechamento_id, 'retirada_id', retirada_id,
      'saldo_apos', saldo_apos, 'created_at', created_at
    ) ORDER BY data_movimento DESC, created_at DESC
  ), '[]'::jsonb) INTO v_lista FROM ordenados;
  RETURN jsonb_build_object('success', true, 'saldo', v_saldo, 'movimentos', v_lista);
END;
$$;
REVOKE ALL ON FUNCTION public.get_extrato_socio(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_extrato_socio(text) TO authenticated;

-- 9) get_painel_socio_contas
CREATE OR REPLACE FUNCTION public.get_painel_socio_contas()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_socio      record;
  v_empresa_id uuid;
  v_result     jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  SELECT * INTO v_socio FROM socios
   WHERE user_id = v_user_id AND ativo = true AND deleted_at IS NULL LIMIT 1;
  IF v_socio.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não é sócio');
  END IF;
  v_empresa_id := v_socio.empresa_id;

  SELECT jsonb_build_object(
    'success', true,
    'socio_id_logado', v_socio.id,
    'socios', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', s.id, 'nome', s.nome,
          'percentual', s.percentual_participacao,
          'eh_voce', (s.id = v_socio.id),
          'saldo_a_retirar', COALESCE((SELECT SUM(valor) FROM extrato_socio WHERE socio_id = s.id), 0),
          'total_retirado',  COALESCE((SELECT SUM(valor) FROM retiradas_socios WHERE socio_id = s.id AND status = 'efetivada'), 0),
          'creditado_no_ano', COALESCE((
            SELECT SUM(valor) FROM extrato_socio
             WHERE socio_id = s.id AND tipo = 'credito_fechamento'
               AND EXTRACT(YEAR FROM data_movimento) = EXTRACT(YEAR FROM CURRENT_DATE)
          ), 0)
        ) ORDER BY s.ordem NULLS LAST, s.nome
      ), '[]'::jsonb)
      FROM socios s
     WHERE s.empresa_id = v_empresa_id AND s.ativo = true AND s.deleted_at IS NULL
    ),
    'fechamentos', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', f.id, 'mes', f.mes,
          'faturamento', f.faturamento, 'lucro_liquido', f.lucro_liquido,
          'reserva_val', f.reserva_val, 'distribuivel', f.distribuivel,
          'fechado_em', f.fechado_em,
          'meu_valor', COALESCE((
            SELECT SUM(valor) FROM extrato_socio
             WHERE fechamento_id = f.id AND socio_id = v_socio.id
          ), 0)
        ) ORDER BY f.mes DESC
      ), '[]'::jsonb)
      FROM fechamentos_mensais f
     WHERE f.empresa_id = v_empresa_id
    ),
    'meses_disponiveis_pra_fechar', (
      WITH meses AS (
        SELECT to_char(date_trunc('month', CURRENT_DATE) - (n || ' months')::interval, 'YYYY-MM') AS mes
          FROM generate_series(1, 6) AS n
      )
      SELECT COALESCE(jsonb_agg(m.mes ORDER BY m.mes DESC), '[]'::jsonb)
        FROM meses m
       WHERE NOT EXISTS (
         SELECT 1 FROM fechamentos_mensais f
          WHERE f.empresa_id = v_empresa_id AND f.mes = m.mes
       )
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_painel_socio_contas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_painel_socio_contas() TO authenticated;