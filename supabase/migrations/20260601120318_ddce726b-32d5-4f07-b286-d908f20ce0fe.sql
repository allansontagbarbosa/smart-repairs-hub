-- atacado_cad_01_importacao_massa
-- Tabelas de apoio + invoice + RPC para cadastro em massa do Atacado.

-- 0) Colunas faltantes em atacado_aparelhos
ALTER TABLE public.atacado_aparelhos
  ADD COLUMN IF NOT EXISTS marca text,
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS invoice_id uuid;

-- 1) GRADES
CREATE TABLE IF NOT EXISTS public.atacado_grades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  nome        text NOT NULL,
  ordem       int DEFAULT 0,
  ativo       boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_grades TO authenticated;
GRANT ALL ON public.atacado_grades TO service_role;
ALTER TABLE public.atacado_grades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.atacado_grades;
CREATE POLICY tenant_isolation ON public.atacado_grades FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- 2) STATUS customizaveis do aparelho
CREATE TABLE IF NOT EXISTS public.atacado_status_aparelho (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  nome        text NOT NULL,
  cor         text DEFAULT '#888',
  sistema     boolean DEFAULT false,
  ordem       int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_status_aparelho TO authenticated;
GRANT ALL ON public.atacado_status_aparelho TO service_role;
ALTER TABLE public.atacado_status_aparelho ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.atacado_status_aparelho;
CREATE POLICY tenant_isolation ON public.atacado_status_aparelho FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- 3) CORES POR MODELO
CREATE TABLE IF NOT EXISTS public.atacado_modelo_cores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  marca       text NOT NULL,
  modelo      text NOT NULL,
  cor         text NOT NULL,
  created_at  timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_modelo_cores TO authenticated;
GRANT ALL ON public.atacado_modelo_cores TO service_role;
ALTER TABLE public.atacado_modelo_cores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.atacado_modelo_cores;
CREATE POLICY tenant_isolation ON public.atacado_modelo_cores FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- 4) TIPOS DE ASSISTENCIA
CREATE TABLE IF NOT EXISTS public.atacado_tipos_assistencia (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL,
  nome         text NOT NULL,
  valor_padrao numeric(12,2) DEFAULT 0,
  ativo        boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_tipos_assistencia TO authenticated;
GRANT ALL ON public.atacado_tipos_assistencia TO service_role;
ALTER TABLE public.atacado_tipos_assistencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.atacado_tipos_assistencia;
CREATE POLICY tenant_isolation ON public.atacado_tipos_assistencia FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- 5) MOEDAS customizadas
CREATE TABLE IF NOT EXISTS public.atacado_moedas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  codigo      text NOT NULL,
  simbolo     text,
  nome        text,
  created_at  timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_moedas TO authenticated;
GRANT ALL ON public.atacado_moedas TO service_role;
ALTER TABLE public.atacado_moedas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.atacado_moedas;
CREATE POLICY tenant_isolation ON public.atacado_moedas FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- 6) INVOICE
CREATE TABLE IF NOT EXISTS public.atacado_invoices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  importado     boolean DEFAULT false,
  fornecedor    text,
  numero        text,
  data_compra   date,
  pais_origem   text,
  moeda         text,
  cotacao       numeric(12,4),
  observacoes   text,
  created_at    timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_invoices TO authenticated;
GRANT ALL ON public.atacado_invoices TO service_role;
ALTER TABLE public.atacado_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.atacado_invoices;
CREATE POLICY tenant_isolation ON public.atacado_invoices FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- 7) Custos da invoice
CREATE TABLE IF NOT EXISTS public.atacado_invoice_custos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  invoice_id  uuid NOT NULL REFERENCES public.atacado_invoices(id) ON DELETE CASCADE,
  tipo        text NOT NULL,
  descricao   text,
  modo        text NOT NULL DEFAULT 'fixo',
  valor       numeric(12,2) NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_invoice_custos TO authenticated;
