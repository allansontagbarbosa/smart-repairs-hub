-- 0) Regra do portal não deve bloquear rotinas internas (sem usuário logado / service_role)
CREATE OR REPLACE FUNCTION public.restrict_portal_os_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_internal_user(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.lojista_usuarios WHERE user_id = auth.uid() AND ativo = true) THEN
    RETURN NEW;
  END IF;

  IF NEW.valor IS DISTINCT FROM OLD.valor
     OR NEW.desconto IS DISTINCT FROM OLD.desconto
     OR NEW.valor_total IS DISTINCT FROM OLD.valor_total
     OR NEW.valor_pago IS DISTINCT FROM OLD.valor_pago
     OR NEW.valor_pendente IS DISTINCT FROM OLD.valor_pendente
     OR NEW.custo_pecas IS DISTINCT FROM OLD.custo_pecas
     OR NEW.custo_mao_de_obra IS DISTINCT FROM OLD.custo_mao_de_obra
     OR NEW.custo_total IS DISTINCT FROM OLD.custo_total
     OR NEW.lucro_bruto IS DISTINCT FROM OLD.lucro_bruto
     OR NEW.margem_calculada IS DISTINCT FROM OLD.margem_calculada
     OR NEW.tecnico_responsavel_id IS DISTINCT FROM OLD.tecnico_responsavel_id
     OR NEW.tecnico IS DISTINCT FROM OLD.tecnico
     OR NEW.funcionario_id IS DISTINCT FROM OLD.funcionario_id
     OR NEW.diagnostico IS DISTINCT FROM OLD.diagnostico
     OR NEW.servico_realizado IS DISTINCT FROM OLD.servico_realizado
     OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
     OR NEW.aparelho_id IS DISTINCT FROM OLD.aparelho_id
     OR NEW.numero IS DISTINCT FROM OLD.numero
     OR NEW.numero_formatado IS DISTINCT FROM OLD.numero_formatado
     OR NEW.loja_id IS DISTINCT FROM OLD.loja_id
     OR NEW.lojista_id IS DISTINCT FROM OLD.lojista_id
     OR NEW.fatura_id IS DISTINCT FROM OLD.fatura_id
     OR NEW.tipo_servico IS DISTINCT FROM OLD.tipo_servico
     OR NEW.tipo_servico_id IS DISTINCT FROM OLD.tipo_servico_id
     OR NEW.forma_pagamento_id IS DISTINCT FROM OLD.forma_pagamento_id
     OR NEW.forma_pagamento_sinal IS DISTINCT FROM OLD.forma_pagamento_sinal
     OR NEW.sinal_pago IS DISTINCT FROM OLD.sinal_pago
     OR NEW.garantia_dias IS DISTINCT FROM OLD.garantia_dias
     OR NEW.prioridade IS DISTINCT FROM OLD.prioridade
     OR NEW.previsao_entrega IS DISTINCT FROM OLD.previsao_entrega
     OR NEW.data_entrega IS DISTINCT FROM OLD.data_entrega
     OR NEW.data_conclusao IS DISTINCT FROM OLD.data_conclusao
     OR NEW.cancelada_em IS DISTINCT FROM OLD.cancelada_em
     OR NEW.cancelada_por IS DISTINCT FROM OLD.cancelada_por
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.aprovado_no_ato IS DISTINCT FROM OLD.aprovado_no_ato
     OR NEW.retrabalho IS DISTINCT FROM OLD.retrabalho
     OR NEW.eh_retroativa IS DISTINCT FROM OLD.eh_retroativa
  THEN
    RAISE EXCEPTION 'Portal clients are not allowed to modify these fields on ordens_de_servico';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status <> 'aguardando_aprovacao'
       OR NEW.status NOT IN ('aprovado', 'recebido') THEN
      RAISE EXCEPTION 'Portal clients may only approve or reject a pending budget';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 1) Remove trigger que sobrescrevia lucro_bruto ignorando comissão/terceirizado
DROP TRIGGER IF EXISTS trg_os_atualizar_lucro_bruto ON public.ordens_de_servico;

-- 2) Recalculo de totais considerando custo terceirizado dos serviços
CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_ordem_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subtotal_servicos numeric := 0;
  v_subtotal_pecas numeric := 0;
  v_custo_pecas numeric := 0;
  v_comissao_servicos_tabela numeric := 0;
  v_mao_obra_adicional numeric := 0;
  v_desconto numeric := 0;
  v_valor_total numeric := 0;
  v_custo_total numeric := 0;
  v_lucro_bruto numeric := 0;
  v_valor_cobrado numeric := 0;
  v_count_servicos int := 0;
  v_count_pecas int := 0;
  v_custo_mao_obra numeric := 0;
  v_custo_terceiros numeric := 0;
  v_terc_servicos numeric := 0;
  v_terc_modulo numeric := 0;
  v_margem numeric := 0;
