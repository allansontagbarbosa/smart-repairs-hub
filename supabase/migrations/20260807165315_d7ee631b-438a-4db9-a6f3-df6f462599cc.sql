-- 1) Rotina de sincronização: comissões pagas -> conta a pagar de comissões
CREATE OR REPLACE FUNCTION public.sync_status_conta_comissoes(p_funcionario_id uuid, p_mes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nome text;
  v_empresa uuid;
  v_conta record;
  v_pago numeric := 0;
  v_data_pgto date;
  v_total_cent bigint;
  v_pago_cent bigint;
  v_status text;
BEGIN
  IF p_funcionario_id IS NULL OR p_mes IS NULL THEN RETURN; END IF;

  SELECT nome, empresa_id INTO v_nome, v_empresa
  FROM public.funcionarios WHERE id = p_funcionario_id;
  IF v_nome IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(valor), 0), MAX(data_pagamento)::date
    INTO v_pago, v_data_pgto
  FROM public.comissoes
  WHERE funcionario_id = p_funcionario_id
    AND mes_competencia = p_mes
    AND estornada_em IS NULL
    AND status = 'paga';

  SELECT * INTO v_conta
  FROM public.contas_a_pagar c
  WHERE c.empresa_id = v_empresa
    AND c.deleted_at IS NULL
    AND c.categoria = 'Comissões'
    AND c.status <> 'cancelada'
    AND c.descricao ILIKE '%' || v_nome || '%'
    AND (c.mes_competencia = p_mes OR c.descricao ILIKE '%' || p_mes || '%'
         OR to_char(c.data_vencimento, 'YYYY-MM') = p_mes)
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_conta.id IS NULL THEN RETURN; END IF;

  -- Não mexer em contas com pagamentos manuais registrados (fluxo de baixa próprio)
  IF EXISTS (
    SELECT 1 FROM public.contas_pagar_pagamentos
    WHERE conta_pagar_id = v_conta.id AND estornado_em IS NULL
  ) THEN
    RETURN;
  END IF;

  v_total_cent := round(v_conta.valor * 100)::bigint;
  v_pago_cent := LEAST(round(v_pago * 100)::bigint, v_total_cent);

  IF v_pago_cent <= 0 THEN
    v_status := 'pendente';
  ELSIF v_pago_cent >= v_total_cent THEN
    v_status := 'paga';
  ELSE
    v_status := 'parcial';
  END IF;

  IF v_conta.status::text = v_status
     AND COALESCE(v_conta.valor_pago_centavos, 0) = v_pago_cent
     AND (v_status <> 'paga' OR v_conta.data_pagamento IS NOT NULL) THEN
    RETURN;
  END IF;

  UPDATE public.contas_a_pagar SET
    status = v_status::status_conta,
    valor_pago_centavos = v_pago_cent,
    data_pagamento = CASE
      WHEN v_status = 'paga' THEN COALESCE(v_data_pgto, data_pagamento, CURRENT_DATE)
      WHEN v_status = 'pendente' THEN NULL
      ELSE data_pagamento
    END,
    updated_at = now()
  WHERE id = v_conta.id;
END;
$function$;

