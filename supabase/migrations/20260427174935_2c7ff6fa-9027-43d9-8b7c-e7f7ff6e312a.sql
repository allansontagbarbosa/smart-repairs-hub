CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_ordem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_funcionario_id uuid;
  v_tipo_comissao text;
  v_valor_comissao numeric := 0;
  v_custo_mao_obra numeric := 0;
  v_margem numeric := 0;
BEGIN
  SELECT COALESCE(SUM(valor),0), COALESCE(SUM(comissao),0), COUNT(*)
    INTO v_subtotal_servicos, v_comissao_servicos_tabela, v_count_servicos
    FROM public.os_servicos WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(SUM(preco_unitario * quantidade),0),
         COALESCE(SUM(custo_unitario * quantidade),0),
         COUNT(*)
    INTO v_subtotal_pecas, v_custo_pecas, v_count_pecas
    FROM public.pecas_utilizadas WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(mao_obra_adicional,0), COALESCE(desconto,0), COALESCE(valor,0), funcionario_id
    INTO v_mao_obra_adicional, v_desconto, v_valor_cobrado, v_funcionario_id
    FROM public.ordens_de_servico WHERE id = p_ordem_id;

  -- Peças são custo operacional, não receita da OS.
  -- Fallback legado: quando não há serviços estruturados, mantém o valor manual cobrado.
  IF v_count_servicos = 0 AND v_mao_obra_adicional = 0 AND v_valor_cobrado > 0 THEN
    v_valor_total := v_valor_cobrado - v_desconto;
  ELSE
    v_valor_total := v_subtotal_servicos + v_mao_obra_adicional - v_desconto;
  END IF;

  IF v_funcionario_id IS NOT NULL THEN
    SELECT tipo_comissao::text, COALESCE(valor_comissao, 0)
      INTO v_tipo_comissao, v_valor_comissao
      FROM public.funcionarios
      WHERE id = v_funcionario_id;

    IF v_tipo_comissao IS NOT NULL AND v_valor_comissao > 0 THEN
      v_custo_mao_obra := CASE v_tipo_comissao
        WHEN 'percentual'        THEN v_valor_total * (v_valor_comissao / 100)
        WHEN 'fixa'              THEN v_valor_comissao
        WHEN 'fixo_por_os'       THEN v_valor_comissao
        WHEN 'percentual_lucro'  THEN GREATEST(0, v_valor_total - v_custo_pecas) * (v_valor_comissao / 100)
        ELSE 0
      END;
    END IF;
  END IF;

  IF v_custo_mao_obra = 0 AND v_comissao_servicos_tabela > 0 THEN
    v_custo_mao_obra := v_comissao_servicos_tabela;
  END IF;

  v_custo_total := v_custo_pecas + v_custo_mao_obra;
  v_lucro_bruto := v_valor_total - v_custo_pecas;

  IF v_valor_total > 0 THEN
    v_margem := (v_lucro_bruto / v_valor_total) * 100;
  END IF;

  UPDATE public.ordens_de_servico
    SET valor_total = v_valor_total,
        valor_total_servicos = v_subtotal_servicos,
        valor_total_pecas = v_subtotal_pecas,
        custo_pecas = v_custo_pecas,
        custo_mao_de_obra = v_custo_mao_de_obra,
        custo_total = v_custo_total,
        lucro_bruto = v_lucro_bruto,
        margem_calculada = v_margem
    WHERE id = p_ordem_id;
END;
$$;