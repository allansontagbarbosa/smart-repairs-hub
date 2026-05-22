-- ============== LIMPEZA V1 ==============
DROP TABLE IF EXISTS public.cashback_regras CASCADE;
DROP FUNCTION IF EXISTS public.calcular_cashback_os(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.creditar_cashback_os(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.cashback_regras_set_prioridade() CASCADE;

-- ============== NOVAS TABELAS ==============
CREATE TABLE IF NOT EXISTS public.cashback_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid UNIQUE NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  ativado_por_user_id uuid REFERENCES auth.users(id),
  ativado_em timestamptz NOT NULL DEFAULT now(),
  desativado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cashback_clientes_empresa_ativo
  ON public.cashback_clientes(empresa_id) WHERE ativo;

CREATE TABLE IF NOT EXISTS public.cashback_taxas_categoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  categoria text NOT NULL,
  percentual numeric NOT NULL CHECK (percentual > 0 AND percentual <= 100),
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, categoria)
);
CREATE INDEX IF NOT EXISTS idx_cashback_taxas_cliente
  ON public.cashback_taxas_categoria(cliente_id) WHERE ativa;
CREATE INDEX IF NOT EXISTS idx_cashback_taxas_categoria
  ON public.cashback_taxas_categoria(empresa_id, categoria) WHERE ativa;

CREATE TABLE IF NOT EXISTS public.cashback_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  cliente_id uuid REFERENCES public.clientes(id),
  acao text NOT NULL,
  categoria text,
  valor_anterior numeric,
  valor_novo numeric,
  user_id uuid REFERENCES auth.users(id),
  justificativa text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cashback_audit_empresa_data
  ON public.cashback_audit_log(empresa_id, created_at DESC);

