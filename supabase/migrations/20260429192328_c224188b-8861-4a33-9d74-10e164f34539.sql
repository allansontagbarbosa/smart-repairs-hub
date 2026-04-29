-- Mudança 1: corrigir lucro bruto em recalcular_totais_os, preservando o restante do código
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
  v_margem numeric := 0;
BEGIN
  SELECT COALESCE(SUM(valor), 0), COALESCE(SUM(comissao), 0), COUNT(*)
    INTO v_subtotal_servicos, v_comissao_servicos_tabela, v_count_servicos
    FROM public.os_servicos
    WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(SUM(preco_unitario * quantidade), 0),
         COALESCE(SUM(custo_unitario * quantidade), 0),
         COUNT(*)
    INTO v_subtotal_pecas, v_custo_pecas, v_count_pecas
    FROM public.pecas_utilizadas
    WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(mao_obra_adicional, 0), COALESCE(desconto, 0), COALESCE(valor, 0)
    INTO v_mao_obra_adicional, v_desconto, v_valor_cobrado
    FROM public.ordens_de_servico
    WHERE id = p_ordem_id;

  IF v_count_servicos = 0 AND v_mao_obra_adicional = 0 AND v_valor_cobrado > 0 THEN
    v_valor_total := v_valor_cobrado - v_desconto;
  ELSE
    v_valor_total := v_subtotal_servicos + v_mao_obra_adicional - v_desconto;
  END IF;

  v_custo_mao_obra := v_comissao_servicos_tabela;
  v_custo_total := v_custo_pecas + v_custo_mao_obra;
  v_lucro_bruto := v_valor_total - v_custo_pecas - v_custo_mao_obra;

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

-- Mudança 2: remover triggers redundantes em os_servicos, mantendo trg_os_servicos_recalcular
DROP TRIGGER IF EXISTS trg_os_servicos_recalcular_totais ON public.os_servicos;
DROP TRIGGER IF EXISTS trg_recalc_os_servicos ON public.os_servicos;

DROP FUNCTION IF EXISTS public.os_servicos_after_change() CASCADE;

-- Confirmar uso remanescente de trg_recalcular_totais_os antes de decidir remover
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'trg_recalcular_totais_os'
      AND NOT t.tgisinternal
  ) THEN
    DROP FUNCTION IF EXISTS public.trg_recalcular_totais_os() CASCADE;
  END IF;
END;
$$;