BEGIN
  SELECT COALESCE(SUM(valor), 0),
         COALESCE(SUM(CASE WHEN tecnico_id IS NOT NULL THEN COALESCE(comissao, 0) ELSE 0 END), 0),
         COUNT(*),
         COALESCE(SUM(CASE WHEN motivo_sem_tecnico = 'terceirizado' THEN COALESCE(valor_terceirizado, 0) ELSE 0 END), 0)
    INTO v_subtotal_servicos, v_comissao_servicos_tabela, v_count_servicos, v_terc_servicos
    FROM public.os_servicos WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(SUM(preco_unitario * quantidade), 0),
         COALESCE(SUM(custo_unitario * quantidade), 0),
         COUNT(*)
    INTO v_subtotal_pecas, v_custo_pecas, v_count_pecas
    FROM public.pecas_utilizadas WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(SUM(COALESCE(custo_final, custo)), 0)
    INTO v_terc_modulo
    FROM public.assistencia_terceirizacoes
    WHERE os_id = p_ordem_id AND status <> 'cancelado';

  -- Evita contagem dupla quando o mesmo serviço terceirizado também possui
  -- registro no módulo de terceirização: considera o maior dos dois.
  v_custo_terceiros := GREATEST(v_terc_servicos, v_terc_modulo);

  SELECT COALESCE(mao_obra_adicional, 0), COALESCE(desconto, 0), COALESCE(valor, 0)
    INTO v_mao_obra_adicional, v_desconto, v_valor_cobrado
    FROM public.ordens_de_servico WHERE id = p_ordem_id;

  IF v_count_servicos = 0 AND v_mao_obra_adicional = 0 AND v_valor_cobrado > 0 THEN
    v_valor_total := v_valor_cobrado - v_desconto;
  ELSE
    v_valor_total := v_subtotal_servicos + v_mao_obra_adicional - v_desconto;
  END IF;

  v_custo_mao_obra := v_comissao_servicos_tabela;
  v_custo_total := v_custo_pecas + v_custo_mao_obra + v_custo_terceiros;
  v_lucro_bruto := v_valor_total - v_custo_total;

  IF v_valor_total > 0 THEN
    v_margem := (v_lucro_bruto / v_valor_total) * 100;
  END IF;

  UPDATE public.ordens_de_servico
    SET valor_total = v_valor_total,
        valor_total_servicos = v_subtotal_servicos,
        valor_total_pecas = v_subtotal_pecas,
        custo_pecas = v_custo_pecas,
        custo_mao_de_obra = v_custo_mao_obra,
        custo_total = v_custo_total,
        lucro_bruto = v_lucro_bruto,
        margem_calculada = v_margem
    WHERE id = p_ordem_id;
END;
$function$;

-- 3) Comissão do serviço: sincroniza valor quando a comissão é editada
CREATE OR REPLACE FUNCTION public.gerar_comissao_por_servico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_valor numeric := 0;
  v_comissao_padrao numeric := 0;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status::text = 'concluido'
     AND (
       NEW.status::text IS DISTINCT FROM 'concluido'
       OR NEW.tecnico_id IS DISTINCT FROM OLD.tecnico_id
     ) THEN
    UPDATE public.comissoes
    SET status = 'estornada', estornada_em = now()
    WHERE os_servico_id = NEW.id
      AND estornada_em IS NULL;
  END IF;

  IF NEW.status::text = 'concluido' AND NEW.tecnico_id IS NOT NULL THEN
    IF COALESCE(NEW.comissao, 0) > 0 THEN
      v_valor := NEW.comissao;
    ELSE
      SELECT COALESCE(ts.comissao_padrao, 0)
      INTO v_comissao_padrao
      FROM public.tipos_servico ts
      WHERE ts.id = NEW.servico_id;

      v_valor := COALESCE(v_comissao_padrao, 0);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.comissoes c
      WHERE c.os_servico_id = NEW.id
        AND c.estornada_em IS NULL
    ) THEN
      INSERT INTO public.comissoes (
        funcionario_id, ordem_id, os_servico_id, valor, valor_base,
        status, tipo, mes_competencia, empresa_id, observacoes
      ) VALUES (
        NEW.tecnico_id, NEW.ordem_id, NEW.id, v_valor, v_valor,
        'pendente', 'fixa',
        to_char(COALESCE(NEW.concluido_em, now()), 'YYYY-MM'),
        NEW.empresa_id,
        'Serviço: ' || COALESCE(NEW.nome, NEW.id::text)
      );
    ELSE
      UPDATE public.comissoes
      SET valor = v_valor,
          valor_base = v_valor,
          funcionario_id = NEW.tecnico_id,
          updated_at = now()
      WHERE os_servico_id = NEW.id
        AND estornada_em IS NULL
        AND status IN ('pendente', 'liberada')
        AND (valor IS DISTINCT FROM v_valor OR funcionario_id IS DISTINCT FROM NEW.tecnico_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Backfill: recalcula todas as OS ativas
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.ordens_de_servico WHERE deleted_at IS NULL LOOP
    PERFORM public.recalcular_totais_os(r.id);
  END LOOP;
END $$;