-- ============== RLS ==============
ALTER TABLE public.cashback_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashback_taxas_categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashback_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente vê sua ativação + admin tudo" ON public.cashback_clientes
FOR SELECT USING (
  cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
  OR empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Admin gerencia cashback_clientes" ON public.cashback_clientes
FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Cliente vê suas taxas + admin tudo" ON public.cashback_taxas_categoria
FOR SELECT USING (
  cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
  OR empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Admin gerencia cashback_taxas" ON public.cashback_taxas_categoria
FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Admin vê audit log" ON public.cashback_audit_log
FOR SELECT USING (
  empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Admin insere audit log" ON public.cashback_audit_log
FOR INSERT WITH CHECK (
  empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid())
);

-- ============== RPCs ==============
CREATE OR REPLACE FUNCTION public.calcular_cashback_os(p_ordem_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_os record; v_tipo_servico record; v_cliente_ativo record; v_taxa record;
  v_valor_centavos bigint := 0;
BEGIN
  SELECT * INTO v_os FROM ordens_de_servico WHERE id = p_ordem_id;
  IF v_os.id IS NULL THEN RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'os_nao_encontrada'); END IF;
  IF NOT EXISTS (SELECT 1 FROM cashback_config WHERE empresa_id = v_os.empresa_id AND ativo) THEN
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'cashback_desativado_empresa');
  END IF;
  SELECT * INTO v_cliente_ativo FROM cashback_clientes WHERE cliente_id = v_os.cliente_id AND ativo;
  IF v_cliente_ativo.id IS NULL THEN RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'cliente_nao_ativado'); END IF;
  SELECT * INTO v_tipo_servico FROM tipos_servico WHERE id = v_os.tipo_servico_id;
  IF v_tipo_servico.id IS NULL OR v_tipo_servico.categoria IS NULL THEN
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'tipo_servico_sem_categoria');
  END IF;
  SELECT * INTO v_taxa FROM cashback_taxas_categoria
   WHERE cliente_id = v_os.cliente_id AND categoria = v_tipo_servico.categoria AND ativa;
  IF v_taxa.id IS NULL THEN
    RETURN jsonb_build_object('valor_centavos', 0, 'motivo', 'categoria_nao_configurada', 'categoria', v_tipo_servico.categoria);
  END IF;
  v_valor_centavos := FLOOR((COALESCE(v_os.valor_total, v_os.valor, 0) * v_taxa.percentual / 100) * 100)::bigint;
  RETURN jsonb_build_object(
    'valor_centavos', v_valor_centavos,
    'percentual_aplicado', v_taxa.percentual,
    'categoria', v_tipo_servico.categoria,
    'tipo_servico_nome', v_tipo_servico.nome,
    'cliente_id', v_os.cliente_id,
    'empresa_id', v_os.empresa_id,
    'taxa_id', v_taxa.id
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.calcular_cashback_os TO authenticated;

CREATE OR REPLACE FUNCTION public.creditar_cashback_os(p_ordem_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_calc jsonb; v_valor bigint; v_cliente_id uuid; v_empresa_id uuid;
  v_pct numeric; v_categoria text; v_saldo_atual bigint; v_saldo_novo bigint; v_mov_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM cashback_movimentacoes WHERE ordem_id = p_ordem_id AND tipo = 'credito_os') THEN
    RETURN jsonb_build_object('sucesso', false, 'motivo', 'ja_creditado');
  END IF;
  v_calc := calcular_cashback_os(p_ordem_id);
  v_valor := (v_calc->>'valor_centavos')::bigint;
  IF v_valor <= 0 THEN RETURN jsonb_build_object('sucesso', false, 'motivo', v_calc->>'motivo'); END IF;
  v_cliente_id := (v_calc->>'cliente_id')::uuid;
  v_empresa_id := (v_calc->>'empresa_id')::uuid;
  v_pct := (v_calc->>'percentual_aplicado')::numeric;
  v_categoria := v_calc->>'categoria';
  INSERT INTO cashback_saldos (cliente_id, empresa_id, saldo_centavos)
    VALUES (v_cliente_id, v_empresa_id, 0) ON CONFLICT (cliente_id) DO NOTHING;
  SELECT saldo_centavos INTO v_saldo_atual FROM cashback_saldos WHERE cliente_id = v_cliente_id;
  v_saldo_novo := v_saldo_atual + v_valor;
  INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos, ordem_id, percentual_aplicado, descricao)
  VALUES (v_cliente_id, v_empresa_id, 'credito_os', v_valor, v_saldo_novo, p_ordem_id, v_pct, format('Cashback %s%% · categoria %s', v_pct, v_categoria))
  RETURNING id INTO v_mov_id;
  UPDATE cashback_saldos SET saldo_centavos = v_saldo_novo,
    total_recebido_centavos = total_recebido_centavos + v_valor,
    ultima_movimentacao_em = now(), updated_at = now()
   WHERE cliente_id = v_cliente_id;
  RETURN jsonb_build_object('sucesso', true, 'movimentacao_id', v_mov_id, 'valor_centavos', v_valor, 'saldo_novo_centavos', v_saldo_novo);
END; $$;
GRANT EXECUTE ON FUNCTION public.creditar_cashback_os TO authenticated;