-- 2) pagar_comissao passa a sincronizar a conta a pagar
CREATE OR REPLACE FUNCTION public.pagar_comissao(p_comissao_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_role text;
  v_empresa_id uuid;
  v_comissao record;
  v_funcionario_nome text;
BEGIN
  SELECT pa.nome_perfil, up.empresa_id INTO v_user_role, v_empresa_id
  FROM public.user_profiles up
  LEFT JOIN public.perfis_acesso pa ON pa.id = up.perfil_id
  WHERE up.user_id = auth.uid()
  LIMIT 1;

  IF COALESCE(v_user_role,'') NOT IN ('Administrador', 'Gerente', 'Financeiro', 'Sócio', 'Socio')
     AND NOT public.is_adm_ou_socio() THEN
    RETURN json_build_object('success', false, 'error', 'Sem permissão para pagar comissão');
  END IF;

  SELECT * INTO v_comissao
  FROM public.comissoes
  WHERE id = p_comissao_id AND empresa_id = v_empresa_id;

  IF v_comissao IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Comissão não encontrada');
  END IF;

  IF v_comissao.estornada_em IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Comissão estornada não pode ser paga');
  END IF;

  IF v_comissao.status::text NOT IN ('pendente', 'liberada') THEN
    RETURN json_build_object('success', false, 'error', 'Comissão já está paga ou em estado inválido');
  END IF;

  SELECT nome INTO v_funcionario_nome
  FROM public.funcionarios
  WHERE id = v_comissao.funcionario_id;

  UPDATE public.comissoes
  SET status = 'paga'::public.status_comissao,
      data_pagamento = now(),
      updated_at = now()
  WHERE id = p_comissao_id;

  INSERT INTO public.movimentacoes_financeiras (
    tipo, valor, descricao, ordem_id, data, empresa_id
  ) VALUES (
    'saida'::public.tipo_movimentacao,
    v_comissao.valor,
    'Comissão paga: ' || COALESCE(v_funcionario_nome, 'sem nome'),
    v_comissao.ordem_id,
    now(),
    v_empresa_id
  );

  PERFORM public.sync_status_conta_comissoes(v_comissao.funcionario_id, v_comissao.mes_competencia);

  RETURN json_build_object('success', true, 'valor_pago', v_comissao.valor);
END;
$function$;

-- 3) Conta de comissões paga also quita comissões liberadas
CREATE OR REPLACE FUNCTION public.trg_sync_cap_comissoes_paga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_func_id UUID;
  v_mes TEXT;
BEGIN
  IF NEW.categoria != 'Comissões' THEN RETURN NEW; END IF;
  IF NEW.status != 'paga' THEN RETURN NEW; END IF;
  IF OLD.status = 'paga' THEN RETURN NEW; END IF;

  v_mes := substring(NEW.descricao FROM '(\d{4}-\d{2})$');
  IF v_mes IS NULL THEN
    v_mes := to_char(NEW.data_vencimento, 'YYYY-MM');
  END IF;

  SELECT f.id INTO v_func_id
    FROM public.funcionarios f
    WHERE f.empresa_id = NEW.empresa_id
      AND NEW.descricao ILIKE '%' || f.nome || '%'
      AND f.deleted_at IS NULL
    ORDER BY length(f.nome) DESC
    LIMIT 1;

  IF v_func_id IS NULL THEN
    RAISE WARNING 'Não foi possível identificar funcionário na conta % (id=%)', NEW.descricao, NEW.id;
    RETURN NEW;
  END IF;

  UPDATE public.comissoes
    SET status = 'paga',
        data_pagamento = COALESCE(NEW.data_pagamento, current_date),
        updated_at = now()
    WHERE funcionario_id = v_func_id
      AND mes_competencia = v_mes
      AND estornada_em IS NULL
      AND status IN ('pendente', 'liberada');

  RETURN NEW;
END;
$function$;

