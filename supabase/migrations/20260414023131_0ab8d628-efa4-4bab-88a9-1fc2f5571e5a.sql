CREATE TABLE public.entradas_estoque (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  fornecedor_nome TEXT,
  data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  numero_nota TEXT,
  valor_total NUMERIC DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.entradas_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access entradas_estoque"
  ON public.entradas_estoque FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TABLE public.entradas_estoque_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entrada_id UUID NOT NULL REFERENCES public.entradas_estoque(id) ON DELETE CASCADE,
  estoque_item_id UUID NOT NULL REFERENCES public.estoque_itens(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL,
  custo_unitario NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.entradas_estoque_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access entradas_estoque_itens"
  ON public.entradas_estoque_itens FOR ALL TO authenticated
  USING (true) WITH CHECK (true);