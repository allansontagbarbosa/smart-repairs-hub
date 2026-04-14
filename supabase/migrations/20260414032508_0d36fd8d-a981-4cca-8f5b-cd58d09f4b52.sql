
-- Purchase orders
CREATE TABLE IF NOT EXISTS public.pedidos_compra (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  data_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
  data_previsao DATE,
  data_recebimento DATE,
  valor_total NUMERIC DEFAULT 0,
  observacoes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pedidos_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access pedidos_compra" ON public.pedidos_compra
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_pedidos_compra_updated_at
BEFORE UPDATE ON public.pedidos_compra
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Purchase order items
CREATE TABLE IF NOT EXISTS public.pedidos_compra_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos_compra(id) ON DELETE CASCADE,
  estoque_item_id UUID REFERENCES public.estoque_itens(id) ON DELETE SET NULL,
  nome_item TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  quantidade_recebida INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pedidos_compra_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access pedidos_compra_itens" ON public.pedidos_compra_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Supplier ratings
CREATE TABLE IF NOT EXISTS public.avaliacoes_fornecedor (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES public.pedidos_compra(id) ON DELETE SET NULL,
  nota_prazo INTEGER CHECK (nota_prazo >= 1 AND nota_prazo <= 5),
  nota_qualidade INTEGER CHECK (nota_qualidade >= 1 AND nota_qualidade <= 5),
  nota_preco INTEGER CHECK (nota_preco >= 1 AND nota_preco <= 5),
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.avaliacoes_fornecedor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access avaliacoes_fornecedor" ON public.avaliacoes_fornecedor
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
