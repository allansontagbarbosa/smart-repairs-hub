
-- ============================================================
-- RH-FIN-SYNC-02: Financeiro é a fonte da verdade
-- ============================================================

-- Helper: mapeia status_conta (financeiro) -> status_movimentacao_func (RH)
CREATE OR REPLACE FUNCTION public._map_status_conta_to_rh(p_status public.status_conta)
RETURNS public.status_movimentacao_func
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_status
    WHEN 'paga'      THEN 'pago'::public.status_movimentacao_func
    WHEN 'cancelada' THEN 'estornado'::public.status_movimentacao_func
    ELSE 'pendente'::public.status_movimentacao_func
  END;
$$;

-- Categorias de pessoal que devem sincronizar
CREATE OR REPLACE FUNCTION public._is_categoria_pessoal(p_categoria text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(coalesce(p_categoria,'')) IN (
    'salários','salarios','vale transporte','vale alimentação','vale alimentacao',
    'comissões','comissoes','pessoal','folha de pagamento','folha'
  );
$$;

-- Trigger: sincroniza Financeiro -> RH
CREATE OR REPLACE FUNCTION public.sync_fin_para_rh()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND public._is_categoria_pessoal(NEW.categoria) THEN
    UPDATE public.funcionario_movimentacoes
       SET status = public._map_status_conta_to_rh(NEW.status),
           data_pagamento = CASE
              WHEN public._map_status_conta_to_rh(NEW.status) = 'pago'
                THEN COALESCE(NEW.data_pagamento, CURRENT_DATE)
              ELSE NULL
           END,
           estornada_em = CASE
              WHEN public._map_status_conta_to_rh(NEW.status) = 'estornado' AND estornada_em IS NULL
                THEN now()
              WHEN public._map_status_conta_to_rh(NEW.status) <> 'estornado'
                THEN NULL
              ELSE estornada_em
           END
     WHERE conta_pagar_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_fin_rh ON public.contas_a_pagar;
CREATE TRIGGER trg_sync_fin_rh
AFTER UPDATE OF status, data_pagamento ON public.contas_a_pagar
FOR EACH ROW EXECUTE FUNCTION public.sync_fin_para_rh();

-- RPC de reconciliação (dry-run por padrão)
CREATE OR REPLACE FUNCTION public.rh_fin_reconciliar(p_dry_run boolean DEFAULT true)
RETURNS TABLE (
  funcionario text,
  tipo text,
  competencia text,
  status_fin text,
  status_rh_antes text,
  acao text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_alvo public.status_movimentacao_func;
  r record;
BEGIN
  IF v_emp IS NULL OR NOT (public.is_adm() OR public.is_rh()) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  FOR r IN
    SELECT f.nome AS func_nome,
           fm.tipo::text AS tipo,
           fm.competencia_ano_mes AS comp,
           cap.status::text AS st_fin,
           fm.status::text AS st_rh,
           fm.id AS fm_id,
           cap.status AS st_fin_enum,
           cap.data_pagamento AS dt_pag
      FROM public.funcionario_movimentacoes fm
      JOIN public.funcionarios f ON f.id = fm.funcionario_id
      JOIN public.contas_a_pagar cap ON cap.id = fm.conta_pagar_id
     WHERE fm.empresa_id = v_emp
       AND fm.conta_pagar_id IS NOT NULL
       AND cap.deleted_at IS NULL
  LOOP
    v_alvo := public._map_status_conta_to_rh(r.st_fin_enum);
    IF r.st_rh::public.status_movimentacao_func IS DISTINCT FROM v_alvo THEN
      IF NOT p_dry_run THEN
        UPDATE public.funcionario_movimentacoes
           SET status = v_alvo,
               data_pagamento = CASE WHEN v_alvo='pago' THEN COALESCE(r.dt_pag, CURRENT_DATE) ELSE NULL END
         WHERE id = r.fm_id;
      END IF;
      funcionario := r.func_nome; tipo := r.tipo; competencia := r.comp;
      status_fin := r.st_fin; status_rh_antes := r.st_rh;
      acao := CASE WHEN p_dry_run THEN 'sincronizar (preview)' ELSE 'sincronizado' END;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- linhas RH sem vínculo (informativo)
  FOR r IN
    SELECT f.nome AS func_nome, fm.tipo::text AS tipo, fm.competencia_ano_mes AS comp, fm.status::text AS st_rh
      FROM public.funcionario_movimentacoes fm
      JOIN public.funcionarios f ON f.id = fm.funcionario_id
     WHERE fm.empresa_id = v_emp
       AND fm.conta_pagar_id IS NULL
       AND fm.tipo IN ('salario','vale_transporte','vale_alimentacao','comissao')
  LOOP
    funcionario := r.func_nome; tipo := r.tipo; competencia := r.comp;
    status_fin := NULL; status_rh_antes := r.st_rh;
    acao := 'sem par no financeiro (revisar)';
    RETURN NEXT;
  END LOOP;
END; $$;

GRANT EXECUTE ON FUNCTION public.rh_fin_reconciliar(boolean) TO authenticated;

-- Sync inicial: corrige divergências históricas nos pares já vinculados
UPDATE public.funcionario_movimentacoes fm
   SET status = public._map_status_conta_to_rh(cap.status),
       data_pagamento = CASE
         WHEN public._map_status_conta_to_rh(cap.status) = 'pago'
           THEN COALESCE(cap.data_pagamento, fm.data_pagamento, CURRENT_DATE)
         ELSE NULL
       END
  FROM public.contas_a_pagar cap
 WHERE fm.conta_pagar_id = cap.id
   AND cap.deleted_at IS NULL
   AND public._is_categoria_pessoal(cap.categoria)
   AND fm.status IS DISTINCT FROM public._map_status_conta_to_rh(cap.status);
