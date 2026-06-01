ALTER TABLE public.assistencia_terceirizacoes
  ADD COLUMN IF NOT EXISTS custo_final        numeric(12,2),
  ADD COLUMN IF NOT EXISTS servico_realizado  text,
  ADD COLUMN IF NOT EXISTS garantia_dias      int,
  ADD COLUMN IF NOT EXISTS garantia_ate       date;

DROP FUNCTION IF EXISTS public.os_terceiro_retornou(uuid, text);

CREATE OR REPLACE FUNCTION public.os_terceiro_retornou(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_terc_id uuid := (p_payload->>'terceirizacao_id')::uuid;
  v_os uuid;
  v_data_retorno date := COALESCE(NULLIF(p_payload->>'data_retorno','')::date, CURRENT_DATE);
  v_dias int := NULLIF(p_payload->>'garantia_dias','')::int;
  v_custo_final numeric := NULLIF(p_payload->>'custo_final','')::numeric;
BEGIN
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success',false,'error','sem empresa'); END IF;

  UPDATE public.assistencia_terceirizacoes
     SET status            = 'retornado',
         data_retorno      = v_data_retorno,
         custo_final       = COALESCE(v_custo_final, custo),
         servico_realizado = p_payload->>'servico_realizado',
         garantia_dias     = v_dias,
         garantia_ate      = CASE WHEN v_dias IS NOT NULL THEN v_data_retorno + v_dias ELSE NULL END,
         observacoes       = COALESCE(p_payload->>'observacoes', observacoes)
   WHERE id = v_terc_id AND empresa_id = v_emp
   RETURNING os_id INTO v_os;

  UPDATE public.ordens_de_servico
     SET status = COALESCE(NULLIF(p_payload->>'novo_status_os',''), 'em_reparo')::status_ordem
   WHERE id = v_os AND empresa_id = v_emp AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', v_os IS NOT NULL, 'os_id', v_os);
END; $$;

CREATE OR REPLACE FUNCTION public.assistencia_garantias_terceiro_vigentes()
RETURNS TABLE (
  terceirizacao_id uuid, os_id uuid, terceiro_nome text, servico_realizado text,
  custo_final numeric, data_retorno date, garantia_ate date, dias_restantes int
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.os_id, t.terceiro_nome, t.servico_realizado, t.custo_final,
         t.data_retorno, t.garantia_ate, (t.garantia_ate - CURRENT_DATE)::int AS dias_restantes
  FROM public.assistencia_terceirizacoes t
  WHERE t.empresa_id = public.get_my_empresa_id()
    AND t.status = 'retornado'
    AND t.garantia_ate IS NOT NULL
    AND t.garantia_ate >= CURRENT_DATE
  ORDER BY t.garantia_ate;
$$;

-- Atualiza cálculo de custo para usar custo_final quando disponível
CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_ordem_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
  v_margem numeric := 0;
BEGIN
  SELECT COALESCE(SUM(valor), 0), COALESCE(SUM(comissao), 0), COUNT(*)
    INTO v_subtotal_servicos, v_comissao_servicos_tabela, v_count_servicos
    FROM public.os_servicos WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(SUM(preco_unitario * quantidade), 0),
         COALESCE(SUM(custo_unitario * quantidade), 0),
         COUNT(*)
    INTO v_subtotal_pecas, v_custo_pecas, v_count_pecas
    FROM public.pecas_utilizadas WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(SUM(COALESCE(custo_final, custo)), 0)
    INTO v_custo_terceiros
    FROM public.assistencia_terceirizacoes
    WHERE os_id = p_ordem_id AND status <> 'cancelado';

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
  v_lucro_bruto := v_valor_total - v_custo_pecas - v_custo_mao_obra - v_custo_terceiros;

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