-- 4) Arredondamento correto de centavos no pagamento/estorno de contas
CREATE OR REPLACE FUNCTION public.registrar_pagamento_conta(p_conta_pagar_id uuid, p_valor_centavos bigint, p_forma_pagamento text, p_data_pagamento date DEFAULT CURRENT_DATE, p_observacao text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_conta record;
  v_pagamento_id uuid;
  v_movimentacao_id uuid;
  v_valor_total_centavos bigint;
  v_valor_pago_atual bigint;
  v_novo_valor_pago bigint;
  v_novo_status text;
BEGIN
  v_empresa_id := get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  IF p_valor_centavos <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor deve ser > 0');
  END IF;

  IF p_forma_pagamento NOT IN ('pix', 'dinheiro', 'cartao', 'transferencia') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forma de pagamento inválida');
  END IF;

  SELECT * INTO v_conta FROM contas_a_pagar
  WHERE id = p_conta_pagar_id AND empresa_id = v_empresa_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_conta IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta não encontrada');
  END IF;

  IF v_conta.status = 'cancelada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta cancelada não pode receber pagamento');
  END IF;

  v_valor_total_centavos := round(v_conta.valor * 100)::bigint;
  v_valor_pago_atual := COALESCE(v_conta.valor_pago_centavos, 0);
  v_novo_valor_pago := v_valor_pago_atual + p_valor_centavos;

  IF v_novo_valor_pago > v_valor_total_centavos THEN
    RETURN jsonb_build_object('success', false,
      'error', format('Pagamento ultrapassa o pendente (R$ %s)',
        ((v_valor_total_centavos - v_valor_pago_atual)/100.0)::text));
  END IF;

  IF v_novo_valor_pago >= v_valor_total_centavos THEN
    v_novo_status := 'paga';
  ELSE
    v_novo_status := 'parcial';
  END IF;

  INSERT INTO movimentacoes_financeiras (
    empresa_id, tipo, valor, data, descricao, forma_pagamento, categoria
  ) VALUES (
    v_empresa_id, 'saida', p_valor_centavos / 100.0,
    (p_data_pagamento::timestamptz),
    'Pgto: ' || v_conta.descricao ||
      CASE WHEN v_novo_status = 'parcial' THEN ' (parcial)' ELSE '' END,
    p_forma_pagamento, COALESCE(v_conta.categoria, 'Outros')
  ) RETURNING id INTO v_movimentacao_id;

  INSERT INTO contas_pagar_pagamentos (
    empresa_id, conta_pagar_id, valor_centavos, data_pagamento,
    forma_pagamento, observacao, movimentacao_id
  ) VALUES (
    v_empresa_id, p_conta_pagar_id, p_valor_centavos, p_data_pagamento,
    p_forma_pagamento::forma_pagamento_conta, p_observacao, v_movimentacao_id
  ) RETURNING id INTO v_pagamento_id;

  UPDATE contas_a_pagar SET
    valor_pago_centavos = v_novo_valor_pago,
    status = v_novo_status::status_conta,
    data_pagamento = CASE WHEN v_novo_status = 'paga' THEN p_data_pagamento ELSE data_pagamento END,
    updated_at = now()
  WHERE id = p_conta_pagar_id;

  RETURN jsonb_build_object(
    'success', true,
    'pagamento_id', v_pagamento_id,
    'movimentacao_id', v_movimentacao_id,
    'valor_pago_centavos', v_novo_valor_pago,
    'valor_restante_centavos', v_valor_total_centavos - v_novo_valor_pago,
    'novo_status', v_novo_status
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.estornar_pagamento_conta(p_pagamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_pgto record;
  v_conta record;
  v_novo_valor_pago bigint;
  v_novo_status text;
BEGIN
  v_empresa_id := get_my_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT * INTO v_pgto FROM contas_pagar_pagamentos
  WHERE id = p_pagamento_id AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF v_pgto IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pagamento não encontrado');
  END IF;

  IF v_pgto.estornado_em IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pagamento já estornado');
  END IF;

  SELECT * INTO v_conta FROM contas_a_pagar
  WHERE id = v_pgto.conta_pagar_id FOR UPDATE;

  v_novo_valor_pago := GREATEST(COALESCE(v_conta.valor_pago_centavos,0) - v_pgto.valor_centavos, 0);

  IF v_novo_valor_pago = 0 THEN
    v_novo_status := 'pendente';
  ELSIF v_novo_valor_pago < round(v_conta.valor * 100)::bigint THEN
    v_novo_status := 'parcial';
  ELSE
    v_novo_status := 'paga';
  END IF;

  UPDATE contas_a_pagar SET
    valor_pago_centavos = v_novo_valor_pago,
    status = v_novo_status::status_conta,
    data_pagamento = CASE WHEN v_novo_status = 'paga' THEN data_pagamento ELSE NULL END,
    updated_at = now()
  WHERE id = v_pgto.conta_pagar_id;

  UPDATE contas_pagar_pagamentos SET
    estornado_em = now(),
    estornado_por = auth.uid()
  WHERE id = p_pagamento_id;

  IF v_pgto.movimentacao_id IS NOT NULL THEN
    UPDATE movimentacoes_financeiras
    SET estornada_em = now()
    WHERE id = v_pgto.movimentacao_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'novo_status', v_novo_status);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- 5) Prejuízo: conta criada como paga precisa de data_pagamento e valor pago
CREATE OR REPLACE FUNCTION public.criar_conta_pagar_prejuizo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      data_vencimento, data_pagamento, status, valor_pago_centavos,
      mes_competencia, recorrente, observacoes
    ) VALUES (
      NEW.empresa_id,
      v_descricao,
      NEW.valor_centavos / 100.0,
      'Prejuízos',
      'Operacional',
      v_data_vencimento,
      v_data_vencimento,
      'paga',
      NEW.valor_centavos,
      v_competencia,
      false,
      'Prejuízo registrado automaticamente. ID: ' || NEW.id::text
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;