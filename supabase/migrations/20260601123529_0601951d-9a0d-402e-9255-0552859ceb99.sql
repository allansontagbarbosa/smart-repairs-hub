-- ATACADO-CAD-01 (parte 2): catalogo encadeado + multimoeda + RPCs atualizadas

-- 1) Catalogo de modelos (marca/modelo/capacidades/cores)
CREATE TABLE IF NOT EXISTS public.atacado_catalogo_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  marca text NOT NULL,
  modelo text NOT NULL,
  capacidades text[] DEFAULT '{}',
  cores text[] DEFAULT '{}',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_catalogo_modelos TO authenticated;
GRANT ALL ON public.atacado_catalogo_modelos TO service_role;

ALTER TABLE public.atacado_catalogo_modelos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.atacado_catalogo_modelos;
CREATE POLICY tenant_isolation ON public.atacado_catalogo_modelos FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- 2) Coluna `moeda` em atacado_invoice_custos (multimoeda por linha)
ALTER TABLE public.atacado_invoice_custos
  ADD COLUMN IF NOT EXISTS moeda text NOT NULL DEFAULT 'BRL';

-- 3) RPC: gerenciar tipos de assistencia (criar/editar/ativar)
CREATE OR REPLACE FUNCTION public.atacado_salvar_tipo_assistencia(
  p_id uuid, p_nome text, p_valor numeric, p_ativo boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid;
BEGIN
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success',false,'error','sem empresa'); END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.atacado_tipos_assistencia (empresa_id, nome, valor_padrao, ativo)
    VALUES (v_emp, p_nome, COALESCE(p_valor,0), COALESCE(p_ativo,true)) RETURNING id INTO v_id;
  ELSE
    UPDATE public.atacado_tipos_assistencia
       SET nome = p_nome, valor_padrao = COALESCE(p_valor,0), ativo = COALESCE(p_ativo,true)
     WHERE id = p_id AND empresa_id = v_emp RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('success', v_id IS NOT NULL, 'id', v_id);
END; $$;

-- 4) RPC atacado_cadastrar_lote: reescrita para multimoeda, cotacao travada, assistencia carimbada
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
    INSERT INTO public.atacado_aparelhos (
      empresa_id, invoice_id, marca, modelo, capacidade, cor, grade, condicao,
      imei_1, imei_2, status, quantidade, custo, preco_sugerido
    ) VALUES (
      v_emp, v_inv, p_payload->>'marca', p_payload->>'modelo', p_payload->>'capacidade',
      p_payload->>'cor', p_payload->>'grade', p_payload->>'condicao',
      v_unit->>'imei1', v_unit->>'imei2', p_payload->>'status', 1,
      v_custo_base, COALESCE((p_payload->>'preco_venda')::numeric,0)
    ) RETURNING id INTO v_ap;

    FOR v_ass IN SELECT * FROM jsonb_array_elements(COALESCE(v_unit->'assistencias','[]'::jsonb)) LOOP
      INSERT INTO public.atacado_aparelho_assistencias (empresa_id, aparelho_id, tipo_nome, valor)
      VALUES (v_emp, v_ap, v_ass->>'nome', COALESCE((v_ass->>'valor')::numeric,0));
      UPDATE public.atacado_aparelhos SET custo = custo + COALESCE((v_ass->>'valor')::numeric,0)
       WHERE id = v_ap;
    END LOOP;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success',true,'invoice_id',v_inv,'aparelhos',v_count);
END; $$;