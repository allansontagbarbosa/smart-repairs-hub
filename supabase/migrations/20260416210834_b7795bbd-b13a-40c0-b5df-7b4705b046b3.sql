-- Normalizar peças legadas antes de aplicar a constraint
-- Diagnóstico (executado antes): 0 sem_custo, 0 venda_menor_custo, 45 sem_venda

-- 4.1: peças sem custo → usar preço_venda ou 0.01 como placeholder
UPDATE public.estoque_itens
SET custo_unitario = COALESCE(NULLIF(preco_venda, 0), 0.01)
WHERE tipo_item = 'peca'
  AND deleted_at IS NULL
  AND (custo_unitario IS NULL OR custo_unitario = 0);

-- 4.2: venda < custo → igualar venda ao custo
UPDATE public.estoque_itens
SET preco_venda = custo_unitario
WHERE tipo_item = 'peca'
  AND deleted_at IS NULL
  AND preco_venda IS NOT NULL
  AND custo_unitario IS NOT NULL
  AND preco_venda < custo_unitario;

-- 4.3: sem venda → preencher com o custo
UPDATE public.estoque_itens
SET preco_venda = custo_unitario
WHERE tipo_item = 'peca'
  AND deleted_at IS NULL
  AND preco_venda IS NULL
  AND custo_unitario IS NOT NULL;

-- Constraint: venda >= custo (apenas quando ambos preenchidos)
ALTER TABLE public.estoque_itens
  DROP CONSTRAINT IF EXISTS preco_venda_maior_igual_custo;

ALTER TABLE public.estoque_itens
  ADD CONSTRAINT preco_venda_maior_igual_custo
  CHECK (preco_venda IS NULL OR custo_unitario IS NULL OR preco_venda >= custo_unitario);