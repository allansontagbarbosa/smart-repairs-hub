-- BLOCO A — Atualizar contas_a_pagar de maio com totais reais
UPDATE public.contas_a_pagar cap
SET valor = sub.total_real,
    observacoes = COALESCE(cap.observacoes, '') || E'\nRecalculado em ' || now()::text
FROM (
  SELECT
    f.nome,
    f.id AS funcionario_id,
    SUM(c.valor) AS total_real
  FROM public.comissoes c
  JOIN public.funcionarios f ON f.id = c.funcionario_id
  WHERE c.mes_competencia = '2026-05'
    AND c.status != 'estornada'
  GROUP BY f.id, f.nome
) sub
WHERE cap.categoria = 'Comissões'
  AND cap.data_vencimento >= '2026-05-01'
  AND cap.data_vencimento <= '2026-05-31'
  AND cap.descricao ILIKE 'COMISSÕES ' || sub.nome || '%'
  AND cap.status = 'pendente';

-- BLOCO B — Marcar comissões de abril como paga
UPDATE public.contas_a_pagar
SET status = 'paga',
    data_pagamento = '2026-05-12',
    observacoes = COALESCE(observacoes, '') || E'\nMarcado como pago via fix de sincronia (era pendente)'
WHERE categoria = 'Comissões'
  AND data_vencimento BETWEEN '2026-04-01' AND '2026-04-30'
  AND status = 'pendente'
  AND descricao IN ('COMISSÃO DANILO', 'COMISSÃO HENRIQUE ', 'COMISSÃO SAMUEL');

UPDATE public.comissoes
SET status = 'paga',
    data_pagamento = '2026-05-12'
WHERE mes_competencia = '2026-04'
  AND status = 'pendente';

-- BLOCO C — Função de sincronização
CREATE OR REPLACE FUNCTION public.sync_comissao_contas_a_pagar(
  p_funcionario_id UUID,
  p_mes_competencia TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_func_nome TEXT;
  v_total NUMERIC;
  v_qtd INT;
  v_descricao TEXT;
  v_data_vencimento DATE;
  v_existing_id UUID;
BEGIN
  SELECT f.nome, f.empresa_id INTO v_func_nome, v_empresa_id
    FROM public.funcionarios f WHERE f.id = p_funcionario_id;
  
  IF v_func_nome IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(valor), 0), COUNT(*) INTO v_total, v_qtd
    FROM public.comissoes
    WHERE funcionario_id = p_funcionario_id
      AND mes_competencia = p_mes_competencia
      AND status != 'estornada';

  v_descricao := 'COMISSÕES ' || UPPER(v_func_nome) || ' - ' || p_mes_competencia;
  v_data_vencimento := (p_mes_competencia || '-01')::date + interval '1 month' - interval '1 day';

  SELECT id INTO v_existing_id
    FROM public.contas_a_pagar
    WHERE empresa_id = v_empresa_id
      AND categoria = 'Comissões'
      AND data_vencimento = v_data_vencimento
      AND (
        descricao ILIKE 'COMISS%' || v_func_nome || '%' || p_mes_competencia || '%'
        OR descricao ILIKE 'COMISS%' || v_func_nome || '%'
      )
      AND status = 'pendente'
    ORDER BY created_at DESC
    LIMIT 1;

  IF v_total = 0 THEN
    IF v_existing_id IS NOT NULL THEN
      DELETE FROM public.contas_a_pagar WHERE id = v_existing_id;
    END IF;
    RETURN;
  END IF;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.contas_a_pagar (
      empresa_id, descricao, valor, categoria, status,
      data_vencimento, observacoes
    ) VALUES (
      v_empresa_id, v_descricao, v_total, 'Comissões', 'pendente',
      v_data_vencimento, 'Auto-sincronizado via trigger (' || v_qtd || ' serviços)'
    );
  ELSE
    UPDATE public.contas_a_pagar
      SET valor = v_total,
          updated_at = now(),
          observacoes = 'Auto-sincronizado via trigger (' || v_qtd || ' serviços)'
      WHERE id = v_existing_id;
  END IF;
END;
$$;

-- BLOCO D — Triggers
CREATE OR REPLACE FUNCTION public.trg_sync_comissao_para_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_comissao_contas_a_pagar(NEW.funcionario_id, NEW.mes_competencia);
    IF TG_OP = 'UPDATE' AND (
         OLD.funcionario_id != NEW.funcionario_id
         OR OLD.mes_competencia != NEW.mes_competencia
       ) THEN
      PERFORM public.sync_comissao_contas_a_pagar(OLD.funcionario_id, OLD.mes_competencia);
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_comissao_contas_a_pagar(OLD.funcionario_id, OLD.mes_competencia);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_comissao_para_cap ON public.comissoes;
CREATE TRIGGER trg_sync_comissao_para_cap
  AFTER INSERT OR UPDATE OR DELETE ON public.comissoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_comissao_para_cap();

CREATE OR REPLACE FUNCTION public.trg_sync_cap_comissoes_paga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        data_pagamento = COALESCE(NEW.data_pagamento, current_date)
    WHERE funcionario_id = v_func_id
      AND mes_competencia = v_mes
      AND status = 'pendente';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cap_comissoes_paga ON public.contas_a_pagar;
CREATE TRIGGER trg_sync_cap_comissoes_paga
  AFTER UPDATE OF status ON public.contas_a_pagar
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_cap_comissoes_paga();

-- Recalc maio inteiro
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT funcionario_id, mes_competencia
      FROM public.comissoes
      WHERE mes_competencia = '2026-05'
        AND status != 'estornada'
  LOOP
    PERFORM public.sync_comissao_contas_a_pagar(r.funcionario_id, r.mes_competencia);
  END LOOP;
END$$;