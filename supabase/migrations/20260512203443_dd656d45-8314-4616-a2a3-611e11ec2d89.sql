-- PARTE 1: Schema
ALTER TABLE notificacoes 
  ADD COLUMN IF NOT EXISTS severidade text DEFAULT 'info' CHECK (severidade IN ('info', 'warning', 'critical', 'success'));

ALTER TABLE notificacoes 
  ADD COLUMN IF NOT EXISTS link text;

ALTER TABLE notificacoes 
  ADD COLUMN IF NOT EXISTS arquivada_em timestamptz;

ALTER TABLE notificacoes 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_notificacoes_empresa_lida 
  ON notificacoes(empresa_id, lida, created_at DESC) 
  WHERE arquivada_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo 
  ON notificacoes(empresa_id, tipo, created_at DESC);

CREATE OR REPLACE FUNCTION public.criar_notificacao_unica(
  p_empresa_id uuid,
  p_tipo text,
  p_titulo text,
  p_mensagem text,
  p_severidade text DEFAULT 'info',
  p_referencia_id uuid DEFAULT NULL,
  p_referencia_tabela text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_dedupe_hours int DEFAULT 24
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_referencia_id IS NOT NULL AND p_dedupe_hours > 0 THEN
    IF EXISTS (
      SELECT 1 FROM notificacoes 
      WHERE empresa_id = p_empresa_id 
        AND tipo = p_tipo 
        AND referencia_id = p_referencia_id
        AND created_at > now() - (p_dedupe_hours || ' hours')::interval
    ) THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO notificacoes (
    empresa_id, tipo, titulo, mensagem, severidade,
    referencia_id, referencia_tabela, link, lida
  ) VALUES (
    p_empresa_id, p_tipo, p_titulo, p_mensagem, p_severidade,
    p_referencia_id, p_referencia_tabela, p_link, false
  ) RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- PARTE 2: Triggers
CREATE OR REPLACE FUNCTION public.notif_prejuizo_criado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM criar_notificacao_unica(
    p_empresa_id := NEW.empresa_id,
    p_tipo := 'prejuizo_criado',
    p_titulo := 'Novo prejuízo registrado',
    p_mensagem := 'Prejuízo de R$ ' || (NEW.valor_centavos / 100.0)::text || 
                  CASE WHEN NEW.tipo IS NOT NULL THEN ' (' || NEW.tipo::text || ')' ELSE '' END,
    p_severidade := 'critical',
    p_referencia_id := NEW.id,
    p_referencia_tabela := 'prejuizos',
    p_link := '/financeiro?tab=prejuizos',
    p_dedupe_hours := 1
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_prejuizo ON prejuizos;
CREATE TRIGGER trg_notif_prejuizo
  AFTER INSERT ON prejuizos
  FOR EACH ROW EXECUTE FUNCTION notif_prejuizo_criado();

CREATE OR REPLACE FUNCTION public.notif_pagamento_conta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conta_desc text;
BEGIN
  SELECT descricao INTO v_conta_desc 
  FROM contas_a_pagar WHERE id = NEW.conta_pagar_id;
  
  PERFORM criar_notificacao_unica(
    p_empresa_id := NEW.empresa_id,
    p_tipo := 'pagamento_registrado',
    p_titulo := 'Pagamento registrado',
    p_mensagem := COALESCE(v_conta_desc, 'Conta') || ' — R$ ' || (NEW.valor_centavos / 100.0)::text ||
                  ' via ' || NEW.forma_pagamento::text,
    p_severidade := 'success',
    p_referencia_id := NEW.id,
    p_referencia_tabela := 'contas_pagar_pagamentos',
    p_link := '/financeiro',
    p_dedupe_hours := 0
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_pagamento ON contas_pagar_pagamentos;
CREATE TRIGGER trg_notif_pagamento
  AFTER INSERT ON contas_pagar_pagamentos
  FOR EACH ROW EXECUTE FUNCTION notif_pagamento_conta();

CREATE OR REPLACE FUNCTION public.notif_comissao_criada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_func_nome text;
BEGIN
  IF NEW.valor < 200 THEN RETURN NEW; END IF;
  
  SELECT nome INTO v_func_nome 
  FROM funcionarios WHERE id = NEW.funcionario_id;
  
  PERFORM criar_notificacao_unica(
    p_empresa_id := NEW.empresa_id,
    p_tipo := 'comissao_alta',
    p_titulo := 'Comissão alta gerada',
    p_mensagem := 'Comissão de R$ ' || NEW.valor::text || ' para ' || COALESCE(v_func_nome, 'funcionário'),
    p_severidade := 'info',
    p_referencia_id := NEW.id,
    p_referencia_tabela := 'comissoes',
    p_link := '/financeiro?tab=comissoes',
    p_dedupe_hours := 0
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_comissao ON comissoes;
CREATE TRIGGER trg_notif_comissao
  AFTER INSERT ON comissoes
  FOR EACH ROW EXECUTE FUNCTION notif_comissao_criada();

CREATE OR REPLACE FUNCTION public.notif_saldo_lojista_alto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_cliente_nome text;
  v_cliente_tipo text;
  v_saldo numeric;
BEGIN
  IF NEW.status::text != 'entregue' OR OLD.status::text = 'entregue' THEN RETURN NEW; END IF;
  
  SELECT a.cliente_id, c.nome, c.tipo_cliente::text INTO v_cliente_id, v_cliente_nome, v_cliente_tipo
  FROM aparelhos a 
  JOIN clientes c ON c.id = a.cliente_id
  WHERE a.id = NEW.aparelho_id;
  
  IF v_cliente_tipo IS NULL OR v_cliente_tipo != 'lojista_b2b' THEN RETURN NEW; END IF;
  
  SELECT COALESCE(SUM(COALESCE(o.valor_total, o.valor, 0) - COALESCE(o.valor_pago, 0)), 0)
  INTO v_saldo
  FROM ordens_de_servico o
  JOIN aparelhos a ON a.id = o.aparelho_id
  WHERE a.cliente_id = v_cliente_id
    AND o.status::text = 'entregue'
    AND o.deleted_at IS NULL;
  
  IF v_saldo >= 5000 THEN
    PERFORM criar_notificacao_unica(
      p_empresa_id := NEW.empresa_id,
      p_tipo := 'saldo_lojista_alto',
      p_titulo := 'Lojista com saldo alto',
      p_mensagem := v_cliente_nome || ' deve R$ ' || v_saldo::text || ' — considere cobrar',
      p_severidade := 'warning',
      p_referencia_id := v_cliente_id,
      p_referencia_tabela := 'clientes',
      p_link := '/financeiro?tab=saldo-clientes',
      p_dedupe_hours := 48
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_saldo_lojista ON ordens_de_servico;
CREATE TRIGGER trg_notif_saldo_lojista
  AFTER UPDATE OF status ON ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION notif_saldo_lojista_alto();

-- PARTE 3: RPCs periódicas + ações
CREATE OR REPLACE FUNCTION public.processar_notificacoes_diarias()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_total int := 0;
  v_conta record;
  v_os record;
  v_peca record;
  v_func record;
  v_competencia_atual text;
  v_qtd_atrasadas int;
  v_total_atrasado numeric;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
  
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  FOR v_conta IN
    SELECT id, descricao, valor, data_vencimento
    FROM contas_a_pagar
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND status::text IN ('pendente', 'parcial')
      AND data_vencimento = CURRENT_DATE
  LOOP
    IF (SELECT criar_notificacao_unica(
      v_empresa_id, 'conta_vence_hoje',
      'Conta vence HOJE',
      v_conta.descricao || ' — R$ ' || v_conta.valor::text,
      'critical', v_conta.id, 'contas_a_pagar',
      '/financeiro?tab=contas', 24
    )) IS NOT NULL THEN
      v_total := v_total + 1;
    END IF;
  END LOOP;

  FOR v_conta IN
    SELECT id, descricao, valor, data_vencimento
    FROM contas_a_pagar
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND status::text IN ('pendente', 'parcial')
      AND data_vencimento = CURRENT_DATE + 1
  LOOP
    IF (SELECT criar_notificacao_unica(
      v_empresa_id, 'conta_vence_amanha',
      'Conta vence amanhã',
      v_conta.descricao || ' — R$ ' || v_conta.valor::text,
      'warning', v_conta.id, 'contas_a_pagar',
      '/financeiro?tab=contas', 24
    )) IS NOT NULL THEN
      v_total := v_total + 1;
    END IF;
  END LOOP;

  SELECT COUNT(*), COALESCE(SUM(valor - COALESCE(valor_pago_centavos, 0)/100.0), 0)
  INTO v_qtd_atrasadas, v_total_atrasado
  FROM contas_a_pagar
  WHERE empresa_id = v_empresa_id
    AND deleted_at IS NULL
    AND status::text IN ('pendente', 'parcial')
    AND data_vencimento < CURRENT_DATE;
  
  IF v_qtd_atrasadas > 0 THEN
    IF (SELECT criar_notificacao_unica(
      v_empresa_id, 'contas_atrasadas',
      v_qtd_atrasadas::text || ' contas atrasadas',
      'Total atrasado: R$ ' || v_total_atrasado::text,
      'critical', NULL, NULL,
      '/financeiro?tab=contas', 24
    )) IS NOT NULL THEN
      v_total := v_total + 1;
    END IF;
  END IF;

  FOR v_os IN
    SELECT o.id, o.numero, c.nome AS cliente_nome
    FROM ordens_de_servico o
    JOIN aparelhos a ON a.id = o.aparelho_id
    JOIN clientes c ON c.id = a.cliente_id
    WHERE o.empresa_id = v_empresa_id
      AND o.deleted_at IS NULL
      AND o.status::text IN ('pronto', 'aguardando_retirada')
      AND o.data_pronto IS NOT NULL
      AND o.data_pronto < CURRENT_DATE - interval '7 days'
    LIMIT 50
  LOOP
    IF (SELECT criar_notificacao_unica(
      v_empresa_id, 'os_parada',
      'OS #' || v_os.numero::text || ' pronta há 7+ dias',
      'Cliente ' || COALESCE(v_os.cliente_nome, 'sem nome') || ' não retirou. Risco de prejuízo.',
      'warning', v_os.id, 'ordens_de_servico',
      '/assistencia/' || v_os.id::text, 72
    )) IS NOT NULL THEN
      v_total := v_total + 1;
    END IF;
  END LOOP;

  FOR v_peca IN
    SELECT id, nome_personalizado, quantidade, quantidade_minima
    FROM estoque_itens
    WHERE empresa_id = v_empresa_id
      AND deleted_at IS NULL
      AND quantidade <= quantidade_minima
      AND quantidade_minima > 0
    LIMIT 30
  LOOP
    IF (SELECT criar_notificacao_unica(
      v_empresa_id, 'estoque_baixo',
      'Estoque baixo: ' || COALESCE(v_peca.nome_personalizado, 'peça'),
      'Em estoque: ' || v_peca.quantidade::text || ' / Mínimo: ' || v_peca.quantidade_minima::text,
      'warning', v_peca.id, 'estoque_itens',
      '/pecas', 72
    )) IS NOT NULL THEN
      v_total := v_total + 1;
    END IF;
  END LOOP;

  IF EXTRACT(DAY FROM CURRENT_DATE) >= 25 THEN
    v_competencia_atual := to_char(CURRENT_DATE, 'YYYY-MM');
    IF NOT EXISTS (
      SELECT 1 FROM contas_a_pagar
      WHERE empresa_id = v_empresa_id
        AND mes_competencia = v_competencia_atual
        AND categoria = 'Salários'
        AND deleted_at IS NULL
    ) THEN
      IF (SELECT criar_notificacao_unica(
        v_empresa_id, 'folha_nao_gerada',
        'Folha de ' || v_competencia_atual || ' não foi gerada',
        'Gera a folha do RH antes do fim do mês',
        'warning', NULL, NULL,
        '/rh', 24
      )) IS NOT NULL THEN
        v_total := v_total + 1;
      END IF;
    END IF;
  END IF;

  FOR v_func IN
    SELECT f.id, f.nome, COUNT(*) AS qtd_faltas
    FROM funcionarios f
    JOIN funcionario_movimentacoes m ON m.funcionario_id = f.id
    WHERE f.empresa_id = v_empresa_id
      AND f.deleted_at IS NULL
      AND f.eh_funcionario_rh = true
      AND m.tipo::text = 'falta'
      AND m.competencia_ano_mes = to_char(CURRENT_DATE, 'YYYY-MM')
      AND m.estornada_em IS NULL
    GROUP BY f.id, f.nome
    HAVING COUNT(*) >= 3
  LOOP
    IF (SELECT criar_notificacao_unica(
      v_empresa_id, 'faltas_funcionario',
      v_func.nome || ' com ' || v_func.qtd_faltas::text || ' faltas',
      'Verifique se há algum problema com o funcionário',
      'warning', v_func.id, 'funcionarios',
      '/rh/' || v_func.id::text, 168
    )) IS NOT NULL THEN
      v_total := v_total + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'notificacoes_criadas', v_total,
    'processado_em', now()
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.processar_notificacoes_diarias() TO authenticated;

CREATE OR REPLACE FUNCTION public.marcar_notificacao(
  p_notif_id uuid,
  p_acao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
  
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  IF p_acao = 'lida' THEN
    UPDATE notificacoes SET lida = true 
    WHERE id = p_notif_id AND empresa_id = v_empresa_id;
  ELSIF p_acao = 'nao_lida' THEN
    UPDATE notificacoes SET lida = false 
    WHERE id = p_notif_id AND empresa_id = v_empresa_id;
  ELSIF p_acao = 'arquivar' THEN
    UPDATE notificacoes SET arquivada_em = now(), lida = true
    WHERE id = p_notif_id AND empresa_id = v_empresa_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Ação inválida');
  END IF;
  
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_notificacao(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.marcar_todas_notificacoes_lidas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_count int;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
  
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  UPDATE notificacoes SET lida = true 
  WHERE empresa_id = v_empresa_id 
    AND lida = false 
    AND arquivada_em IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN jsonb_build_object('success', true, 'marcadas', v_count);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_todas_notificacoes_lidas() TO authenticated;