GRANT ALL ON public.atacado_invoice_custos TO service_role;
ALTER TABLE public.atacado_invoice_custos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.atacado_invoice_custos;
CREATE POLICY tenant_isolation ON public.atacado_invoice_custos FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- 8) Assistencias por aparelho
CREATE TABLE IF NOT EXISTS public.atacado_aparelho_assistencias (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL,
  aparelho_id  uuid NOT NULL REFERENCES public.atacado_aparelhos(id) ON DELETE CASCADE,
  tipo_nome    text NOT NULL,
  valor        numeric(12,2) NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_aparelho_assistencias TO authenticated;
GRANT ALL ON public.atacado_aparelho_assistencias TO service_role;
ALTER TABLE public.atacado_aparelho_assistencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.atacado_aparelho_assistencias;
CREATE POLICY tenant_isolation ON public.atacado_aparelho_assistencias FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- 9) RPC: cadastro em massa
CREATE OR REPLACE FUNCTION public.atacado_cadastrar_lote(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp        uuid := public.get_my_empresa_id();
  v_inv        uuid;
  v_unit       jsonb;
  v_ap         uuid;
  v_ass        jsonb;
  v_c          jsonb;
  v_custo_base numeric;
  v_produto    numeric := COALESCE((p_payload->>'custo_produto')::numeric, 0);
  v_preco      numeric := COALESCE((p_payload->>'preco_venda')::numeric, 0);
  v_count      int := 0;
BEGIN
  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'sem empresa / nao autenticado');
  END IF;

  INSERT INTO public.atacado_invoices (
    empresa_id, importado, fornecedor, numero, data_compra, pais_origem, moeda, cotacao, observacoes
  ) VALUES (
    v_emp,
    COALESCE((p_payload->>'importado')::boolean, false),
    p_payload->>'fornecedor', p_payload->>'numero',
    NULLIF(p_payload->>'data_compra','')::date,
    p_payload->>'pais_origem', p_payload->>'moeda',
    NULLIF(p_payload->>'cotacao','')::numeric,
    p_payload->>'observacoes'
  ) RETURNING id INTO v_inv;

  v_custo_base := v_produto;

  FOR v_c IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'custos','[]'::jsonb)) LOOP
    INSERT INTO public.atacado_invoice_custos (empresa_id, invoice_id, tipo, descricao, modo, valor)
    VALUES (v_emp, v_inv, v_c->>'tipo', v_c->>'descricao',
            COALESCE(v_c->>'modo','fixo'), COALESCE((v_c->>'valor')::numeric,0));
    IF COALESCE(v_c->>'modo','fixo') = 'pct' THEN
      v_custo_base := v_custo_base + v_produto * (COALESCE((v_c->>'valor')::numeric,0)/100);
    ELSE
      v_custo_base := v_custo_base + COALESCE((v_c->>'valor')::numeric,0);
    END IF;
  END LOOP;

  FOR v_unit IN SELECT * FROM jsonb_array_elements(p_payload->'unidades') LOOP
    INSERT INTO public.atacado_aparelhos (
      empresa_id, invoice_id, marca, modelo, capacidade, cor, grade, condicao,
      imei_1, imei_2, status, quantidade, custo, preco_sugerido
    ) VALUES (
      v_emp, v_inv,
      p_payload->>'marca', p_payload->>'modelo', p_payload->>'capacidade',
      p_payload->>'cor', p_payload->>'grade',
      COALESCE(p_payload->>'condicao','novo'),
      v_unit->>'imei1', v_unit->>'imei2',
      COALESCE(p_payload->>'status','estoque'),
      1, v_custo_base, v_preco
    ) RETURNING id INTO v_ap;

    FOR v_ass IN SELECT * FROM jsonb_array_elements(COALESCE(v_unit->'assistencias','[]'::jsonb)) LOOP
      INSERT INTO public.atacado_aparelho_assistencias (empresa_id, aparelho_id, tipo_nome, valor)
      VALUES (v_emp, v_ap, v_ass->>'nome', COALESCE((v_ass->>'valor')::numeric,0));
      UPDATE public.atacado_aparelhos
         SET custo = custo + COALESCE((v_ass->>'valor')::numeric,0)
       WHERE id = v_ap;
    END LOOP;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'invoice_id', v_inv, 'aparelhos', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.atacado_cadastrar_lote(jsonb) TO authenticated;