CREATE OR REPLACE FUNCTION public.aplicar_cashback_em_os(p_ordem_id uuid, p_valor_usar_centavos bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_os record; v_saldo record;
  v_valor_os_centavos bigint; v_saldo_novo bigint; v_mov_id uuid;
BEGIN
  IF p_valor_usar_centavos <= 0 THEN RAISE EXCEPTION 'Valor a usar deve ser positivo'; END IF;
  SELECT * INTO v_os FROM ordens_de_servico WHERE id = p_ordem_id;
  IF v_os.id IS NULL THEN RAISE EXCEPTION 'OS não encontrada'; END IF;
  IF v_os.status IN ('entregue','cancelada') THEN
    RAISE EXCEPTION 'Não é possível aplicar cashback em OS já entregue ou cancelada';
  END IF;
  SELECT * INTO v_saldo FROM cashback_saldos WHERE cliente_id = v_os.cliente_id;
  IF v_saldo.cliente_id IS NULL OR v_saldo.saldo_centavos = 0 THEN
    RAISE EXCEPTION 'Cliente sem saldo de cashback';
  END IF;
  IF p_valor_usar_centavos > v_saldo.saldo_centavos THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: R$ %, solicitado: R$ %',
      v_saldo.saldo_centavos::numeric / 100, p_valor_usar_centavos::numeric / 100;
  END IF;
  v_valor_os_centavos := FLOOR(COALESCE(v_os.valor_total, v_os.valor, 0) * 100)::bigint;
  IF p_valor_usar_centavos > v_valor_os_centavos THEN
    RAISE EXCEPTION 'Valor maior que o total da OS (R$ %)', v_valor_os_centavos::numeric / 100;
  END IF;
  v_saldo_novo := v_saldo.saldo_centavos - p_valor_usar_centavos;
  INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos, ordem_id, descricao, created_by_user_id)
  VALUES (v_os.cliente_id, v_os.empresa_id, 'debito_uso_os', p_valor_usar_centavos, v_saldo_novo, p_ordem_id,
          format('Abate em OS #%s', v_os.numero), v_user_id) RETURNING id INTO v_mov_id;
  UPDATE cashback_saldos SET saldo_centavos = v_saldo_novo,
    total_usado_centavos = total_usado_centavos + p_valor_usar_centavos,
    ultima_movimentacao_em = now(), updated_at = now() WHERE cliente_id = v_os.cliente_id;
  UPDATE ordens_de_servico
     SET valor_total = valor_total - (p_valor_usar_centavos::numeric / 100),
         observacoes = COALESCE(observacoes, '') || E'\n[Cashback aplicado: -R$ ' || (p_valor_usar_centavos::numeric / 100)::text || ']'
   WHERE id = p_ordem_id;
  RETURN jsonb_build_object('sucesso', true, 'movimentacao_id', v_mov_id,
    'valor_aplicado_centavos', p_valor_usar_centavos, 'saldo_novo_centavos', v_saldo_novo);
END; $$;
GRANT EXECUTE ON FUNCTION public.aplicar_cashback_em_os TO authenticated;

