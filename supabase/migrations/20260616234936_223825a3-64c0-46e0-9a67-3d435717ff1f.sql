-- 1) Índices únicos parciais por empresa para IMEI 1 e IMEI 2
CREATE UNIQUE INDEX IF NOT EXISTS ux_atacado_aparelhos_imei1_empresa
  ON public.atacado_aparelhos (empresa_id, imei_1)
  WHERE deleted_at IS NULL AND imei_1 IS NOT NULL AND imei_1 <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_atacado_aparelhos_imei2_empresa
  ON public.atacado_aparelhos (empresa_id, imei_2)
  WHERE deleted_at IS NULL AND imei_2 IS NOT NULL AND imei_2 <> '';

-- 2) RPC com tratamento de unique_violation
CREATE OR REPLACE FUNCTION public.atacado_cadastrar_lote(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_inv uuid; v_unit jsonb; v_ap uuid; v_ass jsonb; c jsonb;
  v_cot numeric := NULLIF(p_payload->>'cotacao','')::numeric;
  v_imp boolean := COALESCE((p_payload->>'importado')::boolean,false);
  v_prod_moeda numeric := COALESCE((p_payload->>'custo_produto')::numeric,0);
  v_prod_brl numeric;
  v_custo_base numeric;
  v_count int := 0;
  v_imei_atual text;
BEGIN
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success',false,'error','sem empresa'); END IF;

  v_prod_brl := CASE WHEN v_imp AND v_cot IS NOT NULL THEN v_prod_moeda * v_cot ELSE v_prod_moeda END;

  INSERT INTO public.atacado_invoices (empresa_id, importado, fornecedor, numero, data_compra, pais_origem, moeda, cotacao, observacoes)
  VALUES (v_emp, v_imp, p_payload->>'fornecedor', p_payload->>'numero',
          NULLIF(p_payload->>'data_compra','')::date, p_payload->>'pais_origem',
          p_payload->>'moeda', v_cot, p_payload->>'observacoes')
  RETURNING id INTO v_inv;

  v_custo_base := v_prod_brl;
  FOR c IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'custos','[]'::jsonb)) LOOP
    INSERT INTO public.atacado_invoice_custos (empresa_id, invoice_id, tipo, descricao, moeda, modo, valor)
    VALUES (v_emp, v_inv, c->>'tipo', c->>'descricao',
            COALESCE(c->>'moeda','BRL'), COALESCE(c->>'modo','fixo'), COALESCE((c->>'valor')::numeric,0));

    IF COALESCE(c->>'modo','fixo') = 'pct' THEN
      v_custo_base := v_custo_base + v_prod_brl * (COALESCE((c->>'valor')::numeric,0)/100);
    ELSIF COALESCE(c->>'moeda','BRL') = 'BRL' THEN
      v_custo_base := v_custo_base + COALESCE((c->>'valor')::numeric,0);
    ELSE
      v_custo_base := v_custo_base + COALESCE((c->>'valor')::numeric,0) * COALESCE(v_cot,1);
    END IF;
  END LOOP;

  FOR v_unit IN SELECT * FROM jsonb_array_elements(p_payload->'unidades') LOOP
    v_imei_atual := v_unit->>'imei1';
    BEGIN
      INSERT INTO public.atacado_aparelhos (
        empresa_id, invoice_id, marca, modelo, capacidade, cor, grade, condicao,
        imei_1, imei_2, status, quantidade, custo, preco_sugerido
      ) VALUES (
        v_emp, v_inv, p_payload->>'marca', p_payload->>'modelo', p_payload->>'capacidade',
        p_payload->>'cor', p_payload->>'grade', p_payload->>'condicao',
        v_unit->>'imei1', v_unit->>'imei2', p_payload->>'status', 1,
        v_custo_base, COALESCE((p_payload->>'preco_venda')::numeric,0)
      ) RETURNING id INTO v_ap;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'IMEI já cadastrado no estoque do Atacado: %', COALESCE(v_unit->>'imei1', v_unit->>'imei2')
        USING ERRCODE = 'P0001';
    END;

    FOR v_ass IN SELECT * FROM jsonb_array_elements(COALESCE(v_unit->'assistencias','[]'::jsonb)) LOOP
      INSERT INTO public.atacado_aparelho_assistencias (empresa_id, aparelho_id, tipo_nome, valor)
      VALUES (v_emp, v_ap, v_ass->>'nome', COALESCE((v_ass->>'valor')::numeric,0));
      UPDATE public.atacado_aparelhos SET custo = custo + COALESCE((v_ass->>'valor')::numeric,0)
       WHERE id = v_ap;
    END LOOP;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success',true,'invoice_id',v_inv,'aparelhos',v_count);
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END; $$;