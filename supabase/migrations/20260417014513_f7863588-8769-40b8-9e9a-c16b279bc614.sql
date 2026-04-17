-- 1. Recriar pecas_utilizadas para apontar para estoque_itens (tabela ativa, antiga 'estoque' está vazia)
ALTER TABLE public.pecas_utilizadas DROP CONSTRAINT IF EXISTS pecas_utilizadas_peca_id_fkey;
ALTER TABLE public.pecas_utilizadas 
  ADD CONSTRAINT pecas_utilizadas_peca_id_fkey 
  FOREIGN KEY (peca_id) REFERENCES public.estoque_itens(id) ON DELETE RESTRICT;

-- 2. Adicionar preco_unitario (preço cobrado do cliente, snapshot histórico)
ALTER TABLE public.pecas_utilizadas
  ADD COLUMN IF NOT EXISTS preco_unitario numeric(10,2) NOT NULL DEFAULT 0;

-- 3. Adicionar origem_servico_id para rastrear peças auto-adicionadas por serviço
ALTER TABLE public.pecas_utilizadas
  ADD COLUMN IF NOT EXISTS origem_servico_id uuid REFERENCES public.tipos_servico(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pecas_utilizadas_origem_servico 
  ON public.pecas_utilizadas(origem_servico_id);

-- 4. os_servicos: adicionar comissao (snapshot do valor de comissão do técnico no momento da criação)
ALTER TABLE public.os_servicos
  ADD COLUMN IF NOT EXISTS comissao numeric(10,2) NOT NULL DEFAULT 0;

-- 5. Trigger: ao mudar status da OS para 'aprovado' via aprovado_no_ato, gravar timestamp
ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS orcamento_aprovado_em timestamptz;

-- 6. valor_total já existe; mao_obra_adicional, desconto, aprovado_no_ato, relato_cliente também já. OK.