CREATE OR REPLACE FUNCTION public.cashback_ativar_cliente(p_cliente_id uuid, p_ativar boolean DEFAULT true, p_observacoes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_cliente record; v_existente record;
BEGIN
  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id;
  IF v_cliente.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  SELECT * INTO v_existente FROM cashback_clientes WHERE cliente_id = p_cliente_id;
  IF v_existente.id IS NULL THEN
    INSERT INTO cashback_clientes (cliente_id, empresa_id, ativo, observacoes, ativado_por_user_id)
    VALUES (p_cliente_id, v_cliente.empresa_id, p_ativar, p_observacoes, v_user_id);
  ELSE
    UPDATE cashback_clientes SET ativo = p_ativar,
      observacoes = COALESCE(p_observacoes, observacoes),
      desativado_em = CASE WHEN p_ativar THEN NULL ELSE now() END, updated_at = now()
    WHERE cliente_id = p_cliente_id;
  END IF;
  INSERT INTO cashback_audit_log (empresa_id, cliente_id, acao, user_id)
  VALUES (v_cliente.empresa_id, p_cliente_id, CASE WHEN p_ativar THEN 'ativou_cliente' ELSE 'desativou_cliente' END, v_user_id);
  RETURN jsonb_build_object('sucesso', true, 'cliente_id', p_cliente_id, 'ativo', p_ativar);
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_ativar_cliente TO authenticated;

CREATE OR REPLACE FUNCTION public.cashback_set_taxa_categoria(p_cliente_id uuid, p_categoria text, p_percentual numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_cliente record; v_existente record; v_valor_anterior numeric;
BEGIN
  IF p_percentual IS NOT NULL AND (p_percentual <= 0 OR p_percentual > 100) THEN
    RAISE EXCEPTION 'Percentual deve estar entre 0.01 e 100 (recebido: %)', p_percentual;
  END IF;
  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id;
  IF v_cliente.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  INSERT INTO cashback_clientes (cliente_id, empresa_id, ativo, ativado_por_user_id)
  VALUES (p_cliente_id, v_cliente.empresa_id, true, v_user_id)
  ON CONFLICT (cliente_id) DO UPDATE SET ativo = true, updated_at = now();
  SELECT * INTO v_existente FROM cashback_taxas_categoria WHERE cliente_id = p_cliente_id AND categoria = p_categoria;
  v_valor_anterior := v_existente.percentual;
  IF p_percentual IS NULL OR p_percentual = 0 THEN
    DELETE FROM cashback_taxas_categoria WHERE cliente_id = p_cliente_id AND categoria = p_categoria;
    IF v_valor_anterior IS NOT NULL THEN
      INSERT INTO cashback_audit_log (empresa_id, cliente_id, acao, categoria, valor_anterior, user_id)
      VALUES (v_cliente.empresa_id, p_cliente_id, 'removeu_taxa', p_categoria, v_valor_anterior, v_user_id);
    END IF;
    RETURN jsonb_build_object('sucesso', true, 'acao', 'removida', 'categoria', p_categoria);
  END IF;
  INSERT INTO cashback_taxas_categoria (cliente_id, empresa_id, categoria, percentual)
  VALUES (p_cliente_id, v_cliente.empresa_id, p_categoria, p_percentual)
  ON CONFLICT (cliente_id, categoria) DO UPDATE SET percentual = EXCLUDED.percentual, ativa = true, updated_at = now();
  INSERT INTO cashback_audit_log (empresa_id, cliente_id, acao, categoria, valor_anterior, valor_novo, user_id)
  VALUES (v_cliente.empresa_id, p_cliente_id,
    CASE WHEN v_valor_anterior IS NULL THEN 'set_taxa' ELSE 'editou_taxa' END,
    p_categoria, v_valor_anterior, p_percentual, v_user_id);
  RETURN jsonb_build_object('sucesso', true,
    'acao', CASE WHEN v_valor_anterior IS NULL THEN 'criada' ELSE 'atualizada' END,
    'categoria', p_categoria, 'percentual', p_percentual);
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_set_taxa_categoria TO authenticated;

CREATE OR REPLACE FUNCTION public.cashback_get_cliente_config(p_cliente_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cliente record; v_ativacao record; v_saldo record; v_categorias jsonb;
BEGIN
  SELECT c.*, g.nome AS grupo_nome INTO v_cliente
    FROM clientes c LEFT JOIN lojista_grupos g ON g.id = c.grupo_id
   WHERE c.id = p_cliente_id;
  IF v_cliente.id IS NULL THEN RETURN jsonb_build_object('erro', 'cliente_nao_encontrado'); END IF;
  SELECT * INTO v_ativacao FROM cashback_clientes WHERE cliente_id = p_cliente_id;
  SELECT jsonb_agg(jsonb_build_object(
    'categoria', cat.categoria, 'qtd_tipos_servico', cat.qtd,
    'percentual', t.percentual, 'tem_taxa', t.id IS NOT NULL
  ) ORDER BY cat.categoria) INTO v_categorias
    FROM (SELECT COALESCE(categoria, 'sem_categoria') AS categoria, COUNT(*) AS qtd
            FROM tipos_servico WHERE empresa_id = v_cliente.empresa_id AND ativo GROUP BY 1) cat
    LEFT JOIN cashback_taxas_categoria t
      ON t.cliente_id = p_cliente_id AND t.categoria = cat.categoria AND t.ativa;
  SELECT * INTO v_saldo FROM cashback_saldos WHERE cliente_id = p_cliente_id;
  RETURN jsonb_build_object(
    'cliente', jsonb_build_object('id', v_cliente.id, 'nome', v_cliente.nome,
      'tipo_cliente', v_cliente.tipo_cliente, 'grupo_nome', v_cliente.grupo_nome),
    'ativacao', CASE WHEN v_ativacao.id IS NULL THEN jsonb_build_object('ativo', false, 'nunca_ativado', true)
      ELSE jsonb_build_object('ativo', v_ativacao.ativo, 'ativado_em', v_ativacao.ativado_em, 'observacoes', v_ativacao.observacoes) END,
    'categorias', COALESCE(v_categorias, '[]'::jsonb),
    'saldo', jsonb_build_object(
      'centavos', COALESCE(v_saldo.saldo_centavos, 0),
      'total_recebido_centavos', COALESCE(v_saldo.total_recebido_centavos, 0),
      'total_usado_centavos', COALESCE(v_saldo.total_usado_centavos, 0))
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.cashback_get_cliente_config TO authenticated;

CREATE OR REPLACE FUNCTION public.get_cashback_empresa_dashboard()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_empresa_id uuid;
  v_saldo_total bigint; v_creditado_mes bigint; v_usado_mes bigint; v_qtd_ativos int;
  v_clientes_ativos jsonb; v_movs_recentes jsonb;
  v_mes_inicio date := date_trunc('month', CURRENT_DATE);
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM user_profiles WHERE user_id = v_user_id LIMIT 1;
  IF v_empresa_id IS NULL THEN RETURN jsonb_build_object('erro', 'usuario_sem_empresa'); END IF;
  SELECT COALESCE(SUM(saldo_centavos), 0) INTO v_saldo_total FROM cashback_saldos WHERE empresa_id = v_empresa_id;
  SELECT COALESCE(SUM(valor_centavos), 0) INTO v_creditado_mes FROM cashback_movimentacoes
    WHERE empresa_id = v_empresa_id AND tipo = 'credito_os' AND created_at >= v_mes_inicio;
  SELECT COALESCE(SUM(valor_centavos), 0) INTO v_usado_mes FROM cashback_movimentacoes
    WHERE empresa_id = v_empresa_id AND tipo = 'debito_uso_os' AND created_at >= v_mes_inicio;
  SELECT COUNT(*) INTO v_qtd_ativos FROM cashback_clientes WHERE empresa_id = v_empresa_id AND ativo;
  SELECT jsonb_agg(jsonb_build_object(
    'cliente_id', ca.cliente_id, 'nome', c.nome, 'tipo_cliente', c.tipo_cliente, 'grupo_nome', g.nome,
    'ativo', ca.ativo, 'saldo_centavos', COALESCE(s.saldo_centavos, 0),
    'qtd_categorias', (SELECT COUNT(*) FROM cashback_taxas_categoria WHERE cliente_id = ca.cliente_id AND ativa),
    'taxas_resumo', (SELECT string_agg(categoria || ' ' || percentual || '%', ', ' ORDER BY percentual DESC)
                       FROM cashback_taxas_categoria WHERE cliente_id = ca.cliente_id AND ativa)
  ) ORDER BY COALESCE(s.saldo_centavos, 0) DESC) INTO v_clientes_ativos
    FROM cashback_clientes ca
    JOIN clientes c ON c.id = ca.cliente_id
    LEFT JOIN lojista_grupos g ON g.id = c.grupo_id
    LEFT JOIN cashback_saldos s ON s.cliente_id = ca.cliente_id
   WHERE ca.empresa_id = v_empresa_id;
  SELECT jsonb_agg(jsonb_build_object(
    'id', m.id, 'created_at', m.created_at, 'tipo', m.tipo, 'cliente_nome', c.nome,
    'valor_centavos', m.valor_centavos, 'saldo_apos_centavos', m.saldo_apos_centavos,
    'ordem_numero', os.numero, 'percentual_aplicado', m.percentual_aplicado, 'descricao', m.descricao
  ) ORDER BY m.created_at DESC) INTO v_movs_recentes
    FROM (SELECT * FROM cashback_movimentacoes WHERE empresa_id = v_empresa_id ORDER BY created_at DESC LIMIT 20) m
    JOIN clientes c ON c.id = m.cliente_id
    LEFT JOIN ordens_de_servico os ON os.id = m.ordem_id;
  RETURN jsonb_build_object('sucesso', true,
    'saldo_total_devido_centavos', v_saldo_total,
    'qtd_clientes_ativos', v_qtd_ativos,
    'creditado_mes_centavos', v_creditado_mes,
    'usado_mes_centavos', v_usado_mes,
    'clientes_ativos', COALESCE(v_clientes_ativos, '[]'::jsonb),
    'movimentacoes_recentes', COALESCE(v_movs_recentes, '[]'::jsonb),
    'gerado_em', now());
END; $$;
GRANT EXECUTE ON FUNCTION public.get_cashback_empresa_dashboard TO authenticated;

CREATE OR REPLACE FUNCTION public.get_meu_cashback()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_cliente record; v_ativacao record; v_saldo record;
  v_taxas jsonb; v_extrato jsonb; v_recebido_mes bigint; v_usado_mes bigint;
  v_mes_inicio date := date_trunc('month', CURRENT_DATE);
BEGIN
  SELECT * INTO v_cliente FROM clientes WHERE user_id = v_user_id LIMIT 1;
  IF v_cliente.id IS NULL THEN RETURN jsonb_build_object('erro', 'cliente_nao_encontrado'); END IF;
  SELECT * INTO v_ativacao FROM cashback_clientes WHERE cliente_id = v_cliente.id;
  SELECT * INTO v_saldo FROM cashback_saldos WHERE cliente_id = v_cliente.id;
  SELECT jsonb_agg(jsonb_build_object('categoria', categoria, 'percentual', percentual) ORDER BY percentual DESC)
    INTO v_taxas FROM cashback_taxas_categoria WHERE cliente_id = v_cliente.id AND ativa;
  SELECT COALESCE(SUM(valor_centavos), 0) INTO v_recebido_mes FROM cashback_movimentacoes
   WHERE cliente_id = v_cliente.id AND tipo IN ('credito_os','credito_ajuste') AND created_at >= v_mes_inicio;
  SELECT COALESCE(SUM(valor_centavos), 0) INTO v_usado_mes FROM cashback_movimentacoes
   WHERE cliente_id = v_cliente.id AND tipo IN ('debito_uso_os','debito_ajuste','debito_estorno_os') AND created_at >= v_mes_inicio;
  SELECT jsonb_agg(jsonb_build_object(
    'id', m.id, 'created_at', m.created_at, 'tipo', m.tipo,
    'valor_centavos', m.valor_centavos, 'saldo_apos_centavos', m.saldo_apos_centavos,
    'ordem_numero', os.numero, 'descricao', m.descricao, 'percentual_aplicado', m.percentual_aplicado
  ) ORDER BY m.created_at DESC) INTO v_extrato
    FROM (SELECT * FROM cashback_movimentacoes WHERE cliente_id = v_cliente.id ORDER BY created_at DESC LIMIT 30) m
    LEFT JOIN ordens_de_servico os ON os.id = m.ordem_id;
  RETURN jsonb_build_object(
    'cliente', jsonb_build_object('id', v_cliente.id, 'nome', v_cliente.nome),
    'ativo', COALESCE(v_ativacao.ativo, false),
    'saldo_centavos', COALESCE(v_saldo.saldo_centavos, 0),
    'total_recebido_centavos', COALESCE(v_saldo.total_recebido_centavos, 0),
    'total_usado_centavos', COALESCE(v_saldo.total_usado_centavos, 0),
    'recebido_mes_centavos', v_recebido_mes, 'usado_mes_centavos', v_usado_mes,
    'taxas_por_categoria', COALESCE(v_taxas, '[]'::jsonb),
    'extrato', COALESCE(v_extrato, '[]'::jsonb));
END; $$;
GRANT EXECUTE ON FUNCTION public.get_meu_cashback TO authenticated;

CREATE OR REPLACE FUNCTION public.ajustar_cashback_cliente(p_cliente_id uuid, p_valor_centavos bigint, p_justificativa text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_cliente record; v_saldo record; v_saldo_novo bigint; v_tipo text; v_mov_id uuid;
BEGIN
  IF p_valor_centavos = 0 THEN RAISE EXCEPTION 'Valor não pode ser zero'; END IF;
  IF COALESCE(trim(p_justificativa), '') = '' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id;
  IF v_cliente.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  INSERT INTO cashback_saldos (cliente_id, empresa_id, saldo_centavos)
    VALUES (p_cliente_id, v_cliente.empresa_id, 0) ON CONFLICT (cliente_id) DO NOTHING;
  SELECT * INTO v_saldo FROM cashback_saldos WHERE cliente_id = p_cliente_id;
  v_saldo_novo := v_saldo.saldo_centavos + p_valor_centavos;
  IF v_saldo_novo < 0 THEN RAISE EXCEPTION 'Saldo ficaria negativo (R$ %)', v_saldo_novo::numeric / 100; END IF;
  v_tipo := CASE WHEN p_valor_centavos > 0 THEN 'credito_ajuste' ELSE 'debito_ajuste' END;
  INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos, descricao, justificativa, created_by_user_id)
  VALUES (p_cliente_id, v_cliente.empresa_id, v_tipo, ABS(p_valor_centavos), v_saldo_novo, 'Ajuste manual', p_justificativa, v_user_id)
  RETURNING id INTO v_mov_id;
  UPDATE cashback_saldos SET saldo_centavos = v_saldo_novo,
    total_recebido_centavos = total_recebido_centavos + CASE WHEN p_valor_centavos > 0 THEN p_valor_centavos ELSE 0 END,
    total_usado_centavos = total_usado_centavos + CASE WHEN p_valor_centavos < 0 THEN ABS(p_valor_centavos) ELSE 0 END,
    ultima_movimentacao_em = now(), updated_at = now() WHERE cliente_id = p_cliente_id;
  RETURN jsonb_build_object('sucesso', true, 'saldo_novo_centavos', v_saldo_novo);
END; $$;
GRANT EXECUTE ON FUNCTION public.ajustar_cashback_cliente TO authenticated;

-- ============== TRIGGERS ==============
CREATE OR REPLACE FUNCTION public.trg_creditar_cashback_on_pronto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pronto' AND (OLD.status IS NULL OR OLD.status != 'pronto') THEN
    PERFORM creditar_cashback_os(NEW.id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_os_creditar_cashback ON public.ordens_de_servico;
CREATE TRIGGER trg_os_creditar_cashback
  AFTER UPDATE OF status ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_creditar_cashback_on_pronto();

CREATE OR REPLACE FUNCTION public.trg_estornar_cashback_on_cancelada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_credito record; v_saldo bigint; v_saldo_novo bigint;
BEGIN
  IF NEW.status = 'cancelada' AND (OLD.status IS NULL OR OLD.status != 'cancelada') THEN
    SELECT * INTO v_credito FROM cashback_movimentacoes WHERE ordem_id = NEW.id AND tipo = 'credito_os' LIMIT 1;
    IF v_credito.id IS NOT NULL THEN
      SELECT saldo_centavos INTO v_saldo FROM cashback_saldos WHERE cliente_id = v_credito.cliente_id;
      v_saldo_novo := GREATEST(v_saldo - v_credito.valor_centavos, 0);
      INSERT INTO cashback_movimentacoes (cliente_id, empresa_id, tipo, valor_centavos, saldo_apos_centavos, ordem_id, descricao, justificativa)
      VALUES (v_credito.cliente_id, v_credito.empresa_id, 'debito_estorno_os',
              v_saldo - v_saldo_novo, v_saldo_novo, NEW.id, 'Estorno automático (OS cancelada)',
              CASE WHEN v_saldo < v_credito.valor_centavos
                   THEN format('Estorno parcial: cliente tinha R$ %s, crédito original R$ %s',
                               v_saldo::numeric/100, v_credito.valor_centavos::numeric/100) ELSE NULL END);
      UPDATE cashback_saldos SET saldo_centavos = v_saldo_novo, ultima_movimentacao_em = now(), updated_at = now()
       WHERE cliente_id = v_credito.cliente_id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_os_estornar_cashback ON public.ordens_de_servico;
CREATE TRIGGER trg_os_estornar_cashback
  AFTER UPDATE OF status ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_estornar_cashback_on_cancelada();