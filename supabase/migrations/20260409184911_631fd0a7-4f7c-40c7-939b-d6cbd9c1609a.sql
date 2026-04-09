
-- Configurações da empresa
CREATE TABLE public.empresa_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  logo_url text,
  cnpj_cpf text,
  telefone text,
  email text,
  endereco text,
  cidade text,
  estado text,
  horario_funcionamento text,
  cor_principal text DEFAULT '#3b82f6',
  observacoes text,
  moeda text DEFAULT 'BRL',
  formato_data text DEFAULT 'DD/MM/YYYY',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.empresa_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.empresa_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_empresa_config_updated_at BEFORE UPDATE ON public.empresa_config FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Fornecedores
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  responsavel text,
  telefone text,
  whatsapp text,
  email text,
  cnpj_cpf text,
  endereco text,
  categoria text,
  prazo_medio text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.fornecedores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_fornecedores_updated_at BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE INDEX idx_fornecedores_nome ON public.fornecedores(nome);
CREATE INDEX idx_fornecedores_ativo ON public.fornecedores(ativo);

-- Produtos base (cadastro mãe)
CREATE TABLE public.produtos_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria_id uuid REFERENCES public.estoque_categorias(id),
  marca_id uuid REFERENCES public.marcas(id),
  modelo_id uuid REFERENCES public.modelos(id),
  descricao text,
  custo numeric DEFAULT 0,
  preco_padrao numeric DEFAULT 0,
  preco_especial numeric,
  sku text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.produtos_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.produtos_base FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_produtos_base_updated_at BEFORE UPDATE ON public.produtos_base FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE INDEX idx_produtos_base_nome ON public.produtos_base(nome);
CREATE INDEX idx_produtos_base_sku ON public.produtos_base(sku);

-- Modelos de documento
CREATE TABLE public.modelos_documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL, -- laudo, recibo, ordem_servico, orcamento
  titulo text NOT NULL,
  cabecalho text,
  corpo text,
  rodape text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.modelos_documento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.modelos_documento FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_modelos_documento_updated_at BEFORE UPDATE ON public.modelos_documento FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Listas de preço
CREATE TABLE public.listas_preco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id),
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listas_preco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.listas_preco FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_listas_preco_updated_at BEFORE UPDATE ON public.listas_preco FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Itens da lista de preço
CREATE TABLE public.listas_preco_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id uuid NOT NULL REFERENCES public.listas_preco(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'produto', -- produto ou servico
  referencia_id uuid, -- id do produto_base ou tipo_servico
  nome_item text NOT NULL,
  preco_padrao numeric DEFAULT 0,
  preco_especial numeric,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listas_preco_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.listas_preco_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inserir config inicial da empresa
INSERT INTO public.empresa_config (nome) VALUES ('Minha Assistência Técnica');

-- Inserir modelos de documento padrão
INSERT INTO public.modelos_documento (tipo, titulo, cabecalho, corpo, rodape) VALUES
('laudo', 'Laudo Técnico Padrão', 'LAUDO TÉCNICO', 'Prezado(a) cliente,\n\nApós análise detalhada do aparelho, informamos o seguinte diagnóstico:\n\n{diagnostico}\n\nServiço realizado: {servico}\nValor: {valor}', 'Este laudo tem validade de 90 dias.'),
('recibo', 'Recibo de Entrega Padrão', 'RECIBO DE ENTREGA', 'Declaro que recebi o aparelho {marca} {modelo} em perfeito estado de funcionamento, conforme serviço realizado na OS nº {numero}.', 'Assinatura do cliente: ___________________'),
('ordem_servico', 'Ordem de Serviço Padrão', 'ORDEM DE SERVIÇO', 'Cliente: {cliente}\nAparelho: {marca} {modelo}\nDefeito: {defeito}\nDiagnóstico: {diagnostico}\nValor: {valor}', 'Autorizo o serviço descrito acima.'),
('orcamento', 'Orçamento Padrão', 'ORÇAMENTO', 'Prezado(a) {cliente},\n\nSegue orçamento para o serviço solicitado:\n\nAparelho: {marca} {modelo}\nServiço: {servico}\nValor: {valor}\n\nValidade: 7 dias', 'Condições: pagamento à vista ou conforme combinado.');
